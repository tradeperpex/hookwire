import type { Metadata } from "next";
import { PageHead } from "@/components/PageHead";
import { PoolsExplorer } from "@/components/PoolsExplorer";

export const metadata: Metadata = {
  title: "Pools. Hookwire",
  description: "Find Uniswap v4 pools on Robinhood Chain for any token, with hooks decoded and flagged.",
  alternates: { canonical: "/pools" },
};

export default function PoolsPage() {
  return (
    <div className="container pagehead">
      <PageHead kicker="Read before you sell" title="See the hook.">
        Every Uniswap v4 pool can carry a hook, and a hook can change what a swap pays. Look up a token and read the hook before you sell through it.
      </PageHead>
      <div style={{ marginTop: 48 }}>
        <PoolsExplorer />
      </div>
    </div>
  );
}
