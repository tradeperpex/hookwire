import { LIVE } from "@/lib/site";
import { HowSteps } from "./HowSteps";
import { Reveal } from "./Reveal";

export function How() {
  return (
    <section id="how" className="section" style={{ borderTop: "1px solid var(--line)" }}>
      <div className="container">
        <Reveal>
          <div
            style={{
              display: "grid",
              gap: 24,
              gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))",
              alignItems: "end",
            }}
          >
            <div>
              <p className="label">How it works</p>
              <h2 className="display-2" style={{ marginTop: 16 }}>
                Three steps, one line.
              </h2>
            </div>
            <p className="lead">
              A rule is a sentence with a line in it. Hookwire is built to hold that line for you.
            </p>
          </div>
        </Reveal>

        <div style={{ marginTop: 56 }}>
          <HowSteps />
        </div>
        <hr className="hair" style={{ marginTop: 56 }} />
        <p className="label" style={{ marginTop: 20, maxWidth: "70ch" }}>
          {LIVE ? "Live on Robinhood Chain mainnet. Beta and unaudited. The simulator above runs only in your browser, with made-up prices." : "The rule contract is not deployed yet. The simulator above runs only in your browser, with made-up prices."}
        </p>
      </div>
    </section>
  );
}
