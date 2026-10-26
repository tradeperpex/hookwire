import { Reveal } from "./Reveal";

const MECH = [
  ["Keeper fees", "Each executed rule pays a small fee to the keeper that ran it."],
  ["Buyback and burn", "Part of keeper fees is designed to buy the token on the market and burn it."],
  ["Holding or staking", "Designed to lower your fees and raise the number of rules you can keep active."],
];

export function Token() {
  return (
    <section id="token" className="section" style={{ borderTop: "1px solid var(--line)", background: "var(--paper-2)" }}>
      <div className="container two">
        <div>
          <Reveal>
            <p className="label">Token</p>
            <h2 className="display-2" style={{ marginTop: 16 }}>
              A token with a job, not a promise.
            </h2>
            <p className="lead" style={{ marginTop: 24 }}>
              It has two jobs. Fee discounts, and a buyback and burn funded by keeper fees. It is not launched.
            </p>
          </Reveal>

          <Reveal>
            <div
              style={{
                marginTop: 40,
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                padding: "16px 20px",
                borderRadius: 16,
                background: "var(--card)",
                border: "1px solid var(--line)",
              }}
            >
              <span className="label">Token address</span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.875rem", color: "var(--ink-2)" }}>Not published</span>
            </div>
          </Reveal>
        </div>

        <div>
          <Reveal>
            <FlowDiagram />
          </Reveal>
          <ul style={{ listStyle: "none", margin: "32px 0 0", padding: 0 }}>
            {MECH.map(([t, d], i) => (
              <li key={t} style={{ padding: "20px 0", borderTop: "1px solid var(--line-2)" }}>
                <Reveal i={i}>
                  <strong style={{ fontWeight: 600 }}>{t}</strong>
                  <p style={{ color: "var(--ink-2)", marginTop: 4, maxWidth: "46ch" }}>{d}</p>
                </Reveal>
              </li>
            ))}
          </ul>
          <Reveal>
            <p
              style={{
                marginTop: 24,
                padding: "20px 24px",
                borderRadius: 16,
                border: "1px solid var(--line-2)",
                color: "var(--ink-2)",
                fontSize: "0.9375rem",
              }}
            >
              <strong style={{ color: "var(--ink)", fontWeight: 600 }}>Risk. </strong>
              This is not an investment. The token has no promised return and may lose all its value. Only use money you can afford to lose.
            </p>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

function FlowDiagram() {
  const pts = [
    { x: 24, label: "Keeper fee" },
    { x: 200, label: "Buyback" },
    { x: 376, label: "Burn" },
  ];
  return (
    <svg viewBox="0 0 400 88" role="img" aria-label="Keeper fees fund a buyback, and bought tokens are burned." width="100%" style={{ display: "block" }}>
      <line x1="24" y1="30" x2="376" y2="30" stroke="var(--wire)" strokeWidth="1.5" />
      {pts.map((p) => (
        <g key={p.label}>
          <circle cx={p.x} cy="30" r="6" fill="var(--paper-2)" stroke="var(--ink)" strokeWidth="1.5" />
          <text
            x={p.x}
            y="68"
            textAnchor={p.x === 24 ? "start" : p.x === 376 ? "end" : "middle"}
            style={{ font: "500 13px var(--font-sans), sans-serif", fill: "var(--ink-2)" }}
          >
            {p.label}
          </text>
        </g>
      ))}
    </svg>
  );
}
