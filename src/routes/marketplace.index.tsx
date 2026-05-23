import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Search, SlidersHorizontal, LayoutGrid, List, Sparkles, TrendingUp, Tag, Users } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { useAllListings, useAllNFTs } from "@/lib/web3/hooks";
import { NFTCard } from "@/components/NFTCard";
import { useWallet } from "@/contexts/WalletContext";
import { buyNFT } from "@/lib/web3/ethers";
import { CHAIN } from "@/lib/web3/contracts";
import { toast } from "sonner";

export const Route = createFileRoute("/marketplace/")({
  component: Marketplace,
  head: () => ({
    meta: [
      { title: "NFT Marketplace — SakuraNFT" },
      { name: "description", content: "Browse, search and buy listed NFTs on LitVM. Filter by price, sort by newest or trending, and own digital art secured on-chain." },
      { property: "og:title", content: "NFT Marketplace — SakuraNFT" },
      { property: "og:description", content: "Browse, search and buy listed NFTs on the LitVM-powered SakuraNFT marketplace." },
      { name: "twitter:title", content: "NFT Marketplace — SakuraNFT" },
      { name: "twitter:description", content: "Browse, search and buy listed NFTs on the LitVM-powered SakuraNFT marketplace." },
    ],
    links: [{ rel: "canonical", href: "https://sakura-bloom-forge.lovable.app/marketplace" }],
  }),
});

