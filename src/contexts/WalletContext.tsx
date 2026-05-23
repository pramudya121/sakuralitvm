import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { BrowserProvider, formatEther } from "ethers";
import { connectWallet, pickProvider, type WalletKind } from "@/lib/web3/ethers";
import { CHAIN } from "@/lib/web3/contracts";

type Ctx = {
  address: string | null;
  signer: any | null;
  provider: BrowserProvider | null;
  chainId: number | null;
  balance: string;
  walletKind: WalletKind | null;
  connect: (kind: WalletKind) => Promise<void>;
  disconnect: () => void;
  refreshWallet: () => Promise<void>;
};

const WalletCtx = createContext<Ctx | null>(null);

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [signer, setSigner] = useState<any>(null);
  const [provider, setProvider] = useState<BrowserProvider | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [balance, setBalance] = useState("0");
  const [walletKind, setWalletKind] = useState<WalletKind | null>(null);

  const refreshBalance = useCallback(async (p: BrowserProvider, a: string) => {
    try {
      const bal = await p.getBalance(a);
      setBalance(formatEther(bal));
    } catch {}
  }, []);

  const connect = useCallback(async (kind: WalletKind) => {
    const { provider: p, signer: s, address: a } = await connectWallet(kind);
    setProvider(p); setSigner(s); setAddress(a); setWalletKind(kind);
    const net = await p.getNetwork();
    setChainId(Number(net.chainId));
    await refreshBalance(p, a);
    try { localStorage.setItem("walletKind", kind); } catch {}
  }, [refreshBalance]);

  const disconnect = useCallback(() => {
    setAddress(null); setSigner(null); setProvider(null); setChainId(null); setBalance("0"); setWalletKind(null);
    try { localStorage.removeItem("walletKind"); } catch {}
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
    const handleAccts = (a: string[]) => { if (!a.length) disconnect(); else setAddress(a[0]); };
    const handleChain = (id: string) => setChainId(parseInt(id, 16));
    inj.on("accountsChanged", handleAccts);
    inj.on("chainChanged", handleChain);
    return () => { try { inj.removeListener("accountsChanged", handleAccts); inj.removeListener("chainChanged", handleChain); } catch {} };
  }, [connect, disconnect]);

  const value = useMemo(() => ({ address, signer, provider, chainId, balance, walletKind, connect, disconnect, refreshWallet }),
    [address, signer, provider, chainId, balance, walletKind, connect, disconnect, refreshWallet]);

  return <WalletCtx.Provider value={value}>{children}</WalletCtx.Provider>;
}

export function useWallet() {
  const c = useContext(WalletCtx);
  if (!c) throw new Error("useWallet must be inside WalletProvider");
  return c;
}

export const isCorrectChain = (id: number | null) => id === CHAIN.id;
