import { Link, useRouterState } from "@tanstack/react-router";
import { SakuraBackground } from "./SakuraBackground";
import { WalletButton } from "./WalletButton";
import { NotificationBell } from "./NotificationBell";
import { OnChainEventListener } from "./OnChainEventListener";
import { ThemeToggle } from "./ThemeToggle";
import { Home, Store, Plus, Trophy, BarChart3, User, Heart, Repeat } from "lucide-react";
import sakuraLogo from "@/assets/sakura-logo.png";
import { AIChatWidget } from "./AIChatWidget";

const navItems = [
  { to: "/", label: "Home", icon: Home },
  { to: "/marketplace", label: "Market", icon: Store },
  { to: "/mint", label: "Mint", icon: Plus },
  { to: "/dex", label: "DEX", icon: Repeat },
  { to: "/leaderboard", label: "Leaders", icon: Trophy },
  { to: "/analytics", label: "Stats", icon: BarChart3 },
  { to: "/watchlist", label: "Watch", icon: Heart },
  { to: "/profile", label: "Profile", icon: User },
];



export function Layout({ children }: { children: React.ReactNode }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const isHome = path === "/";
  return (
    <div className="relative min-h-screen">
      {isHome && <SakuraBackground count={40} intense />}
      <OnChainEventListener />
      <div className="relative z-10">
        <header className="sticky top-0 z-50 glass border-b">
          <div className="container mx-auto px-4 h-16 flex items-center justify-between gap-3">
            <Link to="/" className="flex items-center gap-2 group shrink-0">
              <img src={sakuraLogo} alt="SakuraNFT" className="w-9 h-9 rounded-full shadow-lg group-hover:scale-110 transition-transform ring-1 ring-primary/40" />
              <span className="font-bold text-lg gradient-text hidden sm:inline">SakuraNFT</span>
            </Link>
            <nav className="hidden lg:flex items-center gap-0.5 flex-1 justify-center min-w-0">
              {navItems.map((n) => (
                <Link
                  key={n.to}
                  to={n.to}
                  className="px-2 py-1.5 rounded-full text-[12.5px] font-medium text-muted-foreground hover:text-primary hover:bg-accent/40 transition-all whitespace-nowrap"
                  activeProps={{ className: "px-2 py-1.5 rounded-full text-[12.5px] font-medium text-primary bg-accent/60 whitespace-nowrap" }}
                >
                  {n.label}
                </Link>
              ))}
            </nav>
            <div className="flex items-center gap-1.5 shrink-0">
              <ThemeToggle />
              <NotificationBell />
              <WalletButton />
            </div>
          </div>
          {/* tablet & mobile horizontally-scrollable nav */}
          <nav className="lg:hidden flex overflow-x-auto gap-1 px-3 pb-2 scrollbar-hide">

            {navItems.map((n) => {
              const Icon = n.icon;
              return (
                <Link key={n.to} to={n.to}
                  className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg text-xs text-muted-foreground shrink-0"
                  activeProps={{ className: "flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg text-xs text-primary bg-accent/60 shrink-0" }}
                >
                  <Icon className="w-4 h-4" />
                  {n.label}
                </Link>
              );
            })}
          </nav>
        </header>
        <main className="container mx-auto px-4 py-8 fade-in">{children}</main>
        <footer className="container mx-auto px-4 py-8 text-center text-sm text-muted-foreground">
          🌸 SakuraNFT on LitVM LiteForge Testnet · Powered by zkLTC
        </footer>
      </div>
      <AIChatWidget />
    </div>
  );
}
