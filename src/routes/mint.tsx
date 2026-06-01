import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Upload, Sparkles, Wand2, ImagePlus, Plus, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useWallet } from "@/contexts/WalletContext";
import { mintNFT } from "@/lib/web3/ethers";
import { generateNFTDescription, generateNFTImage } from "@/lib/ai.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/mint")({
  component: Mint,
  head: () => ({
    meta: [
      { title: "Mint an NFT — SakuraNFT" },
      { name: "description", content: "Create and mint your own NFT on LitVM in minutes. Upload artwork or generate it with AI, add a description, and publish to the SakuraNFT marketplace." },
      { property: "og:title", content: "Mint an NFT — SakuraNFT" },
      { property: "og:description", content: "Mint NFTs on LitVM with AI-assisted artwork and descriptions." },
      { name: "twitter:title", content: "Mint an NFT — SakuraNFT" },
      { name: "twitter:description", content: "Mint NFTs on LitVM with AI-assisted artwork and descriptions." },
    ],
    links: [{ rel: "canonical", href: "https://sakura-bloom-forge.lovable.app/mint" }],
  }),
});

const CATEGORIES = ["Digital Art", "Photography", "Music", "Collectible", "Gaming", "PFP", "3D"];

function dataUrlToFile(dataUrl: string, filename: string): File {
  const [meta, b64] = dataUrl.split(",");
  const mime = /data:(.*?);base64/.exec(meta)?.[1] ?? "image/png";
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new File([arr], filename, { type: mime });
}

