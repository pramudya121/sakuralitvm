import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Outlet, createRootRouteWithContext, useRouter, HeadContent, Scripts, Link } from "@tanstack/react-router";
import appCss from "../styles.css?url";
import { WalletProvider } from "@/contexts/WalletContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { Toaster } from "@/components/ui/sonner";
import { Layout } from "@/components/Layout";

function NotFoundComponent() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="text-center glass p-10 rounded-3xl">
          <h1 className="text-7xl font-bold gradient-text">404</h1>
          <p className="mt-2 text-muted-foreground">This sakura blossom couldn't be found.</p>
          <Link to="/" className="mt-6 inline-block px-6 py-2 rounded-full bg-primary text-primary-foreground">Go Home</Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="text-center glass p-10 rounded-3xl max-w-md">
          <h1 className="text-2xl font-bold">Something went wrong</h1>
          <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
          <button onClick={() => { router.invalidate(); reset(); }} className="mt-6 px-6 py-2 rounded-full bg-primary text-primary-foreground">Try again</button>
        </div>
      </div>
    </div>
  );
}

const ROOT_OG_IMAGE = "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/57c72eff-3000-42c3-bdf2-263e276731a7/id-preview-582666b5--c4a6b64c-c4c1-4ecd-84a3-660c22e7930c.lovable.app-1779343261880.png";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "SakuraNFT — Winter Sakura NFT Marketplace & DEX on LitVM" },
      { name: "description", content: "Mint, trade NFTs and swap zkLTC on LitVM LiteForge Testnet with a magical winter sakura aesthetic." },
      { property: "og:site_name", content: "SakuraNFT" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
      { property: "og:image", content: ROOT_OG_IMAGE },
      { name: "twitter:image", content: ROOT_OG_IMAGE },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", type: "image/png", href: "/favicon.png" },
      { rel: "apple-touch-icon", href: "/favicon.png" },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "Organization",
              name: "SakuraNFT",
              url: "https://sakura-bloom-forge.lovable.app",
              logo: ROOT_OG_IMAGE,
            },
            {
              "@type": "WebSite",
              name: "SakuraNFT",
              url: "https://sakura-bloom-forge.lovable.app",
              potentialAction: {
                "@type": "SearchAction",
                target: "https://sakura-bloom-forge.lovable.app/marketplace?search={search_term_string}",
                "query-input": "required name=search_term_string",
              },
            },
          ],
        }),
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head><HeadContent /></head>
      <body>{children}<Scripts /></body>
    </html>
  );
}

function ScrollToTop() {
  const router = useRouter();
  const pathname = router.state.location.pathname;
  // Scroll to top on every route change for smooth UX
  if (typeof window !== "undefined") {
    queueMicrotask(() => window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior }));
  }
  // referencing pathname so React re-evaluates on nav
  void pathname;
  return null;
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <WalletProvider>
          <ScrollToTop />
          <Layout><Outlet /></Layout>
          <Toaster position="top-right" />
        </WalletProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
