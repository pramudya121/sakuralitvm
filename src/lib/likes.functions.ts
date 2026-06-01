import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSiwe } from "./siwe-middleware";

const Schema = z.object({
  tokenId: z.union([z.number(), z.string()]).transform((v) => {
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0) throw new Error("Invalid tokenId");
    return n;
  }),
});

export const toggleLike = createServerFn({ method: "POST" })
  .middleware([requireSiwe])
  .inputValidator((input: unknown) => Schema.parse(input))
  .handler(async ({ data, context }) => {
    const wallet = context.wallet;
    const { data: existing } = await supabaseAdmin
      .from("nft_likes")
      .select("id")
      .eq("wallet_address", wallet)
      .eq("token_id", data.tokenId)
      .maybeSingle();
    if (existing) {
      await supabaseAdmin.from("nft_likes").delete().eq("id", existing.id);
      return { liked: false };
    }
    const { error } = await supabaseAdmin.from("nft_likes").insert({
      wallet_address: wallet,
      token_id: data.tokenId,
    });
    if (error) throw new Error(error.message);
    return { liked: true };
  });
