import type { Metadata } from "next";
import { PageHead } from "@/components/PageHead";
import { KeeperBoard } from "@/components/KeeperBoard";

export const metadata: Metadata = {
  title: "Keepers. Hookwire",
  description: "Armed rules on Robinhood Chain. Execute a triggered rule and earn the keeper fee.",
  alternates: { canonical: "/keepers" },
};

export default function KeepersPage() {
  return (
    <div className="container pagehead">
      <PageHead kicker="Anyone can run one" title="Earn the fee.">
        Anyone can execute a rule once its price is crossed. The keeper fee comes out of the sale and goes to whoever sent the transaction. Triggered rules come first. For automation, run the keeper bot from the repository.
      </PageHead>
      <div style={{ marginTop: 48 }}>
        <KeeperBoard />
      </div>
    </div>
  );
}
