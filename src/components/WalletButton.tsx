import { useState } from "react";
import { Wallet, ChevronDown, LogOut, Copy, Shield, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useWallet, isCorrectChain } from "@/contexts/WalletContext";
import { shortAddr } from "@/lib/web3/ethers";
import { CHAIN } from "@/lib/web3/contracts";
import { toast } from "sonner";

// Logos sourced from WalletConnect Cloud Explorer CDN (stable, no auth)
// + each wallet's own brand asset CDN as a fallback.
const wallets: { kind: "metamask" | "rabby" | "okx" | "bitget"; name: string; logo: string; desc: string; tag?: string }[] = [
  {
    kind: "metamask",
    name: "MetaMask",
    desc: "The most popular self-custody Web3 wallet",
    tag: "Popular",
    logo: "https://explorer-api.walletconnect.com/v3/logo/lg/c57ca95b47569778a828d19178114f4db188b89b763c899ba0be274e97267d96?projectId=2f05a7cd",
  },
  {
    kind: "rabby",
    name: "Rabby Wallet",
    desc: "Multi-chain wallet by DeBank — built for DeFi",
    tag: "DeFi-first",
    logo: "https://explorer-api.walletconnect.com/v3/logo/lg/4b525569-c4b7-4b1c-b13d-86b561e1c000?projectId=2f05a7cd",
  },
  {
    kind: "okx",
    name: "OKX Wallet",
    desc: "Multichain Web3 wallet by OKX",
    logo: "https://explorer-api.walletconnect.com/v3/logo/lg/45f2f08e-fc0c-4d62-3e63-404e72170500?projectId=2f05a7cd",
  },
  {
    kind: "bitget",
    name: "Bitget Wallet",
    desc: "All-in-one Web3 wallet by Bitget",
    logo: "https://explorer-api.walletconnect.com/v3/logo/lg/d10c4bbc-95b1-4e07-9d0d-b8202745f000?projectId=2f05a7cd",
  },
];

export function WalletButton() {
  const { address, chainId, balance, connect, disconnect } = useWallet();
  const [open, setOpen] = useState(false);
  const [connecting, setConnecting] = useState<string | null>(null);

  if (!address) {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button
            className="rounded-full shadow-[0_8px_30px_-8px_rgba(236,72,153,0.6)] bg-gradient-to-r from-pink-500 via-fuchsia-500 to-purple-500 hover:from-pink-400 hover:via-fuchsia-400 hover:to-purple-400 text-white border-0 font-semibold"
            size="sm"
          >
            <Wallet className="w-4 h-4 mr-2" /> Connect Wallet
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-md p-0 overflow-hidden border-0 bg-transparent shadow-none">
          <div className="relative form-panel rounded-3xl p-6 overflow-hidden">
            {/* decorative gradient halo */}
            <div aria-hidden className="absolute -top-24 -right-24 w-64 h-64 rounded-full bg-gradient-to-br from-pink-400/40 to-fuchsia-500/30 blur-3xl pointer-events-none" />
            <div aria-hidden className="absolute -bottom-24 -left-24 w-64 h-64 rounded-full bg-gradient-to-br from-purple-400/30 to-sky-400/20 blur-3xl pointer-events-none" />

            <DialogHeader className="relative">
              <DialogTitle className="gradient-text text-2xl font-bold">Connect Wallet</DialogTitle>
            </DialogHeader>
            <p className="relative text-sm text-muted-foreground -mt-1 mb-4">
              Pick a wallet to continue on{" "}
              <span className="font-semibold text-foreground">{CHAIN.name}</span>.
            </p>

            <div className="relative space-y-2.5">
              {wallets.map((w) => {
                const isConnecting = connecting === w.kind;
                return (
                  <button
                    key={w.kind}
                    disabled={connecting !== null}
                    onClick={async () => {
                      setConnecting(w.kind);
                      try {
                        await connect(w.kind);
                        setOpen(false);
                        toast.success(`Connected to ${w.name}`);
                      } catch (e: any) {
                        toast.error(e?.message ?? "Failed to connect");
                      } finally {
                        setConnecting(null);
                      }
                    }}
                    className="group w-full flex items-center gap-3 p-4 rounded-2xl border border-border bg-background/60 hover:border-primary/70 hover:bg-accent/40 transition-all disabled:opacity-60 hover:-translate-y-0.5 hover:shadow-[0_10px_30px_-15px_rgba(236,72,153,0.6)]"
                  >
                    <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center p-1.5 shrink-0 ring-1 ring-black/5 shadow-sm">
                      <img
                        src={w.logo}
                        alt={`${w.name} logo`}
                        width={40}
                        height={40}
                        loading="lazy"
                        className="w-full h-full object-contain"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).style.visibility = "hidden";
                        }}
                      />
                    </div>
                    <div className="flex flex-col items-start flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{w.name}</span>
                        {w.tag && (
                          <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-primary/15 text-primary font-bold">
                            {w.tag}
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground truncate w-full text-left">
                        {w.desc}
                      </span>
                    </div>
                    {isConnecting ? (
                      <span className="text-xs text-primary animate-pulse font-medium">Connecting…</span>
                    ) : (
                      <ChevronDown className="w-4 h-4 -rotate-90 text-muted-foreground opacity-0 group-hover:opacity-100 transition" />
                    )}
                  </button>
                );
              })}
            </div>

            <div className="relative mt-5 pt-4 border-t border-border/60 flex items-start gap-2">
              <Shield className="w-4 h-4 text-primary mt-0.5 shrink-0" />
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Non-custodial: your keys never leave your wallet. You'll be asked to
                sign a message to prove ownership (no gas, no transaction).
              </p>
            </div>
            <p className="relative text-[10px] text-muted-foreground/70 text-center pt-2">
              <CheckCircle2 className="w-3 h-3 inline mr-1 text-primary" />
              By connecting you agree to our Terms of Service.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const wrongChain = !isCorrectChain(chainId);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={wrongChain ? "destructive" : "secondary"} className="rounded-full" size="sm">
          {wrongChain ? "Wrong Network" : `${(+balance).toFixed(3)} ${CHAIN.symbol}`}
          <span className="ml-2 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs">{shortAddr(address)}</span>
          <ChevronDown className="w-3 h-3 ml-1" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="glass">
        {wrongChain && (
          <DropdownMenuItem onClick={() => connect((localStorage.getItem("walletKind") as any) ?? "metamask")}>
            Switch to {CHAIN.name}
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={() => { navigator.clipboard.writeText(address); toast.success("Address copied"); }}>
          <Copy className="w-4 h-4 mr-2" /> Copy Address
        </DropdownMenuItem>
        <DropdownMenuItem onClick={disconnect}>
          <LogOut className="w-4 h-4 mr-2" /> Disconnect
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
