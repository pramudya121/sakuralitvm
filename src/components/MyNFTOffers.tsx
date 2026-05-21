import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Contract, formatEther } from "ethers";
import { Check, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWallet } from "@/contexts/WalletContext";
import { useAllNFTs, useAllListings } from "@/lib/web3/hooks";
import { CONTRACTS, OFFER_ABI, CHAIN } from "@/lib/web3/contracts";
import { readProvider, acceptOfferAuto, shortAddr } from "@/lib/web3/ethers";
import { pushNotification } from "@/lib/supabase-hooks";
import { toast } from "sonner";

type OfferRow = {
  tokenId: bigint;
  nftName: string;
  idx: number;
  offerer: string;
  valueEth: string;
  listingId?: bigint | null;
};

export function MyNFTOffers() {
  const { signer, address } = useWallet();
  const { nfts } = useAllNFTs();
  const { listings } = useAllListings();
  const [rows, setRows] = useState<OfferRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  // NFTs owned directly OR escrowed via a listing the user created
  const myTokens = nfts.filter(
    (n) =>
      address &&
      (n.owner.toLowerCase() === address.toLowerCase() ||
        listings.some(
          (l) =>
            l.tokenId === n.tokenId &&
            l.seller.toLowerCase() === address.toLowerCase(),
        )),
  );

  useEffect(() => {
    if (!address || myTokens.length === 0) {
      setRows([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const c = new Contract(CONTRACTS.offer, OFFER_ABI, readProvider);
      const out: OfferRow[] = [];
      for (const n of myTokens) {
        for (let i = 0; i < 50; i++) {
          try {
            const r = await c.offers(CONTRACTS.nftCollection, n.tokenId, BigInt(i));
            if (r.offerer === "0x0000000000000000000000000000000000000000") break;
            if (r.active) {
              const myListing = listings.find(
                (l) =>
                  l.tokenId === n.tokenId &&
                  l.seller.toLowerCase() === address.toLowerCase(),
              );
              out.push({
                tokenId: n.tokenId,
                nftName: n.name,
                idx: i,
                offerer: r.offerer,
                valueEth: formatEther(r.value),
                listingId: myListing?.listingId ?? null,
              });
            }
          } catch {
            break;
          }
        }
      }
      if (!cancelled) {
        setRows(out);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address, nfts.length, listings.length, reloadKey]);

  async function accept(o: OfferRow) {
    if (!signer) return toast.error("Connect wallet");
    try {
      toast.loading("Confirm in wallet...", { id: `acc-${o.tokenId}-${o.idx}` });
      await acceptOfferAuto(signer, o.tokenId, o.idx, o.listingId ?? undefined);
      toast.success("Offer accepted!", { id: `acc-${o.tokenId}-${o.idx}` });
      pushNotification(
        o.offerer,
        "offer_accepted",
        "✅ Offer accepted!",
        `Your offer of ${o.valueEth} ${CHAIN.symbol} on ${o.nftName} was accepted`,
        o.tokenId,
        `/marketplace/${o.tokenId.toString()}`,
      );
      setReloadKey((k) => k + 1);
    } catch (e: any) {
      toast.error(e?.shortMessage ?? e?.message ?? "Failed", {
        id: `acc-${o.tokenId}-${o.idx}`,
      });
    }
  }

  if (!address) return null;
  if (loading) return <div className="text-center py-12 text-muted-foreground">Loading offers...</div>;
  if (rows.length === 0)
    return (
      <div className="text-center py-12 glass rounded-2xl text-muted-foreground">
        No active offers on your NFTs.
      </div>
    );

  return (
    <div className="space-y-2">
      {rows.map((o) => (
        <div
          key={`${o.tokenId}-${o.idx}`}
          className="glass rounded-2xl p-4 flex items-center justify-between gap-3"
        >
          <div className="flex-1 min-w-0">
            <Link
              to="/marketplace/$id"
              params={{ id: o.tokenId.toString() }}
              className="font-semibold hover:text-primary transition flex items-center gap-1"
            >
              {o.nftName} <ExternalLink className="w-3 h-3" />
            </Link>
            <p className="text-xs text-muted-foreground font-mono mt-0.5">
              from {shortAddr(o.offerer)}
              {o.listingId !== null && o.listingId !== undefined && (
                <span className="ml-2 px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                  listed — will auto-cancel
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <span className="font-bold text-primary">
              {o.valueEth} {CHAIN.symbol}
            </span>
            <Button size="sm" onClick={() => accept(o)}>
              <Check className="w-3 h-3 mr-1" /> Accept
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
