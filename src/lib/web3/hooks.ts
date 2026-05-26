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

// ---------- Module-level cache (instant data on page change) ----------
type NFTCache = { nfts: NFTMeta[]; ts: number };
type ListingCache = { listings: Listing[]; ts: number };
let _nftCache: NFTCache | null = null;
let _listingCache: ListingCache | null = null;
let _nftPromise: Promise<NFTMeta[]> | null = null;
let _listingPromise: Promise<Listing[]> | null = null;

const CHUNK = 16;
async function chunkedAll<T, R>(items: T[], fn: (x: T) => Promise<R | null>): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += CHUNK) {
    const slice = items.slice(i, i + CHUNK);
    const r = await Promise.all(slice.map((x) => fn(x).catch(() => null)));
    for (const v of r) if (v != null) out.push(v as R);
  }
  return out;
}

async function fetchAllListings(): Promise<Listing[]> {
  const mp = new Contract(CONTRACTS.marketplace, MARKETPLACE_ABI, readProvider);
  const count: bigint = await mp.listingCount().catch(() => 0n);
  const ids: bigint[] = [];
  for (let i = 1n; i <= count; i++) ids.push(i);
  const results = await chunkedAll(ids, async (i) => {
    const r = await mp.listings(i);
    if (!r.active) return null;
    return {
      listingId: i,
      seller: String(r.seller), nft: String(r.nft), tokenId: r.tokenId as bigint,
      price: r.price as bigint, priceEth: formatEther(r.price), active: true,
    } as Listing;
  });
  return results;
}

async function fetchAllNFTs(): Promise<NFTMeta[]> {
  const nft = new Contract(CONTRACTS.nftCollection, NFT_ABI, readProvider);
  const [total, listings] = await Promise.all([
    nft.totalMinted() as Promise<bigint>,
    fetchAllListings(),
  ]);
  const activeSellers = new Map<string, string>();
  for (const l of listings) activeSellers.set(l.tokenId.toString(), l.seller);

  const ids: bigint[] = [];
  for (let i = 1n; i <= total; i++) ids.push(i);

  const items = await chunkedAll(ids, async (i) => {
    const [uri, ownerOnChain] = await Promise.all([nft.tokenURI(i), nft.ownerOf(i)]);
    const meta = decodeTokenUri(uri) ?? {};
    return {
      tokenId: i,
      owner: activeSellers.get(i.toString()) ?? String(ownerOnChain),
      tokenURI: uri,
      name: meta.name ?? `NFT #${i}`,
      description: meta.description ?? "",
      image: meta.image ?? "",
    } as NFTMeta;
  });
  // Prime listings cache too — we just fetched them.
  _listingCache = { listings, ts: Date.now() };
  return items.reverse();
}

function loadNFTs(force = false): Promise<NFTMeta[]> {
  if (!force && _nftPromise) return _nftPromise;
  _nftPromise = fetchAllNFTs()
    .then((nfts) => { _nftCache = { nfts, ts: Date.now() }; return nfts; })
    .finally(() => { _nftPromise = null; });
  return _nftPromise;
}

function loadListings(force = false): Promise<Listing[]> {
  if (!force && _listingPromise) return _listingPromise;
  _listingPromise = fetchAllListings()
    .then((listings) => { _listingCache = { listings, ts: Date.now() }; return listings; })
    .finally(() => { _listingPromise = null; });
  return _listingPromise;
}

// Invalidate on web3 sync events from anywhere
let _syncBound = false;
function ensureSyncBinding() {
  if (_syncBound || typeof window === "undefined") return;
  _syncBound = true;
  subscribeWeb3Sync(() => {
    loadNFTs(true).catch(() => {});
    loadListings(true).catch(() => {});
  });
}

export function useAllNFTs() {
  const [nfts, setNfts] = useState<NFTMeta[]>(() => _nftCache?.nfts ?? []);
  const [loading, setLoading] = useState(!_nftCache);

  useEffect(() => {
    ensureSyncBinding();
    let cancelled = false;
    // If cache stale (>10s), refresh in background; otherwise just hydrate.
    const stale = !_nftCache || Date.now() - _nftCache.ts > 10_000;
    if (stale) {
      loadNFTs().then((v) => { if (!cancelled) { setNfts(v); setLoading(false); } }).catch(() => setLoading(false));
    } else {
      setNfts(_nftCache!.nfts);
      setLoading(false);
    }
    const unsub = subscribeWeb3Sync(() => {
      loadNFTs(true).then((v) => { if (!cancelled) setNfts(v); }).catch(() => {});
    });
    const id = window.setInterval(() => {
      loadNFTs(true).then((v) => { if (!cancelled) setNfts(v); }).catch(() => {});
    }, 15000);
    return () => { cancelled = true; unsub(); window.clearInterval(id); };
  }, []);

  return { nfts, loading };
}

