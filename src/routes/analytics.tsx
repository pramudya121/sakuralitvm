import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { TrendingUp, Users, ShoppingBag, DollarSign, Repeat, Droplet, Sparkles, Activity as ActivityIcon } from "lucide-react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useAllListings, useAllNFTs } from "@/lib/web3/hooks";
import { CHAIN, CONTRACTS } from "@/lib/web3/contracts";
import { TOKENS } from "@/lib/tokens";
import { getPairInfo, formatEther } from "@/lib/web3/ethers";

export const Route = createFileRoute("/analytics")({
  component: Analytics,
  head: () => ({
    meta: [
      { title: "Analytics — SakuraNFT Marketplace & DEX" },
      { name: "description", content: "Real-time analytics for the SakuraNFT marketplace and Sakura DEX on LitVM: floor price, volume, liquidity pools, token pairs." },
    ],
  }),
});

const COLORS = ["#e879f9", "#f472b6", "#a78bfa", "#60a5fa", "#34d399", "#facc15", "#fb923c", "#f87171"];

type PoolStat = { pair: string; symA: string; symB: string; logoA: string; logoB: string; reserveA: string; reserveB: string; tvlEth: number };

function StatCard({ icon: Icon, label, value, sub }: { icon: any; label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl p-5 bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 hover:border-fuchsia-400/40 transition">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-white/60 uppercase tracking-wider">{label}</span>
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-fuchsia-500/20 to-pink-500/20 flex items-center justify-center"><Icon className="w-4 h-4 text-fuchsia-300" /></div>
      </div>
      <div className="text-2xl font-bold text-white">{value}</div>
      {sub && <div className="text-[11px] text-white/50 mt-1">{sub}</div>}
    </div>
  );
}

function Section({ title, children, right }: { title: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="rounded-3xl p-5 bg-white/[0.02] border border-white/10">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-white">{title}</h3>
        {right}
      </div>
      {children}
    </div>
  );
}