function Mint() {
  const { signer, address } = useWallet();
  const nav = useNavigate();
  const [mode, setMode] = useState<"upload" | "ai">("ai");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>("");
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [royalty, setRoyalty] = useState("0");
  const [category, setCategory] = useState("Digital Art");
  const [aiPrompt, setAiPrompt] = useState("");
  const [traits, setTraits] = useState<{ trait_type: string; value: string }[]>([]);
  const [collectionSlug, setCollectionSlug] = useState<string | null>(null);
  const [collectionName, setCollectionName] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [aiBusy, setAiBusy] = useState<"img" | "desc" | null>(null);

  const genDesc = useServerFn(generateNFTDescription);
  const genImg = useServerFn(generateNFTImage);

  function onFile(f: File | undefined) {
    if (!f) return;
    setFile(f);
    const r = new FileReader();
    r.onload = () => setPreview(r.result as string);
    r.readAsDataURL(f);
  }

  async function handleAIImage() {
    const prompt = aiPrompt || name;
    if (!prompt) return toast.error("Type a prompt or name first");
    setAiBusy("img");
    try {
      const { imageDataUrl } = await genImg({ data: { prompt: `${prompt} — ${category} style` } });
      setPreview(imageDataUrl);
      setFile(dataUrlToFile(imageDataUrl, `ai-${Date.now()}.png`));
      toast.success("Artwork generated!");
    } catch (e: any) {
      toast.error(e?.message ?? "AI image failed");
    } finally { setAiBusy(null); }
  }

  async function handleAIDesc() {
    if (!name) return toast.error("Enter NFT name first");
    setAiBusy("desc");
    try {
      const { description } = await genDesc({ data: { name, hint: aiPrompt || category } });
      setDesc(description);
      toast.success("Description ready!");
    } catch (e: any) {
      toast.error(e?.message ?? "AI failed");
    } finally { setAiBusy(null); }
  }

  function addTrait() { setTraits([...traits, { trait_type: "", value: "" }]); }
  function updateTrait(i: number, key: "trait_type" | "value", v: string) {
    const copy = [...traits]; copy[i] = { ...copy[i], [key]: v }; setTraits(copy);
  }
  function removeTrait(i: number) { setTraits(traits.filter((_, idx) => idx !== i)); }

  async function handleMint() {
    if (!signer) return toast.error("Connect wallet first");
    if (!file || !name) return toast.error("Artwork and name required");
    setBusy(true);
    try {
      const metaTraits = traits.filter((t) => t.trait_type && t.value);
      const extra = {
        category,
        collection: collectionSlug ? { slug: collectionSlug, name: collectionName } : null,
        royalty_bps: Math.floor(Math.max(0, Math.min(50, +royalty || 0)) * 100),
        attributes: metaTraits,
      };
      const receipt = await mintNFT(signer, file, name, desc, setStatus, extra);
      toast.success("NFT minted successfully!");
      console.log(receipt);
      setTimeout(() => nav({ to: "/profile" }), 1000);
    } catch (e: any) {
      toast.error(e?.shortMessage ?? e?.message ?? "Mint failed");
    } finally { setBusy(false); setStatus(""); }
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-4xl md:text-5xl font-bold gradient-text">Mint Your NFT</h1>
        <p className="text-muted-foreground mt-2 text-sm">Upload from your device — we handle storage & on-chain minting</p>
      </div>

      <div className="grid md:grid-cols-2 gap-5">
        {/* LEFT: Artwork */}
        <div className="form-panel rounded-3xl p-5 glow-card">
          <p className="text-sm font-semibold mb-3">Artwork</p>
          <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-background/40 border mb-4">
            <button onClick={() => setMode("upload")}
              className={`py-2.5 rounded-xl text-sm font-medium transition flex items-center justify-center gap-2 ${mode === "upload" ? "bg-gradient-to-r from-primary/30 to-accent/40 text-foreground shadow" : "text-muted-foreground"}`}>
              <Upload className="w-4 h-4" /> Upload
            </button>
            <button onClick={() => setMode("ai")}
              className={`py-2.5 rounded-xl text-sm font-medium transition flex items-center justify-center gap-2 ${mode === "ai" ? "bg-gradient-to-r from-primary to-accent text-primary-foreground shadow" : "text-muted-foreground"}`}>
              <Wand2 className="w-4 h-4" /> AI Generate
            </button>
          </div>

          <label className="block aspect-square rounded-2xl border border-dashed border-primary/40 cursor-pointer overflow-hidden bg-gradient-to-br from-background/60 to-accent/10 hover:border-primary transition">
            <input type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
            {preview ? (
              <img src={preview} alt="Preview" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground gap-2">
                {mode === "ai" ? (
                  <>
                    <div className="w-14 h-14 rounded-2xl bg-primary/15 flex items-center justify-center">
                      <Wand2 className="w-7 h-7 text-primary" />
                    </div>
                    <p className="text-sm">AI will create unique art for you</p>
                  </>
                ) : (
                  <>
                    <div className="w-14 h-14 rounded-2xl bg-primary/15 flex items-center justify-center">
                      <ImagePlus className="w-7 h-7 text-primary" />
                    </div>
                    <p className="text-sm">Click to upload an image</p>
                    <p className="text-xs">PNG, JPG, GIF up to 10MB</p>
                  </>
                )}
              </div>
            )}
          </label>

          {mode === "ai" && (
            <div className="mt-4 space-y-3">
              <Textarea rows={2} placeholder="e.g. A cherry blossom warrior fox in a moonlit forest, ethereal glow"
                value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)}
                className="bg-background/40 resize-none text-sm" />
              <div className="flex gap-2">
                <select value={category} onChange={(e) => setCategory(e.target.value)}
                  className="px-3 py-2 rounded-xl bg-background/60 border text-sm">
                  {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                </select>
                <Button onClick={handleAIImage} disabled={aiBusy !== null}
                  className="flex-1 rounded-xl bg-gradient-to-r from-primary to-accent text-primary-foreground">
                  {aiBusy === "img" ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating</> : <><Wand2 className="w-4 h-4 mr-2" /> Generate</>}
                </Button>
              </div>
              <p className="text-[11px] text-center text-muted-foreground">
                ✨ Powered by Lovable AI — uses your workspace AI credits
              </p>
            </div>
          )}
        </div>

        {/* RIGHT: Metadata */}
        <div className="form-panel rounded-3xl p-5 space-y-4">
          <div>
            <label className="text-sm font-medium">Name <span className="text-primary">*</span></label>
            <Input value={name} onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Winter Bloom #001" className="mt-1.5 bg-background/40" />
          </div>





          <div>
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Description</label>
              <Button type="button" size="sm" variant="ghost" className="h-7 text-xs"
                onClick={handleAIDesc} disabled={aiBusy !== null || !name}>
                <Wand2 className="w-3 h-3 mr-1" /> {aiBusy === "desc" ? "Writing..." : "AI write"}
              </Button>
            </div>
            <Textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={4}
              placeholder="Tell the story behind this artwork..." className="mt-1.5 bg-background/40 resize-none" />
          </div>

          <div>
            <label className="text-sm font-medium">Royalty (%)</label>
            <Input type="number" min="0" max="50" step="0.5" value={royalty}
              onChange={(e) => setRoyalty(e.target.value)} className="mt-1.5 bg-background/40" />
            <p className="text-[11px] text-muted-foreground mt-1">Suggested resale royalty stored in metadata.</p>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Attributes / Traits</label>
              <Button type="button" size="sm" variant="outline" className="h-7 text-xs rounded-full" onClick={addTrait}>
                <Plus className="w-3 h-3 mr-1" /> Add trait
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Add traits like "Background: Snow", "Rarity: Mythic". Boosts rarity score 🌸
            </p>
            {traits.length > 0 && (
              <div className="space-y-2 mt-2">
                {traits.map((t, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <Input placeholder="Trait" value={t.trait_type}
                      onChange={(e) => updateTrait(i, "trait_type", e.target.value)} className="bg-background/40" />
                    <Input placeholder="Value" value={t.value}
                      onChange={(e) => updateTrait(i, "value", e.target.value)} className="bg-background/40" />
                    <button onClick={() => removeTrait(i)} className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {status && (
            <div className="flex items-center gap-2 text-sm text-primary"><Sparkles className="w-4 h-4 animate-pulse" /> {status}</div>
          )}

          <Button size="lg" disabled={busy || !signer || !file || !name}
            onClick={handleMint}
            className="w-full rounded-xl bg-gradient-to-r from-primary to-accent text-primary-foreground shadow-lg h-12 text-base font-semibold">
            {busy ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Minting...</>
              : !signer ? <><Sparkles className="w-4 h-4 mr-2" /> Connect Wallet to Mint</>
              : <><Upload className="w-4 h-4 mr-2" /> Mint NFT</>}
          </Button>
          {address && <p className="text-[11px] text-center text-muted-foreground">Minting to <span className="font-mono">{address.slice(0,6)}…{address.slice(-4)}</span></p>}
        </div>
      </div>
    </div>
  );
}