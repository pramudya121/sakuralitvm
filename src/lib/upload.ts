import { supabase } from "@/integrations/supabase/client";

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);
const ALLOWED_EXT = new Set(["jpg", "jpeg", "png", "gif", "webp"]);
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

export function assertSafeImage(file: File) {
  if (!ALLOWED_MIME.has(file.type)) {
    throw new Error(`Unsupported image type "${file.type}". Use JPG, PNG, GIF, or WEBP.`);
  }
  if (file.size > MAX_BYTES) {
    throw new Error(`File too large (max ${Math.floor(MAX_BYTES / 1024 / 1024)} MB).`);
  }
  const ext = (file.name.split(".").pop() || "").toLowerCase();
  if (!ALLOWED_EXT.has(ext)) {
    throw new Error(`Unsupported file extension ".${ext}".`);
  }
  return ext;
}

export async function uploadImage(file: File, folder = "profile"): Promise<string> {
  const ext = assertSafeImage(file);
  const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from("nft-images")
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw error;
  return supabase.storage.from("nft-images").getPublicUrl(path).data.publicUrl;
}
