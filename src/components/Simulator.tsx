"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Dropdown } from "./Dropdown";
import {
  ACTIONS,
  CONDS,
  N,
  TOKENS,
  buildPath,
  buildWire,
  findFire,
  resultLine,
  type ActionId,
  type CondId,
  type TokenId,
} from "@/lib/sim";

const STEP_MS = 22;

function useWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)));
    ro.observe(el);
    setW(Math.round(el.getBoundingClientRect().width));
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

function niceTicks(lo: number, hi: number) {
  const steps = [0.25, 0.5, 1, 2];
  const step = steps.find((s) => (hi - lo) / s <= 5) ?? 2;
  const out: number[] = [];
  for (let t = Math.ceil(lo / step) * step; t <= hi; t += step) out.push(Math.round(t * 100) / 100);
  return out;
}

export function Simulator() {
  const [token, setToken] = useState<TokenId>("orbit");
  const [cond, setCond] = useState<CondId>("trail");
  const [action, setAction] = useState<ActionId>("all");
  const [idx, setIdx] = useState(0);
  const [phase, setPhase] = useState<"idle" | "playing" | "done">("idle");
  const raf = useRef<number | null>(null);
  const auto = useRef(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const [chartRef, W] = useWidth();

  const prices = useMemo(() => buildPath(token, cond), [token, cond]);
  const wire = useMemo(() => buildWire(prices, cond), [prices, cond]);
  const fire = useMemo(() => findFire(prices, wire, cond), [prices, wire, cond]);
  const result = useMemo(() => resultLine(cond, action, prices, fire), [cond, action, prices, fire]);

  const stop = useCallback(() => {
    if (raf.current != null) cancelAnimationFrame(raf.current);
    raf.current = null;
  }, []);

  const reset = useCallback(() => {
    stop();
    setIdx(0);
    setPhase("idle");
  }, [stop]);

  useEffect(() => () => stop(), [stop]);

  const play = useCallback(() => {
    stop();
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setIdx(fire);
      setPhase("done");
      return;
    }
    setIdx(0);
    setPhase("playing");
    const t0 = performance.now();
    const tick = (now: number) => {
      const i = Math.min(fire, Math.floor((now - t0) / STEP_MS));
      setIdx(i);
      if (i >= fire) {
        setPhase("done");
        raf.current = null;
        return;
      }
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
  }, [fire, stop]);

  // Run once, the first time the card is mostly in view.
  useEffect(() => {
    const el = cardRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting && !auto.current) {
          auto.current = true;
          window.setTimeout(() => play(), 500);
          io.disconnect();
        }
      },
      { threshold: 0.6 },
    );
    io.observe(el);
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Chart geometry
  const H = W && W < 640 ? 260 : 360;
  const pad = { l: 46, r: 20, t: 30, b: 30 };
  const lo = Math.min(...prices, ...wire) * 0.9;
  const hi = Math.max(...prices, ...wire) * 1.07;
  const x = (i: number) => pad.l + ((W - pad.l - pad.r) * i) / (N - 1);
  const y = (v: number) => pad.t + (H - pad.t - pad.b) * (1 - (v - lo) / (hi - lo));
  const line = (arr: number[], from: number, to: number) =>
    arr
      .slice(from, to + 1)
      .map((v, k) => `${k === 0 ? "M" : "L"}${x(from + k).toFixed(1)} ${y(v).toFixed(1)}`)
      .join(" ");
  const ticks = niceTicks(lo, hi);
  const fired = phase === "done";
  const label = TOKENS.find((t) => t.id === token)!.label;
  const alt = `Simulated price of demo token ${label} against a wire. ${fired ? result : "Not yet run."}`;

  return (
    <section id="try" className="container" style={{ paddingTop: 96, paddingBottom: 120 }}>
      <p className="label">Try a rule on paper</p>
      <h2
        className="display-1"
        style={{ marginTop: 20, maxWidth: "17em", lineHeight: 1.1, position: "relative", zIndex: 20 }}
      >
        When{" "}
        <Dropdown
          ariaLabel="Token"
          value={token}
          options={TOKENS}
          onChange={(v) => {
            setToken(v as TokenId);
            reset();
          }}
        />{" "}
        <Dropdown
          ariaLabel="Condition"
          value={cond}
          options={CONDS}
          onChange={(v) => {
            setCond(v as CondId);
            reset();
          }}
          suffix=","
        />{" "}
        <Dropdown
          ariaLabel="Action"
          value={action}
          options={ACTIONS.map((a) => ({ id: a.id, label: a.label }))}
          onChange={(v) => setAction(v as ActionId)}
          suffix="."
        />
      </h2>

      <div
        style={{
          marginTop: 32,
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: "24px 40px",
          justifyContent: "space-between",
        }}
      >
        <p className="lead" style={{ maxWidth: "40ch" }}>
          Write the rule once. Hookwire holds the line, inside a limit you set, while you sleep.
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={play}
            disabled={phase === "playing"}
            style={phase === "playing" ? { opacity: 0.55, cursor: "default" } : undefined}
          >
            <svg width="11" height="12" viewBox="0 0 11 12" aria-hidden="true">
              <path d="M1 1.2v9.6a.5.5 0 0 0 .76.43l7.8-4.8a.5.5 0 0 0 0-.86L1.76.77A.5.5 0 0 0 1 1.2Z" fill="currentColor" />
            </svg>
            {phase === "idle" ? "Play the simulation" : phase === "playing" ? "Running" : "Replay"}
          </button>
          <Link href="/app" className="btn btn-ghost">
            Open the app
          </Link>
          <a href="#controls" className="link-quiet" style={{ fontSize: "0.9375rem" }}>
            How it stays non-custodial
          </a>
        </div>
      </div>

      <div
        ref={cardRef}
        style={{
          marginTop: 56,
          background: "var(--card)",
          border: "1px solid var(--line)",
          borderRadius: 24,
          boxShadow: "var(--shadow)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "10px 24px",
            padding: "18px 24px",
            borderBottom: "1px solid var(--line)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <span
              className="label"
              style={{
                border: "1px solid var(--line-2)",
                borderRadius: 999,
                padding: "4px 10px",
                color: "var(--ink)",
              }}
            >
              Simulation
            </span>
            <span style={{ fontSize: "0.875rem", color: "var(--ink-2)", fontWeight: 500 }}>
              {label} demo path. Price against entry.
            </span>
          </div>
          <div className="label" style={{ display: "flex", gap: 20 }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 16, height: 2, background: "var(--ink)", borderRadius: 2 }} />
              Price
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 16, height: 2, background: "var(--wire)", borderRadius: 2 }} />
              Wire
            </span>
          </div>
        </div>

        <div ref={chartRef} style={{ position: "relative", height: H || 360 }}>
          {W > 0 && (
            <svg
              width={W}
              height={H}
              role="img"
              aria-label={alt}
              style={{ display: "block" }}
            >
              {ticks.map((t) => (
                <g key={t}>
                  <line
                    x1={pad.l}
                    x2={W - pad.r}
                    y1={y(t)}
                    y2={y(t)}
                    stroke="rgba(255,255,255,0.08)"
                    strokeWidth={t === 1 ? 1.5 : 1}
                    strokeDasharray={t === 1 ? "2 5" : undefined}
                  />
                  <text
                    x={pad.l - 10}
                    y={y(t) + 4}
                    textAnchor="end"
                    fontFamily="var(--font-geist-mono)"
                    fontSize="11"
                    fill="var(--muted)"
                  >
                    {t}x
                  </text>
                </g>
              ))}

              {/* The whole path, faint. It is a simulation, so the future is drawn. */}
              <path d={line(prices, 0, N - 1)} fill="none" stroke="var(--faint)" strokeOpacity={0.55} strokeWidth={1.5} strokeLinejoin="round" />
              {/* The wire, armed */}
              <path d={line(wire, 0, N - 1)} fill="none" stroke="var(--wire)" strokeOpacity={0.3} strokeWidth={1.5} strokeDasharray="3 6" />

              {idx > 0 && (
                <>
                  <path d={line(wire, 0, idx)} fill="none" stroke="var(--wire)" strokeWidth={2} strokeLinecap="round" />
                  <path d={line(prices, 0, idx)} fill="none" stroke="var(--ink)" strokeWidth={2.25} strokeLinejoin="round" strokeLinecap="round" />
                </>
              )}

              {phase === "playing" && (
                <circle cx={x(idx)} cy={y(prices[idx])} r={4.5} fill="var(--ink)" stroke="var(--card)" strokeWidth={2} />
              )}

              {fired && (
                <g>
                  <circle className="ring" cx={x(fire)} cy={y(prices[fire])} fill="none" stroke="var(--wire)" strokeWidth={1.5} />
                  <circle cx={x(fire)} cy={y(prices[fire])} r={6} fill="var(--wire)" stroke="var(--card)" strokeWidth={2.5} />
                </g>
              )}
            </svg>
          )}

          {fired && W > 0 && (
            <div
              aria-hidden="true"
              style={{
                position: "absolute",
                left: Math.min(Math.max(x(fire), 116), W - 116),
                top: Math.max(y(prices[fire]) - 52, 8),
                transform: "translateX(-50%)",
                background: "var(--ink)",
                color: "var(--paper)",
                borderRadius: 999,
                padding: "6px 12px",
                fontSize: "0.75rem",
                fontWeight: 500,
                whiteSpace: "nowrap",
                animation: "rise 0.5s var(--ease) both",
              }}
            >
              Wire crossed. {ACTIONS.find((a) => a.id === action)!.sold}.
            </div>
          )}
        </div>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "10px 24px",
            padding: "16px 24px 18px",
            borderTop: "1px solid var(--line)",
            background: "var(--paper)",
          }}
        >
          <p
            aria-live="polite"
            style={{ fontSize: "0.875rem", color: "var(--ink-2)", maxWidth: "70ch", minHeight: 22 }}
          >
            {phase === "idle" && "The grey line is a simulated price. The orange line is your wire. Press play."}
            {phase === "playing" && "Running the rule against the path."}
            {phase === "done" && result}
          </p>
          <p className="label">Simulated prices on a demo token. Nothing here trades.</p>
        </div>
      </div>
    </section>
  );
}
