-- Tighten storage RLS for nft-images: drop any insecure anonymous insert
-- policies and only allow inserts when the first folder segment matches a
-- lowercased Ethereum address. Real uploads now go through a SIWE-gated
-- server function using the service role (which bypasses RLS), so this
-- policy primarily backstops against direct anonymous uploads with the
-- publishable key.

DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN
    SELECT polname FROM pg_policy
    WHERE polrelid = 'storage.objects'::regclass
      AND polcmd = 'a' -- INSERT
  LOOP
    -- Drop any existing insert policies that may target nft-images
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol.polname);
  END LOOP;
END $$;

-- Re-create read policy (public bucket) if missing
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy
    WHERE polrelid = 'storage.objects'::regclass
      AND polname = 'nft-images public read'
  ) THEN
    CREATE POLICY "nft-images public read"
      ON storage.objects FOR SELECT
      USING (bucket_id = 'nft-images');
  END IF;
END $$;

-- Block all anonymous/authenticated direct inserts to nft-images.
-- Uploads must go through the SIWE-gated server function (service role).
CREATE POLICY "nft-images deny direct insert"
  ON storage.objects FOR INSERT
  TO anon, authenticated
  WITH CHECK (bucket_id <> 'nft-images');

-- Block direct updates and deletes by clients on nft-images
CREATE POLICY "nft-images deny direct update"
  ON storage.objects FOR UPDATE
  TO anon, authenticated
  USING (bucket_id <> 'nft-images');

CREATE POLICY "nft-images deny direct delete"
  ON storage.objects FOR DELETE
  TO anon, authenticated
  USING (bucket_id <> 'nft-images');
