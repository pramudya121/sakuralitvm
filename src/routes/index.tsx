import { createFileRoute, Link } from "@tanstack/react-router";
import { Sparkles, Store, Plus, Repeat, Trophy, ArrowRight, Flame } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAllListings, useAllNFTs } from "@/lib/web3/hooks";
import { CHAIN } from "@/lib/web3/contracts";
import { NFTCard } from "@/components/NFTCard";
import { useTrendingTokenIds } from "@/lib/supabase-hooks";


export const Route = createFileRoute("/")({
  component: Home,
  head: () => ({
    meta: [
      { title: "SakuraNFT — Mint & Trade NFTs on LitVM" },
      { name: "description", content: "Discover trending NFTs, mint your own artwork, and swap zkLTC on SakuraNFT — the winter-sakura marketplace and DEX built on the LitVM LiteForge testnet." },
      { property: "og:title", content: "SakuraNFT — Mint & Trade NFTs on LitVM" },
      { property: "og:description", content: "Trending NFTs, AI-assisted minting, and a built-in DEX for zkLTC, all on LitVM." },
      { name: "twitter:title", content: "SakuraNFT — Mint & Trade NFTs on LitVM" },
      { name: "twitter:description", content: "Trending NFTs, AI-assisted minting, and a built-in DEX for zkLTC, all on LitVM." },
    ],
    links: [{ rel: "canonical", href: "https://sakura-bloom-forge.lovable.app/" }],
  }),
});

function Home() {
  const { nfts } = useAllNFTs();
  const { listings } = useAllListings();
  const trendingIds = useTrendingTokenIds(8);
  const trending = trendingIds.map((id) => nfts.find((n) => n.tokenId.toString() === id)).filter(Boolean) as typeof nfts;
  const featured = nfts.slice(0, 8);

  return (
    <div className="space-y-20">
      {/* Pure-CSS hero background — instant render, no image download */}
      <div aria-hidden className="fixed inset-0 -z-10 hero-bg-gradient" />
      <div aria-hidden className="fixed inset-0 -z-10 bg-gradient-to-b from-background/0 via-background/15 to-background/60 pointer-events-none" />

      {/* Hero content */}
      <section className="relative -mx-4 md:-mx-8 -mt-8 min-h-[88vh] flex items-center justify-center">
        <div className="relative z-10 text-center px-6 max-w-4xl">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-sm text-white mb-6 shadow-[0_0_30px_rgba(236,72,153,0.35)]">
            <Sparkles className="w-4 h-4 text-pink-300" /> Live on {CHAIN.name}
          </div>
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight leading-tight text-white drop-shadow-[0_4px_30px_rgba(236,72,153,0.55)]">
            Winter Sakura
            <br />
            <span className="bg-gradient-to-r from-pink-200 via-fuchsia-300 to-purple-300 bg-clip-text text-transparent">
              NFT Marketplace
            </span>
          </h1>
          <p className="mt-6 text-lg text-white/85 max-w-2xl mx-auto">
            Mint, collect, and trade NFTs under a glowing sakura sky. Swap tokens, provide liquidity, and earn — powered by ${CHAIN.symbol} on LitVM.
          </p>
          <div className="mt-8 flex flex-wrap gap-3 justify-center">
            <Button asChild size="lg" className="rounded-full shadow-[0_0_40px_rgba(236,72,153,0.55)] bg-gradient-to-r from-pink-500 to-fuchsia-500 hover:from-pink-400 hover:to-fuchsia-400 text-white border-0">
              <Link to="/marketplace">Explore Marketplace <ArrowRight className="w-4 h-4 ml-2" /></Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="rounded-full bg-white/10 backdrop-blur-md border-white/30 text-white hover:bg-white/20">
              <Link to="/mint">Create NFT</Link>
            </Button>
          </div>

          <div className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto">
            {[
              { l: "Minted", v: nfts.length },
              { l: "Listed", v: listings.length },
              { l: "Network", v: CHAIN.symbol },
              { l: "Chain ID", v: CHAIN.id },
            ].map((s) => (
              <div key={s.l} className="rounded-2xl p-4 text-center backdrop-blur-xl bg-white/10 border border-white/15">
                <div className="text-2xl font-bold text-white">{s.v}</div>
                <div className="text-xs text-white/70 mt-1">{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="grid md:grid-cols-4 gap-4">
        {[
          { i: Plus, t: "Mint Easily", d: "Upload from your device. Mint to your wallet in seconds." },
          { i: Store, t: "Buy & Sell", d: "Fixed-price listings + offers, settled in $zkLTC." },
          { i: Repeat, t: "Built-in DEX", d: "Swap tokens & provide liquidity in our Uniswap v2 fork." },
          { i: Trophy, t: "Leaderboards", d: "Climb the ranks as a top collector, seller, or trader." },
        ].map((f) => (
          <div key={f.t} className="glass rounded-2xl p-6 hover:scale-105 transition">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center mb-3">
              <f.i className="w-6 h-6 text-primary-foreground" />
            </div>
            <h3 className="font-semibold mb-1">{f.t}</h3>
            <p className="text-sm text-muted-foreground">{f.d}</p>
          </div>
        ))}
      </section>

      {/* Trending */}
      {trending.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-3xl font-bold gradient-text flex items-center gap-2"><Flame className="w-7 h-7 text-primary" /> Trending Now</h2>
            <Button asChild variant="ghost"><Link to="/marketplace">View all <ArrowRight className="w-4 h-4 ml-1" /></Link></Button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {trending.map((n) => (
              <NFTCard key={n.tokenId.toString()} nft={n} listing={listings.find((l) => l.tokenId === n.tokenId)} />
            ))}
          </div>
        </section>
      )}

      {/* Featured */}
      {featured.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-3xl font-bold gradient-text">Latest Mints</h2>
            <Button asChild variant="ghost"><Link to="/marketplace">View all <ArrowRight className="w-4 h-4 ml-1" /></Link></Button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {featured.map((n) => (
              <NFTCard key={n.tokenId.toString()} nft={n} listing={listings.find((l) => l.tokenId === n.tokenId)} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
