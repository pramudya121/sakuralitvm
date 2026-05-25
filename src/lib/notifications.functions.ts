import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const schema = z.object({
  to: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  type: z.string().min(1).max(64),
  title: z.string().min(1).max(200),
  message: z.string().max(1000).optional().nullable(),
  tokenId: z.union([z.number(), z.string()]).optional().nullable(),
  link: z.string().max(500).optional().nullable(),
});

export const pushNotificationServer = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => schema.parse(input))
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin.from("notifications").insert({
      wallet_address: data.to.toLowerCase(),
      type: data.type,
      title: data.title,
      message: data.message ?? null,
      token_id: data.tokenId !== undefined && data.tokenId !== null ? Number(data.tokenId) : null,
      link: data.link ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
