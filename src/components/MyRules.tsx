"use client";

import { useCallback, useEffect, useState } from "react";
import { RULES_ADDRESS } from "@/lib/chain";
import { getClient } from "@/lib/client";
import { type RuleView, loadRules, rulesContract } from "@/lib/rules";
import { useWallet } from "@/lib/wallet";
import { RuleCard, useRuleActions } from "./RuleCard";

export function MyRules({ refreshKey = 0 }: { refreshKey?: number }) {
  const w = useWallet();
  const [rules, setRules] = useState<RuleView[]>();
  const [err, setErr] = useState<string>();
  const [tick, setTick] = useState(0);
  const acts = useRuleActions(() => setTick((t) => t + 1));

  const load = useCallback(async () => {
    if (!w.account || !RULES_ADDRESS) return;
    try {
      const ids = (await getClient().readContract({ ...rulesContract(), functionName: "rulesOf", args: [w.account] })) as readonly bigint[];
      const list = await loadRules([...ids].reverse());
      setRules(list);
      setErr(undefined);
    } catch {
      setErr("Could not read your rules. Retrying.");
    }
  }, [w.account]);

  useEffect(() => {
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [load, refreshKey, tick]);

  return (
    <section aria-labelledby="mine">
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <h2 id="mine" className="display-2" style={{ fontSize: "clamp(1.9rem, 1.3rem + 2vw, 2.8rem)" }}>
          Your rules
        </h2>
        <p className="label">Refreshes every 15 seconds</p>
      </div>
      <div style={{ marginTop: 28, display: "grid", gap: 16 }}>
        {!RULES_ADDRESS && <p className="hint">Rules appear here once the rule contract is deployed.</p>}
        {RULES_ADDRESS && !w.account && <p className="hint">Connect a wallet to see your rules.</p>}
        {err && <p className="hint">{err}</p>}
        {acts.err && (
          <p role="alert" className="hint">
            {acts.err}
          </p>
        )}
        {w.account && rules && rules.length === 0 && <p className="hint">No rules yet. Create one above.</p>}
        {rules?.map((r) => (
          <RuleCard
            key={String(r.id)}
            r={r}
            actions={
              r.status === 1 && !r.expired ? (
                <>
                  {r.triggered && (
                    <button type="button" className="btn btn-primary" disabled={!!acts.busy} onClick={() => acts.execute(r.id)}>
                      {acts.busy === `execute${r.id}` ? "Executing" : "Execute now"}
                    </button>
                  )}
                  {r.kind === 2 && r.currentPrice > r.refPrice && (
                    <button type="button" className="btn btn-ghost" disabled={!!acts.busy} onClick={() => acts.poke(r.id)}>
                      {acts.busy === `poke${r.id}` ? "Recording" : "Record new peak"}
                    </button>
                  )}
                  <button type="button" className="btn btn-ghost" disabled={!!acts.busy} onClick={() => acts.cancel(r.id)}>
                    {acts.busy === `cancel${r.id}` ? "Cancelling" : "Cancel rule"}
                  </button>
                </>
              ) : undefined
            }
          />
        ))}
      </div>
    </section>
  );
}
