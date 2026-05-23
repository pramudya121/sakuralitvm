import { useEffect } from "react";
import { Contract, formatEther } from "ethers";
import { useWallet } from "@/contexts/WalletContext";
import { readProvider } from "@/lib/web3/ethers";
import { CONTRACTS, MARKETPLACE_ABI, OFFER_ABI, CHAIN } from "@/lib/web3/contracts";
import { pushNotification } from "@/lib/supabase-hooks";

/**
 * Subscribes to on-chain Marketplace/Offer events and pushes notifications
 * to the connected wallet for events that affect them (purchase, listing
 * cancelled, new offer, offer accepted) — regardless of which UI triggered
 * the tx. Mount once near the app root.
 */
export function OnChainEventListener() {
  const { address } = useWallet();

  useEffect(() => {
    if (!address) return;
    const me = address.toLowerCase();
    const mp = new Contract(CONTRACTS.marketplace, MARKETPLACE_ABI, readProvider);
    const off = new Contract(CONTRACTS.offer, OFFER_ABI, readProvider);

    // Dedup across reloads using localStorage
    const seenKey = `sakura.notif.seen.${me}`;
    const seen = new Set<string>(JSON.parse(localStorage.getItem(seenKey) || "[]"));
    const remember = (id: string) => {
      seen.add(id);
      const arr = Array.from(seen).slice(-200);
      localStorage.setItem(seenKey, JSON.stringify(arr));
    };

    const onSold = async (listingId: bigint, buyer: string, price: bigint, ev: any) => {
      const txKey = `${ev?.log?.transactionHash}-sold-${listingId}`;
      if (seen.has(txKey)) return;
      try {
        const l = await mp.listings(listingId);
        const seller = String(l[0]).toLowerCase();
        const tokenId = l[2] as bigint;
        const priceEth = formatEther(price);
        if (seller === me && buyer.toLowerCase() !== me) {
          await pushNotification(me, "sale", "🎉 Your NFT was sold!", `Sold for ${priceEth} ${CHAIN.symbol}`, tokenId, `/marketplace/${tokenId}`);
        } else if (buyer.toLowerCase() === me) {
          await pushNotification(me, "purchase", "🛒 Purchase confirmed", `You bought NFT #${tokenId} for ${priceEth} ${CHAIN.symbol}`, tokenId, `/marketplace/${tokenId}`);
        }
        remember(txKey);
      } catch { /* ignore */ }
    };

    const onListingCancelled = async (listingId: bigint, seller: string, ev: any) => {
      if (seller.toLowerCase() !== me) return;
      const txKey = `${ev?.log?.transactionHash}-cancel-${listingId}`;
      if (seen.has(txKey)) return;
      remember(txKey);
    };

    const onOfferMade = async (_nft: string, tokenId: bigint, offerIdx: bigint, offerer: string, value: bigint, ev: any) => {
      const txKey = `${ev?.log?.transactionHash}-offerMade-${tokenId}-${offerIdx}`;
      if (seen.has(txKey)) return;
      try {
        let owner = "";
        try {
          const active = await mp.getActiveListing(CONTRACTS.nftCollection, tokenId);
          if (active?.active) owner = String(active.seller).toLowerCase();
        } catch {}
        if (!owner) {
          const { nftRead } = await import("@/lib/web3/ethers");
          owner = String(await nftRead().ownerOf(tokenId)).toLowerCase();
        }
        if (owner === me && offerer.toLowerCase() !== me) {
          await pushNotification(me, "offer", "💎 New offer received",
            `${formatEther(value)} ${CHAIN.symbol} offered on NFT #${tokenId}`, tokenId, `/marketplace/${tokenId}`);
        }
        remember(txKey);
      } catch { /* ignore */ }
    };

    const onOfferAccepted = async (_nft: string, tokenId: bigint, offerIdx: bigint, offerer: string, value: bigint, seller: string, ev: any) => {
      const txKey = `${ev?.log?.transactionHash}-offerAcc-${tokenId}-${offerIdx}`;
      if (seen.has(txKey)) return;
      if (offerer.toLowerCase() === me && seller.toLowerCase() !== me) {
        await pushNotification(me, "offer_accepted", "✅ Your offer was accepted!",
          `Your ${formatEther(value)} ${CHAIN.symbol} offer on NFT #${tokenId} was accepted`, tokenId, `/marketplace/${tokenId}`);
      } else if (seller.toLowerCase() === me) {
        await pushNotification(me, "sale", "🎉 Offer sale complete",
          `Accepted ${formatEther(value)} ${CHAIN.symbol} for NFT #${tokenId}`, tokenId, `/marketplace/${tokenId}`);
      }
      remember(txKey);
    };

    mp.on("Sold", onSold);
    mp.on("ListingCancelled", onListingCancelled);
    off.on("OfferMade", onOfferMade);
    off.on("OfferAccepted", onOfferAccepted);

    return () => {
      mp.off("Sold", onSold);
      mp.off("ListingCancelled", onListingCancelled);
      off.off("OfferMade", onOfferMade);
      off.off("OfferAccepted", onOfferAccepted);
    };
  }, [address]);

  return null;
}