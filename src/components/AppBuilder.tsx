"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getAddress, isAddress, type Address } from "viem";
import { erc20Abi, stateViewAbi } from "@/lib/abis";
import { CHAIN_ID, NATIVE, RULES_ADDRESS, UNISWAP, explorer, robinhood } from "@/lib/chain";
import { getClient } from "@/lib/client";
import { fmtCompact, fmtPrice, fmtToken, humanPrice, short, fmtPoolFee } from "@/lib/format";
import { hookFlags, ZERO } from "@/lib/hooks";
import { KIND, type KindId, type Meta, priceQ96, quoteSell, readMetas, ruleLabel, rulesContract, triggerPriceFor } from "@/lib/rules";
import { useWallet } from "@/lib/wallet";
import { ConnectBar } from "./ConnectBar";
import { MyRules } from "./MyRules";

export type ApiPool = {
  id: `0x${string}`;
  currency0: Address;
  currency1: Address;
  fee: number;
  tickSpacing: number;
  hooks: Address;
  block: number;
  sqrtPriceX96: string;
  liquidity: string;
  meta0: { address: Address; symbol: string; decimals: number; name: string };
  meta1: { address: Address; symbol: string; decimals: number; name: string };
};

const KINDS: { id: "trail" | "stop" | "take"; label: string; unit: string; def: string; kind: KindId }[] = [
  { id: "trail", label: "Falls from its peak", unit: "%", def: "30", kind: KIND.TRAILING_STOP },
  { id: "stop", label: "Drops below entry", unit: "%", def: "30", kind: KIND.STOP_LOSS },
  { id: "take", label: "Reaches a multiple", unit: "x", def: "3", kind: KIND.TAKE_PROFIT },
];
const AMOUNTS = [25, 50, 75, 100];
const EXPIRY = [
  { id: "1h", label: "1 hour", s: 3600 },
  { id: "24h", label: "24 hours", s: 86400 },
  { id: "7d", label: "7 days", s: 604800 },
  { id: "30d", label: "30 days", s: 2592000 },
];
const SLIP = [1, 3, 5, 10, 25];
const FEES = [
  { bps: 30, label: "0.3%" },
  { bps: 50, label: "0.5%" },
  { bps: 100, label: "1%" },
  { bps: 200, label: "2%" },
];

type Phase = "idle" | "approve" | "create" | "done" | "error";

