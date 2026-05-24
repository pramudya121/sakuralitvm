import { createMiddleware } from "@tanstack/react-start";

// Forwards the connected wallet address from the browser to server functions
// as `x-wallet-address`. Server-side handlers use this to gate paid features
// (e.g. AI gateway calls) behind a connected wallet.
export const attachWalletHeader = createMiddleware({ type: "function" }).client(async ({ next }) => {
  let wallet: string | null = null;
  try {
    if (typeof window !== "undefined") {
      const k = window.localStorage.getItem("walletKind");
      if (k) {
        const eth = (window as any).ethereum;
        const accts: string[] | undefined = await eth?.request?.({ method: "eth_accounts" });
        if (accts && accts[0]) wallet = accts[0].toLowerCase();
      }
    }
  } catch {}
  return next({ headers: wallet ? { "x-wallet-address": wallet } : {} });
});
