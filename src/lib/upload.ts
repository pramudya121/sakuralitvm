import { uploadNftImage } from "./storage.functions";

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

async function fileToBase64(file: File): Promise<string> {
  const buf = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < buf.length; i += chunk) {
    binary += String.fromCharCode.apply(null, Array.from(buf.subarray(i, i + chunk)) as unknown as number[]);
  }
  return btoa(binary);
}

export async function uploadImage(
  file: File,
  folder: "profile" | "banner" | "nft" | "mint" = "profile",
): Promise<string> {
  assertSafeImage(file);
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120) || "upload.bin";
  const dataBase64 = await fileToBase64(file);
  const { url } = await uploadNftImage({
    data: {
      folder,
      filename: safeName,
      contentType: file.type,
      dataBase64,
    },
  });
  return url;
}