export function AppBuilder() {
  const w = useWallet();
  const sp = useSearchParams();
  const [tokenInput, setTokenInput] = useState(sp.get("token") ?? "");
  const [meta, setMeta] = useState<Meta>();
  const [bal, setBal] = useState<bigint>(0n);
  const [allow, setAllow] = useState<bigint>(0n);
  const [pools, setPools] = useState<ApiPool[]>([]);
  const [poolNote, setPoolNote] = useState<{ complete: boolean; scannedFrom: string } | null>(null);
  const [poolId, setPoolId] = useState<string | undefined>(sp.get("pool") ?? undefined);
  const [loadingPools, setLoadingPools] = useState(false);
  const [lookupErr, setLookupErr] = useState<string>();
  const [sqrt, setSqrt] = useState<bigint>(0n);

  const [kindId, setKindId] = useState<(typeof KINDS)[number]["id"]>("trail");
  const [value, setValue] = useState("30");
  const [pct, setPct] = useState(100);
  const [expiry, setExpiry] = useState("24h");
  const [slip, setSlip] = useState(10);
  const [limit, setLimit] = useState(true);
  const [feeBps, setFeeBps] = useState(50);
  const [quote, setQuote] = useState<bigint | null>(null);

  const [phase, setPhase] = useState<Phase>("idle");
  const [msg, setMsg] = useState<string>();
  const [lastTx, setLastTx] = useState<string>();
  const [bump, setBump] = useState(0);

  const token = useMemo(() => (isAddress(tokenInput.trim()) ? (getAddress(tokenInput.trim()) as Address) : undefined), [tokenInput]);
  const kindDef = KINDS.find((k) => k.id === kindId)!;
  const pool = pools.find((p) => p.id === poolId);
  const zeroForOne = !!pool && !!token && pool.currency0.toLowerCase() === token.toLowerCase();
  const other = pool ? (zeroForOne ? pool.meta1 : pool.meta0) : undefined;

  // Token meta, balance and allowance.
  useEffect(() => {
    setMeta(undefined);
    if (!token) return;
    let off = false;
    readMetas([token]).then((m) => !off && setMeta(m.get(token.toLowerCase())));
    return () => {
      off = true;
    };
  }, [token]);

  useEffect(() => {
    if (!token || !w.account) {
      setBal(0n);
      setAllow(0n);
      return;
    }
    let off = false;
    const run = async () => {
      const r = await getClient().multicall({
        contracts: [
          { address: token, abi: erc20Abi, functionName: "balanceOf", args: [w.account!] },
          { address: token, abi: erc20Abi, functionName: "allowance", args: [w.account!, (RULES_ADDRESS || NATIVE) as Address] },
        ],
        allowFailure: true,
      });
      if (off) return;
      setBal(r[0].status === "success" ? (r[0].result as bigint) : 0n);
      setAllow(r[1].status === "success" ? (r[1].result as bigint) : 0n);
    };
    run().catch(() => {});
    const t = setInterval(() => run().catch(() => {}), 15000);
    return () => {
      off = true;
      clearInterval(t);
    };
  }, [token, w.account, bump]);

  // Pools for the token.
  useEffect(() => {
    setPools([]);
    setPoolNote(null);
    setLookupErr(undefined);
    if (!token) return;
    let off = false;
    setLoadingPools(true);
    fetch(`/api/pools?token=${token}`)
      .then((r) => r.json())
      .then((d) => {
        if (off) return;
        if (d.error) return setLookupErr(d.error);
        const list: ApiPool[] = d.pools;
        setPools(list);
        setPoolNote({ complete: d.complete, scannedFrom: d.scannedFrom });
        setPoolId((cur) => {
          if (cur && list.some((p) => p.id === cur)) return cur;
          const plain = list.filter((p) => p.hooks.toLowerCase() === ZERO);
          return (plain[0] ?? list[0])?.id;
        });
      })
      .catch(() => !off && setLookupErr("Pool lookup failed. Try again."))
      .finally(() => !off && setLoadingPools(false));
    return () => {
      off = true;
    };
  }, [token]);

  // Live pool price.
  useEffect(() => {
    if (!pool) return setSqrt(0n);
    setSqrt(BigInt(pool.sqrtPriceX96));
    let off = false;
    const run = async () => {
      const r = await getClient().readContract({ address: UNISWAP.stateView, abi: stateViewAbi, functionName: "getSlot0", args: [pool.id] });
      if (!off) setSqrt((r as unknown as readonly [bigint])[0]);
    };
    const t = setInterval(() => run().catch(() => {}), 12000);
    return () => {
      off = true;
      clearInterval(t);
    };
  }, [pool]);

  const spot = pool ? priceQ96(sqrt, zeroForOne) : 0n;
  const amountIn = (bal * BigInt(pct)) / 100n;
  const decIn = meta?.decimals ?? 18;
  const decOut = other?.decimals ?? 18;

  const valueNum = Number(value);
  const valueOk = kindId === "take" ? valueNum > 1 && valueNum <= 1000 : valueNum >= 1 && valueNum <= 95;
  const triggerBps = kindId === "take" ? Math.round(valueNum * 10_000) : Math.round(valueNum * 100);
  const triggerPrice = spot > 0n && valueOk ? triggerPriceFor(kindDef.kind, triggerBps, spot) : 0n;
  // Price floor. The sale must fill at no worse than the trigger price minus the chosen slippage. This
  // stops anyone from pushing the pool price down inside one block to force a sale at a bad price.
  // Take profit always has it. Stop loss and trailing stop can turn it off, so they still sell after a gap.
  const floorOn = kindId === "take" || limit;
  const floorPrice = triggerPrice > 0n ? (triggerPrice * BigInt(100 - slip)) / 100n : 0n;
  const minOut = floorOn && triggerPrice > 0n ? (((amountIn * triggerPrice) >> 96n) * BigInt(100 - slip)) / 100n : 0n;

  // Quote the sale at today's price.
  useEffect(() => {
    setQuote(null);
    if (!pool || amountIn === 0n || amountIn >= 1n << 128n) return;
    let off = false;
    const t = setTimeout(() => {
      quoteSell(
        { currency0: pool.currency0, currency1: pool.currency1, fee: pool.fee, tickSpacing: pool.tickSpacing, hooks: pool.hooks },
        zeroForOne,
        amountIn,
      ).then((q) => !off && setQuote(q));
    }, 300);
    return () => {
      off = true;
      clearTimeout(t);
    };
  }, [pool, amountIn, zeroForOne]);

  const expectedAtSpot = spot > 0n ? (amountIn * spot) >> 96n : 0n;
  const impact = quote !== null && expectedAtSpot > 0n ? Number(((expectedAtSpot - quote) * 10000n) / expectedAtSpot) / 100 : null;

  const wrongChain = w.chainId !== undefined && w.chainId !== CHAIN_ID;
  const needsApprove = allow < amountIn;
  const sentence = meta ? `When ${meta.symbol} ${valueOk ? ruleLabel(kindDef.kind, triggerBps) : "…"}, sell ${pct === 100 ? "all" : `${pct}%`}.` : "";

  const submit = useCallback(async () => {
    const wc = w.walletClient();
    if (!wc || !token || !pool || !w.account || !RULES_ADDRESS) return;
    setMsg(undefined);
    try {
      const c = getClient();
      if (allow < amountIn) {
        setPhase("approve");
        const h = await wc.writeContract({ address: token, abi: erc20Abi, functionName: "approve", args: [RULES_ADDRESS, amountIn], chain: robinhood, account: w.account });
        setLastTx(h);
        await c.waitForTransactionReceipt({ hash: h });
        setAllow(amountIn);
      }
      setPhase("create");
      const exp = BigInt(Math.floor(Date.now() / 1000) + EXPIRY.find((e) => e.id === expiry)!.s);
      const h2 = await wc.writeContract({
        ...rulesContract(),
        functionName: "createRule",
        args: [
          { currency0: pool.currency0, currency1: pool.currency1, fee: pool.fee, tickSpacing: pool.tickSpacing, hooks: pool.hooks },
          token,
          kindDef.kind,
          triggerBps,
          amountIn,
          slip * 100,
          feeBps,
          exp,
          minOut,
        ],
        chain: robinhood,
        account: w.account,
      });
      setLastTx(h2);
      const rc = await c.waitForTransactionReceipt({ hash: h2 });
      if (rc.status !== "success") throw new Error("Transaction reverted.");
      setPhase("done");
      setBump((b) => b + 1);
    } catch (e) {
      const m = (e as { shortMessage?: string; message?: string }).shortMessage ?? (e as Error).message ?? "Transaction failed.";
      setPhase("error");
      setMsg(m.split("\n")[0]);
    }
  }, [w, token, pool, allow, amountIn, expiry, kindDef.kind, triggerBps, slip, feeBps, minOut]);

  async function killSwitch() {
    const wc = w.walletClient();
    if (!wc || !token || !w.account || !RULES_ADDRESS) return;
    try {
      const h = await wc.writeContract({ address: token, abi: erc20Abi, functionName: "approve", args: [RULES_ADDRESS, 0n], chain: robinhood, account: w.account });
      await getClient().waitForTransactionReceipt({ hash: h });
      setBump((b) => b + 1);
    } catch (e) {
      setMsg(((e as { shortMessage?: string }).shortMessage ?? "Could not revoke.").split("\n")[0]);
    }
  }

  const busy = phase === "approve" || phase === "create";
  const canSubmit = !!w.account && !wrongChain && !!pool && !!token && valueOk && amountIn > 0n && !!RULES_ADDRESS && !busy;
  const hooks = pool ? hookFlags(pool.hooks) : [];
  const swapHooks = hooks.some((h) => h.level === "warn");

  return (
    <div style={{ display: "grid", gap: 56 }}>
      <div className="two" style={{ gap: 40 }}>
        <div className="panel" style={{ display: "grid", gap: 28 }}>
          <div>
            <label className="fieldlabel" htmlFor="token">
              Token to sell
            </label>
            <input
              id="token"
              className="field"
              placeholder="Paste a token address, 0x…"
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              spellCheck={false}
              autoComplete="off"
              aria-invalid={tokenInput !== "" && !token}
            />
            <p className="hint">
              {tokenInput && !token
                ? "That is not a valid address."
                : meta
                  ? `${meta.symbol}, ${decIn} decimals.${w.account ? ` You hold ${fmtToken(bal, decIn)}.` : ""}`
                  : "Any ERC-20 that trades in a Uniswap v4 pool on Robinhood Chain."}
            </p>
          </div>

          {token && (
            <div>
              <p className="fieldlabel">Pool</p>
              {loadingPools && <p className="hint">Reading the chain for pools. Older tokens can take a while.</p>}
              {lookupErr && (
                <p role="alert" className="hint">
                  {lookupErr}
                </p>
              )}
              {!loadingPools && !lookupErr && pools.length === 0 && token && <p className="hint">No initialised v4 pool found for this token.</p>}
              <div role="radiogroup" aria-label="Pool" style={{ display: "grid", gap: 8, marginTop: 10 }}>
                {pools.slice(0, 8).map((p) => {
                  const z = p.currency0.toLowerCase() === token.toLowerCase();
                  const o = z ? p.meta1 : p.meta0;
                  const f = hookFlags(p.hooks);
                  const sel = p.id === poolId;
                  return (
                    <button key={p.id} type="button" role="radio" aria-checked={sel} className="poolopt" data-sel={sel} onClick={() => setPoolId(p.id)}>
                      <span style={{ fontWeight: 600 }}>
                        {z ? p.meta0.symbol : p.meta1.symbol} / {o.symbol}
                      </span>
                      <span className="hint" style={{ margin: 0 }}>
                        fee {fmtPoolFee(p.fee)} · liquidity {fmtCompact(Number(p.liquidity))} · {f.length ? `hook ${short(p.hooks)}` : "no hook"}
                      </span>
                    </button>
                  );
                })}
              </div>
              {poolNote && !poolNote.complete && (
                <p className="hint">Showing the newest pools. Scanned back to block {Number(poolNote.scannedFrom).toLocaleString("en-US")}.</p>
              )}
              {pool && swapHooks && (
                <p className="callout" role="note">
                  This pool has a hook that runs on swaps ({hooks.filter((h) => h.level === "warn").map((h) => h.name).join(", ")}). A hook like that can change what you receive or block a sale. A rule on this pool may not execute.
                </p>
              )}
            </div>
          )}

          <div>
            <p className="fieldlabel" id="kind-l">
              When the price
            </p>
            <div className="seg" role="group" aria-labelledby="kind-l" style={{ marginTop: 10, flexWrap: "wrap" }}>
              {KINDS.map((k) => (
                <button
                  key={k.id}
                  type="button"
                  aria-pressed={kindId === k.id}
                  onClick={() => {
                    setKindId(k.id);
                    setValue(k.def);
                  }}
                >
                  {k.label}
                </button>
              ))}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12 }}>
              <input
                aria-label={kindId === "take" ? "Target multiple" : "Percent"}
                className="field"
                style={{ maxWidth: 140 }}
                inputMode="decimal"
                value={value}
                onChange={(e) => setValue(e.target.value.replace(/[^0-9.]/g, ""))}
              />
              <span style={{ fontWeight: 600 }}>{kindDef.unit}</span>
            </div>
            {!valueOk && (
              <p className="hint" role="alert">
                {kindId === "take" ? "Enter a multiple above 1x, up to 1000x." : "Enter a percent from 1 to 95."}
              </p>
            )}
          </div>

          <div>
            <p className="fieldlabel" id="amt-l">
              Sell
            </p>
            <div className="seg" role="group" aria-labelledby="amt-l" style={{ marginTop: 10 }}>
              {AMOUNTS.map((a) => (
                <button key={a} type="button" aria-pressed={pct === a} onClick={() => setPct(a)}>
                  {a === 100 ? "All" : `${a}%`}
                </button>
              ))}
            </div>
            <p className="hint">
              {meta ? `${fmtToken(amountIn, decIn)} ${meta.symbol}. If your balance is lower when the rule runs, it sells what is there.` : ""}
            </p>
          </div>

          <details className="adv">
            <summary>Limits and fees</summary>
            <div style={{ display: "grid", gap: 20, marginTop: 16 }}>
              <div>
                <p className="fieldlabel" id="exp-l">
                  Expires
                </p>
                <div className="seg" role="group" aria-labelledby="exp-l" style={{ marginTop: 10, flexWrap: "wrap" }}>
                  {EXPIRY.map((e) => (
                    <button key={e.id} type="button" aria-pressed={expiry === e.id} onClick={() => setExpiry(e.id)}>
                      {e.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="fieldlabel" id="slip-l">
                  Max slippage against spot
                </p>
                <div className="seg" role="group" aria-labelledby="slip-l" style={{ marginTop: 10, flexWrap: "wrap" }}>
                  {SLIP.map((s) => (
                    <button key={s} type="button" aria-pressed={slip === s} onClick={() => setSlip(s)}>
                      {s}%
                    </button>
                  ))}
                </div>
                <p className="hint">If the fill would be worse than this, the rule does not run and stays active.</p>
              </div>
              {kindId !== "take" && (
                <div>
                  <p className="fieldlabel" id="floor-l">
                    Price floor
                  </p>
                  <div className="seg" role="group" aria-labelledby="floor-l" style={{ marginTop: 10 }}>
                    <button type="button" aria-pressed={limit} onClick={() => setLimit(true)}>
                      On
                    </button>
                    <button type="button" aria-pressed={!limit} onClick={() => setLimit(false)}>
                      Off
                    </button>
                  </div>
                  <p className="hint">
                    {limit
                      ? "The rule will not sell for less than the trigger price minus your slippage. This blocks forced sales at a pushed price, but if the price gaps far below the trigger the rule waits instead of selling."
                      : "The rule sells at whatever the pool pays once it triggers, within your slippage of the price at that moment. It still fires after a gap down, but a pushed price can force a sale at a bad rate."}
                  </p>
                </div>
              )}
              {kindId === "take" && (
                <p className="hint">A take profit never sells for less than its trigger price minus your slippage.</p>
              )}
              <div>
                <p className="fieldlabel" id="fee-l">
                  Keeper fee
                </p>
                <div className="seg" role="group" aria-labelledby="fee-l" style={{ marginTop: 10, flexWrap: "wrap" }}>
                  {FEES.map((f) => (
                    <button key={f.bps} type="button" aria-pressed={feeBps === f.bps} onClick={() => setFeeBps(f.bps)}>
                      {f.label}
                    </button>
                  ))}
                </div>
                <p className="hint">Paid from the proceeds to whoever executes the rule. A higher fee gets picked up faster.</p>
              </div>
            </div>
          </details>
        </div>

        <div className="panel panel-alt" style={{ display: "grid", gap: 20, alignContent: "start" }}>
          <p className="label">Your rule</p>
          <p style={{ fontFamily: "var(--font-display)", fontSize: "clamp(1.7rem, 1.2rem + 1.6vw, 2.4rem)", lineHeight: 1.1, letterSpacing: "-0.02em", minHeight: "2.2em" }}>
            {sentence || "Paste a token to start."}
          </p>

          <dl className="facts">
            <div>
              <dt>Price now</dt>
              <dd>{spot > 0n && meta && other ? `${fmtPrice(humanPrice(spot, decIn, decOut))} ${other.symbol}` : "–"}</dd>
            </div>
            <div>
              <dt>{kindId === "take" ? "Sells at" : "Sells when price is at or under"}</dt>
              <dd>{triggerPrice > 0n && meta && other ? `${fmtPrice(humanPrice(triggerPrice, decIn, decOut))} ${other.symbol}` : "–"}</dd>
            </div>
            <div>
              <dt>Will not sell below</dt>
              <dd>{floorOn && floorPrice > 0n && meta && other ? `${fmtPrice(humanPrice(floorPrice, decIn, decOut))} ${other.symbol}` : floorOn ? "–" : "No floor"}</dd>
            </div>
            <div>
              <dt>Estimated proceeds today</dt>
              <dd>{quote !== null && other ? `${fmtToken(quote, decOut)} ${other.symbol}` : amountIn > 0n && pool ? "Quoting" : "–"}</dd>
            </div>
            <div>
              <dt>Price impact incl. pool fee today</dt>
              <dd>
                {impact !== null ? `${impact.toFixed(2)}%` : "–"}
                {impact !== null && impact > slip && <span className="warn"> More than your slippage</span>}
              </dd>
            </div>
            <div>
              <dt>Most it can ever sell</dt>
              <dd>{meta ? `${fmtToken(amountIn, decIn)} ${meta.symbol}` : "–"}</dd>
            </div>
          </dl>

          <p className="hint" style={{ margin: 0 }}>
            The trigger reads the pool spot price. Spot can be pushed inside a block, so keep amounts you can afford to lose and use a slippage you accept.
          </p>

          <div className="hair" />

          {!RULES_ADDRESS ? (
            <div role="status" className="callout" style={{ margin: 0 }}>
              <strong>Rule contract not deployed yet.</strong> Everything above is live and reads mainnet, but creating a rule needs the contract address. See the deploy steps in the README.
            </div>
          ) : (
            <div style={{ display: "grid", gap: 14 }}>
              <ConnectBar />
              {w.account && !wrongChain && (
                <button type="button" className="btn btn-primary" onClick={submit} disabled={!canSubmit} style={{ width: "100%", minHeight: 52 }}>
                  {phase === "approve"
                    ? "Approve in your wallet"
                    : phase === "create"
                      ? "Create the rule in your wallet"
                      : needsApprove
                        ? `Approve ${meta ? fmtToken(amountIn, decIn) : ""} ${meta?.symbol ?? ""} and create`
                        : "Create rule"}
                </button>
              )}
              {phase === "done" && (
                <p role="status" className="hint" style={{ color: "var(--ink)" }}>
                  Rule created.{" "}
                  {lastTx && (
                    <a className="link-quiet" style={{ minHeight: 0 }} href={explorer.tx(lastTx)} target="_blank" rel="noopener noreferrer">
                      View transaction
                    </a>
                  )}
                </p>
              )}
              {phase === "error" && (
                <p role="alert" className="hint">
                  {msg}
                </p>
              )}
              {w.account && token && allow > 0n && (
                <p className="hint" style={{ margin: 0 }}>
                  Allowance to Hookwire: {fmtToken(allow, decIn)} {meta?.symbol}.{" "}
                  <button type="button" className="textbtn" onClick={killSwitch}>
                    Set it to zero
                  </button>
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      <MyRules refreshKey={bump} />
      <p className="label">
        <Link href="/docs" className="link-quiet" style={{ minHeight: 0 }}>
          How rules execute, and what can go wrong
        </Link>
      </p>
    </div>
  );
}

