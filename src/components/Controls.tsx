import { LIVE } from "@/lib/site";
import { LimitPreview } from "./LimitPreview";
import { Reveal } from "./Reveal";

const ITEMS = [
  ["Your allowance is the limit", "A rule can only sell what you approved. Approve less, or approve nothing, and it cannot sell."],
  ["One token, one pool", "Each rule names the token and the exact pool it sells through. Nothing else is touched."],
  ["Expiry", "Every rule has an end time. After that it does nothing."],
  ["A kill switch", "Cancel the rule, or set the allowance to zero, and nothing can act on your behalf."],
  ["Readable on chain", "Rules, limits and executions are plain contract state you can read yourself."],
];

export function Controls() {
  return (
    <section id="controls" className="section" style={{ borderTop: "1px solid var(--line)", background: "var(--paper-2)" }}>
      <div className="container two">
        <div>
          <Reveal>
            <p className="label">What you control</p>
            <h2 className="display-2" style={{ marginTop: 16 }}>
              You hold the keys. Hookwire holds the line.
            </h2>
            <p className="lead" style={{ marginTop: 24 }}>
              Hookwire never holds your funds. Your tokens stay in your wallet until a rule fires, and the swap pays you directly.
            </p>
          </Reveal>
          <ul style={{ listStyle: "none", margin: "48px 0 0", padding: 0 }}>
            {ITEMS.map(([t, d], i) => (
              <li
                key={t}
                style={{
                  display: "grid",
                  gap: 4,
                  padding: "20px 0",
                  borderTop: "1px solid var(--line-2)",
                }}
              >
                <Reveal i={i}>
                  <strong style={{ fontWeight: 600 }}>{t}</strong>
                  <p style={{ color: "var(--ink-2)", marginTop: 4, maxWidth: "46ch" }}>{d}</p>
                </Reveal>
              </li>
            ))}
          </ul>
          <p className="label" style={{ marginTop: 8 }}>
            {LIVE ? "Live on mainnet." : "Contract not deployed yet."}
          </p>
        </div>
        <Reveal>
          <LimitPreview />
        </Reveal>
      </div>
    </section>
  );
}