function Analytics() {
  const { nfts } = useAllNFTs();
  const { listings } = useAllListings();
  const [pools, setPools] = useState<PoolStat[]>([]);
  const [poolsLoading, setPoolsLoading] = useState(true);

  // ---- DEX pool stats: probe every token vs wzkLTC ----
  useEffect(() => {
    let alive = true;
    (async () => {
      setPoolsLoading(true);
      const wzk = TOKENS.find((t) => t.symbol === "wzkLTC")!;
      const candidates = TOKENS.filter((t) => t.address && t.address !== "native" && t.symbol !== "wzkLTC" && /^0x[0-9a-fA-F]{40}$/.test(t.address));
      const settled = await Promise.allSettled(candidates.map(async (t) => {
        const info = await getPairInfo(CONTRACTS.weth, t.address as string);
        if (!info.pair) return null;
        const r0 = Number(formatEther(info.reserve0));
        const r1 = Number(formatEther(info.reserve1));
        const wzkIsToken0 = info.token0.toLowerCase() === CONTRACTS.weth.toLowerCase();
        const wzkReserve = wzkIsToken0 ? r0 : r1;
        const otherReserve = wzkIsToken0 ? r1 : r0;
        return { pair: `${wzk.symbol}/${t.symbol}`, symA: wzk.symbol, symB: t.symbol, logoA: wzk.logo, logoB: t.logo, reserveA: wzkReserve.toFixed(4), reserveB: otherReserve.toFixed(4), tvlEth: wzkReserve * 2 } as PoolStat;
      }));
      const results = settled.flatMap((s) => s.status === "fulfilled" && s.value ? [s.value] : []);
      if (alive) { setPools(results.sort((a, b) => b.tvlEth - a.tvlEth)); setPoolsLoading(false); }
    })();
    return () => { alive = false; };
  }, []);

  // ---- Marketplace stats ----
  const mp = useMemo(() => {
    const total = listings.reduce((a, l) => a + +l.priceEth, 0);
    const avg = listings.length ? total / listings.length : 0;
    const floor = listings.length ? Math.min(...listings.map((l) => +l.priceEth)) : 0;
    const ceiling = listings.length ? Math.max(...listings.map((l) => +l.priceEth)) : 0;
    const uniqueOwners = new Set(nfts.map((n) => n.owner)).size;
    const listedRatio = nfts.length ? (listings.length / nfts.length) * 100 : 0;
    return { total, avg, floor, ceiling, count: nfts.length, owners: uniqueOwners, listed: listings.length, listedRatio };
  }, [nfts, listings]);

  const priceBuckets = useMemo(() => {
    const buckets = [0, 0.01, 0.05, 0.1, 0.5, 1, 5, 10, 100];
    return buckets.slice(0, -1).map((b, i) => ({
      range: `${b}-${buckets[i + 1]}`,
      count: listings.filter((l) => +l.priceEth >= b && +l.priceEth < buckets[i + 1]).length,
    }));
  }, [listings]);

  const mintsOverTime = useMemo(() => {
    // Approximate: bucket NFTs by tokenId chunks
    const sorted = [...nfts].sort((a, b) => Number(a.tokenId - b.tokenId));
    const buckets = 10;
    const size = Math.max(1, Math.ceil(sorted.length / buckets));
    const arr: { idx: string; mints: number }[] = [];
    for (let i = 0; i < sorted.length; i += size) {
      arr.push({ idx: `${i + 1}-${Math.min(i + size, sorted.length)}`, mints: sorted.slice(i, i + size).length });
    }
    return arr;
  }, [nfts]);

  const topHolders = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const n of nfts) counts[n.owner] = (counts[n.owner] ?? 0) + 1;
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([addr, c]) => ({ name: `${addr.slice(0, 6)}…${addr.slice(-4)}`, value: c }));
  }, [nfts]);

  const dexTvl = pools.reduce((s, p) => s + p.tvlEth, 0);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold gradient-text">Analytics</h1>
        <p className="text-muted-foreground mt-1">Live insights across the SakuraNFT marketplace and Sakura DEX.</p>
      </div>

      {/* ===== Marketplace ===== */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <ShoppingBag className="w-5 h-5 text-fuchsia-400" />
          <h2 className="text-xl font-bold text-white">NFT Marketplace</h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard icon={Sparkles} label="Total NFTs" value={mp.count.toString()} sub={`${mp.owners} unique owners`} />
          <StatCard icon={ShoppingBag} label="Active Listings" value={mp.listed.toString()} sub={`${mp.listedRatio.toFixed(1)}% listed`} />
          <StatCard icon={DollarSign} label="Floor Price" value={`${mp.floor.toFixed(4)} ${CHAIN.symbol}`} sub={`Ceiling ${mp.ceiling.toFixed(2)}`} />
          <StatCard icon={TrendingUp} label="Avg Listing" value={`${mp.avg.toFixed(4)} ${CHAIN.symbol}`} sub={`TVL ${mp.total.toFixed(2)} ${CHAIN.symbol}`} />
        </div>

        <div className="grid lg:grid-cols-2 gap-4">
          <Section title="Listing Price Distribution">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={priceBuckets}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="range" stroke="rgba(255,255,255,0.5)" fontSize={10} />
                <YAxis stroke="rgba(255,255,255,0.5)" fontSize={10} allowDecimals={false} />
                <Tooltip contentStyle={{ background: "#160c26", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12 }} />
                <Bar dataKey="count" fill="#e879f9" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Section>

          <Section title="Mint Velocity (tokenId buckets)">
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={mintsOverTime}>
                <defs>
                  <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f472b6" stopOpacity={0.7} />
                    <stop offset="100%" stopColor="#f472b6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="idx" stroke="rgba(255,255,255,0.5)" fontSize={10} />
                <YAxis stroke="rgba(255,255,255,0.5)" fontSize={10} allowDecimals={false} />
                <Tooltip contentStyle={{ background: "#160c26", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12 }} />
                <Area type="monotone" dataKey="mints" stroke="#f472b6" fill="url(#g1)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </Section>

          <Section title="Top Holders">
            {topHolders.length === 0 ? <p className="text-xs text-white/50">No data yet.</p> : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={topHolders} dataKey="value" nameKey="name" innerRadius={45} outerRadius={80} paddingAngle={3}>
                    {topHolders.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: "#160c26", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </Section>

          <Section title="Marketplace Summary">
            <ul className="text-sm space-y-2 text-white/80">
              <li className="flex justify-between"><span className="text-white/60">Total Value Listed</span><span className="font-semibold">{mp.total.toFixed(4)} {CHAIN.symbol}</span></li>
              <li className="flex justify-between"><span className="text-white/60">Listed Ratio</span><span className="font-semibold">{mp.listedRatio.toFixed(2)}%</span></li>
              <li className="flex justify-between"><span className="text-white/60">Concentration (top owner)</span><span className="font-semibold">{topHolders[0] ? `${((topHolders[0].value / mp.count) * 100).toFixed(1)}%` : "—"}</span></li>
              <li className="flex justify-between"><span className="text-white/60">Floor → Ceiling spread</span><span className="font-semibold">{(mp.ceiling - mp.floor).toFixed(4)} {CHAIN.symbol}</span></li>
            </ul>
          </Section>
        </div>
      </section>

      {/* ===== DEX ===== */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Repeat className="w-5 h-5 text-pink-400" />
          <h2 className="text-xl font-bold text-white">Sakura DEX</h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard icon={Droplet} label="Active Pools" value={pools.length.toString()} sub={poolsLoading ? "Scanning…" : `vs wzkLTC`} />
          <StatCard icon={DollarSign} label="Total TVL" value={`${dexTvl.toFixed(2)} ${CHAIN.symbol}`} sub="Sum of pool liquidity ×2" />
          <StatCard icon={Sparkles} label="Tokens Listed" value={TOKENS.length.toString()} sub="Including native zkLTC" />
          <StatCard icon={ActivityIcon} label="Top Pair" value={pools[0]?.pair ?? "—"} sub={pools[0] ? `${pools[0].tvlEth.toFixed(2)} ${CHAIN.symbol} TVL` : "No pools"} />
        </div>

        <Section title="Liquidity per Pool" right={<span className="text-[10px] text-white/40">{poolsLoading ? "Loading…" : `${pools.length} pools`}</span>}>
          {pools.length === 0 ? (
            <p className="text-xs text-white/50 py-4 text-center">{poolsLoading ? "Probing pools on-chain…" : "No active pools yet."}</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={pools} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis type="number" stroke="rgba(255,255,255,0.5)" fontSize={10} />
                <YAxis type="category" dataKey="pair" stroke="rgba(255,255,255,0.5)" fontSize={11} width={100} />
                <Tooltip contentStyle={{ background: "#160c26", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12 }}
                  formatter={(v: any) => [`${Number(v).toFixed(4)} ${CHAIN.symbol}`, "TVL"]} />
                <Bar dataKey="tvlEth" fill="#f472b6" radius={[0, 8, 8, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Section>

        <Section title="Pool Reserves">
          {pools.length === 0 ? (
            <p className="text-xs text-white/50 py-4 text-center">{poolsLoading ? "Loading…" : "No pools to display."}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-white/50 uppercase">
                  <tr className="border-b border-white/10">
                    <th className="text-left py-2 px-2">Pair</th>
                    <th className="text-right py-2 px-2">wzkLTC</th>
                    <th className="text-right py-2 px-2">Token</th>
                    <th className="text-right py-2 px-2">TVL ({CHAIN.symbol})</th>
                  </tr>
                </thead>
                <tbody>
                  {pools.map((p) => (
                    <tr key={p.pair} className="border-b border-white/5 hover:bg-white/[0.02]">
                      <td className="py-2 px-2">
                        <div className="flex items-center gap-2">
                          <div className="flex -space-x-2">
                            <img src={p.logoA} alt={p.symA} className="w-6 h-6 rounded-full ring-2 ring-[#160c26] bg-muted" onError={(e) => (e.currentTarget.style.display = "none")} />
                            <img src={p.logoB} alt={p.symB} className="w-6 h-6 rounded-full ring-2 ring-[#160c26] bg-muted" onError={(e) => (e.currentTarget.style.display = "none")} />
                          </div>
                          <span className="font-semibold">{p.pair}</span>
                        </div>
                      </td>
                      <td className="py-2 px-2 text-right text-white/80 font-mono">{p.reserveA}</td>
                      <td className="py-2 px-2 text-right text-white/80 font-mono">
                        <span className="inline-flex items-center gap-1.5">
                          <img src={p.logoB} alt="" className="w-4 h-4 rounded-full" onError={(e) => (e.currentTarget.style.display = "none")} />
                          {p.reserveB} <span className="text-white/40 text-xs">{p.symB}</span>
                        </span>
                      </td>
                      <td className="py-2 px-2 text-right font-semibold text-fuchsia-300">{p.tvlEth.toFixed(4)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>

        {/* Token cards with logos */}
        <Section title="Tracked Tokens">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {TOKENS.filter((t) => t.address && /^0x[0-9a-fA-F]{40}$/.test(t.address as string) || t.address === "native").map((t) => {
              const pool = pools.find((p) => p.symB === t.symbol);
              return (
                <div key={t.symbol} className="rounded-2xl p-3 bg-white/[0.03] border border-white/10 flex items-center gap-3">
                  <img src={t.logo} alt={t.symbol} className="w-10 h-10 rounded-full bg-muted" onError={(e) => (e.currentTarget.style.display = "none")} />
                  <div className="min-w-0">
                    <div className="font-semibold text-white text-sm truncate">{t.symbol}</div>
                    <div className="text-[10px] text-white/50 truncate">{pool ? `TVL ${pool.tvlEth.toFixed(2)} ${CHAIN.symbol}` : "No pool"}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </Section>
      </section>
    </div>
  );
}
