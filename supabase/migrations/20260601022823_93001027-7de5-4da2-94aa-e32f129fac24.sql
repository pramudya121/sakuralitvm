-- Helper expression alias for current wallet header
-- (inlined; Postgres doesn't allow expression aliases at DB level)

-- ============ PROFILES ============
DROP POLICY IF EXISTS "Anyone can insert profile" ON public.profiles;
DROP POLICY IF EXISTS "Anyone can update profile" ON public.profiles;

CREATE POLICY "Profiles owner insert" ON public.profiles
FOR INSERT WITH CHECK (
  wallet_address = lower(COALESCE((current_setting('request.headers', true)::json ->> 'x-wallet-address'), ''))
  AND wallet_address <> ''
);

CREATE POLICY "Profiles owner update" ON public.profiles
FOR UPDATE USING (
  wallet_address = lower(COALESCE((current_setting('request.headers', true)::json ->> 'x-wallet-address'), ''))
  AND wallet_address <> ''
) WITH CHECK (
  wallet_address = lower(COALESCE((current_setting('request.headers', true)::json ->> 'x-wallet-address'), ''))
  AND wallet_address <> ''
);

-- ============ COMMENTS ============
DROP POLICY IF EXISTS "Comments public delete" ON public.nft_comments;
CREATE POLICY "Comments author delete" ON public.nft_comments
FOR DELETE USING (
  wallet_address = lower(COALESCE((current_setting('request.headers', true)::json ->> 'x-wallet-address'), ''))
  AND wallet_address <> ''
);

-- ============ LIKES ============
DROP POLICY IF EXISTS "Likes public delete" ON public.nft_likes;
CREATE POLICY "Likes owner delete" ON public.nft_likes
FOR DELETE USING (
  wallet_address = lower(COALESCE((current_setting('request.headers', true)::json ->> 'x-wallet-address'), ''))
  AND wallet_address <> ''
);

-- ============ OFFERS ============
DROP POLICY IF EXISTS "Offers public delete" ON public.nft_offers;
DROP POLICY IF EXISTS "Offers public update" ON public.nft_offers;
DROP POLICY IF EXISTS "Offers public insert" ON public.nft_offers;

CREATE POLICY "Offers bidder insert" ON public.nft_offers
FOR INSERT WITH CHECK (
  bidder_address ~ '^0x[a-f0-9]{40}$'
  AND bidder_address = lower(COALESCE((current_setting('request.headers', true)::json ->> 'x-wallet-address'), ''))
);

CREATE POLICY "Offers bidder update" ON public.nft_offers
FOR UPDATE USING (
  bidder_address = lower(COALESCE((current_setting('request.headers', true)::json ->> 'x-wallet-address'), ''))
  AND bidder_address <> ''
);

CREATE POLICY "Offers bidder delete" ON public.nft_offers
FOR DELETE USING (
  bidder_address = lower(COALESCE((current_setting('request.headers', true)::json ->> 'x-wallet-address'), ''))
  AND bidder_address <> ''
);

-- ============ NFT VIEWS ============
-- Remove direct public write access; all increments must go through the
-- SECURITY DEFINER function called from a server function with supabaseAdmin.
DROP POLICY IF EXISTS "Views public update" ON public.nft_views;
DROP POLICY IF EXISTS "Views public upsert" ON public.nft_views;

-- ============ REALTIME ============
-- Replace the policy with ELSE true → ELSE false so non-notif topics are denied.
DROP POLICY IF EXISTS "Realtime notifications scoped to wallet" ON realtime.messages;

CREATE POLICY "Realtime notifications scoped to wallet" ON realtime.messages
FOR SELECT TO anon, authenticated
USING (
  CASE
    WHEN realtime.topic() LIKE 'notif-%' THEN
      realtime.topic() = 'notif-' || lower(COALESCE(
        (current_setting('request.headers', true)::json ->> 'x-wallet-address'), ''
      ))
      AND lower(COALESCE(
        (current_setting('request.headers', true)::json ->> 'x-wallet-address'), ''
      )) <> ''
    ELSE false
  END
);

-- ============ STORAGE (nft-images bucket) ============
-- Add UPDATE / DELETE policies scoped to the uploader's wallet folder prefix.
CREATE POLICY "nft-images owner update" ON storage.objects
FOR UPDATE TO anon, authenticated
USING (
  bucket_id = 'nft-images'
  AND (storage.foldername(name))[1] = lower(COALESCE(
    (current_setting('request.headers', true)::json ->> 'x-wallet-address'), ''
  ))
  AND (storage.foldername(name))[1] <> ''
);

CREATE POLICY "nft-images owner delete" ON storage.objects
FOR DELETE TO anon, authenticated
USING (
  bucket_id = 'nft-images'
  AND (storage.foldername(name))[1] = lower(COALESCE(
    (current_setting('request.headers', true)::json ->> 'x-wallet-address'), ''
  ))
  AND (storage.foldername(name))[1] <> ''
);
