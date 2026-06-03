// Server-only SIWE helpers: nonce store, message builder, JWT issue/verify.
// Uses SUPABASE_SERVICE_ROLE_KEY (already server-only) as the HMAC signing key
// to avoid requiring a separate secret. Rotating the service role rotates sessions.
import { verifyMessage } from "ethers";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const ETH = /^0x[a-fA-F0-9]{40}$/;
const NONCE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const JWT_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

function getSigningKey(): Uint8Array {
  const k = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!k) throw new Error("Server misconfigured: signing key unavailable");
  return new TextEncoder().encode(k);
}

function b64u(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = "";
  for (let i = 0; i < arr.length; i++) s += String.fromCharCode(arr[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function b64uDecode(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const std = s.replace(/-/g, "+").replace(/_/g, "/") + pad;
  const bin = atob(std);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function hmac(data: string): Promise<Uint8Array> {
  const keyBytes = getSigningKey();
  const keyBuf = keyBytes.buffer.slice(keyBytes.byteOffset, keyBytes.byteOffset + keyBytes.byteLength) as ArrayBuffer;
  const key = await crypto.subtle.importKey(
    "raw",
    keyBuf,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const dataBytes = new TextEncoder().encode(data);
  const dataBuf = dataBytes.buffer.slice(dataBytes.byteOffset, dataBytes.byteOffset + dataBytes.byteLength) as ArrayBuffer;
  const sig = await crypto.subtle.sign("HMAC", key, dataBuf);
  return new Uint8Array(sig);
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a[i] ^ b[i];
  return d === 0;
}

export function randomNonce(): string {
  const buf = new Uint8Array(16);
  crypto.getRandomValues(buf);
  return Array.from(buf).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function buildSiweMessage(address: string, nonce: string, domain: string): string {
  const issuedAt = new Date().toISOString();
  return [
    `${domain} wants you to sign in with your Ethereum account:`,
    address,
    "",
    "Sign in to SakuraNFT. This signature proves you control this wallet and will not trigger any blockchain transaction or cost gas.",
    "",
    `URI: https://${domain}`,
    `Version: 1`,
    `Nonce: ${nonce}`,
    `Issued At: ${issuedAt}`,
  ].join("\n");
}

function parseSiweMessage(msg: string): { address: string; nonce: string; domain: string } | null {
  const lines = msg.split("\n");
  if (lines.length < 9) return null;
  const domainLine = lines[0];
  const domainMatch = /^(\S+) wants you to sign in/.exec(domainLine);
  if (!domainMatch) return null;
  const address = (lines[1] ?? "").trim();
  const nonceLine = lines.find((l) => l.startsWith("Nonce: "));
  if (!nonceLine) return null;
  const nonce = nonceLine.slice("Nonce: ".length).trim();
  if (!ETH.test(address)) return null;
  return { address, nonce, domain: domainMatch[1] };
}

export async function issueNonce(address: string): Promise<string> {
  const wallet = address.toLowerCase();
  if (!ETH.test(wallet)) throw new Error("Invalid address");
  const nonce = randomNonce();
  const expires_at = new Date(Date.now() + NONCE_TTL_MS).toISOString();
  const { error } = await supabaseAdmin
    .from("wallet_nonces")
    .upsert({ wallet_address: wallet, nonce, expires_at }, { onConflict: "wallet_address" });
  if (error) throw new Error(error.message);
  return nonce;
}

export async function verifySiweAndIssueJwt(message: string, signature: string, expectedDomain: string): Promise<{ jwt: string; wallet: string; exp: number }> {
  const parsed = parseSiweMessage(message);
  if (!parsed) throw new Error("Malformed SIWE message");
  // EIP-4361 domain binding: reject signatures issued for a different host
  // (prevents relay attacks where a victim signs on a phishing site and the
  // attacker replays the signature against the real verify endpoint).
  if (!expectedDomain || parsed.domain.toLowerCase() !== expectedDomain.toLowerCase()) {
    throw new Error("Domain mismatch: signature was not issued for this site");
  }
  let recovered: string;
  try {
    recovered = verifyMessage(message, signature);
  } catch {
    throw new Error("Invalid signature");
  }
  if (recovered.toLowerCase() !== parsed.address.toLowerCase()) {
    throw new Error("Signature does not match address");
  }
  // Look up & consume nonce
  const wallet = parsed.address.toLowerCase();
  const { data: row, error } = await supabaseAdmin
    .from("wallet_nonces")
    .select("nonce, expires_at")
    .eq("wallet_address", wallet)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!row) throw new Error("No active challenge for this wallet");
  if (row.nonce !== parsed.nonce) throw new Error("Nonce mismatch");
  if (new Date(row.expires_at).getTime() < Date.now()) {
    throw new Error("Challenge expired, request a new one");
  }
  // Consume the nonce so it cannot be replayed.
  await supabaseAdmin.from("wallet_nonces").delete().eq("wallet_address", wallet);

  // Issue JWT
  const exp = Math.floor(Date.now() / 1000) + JWT_TTL_SECONDS;
  const header = b64u(new TextEncoder().encode(JSON.stringify({ alg: "HS256", typ: "JWT" })));
  const payload = b64u(new TextEncoder().encode(JSON.stringify({ sub: wallet, exp, iat: Math.floor(Date.now() / 1000) })));
  const signingInput = `${header}.${payload}`;
  const sig = await hmac(signingInput);
  const jwt = `${signingInput}.${b64u(sig)}`;
  return { jwt, wallet, exp };
}

export async function verifyJwt(token: string): Promise<{ wallet: string; exp: number } | null> {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [h, p, s] = parts;
  try {
    const expectedSig = await hmac(`${h}.${p}`);
    const providedSig = b64uDecode(s);
    if (!timingSafeEqual(expectedSig, providedSig)) return null;
    const payload = JSON.parse(new TextDecoder().decode(b64uDecode(p))) as { sub?: string; exp?: number };
    if (!payload.sub || !ETH.test(payload.sub) || !payload.exp) return null;
    if (payload.exp * 1000 < Date.now()) return null;
    return { wallet: payload.sub.toLowerCase(), exp: payload.exp };
  } catch {
    return null;
  }
}
