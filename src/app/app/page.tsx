import type { Metadata } from "next";
import { PageHead } from "@/components/PageHead";
import { Suspense } from "react";
import { AppBuilder } from "@/components/AppBuilder";

export const metadata: Metadata = {
  title: "App. Hookwire",
  description: "Create a take profit, stop loss or trailing stop rule on Robinhood Chain. Non-custodial.",
  alternates: { canonical: "/app" },
};

export default function AppPage() {
  return (
    <div className="container pagehead">
      <PageHead kicker="Set it once, then step away" title="Write a rule.">
        Pick a token and its pool, set the line, approve the amount. Your tokens stay in your wallet until the rule fires.
      </PageHead>
      <div style={{ marginTop: 48 }}>
        <Suspense fallback={<p className="hint">Loading.</p>}>
          <AppBuilder />
        </Suspense>
      </div>
    </div>
  );
}
