import { useEffect, useMemo, useState } from "react";

/**
 * Lightweight falling sakura petals — varied sizes for a richer storm.
 * GPU-only transforms keep it cheap even with high counts.
 */
export function SakuraBackground({ count = 28, intense = false }: { count?: number; intense?: boolean }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const total = intense ? Math.round(count * 1.6) : count;

  const petals = useMemo(() => Array.from({ length: total }, (_, i) => {
    const left = Math.random() * 100;
    const sizeRoll = Math.random();
    const variant = sizeRoll < 0.35 ? "petal-sm" : sizeRoll > 0.78 ? "petal-lg" : "";
    const bright = Math.random() > 0.6 ? "petal-bright" : "";
    const dur = 9 + Math.random() * 12;
    const delay = -Math.random() * 20;
    const drift = (Math.random() * 260 - 130);
    const sway = 2.5 + Math.random() * 3.5;
    const hue = 335 + Math.random() * 30;
    return { i, left, dur, delay, drift, sway, hue, variant, bright };
  }), [total]);

  if (!mounted) return <div aria-hidden className="pointer-events-none fixed inset-0 z-0" />;

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden z-0">
      {petals.map((p) => (
        <span
          key={p.i}
          className={`petal ${p.variant} ${p.bright}`}
          style={{
            left: `${p.left}%`,
            animationDuration: `${p.dur}s, ${p.sway}s`,
            animationDelay: `${p.delay}s, ${p.delay}s`,
            ["--drift" as any]: `${p.drift}px`,
            ...(p.bright ? {} : { background: `radial-gradient(circle at 30% 30%, oklch(0.96 0.05 ${p.hue}), oklch(0.68 0.2 ${p.hue}))` }),
          }}
        />
      ))}
    </div>
  );
}
