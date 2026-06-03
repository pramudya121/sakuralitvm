import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Activity as ActivityIcon, ArrowLeftRight, Tag, Sparkles, Send, Search, Filter } from "lucide-react";
import { Contract, formatEther } from "ethers";
import { CONTRACTS, MARKETPLACE_ABI, NFT_ABI, OFFER_ABI, CHAIN } from "@/lib/web3/contracts";
import { readProvider, shortAddr } from "@/lib/web3/ethers";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/activity")({
  component: ActivityPage,
  head: () => ({
    meta: [
      { title: "Activity — SakuraNFT" },
      { name: "description", content: "Live on-chain activity: mints, listings, sales, and offers on SakuraNFT." },
      { property: "og:title", content: "Activity — SakuraNFT" },
      { property: "og:description", content: "Real-time mints, listings, sales and offers across the SakuraNFT marketplace." },
    ],
  }),
});

type Kind = "all" | "Sale" | "Listing" | "Mint" | "Offer";

type Evt = {
  kind: Exclude<Kind, "all">;
  icon: any;
  color: string;
  ring: string;
  text: string;
  tokenId?: string;
  blockNumber: number;
  tx: string;
  addr?: string;
  value?: number;
};

function ActivityPage() {
  const [events, setEvents] = useState<Evt[]>([]);
  const [loading, setLoading] = useState(true);
  const [kind, setKind] = useState<Kind>("all");
  const [q, setQ] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const block = await readProvider.getBlockNumber();
        const from = Math.max(0, block - 50000);
        const mp = new Contract(CONTRACTS.marketplace, MARKETPLACE_ABI, readProvider);
        const nft = new Contract(CONTRACTS.nftCollection, NFT_ABI, readProvider);
        const off = new Contract(CONTRACTS.offer, OFFER_ABI, readProvider);
        const [sold, listed, minted, offered] = await Promise.all([
          mp.queryFilter(mp.filters.Sold(), from).catch(() => []),
          mp.queryFilter(mp.filters.Listed(), from).catch(() => []),
          nft.queryFilter(nft.filters.Minted(), from).catch(() => []),
          off.queryFilter(off.filters.OfferMade(), from).catch(() => []),
        ]);
        const all: Evt[] = [
          ...sold.map((e: any) => ({
            kind: "Sale" as const,
            icon: ArrowLeftRight,
            color: "text-emerald-500",
            ring: "ring-emerald-500/30 bg-emerald-500/10",
            text: `Sold #${e.args.tokenId} for ${formatEther(e.args.price)} ${CHAIN.symbol} → ${shortAddr(e.args.buyer)}`,
            tokenId: e.args.tokenId?.toString(),
            blockNumber: e.blockNumber,
            tx: e.transactionHash,
            addr: e.args.seller?.toLowerCase(),
            value: Number(formatEther(e.args.price)),
          })),
          ...listed.map((e: any) => ({
            kind: "Listing" as const,
            icon: Tag,
            color: "text-sky-500",
            ring: "ring-sky-500/30 bg-sky-500/10",
            text: `Listed #${e.args.tokenId} for ${formatEther(e.args.price)} ${CHAIN.symbol}`,
            tokenId: e.args.tokenId?.toString(),
            blockNumber: e.blockNumber,
            tx: e.transactionHash,
            addr: e.args.seller?.toLowerCase(),
            value: Number(formatEther(e.args.price)),
          })),
          ...minted.map((e: any) => ({
            kind: "Mint" as const,
            icon: Sparkles,
            color: "text-primary",
            ring: "ring-primary/30 bg-primary/10",
            text: `Minted #${e.args.tokenId} → ${shortAddr(e.args.to)}`,
            tokenId: e.args.tokenId?.toString(),
            blockNumber: e.blockNumber,
            tx: e.transactionHash,
            addr: e.args.to?.toLowerCase(),
          })),
          ...offered.map((e: any) => ({
            kind: "Offer" as const,
            icon: Send,
            color: "text-orange-500",
            ring: "ring-orange-500/30 bg-orange-500/10",
            text: `Offer ${formatEther(e.args.value)} ${CHAIN.symbol} on #${e.args.tokenId}`,
            tokenId: e.args.tokenId?.toString(),
            blockNumber: e.blockNumber,
            tx: e.transactionHash,
            addr: e.args.bidder?.toLowerCase(),
            value: Number(formatEther(e.args.value)),
          })),
        ].sort((a, b) => b.blockNumber - a.blockNumber);
        if (!cancelled) setEvents(all);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const stats = useMemo(() => {
    const sales = events.filter((e) => e.kind === "Sale");
    const volume = sales.reduce((s, e) => s + (e.value ?? 0), 0);
    return {
      total: events.length,
      sales: sales.length,
      listings: events.filter((e) => e.kind === "Listing").length,
      mints: events.filter((e) => e.kind === "Mint").length,
      offers: events.filter((e) => e.kind === "Offer").length,
      volume,
    };
  }, [events]);

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return events.filter((e) => {
      if (kind !== "all" && e.kind !== kind) return false;
      if (!ql) return true;
      return (
        e.text.toLowerCase().includes(ql) ||
        e.tx.toLowerCase().includes(ql) ||
        (e.addr ?? "").includes(ql) ||
        (e.tokenId ?? "").includes(ql)
      );
    });
  }, [events, kind, q]);

  const KINDS: { id: Kind; label: string }[] = [
    { id: "all", label: "All" },
    { id: "Sale", label: "Sales" },
    { id: "Listing", label: "Listings" },
    { id: "Mint", label: "Mints" },
    { id: "Offer", label: "Offers" },
  ];

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg">
          <ActivityIcon className="w-6 h-6 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-3xl md:text-4xl font-bold gradient-text">Marketplace Activity</h1>
          <p className="text-sm text-muted-foreground">Live mints, listings, sales, and offers across SakuraNFT.</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { l: "Total events", v: stats.total },
          { l: "Sales", v: stats.sales },
          { l: "Listings", v: stats.listings },
          { l: "Mints", v: stats.mints },
          { l: `Volume (${CHAIN.symbol})`, v: stats.volume.toFixed(3) },
        ].map((s) => (
          <div key={s.l} className="form-panel rounded-2xl p-4">
            <div className="text-xs text-muted-foreground">{s.l}</div>
            <div className="text-2xl font-bold mt-1">{s.v}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="form-panel rounded-2xl p-4 flex flex-col md:flex-row gap-3 md:items-center">
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="w-4 h-4 text-muted-foreground" />
          {KINDS.map((k) => (
            <Button
              key={k.id}
              size="sm"
              variant={kind === k.id ? "default" : "outline"}
              onClick={() => setKind(k.id)}
              className="rounded-full"
            >
              {k.label}
            </Button>
          ))}
        </div>
        <div className="relative md:ml-auto md:w-72">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search address, tx, #tokenId…"
            className="pl-9 bg-background"
          />
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="skeleton h-16 rounded-2xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="form-panel rounded-2xl p-10 text-center text-muted-foreground">
          No activity matches your filters yet.
        </div>
      ) : (
        <div className="form-panel rounded-2xl divide-y divide-border overflow-hidden">
          {filtered.map((e, i) => {
            const Icon = e.icon;
            return (
              <a
                key={i}
                href={`${CHAIN.explorer}/tx/${e.tx}`}
                target="_blank"
                rel="noreferrer"
                className="p-4 flex items-center gap-4 hover:bg-accent/30 transition group"
              >
                <div className={`w-11 h-11 rounded-2xl ring-1 ${e.ring} ${e.color} flex items-center justify-center shrink-0`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-semibold ${e.color}`}>{e.kind}</span>
                    {e.tokenId && (
                      <Link
                        to="/marketplace/$id"
                        params={{ id: e.tokenId }}
                        onClick={(ev) => ev.stopPropagation()}
                        className="text-[11px] px-1.5 py-0.5 rounded-full bg-accent/60 text-foreground hover:bg-accent"
                      >
                        View NFT
                      </Link>
                    )}
                    <span className="text-[11px] text-muted-foreground ml-auto">block {e.blockNumber}</span>
                  </div>
                  <p className="text-sm mt-0.5 truncate">{e.text}</p>
                </div>
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}