export function useAllListings() {
  const [listings, setListings] = useState<Listing[]>(() => _listingCache?.listings ?? []);
  const [loading, setLoading] = useState(!_listingCache);

  useEffect(() => {
    ensureSyncBinding();
    let cancelled = false;
    const stale = !_listingCache || Date.now() - _listingCache.ts > 10_000;
    if (stale) {
      loadListings().then((v) => { if (!cancelled) { setListings(v); setLoading(false); } }).catch(() => setLoading(false));
    } else {
      setListings(_listingCache!.listings);
      setLoading(false);
    }
    const unsub = subscribeWeb3Sync(() => {
      loadListings(true).then((v) => { if (!cancelled) setListings(v); }).catch(() => {});
    });
    const id = window.setInterval(() => {
      loadListings(true).then((v) => { if (!cancelled) setListings(v); }).catch(() => {});
    }, 15000);
    return () => { cancelled = true; unsub(); window.clearInterval(id); };
  }, []);

  return { listings, loading };
}

export function useNFT(tokenId: string | undefined) {
  const [nft, setNft] = useState<NFTMeta | null>(null);
  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!tokenId) return;
    // Instant hydrate from cache if present
    if (_nftCache) {
      const hit = _nftCache.nfts.find((n) => n.tokenId.toString() === tokenId);
      if (hit) { setNft(hit); setLoading(false); }
    }
    if (_listingCache) {
      const hit = _listingCache.listings.find((l) => l.tokenId.toString() === tokenId) ?? null;
      setListing(hit);
    }

    let cancelled = false;
    (async () => {
      try {
        const id = BigInt(tokenId);
        const nftC = new Contract(CONTRACTS.nftCollection, NFT_ABI, readProvider);
        const mp = new Contract(CONTRACTS.marketplace, MARKETPLACE_ABI, readProvider);
        const [uri, ownerOnChain, activeRow] = await Promise.all([
          nftC.tokenURI(id),
          nftC.ownerOf(id).catch(() => ""),
          mp.getActiveListing(CONTRACTS.nftCollection, id).catch(() => null),
        ]);
        let owner = String(ownerOnChain);
        let activeListing: Listing | null = null;
        if (activeRow?.active) {
          activeListing = {
            listingId: activeRow.listingId, seller: String(activeRow.seller), nft: CONTRACTS.nftCollection,
            tokenId: id, price: activeRow.price as bigint, priceEth: formatEther(activeRow.price), active: true,
          };
          owner = String(activeRow.seller);
        }
        const meta = decodeTokenUri(uri) ?? {};
        if (cancelled) return;
        setNft({
          tokenId: id, owner, tokenURI: uri,
          name: meta.name ?? `NFT #${id}`,
          description: meta.description ?? "",
          image: meta.image ?? "",
        });
        setListing(activeListing);
      } finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [tokenId, tick]);

  useEffect(() => subscribeWeb3Sync(() => setTick((v) => v + 1)), []);
  useEffect(() => {
    const id = window.setInterval(() => setTick((v) => v + 1), 15000);
    return () => window.clearInterval(id);
  }, []);
  return { nft, listing, loading };
}

export function useOffers(tokenId: string | undefined) {
  const [offers, setOffers] = useState<{ idx: number; offerer: string; value: bigint; valueEth: string; active: boolean }[]>([]);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!tokenId) return;
    let cancelled = false;
    (async () => {
      const c = new Contract(CONTRACTS.offer, OFFER_ABI, readProvider);
      // Parallel probe — read 20 slots at once, stop at first zero-offerer.
      const indices = Array.from({ length: 50 }, (_, i) => i);
      const results = await chunkedAll(indices, async (i) => {
        const r = await c.offers(CONTRACTS.nftCollection, BigInt(tokenId), BigInt(i));
        if (r.offerer === "0x0000000000000000000000000000000000000000") return null;
        return { idx: i, offerer: r.offerer as string, value: r.value as bigint, valueEth: formatEther(r.value), active: r.active as boolean };
      });
      if (!cancelled) setOffers(results);
    })();
    return () => { cancelled = true; };
  }, [tokenId, tick]);

  useEffect(() => subscribeWeb3Sync(() => setTick((v) => v + 1)), []);
  useEffect(() => {
    const id = window.setInterval(() => setTick((v) => v + 1), 15000);
    return () => window.clearInterval(id);
  }, []);
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
