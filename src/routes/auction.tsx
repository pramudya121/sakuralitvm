import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { formatEther } from "ethers";
import { Gavel, Tag, ShoppingCart, X, Check, Wallet, RefreshCw, Search, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useWallet } from "@/contexts/WalletContext";
import { useAllNFTs } from "@/lib/web3/hooks";
import { CHAIN, CONTRACTS } from "@/lib/web3/contracts";
import {
  asaList, asaDelist, asaBuyNow,
  asaPlaceBid, asaCancelBid, asaAcceptBid, asaWithdraw, asaPendingWithdraw,
  asaFeeBps, asaGetMarketBatch, shortAddr,
} from "@/lib/web3/ethers";
import { subscribeWeb3Sync } from "@/lib/web3/sync";
import { toast } from "sonner";

export const Route = createFileRoute("/auction")({
  component: AuctionPage,
  head: () => ({
    meta: [
      { title: "Autonomous Trading — SakuraNFT" },
      { name: "description", content: "Decentralized NFT auctions & instant buy-now powered by the Autonomous Settlement Agent on LitVM." },
      { property: "og:title", content: "Autonomous Trading — SakuraNFT" },
      { property: "og:description", content: "Place bids, buy now, and let the on-chain settlement agent handle escrow." },
    ],
  }),
});

type MarketInfo = { listing: { seller: string; price: bigint; active: boolean }; bid: { bidder: string; bidPrice: bigint; active: boolean } };
type Row = { tokenId: bigint; name: string; image: string; owner: string } & MarketInfo;

const EMPTY_INFO: MarketInfo = {
  listing: { seller: "0x0000000000000000000000000000000000000000", price: 0n, active: false },
  bid: { bidder: "0x0000000000000000000000000000000000000000", bidPrice: 0n, active: false },
};

