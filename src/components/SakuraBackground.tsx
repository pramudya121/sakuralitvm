import { useEffect, useMemo, useState } from "react";

/**
 * Premium falling sakura petals.
 * - Mixed sizes & brightnesses for depth.
 * - Two motion axes (fall + sway) animated together with rotation.
 * - GPU-only transforms; respects prefers-reduced-motion.
 */
export function SakuraBackground({
  count = 28,
  intense = false,
}: {
  count?: number;
  intense?: boolean;
}) {
  const [mounted, setMounted] = useState(false);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (typeof window !== "undefined" && "matchMedia" in window) {
      const m = window.matchMedia("(prefers-reduced-motion: reduce)");
      setReduced(m.matches);
      const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
      m.addEventListener?.("change", handler);
      return () => m.removeEventListener?.("change", handler);
    }
  }, []);

  const total = reduced ? Math.round(count / 3) : intense ? Math.round(count * 1.6) : count;

  const petals = useMemo(
    () =>
      Array.from({ length: total }, (_, i) => {
        const left = Math.random() * 100;
        const sizeRoll = Math.random();
        const variant =
          sizeRoll < 0.3 ? "petal-sm" : sizeRoll > 0.78 ? "petal-lg" : "";
        const bright = Math.random() > 0.55 ? "petal-bright" : "";
        const dur = 10 + Math.random() * 14;
        const delay = -Math.random() * 22;
        const drift = Math.random() * 320 - 160;
        const sway = 3 + Math.random() * 4;
        const hue = 332 + Math.random() * 36;
        const startRot = Math.floor(Math.random() * 360);
        const endRot = startRot + (Math.random() > 0.5 ? 720 : -720);
        return { i, left, dur, delay, drift, sway, hue, variant, bright, startRot, endRot };
      }),
    [total],
  );

  if (!mounted) {
    return <div aria-hidden className="pointer-events-none fixed inset-0 z-0" />;
  }

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 overflow-hidden z-0"
    >
      {petals.map((p) => (
        <span
          key={p.i}
          className={`petal ${p.variant} ${p.bright}`}
          style={{
            left: `${p.left}%`,
            animationDuration: `${p.dur}s, ${p.sway}s`,
            animationDelay: `${p.delay}s, ${p.delay}s`,
            ["--drift" as any]: `${p.drift}px`,
            ["--rot-start" as any]: `${p.startRot}deg`,
            ["--rot-end" as any]: `${p.endRot}deg`,
            ...(p.bright
              ? {}
              : {
                  background: `radial-gradient(circle at 30% 30%, oklch(0.96 0.05 ${p.hue}), oklch(0.68 0.2 ${p.hue}))`,
                }),
          }}
        />
      ))}
    </div>
  );
}
