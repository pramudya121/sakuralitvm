import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Server-side view incrementer. The underlying nft_views table is no longer
// publicly writable from the client; all writes must go through this fn,
// which uses the SECURITY DEFINER `increment_nft_view` function.
export const incrementNftView = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({
      tokenId: z.union([z.number(), z.string()]).transform((v) => {
        const n = Number(v);
        if (!Number.isFinite(n) || n < 0 || n > Number.MAX_SAFE_INTEGER) {
          throw new Error("Invalid tokenId");
        }
        return n;
      }),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin.rpc("increment_nft_view", { p_token_id: data.tokenId });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
