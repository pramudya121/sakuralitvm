import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSiwe } from "./siwe-middleware";

const PatchSchema = z.object({
  display_name: z.string().max(80).optional().nullable(),
  bio: z.string().max(500).optional().nullable(),
  avatar_url: z.string().url().max(2048).optional().nullable(),
  banner_url: z.string().url().max(2048).optional().nullable(),
  twitter: z.string().max(80).optional().nullable(),
  website: z.string().max(2048).optional().nullable(),
});

export const upsertProfile = createServerFn({ method: "POST" })
  .middleware([requireSiwe])
  .inputValidator((input: unknown) => PatchSchema.parse(input))
  .handler(async ({ data, context }) => {
    const wallet = context.wallet;
    const { data: row, error } = await supabaseAdmin
      .from("profiles")
      .upsert({ wallet_address: wallet, ...data }, { onConflict: "wallet_address" })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { profile: row };
  });
