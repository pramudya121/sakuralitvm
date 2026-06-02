import { Link } from "@tanstack/react-router";
import { Heart, Send, ShoppingCart, Eye } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import type { NFTMeta, Listing } from "@/lib/web3/hooks";
import { shortAddr, makeOffer } from "@/lib/web3/ethers";
import { CHAIN } from "@/lib/web3/contracts";
import { useWallet } from "@/contexts/WalletContext";
import { useWatchlist } from "@/lib/supabase-hooks";
import { pushNotification } from "@/lib/supabase-hooks";
import { toast } from "sonner";

export function NFTCard({ nft, listing, onBuy }: { nft: NFTMeta; listing?: Listing; onBuy?: () => void }) {
  const { address, signer } = useWallet();
  const { items, toggle } = useWatchlist(address);
  const id = nft.tokenId.toString();
  const isFav = items.includes(id);
  const isOwner = address && address.toLowerCase() === nft.owner.toLowerCase();
  const [offerOpen, setOfferOpen] = useState(false);
  const [offerPrice, setOfferPrice] = useState("");
  const [busy, setBusy] = useState(false);

  async function submitOffer() {
    if (!signer) return toast.error("Connect wallet first");
    if (!offerPrice || +offerPrice <= 0) return toast.error("Enter a valid price");
    setBusy(true);
    try {
      toast.loading("Confirm offer in wallet...", { id: "offer" });
      await makeOffer(signer, nft.tokenId, offerPrice);
      toast.success("Offer sent!", { id: "offer" });
      await pushNotification(nft.owner, "offer", "💎 New offer received",
        `${offerPrice} ${CHAIN.symbol} offered on ${nft.name}`, nft.tokenId, `/marketplace/${id}`);
      setOfferOpen(false); setOfferPrice("");
    } catch (e: any) {
      toast.error(e?.shortMessage ?? e?.message ?? "Offer failed", { id: "offer" });
    } finally { setBusy(false); }
  }

  return (
    <div className="nft-card group flex flex-col">
      <div className="relative aspect-square overflow-hidden bg-gradient-to-br from-accent/40 to-secondary/40">
        {nft.image ? (
          <img src={nft.image} alt={nft.name} loading="lazy" decoding="async" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-5xl">🌸</div>
        )}
        {/* Token id badge */}
        <span className="absolute top-3 left-3 px-2 py-1 rounded-full text-[10px] font-mono font-semibold bg-black/55 text-white backdrop-blur-md ring-1 ring-white/10">#{id}</span>
        {listing && (
          <span className="absolute bottom-3 left-3 price-chip">{(+listing.priceEth).toFixed(4)} {CHAIN.symbol}</span>
        )}
        <button
          onClick={(e) => {
            e.preventDefault();
            if (!address) { toast.error("Connect wallet to use watchlist"); return; }
            toggle(id);
          }}
          className="absolute top-3 right-3 w-9 h-9 rounded-full bg-black/55 backdrop-blur-md ring-1 ring-white/10 flex items-center justify-center hover:scale-110 transition text-white"
          aria-label="Toggle watchlist"
        >
          <Heart className={`w-4 h-4 ${isFav ? "fill-primary text-primary" : ""}`} />
        </button>
      </div>
      <div className="p-4 flex-1 flex flex-col gap-2 relative z-10">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold truncate">{nft.name}</h3>
        </div>
        <Link to="/u/$address" params={{ address: nft.owner }} onClick={(e) => e.stopPropagation()} className="text-xs text-muted-foreground hover:text-primary truncate">by {shortAddr(nft.owner)}</Link>
        {!listing && <div className="text-xs text-muted-foreground">Not listed</div>}
        <div className="grid grid-cols-3 gap-1.5 mt-auto pt-2">
          <Button asChild size="sm" variant="outline" className="px-2">
            <Link to="/marketplace/$id" params={{ id }}><Eye className="w-3.5 h-3.5" /></Link>
          </Button>
          {listing && onBuy ? (
            <Button size="sm" className="px-2" onClick={onBuy}><ShoppingCart className="w-3.5 h-3.5 mr-1" />Buy</Button>
          ) : (
            <Button asChild size="sm" className="px-2" variant="secondary">
              <Link to="/marketplace/$id" params={{ id }}>View</Link>
            </Button>
          )}
          {!isOwner ? (
            <Dialog open={offerOpen} onOpenChange={setOfferOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="secondary" className="px-2"><Send className="w-3.5 h-3.5 mr-1" />Offer</Button>
              </DialogTrigger>
              <DialogContent className="glass">
                <DialogHeader><DialogTitle>Make Offer · {nft.name}</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <Input type="number" step="0.001" placeholder={`Offer in ${CHAIN.symbol}`} value={offerPrice} onChange={(e) => setOfferPrice(e.target.value)} />
                  <Button onClick={submitOffer} disabled={busy} className="w-full">{busy ? "Sending..." : `Send Offer`}</Button>
                </div>
              </DialogContent>
            </Dialog>
          ) : (
            <Button asChild size="sm" variant="outline" className="px-2">
              <Link to="/marketplace/$id" params={{ id }}>Manage</Link>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
