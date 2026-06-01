import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

// ---------- Profile ----------
export type DBProfile = {
  wallet_address: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  banner_url: string | null;
  twitter: string | null;
  website: string | null;
};

export function useProfile(address?: string | null) {
  const [profile, setProfile] = useState<DBProfile | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!address) return setProfile(null);
    setLoading(true);
    const { data } = await supabase
      .from("profiles")
      .select("wallet_address, display_name, bio, avatar_url, banner_url, twitter, website")
      .eq("wallet_address", address.toLowerCase())
      .maybeSingle();
    setProfile(data as DBProfile | null);
    setLoading(false);
  }, [address]);

  useEffect(() => { load(); }, [load]);

  const save = useCallback(async (patch: Partial<DBProfile>) => {
    if (!address) return;
    const row = { wallet_address: address.toLowerCase(), ...patch };
    const { data } = await supabase
      .from("profiles")
      .upsert(row, { onConflict: "wallet_address" })
      .select()
      .single();
    if (data) setProfile(data as DBProfile);
  }, [address]);

  return { profile, loading, save, reload: load };
}

// ---------- Watchlist ----------
export function useWatchlist(address?: string | null) {
  const [items, setItems] = useState<string[]>([]);

  const load = useCallback(async () => {
    if (!address) { setItems([]); return; }
    const { data } = await supabase
      .from("watchlist")
      .select("token_id")
      .eq("wallet_address", address.toLowerCase());
    setItems((data ?? []).map((r: { token_id: number | string }) => String(r.token_id)));
  }, [address]);

  useEffect(() => { load(); }, [load]);

  const toggle = useCallback(async (tokenId: string) => {
    if (!address) return;
    const wallet = address.toLowerCase();
    const tid = BigInt(tokenId).toString();
    const isFav = items.includes(tid);
    if (isFav) {
      setItems(items.filter((x) => x !== tid));
      await supabase.from("watchlist").delete()
        .eq("wallet_address", wallet).eq("token_id", Number(tid));
    } else {
      setItems([...items, tid]);
      await supabase.from("watchlist").insert({ wallet_address: wallet, token_id: Number(tid) });
    }
  }, [address, items]);

  return { items, toggle, reload: load };
}

// ---------- Notifications ----------
export type Notification = {
  id: string;
  wallet_address: string;
  type: string;
  title: string;
  message: string | null;
  token_id: number | null;
  link: string | null;
  read: boolean;
  created_at: string;
};

export function useNotifications(address?: string | null) {
  const [list, setList] = useState<Notification[]>([]);

  const load = useCallback(async () => {
    if (!address) { setList([]); return; }
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("wallet_address", address.toLowerCase())
      .order("created_at", { ascending: false })
      .limit(30);
    setList((data ?? []) as Notification[]);
  }, [address]);

  useEffect(() => {
    load();
    if (!address) return;
    const wallet = address.toLowerCase();
    const channel = supabase
      .channel(`notif-${wallet}`)
      .on("postgres_changes", {
        event: "*", schema: "public", table: "notifications",
        filter: `wallet_address=eq.${wallet}`,
      }, (payload) => {
        if (payload.eventType === "INSERT") {
          setList((prev) => [payload.new as Notification, ...prev.filter((n) => n.id !== payload.new.id)]);
          return;
        }
        if (payload.eventType === "UPDATE") {
          setList((prev) => prev.map((n) => n.id === payload.new.id ? payload.new as Notification : n));
          return;
        }
        load();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [address, load]);

  const markAllRead = useCallback(async () => {
    if (!address) return;
    setList((p) => p.map((n) => ({ ...n, read: true })));
    await supabase.from("notifications").update({ read: true })
      .eq("wallet_address", address.toLowerCase()).eq("read", false);
  }, [address]);

  const unread = list.filter((n) => !n.read).length;
  return { list, unread, markAllRead, reload: load };
}

export async function pushNotification(
  to: string,
  type: string,
  title: string,
  message?: string,
  tokenId?: bigint | number,
  link?: string,
) {
  // Notifications are inserted server-side via supabaseAdmin so that the
  // public role cannot spam other wallets' inboxes (RLS denies anon INSERT).
  const { pushNotificationServer } = await import("./notifications.functions");
  try {
    await pushNotificationServer({
      data: {
        to,
        type,
        title,
        message: message ?? null,
        tokenId: tokenId !== undefined ? Number(tokenId) : null,
        link: link ?? null,
      },
    });
  } catch (e) {
    console.warn("pushNotification failed", e);
  }
}

// ---------- Views ----------
export function useNFTViews(tokenId?: string | bigint) {
  const [count, setCount] = useState<number>(0);

  useEffect(() => {
    if (tokenId === undefined) return;
    const tid = Number(tokenId);
    let cancelled = false;
    (async () => {
      const { data } = await supabase.from("nft_views").select("view_count").eq("token_id", tid).maybeSingle();
      if (!cancelled) setCount(Number(data?.view_count ?? 0));
    })();
    return () => { cancelled = true; };
  }, [tokenId]);

  const increment = useCallback(async () => {
    if (tokenId === undefined) return;
    const tid = Number(tokenId);
    try {
      const { incrementNftView } = await import("./nft-views.functions");
      await incrementNftView({ data: { tokenId: tid } });
      setCount((c) => c + 1);
    } catch {}
  }, [tokenId]);

  return { count, increment };
}

// ---------- Trending by views ----------
export function useTrendingTokenIds(limit = 8) {
  const [ids, setIds] = useState<string[]>([]);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("nft_views")
        .select("token_id, view_count")
        .order("view_count", { ascending: false })
        .limit(limit);
      if (!cancelled) setIds((data ?? []).map((r: any) => String(r.token_id)));
    })();
    return () => { cancelled = true; };
  }, [limit]);
  return ids;
}

