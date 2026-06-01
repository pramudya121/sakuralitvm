import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSiwe } from "./siwe-middleware";

const LOVABLE_API_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

export const generateNFTDescription = createServerFn({ method: "POST" })
  .middleware([requireSiwe])
  .inputValidator((input) =>
    z.object({
      name: z.string().min(1).max(120),
      hint: z.string().max(500).optional(),
      imageDataUrl: z.string().max(20_000_000).optional(),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("AI not configured");

    const userParts: any[] = [];
    if (data.imageDataUrl) {
      userParts.push({ type: "image_url", image_url: { url: data.imageDataUrl } });
      userParts.push({ type: "text", text: `Write a concise, evocative NFT description (max 2 sentences, under 240 characters) for an NFT titled "${data.name}". Base the description on what you SEE in the image — colors, subject, mood, style. ${data.hint ? `Extra context: ${data.hint}.` : ""} No hashtags, no emojis.` });
    } else {
      userParts.push({ type: "text", text: `Write a concise, evocative NFT description (max 2 sentences, under 240 characters) for an NFT titled "${data.name}".${data.hint ? ` Theme/context: ${data.hint}.` : ""} No hashtags, no emojis.` });
    }

    const res = await fetch(LOVABLE_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You write evocative, concise NFT descriptions in English. Stay faithful to the user's subject and visual cues. Never force a specific theme (e.g. sakura) unless it's clearly present." },
          { role: "user", content: userParts },
        ],
      }),
    });
    if (res.status === 429) throw new Error("AI rate limit, try again shortly");
    if (res.status === 402) throw new Error("AI credits depleted");
    if (!res.ok) throw new Error(`AI error ${res.status}`);
    const json = await res.json();
    const text = json?.choices?.[0]?.message?.content?.trim() ?? "";
    return { description: text };
  });

export const generateNFTImage = createServerFn({ method: "POST" })
  .middleware([requireSiwe])
  .inputValidator((input) =>
    z.object({
      prompt: z.string().min(3).max(500),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("AI not configured");

    const res = await fetch(LOVABLE_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-image",
        messages: [
          { role: "user", content: `High quality detailed artwork: ${data.prompt}. Cinematic lighting, ultra detailed.` },
        ],
        modalities: ["image", "text"],
      }),
    });
    if (res.status === 429) throw new Error("AI rate limit, try again shortly");
    if (res.status === 402) throw new Error("AI credits depleted");
    if (!res.ok) throw new Error(`AI error ${res.status}`);
    const json = await res.json();
    const imageUrl: string | undefined = json?.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    if (!imageUrl) throw new Error("No image returned");
    return { imageDataUrl: imageUrl };
  });
