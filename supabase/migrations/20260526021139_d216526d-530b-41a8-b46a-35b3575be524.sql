
-- 1) Realtime: tighten ELSE branch to deny by default
DROP POLICY IF EXISTS "Realtime notif owner only" ON realtime.messages;
CREATE POLICY "Realtime notif owner only"
ON realtime.messages
FOR SELECT
TO authenticated, anon
USING (
  CASE
    WHEN realtime.topic() LIKE 'notif-%' THEN
      lower(substring(realtime.topic() from 7)) =
      lower(COALESCE(((current_setting('request.headers', true))::json ->> 'x-wallet-address'), ''))
      AND lower(COALESCE(((current_setting('request.headers', true))::json ->> 'x-wallet-address'), '')) <> ''
    ELSE false
  END
);

-- 2) Watchlist: scope to wallet header
DROP POLICY IF EXISTS "Watchlist public delete" ON public.watchlist;
DROP POLICY IF EXISTS "Watchlist public insert" ON public.watchlist;
DROP POLICY IF EXISTS "Watchlist public read"  ON public.watchlist;

CREATE POLICY "Watchlist owner read" ON public.watchlist
FOR SELECT TO public
USING (
  wallet_address = lower(COALESCE(((current_setting('request.headers', true))::json ->> 'x-wallet-address'), ''))
  AND wallet_address <> ''
);

CREATE POLICY "Watchlist owner insert" ON public.watchlist
FOR INSERT TO public
WITH CHECK (
  wallet_address = lower(COALESCE(((current_setting('request.headers', true))::json ->> 'x-wallet-address'), ''))
  AND wallet_address <> ''
);

CREATE POLICY "Watchlist owner delete" ON public.watchlist
FOR DELETE TO public
USING (
  wallet_address = lower(COALESCE(((current_setting('request.headers', true))::json ->> 'x-wallet-address'), ''))
  AND wallet_address <> ''
);
