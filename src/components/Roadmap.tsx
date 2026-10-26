import { LIVE } from "@/lib/site";
import { Reveal } from "./Reveal";

const GROUPS = [
  {
    name: "Live",
    live: true,
    items: [
      ["Pool explorer", "Find the Uniswap v4 pools for any token on Robinhood Chain, with hooks decoded and flagged."],
      ["Paper simulation", "Rules run against simulated prices on demo tokens, in your browser."],
      ["Rule contract", "Take profit, stop loss and trailing stop, non-custodial, fork tested against the real PoolManager."],
      ["App and keeper board", "Create, watch and cancel rules, and execute triggered ones for a fee."],
    ],
  },
  {
    name: "Next",
    live: false,
    items: [
      ["Independent audit", "Before anyone should trust it with size."],
      ["TWAP triggers", "Rules that read a time weighted price, so one block of price pushing cannot fire them."],
      ["Buy rules and ladders", "Buy a dip, and sell in steps."],
    ],
  },
  {
    name: "Later",
    live: false,
    items: [
      ["Hosted keeper network", "Anyone can run a keeper today. A hosted one comes later."],
      ["Token", "Fee discounts and buyback and burn from keeper fees. Not launched."],
    ],
  },
];

export function Roadmap() {
  return (
    <section id="roadmap" className="section" style={{ borderTop: "1px solid var(--line)" }}>
      <div className="container">
        <Reveal>
          <p className="label">Roadmap</p>
          <h2 className="display-2" style={{ marginTop: 16 }}>
            What works today, and what does not.
          </h2>
          <p className="lead" style={{ marginTop: 24 }}>
            {LIVE ? "The first group exists on mainnet. The rest is a plan, and plans change." : "The first group is built, and the rule contract is waiting for its mainnet deploy. The rest is a plan, and plans change."}
          </p>
        </Reveal>
        <div style={{ marginTop: 64 }}>
          {GROUPS.map((g, gi) => (
            <div key={g.name} className="rgroup">
              <div className="road">
                <Reveal i={gi}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span
                      aria-hidden="true"
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 999,
                        background: g.live ? "var(--wire)" : "transparent",
                        border: g.live ? "0" : "1.5px solid var(--faint)",
                      }}
                    />
                    <h3 style={{ fontSize: "1.75rem", letterSpacing: "-0.02em" }}>{g.live && !LIVE ? "Built" : g.name}</h3>
                  </div>
                  <p className="label" style={{ marginTop: 8 }}>
                    {g.live ? (LIVE ? "Works today" : "Built") : "Not live"}
                  </p>
                </Reveal>
                <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 24 }}>
                  {g.items.map(([t, d], i) => (
                    <li key={t}>
                      <Reveal i={i}>
                        <strong style={{ fontWeight: 600 }}>{t}</strong>
                        <p style={{ color: "var(--ink-2)", marginTop: 4, maxWidth: "52ch" }}>{d}</p>
                      </Reveal>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
          <hr className="hair" />
        </div>
      </div>
    </section>
  );
}
