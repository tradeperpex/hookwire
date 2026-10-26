import { ArrowLeftRight, ArrowRight, Wallet, Zap } from "lucide-react";
import type { ReactNode } from "react";
import { Reveal } from "./Reveal";

// Three cards, each with a small drawn illustration. No photos, no video.

function LineArt() {
  return (
    <svg viewBox="0 0 320 170" width="100%" role="img" aria-label="A falling price line crossing a horizontal orange wire" style={{ display: "block" }}>
      {[34, 68, 102, 136].map((y) => (
        <line key={y} x1="0" x2="320" y1={y} y2={y} stroke="rgba(255,255,255,0.07)" />
      ))}
      <path
        d="M0 128C26 120 44 84 76 70S128 34 160 44 206 78 232 104 292 138 320 146"
        fill="none"
        stroke="#fff"
        strokeWidth="2.25"
        strokeLinecap="round"
      />
      <line x1="0" x2="320" y1="96" y2="96" stroke="var(--wire)" strokeWidth="2" strokeDasharray="1 0" />
      <circle cx="222" cy="96" r="16" fill="none" stroke="var(--wire)" strokeOpacity="0.35" />
      <circle cx="222" cy="96" r="5.5" fill="#fff" stroke="#000" strokeWidth="2" />
    </svg>
  );
}

function Bar({ label, value, pct, tone }: { label: string; value: string; pct: number; tone: "dim" | "ink" | "wire" }) {
  const bg = tone === "wire" ? "var(--wire)" : tone === "ink" ? "#fff" : "rgba(255,255,255,0.22)";
  return (
    <div>
      <div className="label" style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
        <span>{label}</span>
        <span style={{ color: "var(--ink)" }}>{value}</span>
      </div>
      <div style={{ height: 10, borderRadius: 999, background: "rgba(255,255,255,0.07)", overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", borderRadius: 999, background: bg }} />
      </div>
    </div>
  );
}

function LimitArt() {
  return (
    <div style={{ display: "grid", gap: 18, width: "100%" }}>
      <Bar label="Your balance" value="100%" pct={100} tone="dim" />
      <Bar label="Allowance" value="70%" pct={70} tone="ink" />
      <Bar label="Rule sells" value="50%" pct={50} tone="wire" />
    </div>
  );
}

function Node({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <div style={{ display: "grid", justifyItems: "center", gap: 10 }}>
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 56,
          height: 56,
          borderRadius: 999,
          border: "1px solid var(--line-2)",
          background: "rgba(255,255,255,0.04)",
        }}
      >
        {icon}
      </span>
      <span className="label">{label}</span>
    </div>
  );
}

function ActArt() {
  const arrow = <ArrowRight size={16} color="var(--faint)" aria-hidden="true" style={{ marginTop: 20 }} />;
  return (
    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", width: "100%" }}>
      <Node icon={<Zap size={22} color="var(--wire)" aria-hidden="true" />} label="Keeper" />
      {arrow}
      <Node icon={<ArrowLeftRight size={22} aria-hidden="true" />} label="Pool" />
      {arrow}
      <Node icon={<Wallet size={22} aria-hidden="true" />} label="You" />
    </div>
  );
}

const STEPS = [
  {
    n: "01",
    title: "Set a line.",
    body: "Write a rule as a sentence. A price, a drop from the peak, a change in a pool. Hookwire reads it back to you as a trigger you can check.",
    art: <LineArt />,
  },
  {
    n: "02",
    title: "Grant a limit.",
    body: "Approve the token once. The allowance is the cap, a rule only sells what you approved. Add an expiry and a slippage guard.",
    art: <LimitArt />,
  },
  {
    n: "03",
    title: "It acts.",
    body: "Anyone can run a keeper. When the line is crossed, a keeper executes the rule and earns a small fee from the sale. You can cancel at any time.",
    art: <ActArt />,
  },
];

export function HowSteps() {
  return (
    <ol className="how-grid">
      {STEPS.map((s, i) => (
        <li key={s.n} className="how-card">
          <Reveal i={i}>
            <div className="how-art">
              {s.art}
            </div>
            <span className="label" style={{ display: "block", marginTop: 28 }}>
              {s.n}
            </span>
            <h3 style={{ marginTop: 10, fontSize: "clamp(1.8rem, 1.3rem + 1vw, 2.25rem)", letterSpacing: "-0.02em", lineHeight: 1.1 }}>
              {s.title}
            </h3>
            <p style={{ marginTop: 12, color: "var(--ink-2)", maxWidth: "46ch" }}>{s.body}</p>
          </Reveal>
        </li>
      ))}
    </ol>
  );
}
