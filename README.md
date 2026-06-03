# 🌸 SakuraNFT — NFT Marketplace + DEX on LitVM

> A sakura-themed Web3 application built natively on the **LitVM LiteForge** testnet.
> NFT marketplace, Uniswap V2–style DEX, on-chain offers, AI-assisted minting,
> and a SIWE (Sign-In With Ethereum) identity layer — all in one delightful experience.

[![Live preview](https://img.shields.io/badge/Live-sakuralitvm.lovable.app-ec4899)](https://sakuralitvm.lovable.app)
[![Built with Lovable](https://img.shields.io/badge/Built%20with-Lovable-7c3aed)](https://lovable.dev)
[![Chain: LitVM LiteForge](https://img.shields.io/badge/Chain-LitVM%20LiteForge-22d3ee)](https://litvm.org)

---

## ✨ What is SakuraNFT?

SakuraNFT bundles four things that normally live in four different apps:

- **NFT Marketplace** — mint, list, buy, sell, and make offers paid in `zkLTC`.
- **Built-in DEX** — swap tokens and provide liquidity (Uniswap V2 fork).
- **AI Studio** — generate cover art and auto-write rich NFT descriptions from your image.
- **Social layer** — likes, comments, watchlists, notifications, leaderboards, and a live activity feed.

Everything privileged is gated by **Sign-In With Ethereum (SIWE)** — your identity is your wallet.
No email, no password, no third-party tracker.

---

## 🚀 Innovation

- **Vision-aware AI minting.** The Mint page passes the uploaded image to a vision-capable model so the AI writes a description of what is *actually* in the picture — not a generic template.
- **SIWE-gated server functions.** Every sensitive write (profile, watchlist, offers, comments, likes, notifications, storage uploads) flows through a SIWE-verified TanStack server function and writes to wallet-scoped paths to prevent cross-wallet overwrites.
- **Marketplace + DEX in one wallet flow.** The same `zkLTC` balance moves seamlessly between buying NFTs, swapping tokens, and providing liquidity — no bridging.
- **AI co-pilot.** A floating assistant explains the chain, helps price NFTs, and guides users through swap and add-liquidity flows.
- **Performance-first UX.** Routes preload on hover, the home hero paints instantly, and lists use skeleton shimmers instead of spinners.

---

## 🪙 Hard Money Web3 fit

**Hard Money on Web3** means assets whose supply, ownership, and transferability are enforced by code no single party can override. SakuraNFT honours this in every critical action:

- **Settlement is on-chain.** Buys, sales, offers, swaps, and liquidity moves all settle on LitVM through audited-pattern Solidity contracts (Marketplace, Offer, NFT Collection, Uniswap V2 Router / Factory / Pair, ERC-20).
- **Self-custody only.** The app never holds, escrows, or proxies user funds.
- **Identity is the key.** SIWE binds every privileged action to a freshly verified wallet signature. No password reset can ever take your account.
- **Off-chain data is a convenience, not authority.** Supabase holds reactions, comments, and notifications — never balances or ownership. Truth lives on-chain.

---

## 🌐 Contribution to the LitVM ecosystem

- A **reference dApp** showing how to wire up an NFT marketplace + AMM on LitVM end-to-end.
- **Real traffic** for LitVM validators, indexers, and explorers (mints, listings, sales, offers, swaps, add-liquidity).
- **Composable building blocks** — marketplace works with any ERC-721, DEX lists any ERC-20.
- An **onboarding ramp** — first-time users meet LitVM through art, not a confusing token launch.

---

## 🛡️ Technical quality

- **Modern stack** — TanStack Start (React 19, SSR, file-based routing), Vite 7, Tailwind v4, ethers v6, Supabase, Lovable AI Gateway.
- **Server-first secrets** — service-role keys live in `process.env` and are read only inside server functions; never bundled into the client.
- **Defense-in-depth auth** — SIWE middleware verifies a JWT bound to the wallet on every privileged server call. RLS policies act as a backstop.
- **EIP-4361 domain binding** — SIWE signatures must be issued for the request host (blocks phishing replay).
- **Wallet-scoped storage** — uploads go through a SIWE-gated server function that writes to `<verified_wallet>/<folder>/...`.
- **Validated inputs everywhere** — Zod schemas with length, format, and URL restrictions. Notification links are restricted to relative paths.

---

## 🎨 User experience

- **One-click wallet connect** — MetaMask, Rabby, OKX, Bitget. Chain auto-added if missing.
- **Sign once, browse for a month** — a single SIWE signature gives you a 30-day session.
- **Accessible by default** — semantic markup, focus states, ARIA labels, `prefers-reduced-motion` respected.
- **Mobile-friendly** — horizontally scrollable nav, touch-friendly buttons, responsive grids down to ~360px.
- **Helpful in the moment** — toasts, inline errors, network-mismatch warnings, an AI assistant.

---

## 🧱 Tech stack

| Layer | Technology |
| --- | --- |
| Framework | TanStack Start (React 19 + Vite 7) |
| Styling | Tailwind CSS v4, semantic OKLCH tokens |
| Web3 | ethers v6 |
| Auth | Sign-In With Ethereum (SIWE) + custom HS256 JWT |
| Backend | TanStack server functions + Supabase (Postgres + Storage) |
| AI | Lovable AI Gateway (Gemini + GPT models) |
| Hosting | Cloudflare Workers via Lovable Cloud |

---

## 🏁 Getting started

```bash
git clone <your-fork-url> sakuralitvm
cd sakuralitvm
bun install
bun run dev
```

Then visit <http://localhost:8080>.

You'll need:
- A supported wallet (MetaMask, Rabby, OKX, or Bitget).
- The **LitVM LiteForge** chain (auto-added the first time you connect).

---

## 📁 Project structure

```
src/
├── routes/              # File-based routes (TanStack Router)
├── components/          # Reusable UI components
├── contexts/            # React context providers (Wallet, Theme)
├── lib/
│   ├── web3/            # ethers, contracts, hooks, sync
│   ├── siwe.server.ts   # SIWE nonce + JWT issue/verify
│   ├── *.functions.ts   # TanStack server functions (RPC)
│   └── storage.functions.ts  # SIWE-gated wallet-scoped uploads
├── integrations/supabase/   # Generated Supabase clients
└── styles.css           # Tailwind v4 theme + design tokens
supabase/
└── migrations/          # SQL migrations
```

---

## 🔒 Security

- All privileged writes route through SIWE-verified server functions.
- The forgeable `x-wallet-address` header is **never** trusted.
- Storage uploads are wallet-scoped (`<verified_wallet>/<folder>/...`); direct client uploads to `nft-images` are denied.
- See [`mem://security-memory`](.lovable/plan.md) and the in-repo security memory for the full posture.

Found a vulnerability? Please open a private security advisory on GitHub.

---

## 📜 License

MIT — see [`LICENSE`](./LICENSE) if present.

---

Made with 🌸 on **LitVM LiteForge**.
