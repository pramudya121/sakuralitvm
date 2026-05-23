import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowDownUp, Loader2, Settings, Plus, MoreHorizontal, ChevronRight, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatEther, parseEther, isAddress } from "ethers";
import { useWallet } from "@/contexts/WalletContext";
import { CHAIN, CONTRACTS } from "@/lib/web3/contracts";
import {
  findBestRoute, swapExactETHForTokens, swapExactTokensForETH, swapExactTokensForTokens,
  getNativeBalance, getTokenBalance, wrapNative, unwrapNative,
} from "@/lib/web3/ethers";
import { subscribeWeb3Sync } from "@/lib/web3/sync";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { TOKENS, type TokenInfo } from "@/lib/tokens";
import { TokenSelectButton } from "@/components/TokenSelectModal";
import { toast } from "sonner";

export const Route = createFileRoute("/dex/swap")({
  component: Swap,
  head: () => ({ meta: [{ title: "Swap — Sakura DEX" }] }),
});

function tokenForAddr(addr: string): TokenInfo {
  const lower = addr.toLowerCase();
  return TOKENS.find((t) => t.address !== "native" && t.address.toLowerCase() === lower)
    ?? { symbol: "?", name: "?", address: addr, decimals: 18, cmcId: 0, logo: "" };
}