// ---------- Likes ----------
export function useNFTLikes(tokenId?: string | bigint, viewer?: string | null) {
  const [count, setCount] = useState(0);
  const [liked, setLiked] = useState(false);

  const load = useCallback(async () => {
    if (tokenId === undefined) return;
    const tid = Number(tokenId);
    const { count: c } = await supabase
      .from("nft_likes")
      .select("*", { count: "exact", head: true })
      .eq("token_id", tid);
    setCount(c ?? 0);
    if (viewer) {
      const { data } = await supabase
        .from("nft_likes")
        .select("id")
        .eq("token_id", tid)
        .eq("wallet_address", viewer.toLowerCase())
        .maybeSingle();
      setLiked(!!data);
    } else setLiked(false);
  }, [tokenId, viewer]);

  useEffect(() => { load(); }, [load]);

  const toggle = useCallback(async () => {
    if (!viewer || tokenId === undefined) return;
    const tid = Number(tokenId);
    const wallet = viewer.toLowerCase();
    if (liked) {
      setLiked(false); setCount((c) => Math.max(0, c - 1));
      await supabase.from("nft_likes").delete()
        .eq("token_id", tid).eq("wallet_address", wallet);
    } else {
      setLiked(true); setCount((c) => c + 1);
      await supabase.from("nft_likes").insert({ token_id: tid, wallet_address: wallet });
    }
  }, [liked, tokenId, viewer]);

  return { count, liked, toggle };
}

// ---------- Comments ----------
export type NFTComment = {
  id: string;
  token_id: number;
  wallet_address: string;
  content: string;
  created_at: string;
};

export function useNFTComments(tokenId?: string | bigint) {
  const [comments, setComments] = useState<NFTComment[]>([]);

  const load = useCallback(async () => {
    if (tokenId === undefined) return;
    const tid = Number(tokenId);
    const { data } = await supabase
      .from("nft_comments")
      .select("*")
      .eq("token_id", tid)
      .order("created_at", { ascending: false })
      .limit(100);
    setComments((data ?? []) as NFTComment[]);
  }, [tokenId]);

  useEffect(() => {
    load();
    if (tokenId === undefined) return;
    const tid = Number(tokenId);
    const ch = supabase
      .channel(`comments-${tid}`)
      .on("postgres_changes", {
        event: "*", schema: "public", table: "nft_comments",
        filter: `token_id=eq.${tid}`,
      }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [tokenId, load]);

  const post = useCallback(async (wallet: string, content: string) => {
    if (tokenId === undefined) return;
    const text = content.trim().slice(0, 1000);
    if (!text) return;
    await supabase.from("nft_comments").insert({
      token_id: Number(tokenId),
      wallet_address: wallet.toLowerCase(),
      content: text,
    });
  }, [tokenId]);

  const remove = useCallback(async (id: string) => {
    await supabase.from("nft_comments").delete().eq("id", id);
  }, []);

  return { comments, post, remove, reload: load };
}
