import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Twitter, Globe, BadgeCheck } from "lucide-react";
import { useMemo } from "react";
import { useAllNFTs, useAllListings } from "@/lib/web3/hooks";
import { NFTCard } from "@/components/NFTCard";
import { shortAddr } from "@/lib/web3/ethers";
import { CHAIN } from "@/lib/web3/contracts";
import { useProfile } from "@/lib/supabase-hooks";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/u/$address")({
  component: PublicProfile,
  head: ({ params }) => ({ meta: [{ title: `${shortAddr(params.address)} — SakuraNFT` }] }),
});

function PublicProfile() {
  const { address } = Route.useParams();
  const { nfts } = useAllNFTs();
  const { listings } = useAllListings();
  const { profile } = useProfile(address);

  const owned = useMemo(
    () => nfts.filter((n) => n.owner.toLowerCase() === address.toLowerCase()),
    [nfts, address],
  );
  const userListings = useMemo(
    () => listings.filter((l) => l.seller.toLowerCase() === address.toLowerCase()),
    [listings, address],
  );
  const totalValue = userListings.reduce((a, l) => a + +l.priceEth, 0).toFixed(2);

  return (
    <div className="space-y-8">
      <Button asChild variant="ghost" size="sm">
        <Link to="/marketplace"><ArrowLeft className="w-4 h-4 mr-2" /> Back</Link>
      </Button>

      <div className="glass rounded-3xl overflow-hidden glow-card">
        {profile?.banner_url && (
          <div className="h-32 md:h-48 bg-cover bg-center" style={{ backgroundImage: `url(${profile.banner_url})` }} />
        )}
        <div className="p-6 md:p-8 flex flex-col md:flex-row gap-6 items-center md:items-start">
          <div className="w-28 h-28 rounded-full bg-gradient-to-br from-primary to-accent overflow-hidden flex items-center justify-center text-5xl shrink-0 -mt-16 md:-mt-20 border-4 border-background">
            {profile?.avatar_url ? <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" /> : "🌸"}
          </div>
          <div className="flex-1 text-center md:text-left">
            <h1 className="text-3xl font-bold flex items-center gap-2 justify-center md:justify-start">
              {profile?.display_name || "Anonymous Collector"}
              {owned.length >= 5 && <BadgeCheck className="w-5 h-5 text-primary" />}
            </h1>
            <p className="font-mono text-sm text-muted-foreground">{shortAddr(address)}</p>
            <p className="mt-2 text-sm max-w-xl">{profile?.bio || "No bio yet."}</p>
            <div className="flex gap-3 mt-3 justify-center md:justify-start">
              {profile?.twitter && <a href={`https://twitter.com/${profile.twitter}`} target="_blank" rel="noopener" className="text-muted-foreground hover:text-primary"><Twitter className="w-4 h-4" /></a>}
              {(() => { try { const u = profile?.website ? new URL(profile.website) : null; return u && (u.protocol === "http:" || u.protocol === "https:") ? <a href={u.toString()} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary"><Globe className="w-4 h-4" /></a> : null; } catch { return null; } })()}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Stat label="Owned" v={owned.length} />
        <Stat label="Listed" v={userListings.length} />
        <Stat label={`Value (${CHAIN.symbol})`} v={totalValue} />
      </div>

      <div>
        <h2 className="text-2xl font-bold gradient-text mb-4">Collection</h2>
        {owned.length === 0 ? (
          <div className="text-center py-12 glass rounded-2xl text-muted-foreground">No NFTs owned yet.</div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {owned.map((n) => <NFTCard key={n.tokenId.toString()} nft={n} listing={listings.find((l) => l.tokenId === n.tokenId)} />)}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, v }: { label: string; v: any }) {
  return <div className="glass rounded-2xl p-4 text-center"><div className="text-2xl font-bold gradient-text">{v}</div><div className="text-xs text-muted-foreground">{label}</div></div>;
}
