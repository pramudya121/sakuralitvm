import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSiwe } from "./siwe-middleware";

const PostSchema = z.object({
  tokenId: z.union([z.number(), z.string()]).transform((v) => {
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0) throw new Error("Invalid tokenId");
    return n;
  }),
  content: z.string().trim().min(1).max(1000),
});

export const postComment = createServerFn({ method: "POST" })
  .middleware([requireSiwe])
  .inputValidator((input: unknown) => PostSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await supabaseAdmin.from("nft_comments").insert({
      token_id: data.tokenId,
      wallet_address: context.wallet,
      content: data.content,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const DeleteSchema = z.object({ id: z.string().uuid() });

export const deleteComment = createServerFn({ method: "POST" })
  .middleware([requireSiwe])
  .inputValidator((input: unknown) => DeleteSchema.parse(input))
  .handler(async ({ data, context }) => {
    // Verify the caller is the author before deleting.
    const { data: row, error: selErr } = await supabaseAdmin
      .from("nft_comments")
      .select("wallet_address")
      .eq("id", data.id)
      .maybeSingle();
    if (selErr) throw new Error(selErr.message);
    if (!row) throw new Error("Comment not found");
    if (row.wallet_address.toLowerCase() !== context.wallet) throw new Error("Not your comment");
    const { error } = await supabaseAdmin.from("nft_comments").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
