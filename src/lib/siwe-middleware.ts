import { createMiddleware } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { verifyJwt } from "./siwe.server";

// Server-fn middleware that requires a valid SIWE JWT in the Authorization
// header. Injects `context.wallet` (verified, lowercased) for handlers to use.
export const requireSiwe = createMiddleware({ type: "function" }).server(async ({ next }) => {
  const auth = getRequestHeader("authorization") ?? getRequestHeader("Authorization") ?? "";
  const m = /^Bearer\s+(.+)$/i.exec(auth);
  if (!m) throw new Error("Sign-in required: please connect & sign with your wallet");
  const claims = await verifyJwt(m[1].trim());
  if (!claims) throw new Error("Session expired or invalid. Please sign in again with your wallet.");
  return next({ context: { wallet: claims.wallet } });
});
