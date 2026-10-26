"use client";

import { useCallback, useEffect, useState } from "react";
import { RULES_ADDRESS, explorer } from "@/lib/chain";
import { getClient } from "@/lib/client";
import { fmtToken } from "@/lib/format";
import { type RuleView, loadRules, rulesContract } from "@/lib/rules";
import { useWallet } from "@/lib/wallet";
import { ConnectBar } from "./ConnectBar";
import { RuleCard, useRuleActions } from "./RuleCard";

export function KeeperBoard() {
  const w = useWallet();
  const [rules, setRules] = useState<RuleView[]>();
  const [count, setCount] = useState<number>();
  const [payout, setPayout] = useState<Record<string, string>>({});
  const [tick, setTick] = useState(0);
  const acts = useRuleActions(() => setTick((t) => t + 1));

  const load = useCallback(async () => {
    if (!RULES_ADDRESS) return;
    const c = getClient();
    const total = Number(await c.readContract({ ...rulesContract(), functionName: "ruleCount" }));
    setCount(total);
    const ids: bigint[] = [];
    for (let from = 1; from <= total; from += 200) {
      const [page] = (await c.readContract({ ...rulesContract(), functionName: "activeRules", args: [BigInt(from), 200n] })) as readonly [readonly bigint[], bigint];
      ids.push(...page);
    }
    const list = await loadRules(ids);
    list.sort((a, b) => Number(b.triggered) - Number(a.triggered) || Number(b.id - a.id));
    setRules(list);
  }, []);

  useEffect(() => {
    load().catch(() => setRules([]));
    const t = setInterval(() => load().catch(() => {}), 12000);
    return () => clearInterval(t);
  }, [load, tick]);

  // For triggered rules, simulate the execution to show what a keeper would earn.
  useEffect(() => {
    if (!rules || !w.account) return;
    let off = false;
    (async () => {
      for (const r of rules.filter((x) => x.triggered).slice(0, 8)) {
        try {
          const { result } = await getClient().simulateContract({ ...rulesContract(), functionName: "execute", args: [r.id], account: w.account! });
          const out = result as bigint;
          const fee = (out * BigInt(r.keeperFeeBps)) / 10_000n;
          if (!off) setPayout((p) => ({ ...p, [String(r.id)]: `You earn about ${fmtToken(fee, r.metaOut.decimals, 6)} ${r.metaOut.symbol}` }));
        } catch (e) {
          const m = ((e as { shortMessage?: string }).shortMessage ?? "Would revert").split("\n")[0];
          if (!off) setPayout((p) => ({ ...p, [String(r.id)]: `Cannot run right now. ${m}` }));
        }
      }
    })();
    return () => {
      off = true;
    };
  }, [rules, w.account]);

  if (!RULES_ADDRESS) {
    return (
      <p className="callout" role="status">
        <strong>Rule contract not deployed yet.</strong> The board fills in once it is.
      </p>
    );
  }

  return (
    <div style={{ display: "grid", gap: 28 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center", justifyContent: "space-between" }}>
        <ConnectBar />
        <p className="label">
          {count === undefined ? "Reading the chain" : `${count} ${count === 1 ? "rule" : "rules"} created. ${rules?.length ?? 0} armed.`} ·{" "}
          <a className="link-quiet" style={{ minHeight: 0 }} href={explorer.address(RULES_ADDRESS)} target="_blank" rel="noopener noreferrer">
            Contract
          </a>
        </p>
      </div>
      {acts.err && (
        <p role="alert" className="hint">
          {acts.err}
        </p>
      )}
      {rules && rules.length === 0 && <p className="hint">No armed rules right now.</p>}
      <div style={{ display: "grid", gap: 16 }}>
        {rules?.map((r) => (
          <RuleCard
            key={String(r.id)}
            r={r}
            extra={payout[String(r.id)] ? <p className="hint">{payout[String(r.id)]}</p> : undefined}
            actions={
              <>
                {r.triggered && (
                  <button type="button" className="btn btn-primary" disabled={!w.account || !!acts.busy} onClick={() => acts.execute(r.id)}>
                    {acts.busy === `execute${r.id}` ? "Executing" : "Execute and earn the fee"}
                  </button>
                )}
                {r.kind === 2 && r.currentPrice > r.refPrice && (
                  <button type="button" className="btn btn-ghost" disabled={!w.account || !!acts.busy} onClick={() => acts.poke(r.id)}>
                    {acts.busy === `poke${r.id}` ? "Recording" : "Record new peak"}
                  </button>
                )}
              </>
            }
          />
        ))}
      </div>
    </div>
  );
}
