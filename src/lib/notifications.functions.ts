import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSiwe } from "./siwe-middleware";

const ETH = /^0x[a-fA-F0-9]{40}$/;

// Allowlist of notification types we emit from the client.
const ALLOWED_TYPES = new Set([
  "offer_made", "offer_accepted", "offer_cancelled",
  "sale", "purchase", "listing", "delisted",
  "bid_placed", "bid_accepted", "bid_cancelled",
  "comment", "like", "follow", "mint",
]);

const schema = z.object({
  to: z.string().regex(ETH),
  type: z.string().min(1).max(64).refine((t) => ALLOWED_TYPES.has(t), "Unsupported notification type"),
  title: z.string().min(1).max(200),
  message: z.string().max(1000).optional().nullable(),
  tokenId: z.union([z.number(), z.string()]).optional().nullable(),
  // Only relative app-internal paths are permitted to prevent the notification
  // system from being used as a phishing redirector.
  link: z.string().max(500).regex(/^\/[a-zA-Z0-9\-/_?#=&.]*$/, "Link must be a relative path").optional().nullable(),
});

export const pushNotificationServer = createServerFn({ method: "POST" })
  .middleware([requireSiwe])
  .inputValidator((input: unknown) => schema.parse(input))
  .handler(async ({ data, context }) => {
    // caller is verified by SIWE middleware
    const caller = context.wallet;

    // Rate limit: at most 30 notifications per RECIPIENT per minute.
    const sinceIso = new Date(Date.now() - 60_000).toISOString();
    const { count } = await supabaseAdmin
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("wallet_address", data.to.toLowerCase())
      .gte("created_at", sinceIso);
    if ((count ?? 0) > 30) {
      throw new Error("Rate limit exceeded");
    }

    const { error } = await supabaseAdmin.from("notifications").insert({
      wallet_address: data.to.toLowerCase(),
      type: data.type,
      title: data.title,
      message: data.message ?? null,
      token_id: data.tokenId !== undefined && data.tokenId !== null ? Number(data.tokenId) : null,
      link: data.link ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true, caller };
  });

export const markNotificationsRead = createServerFn({ method: "POST" })
  .middleware([requireSiwe])
  .handler(async ({ context }) => {
    const { error } = await supabaseAdmin
      .from("notifications")
      .update({ read: true })
      .eq("wallet_address", context.wallet)
      .eq("read", false);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
