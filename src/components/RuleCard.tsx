"use client";

import { useState } from "react";
import type { Address } from "viem";
import { RULES_ADDRESS, explorer, robinhood } from "@/lib/chain";
import { getClient } from "@/lib/client";
import { fmtPoolFee, fmtPrice, fmtToken, humanPrice, short, timeLeft } from "@/lib/format";
import { KIND, STATUS, type RuleView, ruleLabel, rulesContract } from "@/lib/rules";
import { useWallet } from "@/lib/wallet";

export function useRuleActions(onDone: () => void) {
  const w = useWallet();
  const [busy, setBusy] = useState<string>();
  const [err, setErr] = useState<string>();

  async function run(label: string, fn: "cancel" | "execute" | "poke", id: bigint) {
    const wc = w.walletClient();
    if (!wc || !w.account || !RULES_ADDRESS) return;
    setBusy(`${label}${id}`);
    setErr(undefined);
    try {
      // Simulate first so a keeper does not pay gas for a revert.
      await getClient().simulateContract({ ...rulesContract(), functionName: fn, args: [id], account: w.account });
      const hash = await wc.writeContract({ ...rulesContract(), functionName: fn, args: [id], chain: robinhood, account: w.account });
      await getClient().waitForTransactionReceipt({ hash });
      onDone();
    } catch (e) {
      const m = (e as { shortMessage?: string; message?: string }).shortMessage ?? (e as Error).message ?? "Failed.";
      setErr(m.split("\n")[0]);
    } finally {
      setBusy(undefined);
    }
  }
  return { busy, err, cancel: (id: bigint) => run("cancel", "cancel", id), execute: (id: bigint) => run("execute", "execute", id), poke: (id: bigint) => run("poke", "poke", id) };
}

function badge(r: RuleView) {
  if (r.status === 2) return { text: "Executed", cls: "b-done" };
  if (r.status === 3) return { text: "Cancelled", cls: "b-off" };
  if (r.status === 1 && r.expired) return { text: "Expired", cls: "b-off" };
  if (r.status === 1 && r.triggered) return { text: "Triggered", cls: "b-hot" };
  if (r.status === 1) return { text: "Armed", cls: "b-on" };
  return { text: STATUS[r.status] ?? "Unknown", cls: "b-off" };
}

export function RuleCard({ r, actions, extra }: { r: RuleView; actions?: React.ReactNode; extra?: React.ReactNode }) {
  const b = badge(r);
  const dIn = r.metaIn.decimals;
  const dOut = r.metaOut.decimals;
  const px = (q: bigint) => `${fmtPrice(humanPrice(q, dIn, dOut))} ${r.metaOut.symbol}`;
  const active = r.status === 1 && !r.expired;

  let dist = "";
  if (active && r.currentPrice > 0n && r.triggerPrice > 0n) {
    if (r.triggered) dist = "At the trigger now";
    else if (r.kind === KIND.TAKE_PROFIT) dist = `${((Number(r.triggerPrice) / Number(r.currentPrice) - 1) * 100).toFixed(1)}% to go`;
    else dist = `${((Number(r.currentPrice) / Number(r.triggerPrice) - 1) * 100).toFixed(1)}% above the trigger`;
  }

  return (
    <article className="rcard" aria-label={`Rule ${r.id}`}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
        <div>
          <p className="label">Rule {String(r.id)}</p>
          <h3 style={{ fontSize: "1.5rem", letterSpacing: "-0.02em", lineHeight: 1.15, marginTop: 6 }}>
            Sell {r.metaIn.symbol} when price {ruleLabel(r.kind, r.triggerBps)}
          </h3>
        </div>
        <span className={`badge ${b.cls}`}>{b.text}</span>
      </header>
      <dl className="facts" style={{ marginTop: 18 }}>
        <div>
          <dt>Up to</dt>
          <dd>
            {fmtToken(r.amountIn, dIn)} {r.metaIn.symbol}
            {active && r.sellable < r.amountIn && <span className="warn"> Only {fmtToken(r.sellable, dIn)} sellable now</span>}
          </dd>
        </div>
        <div>
          <dt>{r.kind === KIND.TRAILING_STOP ? "Peak so far" : "Entry"}</dt>
          <dd>{px(r.refPrice)}</dd>
        </div>
        <div>
          <dt>Trigger</dt>
          <dd>{r.triggerPrice > 0n ? px(r.triggerPrice) : "–"}</dd>
        </div>
        <div>
          <dt>Price now</dt>
          <dd>
            {r.currentPrice > 0n ? px(r.currentPrice) : "–"}
            {dist && <span className="hint" style={{ display: "block", margin: 0 }}>{dist}</span>}
          </dd>
        </div>
      </dl>
      <p className="hint" style={{ marginTop: 14 }}>
        Pool fee {fmtPoolFee(r.key.fee)} · slippage {r.slippageBps / 100}% · keeper fee {r.keeperFeeBps / 100}% · {active ? timeLeft(r.expiry) : "ended"} · owner{" "}
        <a className="link-quiet" style={{ minHeight: 0 }} href={explorer.address(r.owner)} target="_blank" rel="noopener noreferrer">
          {short(r.owner)}
        </a>
      </p>
      {r.kind === KIND.TRAILING_STOP && active && (
        <p className="hint">The stored peak only rises when someone records it. If the price ran up since, the real trigger is higher than shown, and a keeper will use it.</p>
      )}
      {extra}
      {actions && <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 16 }}>{actions}</div>}
    </article>
  );
}

export type { Address };
