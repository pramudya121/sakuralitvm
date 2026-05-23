import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Tag, ShoppingCart, X, Send, Check, Eye, ArrowRightLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useNFT, useOffers } from "@/lib/web3/hooks";
import { useWallet } from "@/contexts/WalletContext";
import { acceptOfferAuto, buyNFT, cancelListing, cancelOffer, listNFT, makeOffer, shortAddr, updateListingPrice, transferNFT, getMarketplaceFeeInfo } from "@/lib/web3/ethers";
import { isAddress } from "ethers";
import { CHAIN } from "@/lib/web3/contracts";
import { toast } from "sonner";
import { useNFTViews, pushNotification } from "@/lib/supabase-hooks";
import { LikeButton, CommentsPanel } from "@/components/NFTSocial";
import { PriceHistoryChart } from "@/components/PriceHistoryChart";
import { emitWeb3Sync } from "@/lib/web3/sync";

export const Route = createFileRoute("/marketplace/$id")({
  component: NFTDetail,
  head: ({ params }) => {
    const title = `NFT #${params.id} — SakuraNFT`;
    const description = `View NFT #${params.id} on SakuraNFT: current listing price, offers, transfer history, and ownership details on the LitVM marketplace.`;
    const url = `https://sakura-bloom-forge.lovable.app/marketplace/${params.id}`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "product" },
        { property: "og:url", content: url },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: description },
      ],
      links: [{ rel: "canonical", href: url }],
      scripts: [{
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Product",
          name: `SakuraNFT #${params.id}`,
          url,
          category: "NFT",
          brand: { "@type": "Brand", name: "SakuraNFT" },
        }),
      }],
    };
  },
});

function NFTDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { nft, listing, loading } = useNFT(id);
  const offers = useOffers(id);
  const { signer, address } = useWallet();
  const [listPrice, setListPrice] = useState("");
  const [offerPrice, setOfferPrice] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editing, setEditing] = useState(false);
  const [transferTo, setTransferTo] = useState("");
  const [showTransfer, setShowTransfer] = useState(false);
  const [feeBps, setFeeBps] = useState<number | null>(null);
  const { count: viewCount, increment } = useNFTViews(id);

  useEffect(() => { increment(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [id]);
  useEffect(() => { getMarketplaceFeeInfo().then((f) => setFeeBps(f.bps)).catch(() => {}); }, []);

  const isOwner = address && nft && address.toLowerCase() === nft.owner.toLowerCase();

  async function wrap<T>(label: string, fn: () => Promise<T>, onSuccess?: () => void) {
    if (!signer) return toast.error("Connect wallet");
    try {
      toast.loading("Confirm in wallet...", { id: label });
      await fn();
      toast.success("Success!", { id: label });
      onSuccess?.();
    } catch (e: any) { toast.error(e?.shortMessage ?? e?.message ?? "Failed", { id: label }); }
  }

  if (loading) return <div className="text-center py-20">Loading...</div>;
  if (!nft) return <div className="text-center py-20">NFT not found</div>;

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm"><Link to="/marketplace"><ArrowLeft className="w-4 h-4 mr-2" /> Back to Marketplace</Link></Button>

      <div className="grid lg:grid-cols-2 gap-8">
        <div className="glass rounded-3xl overflow-hidden glow-card">
          {nft.image ? <img src={nft.image} alt={nft.name} className="w-full aspect-square object-cover" />
            : <div className="aspect-square flex items-center justify-center text-9xl">🌸</div>}
        </div>

        <div className="space-y-6">
          <div>
            <p className="text-sm text-muted-foreground">Token #{nft.tokenId.toString()}</p>
            <h1 className="text-4xl font-bold gradient-text">{nft.name}</h1>
            <p className="text-muted-foreground mt-2">{nft.description || "No description."}</p>
            <div className="flex items-center gap-3 mt-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Eye className="w-3 h-3" /> {viewCount} views
              </div>
              <LikeButton tokenId={nft.tokenId} />
            </div>
          </div>
          <div className="glass rounded-2xl p-4 space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Owner</span><span className="font-mono">{shortAddr(nft.owner)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Collection</span><span>SakuraNFT</span></div>
            {listing && <div className="flex justify-between"><span className="text-muted-foreground">Current Price</span><span className="font-bold text-primary">{listing.priceEth} {CHAIN.symbol}</span></div>}
            {listing && feeBps !== null && (
              <div className="flex justify-between"><span className="text-muted-foreground">Marketplace Fee</span><span>{(feeBps / 100).toFixed(2)}% · seller gets {(+listing.priceEth * (10000 - feeBps) / 10000).toFixed(4)} {CHAIN.symbol}</span></div>
            )}
          </div>

          {listing && !isOwner && (
            <Button size="lg" className="w-full rounded-full shadow-lg" onClick={() => wrap("buy",
              () => buyNFT(signer, listing.listingId, listing.price),
              () => {
                pushNotification(listing.seller, "sale", "🎉 Your NFT was sold!", `${nft.name} sold for ${listing.priceEth} ${CHAIN.symbol}`, nft.tokenId, `/marketplace/${id}`);
                emitWeb3Sync("buy-nft-detail");
              },
            )}>
              <ShoppingCart className="w-4 h-4 mr-2" /> Buy Now for {listing.priceEth} {CHAIN.symbol}
            </Button>
          )}
          {listing && isOwner && (
            <div className="glass rounded-2xl p-4 space-y-3">
              {!editing ? (
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => { setEditing(true); setEditPrice(listing.priceEth); }}>
                    <Tag className="w-4 h-4 mr-2" /> Edit Price
                  </Button>
                  <Button variant="outline" className="flex-1" onClick={() => wrap("cancel", () => cancelListing(signer, listing.listingId))}>
                    <X className="w-4 h-4 mr-2" /> Cancel Listing
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Update listing price</p>
                  <div className="flex gap-2">
                    <Input type="number" step="0.001" placeholder={`New price in ${CHAIN.symbol}`} value={editPrice} onChange={(e) => setEditPrice(e.target.value)} />
                    <Button onClick={() => wrap("upd", () => updateListingPrice(signer, listing.listingId, editPrice), () => setEditing(false))} disabled={!editPrice}>Save</Button>
                    <Button variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
                  </div>
                </div>
              )}
            </div>
          )}
          {isOwner && !listing && (
            <div className="glass rounded-2xl p-4 space-y-3">
              {!showTransfer ? (
                <Button variant="outline" className="w-full" onClick={() => setShowTransfer(true)}>
                  <ArrowRightLeft className="w-4 h-4 mr-2" /> Transfer NFT to another wallet
                </Button>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Send this NFT</p>
                  <div className="flex gap-2">
                    <Input placeholder="Recipient 0x address" value={transferTo} onChange={(e) => setTransferTo(e.target.value)} />
                    <Button onClick={() => {
                      if (!isAddress(transferTo)) return toast.error("Invalid address");
                      wrap("xfer",
                        () => transferNFT(signer, transferTo, nft.tokenId),
                        () => { setShowTransfer(false); setTransferTo(""); });
                    }} disabled={!transferTo}>Send</Button>
                    <Button variant="ghost" onClick={() => setShowTransfer(false)}>Cancel</Button>
                  </div>
                </div>
              )}
            </div>
          )}
          {!listing && isOwner && (
            <div className="glass rounded-2xl p-4 space-y-3">
              <p className="text-sm font-medium">List this NFT for sale</p>
              <div className="flex gap-2">
                <Input type="number" step="0.001" placeholder={`Price in ${CHAIN.symbol}`} value={listPrice} onChange={(e) => setListPrice(e.target.value)} />
                <Button
                  onClick={() => wrap("list",
                    () => listNFT(signer, nft.tokenId, listPrice),
                    () => { toast.success("Listed! Redirecting to Marketplace…"); setTimeout(() => navigate({ to: "/marketplace" }), 900); },
                  )}
                  disabled={!listPrice}
                >
                  <Tag className="w-4 h-4 mr-2" /> List
                </Button>
              </div>
            </div>
          )}
          {!isOwner && (
            <div className="glass rounded-2xl p-4 space-y-3">
              <p className="text-sm font-medium">Make an offer</p>
              <div className="flex gap-2">
                <Input type="number" step="0.001" placeholder={`Offer in ${CHAIN.symbol}`} value={offerPrice} onChange={(e) => setOfferPrice(e.target.value)} />
                <Button variant="secondary" onClick={() => wrap("offer",
                  () => makeOffer(signer, nft.tokenId, offerPrice),
                  () => pushNotification(nft.owner, "offer", "💎 New offer received", `${offerPrice} ${CHAIN.symbol} offered on ${nft.name}`, nft.tokenId, `/marketplace/${id}`),
                )} disabled={!offerPrice}>
                  <Send className="w-4 h-4 mr-2" /> Offer
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      <Tabs defaultValue="history" className="mt-8">
        <TabsList className="glass">
          <TabsTrigger value="history">Price History</TabsTrigger>
          <TabsTrigger value="offers">Offers ({offers.filter((o) => o.active).length})</TabsTrigger>
          <TabsTrigger value="comments">Comments</TabsTrigger>
          <TabsTrigger value="metadata">Metadata</TabsTrigger>
        </TabsList>
        <TabsContent value="history" className="glass rounded-2xl p-4">
          <PriceHistoryChart tokenId={nft.tokenId} />
        </TabsContent>
        <TabsContent value="offers" className="glass rounded-2xl p-4">
          {offers.length === 0 ? <p className="text-sm text-muted-foreground text-center py-6">No offers yet.</p> : (
            <div className="space-y-2">
              {offers.map((o) => (
                <div key={o.idx} className={`flex items-center justify-between p-3 rounded-xl border ${o.active ? "" : "opacity-50"}`}>
                  <div>
                    <p className="font-mono text-sm">{shortAddr(o.offerer)}</p>
                    <p className="text-xs text-muted-foreground">{o.active ? "Active" : "Inactive"}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-primary">{o.valueEth} {CHAIN.symbol}</span>
                    {o.active && isOwner && <Button size="sm" onClick={() => wrap("acc",
                      () => acceptOfferAuto(signer, nft.tokenId, o.idx, listing?.listingId),
                      () => {
                        pushNotification(o.offerer, "offer_accepted", "✅ Offer accepted!", `Your offer of ${o.valueEth} ${CHAIN.symbol} on ${nft.name} was accepted`, nft.tokenId, `/marketplace/${id}`);
                        if (address) {
                          pushNotification(address, "sale", "🎉 NFT terjual lewat offer", `${nft.name} berhasil dijual seharga ${o.valueEth} ${CHAIN.symbol}`, nft.tokenId, `/marketplace/${id}`);
                        }
                        emitWeb3Sync("accept-offer-detail");
                      },
                    )}><Check className="w-3 h-3 mr-1" /> Accept</Button>}
                    {o.active && address?.toLowerCase() === o.offerer.toLowerCase() && (
                      <Button size="sm" variant="outline" onClick={() => wrap("co", () => cancelOffer(signer, nft.tokenId, o.idx))}><X className="w-3 h-3" /></Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
        <TabsContent value="comments" className="glass rounded-2xl p-4">
          <CommentsPanel tokenId={nft.tokenId} />
        </TabsContent>
        <TabsContent value="metadata" className="glass rounded-2xl p-4">
          <pre className="text-xs overflow-auto max-h-64">{JSON.stringify({ tokenId: id, name: nft.name, description: nft.description, owner: nft.owner }, null, 2)}</pre>
        </TabsContent>
      </Tabs>
    </div>
  );
}
