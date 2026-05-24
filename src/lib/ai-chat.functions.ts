import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const LOVABLE_API_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

const MessageSchema = z.object({
  role: z.enum(["system", "user", "assistant", "tool"]),
  content: z.string(),
  tool_call_id: z.string().optional(),
  name: z.string().optional(),
});

// Tools exposed to the AI. The CLIENT executes any tool that needs the user's
// signer (swap, send, wrap, add_liquidity). The server only formulates plans.
const TOOLS = [
  {
    type: "function",
    function: {
      name: "list_tokens",
      description: "List all supported tokens on Sakura DEX (symbol, name, address, decimals).",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "get_balances",
      description: "Get balances for the currently connected user across all supported tokens.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "get_swap_quote",
      description: "Get an estimated swap quote between two tokens on Sakura DEX. Returns amountOut, route hops.",
      parameters: {
        type: "object",
        properties: {
          fromSymbol: { type: "string", description: "Token symbol you pay with (e.g. zkLTC, wzkLTC, ETH)." },
          toSymbol: { type: "string", description: "Token symbol you want to receive." },
          amountIn: { type: "string", description: "Amount of fromSymbol as a decimal string, e.g. '1.5'." },
        },
        required: ["fromSymbol", "toSymbol", "amountIn"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "propose_swap",
      description: "Open the user's wallet to confirm a swap. Use AFTER get_swap_quote shows acceptable output.",
      parameters: {
        type: "object",
        properties: {
          fromSymbol: { type: "string" },
          toSymbol: { type: "string" },
          amountIn: { type: "string" },
          slippagePct: { type: "number", description: "Slippage tolerance percent, default 0.5" },
        },
        required: ["fromSymbol", "toSymbol", "amountIn"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "propose_send",
      description: "Open the user's wallet to confirm sending a token to another address.",
      parameters: {
        type: "object",
        properties: {
          symbol: { type: "string", description: "Token symbol to send (zkLTC, wzkLTC, ETH, ...)." },
          to: { type: "string", description: "Recipient 0x address." },
          amount: { type: "string", description: "Decimal string amount, e.g. '0.5'." },
        },
        required: ["symbol", "to", "amount"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_pool_info",
      description: "Get DEX pool reserves and TVL for a token vs wzkLTC.",
      parameters: {
        type: "object",
        properties: { symbol: { type: "string", description: "Token symbol paired with wzkLTC." } },
        required: ["symbol"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_marketplace_stats",
      description: "Return total listings count and marketplace fee on Sakura NFT marketplace.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "navigate",
      description: "Navigate the user to an app page.",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            enum: ["/", "/marketplace", "/mint", "/collections", "/dex/swap", "/dex/liquidity", "/activity", "/profile", "/analytics", "/leaderboard", "/watchlist"],
          },
        },
        required: ["path"],
        additionalProperties: false,
      },
    },
  },
];

const SYSTEM_PROMPT = `You are Sakura 🌸, the AI agent for SakuraNFT — an NFT marketplace + DEX on LitVM chain (native coin: zkLTC, wrapped: wzkLTC).

CAPABILITIES (use tools when needed):
- Answer platform questions: minting NFTs, listing, buying, swapping, wrapping, liquidity, analytics.
- For SWAPS: call get_swap_quote → show estimate → call propose_swap (user confirms in wallet).
- For SENDS: call propose_send to open the wallet send dialog.
- For BALANCES: call get_balances. For POOL info: call get_pool_info. For listings stats: get_marketplace_stats.
- For navigation: call navigate with one of the allowed paths.

RULES:
- ALWAYS reply in the SAME language the user wrote in (Indonesian, English, etc.). Auto-detect.
- Use short markdown — lists, **bold**, tables when helpful. No long paragraphs.
- Never invent token addresses; only use those returned by list_tokens.
- If wallet is not connected, ask the user to connect before proposing swap/send.
- Wrap = zkLTC→wzkLTC (1:1), Unwrap = wzkLTC→zkLTC (1:1). No fee.
- Confirm risky actions (swap/send) briefly before calling the propose_* tool.`;

export const chatAgent = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({
      messages: z.array(MessageSchema).min(1).max(60),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("AI not configured");

    // Require a connected wallet — blocks anonymous abuse of paid AI credits.
    const { getRequestHeader } = await import("@tanstack/react-start/server");
    const wallet = (getRequestHeader("x-wallet-address") ?? "").toLowerCase();
    if (!/^0x[a-f0-9]{40}$/.test(wallet)) {
      return { error: "Connect your wallet to use the AI assistant." as const };
    }


    const res = await fetch(LOVABLE_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "system", content: SYSTEM_PROMPT }, ...data.messages],
        tools: TOOLS,
        tool_choice: "auto",
      }),
    });

    if (res.status === 429) return { error: "Rate limit. Try again in a moment." as const };
    if (res.status === 402) return { error: "AI credits depleted. Top up to continue." as const };
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      return { error: `AI error ${res.status}: ${t.slice(0, 200)}` as const };
    }

    const json = await res.json();
    const choice = json?.choices?.[0]?.message ?? {};
    return {
      content: (choice.content ?? "") as string,
      toolCalls: (choice.tool_calls ?? []) as Array<{
        id: string;
        type: "function";
        function: { name: string; arguments: string };
      }>,
    };
  });