function Marketplace() {
  const { nfts, loading } = useAllNFTs();
  const { listings } = useAllListings();
  const { signer } = useWallet();
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("newest");
  const [maxPrice, setMaxPrice] = useState(100);
  const [onlyListed, setOnlyListed] = useState("listed");
  const [view, setView] = useState<"grid" | "list">("grid");

  const stats = useMemo(() => {
    const prices = listings.map((l) => +l.priceEth).filter((n) => n > 0);
    const floor = prices.length ? Math.min(...prices) : 0;
    const volume = prices.reduce((a, b) => a + b, 0);
    const owners = new Set(nfts.map((n) => n.owner.toLowerCase())).size;
    return { total: nfts.length, listed: listings.length, floor, volume, owners };
  }, [nfts, listings]);

  const items = useMemo(() => {
    let arr = nfts.map((n) => ({ nft: n, listing: listings.find((l) => l.tokenId === n.tokenId) }));
    if (onlyListed === "all") arr = arr.filter((x) => !!x.listing);
    if (onlyListed === "listed") arr = arr.filter((x) => x.listing);
    if (onlyListed === "unlisted") arr = arr.filter((x) => !x.listing);
    if (search) arr = arr.filter((x) => x.nft.name.toLowerCase().includes(search.toLowerCase()) || x.nft.tokenId.toString().includes(search));
    arr = arr.filter((x) => !x.listing || +x.listing.priceEth <= maxPrice);
    if (sort === "price-asc") arr.sort((a, b) => (+(a.listing?.priceEth ?? 1e9)) - (+(b.listing?.priceEth ?? 1e9)));
    if (sort === "price-desc") arr.sort((a, b) => (+(b.listing?.priceEth ?? 0)) - (+(a.listing?.priceEth ?? 0)));
    if (sort === "oldest") arr.sort((a, b) => Number(a.nft.tokenId - b.nft.tokenId));
    return arr;
  }, [nfts, listings, search, sort, maxPrice, onlyListed]);

  async function handleBuy(listingId: bigint, price: bigint) {
    if (!signer) return toast.error("Connect wallet first");
    try {
      toast.loading("Confirm in wallet...", { id: "buy" });
      await buyNFT(signer, listingId, price);
      toast.success("Purchased!", { id: "buy" });
    } catch (e: any) {
      toast.error(e?.shortMessage ?? e?.message ?? "Buy failed", { id: "buy" });
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-4xl font-bold gradient-text flex items-center gap-3">
            <Sparkles className="w-8 h-8" /> Marketplace
          </h1>
          <p className="text-muted-foreground mt-1">Discover, trade and collect Sakura NFTs on LitVM.</p>
        </div>
        <div className="flex items-center gap-2 glass rounded-full p-1">
          <button onClick={() => setView("grid")} className={`p-2 rounded-full transition ${view === "grid" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`} aria-label="Grid view">
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button onClick={() => setView("list")} className={`p-2 rounded-full transition ${view === "list" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`} aria-label="List view">
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Premium stats bar */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatTile icon={<Sparkles className="w-4 h-4" />} label="Total NFTs" value={stats.total} />
        <StatTile icon={<Tag className="w-4 h-4" />} label="Listed" value={stats.listed} accent />
        <StatTile icon={<TrendingUp className="w-4 h-4" />} label="Floor" value={stats.floor ? `${stats.floor} ${CHAIN.symbol}` : "—"} />
        <StatTile icon={<TrendingUp className="w-4 h-4" />} label={`Listed Vol`} value={`${stats.volume.toFixed(2)} ${CHAIN.symbol}`} />
        <StatTile icon={<Users className="w-4 h-4" />} label="Owners" value={stats.owners} />
      </div>

      <div className="glass rounded-2xl p-4 grid md:grid-cols-4 gap-3">
        <div className="relative md:col-span-2">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search by name or token ID..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={sort} onValueChange={setSort}>
          <SelectTrigger><SelectValue placeholder="Sort" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Newest</SelectItem>
            <SelectItem value="oldest">Oldest</SelectItem>
            <SelectItem value="price-asc">Price: Low → High</SelectItem>
            <SelectItem value="price-desc">Price: High → Low</SelectItem>
          </SelectContent>
        </Select>
        <Select value={onlyListed} onValueChange={setOnlyListed}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Listed NFTs</SelectItem>
            <SelectItem value="listed">Listed only</SelectItem>
            <SelectItem value="unlisted">Unlisted only</SelectItem>
          </SelectContent>
        </Select>
        <div className="md:col-span-4 flex items-center gap-3">
          <SlidersHorizontal className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm">Max price: <b>{maxPrice} zkLTC</b></span>
          <Slider value={[maxPrice]} onValueChange={([v]) => setMaxPrice(v)} max={1000} step={1} className="flex-1" />
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => <div key={i} className="aspect-square glass rounded-2xl animate-pulse" />)}
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-20 glass rounded-2xl">
          <p className="text-muted-foreground">No NFTs match your filters. Be the first to <a href="/mint" className="text-primary underline">mint one</a>!</p>
        </div>
      ) : (
        view === "grid" ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {items.map(({ nft, listing }) => (
              <NFTCard key={nft.tokenId.toString()} nft={nft} listing={listing}
                onBuy={listing ? () => handleBuy(listing.listingId, listing.price) : undefined} />
            ))}
          </div>
        ) : (
          <div className="glass rounded-2xl divide-y divide-border/40">
            {items.map(({ nft, listing }) => (
              <a key={nft.tokenId.toString()} href={`/marketplace/${nft.tokenId.toString()}`}
                 className="flex items-center gap-4 p-3 hover:bg-accent/40 transition">
                <img src={nft.image} alt={nft.name} loading="lazy" className="w-14 h-14 rounded-lg object-cover bg-muted" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{nft.name}</p>
                  <p className="text-xs text-muted-foreground font-mono">#{nft.tokenId.toString()}</p>
                </div>
                <div className="text-right text-sm">
                  {listing ? <span className="font-bold text-primary">{listing.priceEth} {CHAIN.symbol}</span> : <span className="text-muted-foreground">Not listed</span>}
                </div>
              </a>
            ))}
          </div>
        )
      )}
    </div>
  );
}

function StatTile({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: React.ReactNode; accent?: boolean }) {
  return (
    <div className={`glass rounded-2xl p-4 ${accent ? "ring-1 ring-primary/40" : ""}`}>
      <div className="flex items-center gap-2 text-muted-foreground text-xs">{icon}<span>{label}</span></div>
      <div className="mt-1 text-xl font-bold gradient-text truncate">{value}</div>
    </div>
  );
}
