-- SIWE wallet_nonces table (server-only writes)
CREATE TABLE public.wallet_nonces (
  wallet_address TEXT PRIMARY KEY,
  nonce TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT ALL ON public.wallet_nonces TO service_role;
-- No anon/authenticated grants: only the service role (via server fns) reads/writes nonces.

ALTER TABLE public.wallet_nonces ENABLE ROW LEVEL SECURITY;
-- No policies = no access for anon/authenticated. service_role bypasses RLS.

-- Drop forgeable header-based write policies on sensitive tables.
-- All sensitive writes will now go through SIWE-protected server fns using supabaseAdmin.

DROP POLICY IF EXISTS "Profiles owner insert" ON public.profiles;
DROP POLICY IF EXISTS "Profiles owner update" ON public.profiles;

DROP POLICY IF EXISTS "Watchlist owner insert" ON public.watchlist;
DROP POLICY IF EXISTS "Watchlist owner delete" ON public.watchlist;

DROP POLICY IF EXISTS "Offers bidder insert" ON public.nft_offers;
DROP POLICY IF EXISTS "Offers bidder update" ON public.nft_offers;
DROP POLICY IF EXISTS "Offers bidder delete" ON public.nft_offers;

DROP POLICY IF EXISTS "Comments public insert" ON public.nft_comments;
DROP POLICY IF EXISTS "Comments author delete" ON public.nft_comments;

DROP POLICY IF EXISTS "Likes public insert" ON public.nft_likes;
DROP POLICY IF EXISTS "Likes owner delete" ON public.nft_likes;

DROP POLICY IF EXISTS "Notifications owner mark read" ON public.notifications;

-- Public read policies remain intact. All writes/deletes now require server fns.