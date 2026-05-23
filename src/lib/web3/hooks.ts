import { useEffect, useState } from "react";
import { Contract, formatEther } from "ethers";
import { CONTRACTS, MARKETPLACE_ABI, NFT_ABI, OFFER_ABI } from "./contracts";
import { readProvider, decodeTokenUri } from "./ethers";
import { subscribeWeb3Sync } from "./sync";

export type NFTMeta = {
  tokenId: bigint;
  owner: string;
  tokenURI: string;
  name: string;
  description: string;
  image: string;
};

export type Listing = {
  listingId: bigint;
  seller: string;
  nft: string;
  tokenId: bigint;
  price: bigint;
  priceEth: string;
  active: boolean;
};

export function useAllNFTs() {
  const [nfts, setNfts] = useState<NFTMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    (async () => {
      try {
        const nft = new Contract(CONTRACTS.nftCollection, NFT_ABI, readProvider);
        const mp = new Contract(CONTRACTS.marketplace, MARKETPLACE_ABI, readProvider);
        const total: bigint = await nft.totalMinted();
        const listingCount: bigint = await mp.listingCount().catch(() => 0n);
        const activeSellers = new Map<string, string>();
        for (let i = 1n; i <= listingCount; i++) {
          try {
            const row = await mp.listings(i);
            if (row.active) {
              activeSellers.set(String(row.tokenId), String(row.seller));
            }
          } catch {}
        }
        const items: NFTMeta[] = [];
        for (let i = 1n; i <= total; i++) {
          try {
            const [uri, ownerOnChain] = await Promise.all([nft.tokenURI(i), nft.ownerOf(i)]);
            const meta = decodeTokenUri(uri) ?? {};
            const owner = activeSellers.get(i.toString()) ?? ownerOnChain;
            items.push({
              tokenId: i, owner, tokenURI: uri,
              name: meta.name ?? `NFT #${i}`,
              description: meta.description ?? "",
              image: meta.image ?? "",
            });
          } catch {}
        }
        setNfts(items.reverse());
      } finally { setLoading(false); }
    })();
  }, [tick]);

  useEffect(() => subscribeWeb3Sync(() => setTick((v) => v + 1)), []);
  return { nfts, loading };
}

export function useAllListings() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    (async () => {
      try {
        const mp = new Contract(CONTRACTS.marketplace, MARKETPLACE_ABI, readProvider);
        const count: bigint = await mp.listingCount();
        const items: Listing[] = [];
        for (let i = 1n; i <= count; i++) {
          try {
            const r = await mp.listings(i);
            if (r.active) {
              items.push({
                listingId: i,
                seller: r.seller, nft: r.nft, tokenId: r.tokenId,
                price: r.price, priceEth: formatEther(r.price), active: r.active,
              });
            }
          } catch {}
        }
        setListings(items);
      } finally { setLoading(false); }
    })();
  }, [tick]);

  useEffect(() => subscribeWeb3Sync(() => setTick((v) => v + 1)), []);
  return { listings, loading };
}

export function useNFT(tokenId: string | undefined) {
  const [nft, setNft] = useState<NFTMeta | null>(null);
  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!tokenId) return;
    (async () => {
      try {
        const id = BigInt(tokenId);
        const nftC = new Contract(CONTRACTS.nftCollection, NFT_ABI, readProvider);
        let owner = "";
        let activeListing: Listing | null = null;
        try {
          const mp = new Contract(CONTRACTS.marketplace, MARKETPLACE_ABI, readProvider);
          const r = await mp.getActiveListing(CONTRACTS.nftCollection, id);
          if (r.active) {
            activeListing = {
              listingId: r.listingId, seller: r.seller, nft: CONTRACTS.nftCollection,
              tokenId: id, price: r.price, priceEth: formatEther(r.price), active: true,
            };
            owner = String(r.seller);
          }
        } catch {}
        const uri = await nftC.tokenURI(id);
        if (!owner) {
          owner = await nftC.ownerOf(id);
        }
        const meta = decodeTokenUri(uri) ?? {};
        setNft({
          tokenId: id, owner, tokenURI: uri,
          name: meta.name ?? `NFT #${id}`,
          description: meta.description ?? "",
          image: meta.image ?? "",
        });
        setListing(activeListing);
      } finally { setLoading(false); }
    })();
  }, [tokenId, tick]);

  useEffect(() => subscribeWeb3Sync(() => setTick((v) => v + 1)), []);
  return { nft, listing, loading };
}

export function useOffers(tokenId: string | undefined) {
  const [offers, setOffers] = useState<{ idx: number; offerer: string; value: bigint; valueEth: string; active: boolean }[]>([]);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!tokenId) return;
    (async () => {
      const c = new Contract(CONTRACTS.offer, OFFER_ABI, readProvider);
      const items: any[] = [];
      for (let i = 0; i < 50; i++) {
        try {
          const r = await c.offers(CONTRACTS.nftCollection, BigInt(tokenId), BigInt(i));
          if (r.offerer === "0x0000000000000000000000000000000000000000") break;
          items.push({ idx: i, offerer: r.offerer, value: r.value, valueEth: formatEther(r.value), active: r.active });
        } catch { break; }
      }
      setOffers(items);
    })();
  }, [tokenId, tick]);

  useEffect(() => subscribeWeb3Sync(() => setTick((v) => v + 1)), []);
  return offers;
}

// Local storage helpers for off-chain features (watchlist, profile, notifications)
export function useLocalStorage<T>(key: string, initial: T) {
  const [v, setV] = useState<T>(() => {
    if (typeof window === "undefined") return initial;
    try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : initial; } catch { return initial; }
  });
  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(v)); } catch {}
  }, [key, v]);
  return [v, setV] as const;
}
