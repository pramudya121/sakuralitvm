import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSiwe } from "./siwe-middleware";

const TokenIdSchema = z.object({
  tokenId: z.union([z.number(), z.string()]).transform((v) => {
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0) throw new Error("Invalid tokenId");
    return n;
  }),
});

export const toggleWatchlist = createServerFn({ method: "POST" })
  .middleware([requireSiwe])
  .inputValidator((input: unknown) => TokenIdSchema.parse(input))
  .handler(async ({ data, context }) => {
    const wallet = context.wallet;
    const { data: existing } = await supabaseAdmin
      .from("watchlist")
      .select("id")
      .eq("wallet_address", wallet)
      .eq("token_id", data.tokenId)
      .maybeSingle();
    if (existing) {
      await supabaseAdmin.from("watchlist").delete().eq("id", existing.id);
      return { watching: false };
    }
    const { error } = await supabaseAdmin.from("watchlist").insert({
      wallet_address: wallet,
      token_id: data.tokenId,
    });
    if (error) throw new Error(error.message);
    return { watching: true };
  });
