import Link from "next/link";
import { SITE, LIVE, RULES_ADDRESS } from "@/lib/site";
import { explorer } from "@/lib/chain";
import { XIcon } from "./XLink";
import { Mark, Wordmark } from "./Mark";

export function Footer() {
  return (
    <footer style={{ borderTop: "1px solid var(--line)", padding: "56px 0 40px" }}>
      <div className="container">
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: 32 }}>
          <div>
            <Link href="/" aria-label="Hookwire, home" style={{ display: "inline-flex", alignItems: "center", gap: 10, minHeight: 44 }}>
              <Mark size={32} />
              <Wordmark />
            </Link>
            <p style={{ color: "var(--muted)", marginTop: 8, fontSize: "0.9375rem" }}>{SITE.tagline}</p>
          </div>
          <nav aria-label="Footer" style={{ display: "flex", flexWrap: "wrap", gap: "0 8px", alignItems: "flex-start" }}>
            <Link className="nav-link" href="/app">
              App
            </Link>
            <Link className="nav-link" href="/pools">
              Pools
            </Link>
            <Link className="nav-link" href="/keepers">
              Keepers
            </Link>
            <Link className="nav-link" href="/docs">
              Docs
            </Link>
            <a className="nav-link" href={SITE.x} target="_blank" rel="noopener noreferrer" aria-label={`${SITE.xHandle} on X`} style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              <XIcon size={14} />
              {SITE.xHandle}
            </a>
            <a className="nav-link" href={SITE.explorer} target="_blank" rel="noopener noreferrer">
              Explorer
            </a>
          </nav>
        </div>

        <dl style={{ margin: "40px 0 0", display: "flex", flexWrap: "wrap", gap: "16px 40px" }}>
          <div style={{ display: "grid", gap: 4 }}>
            <dt className="label">Rule contract</dt>
            <dd style={{ margin: 0, fontFamily: "var(--font-mono)", fontSize: "0.875rem", color: "var(--ink-2)", overflowWrap: "anywhere" }}>
              {LIVE ? (
                <a className="link-quiet" style={{ minHeight: 0 }} href={explorer.address(RULES_ADDRESS)} target="_blank" rel="noopener noreferrer">
                  {RULES_ADDRESS}
                </a>
              ) : (
                "Not deployed"
              )}
            </dd>
          </div>
          <div style={{ display: "grid", gap: 4 }}>
            <dt className="label">Token</dt>
            <dd style={{ margin: 0, fontFamily: "var(--font-mono)", fontSize: "0.875rem", color: "var(--ink-2)" }}>Not published</dd>
          </div>
        </dl>

        <hr className="hair" style={{ marginTop: 32 }} />
        <p style={{ color: "var(--muted)", fontSize: "0.8125rem", marginTop: 24, maxWidth: "78ch" }}>
          Hookwire is experimental beta software and has not been audited. Rules read pool spot prices, and swaps can fill worse than you expect or fail. Use only money you can afford to lose. The home page simulator uses made-up prices and does not trade. Digital assets are
          volatile and you can lose everything you put in. Hookwire is not affiliated with Robinhood or Uniswap Labs.
        </p>
        <p style={{ color: "var(--muted)", fontSize: "0.8125rem", marginTop: 12 }}>2026 Hookwire.</p>
      </div>
    </footer>
  );
}
