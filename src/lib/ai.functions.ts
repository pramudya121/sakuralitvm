import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const LOVABLE_API_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

export const generateNFTDescription = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({
      name: z.string().min(1).max(120),
      hint: z.string().max(500).optional(),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("AI not configured");
    const { getRequestHeader } = await import("@tanstack/react-start/server");
    const wallet = (getRequestHeader("x-wallet-address") ?? "").toLowerCase();
    if (!/^0x[a-f0-9]{40}$/.test(wallet)) throw new Error("Connect your wallet to use AI features");


    const res = await fetch(LOVABLE_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You write evocative, poetic NFT descriptions in English (max 2 sentences, under 240 characters). Theme: winter sakura, snow, cherry blossoms, ethereal beauty. No hashtags, no emojis." },
          { role: "user", content: `NFT name: "${data.name}".${data.hint ? ` Extra context: ${data.hint}` : ""} Write the description.` },
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
          { role: "user", content: `Stunning 3D rendered NFT artwork, winter sakura theme: ${data.prompt}. Cinematic lighting, ultra detailed, pink cherry blossoms with snow, ethereal atmosphere.` },
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
