import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { MessageCircle, Send, X, Mic, MicOff, Volume2, VolumeX, Loader2, Sparkles, Bot, User, Trash2, Wrench, StopCircle } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { chatAgent } from "@/lib/ai-chat.functions";
import { TOKENS, type TokenInfo } from "@/lib/tokens";
import { CONTRACTS } from "@/lib/web3/contracts";
import {
  findBestRoute, getNativeBalance, getTokenBalance, getPairInfo, getMarketplaceFeeInfo,
  swapExactETHForTokens, swapExactTokensForETH, swapExactTokensForTokens,
  wrapNative, unwrapNative, sendToken,
} from "@/lib/web3/ethers";
import { formatEther, parseEther, isAddress, Contract } from "ethers";
import { readProvider } from "@/lib/web3/ethers";
import { MARKETPLACE_ABI } from "@/lib/web3/contracts";
import { useWallet } from "@/contexts/WalletContext";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type Msg = {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_call_id?: string;
  name?: string;
  // UI-only metadata (not sent to API):
  toolStatus?: { name: string; ok: boolean; summary: string }[];
};

const STORAGE_KEY = "sakura-ai-chat-v2";
const WELCOME: Msg = {
  role: "assistant",
  content: "Hi! I'm **Sakura** 🌸 — your on-chain AI agent.\n\nTry:\n- *swap 0.1 zkLTC to wzkLTC*\n- *what's my balance?*\n- *send 0.05 zkLTC to 0x...*\n- *show pool info for ETH*",
};

function getRecognizer(): any | null {
  if (typeof window === "undefined") return null;
  const W = window as any;
  const SR = W.SpeechRecognition ?? W.webkitSpeechRecognition;
  return SR ? new SR() : null;
}
const findToken = (sym: string): TokenInfo | null => TOKENS.find((t) => t.symbol.toLowerCase() === sym.trim().toLowerCase()) ?? null;
const resolveAddr = (t: TokenInfo): string => (t.address === "native" ? CONTRACTS.weth : t.address);

const QUICK_ACTIONS = [
  { label: "💰 My balance", text: "What's my balance?" },
  { label: "🔄 Swap quote", text: "Quote 0.1 zkLTC to wzkLTC" },
  { label: "📊 Pool ETH/wzkLTC", text: "Show pool info for ETH" },
  { label: "🛍️ Marketplace", text: "How many NFTs are listed?" },
];

