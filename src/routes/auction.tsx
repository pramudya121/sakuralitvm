import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { formatEther } from "ethers";
import { Gavel, Tag, ShoppingCart, X, Check, Wallet, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useWallet } from "@/contexts/WalletContext";
import { useAllNFTs } from "@/lib/web3/hooks";
import { CHAIN, CONTRACTS } from "@/lib/web3/contracts";
import {
  asaGetListing, asaGetBid, asaList, asaDelist, asaBuyNow,
  asaPlaceBid, asaCancelBid, asaAcceptBid, asaWithdraw, asaPendingWithdraw,
  asaFeeBps, shortAddr,
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

type Row = {
  tokenId: bigint;
  name: string;
  image: string;
  owner: string;
  listing: { seller: string; price: bigint; active: boolean };
  bid: { bidder: string; bidPrice: bigint; active: boolean };
};

function AuctionPage() {
  const { signer, address } = useWallet();
  const { nfts } = useAllNFTs();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [tick, setTick] = useState(0);
  const [feeBps, setFeeBps] = useState(0);
  const [pending, setPending] = useState<bigint>(0n);
  const [listInputs, setListInputs] = useState<Record<string, string>>({});
  const [bidInputs, setBidInputs] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<"all" | "listed" | "bids" | "mine">("all");

  useEffect(() => { asaFeeBps().then(setFeeBps).catch(() => {}); }, []);
  useEffect(() => subscribeWeb3Sync(() => setTick((t) => t + 1)), []);
  useEffect(() => {
    if (!address) { setPending(0n); return; }
    asaPendingWithdraw(address).then(setPending).catch(() => {});
  }, [address, tick]);

  useEffect(() => {
    if (!nfts.length) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      const out: Row[] = [];
      for (const n of nfts) {
        try {
          const [l, b] = await Promise.all([asaGetListing(n.tokenId), asaGetBid(n.tokenId)]);
          out.push({ tokenId: n.tokenId, name: n.name, image: n.image, owner: n.owner, listing: l, bid: b });
        } catch {}
      }
      if (!cancelled) { setRows(out); setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [nfts, tick]);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  async function wrap<T>(id: string, label: string, fn: () => Promise<T>) {
    if (!signer) return toast.error("Connect wallet");
    try {
      toast.loading("Confirm in wallet...", { id });
      await fn();
      toast.success(label, { id });
      refresh();
    } catch (e: any) {
      toast.error(e?.shortMessage ?? e?.reason ?? e?.message ?? "Failed", { id });
    }
  }

  const filtered = rows.filter((r) => {
    if (filter === "listed") return r.listing.active;
    if (filter === "bids") return r.bid.active;
    if (filter === "mine") return address && (
      r.owner.toLowerCase() === address.toLowerCase() ||
      r.listing.seller.toLowerCase() === address.toLowerCase() ||
      r.bid.bidder.toLowerCase() === address.toLowerCase()
    );
    return r.listing.active || r.bid.active;
  });

  return (
    <div className="space-y-6">
      <div className="glass rounded-3xl p-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold gradient-text flex items-center gap-2">
            <Gavel className="w-7 h-7" /> Autonomous Trading
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            On-chain escrow, bids & instant settlement · fee {(feeBps / 100).toFixed(2)}% ·{" "}
            <a href={`${CHAIN.explorer}/address/${CONTRACTS.autonomous}`} target="_blank" rel="noreferrer" className="text-primary hover:underline font-mono">
              {shortAddr(CONTRACTS.autonomous)}
            </a>
          </p>
        </div>
        <div className="flex items-center gap-2">
          {address && pending > 0n && (
            <Button onClick={() => wrap("w", "Withdrawn!", () => asaWithdraw(signer))}>
              <Wallet className="w-4 h-4 mr-2" /> Withdraw {formatEther(pending)} {CHAIN.symbol}
            </Button>
          )}
          <Button variant="outline" size="icon" onClick={refresh}><RefreshCw className="w-4 h-4" /></Button>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        {(["all", "listed", "bids", "mine"] as const).map((f) => (
          <Button key={f} size="sm" variant={filter === f ? "default" : "outline"} onClick={() => setFilter(f)} className="capitalize">
            {f}
          </Button>
        ))}
      </div>

      {loading && rows.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">Loading auctions...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 glass rounded-2xl text-muted-foreground">
          No items yet. List one of your NFTs below to start.
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((r) => {
            const key = r.tokenId.toString();
            const isOwner = address && r.owner.toLowerCase() === address.toLowerCase();
            const isSeller = address && r.listing.seller.toLowerCase() === address.toLowerCase();
            const isBidder = address && r.bid.bidder.toLowerCase() === address.toLowerCase();
            return (
              <div key={key} className="glass rounded-2xl overflow-hidden flex flex-col">
                <Link to="/marketplace/$id" params={{ id: key }} className="block aspect-square bg-muted">
                  {r.image
                    ? <img src={r.image} alt={r.name} className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center text-6xl">🌸</div>}
                </Link>
                <div className="p-4 space-y-3 flex-1 flex flex-col">
                  <div>
                    <p className="text-xs text-muted-foreground">#{key}</p>
                    <h3 className="font-semibold truncate">{r.name}</h3>
                  </div>

                  {r.listing.active && (
                    <div className="text-sm flex justify-between">
                      <span className="text-muted-foreground">Buy Now</span>
                      <span className="font-bold text-primary">{formatEther(r.listing.price)} {CHAIN.symbol}</span>
                    </div>
                  )}
                  {r.bid.active && (
                    <div className="text-sm flex justify-between">
                      <span className="text-muted-foreground">Top Bid</span>
                      <span className="font-bold">{formatEther(r.bid.bidPrice)} {CHAIN.symbol}</span>
                    </div>
                  )}

                  <div className="mt-auto space-y-2">
                    {/* Owner that hasn't listed yet */}
                    {isOwner && !r.listing.active && (
                      <div className="flex gap-2">
                        <Input type="number" step="0.001" placeholder={`Price ${CHAIN.symbol}`} value={listInputs[key] ?? ""} onChange={(e) => setListInputs((p) => ({ ...p, [key]: e.target.value }))} />
                        <Button size="sm" onClick={() => wrap(`l-${key}`, "Listed!", () => asaList(signer, r.tokenId, listInputs[key] || "0"))} disabled={!listInputs[key]}>
                          <Tag className="w-3 h-3 mr-1" /> List
                        </Button>
                      </div>
                    )}

                    {/* Seller actions */}
                    {isSeller && r.listing.active && (
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" className="flex-1" onClick={() => wrap(`d-${key}`, "Delisted", () => asaDelist(signer, r.tokenId))}>
                          <X className="w-3 h-3 mr-1" /> Delist
                        </Button>
                        {r.bid.active && (
                          <Button size="sm" className="flex-1" onClick={() => wrap(`a-${key}`, "Bid accepted!", () => asaAcceptBid(signer, r.tokenId))}>
                            <Check className="w-3 h-3 mr-1" /> Accept Bid
                          </Button>
                        )}
                      </div>
                    )}

                    {/* Non-seller: buy now */}
                    {r.listing.active && !isSeller && (
                      <Button size="sm" className="w-full" onClick={() => wrap(`b-${key}`, "Bought!", () => asaBuyNow(signer, r.tokenId, r.listing.price))}>
                        <ShoppingCart className="w-3 h-3 mr-1" /> Buy {formatEther(r.listing.price)} {CHAIN.symbol}
                      </Button>
                    )}

                    {/* Non-owner: place / cancel bid */}
                    {!isOwner && !isSeller && (
                      <div className="flex gap-2">
                        <Input type="number" step="0.001" placeholder={`Bid ${CHAIN.symbol}`} value={bidInputs[key] ?? ""} onChange={(e) => setBidInputs((p) => ({ ...p, [key]: e.target.value }))} />
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
