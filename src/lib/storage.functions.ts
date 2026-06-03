import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSiwe } from "./siwe-middleware";

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);
const ALLOWED_EXT = new Set(["jpg", "jpeg", "png", "gif", "webp"]);
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

const Schema = z.object({
  folder: z.enum(["profile", "banner", "nft", "mint"]),
  filename: z.string().min(1).max(120).regex(/^[a-zA-Z0-9._-]+$/),
  contentType: z.string().min(3).max(64),
  // base64-encoded file bytes
  dataBase64: z.string().min(8).max(Math.ceil(MAX_BYTES * 1.4)),
});

export const uploadNftImage = createServerFn({ method: "POST" })
  .middleware([requireSiwe])
  .inputValidator((input: unknown) => Schema.parse(input))
  .handler(async ({ data, context }) => {
    const wallet = context.wallet;
    if (!ALLOWED_MIME.has(data.contentType)) {
      throw new Error("Unsupported image type");
    }
    const ext = (data.filename.split(".").pop() || "").toLowerCase();
    if (!ALLOWED_EXT.has(ext)) throw new Error("Unsupported file extension");

    const bytes = Uint8Array.from(atob(data.dataBase64), (c) => c.charCodeAt(0));
    if (bytes.byteLength > MAX_BYTES) throw new Error("File too large (max 10 MB)");
    if (bytes.byteLength < 8) throw new Error("Empty file");

    const path = `${wallet}/${data.folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await supabaseAdmin.storage.from("nft-images").upload(path, bytes, {
      contentType: data.contentType,
      upsert: false,
    });
    if (error) throw new Error(error.message);
    const url = supabaseAdmin.storage.from("nft-images").getPublicUrl(path).data.publicUrl;
    return { url, path };
  });
