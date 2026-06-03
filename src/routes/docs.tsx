import { createFileRoute, Link } from "@tanstack/react-router";
import {
  BookOpen, Sparkles, Coins, Shield, Zap, Layers, Code2, Heart, ArrowRight, Github,
  Wallet, Image as ImageIcon, Repeat, MessageSquare, Trophy, Activity,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { CHAIN } from "@/lib/web3/contracts";

export const Route = createFileRoute("/docs")({
  component: DocsPage,
  head: () => ({
    meta: [
      { title: "Documentation — SakuraNFT on LitVM" },
      { name: "description", content: "Learn what SakuraNFT is, the innovation it brings to the LitVM ecosystem, how it embraces Hard Money Web3, and why it ships a delightful, secure user experience." },
      { property: "og:title", content: "Documentation — SakuraNFT on LitVM" },
      { property: "og:description", content: "Concept, innovation, Hard Money fit, technical quality, and UX of SakuraNFT." },
    ],
  }),
});

function Section({
  id, icon: Icon, title, subtitle, children,
}: { id: string; icon: any; title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24">
      <div className="flex items-start gap-3 mb-4">
        <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shrink-0 shadow-lg">
          <Icon className="w-5 h-5 text-primary-foreground" />
        </div>
        <div>
          <h2 className="text-2xl md:text-3xl font-bold">{title}</h2>
          {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
        </div>
      </div>
      <div className="form-panel rounded-2xl p-6 md:p-8 leading-relaxed text-[15px] space-y-4">
        {children}
      </div>
    </section>
  );
}

function DocsPage() {
  const toc = [
    { id: "what-is", label: "What is SakuraNFT?", icon: Sparkles },
    { id: "innovation", label: "Innovation", icon: Zap },
    { id: "real-problem", label: "Real problem solved", icon: Heart },
    { id: "hard-money", label: "Hard Money Web3 fit", icon: Coins },
    { id: "ecosystem", label: "Contribution to LitVM", icon: Layers },
    { id: "technical", label: "Technical quality", icon: Code2 },
    { id: "ux", label: "User experience (UX)", icon: Shield },
    { id: "getting-started", label: "Getting started", icon: Wallet },
  ];

  return (
    <div className="grid lg:grid-cols-[260px_1fr] gap-8 max-w-6xl mx-auto">
      {/* Table of contents */}
      <aside className="hidden lg:block">
        <div className="sticky top-24 form-panel rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3 text-sm font-semibold">
            <BookOpen className="w-4 h-4 text-primary" /> Contents
          </div>
          <nav className="space-y-1">
            {toc.map((t) => {
              const Icon = t.icon;
              return (
                <a
                  key={t.id}
                  href={`#${t.id}`}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm text-muted-foreground hover:text-primary hover:bg-accent/40 transition"
                >
                  <Icon className="w-3.5 h-3.5" />
                  {t.label}
                </a>
              );
            })}
          </nav>
        </div>
      </aside>

      <div className="space-y-10">
        {/* Hero */}
        <header className="form-panel rounded-3xl p-8 md:p-10 relative overflow-hidden">
          <div aria-hidden className="absolute -top-20 -right-20 w-72 h-72 rounded-full bg-gradient-to-br from-pink-400/30 to-fuchsia-500/20 blur-3xl" />
          <div aria-hidden className="absolute -bottom-20 -left-20 w-72 h-72 rounded-full bg-gradient-to-br from-purple-400/20 to-sky-400/15 blur-3xl" />
          <div className="relative">
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-4">
              <Sparkles className="w-3.5 h-3.5" /> Documentation
            </span>
            <h1 className="text-4xl md:text-5xl font-bold gradient-text leading-tight">
              SakuraNFT — a sakura-themed NFT marketplace &amp; DEX on LitVM
            </h1>
            <p className="text-muted-foreground mt-4 max-w-2xl">
              SakuraNFT is a Web3 application built natively on the LitVM
              LiteForge testnet. It combines an NFT marketplace, a Uniswap
              V2–style DEX, on-chain offers, AI-assisted minting, and a SIWE
              (Sign-In With Ethereum) identity layer in a single delightful
              experience powered by ${CHAIN.symbol}.
            </p>
            <div className="flex flex-wrap gap-2 mt-6">
              <Button asChild className="rounded-full bg-gradient-to-r from-primary to-accent text-primary-foreground border-0">
                <Link to="/marketplace">Open Marketplace <ArrowRight className="w-4 h-4 ml-2" /></Link>
              </Button>
              <Button asChild variant="outline" className="rounded-full">
                <Link to="/mint">Mint an NFT</Link>
              </Button>
              <Button asChild variant="outline" className="rounded-full">
                <a href="https://github.com" target="_blank" rel="noreferrer">
                  <Github className="w-4 h-4 mr-2" /> View source
                </a>
              </Button>
            </div>
          </div>
        </header>

        <Section id="what-is" icon={Sparkles} title="What is SakuraNFT?" subtitle="The 60-second overview">
          <p>
            <strong>SakuraNFT</strong> is a full-stack Web3 product that lives
            entirely on the <strong>{CHAIN.name}</strong> chain (ID {CHAIN.id}).
            It bundles four things that usually live in four different apps:
          </p>
          <ul className="list-disc pl-6 space-y-1">
            <li><strong>NFT Marketplace</strong> — mint, list, buy, sell, and make offers on NFTs paid in ${CHAIN.symbol}.</li>
            <li><strong>Built-in DEX</strong> — swap tokens and provide liquidity using a Uniswap V2 fork.</li>
            <li><strong>AI Studio</strong> — generate cover art and auto-write rich NFT descriptions from your image.</li>
            <li><strong>Social layer</strong> — likes, comments, watchlists, notifications, and a global leaderboard.</li>
          </ul>
          <p>
            Everything is gated by <strong>Sign-In With Ethereum (SIWE)</strong>,
            so identity is your wallet — no email, no password, no third-party
            tracker.
          </p>
        </Section>

        <Section id="innovation" icon={Zap} title="Innovation" subtitle="What makes SakuraNFT genuinely new">
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <strong>Vision-aware AI minting.</strong> The Mint page passes the
              uploaded image to a vision-capable model so the AI writes a
              description of what is actually in the picture — not a generic
              "beautiful artwork" template.
            </li>
            <li>
              <strong>SIWE-gated server functions.</strong> Sensitive writes
              (profile, watchlist, offers, comments, likes, notifications,
              storage uploads) all flow through SIWE-verified TanStack server
              functions, with wallet-scoped storage folders to prevent
              cross-wallet overwrites.
            </li>
            <li>
              <strong>Marketplace + DEX in one wallet flow.</strong> The same
              ${CHAIN.symbol} balance moves seamlessly between buying NFTs,
              swapping tokens, and providing liquidity — no bridging, no
              context switching.
            </li>
            <li>
              <strong>AI co-pilot (chat).</strong> A floating assistant explains
              the chain, helps users price NFTs, and can guide them through
              swap and liquidity flows.
            </li>
            <li>
              <strong>Performance-first UX.</strong> Routes preload on hover,
              the home hero paints instantly, and every list view ships a
              skeleton shimmer instead of a spinner.
            </li>
          </ul>
        </Section>

        <Section id="real-problem" icon={Heart} title="Does this solve a real problem creatively?">
          <p>
            Most testnets struggle with empty-marketplace syndrome: users
            connect, see nothing, and bounce. SakuraNFT attacks that on three
            fronts:
          </p>
          <ol className="list-decimal pl-6 space-y-2">
            <li>
              <strong>Zero-friction creation.</strong> A new user can land,
              connect a wallet, generate an image with AI, auto-write a
              description, and mint their first NFT in under a minute.
            </li>
            <li>
              <strong>Reasons to come back.</strong> Likes, comments,
              watchlists, notifications, and a leaderboard turn one-off mints
              into a living community.
            </li>
            <li>
              <strong>Liquidity in the same surface.</strong> Because the DEX
              is built in, the same testnet wallet that mints art can also
              provide liquidity and earn — keeping users on-chain instead of
              redirecting to external dApps.
            </li>
          </ol>
        </Section>

        <Section id="hard-money" icon={Coins} title="Hard Money Web3 fit">
          <p>
            <strong>Hard Money</strong> on Web3 means assets whose supply,
            ownership, and transferability are enforced by code that no
            single party can override. SakuraNFT honours this in every
            critical action:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <strong>Settlement is on-chain.</strong> Buys, sales, offers,
              swaps, and liquidity moves all settle in ${CHAIN.symbol} through
              audited-pattern Solidity contracts (Marketplace, Offer, NFT
              Collection, Uniswap V2 Router/Factory/Pair, ERC-20).
            </li>
            <li>
              <strong>Self-custody only.</strong> The app never holds, escrows,
              or proxies user funds. Withdrawals do not exist — funds simply
              live in the user's wallet.
            </li>
            <li>
              <strong>Identity is the key.</strong> SIWE binds every privileged
              action to a freshly verified signature from the user's wallet.
              No password reset can ever take your account.
            </li>
            <li>
              <strong>Off-chain data is a convenience, not authority.</strong>
              The Supabase layer holds reactions, comments, and notifications
              — never balances or ownership. Truth lives on-chain.
            </li>
          </ul>
        </Section>

        <Section id="ecosystem" icon={Layers} title="Meaningful contribution to the LitVM ecosystem">
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <strong>A reference dApp.</strong> SakuraNFT shows how to wire
              up an NFT marketplace + AMM on LitVM, end-to-end, including
              event indexing, wallet auth, and AI features — a template for
              the next wave of LitVM builders.
            </li>
            <li>
              <strong>Activity for the chain.</strong> Mints, listings, sales,
              offers, swaps, and add-liquidity transactions all hit LitVM
              blocks — giving validators, indexers, and explorers real
              traffic to test against.
            </li>
            <li>
              <strong>Composable building blocks.</strong> The marketplace
              works with any ERC-721 deployed on LitVM. The DEX can list any
              ERC-20. Other projects can integrate by pointing at the same
              contracts.
            </li>
            <li>
              <strong>Onboarding ramp.</strong> First-time users meet LitVM
              through art, not through a confusing token launch. That lowers
              the barrier for the whole ecosystem.
            </li>
          </ul>
        </Section>

        <Section id="technical" icon={Code2} title="Technical quality" subtitle="Well written, secure, and functional">
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <strong>Modern stack.</strong> TanStack Start (React 19, SSR,
              file-based routing), Vite 7, Tailwind v4, ethers v6, Supabase as
              the off-chain data layer, and Lovable AI Gateway for AI calls.
            </li>
            <li>
              <strong>Server-first secrets.</strong> Service-role keys live in
              <code className="px-1.5 py-0.5 rounded bg-muted text-foreground mx-1">process.env</code>
              and are read only inside server functions — never bundled into
              client code.
            </li>
            <li>
              <strong>Defense-in-depth auth.</strong> SIWE middleware verifies
              a JWT bound to the wallet on every privileged server call. RLS
              policies on Supabase tables act as a backstop, and direct
              client writes to sensitive tables are blocked.
            </li>
            <li>
              <strong>EIP-4361 domain binding.</strong> SIWE signatures must be
              issued for the request host, blocking phishing replay attacks.
            </li>
            <li>
              <strong>Wallet-scoped storage.</strong> Uploads to the
              <code className="px-1.5 py-0.5 rounded bg-muted text-foreground mx-1">nft-images</code>
              bucket are routed through a SIWE-gated server function that
              writes to <code>&lt;verified_wallet&gt;/&lt;folder&gt;/…</code>,
              so users cannot overwrite each other's files.
            </li>
            <li>
              <strong>Validated inputs everywhere.</strong> Every server
              function uses Zod schemas with length, format, and URL
              restrictions — including notification links that must be
              relative paths to prevent phishing redirects.
            </li>
            <li>
              <strong>Production-ready performance.</strong> Routes preload on
              hover, queries are cached with TanStack Query, the hero
              renders without a heavy image download, and lists use skeleton
              shimmers.
            </li>
          </ul>
        </Section>

        <Section id="ux" icon={Shield} title="User experience (UX)" subtitle="Easy to access, easy to use">
          <ul className="list-disc pl-6 space-y-2">
            <li>
              <strong>One-click wallet connect.</strong> Pick from MetaMask,
              Rabby, OKX, or Bitget. The chain is auto-added if missing.
            </li>
            <li>
              <strong>Sign once, browse for a month.</strong> A single SIWE
              signature gives you a 30-day session — no more confirmation
              popups for every read.
            </li>
            <li>
              <strong>Accessible by default.</strong> All interactive elements
              ship semantic markup, focus states, and ARIA labels. Animations
              respect <code>prefers-reduced-motion</code>.
            </li>
            <li>
              <strong>Mobile-friendly.</strong> A horizontally scrollable nav,
              touch-friendly buttons, and responsive grids work down to ~360px.
            </li>
            <li>
              <strong>Helpful in the moment.</strong> Toasts, inline errors,
              network-mismatch warnings, and an AI assistant make recovering
              from confusion fast.
            </li>
          </ul>
        </Section>

        <Section id="getting-started" icon={Wallet} title="Getting started">
          <ol className="list-decimal pl-6 space-y-2">
            <li>Install a supported wallet: MetaMask, Rabby, OKX, or Bitget.</li>
            <li>Click <strong>Connect Wallet</strong> in the top right and approve the chain switch to <strong>{CHAIN.name}</strong>.</li>
            <li>Sign the one-time SIWE message (free, no gas).</li>
            <li>Visit <Link to="/mint" className="text-primary underline">Mint</Link> to create your first NFT, or <Link to="/marketplace" className="text-primary underline">Marketplace</Link> to browse.</li>
            <li>Try the <Link to="/dex" className="text-primary underline">DEX</Link> for swaps and liquidity, or open <Link to="/activity" className="text-primary underline">Activity</Link> to follow the chain live.</li>
          </ol>
          <div className="grid sm:grid-cols-2 gap-3 pt-2">
            {[
              { to: "/marketplace", icon: ImageIcon, label: "Marketplace" },
              { to: "/mint", icon: Sparkles, label: "Mint" },
              { to: "/dex", icon: Repeat, label: "DEX" },
              { to: "/activity", icon: Activity, label: "Activity" },
              { to: "/leaderboard", icon: Trophy, label: "Leaderboard" },
              { to: "/profile", icon: MessageSquare, label: "Profile" },
            ].map((q) => {
              const Icon = q.icon;
              return (
                <Link
                  key={q.to}
                  to={q.to}
                  className="flex items-center gap-3 p-3 rounded-xl border border-border bg-background/40 hover:border-primary hover:bg-accent/30 transition"
                >
                  <Icon className="w-4 h-4 text-primary" />
                  <span className="font-medium">{q.label}</span>
                  <ArrowRight className="w-4 h-4 ml-auto text-muted-foreground" />
                </Link>
              );
            })}
          </div>
        </Section>
      </div>
    </div>
  );
}
