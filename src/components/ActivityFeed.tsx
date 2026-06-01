import { useEffect, useState } from "react";
import { Contract, formatEther } from "ethers";
import { ArrowLeftRight, Tag, Sparkles, Send, ExternalLink } from "lucide-react";
import { CONTRACTS, MARKETPLACE_ABI, NFT_ABI, OFFER_ABI, CHAIN } from "@/lib/web3/contracts";
import { readProvider, shortAddr } from "@/lib/web3/ethers";

type Evt = { kind: string; icon: any; color: string; text: string; blockNumber: number; tx: string; addr?: string };

/**
 * Reusable activity feed.
 * If `address` is passed, only events where that wallet appears are shown.
 */
export function ActivityFeed({ address, limit = 200 }: { address?: string; limit?: number }) {
  const [events, setEvents] = useState<Evt[]>([]);
  const [loading, setLoading] = useState(true);

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
          ...sold.map((e: any) => ({ kind: "Sale", icon: ArrowLeftRight, color: "text-green-500", text: `Sold for ${formatEther(e.args.price)} ${CHAIN.symbol} to ${shortAddr(e.args.buyer)}`, blockNumber: e.blockNumber, tx: e.transactionHash, addr: (e.args.seller ?? e.args.buyer)?.toLowerCase() })),
          ...listed.map((e: any) => ({ kind: "Listing", icon: Tag, color: "text-blue-500", text: `Listed #${e.args.tokenId} for ${formatEther(e.args.price)} ${CHAIN.symbol}`, blockNumber: e.blockNumber, tx: e.transactionHash, addr: e.args.seller?.toLowerCase() })),
          ...minted.map((e: any) => ({ kind: "Mint", icon: Sparkles, color: "text-primary", text: `Minted #${e.args.tokenId} to ${shortAddr(e.args.to)}`, blockNumber: e.blockNumber, tx: e.transactionHash, addr: e.args.to?.toLowerCase() })),
          ...offered.map((e: any) => ({ kind: "Offer", icon: Send, color: "text-orange-500", text: `Offer ${formatEther(e.args.value)} ${CHAIN.symbol} on #${e.args.tokenId}`, blockNumber: e.blockNumber, tx: e.transactionHash, addr: e.args.bidder?.toLowerCase() })),
        ].sort((a, b) => b.blockNumber - a.blockNumber);
        const filtered = address ? all.filter((e) => e.addr === address.toLowerCase()) : all;
        if (!cancelled) setEvents(filtered.slice(0, limit));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [address, limit]);

  if (loading) return <p className="p-6 text-center text-muted-foreground">Loading activity...</p>;
  if (events.length === 0) return <p className="p-6 text-center text-muted-foreground">No activity yet.</p>;

  return (
    <div className="form-panel rounded-2xl divide-y divide-border overflow-hidden">
      {events.map((e, i) => {
        const Icon = e.icon;
        return (
          <a key={i} href={`${CHAIN.explorer}/tx/${e.tx}`} target="_blank" rel="noreferrer"
            className="p-4 flex items-center gap-4 hover:bg-accent/30 transition">
            <div className={`w-10 h-10 rounded-full bg-background flex items-center justify-center ${e.color}`}><Icon className="w-4 h-4" /></div>
            <div className="flex-1 min-w-0">
              <p className="font-medium">{e.kind}</p>
              <p className="text-sm text-muted-foreground truncate">{e.text}</p>
            </div>
            <ExternalLink className="w-4 h-4 text-muted-foreground" />
          </a>
        );
      })}
    </div>
  );
}
