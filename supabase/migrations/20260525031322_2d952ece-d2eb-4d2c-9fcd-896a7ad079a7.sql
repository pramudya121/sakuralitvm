
-- 1. Notifications: drop public INSERT policy; backend (service_role) only
DROP POLICY IF EXISTS "Notifications insert any wallet" ON public.notifications;

-- 2. Realtime: scope notification channel topics to the connected wallet
-- Channel topic format: notif-<wallet>
ALTER TABLE IF EXISTS realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Realtime notifications scoped to wallet" ON realtime.messages;
CREATE POLICY "Realtime notifications scoped to wallet"
ON realtime.messages
FOR SELECT
TO public
USING (
  -- Only allow subscriptions to notif-<wallet> when the header matches the topic suffix
  CASE
    WHEN realtime.topic() LIKE 'notif-%' THEN
      lower(substring(realtime.topic() from 7)) =
      lower(COALESCE((current_setting('request.headers', true)::json ->> 'x-wallet-address'), ''))
      AND COALESCE((current_setting('request.headers', true)::json ->> 'x-wallet-address'), '') <> ''
    ELSE true
  END
);

-- 3. Storage: restrict nft-images uploads to safe image MIME types
DROP POLICY IF EXISTS "Anyone can upload nft images" ON storage.objects;
CREATE POLICY "Anyone can upload nft images (safe mime)"
ON storage.objects
FOR INSERT
TO public
WITH CHECK (
  bucket_id = 'nft-images'
  AND lower(COALESCE((metadata ->> 'mimetype'), '')) IN (
    'image/jpeg', 'image/png', 'image/gif', 'image/webp'
  )
  AND lower(storage.extension(name)) IN ('jpg','jpeg','png','gif','webp')
);

-- 4. Re-revoke EXECUTE on SECURITY DEFINER helper to satisfy linter
REVOKE ALL ON FUNCTION public.increment_nft_view(bigint) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.increment_nft_view(bigint) FROM anon;
REVOKE ALL ON FUNCTION public.increment_nft_view(bigint) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.increment_nft_view(bigint) TO service_role;
