// Paper simulation. Every price is a demo value relative to entry (1.00 = entry).
// Nothing here is a quote, a forecast or a real token.

export const N = 240;

export type TokenId = "orbit" | "lantern" | "moss";
export type CondId = "trail" | "reach" | "below";
export type ActionId = "all" | "half" | "quarter";

export const TOKENS: { id: TokenId; label: string; note: string }[] = [
  { id: "orbit", label: "$ORBIT", note: "Demo token" },
  { id: "lantern", label: "$LANTERN", note: "Demo token" },
  { id: "moss", label: "$MOSS", note: "Demo token" },
];

export const CONDS: { id: CondId; label: string; note: string }[] = [
  { id: "trail", label: "falls 30% from its peak", note: "Trailing wire" },
  { id: "reach", label: "reaches 3x", note: "Take profit" },
  { id: "below", label: "drops 40% below entry", note: "Stop loss" },
];

export const ACTIONS: { id: ActionId; label: string; sold: string }[] = [
  { id: "all", label: "sell all", sold: "Sold all" },
  { id: "half", label: "sell half", sold: "Sold half" },
  { id: "quarter", label: "sell a quarter", sold: "Sold a quarter" },
];

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ease = (x: number) => x * x * (3 - 2 * x);
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

const SHAPES: Record<TokenId, { seed: number; peak: number; at: number; amp: number }> = {
  orbit: { seed: 3, peak: 2.15, at: 0.5, amp: 0.045 },
  lantern: { seed: 7, peak: 1.85, at: 0.42, amp: 0.05 },
  moss: { seed: 11, peak: 2.6, at: 0.58, amp: 0.04 },
};

export function buildPath(token: TokenId, cond: CondId): number[] {
  const s = SHAPES[token];
  const r = rng(s.seed * 97 + (cond === "trail" ? 1 : cond === "reach" ? 2 : 3));
  const waves = [3, 5, 8, 13, 21, 34].map((f, k) => ({
    f,
    a: (s.amp * 1.6) / (1 + k * 0.9),
    p: r() * Math.PI * 2,
  }));

  const out: number[] = [];
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1);
    let base = 0;
    if (cond === "trail") {
      const m = Math.log(s.peak);
      base =
        t <= s.at
          ? m * Math.pow(t / s.at, 1.15)
          : m - Math.log(1 / 0.56) * ease(clamp01((t - s.at) / (1 - s.at)));
    } else if (cond === "reach") {
      const top = Math.log(3.7 + (s.peak - 2) * 0.4);
      const k = 0.78;
      base =
        t <= k
          ? top * Math.pow(t / k, 1.6)
          : top - 0.1 * ease(clamp01((t - k) / (1 - k)));
    } else {
      const bump = Math.log(1.12 + (s.peak - 2) * 0.05);
      const low = Math.log(0.44);
      base =
        t <= 0.14
          ? bump * ease(t / 0.14)
          : bump + (low - bump) * ease(clamp01((t - 0.14) / 0.66)) - 0.02 * (t > 0.8 ? 1 : 0);
    }
    let noise = 0;
    for (const w of waves) noise += w.a * Math.sin(w.f * t * Math.PI * 2 + w.p);
    const ramp = clamp01(t / 0.06);
    out.push(Math.exp(base + noise * ramp));
  }
  out[0] = 1;
  return out;
}

export function buildWire(prices: number[], cond: CondId): number[] {
  if (cond === "trail") {
    let peak = 0;
    return prices.map((p) => {
      peak = Math.max(peak, p);
      return peak * 0.7;
    });
  }
  const level = cond === "reach" ? 3 : 0.6;
  return prices.map(() => level);
}

export function findFire(prices: number[], wire: number[], cond: CondId): number {
  for (let i = 1; i < prices.length; i++) {
    if (cond === "reach" ? prices[i] >= wire[i] : prices[i] <= wire[i]) return i;
  }
  return prices.length - 1;
}

export function peakBefore(prices: number[], i: number): number {
  let p = 0;
  for (let j = 0; j <= i; j++) p = Math.max(p, prices[j]);
  return p;
}

export function resultLine(
  cond: CondId,
  action: ActionId,
  prices: number[],
  fire: number,
): string {
  const sold = ACTIONS.find((a) => a.id === action)!.sold;
  const px = prices[fire].toFixed(2);
  if (cond === "trail") {
    const peak = peakBefore(prices, fire);
    return `Price fell to ${px}x and crossed the wire at ${(peak * 0.7).toFixed(2)}x, 30% under the ${peak.toFixed(2)}x peak. ${sold}. Simulation.`;
  }
  if (cond === "reach") return `Price reached ${px}x and crossed the 3.00x wire. ${sold}. Simulation.`;
  return `Price fell to ${px}x and crossed the 0.60x wire. ${sold}. Simulation.`;
}
