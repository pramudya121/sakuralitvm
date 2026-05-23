import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Minus, Settings, RefreshCw, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatEther, parseEther } from "ethers";
import { useWallet } from "@/contexts/WalletContext";
import { CHAIN, CONTRACTS } from "@/lib/web3/contracts";
import {
  addLiquidityETH, removeLiquidityETH, getPairInfo,
  getNativeBalance, getTokenBalance, uniQuote,
} from "@/lib/web3/ethers";
import { TOKENS, type TokenInfo } from "@/lib/tokens";
import { TokenSelectButton } from "@/components/TokenSelectModal";
import { toast } from "sonner";
import { subscribeWeb3Sync } from "@/lib/web3/sync";

export const Route = createFileRoute("/dex/liquidity")({
  component: LiquidityPage,
  head: () => ({ meta: [{ title: "Liquidity — Sakura DEX" }] }),
});

const NATIVE: TokenInfo = TOKENS[0];
const ZERO = "0x0000000000000000000000000000000000000000";

function LiquidityPage() {
  const [mode, setMode] = useState<"add" | "remove">("add");
  const [slippage, setSlippage] = useState(0.5);

  return (
    <div className="dex-panel rounded-3xl p-5 max-w-md mx-auto">
      <div className="flex items-center gap-2 mb-4">
        <button onClick={() => setMode("add")}
          className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition flex items-center justify-center gap-2 ${mode === "add" ? "bg-gradient-to-r from-fuchsia-500 to-pink-500 text-white shadow-lg" : "bg-white/5 text-white/60"}`}>
          <Plus className="w-4 h-4" /> Add Liquidity
        </button>
        <button onClick={() => setMode("remove")}
          className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition flex items-center justify-center gap-2 ${mode === "remove" ? "bg-gradient-to-r from-fuchsia-500 to-pink-500 text-white shadow-lg" : "bg-white/5 text-white/60"}`}>
          <Minus className="w-4 h-4" /> Remove Liquidity
        </button>
        <Popover>
          <PopoverTrigger asChild>
            <button className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center hover:bg-white/10">
              <Settings className="w-4 h-4" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-64 glass">
            <p className="text-sm font-medium mb-2">Slippage tolerance</p>
            <div className="flex gap-2 mb-2">
              {[0.1, 0.5, 1, 3].map((v) => (
                <button key={v} onClick={() => setSlippage(v)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border ${slippage === v ? "border-primary bg-primary/10 text-primary" : ""}`}>
                  {v}%
                </button>
              ))}
            </div>
            <Input type="number" step="0.1" value={slippage}
              onChange={(e) => setSlippage(Math.max(0.05, Math.min(50, +e.target.value || 0.5)))} />
          </PopoverContent>
        </Popover>
      </div>
      {mode === "add" ? <AddLiq slippage={slippage} /> : <RemoveLiq slippage={slippage} />}
    </div>
  );
}

function NativeTokenBadge({ value }: { value: TokenInfo }) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#1a1230] border border-white/10 shrink-0">
      <img src={value.logo} alt="" className="w-5 h-5 rounded-full" onError={(e) => (e.currentTarget.style.display = "none")} />
      <span className="font-semibold text-sm">{value.symbol}</span>
    </div>
  );
}

function AddLiq({ slippage }: { slippage: number }) {
  const { signer, address, refreshWallet } = useWallet();
  const [tokenA] = useState<TokenInfo>(NATIVE); // native zkLTC
  const [tokenB, setTokenB] = useState<TokenInfo>(TOKENS[1]); // WETH default
  const [amtA, setAmtA] = useState("");
  const [amtB, setAmtB] = useState("");
  const [balA, setBalA] = useState("0");
  const [balB, setBalB] = useState("0");
  const [pool, setPool] = useState<Awaited<ReturnType<typeof getPairInfo>> | null>(null);
  const [busy, setBusy] = useState(false);
  const [tick, setTick] = useState(0);

  const bTokenAddr = tokenB.address === "native" ? CONTRACTS.weth : tokenB.address;

  // load balances + pool
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (address) {
          const nat = await getNativeBalance(address);
          if (alive) setBalA(formatEther(nat));
          if (bTokenAddr && bTokenAddr !== ZERO) {
            try {
              const b = await getTokenBalance(bTokenAddr, address);
              if (alive) setBalB(formatEther(b));
            } catch { if (alive) setBalB("0"); }
          }
        }
        if (bTokenAddr && bTokenAddr !== ZERO) {
          const info = await getPairInfo(CONTRACTS.weth, bTokenAddr, address ?? undefined);
          if (alive) setPool(info);
        }
      } catch {/* ignore */}
    })();
    return () => { alive = false; };
  }, [address, bTokenAddr, tick]);

  useEffect(() => subscribeWeb3Sync(() => setTick((v) => v + 1)), []);

  // AMM auto-quote: if pool has reserves, derive amtB from amtA
  const reserves = useMemo(() => {
    if (!pool || !pool.pair) return null;
    const wethIs0 = pool.token0.toLowerCase() === CONTRACTS.weth.toLowerCase();
    return {
      reserveWeth: wethIs0 ? pool.reserve0 : pool.reserve1,
      reserveB: wethIs0 ? pool.reserve1 : pool.reserve0,
    };
  }, [pool]);

  useEffect(() => {
    if (!amtA || isNaN(+amtA) || +amtA <= 0 || !reserves || reserves.reserveWeth === 0n) return;
    try {
      const quoted = uniQuote(parseEther(amtA), reserves.reserveWeth, reserves.reserveB);
      setAmtB(formatEther(quoted));
    } catch {/* ignore */}
  }, [amtA, reserves]);

  const poolActive = !!pool?.pair && pool.pair !== ZERO && (pool.reserve0 > 0n || pool.reserve1 > 0n);
  const ratio = reserves && reserves.reserveWeth > 0n
    ? Number(formatEther(reserves.reserveB)) / Number(formatEther(reserves.reserveWeth))
    : 0;

  async function handleAdd() {
    if (!signer) return toast.error("Connect wallet");
    if (!amtA || !amtB) return toast.error("Enter amounts");
    setBusy(true);
    try {
      toast.loading("Approving & adding liquidity...", { id: "add" });
      await addLiquidityETH(signer, bTokenAddr, parseEther(amtB), amtA, slippage);
      toast.success("Liquidity added!", { id: "add" });
      await refreshWallet();
      setAmtA(""); setAmtB(""); setTick((t) => t + 1);
    } catch (e: any) {
      toast.error(e?.shortMessage ?? e?.message ?? "Failed", { id: "add" });
    } finally { setBusy(false); }
  }

  return (
    <div className="space-y-3">
      {/* TOKEN A */}
      <div className="rounded-2xl p-4 bg-[#160c26] border border-white/10">
        <div className="flex justify-between text-xs mb-2">
          <span className="text-white/60 tracking-wider">TOKEN A</span>
          <button onClick={() => setAmtA(balA)} className="text-fuchsia-300 hover:underline">
            Balance: {(+balA).toFixed(4)} <span className="font-bold ml-1">MAX</span>
          </button>
        </div>
        <div className="flex items-center gap-2">
          <Input type="number" placeholder="0.0" value={amtA}
            onChange={(e) => setAmtA(e.target.value)}
            className="text-3xl font-bold bg-transparent border-0 px-0 focus-visible:ring-0 h-12 text-white" />
          <NativeTokenBadge value={tokenA} />
        </div>
      </div>

      <div className="flex justify-center -my-1">
        <div className="w-8 h-8 rounded-full bg-fuchsia-500/20 border border-fuchsia-400/40 flex items-center justify-center text-fuchsia-300">
          <Plus className="w-4 h-4" />
        </div>
      </div>

      {/* TOKEN B */}
      <div className="rounded-2xl p-4 bg-[#160c26] border border-white/10">
        <div className="flex justify-between text-xs mb-2">
          <div className="flex items-center gap-2">
            <span className="text-white/60 tracking-wider">TOKEN B</span>
            {poolActive && <span className="text-green-500 text-[10px]">● auto</span>}
          </div>
          <button onClick={() => setAmtB(balB)} className="text-fuchsia-300 hover:underline">
            Balance: {(+balB).toFixed(4)} <span className="font-bold ml-1">MAX</span>
          </button>
        </div>
        <div className="flex items-center gap-2">
          <Input type="number" placeholder="0.0" value={amtB}
            onChange={(e) => setAmtB(e.target.value)} readOnly={poolActive}
            className="text-3xl font-bold bg-transparent border-0 px-0 focus-visible:ring-0 h-12 text-white" />
          <TokenSelectButton value={tokenB} onChange={setTokenB} />
        </div>
      </div>

      {poolActive && ratio > 0 && (
        <div className="text-xs space-y-1 px-2 py-2 text-muted-foreground">
          <div className="flex justify-between"><span>Pool Ratio</span>
            <span>1 {tokenA.symbol} = {ratio.toLocaleString(undefined, { maximumFractionDigits: 6 })} {tokenB.symbol}</span></div>
          <div className="flex justify-between"><span>Inverse</span>
            <span>1 {tokenB.symbol} ≈ {(1 / ratio).toLocaleString(undefined, { maximumFractionDigits: 6 })} {tokenA.symbol}</span></div>
        </div>
      )}

      {/* Pool Info */}
      <div className="rounded-2xl p-4 bg-[#160c26]/60 border border-white/10 border-dashed">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold tracking-wider text-muted-foreground">POOL INFORMATION</p>
          <span className={`text-xs flex items-center gap-1 ${poolActive ? "text-green-500" : "text-muted-foreground"}`}>
            ● {poolActive ? "Active Pool" : "No Pool"}
          </span>
        </div>
        {poolActive && reserves ? (
          <div className="space-y-2 text-xs">
            <div className="flex justify-between items-center">
              <span className="flex items-center gap-2"><img src={tokenA.logo} className="w-4 h-4 rounded-full" /> {tokenA.symbol}</span>
              <span className="font-mono">{(+formatEther(reserves.reserveWeth)).toLocaleString(undefined, { maximumFractionDigits: 4 })}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="flex items-center gap-2"><img src={tokenB.logo} className="w-4 h-4 rounded-full" /> {tokenB.symbol}</span>
              <span className="font-mono">{(+formatEther(reserves.reserveB)).toLocaleString(undefined, { maximumFractionDigits: 4 })}</span>
            </div>
            <div className="flex justify-between"><span>Your LP</span>
              <span className="font-mono text-primary">{(+formatEther(pool!.lpBalance)).toFixed(6)}</span></div>
            <div className="flex justify-between"><span>Total Supply</span>
              <span className="font-mono">{(+formatEther(pool!.totalSupply)).toFixed(4)}</span></div>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">First liquidity provider sets the price. Enter both amounts manually.</p>
        )}
      </div>

      <Button size="lg" disabled={busy || !signer || !amtA || !amtB} onClick={handleAdd}
        className="w-full h-12 rounded-2xl bg-gradient-to-r from-fuchsia-500 to-pink-500 hover:from-fuchsia-400 hover:to-pink-400 text-white font-semibold text-base shadow-lg border-0">
        {busy ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Processing...</>
          : !signer ? "Connect Wallet" : "Add Liquidity"}
      </Button>

      <button onClick={() => setTick((t) => t + 1)}
        className="w-full text-xs text-primary hover:underline flex items-center justify-center gap-1">
        <RefreshCw className="w-3 h-3" /> Refresh
      </button>
      <p className="text-[10px] text-center text-muted-foreground">Slippage: {slippage}% · {CHAIN.name}</p>
    </div>
  );
}

function RemoveLiq({ slippage }: { slippage: number }) {
  const { signer, address, refreshWallet } = useWallet();
  const [tokenB, setTokenB] = useState<TokenInfo>(TOKENS[1]);
  const [pct, setPct] = useState(0);
  const [pool, setPool] = useState<Awaited<ReturnType<typeof getPairInfo>> | null>(null);
  const [busy, setBusy] = useState(false);
  const [tick, setTick] = useState(0);

  const bAddr = tokenB.address === "native" ? CONTRACTS.weth : tokenB.address;

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!bAddr || bAddr === ZERO) return;
      const info = await getPairInfo(CONTRACTS.weth, bAddr, address ?? undefined);
      if (alive) setPool(info);
    })();
    return () => { alive = false; };
  }, [address, bAddr, tick]);

  useEffect(() => subscribeWeb3Sync(() => setTick((v) => v + 1)), []);

  const lpBal = pool?.lpBalance ?? 0n;
  const lpBalEth = Number(formatEther(lpBal));
  const removeAmt = (lpBalEth * pct) / 100;

  // estimate underlying
  const reserves = useMemo(() => {
    if (!pool || !pool.pair || pool.totalSupply === 0n) return null;
    const wethIs0 = pool.token0.toLowerCase() === CONTRACTS.weth.toLowerCase();
    const shareEth = (BigInt(Math.floor(removeAmt * 1e9)) * (wethIs0 ? pool.reserve0 : pool.reserve1)) / (pool.totalSupply / 1_000_000_000n || 1n);
    const shareB = (BigInt(Math.floor(removeAmt * 1e9)) * (wethIs0 ? pool.reserve1 : pool.reserve0)) / (pool.totalSupply / 1_000_000_000n || 1n);
    return { eth: Number(formatEther(shareEth)), tok: Number(formatEther(shareB)) };
  }, [pool, removeAmt]);

  async function handleRemove() {
    if (!signer) return toast.error("Connect wallet");
    if (!pool?.pair || pool.pair === ZERO) return toast.error("No pool");
    if (pct <= 0) return toast.error("Pick percentage");
    setBusy(true);
    try {
      toast.loading("Approving & removing liquidity...", { id: "rm" });
      const lAmt = parseEther(removeAmt.toString());
      await removeLiquidityETH(signer, bAddr, lAmt, pool.pair);
      toast.success("Liquidity removed!", { id: "rm" });
      await refreshWallet();
      setPct(0); setTick((t) => t + 1);
    } catch (e: any) {
      toast.error(e?.shortMessage ?? e?.message ?? "Failed", { id: "rm" });
    } finally { setBusy(false); }
  }

  const poolActive = !!pool?.pair && pool.pair !== ZERO;

  return (
    <div className="space-y-3">
      <div className="rounded-2xl p-4 bg-background/50 border">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs text-muted-foreground tracking-wider">PAIR</p>
          <span className={`text-xs ${poolActive ? "text-green-500" : "text-muted-foreground"}`}>● {poolActive ? "Active" : "No Pool"}</span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src={TOKENS[0].logo} className="w-6 h-6 rounded-full" />
            <span className="font-semibold">zkLTC</span>
            <span className="text-muted-foreground">/</span>
            <img src={tokenB.logo} className="w-6 h-6 rounded-full" />
            <span className="font-semibold">{tokenB.symbol}</span>
          </div>
          <TokenSelectButton value={tokenB} onChange={setTokenB} />
        </div>
      </div>

      <div className="rounded-2xl p-4 bg-[#160c26] border border-white/10">
        <div className="flex items-baseline justify-between mb-3">
          <span className="text-xs text-white/60 tracking-wider">REMOVE</span>
          <span className="text-3xl font-bold gradient-text">{pct}%</span>
        </div>
        <input type="range" min={0} max={100} step={1} value={pct}
          onChange={(e) => setPct(+e.target.value)}
          className="w-full accent-primary" />
        <div className="grid grid-cols-4 gap-2 mt-3">
          {[25, 50, 75, 100].map((p) => (
            <button key={p} onClick={() => setPct(p)}
              className={`py-1.5 rounded-lg text-xs font-semibold border ${pct === p ? "border-primary bg-primary/10 text-primary" : ""}`}>
              {p}%
            </button>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground mt-2 text-center">
          LP Balance: <span className="font-mono">{lpBalEth.toFixed(6)}</span>
        </p>
      </div>

      <div className="rounded-2xl p-4 bg-[#160c26]/60 border border-white/10 border-dashed space-y-2 text-sm">
        <p className="text-xs font-semibold tracking-wider text-muted-foreground mb-2">YOU WILL RECEIVE</p>
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2"><img src={TOKENS[0].logo} className="w-4 h-4 rounded-full" /> zkLTC</span>
          <span className="font-mono">{reserves ? reserves.eth.toFixed(6) : "0.00"}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2"><img src={tokenB.logo} className="w-4 h-4 rounded-full" /> {tokenB.symbol}</span>
          <span className="font-mono">{reserves ? reserves.tok.toFixed(6) : "0.00"}</span>
        </div>
      </div>

      <Button size="lg" disabled={busy || !signer || pct === 0 || !poolActive} onClick={handleRemove}
        className="w-full h-12 rounded-2xl bg-gradient-to-r from-fuchsia-500 to-pink-500 hover:from-fuchsia-400 hover:to-pink-400 text-white font-semibold text-base shadow-lg border-0">
        {busy ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Processing...</>
          : !signer ? "Connect Wallet" : "Remove Liquidity"}
      </Button>
      <button onClick={() => setTick((t) => t + 1)}
        className="w-full text-xs text-primary hover:underline flex items-center justify-center gap-1">
        <RefreshCw className="w-3 h-3" /> Refresh
      </button>
      <p className="text-[10px] text-center text-muted-foreground">Slippage: {slippage}% · {CHAIN.name}</p>
    </div>
  );
}