function Swap() {
  const { signer, address, refreshWallet } = useWallet();
  const [from, setFrom] = useState<TokenInfo>(TOKENS[0]); // zkLTC native
  const [to, setTo] = useState<TokenInfo>(TOKENS[1]); // wzkLTC
  const [fromAmt, setFromAmt] = useState("");
  const [toAmt, setToAmt] = useState("");
  const [slippage, setSlippage] = useState(0.5);
  const [busy, setBusy] = useState(false);
  const [priceImpact, setPriceImpact] = useState<number | null>(null);
  const [route, setRoute] = useState<string[]>([]);
  const [balFrom, setBalFrom] = useState("0");
  const [balTo, setBalTo] = useState("0");
  const [tick, setTick] = useState(0);

  const fromAddr = from.address === "native" ? CONTRACTS.weth : from.address;
  const toAddr = to.address === "native" ? CONTRACTS.weth : to.address;

  // Wrap / Unwrap detection
  const isWrap = from.address === "native" && to.address !== "native" && to.address.toLowerCase() === CONTRACTS.weth.toLowerCase();
  const isUnwrap = to.address === "native" && from.address !== "native" && from.address.toLowerCase() === CONTRACTS.weth.toLowerCase();
  const isWrapMode = isWrap || isUnwrap;

  // balances
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!address) return;
      try {
        const f = from.address === "native" ? await getNativeBalance(address) : await getTokenBalance(from.address, address);
        if (alive) setBalFrom(formatEther(f));
      } catch { if (alive) setBalFrom("0"); }
      try {
        const t = to.address === "native" ? await getNativeBalance(address) : await getTokenBalance(to.address, address);
        if (alive) setBalTo(formatEther(t));
      } catch { if (alive) setBalTo("0"); }
    })();
    return () => { alive = false; };
  }, [address, from, to, tick]);

  useEffect(() => subscribeWeb3Sync(() => setTick((v) => v + 1)), []);

  // quote (or 1:1 for wrap)
  useEffect(() => {
    if (isWrapMode) {
      setToAmt(fromAmt || "");
      setPriceImpact(null);
      setRoute([]);
      return;
    }
    if (!fromAmt || isNaN(+fromAmt) || +fromAmt <= 0 || !isAddress(fromAddr) || !isAddress(toAddr) || fromAddr.toLowerCase() === toAddr.toLowerCase()) {
      setToAmt(""); setPriceImpact(null); setRoute([]); return;
    }
    let cancelled = false;
    (async () => {
      try {
        const amtIn = parseEther(fromAmt);
        const best = await findBestRoute(amtIn, fromAddr, toAddr);
        if (cancelled) return;
        if (!best) { setToAmt(""); setPriceImpact(null); setRoute([]); return; }
        setToAmt(formatEther(best.out));
        setRoute(best.path);
        try {
          const tiny = parseEther("0.0001");
          const small = await findBestRoute(tiny, fromAddr, toAddr);
          if (small) {
            const spotRate = Number(formatEther(small.out)) / Number(formatEther(tiny));
            const actualRate = Number(formatEther(best.out)) / Number(fromAmt);
            setPriceImpact(Math.max(0, (1 - actualRate / spotRate) * 100));
          }
        } catch { setPriceImpact(null); }
      } catch { if (!cancelled) { setToAmt(""); setPriceImpact(null); setRoute([]); } }
    })();
    return () => { cancelled = true; };
  }, [fromAmt, fromAddr, toAddr, isWrapMode]);

  function flip() { const a = from, b = to; setFrom(b); setTo(a); setFromAmt(toAmt); setToAmt(""); }

  async function handleSwap() {
    if (!signer) return toast.error("Connect wallet");
    if (!fromAmt) return;
    setBusy(true);
    try {
      if (isWrap) {
        toast.loading("Wrapping...", { id: "swap" });
        await wrapNative(signer, fromAmt);
        toast.success(`Wrapped ${fromAmt} ${CHAIN.symbol} → wzkLTC`, { id: "swap" });
        await refreshWallet();
        setFromAmt(""); setToAmt(""); return;
      }
      if (isUnwrap) {
        toast.loading("Unwrapping...", { id: "swap" });
        await unwrapNative(signer, fromAmt);
        toast.success(`Unwrapped ${fromAmt} wzkLTC → ${CHAIN.symbol}`, { id: "swap" });
        await refreshWallet();
        setFromAmt(""); setToAmt(""); return;
      }
      if (!route.length) return;
      toast.loading("Confirm in wallet...", { id: "swap" });
      const amtIn = parseEther(fromAmt);
      if (from.address === "native") {
        await swapExactETHForTokens(signer, route[route.length - 1], fromAmt, slippage);
      } else if (to.address === "native") {
        await swapExactTokensForETH(signer, from.address, amtIn, slippage);
      } else {
        await swapExactTokensForTokens(signer, amtIn, route, slippage);
      }
      toast.success("Swap complete!", { id: "swap" });
      await refreshWallet();
      setFromAmt(""); setToAmt("");
    } catch (e: any) {
      toast.error(e?.shortMessage ?? e?.message ?? "Swap failed", { id: "swap" });
    } finally { setBusy(false); }
  }

  const hops = route.length > 0 ? route.length - 1 : 0;
  const totalFee = (hops * 0.3).toFixed(1);
  const title = isWrap ? "Wrap" : isUnwrap ? "Unwrap" : "Swap";

  return (
    <div className="dex-panel rounded-3xl p-5 space-y-3 max-w-md mx-auto">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">{title}</h2>
        <div className="flex items-center gap-1">
          <button className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center hover:bg-white/10"><Plus className="w-4 h-4" /></button>
          <button className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center hover:bg-white/10"><MoreHorizontal className="w-4 h-4" /></button>
          <Popover>
            <PopoverTrigger asChild>
              <button className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center hover:bg-white/10"><Settings className="w-4 h-4" /></button>
            </PopoverTrigger>
            <PopoverContent className="w-64 glass">
              <p className="text-sm font-medium mb-2">Slippage tolerance</p>
              <div className="flex gap-2 mb-2">
                {[0.1, 0.5, 1, 3].map((v) => (
                  <button key={v} onClick={() => setSlippage(v)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border ${slippage === v ? "border-primary bg-primary/10 text-primary" : ""}`}>{v}%</button>
                ))}
              </div>
              <Input type="number" step="0.1" value={slippage} onChange={(e) => setSlippage(Math.max(0.05, Math.min(50, +e.target.value || 0.5)))} />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* From */}
      <div className="rounded-2xl p-4 bg-[#160c26] border border-white/10">
        <div className="flex justify-between text-xs mb-2">
          <span className="text-white/60">You pay</span>
          <div className="flex items-center gap-1">
            <span className="text-white/60">{(+balFrom).toFixed(4)}</span>
            {[25, 50, 75, 100].map((p) => (
              <button key={p} onClick={() => setFromAmt(((+balFrom * p) / 100).toString())}
                className="px-1.5 text-[10px] rounded text-fuchsia-300 hover:bg-fuchsia-500/10 font-semibold">
                {p === 100 ? "MAX" : `${p}%`}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Input type="number" placeholder="0.0" value={fromAmt}
            onChange={(e) => setFromAmt(e.target.value)}
            className="text-3xl font-bold bg-transparent border-0 px-0 focus-visible:ring-0 h-12 text-white" />
          <TokenSelectButton value={from} onChange={setFrom} />
        </div>
      </div>

      <div className="flex justify-center -my-2 relative z-10">
        <button onClick={flip}
          className="w-10 h-10 rounded-xl bg-[#0c0718] border border-white/10 flex items-center justify-center hover:rotate-180 transition-transform duration-300 shadow-lg">
          <ArrowDownUp className="w-4 h-4" />
        </button>
      </div>

      {/* To */}
      <div className="rounded-2xl p-4 bg-[#160c26] border border-white/10">
        <div className="flex justify-between text-xs mb-2">
          <span className="text-white/60">You receive</span>
          <span className="text-white/60">{(+balTo).toFixed(4)}</span>
        </div>
        <div className="flex items-center gap-2">
          <Input type="number" placeholder="0.0" value={toAmt} readOnly
            className="text-3xl font-bold bg-transparent border-0 px-0 focus-visible:ring-0 h-12 text-white" />
          <TokenSelectButton value={to} onChange={setTo} />
        </div>
      </div>

      {toAmt && !isWrapMode && (
        <div className="flex justify-between text-xs px-1">
          <span className="text-white/60">1 {from.symbol} = {(+toAmt / +fromAmt).toLocaleString(undefined, { maximumFractionDigits: 6 })} {to.symbol}</span>
          {priceImpact !== null && (
            <span className={priceImpact > 5 ? "text-destructive font-semibold" : priceImpact > 1 ? "text-yellow-500" : "text-green-500"}>
              Impact {priceImpact.toFixed(2)}%
            </span>
          )}
        </div>
      )}
      {isWrapMode && fromAmt && (
        <div className="text-xs px-1 text-white/60">1 {from.symbol} = 1 {to.symbol} · No fees, no slippage</div>
      )}

      {route.length > 0 && !isWrapMode && (
        <div className="rounded-2xl p-3 bg-[#160c26] border border-white/10">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs flex items-center gap-1.5 font-semibold"><Zap className="w-3 h-3 text-fuchsia-400" /> Smart Route</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${hops === 1 ? "bg-green-500/20 text-green-500" : "bg-yellow-500/20 text-yellow-500"}`}>
              {hops === 1 ? "Direct" : `${hops} hops`}
            </span>
          </div>
          <div className="flex items-center gap-1 flex-wrap">
            {route.map((addr, i) => {
              const t = (i === 0 && from.address === "native") ? TOKENS[0]
                      : (i === route.length - 1 && to.address === "native") ? TOKENS[0]
                      : tokenForAddr(addr);
              return (
                <span key={i} className="flex items-center gap-1">
                  <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-white/5 text-xs">
                    {t.logo && <img src={t.logo} className="w-4 h-4 rounded-full" />}
                    <span className="font-semibold">{t.symbol}</span>
                  </span>
                  {i < route.length - 1 && <ChevronRight className="w-3 h-3 text-white/40" />}
                </span>
              );
            })}
            <span className="ml-auto text-[10px] text-white/50">{totalFee}% fee</span>
          </div>
        </div>
      )}

      <Button size="lg" disabled={busy || !fromAmt || !signer || (!isWrapMode && !route.length)} onClick={handleSwap}
        className="w-full h-12 rounded-2xl bg-gradient-to-r from-fuchsia-500 to-pink-500 hover:from-fuchsia-400 hover:to-pink-400 text-white font-bold text-base shadow-lg border-0">
        {busy ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Processing...</>
          : !signer ? "Connect Wallet"
          : isWrap ? "Wrap"
          : isUnwrap ? "Unwrap"
          : !route.length && fromAmt ? "No route" : "Swap"}
      </Button>
    </div>
  );
}