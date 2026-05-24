
-- 1. NOTIFICATIONS: stop exposing every user's notifications publicly.
-- Reads now require a header "x-wallet-address" matching the row, set by clients.
DROP POLICY IF EXISTS "Notif public read" ON public.notifications;
DROP POLICY IF EXISTS "Notif public insert" ON public.notifications;
DROP POLICY IF EXISTS "Notif public update" ON public.notifications;

CREATE POLICY "Notifications owner read"
ON public.notifications FOR SELECT
USING (
  wallet_address = lower(coalesce(
    current_setting('request.headers', true)::json->>'x-wallet-address',
    ''
  ))
  AND wallet_address <> ''
);

CREATE POLICY "Notifications owner mark read"
ON public.notifications FOR UPDATE
USING (
  wallet_address = lower(coalesce(
    current_setting('request.headers', true)::json->>'x-wallet-address',
    ''
  ))
  AND wallet_address <> ''
)
WITH CHECK (
  wallet_address = lower(coalesce(
    current_setting('request.headers', true)::json->>'x-wallet-address',
    ''
  ))
);

-- INSERT remains permissive (event listener writes from any connected client).
-- This is an accepted trade-off of wallet-based pseudo-auth; documented in security memory.
CREATE POLICY "Notifications insert any wallet"
ON public.notifications FOR INSERT
WITH CHECK (wallet_address ~ '^0x[a-f0-9]{40}$');

-- 2. COLLECTIONS METADATA: lock inserts to service role only.
DROP POLICY IF EXISTS "Collections public insert" ON public.collections_metadata;

-- 3. SECURITY DEFINER view counter: revoke from anon, keep authenticated/service.
REVOKE EXECUTE ON FUNCTION public.increment_nft_view(bigint) FROM anon;
