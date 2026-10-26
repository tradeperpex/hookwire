"use client";

import { useId, useState } from "react";

const EXPIRY = [
  { id: "1h", label: "1 hour", text: "1 hour" },
  { id: "24h", label: "24 hours", text: "24 hours" },
  { id: "7d", label: "7 days", text: "7 days" },
];
const SLIP = [
  { id: "0.5", label: "0.5%" },
  { id: "1", label: "1%" },
  { id: "3", label: "3%" },
];

export function LimitPreview() {
  const uid = useId();
  const [cap, setCap] = useState(50);
  const [exp, setExp] = useState("24h");
  const [slip, setSlip] = useState("1");
  const [revoked, setRevoked] = useState(false);

  const expText = EXPIRY.find((e) => e.id === exp)!.text;
  const pct = ((cap - 5) / (100 - 5)) * 100;

  return (
    <div
      style={{
        background: "var(--card)",
        borderRadius: 24,
        border: "1px solid var(--line)",
        boxShadow: "var(--shadow)",
        padding: "clamp(20px, 4vw, 32px)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <p className="label">Rule limits</p>
        <span
          role="status"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            fontSize: "0.8125rem",
            fontWeight: 500,
            color: revoked ? "var(--muted)" : "var(--ink)",
          }}
        >
          <span
            aria-hidden="true"
            style={{
              width: 8,
              height: 8,
              borderRadius: 999,
              background: revoked ? "var(--faint)" : "var(--wire)",
            }}
          />
          {revoked ? "Allowance zero" : "Armed"}
        </span>
      </div>

      <div
        style={{
          marginTop: 28,
          opacity: revoked ? 0.45 : 1,
          transition: "opacity .4s var(--ease)",
          display: "grid",
          gap: 32,
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
            <label htmlFor={`${uid}-cap`} style={{ fontWeight: 600 }}>
              Sell amount
            </label>
            <output
              htmlFor={`${uid}-cap`}
              style={{ fontFamily: "var(--font-mono)", fontSize: "1.25rem", fontVariantNumeric: "tabular-nums" }}
            >
              {cap}% of balance
            </output>
          </div>
          <input
            id={`${uid}-cap`}
            type="range"
            min={5}
            max={100}
            step={5}
            value={cap}
            disabled={revoked}
            onChange={(e) => setCap(Number(e.target.value))}
            style={{ marginTop: 14, ["--fill" as string]: `${pct}%` }}
            aria-valuetext={`${cap}% of balance`}
          />
          <p style={{ color: "var(--muted)", fontSize: "0.875rem", marginTop: 10 }}>
            The rule sells at most {cap}% of what you hold, and never more than your allowance.
          </p>
        </div>

        <div>
          <p style={{ fontWeight: 600 }} id={`${uid}-exp`}>
            Expires
          </p>
          <div className="seg" role="group" aria-labelledby={`${uid}-exp`} style={{ marginTop: 12 }}>
            {EXPIRY.map((e) => (
              <button key={e.id} type="button" aria-pressed={exp === e.id} disabled={revoked} onClick={() => setExp(e.id)}>
                {e.label}
              </button>
            ))}
          </div>
          <p style={{ color: "var(--muted)", fontSize: "0.875rem", marginTop: 10 }}>
            The rule stops working {expText} after you create it.
          </p>
        </div>

        <div>
          <p style={{ fontWeight: 600 }} id={`${uid}-slip`}>
            Slippage guard
          </p>
          <div className="seg" role="group" aria-labelledby={`${uid}-slip`} style={{ marginTop: 12 }}>
            {SLIP.map((e) => (
              <button key={e.id} type="button" aria-pressed={slip === e.id} disabled={revoked} onClick={() => setSlip(e.id)}>
                {e.label}
              </button>
            ))}
          </div>
          <p style={{ color: "var(--muted)", fontSize: "0.875rem", marginTop: 10 }}>
            A sale fills at no worse than spot minus {slip}%, or it does not run.
          </p>
        </div>
      </div>

      <div
        style={{
          marginTop: 32,
          paddingTop: 24,
          borderTop: "1px solid var(--line)",
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
        }}
      >
        <p className="label" style={{ maxWidth: "26ch" }}>
          Preview. Nothing is created here.
        </p>
        {revoked ? (
          <button type="button" className="btn btn-ghost" onClick={() => setRevoked(false)}>
            Start again
          </button>
        ) : (
          <button type="button" className="btn btn-ghost" onClick={() => setRevoked(true)}>
            Set allowance to zero
          </button>
        )}
      </div>
      <p aria-live="polite" style={{ color: "var(--ink-2)", fontSize: "0.875rem", marginTop: 14, minHeight: "1.5em" }}>
        {revoked ? "Allowance set to zero. Nothing can sell your tokens." : ""}
      </p>
    </div>
  );
}