function Skeleton() {
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="glass rounded-2xl overflow-hidden animate-pulse">
          <div className="aspect-square bg-muted/40" />
          <div className="p-4 space-y-3">
            <div className="h-3 w-1/4 bg-muted/50 rounded" />
            <div className="h-4 w-3/4 bg-muted/50 rounded" />
            <div className="h-8 w-full bg-muted/30 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

function AuctionPage() {
  const { signer, address } = useWallet();
  const { nfts } = useAllNFTs();
  const [market, setMarket] = useState<Record<string, MarketInfo>>({});
  const [marketLoading, setMarketLoading] = useState(false);
  const [tick, setTick] = useState(0);
  const [feeBps, setFeeBps] = useState(0);
  const [pending, setPending] = useState<bigint>(0n);
  const [listInputs, setListInputs] = useState<Record<string, string>>({});
  const [bidInputs, setBidInputs] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<"all" | "listed" | "bids" | "mine">("all");
  const [search, setSearch] = useState("");
  const topRef = useRef<HTMLDivElement>(null);

  // Scroll-to-top on enter
  useEffect(() => { window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior }); }, []);

  useEffect(() => { asaFeeBps().then(setFeeBps).catch(() => {}); }, []);
  useEffect(() => subscribeWeb3Sync(() => setTick((t) => t + 1)), []);
  useEffect(() => {
    if (!address) { setPending(0n); return; }
    asaPendingWithdraw(address).then(setPending).catch(() => {});
  }, [address, tick]);

  // Batched fetch — keeps previous data visible while refreshing
  useEffect(() => {
    if (!nfts.length) return;
    let cancelled = false;
    setMarketLoading(true);
    asaGetMarketBatch(nfts.map((n) => n.tokenId))
      .then((m) => { if (!cancelled) setMarket(m); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setMarketLoading(false); });
    return () => { cancelled = true; };
  }, [nfts, tick]);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  async function wrap<T>(id: string, label: string, fn: () => Promise<T>) {
    if (!signer) return toast.error("Connect wallet dulu");
    try {
      toast.loading("Konfirmasi di wallet...", { id });
      await fn();
      toast.success(label, { id });
      refresh();
    } catch (e: any) {
      const msg = e?.shortMessage ?? e?.reason ?? e?.message ?? "Gagal";
      toast.error(String(msg).replace(/^execution reverted:?\s*/i, "").slice(0, 200), { id });
    }
  }

  const rows: Row[] = useMemo(
    () => nfts.map((n) => ({ tokenId: n.tokenId, name: n.name, image: n.image, owner: n.owner, ...(market[n.tokenId.toString()] ?? EMPTY_INFO) })),
    [nfts, market],
  );

  const stats = useMemo(() => {
    const listed = rows.filter((r) => r.listing.active);
    const bids = rows.filter((r) => r.bid.active);
    const tvl = listed.reduce((acc, r) => acc + r.listing.price, 0n) + bids.reduce((acc, r) => acc + r.bid.bidPrice, 0n);
    return { listed: listed.length, bids: bids.length, tvl };
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (q && !r.name.toLowerCase().includes(q) && !r.tokenId.toString().includes(q)) return false;
      if (filter === "listed") return r.listing.active;
      if (filter === "bids") return r.bid.active;
      if (filter === "mine") return address && (
        r.owner.toLowerCase() === address.toLowerCase() ||
        r.listing.seller.toLowerCase() === address.toLowerCase() ||
        r.bid.bidder.toLowerCase() === address.toLowerCase()
      );
      return r.listing.active || r.bid.active;
    });
  }, [rows, filter, search, address]);

  const showSkeleton = marketLoading && Object.keys(market).length === 0;

  return (
    <div ref={topRef} className="space-y-6">
      {/* Hero */}
      <div className="glass rounded-3xl p-6 flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-3xl font-bold gradient-text flex items-center gap-2">
            <Gavel className="w-7 h-7" /> Autonomous Trading
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            On-chain escrow · auto-settlement · fee {(feeBps / 100).toFixed(2)}% ·{" "}
            <a href={`${CHAIN.explorer}/address/${CONTRACTS.autonomous}`} target="_blank" rel="noreferrer" className="text-primary hover:underline font-mono">
              {shortAddr(CONTRACTS.autonomous)}
            </a>
          </p>
        </div>
        <div className="flex items-center gap-2">
          {address && pending > 0n && (
            <Button onClick={() => wrap("w", `Withdrew ${formatEther(pending)} ${CHAIN.symbol}`, () => asaWithdraw(signer))}>
              <Wallet className="w-4 h-4 mr-2" /> Withdraw {formatEther(pending)} {CHAIN.symbol}
            </Button>
          )}
          <Button variant="outline" size="icon" onClick={refresh} title="Refresh"><RefreshCw className="w-4 h-4" /></Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="glass rounded-2xl p-4">
          <p className="text-xs text-muted-foreground">Listed</p>
          <p className="text-2xl font-bold mt-1">{stats.listed}</p>
        </div>
        <div className="glass rounded-2xl p-4">
          <p className="text-xs text-muted-foreground">Active Bids</p>
          <p className="text-2xl font-bold mt-1">{stats.bids}</p>
        </div>
        <div className="glass rounded-2xl p-4">
          <p className="text-xs text-muted-foreground flex items-center gap-1"><TrendingUp className="w-3 h-3" /> Volume Locked</p>
          <p className="text-2xl font-bold mt-1 truncate">{(+formatEther(stats.tvl)).toFixed(3)} <span className="text-sm font-normal text-muted-foreground">{CHAIN.symbol}</span></p>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1.5 flex-wrap">
          {(["all", "listed", "bids", "mine"] as const).map((f) => (
            <Button key={f} size="sm" variant={filter === f ? "default" : "outline"} onClick={() => setFilter(f)} className="capitalize">
              {f}
            </Button>
          ))}
        </div>
        <div className="relative ml-auto w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Cari nama atau #id" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
      </div>

      {showSkeleton ? (
        <Skeleton />
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 glass rounded-2xl text-muted-foreground">
          {filter === "mine" ? "Kamu belum punya aktivitas auction." : "Belum ada item. List salah satu NFT kamu untuk memulai."}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((r) => {
            const key = r.tokenId.toString();
            const isOwner = address && r.owner.toLowerCase() === address.toLowerCase();
            const isSeller = address && r.listing.seller.toLowerCase() === address.toLowerCase();
            const isBidder = address && r.bid.bidder.toLowerCase() === address.toLowerCase();
            const canList = isOwner && !r.listing.active;
            return (
              <div key={key} className="glass rounded-2xl overflow-hidden flex flex-col hover:scale-[1.01] transition-transform">
                <Link to="/marketplace/$id" params={{ id: key }} className="block aspect-square bg-muted relative overflow-hidden group">
                  {r.image
                    ? <img src={r.image} alt={r.name} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    : <div className="w-full h-full flex items-center justify-center text-6xl">🌸</div>}
                  {r.listing.active && (
                    <span className="absolute top-2 left-2 text-xs px-2 py-0.5 rounded-full bg-primary text-primary-foreground font-medium">Listed</span>
                  )}
                  {r.bid.active && (
                    <span className="absolute top-2 right-2 text-xs px-2 py-0.5 rounded-full bg-accent text-accent-foreground font-medium">Bid</span>
                  )}
                </Link>
                <div className="p-4 space-y-3 flex-1 flex flex-col">
                  <div>
                    <p className="text-xs text-muted-foreground">#{key}</p>
                    <h3 className="font-semibold truncate">{r.name}</h3>
                  </div>

                  <div className="space-y-1 text-sm">
                    {r.listing.active && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Buy Now</span>
                        <span className="font-bold text-primary">{formatEther(r.listing.price)} {CHAIN.symbol}</span>
                      </div>
                    )}
                    {r.bid.active && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Top Bid</span>
                        <span className="font-bold">{formatEther(r.bid.bidPrice)} {CHAIN.symbol}</span>
                      </div>
                    )}
                    {!r.listing.active && !r.bid.active && (
                      <div className="text-xs text-muted-foreground">Belum di-list</div>
                    )}
                  </div>

                  <div className="mt-auto space-y-2">
                    {canList && (
                      <div className="flex gap-2">
                        <Input type="number" step="0.001" placeholder={`Harga ${CHAIN.symbol}`} value={listInputs[key] ?? ""} onChange={(e) => setListInputs((p) => ({ ...p, [key]: e.target.value }))} />
                        <Button size="sm" onClick={() => wrap(`l-${key}`, "Listed!", () => asaList(signer, r.tokenId, listInputs[key] || "0"))} disabled={!listInputs[key]}>
                          <Tag className="w-3 h-3 mr-1" /> List
                        </Button>
                      </div>
                    )}

                    {isSeller && r.listing.active && (
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" className="flex-1" onClick={() => wrap(`d-${key}`, "Delisted", () => asaDelist(signer, r.tokenId))}>
                          <X className="w-3 h-3 mr-1" /> Delist
                        </Button>
                        {r.bid.active && (
                          <Button size="sm" className="flex-1" onClick={() => wrap(`a-${key}`, "Bid accepted!", () => asaAcceptBid(signer, r.tokenId))}>
                            <Check className="w-3 h-3 mr-1" /> Accept
                          </Button>
                        )}
                      </div>
                    )}

                    {r.listing.active && !isSeller && (
                      <Button size="sm" className="w-full" onClick={() => wrap(`b-${key}`, "Bought!", () => asaBuyNow(signer, r.tokenId, r.listing.price))}>
                        <ShoppingCart className="w-3 h-3 mr-1" /> Buy {formatEther(r.listing.price)} {CHAIN.symbol}
                      </Button>
                    )}

                    {/* Bid only when listing is active */}
                    {r.listing.active && !isOwner && !isSeller && (
                      <div className="flex gap-2">
                        <Input
                          type="number" step="0.001"
                          placeholder={`Min ${formatEther(r.bid.active ? r.bid.bidPrice : 0n)} ${CHAIN.symbol}`}
                          value={bidInputs[key] ?? ""}
                          onChange={(e) => setBidInputs((p) => ({ ...p, [key]: e.target.value }))}
                        />
                        <Button size="sm" variant="secondary" onClick={() => wrap(`pb-${key}`, "Bid placed!", () => asaPlaceBid(signer, r.tokenId, bidInputs[key] || "0"))} disabled={!bidInputs[key]}>
                          <Gavel className="w-3 h-3 mr-1" /> Bid
                        </Button>
                      </div>
                    )}
                    {isBidder && r.bid.active && (
                      <Button size="sm" variant="outline" className="w-full" onClick={() => wrap(`cb-${key}`, "Bid cancelled", () => asaCancelBid(signer, r.tokenId))}>
                        <X className="w-3 h-3 mr-1" /> Cancel my bid ({formatEther(r.bid.bidPrice)})
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
