import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { BrowserProvider, formatEther } from "ethers";
import { connectWallet, pickProvider, type WalletKind } from "@/lib/web3/ethers";
import { CHAIN } from "@/lib/web3/contracts";
import { subscribeWeb3Sync } from "@/lib/web3/sync";
import { SIWE_JWT_STORAGE_KEY } from "@/lib/siwe-attacher";

type Ctx = {
  address: string | null;
  signer: any | null;
  provider: BrowserProvider | null;
  chainId: number | null;
  balance: string;
  walletKind: WalletKind | null;
  siweReady: boolean;
  signingIn: boolean;
  ensureSiwe: () => Promise<boolean>;
  connect: (kind: WalletKind) => Promise<void>;
  disconnect: () => void;
  refreshWallet: () => Promise<void>;
};

const WalletCtx = createContext<Ctx | null>(null);

function jwtIsValidFor(wallet: string): boolean {
  try {
    const tok = localStorage.getItem(SIWE_JWT_STORAGE_KEY);
    if (!tok) return false;
    const parts = tok.split(".");
    if (parts.length !== 3) return false;
    const pad = parts[1].length % 4 === 0 ? "" : "=".repeat(4 - (parts[1].length % 4));
    const json = atob(parts[1].replace(/-/g, "+").replace(/_/g, "/") + pad);
    const payload = JSON.parse(json) as { sub?: string; exp?: number };
    if (!payload.sub || !payload.exp) return false;
    if (payload.exp * 1000 < Date.now() + 60_000) return false; // <1min left
    return payload.sub.toLowerCase() === wallet.toLowerCase();
  } catch {
    return false;
  }
}

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [signer, setSigner] = useState<any>(null);
  const [provider, setProvider] = useState<BrowserProvider | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [balance, setBalance] = useState("0");
  const [walletKind, setWalletKind] = useState<WalletKind | null>(null);
  const [siweReady, setSiweReady] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const signingPromise = useRef<Promise<boolean> | null>(null);

  const refreshBalance = useCallback(async (p: BrowserProvider, a: string) => {
    try {
      const bal = await p.getBalance(a);
      setBalance(formatEther(bal));
    } catch {}
  }, []);

  const runSiwe = useCallback(async (addr: string, sgn: any): Promise<boolean> => {
    setSigningIn(true);
    try {
      const nonceRes = await fetch("/api/public/siwe/nonce", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: addr }),
      });
      if (!nonceRes.ok) throw new Error("Failed to start sign-in");
      const { message } = await nonceRes.json();
      const signature: string = await sgn.signMessage(message);
      const verifyRes = await fetch("/api/public/siwe/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, signature }),
      });
      if (!verifyRes.ok) {
        const err = await verifyRes.json().catch(() => ({}));
        throw new Error(err?.error ?? "Verification failed");
      }
      const { jwt } = await verifyRes.json();
      localStorage.setItem(SIWE_JWT_STORAGE_KEY, jwt);
      setSiweReady(true);
      return true;
    } catch (e) {
      console.warn("[siwe] sign-in failed", e);
      setSiweReady(false);
      try { localStorage.removeItem(SIWE_JWT_STORAGE_KEY); } catch {}
      return false;
    } finally {
      setSigningIn(false);
    }
  }, []);

  const ensureSiwe = useCallback(async (): Promise<boolean> => {
    if (!address || !signer) return false;
    if (jwtIsValidFor(address)) {
      if (!siweReady) setSiweReady(true);
      return true;
    }
    if (signingPromise.current) return signingPromise.current;
    const p = runSiwe(address, signer);
    signingPromise.current = p;
    try {
      return await p;
    } finally {
      signingPromise.current = null;
    }
  }, [address, signer, siweReady, runSiwe]);

  const connect = useCallback(async (kind: WalletKind) => {
    const { provider: p, signer: s, address: a } = await connectWallet(kind);
    setProvider(p); setSigner(s); setAddress(a); setWalletKind(kind);
    const net = await p.getNetwork();
    setChainId(Number(net.chainId));
    await refreshBalance(p, a);
    try { localStorage.setItem("walletKind", kind); } catch {}
    // Check existing JWT; if missing/expired, request SIWE signature.
    if (jwtIsValidFor(a)) {
      setSiweReady(true);
    } else {
      // Fire-and-forget; UI surfaces via siweReady + signingIn flags.
      runSiwe(a, s).catch(() => {});
    }
  }, [refreshBalance, runSiwe]);

  const disconnect = useCallback(() => {
    setAddress(null); setSigner(null); setProvider(null); setChainId(null); setBalance("0"); setWalletKind(null);
    setSiweReady(false);
    try {
      localStorage.removeItem("walletKind");
      localStorage.removeItem(SIWE_JWT_STORAGE_KEY);
    } catch {}
  }, []);

  const refreshWallet = useCallback(async () => {
    if (!provider || !address) return;
    await refreshBalance(provider, address);
  }, [provider, address, refreshBalance]);

  // Auto-reconnect on mount + listen for changes
  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = localStorage.getItem("walletKind") as WalletKind | null;
    if (saved) {
      const inj = pickProvider(saved);
      if (inj) {
        (inj as any).request({ method: "eth_accounts" }).then((accts: string[]) => {
          if (accts?.length) connect(saved).catch(() => {});
        }).catch(() => {});
      }
    }
    const inj = pickProvider(saved ?? "metamask") as any;
    if (!inj?.on) return;
    const handleAccts = (a: string[]) => {
      if (!a.length) disconnect();
      else {
        setAddress(a[0]);
        // Account switched: existing JWT no longer matches; clear it.
        try { localStorage.removeItem(SIWE_JWT_STORAGE_KEY); } catch {}
        setSiweReady(false);
      }
    };
    const handleChain = (id: string) => setChainId(parseInt(id, 16));
    inj.on("accountsChanged", handleAccts);
    inj.on("chainChanged", handleChain);
    return () => { try { inj.removeListener("accountsChanged", handleAccts); inj.removeListener("chainChanged", handleChain); } catch {} };
  }, [connect, disconnect]);

  useEffect(() => subscribeWeb3Sync(() => { refreshWallet().catch(() => {}); }), [refreshWallet]);

  const value = useMemo(() => ({
    address, signer, provider, chainId, balance, walletKind,
    siweReady, signingIn, ensureSiwe,
    connect, disconnect, refreshWallet,
  }),
    [address, signer, provider, chainId, balance, walletKind, siweReady, signingIn, ensureSiwe, connect, disconnect, refreshWallet]);

  return <WalletCtx.Provider value={value}>{children}</WalletCtx.Provider>;
}

export function useWallet() {
  const c = useContext(WalletCtx);
  if (!c) throw new Error("useWallet must be inside WalletProvider");
  return c;
}

export const isCorrectChain = (id: number | null) => id === CHAIN.id;