export function AIChatWidget() {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>(() => {
    if (typeof window === "undefined") return [WELCOME];
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Msg[];
        if (Array.isArray(parsed) && parsed.length) return parsed;
      }
    } catch {}
    return [WELCOME];
  });
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [voiceOut, setVoiceOut] = useState(true);
  const [toolRunning, setToolRunning] = useState<string | null>(null);
  const callChat = useServerFn(chatAgent);
  const navigate = useNavigate();
  const { signer, address } = useWallet();
  const recRef = useRef<any>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Detect user's language from last user msg (for TTS)
  const userLang = useMemo(() => {
    const last = [...msgs].reverse().find((m) => m.role === "user")?.content ?? "";
    // crude: Indonesian markers vs default
    if (/\b(saya|kamu|bagaimana|tolong|berapa|halo|terima kasih)\b/i.test(last)) return "id-ID";
    return navigator.language || "en-US";
  }, [msgs]);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(msgs.slice(-40))); } catch {}
  }, [msgs]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs, busy, toolRunning]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100);
  }, [open]);

  function toggleMic() {
    if (listening) { recRef.current?.stop(); setListening(false); return; }
    const r = getRecognizer();
    if (!r) return toast.error("Voice input not supported in this browser");
    r.continuous = false; r.interimResults = false;
    r.lang = userLang;
    r.onresult = (e: any) => { setInput(e.results[0][0].transcript); setListening(false); };
    r.onerror = () => setListening(false);
    r.onend = () => setListening(false);
    recRef.current = r;
    try { r.start(); setListening(true); } catch { setListening(false); }
  }

  function speak(text: string) {
    if (!voiceOut || typeof window === "undefined" || !("speechSynthesis" in window)) return;
    try {
      window.speechSynthesis.cancel();
      // strip markdown for TTS
      const plain = text.replace(/[*_`#>~\-]+/g, " ").replace(/\[(.*?)\]\(.*?\)/g, "$1").slice(0, 600);
      const u = new SpeechSynthesisUtterance(plain);
      u.lang = userLang;
      u.rate = 1.05; u.pitch = 1.1;
      window.speechSynthesis.speak(u);
    } catch {}
  }

  function stop() {
    abortRef.current = true;
    setBusy(false);
    setToolRunning(null);
    try { window.speechSynthesis?.cancel(); } catch {}
  }

  function clearChat() {
    setMsgs([WELCOME]);
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
  }

  async function execTool(name: string, args: any): Promise<{ result: string; summary: string; ok: boolean }> {
    setToolRunning(name);
    try {
      if (name === "list_tokens") {
        const r = JSON.stringify(TOKENS.map((t) => ({ symbol: t.symbol, name: t.name, address: t.address })));
        return { result: r, summary: `${TOKENS.length} tokens listed`, ok: true };
      }
      if (name === "get_balances") {
        if (!address) return { result: JSON.stringify({ error: "Wallet not connected" }), summary: "Wallet not connected", ok: false };
        const results = await Promise.allSettled(TOKENS.map(async (t) => {
          const bal = t.address === "native"
            ? await getNativeBalance(address)
            : await getTokenBalance(t.address, address);
          return { symbol: t.symbol, balance: formatEther(bal) };
        }));
        const balances = results.map((r, i) => r.status === "fulfilled" ? r.value : { symbol: TOKENS[i].symbol, balance: "0" });
        const nonZero = balances.filter((b) => Number(b.balance) > 0);
        return { result: JSON.stringify(balances), summary: `${nonZero.length} non-zero balances`, ok: true };
      }
      if (name === "get_swap_quote") {
        const from = findToken(args.fromSymbol); const to = findToken(args.toSymbol);
        if (!from || !to) return { result: JSON.stringify({ error: "Unknown token" }), summary: "Unknown token", ok: false };
        const fromAddr = resolveAddr(from); const toAddr = resolveAddr(to);
        if (!isAddress(fromAddr) || !isAddress(toAddr)) return { result: JSON.stringify({ error: "Missing contract" }), summary: "No contract", ok: false };
        const amtIn = parseEther(String(args.amountIn));
        if (fromAddr.toLowerCase() === toAddr.toLowerCase()) {
          return { result: JSON.stringify({ amountOut: args.amountIn, route: [from.symbol, to.symbol], type: "wrap_or_unwrap" }), summary: `1:1 wrap/unwrap`, ok: true };
        }
        const best = await findBestRoute(amtIn, fromAddr, toAddr);
        if (!best) return { result: JSON.stringify({ error: "No liquidity route" }), summary: "No route", ok: false };
        const route = best.path.map((a) => TOKENS.find((t) => t.address !== "native" && t.address.toLowerCase() === a.toLowerCase())?.symbol ?? a.slice(0, 6));
        return {
          result: JSON.stringify({ amountOut: formatEther(best.out), hops: best.hops, route }),
          summary: `${args.amountIn} ${from.symbol} → ${Number(formatEther(best.out)).toFixed(6)} ${to.symbol}`,
          ok: true,
        };
      }
      if (name === "get_pool_info") {
        const t = findToken(args.symbol);
        if (!t || t.address === "native") return { result: JSON.stringify({ error: "Provide an ERC20 symbol" }), summary: "Bad symbol", ok: false };
        const info = await getPairInfo(t.address, CONTRACTS.weth);
        if (!info.pair) return { result: JSON.stringify({ error: "No pool" }), summary: "No pool found", ok: false };
        const r0 = formatEther(info.reserve0); const r1 = formatEther(info.reserve1);
        return {
          result: JSON.stringify({ pair: info.pair, reserves: { token0: info.token0, token1: info.token1, reserve0: r0, reserve1: r1 } }),
          summary: `Pool ${t.symbol}/wzkLTC found`,
          ok: true,
        };
      }
      if (name === "get_marketplace_stats") {
        const mp = new Contract(CONTRACTS.marketplace, MARKETPLACE_ABI, readProvider);
        const [count, fee] = await Promise.all([
          mp.listingCount().catch(() => 0n),
          getMarketplaceFeeInfo(),
        ]);
        return {
          result: JSON.stringify({ totalListings: Number(count), feePercent: fee.percent }),
          summary: `${Number(count)} listings, ${fee.percent}% fee`,
          ok: true,
        };
      }
      if (name === "propose_swap") {
        if (!signer || !address) return { result: JSON.stringify({ error: "Wallet not connected" }), summary: "Connect wallet first", ok: false };
        const from = findToken(args.fromSymbol); const to = findToken(args.toSymbol);
        if (!from || !to) return { result: JSON.stringify({ error: "Unknown token" }), summary: "Unknown token", ok: false };
        const slippage = Number(args.slippagePct ?? 0.5);
        const amtIn = parseEther(String(args.amountIn));
        const fromAddr = resolveAddr(from); const toAddr = resolveAddr(to);
        const isWrap = from.address === "native" && toAddr.toLowerCase() === CONTRACTS.weth.toLowerCase();
        const isUnwrap = to.address === "native" && fromAddr.toLowerCase() === CONTRACTS.weth.toLowerCase();
        toast.loading("Confirm in wallet…", { id: "ai-swap" });
        if (isWrap) { await wrapNative(signer, String(args.amountIn)); toast.success("Wrapped ✓", { id: "ai-swap" }); return { result: JSON.stringify({ ok: true, action: "wrap" }), summary: `Wrapped ${args.amountIn} zkLTC`, ok: true }; }
        if (isUnwrap) { await unwrapNative(signer, String(args.amountIn)); toast.success("Unwrapped ✓", { id: "ai-swap" }); return { result: JSON.stringify({ ok: true, action: "unwrap" }), summary: `Unwrapped ${args.amountIn}`, ok: true }; }
        const best = await findBestRoute(amtIn, fromAddr, toAddr);
        if (!best) { toast.error("No route", { id: "ai-swap" }); return { result: JSON.stringify({ error: "No route" }), summary: "No route", ok: false }; }
        if (from.address === "native") await swapExactETHForTokens(signer, best.path[best.path.length - 1], String(args.amountIn), slippage);
        else if (to.address === "native") await swapExactTokensForETH(signer, from.address, amtIn, slippage);
        else await swapExactTokensForTokens(signer, amtIn, best.path, slippage);
        toast.success("Swap submitted ✓", { id: "ai-swap" });
        return { result: JSON.stringify({ ok: true, action: "swap" }), summary: `Swapped ${args.amountIn} ${from.symbol} → ${to.symbol}`, ok: true };
      }
      if (name === "propose_send") {
        if (!signer || !address) return { result: JSON.stringify({ error: "Wallet not connected" }), summary: "Connect wallet", ok: false };
        if (!isAddress(args.to)) return { result: JSON.stringify({ error: "Invalid recipient address" }), summary: "Bad address", ok: false };
        const t = findToken(args.symbol);
        if (!t) return { result: JSON.stringify({ error: "Unknown token" }), summary: "Unknown token", ok: false };
        toast.loading("Confirm send in wallet…", { id: "ai-send" });
        await sendToken(signer, t.address, args.to, String(args.amount));
        toast.success("Sent ✓", { id: "ai-send" });
        return { result: JSON.stringify({ ok: true }), summary: `Sent ${args.amount} ${t.symbol}`, ok: true };
      }
      if (name === "navigate") {
        navigate({ to: args.path });
        return { result: JSON.stringify({ ok: true }), summary: `Navigated to ${args.path}`, ok: true };
      }
      return { result: JSON.stringify({ error: "Unknown tool" }), summary: "Unknown tool", ok: false };
    } catch (e: any) {
      const m = e?.shortMessage ?? e?.message ?? "Tool failed";
      toast.error(m, { id: "ai-swap" });
      return { result: JSON.stringify({ error: m }), summary: m.slice(0, 60), ok: false };
    } finally {
      setToolRunning(null);
    }
  }

  async function send(userText: string) {
    const txt = userText.trim();
    if (!txt || busy) return;
    abortRef.current = false;
    const newMsgs: Msg[] = [...msgs, { role: "user", content: txt }];
    setMsgs(newMsgs); setInput(""); setBusy(true);

    try {
      let working: Msg[] = newMsgs;
      let lastToolStatus: { name: string; ok: boolean; summary: string }[] = [];
      for (let round = 0; round < 4; round++) {
        if (abortRef.current) break;
        const apiMsgs = working.map((m) => ({
          role: m.role, content: m.content,
          ...(m.tool_call_id ? { tool_call_id: m.tool_call_id } : {}),
          ...(m.name ? { name: m.name } : {}),
        }));
        const res = await callChat({ data: { messages: apiMsgs as any } });
        if (abortRef.current) break;
        if ("error" in res && res.error) {
          setMsgs((p) => [...p, { role: "assistant", content: `⚠️ ${res.error}` }]);
          break;
        }
        const { content, toolCalls } = res as { content: string; toolCalls: any[] };
        if (toolCalls && toolCalls.length > 0) {
          if (content) working = [...working, { role: "assistant", content }];
          for (const tc of toolCalls) {
            if (abortRef.current) break;
            let parsed: any = {};
            try { parsed = JSON.parse(tc.function.arguments || "{}"); } catch {}
            const { result, summary, ok } = await execTool(tc.function.name, parsed);
            lastToolStatus.push({ name: tc.function.name, ok, summary });
            working = [...working, { role: "tool", tool_call_id: tc.id, name: tc.function.name, content: result }];
          }
          continue;
        }
        if (content) {
          setMsgs((p) => [...p, { role: "assistant", content, toolStatus: lastToolStatus.length ? lastToolStatus : undefined }]);
          speak(content);
        }
        break;
      }
    } catch (e: any) {
      setMsgs((p) => [...p, { role: "assistant", content: `⚠️ ${e?.message ?? "Failed"}` }]);
    } finally {
      setBusy(false);
      setToolRunning(null);
    }
  }

  return (
    <>
      {!open && (
        <button onClick={() => setOpen(true)}
          className="fixed bottom-5 right-5 z-50 w-14 h-14 rounded-full bg-gradient-to-br from-fuchsia-500 to-pink-500 shadow-2xl flex items-center justify-center hover:scale-110 transition-transform ring-2 ring-white/20"
          aria-label="Open Sakura AI">
          <Sparkles className="w-6 h-6 text-white" />
          <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full animate-pulse" />
        </button>
      )}

      {open && (
        <div className="fixed bottom-5 right-5 z-50 w-[400px] max-w-[calc(100vw-1.5rem)] h-[600px] max-h-[calc(100vh-2rem)] rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-white/10 bg-[#0c0718]">
          {/* Header */}
          <div className="px-4 py-3 flex items-center gap-2 bg-gradient-to-r from-fuchsia-600/40 to-pink-600/40 border-b border-white/10">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-fuchsia-500 to-pink-500 flex items-center justify-center ring-2 ring-white/20"><Bot className="w-5 h-5 text-white" /></div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold text-white">Sakura AI Agent</div>
              <div className="text-[10px] text-fuchsia-200/80 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                {address ? `Wallet: ${address.slice(0, 6)}…${address.slice(-4)}` : "Wallet not connected"}
              </div>
            </div>
            <button onClick={clearChat} className="w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center text-white/70" title="Clear chat"><Trash2 className="w-4 h-4" /></button>
            <button onClick={() => setVoiceOut((v) => !v)} className="w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center text-white/80" title={voiceOut ? "Mute voice" : "Unmute voice"}>
              {voiceOut ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>
            <button onClick={() => setOpen(false)} className="w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center text-white/80"><X className="w-4 h-4" /></button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
            {msgs.filter((m) => m.role === "user" || m.role === "assistant").map((m, i) => (
              <div key={i} className={`flex gap-2 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
                <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${m.role === "user" ? "bg-white/10" : "bg-gradient-to-br from-fuchsia-500 to-pink-500"}`}>
                  {m.role === "user" ? <User className="w-3.5 h-3.5 text-white" /> : <Bot className="w-3.5 h-3.5 text-white" />}
                </div>
                <div className={`px-3 py-2 rounded-2xl text-sm max-w-[82%] break-words ${m.role === "user" ? "bg-fuchsia-500/20 text-white rounded-tr-sm" : "bg-white/5 text-white/90 rounded-tl-sm"}`}>
                  {m.role === "assistant" ? (
                    <div className="text-sm leading-relaxed [&_p]:my-1 [&_ul]:my-1 [&_ul]:pl-4 [&_ul]:list-disc [&_ol]:my-1 [&_ol]:pl-4 [&_ol]:list-decimal [&_li]:my-0.5 [&_strong]:text-white [&_strong]:font-semibold [&_code]:bg-white/10 [&_code]:text-fuchsia-300 [&_code]:px-1 [&_code]:rounded [&_code]:text-xs [&_a]:text-fuchsia-300 [&_a]:underline [&_table]:my-2 [&_table]:text-xs [&_th]:px-2 [&_th]:py-1 [&_th]:bg-white/5 [&_td]:px-2 [&_td]:py-1 [&_td]:border-t [&_td]:border-white/5 [&_hr]:my-2 [&_hr]:border-white/10">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                    </div>
                  ) : (
                    <span className="whitespace-pre-wrap">{m.content}</span>
                  )}
                  {m.toolStatus && m.toolStatus.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-white/10 space-y-1">
                      {m.toolStatus.map((t, k) => (
                        <div key={k} className="flex items-center gap-1.5 text-[10px] text-white/60">
                          <Wrench className="w-3 h-3" />
                          <span className={t.ok ? "text-emerald-300" : "text-red-300"}>{t.name}</span>
                          <span className="truncate">— {t.summary}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {busy && (
              <div className="flex gap-2">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-fuchsia-500 to-pink-500 flex items-center justify-center"><Bot className="w-3.5 h-3.5 text-white" /></div>
                <div className="px-3 py-2 rounded-2xl bg-white/5 flex items-center gap-2 text-xs text-white/70">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-fuchsia-300" />
                  {toolRunning ? <span>Running <code className="text-fuchsia-300">{toolRunning}</code>…</span> : <span>Thinking…</span>}
                </div>
              </div>
            )}
          </div>

          {/* Quick actions (only when chat is fresh) */}
          {msgs.length <= 2 && !busy && (
            <div className="px-3 pb-2 flex flex-wrap gap-1.5">
              {QUICK_ACTIONS.map((q) => (
                <button key={q.label} onClick={() => send(q.text)}
                  className="text-[11px] px-2.5 py-1 rounded-full bg-white/5 hover:bg-white/10 text-white/80 border border-white/10">
                  {q.label}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="p-3 border-t border-white/10 bg-[#0c0718]">
            <div className="flex items-center gap-2 rounded-2xl bg-[#160c26] border border-white/10 px-2 py-1.5">
              <button onClick={toggleMic} disabled={busy}
                className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${listening ? "bg-red-500/30 text-red-300 animate-pulse" : "hover:bg-white/10 text-white/70"}`}
                title="Voice input">
                {listening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
                placeholder={listening ? "Listening…" : "Ask Sakura anything…"}
                disabled={busy}
                className="flex-1 bg-transparent outline-none text-sm text-white placeholder:text-white/40 min-w-0"
              />
              {busy ? (
                <Button onClick={stop} size="sm" variant="destructive" className="rounded-xl h-9 px-3" title="Stop">
                  <StopCircle className="w-4 h-4" />
                </Button>
              ) : (
                <Button onClick={() => send(input)} disabled={!input.trim()} size="sm" className="rounded-xl h-9 px-3 bg-gradient-to-r from-fuchsia-500 to-pink-500 border-0">
                  <Send className="w-4 h-4" />
                </Button>
              )}
            </div>
            <p className="text-[10px] text-white/40 text-center mt-1.5">8 tools · multilingual · voice in/out · Powered by Lovable AI</p>
          </div>
        </div>
      )}
    </>
  );
}
