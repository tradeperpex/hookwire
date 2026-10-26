"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { isAddress } from "viem";
import { explorer } from "@/lib/chain";
import { fmtCompact, fmtPoolFee, fmtPrice, humanPrice, short } from "@/lib/format";
import { hookFlags, ZERO } from "@/lib/hooks";
import { priceQ96 } from "@/lib/rules";
import type { ApiPool } from "./AppBuilder";

function PoolRow({ p }: { p: ApiPool }) {
  const flags = hookFlags(p.hooks);
  const swapHooks = flags.filter((f) => f.level === "warn");
  const sqrt = BigInt(p.sqrtPriceX96);
  const px0 = humanPrice(priceQ96(sqrt, true), p.meta0.decimals, p.meta1.decimals);
  const sellable = (m: ApiPool["meta0"]) => m.address.toLowerCase() !== ZERO;
  return (
    <article className="rcard">
      <header style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <h3 style={{ fontSize: "1.5rem", letterSpacing: "-0.02em" }}>
          {p.meta0.symbol} / {p.meta1.symbol}
        </h3>
        <span className={`badge ${p.hooks.toLowerCase() === ZERO ? "b-off" : swapHooks.length ? "b-hot" : "b-on"}`}>
          {p.hooks.toLowerCase() === ZERO ? "No hook" : swapHooks.length ? "Swap hook" : "Hook"}
        </span>
      </header>
      <dl className="facts" style={{ marginTop: 16 }}>
        <div>
          <dt>Price</dt>
          <dd>
            1 {p.meta0.symbol} = {fmtPrice(px0)} {p.meta1.symbol}
          </dd>
        </div>
        <div>
          <dt>Fee</dt>
          <dd>{fmtPoolFee(p.fee)}</dd>
        </div>
        <div>
          <dt>Liquidity (raw units)</dt>
          <dd>{fmtCompact(Number(p.liquidity))}</dd>
        </div>
      </dl>
      {flags.length > 0 && (
        <p className="hint" style={{ marginTop: 14 }}>
          Hook{" "}
          <a className="link-quiet" style={{ minHeight: 0 }} href={explorer.address(p.hooks)} target="_blank" rel="noopener noreferrer">
            {short(p.hooks)}
          </a>{" "}
          runs on {flags.map((f) => f.name).join(", ")}.
          {swapHooks.length > 0 && " A swap hook can change what a sale pays or block it."}
        </p>
      )}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 16 }}>
        {[p.meta0, p.meta1].filter(sellable).map((m) => (
          <Link key={m.address} className="btn btn-ghost" href={`/app?token=${m.address}&pool=${p.id}`}>
            Write a rule to sell {m.symbol}
          </Link>
        ))}
      </div>
    </article>
  );
}

export function PoolsExplorer() {
  const [recent, setRecent] = useState<ApiPool[]>();
  const [recentErr, setRecentErr] = useState<string>();
  const [q, setQ] = useState("");
  const [found, setFound] = useState<ApiPool[]>();
  const [note, setNote] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [shown, setShown] = useState(8);

  useEffect(() => {
    let off = false;
    fetch("/api/pools/recent")
      .then((r) => r.json())
      .then((d) => !off && (d.error ? setRecentErr(d.error) : setRecent(d.pools)))
      .catch(() => !off && setRecentErr("Could not read recent pools."));
    return () => {
      off = true;
    };
  }, []);

  async function search(e: React.FormEvent) {
    e.preventDefault();
    const a = q.trim();
    if (!isAddress(a)) return setNote("Enter a valid token address.");
    setBusy(true);
    setNote(undefined);
    setFound(undefined);
    try {
      const d = await (await fetch(`/api/pools?token=${a}`)).json();
      if (d.error) setNote(d.error);
      else {
        setFound(d.pools);
        if (!d.complete) setNote(`Showing the newest ${d.pools.length} pools, scanned back to block ${Number(d.scannedFrom).toLocaleString("en-US")}. Search again to scan further back.`);
        else if (d.pools.length === 0) setNote("No initialised v4 pool for this token.");
      }
    } catch {
      setNote("Lookup failed. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 56 }}>
      <section aria-labelledby="find">
        <h2 id="find" className="display-2" style={{ fontSize: "clamp(1.9rem, 1.3rem + 2vw, 2.8rem)" }}>
          Find the pools for a token
        </h2>
        <form onSubmit={search} style={{ marginTop: 24, display: "flex", flexWrap: "wrap", gap: 12 }}>
          <label htmlFor="q" className="sr-only">
            Token address
          </label>
          <input id="q" className="field" style={{ flex: "1 1 320px" }} placeholder="Token address, 0x…" value={q} onChange={(e) => setQ(e.target.value)} spellCheck={false} autoComplete="off" />
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? "Reading the chain" : "Find pools"}
          </button>
        </form>
        {note && (
          <p className="hint" role="status">
            {note}
          </p>
        )}
        <div className="cards" style={{ marginTop: 24 }}>{found?.map((p) => <PoolRow key={p.id} p={p} />)}</div>
      </section>

      <section aria-labelledby="new">
        <h2 id="new" className="display-2" style={{ fontSize: "clamp(1.9rem, 1.3rem + 2vw, 2.8rem)" }}>
          Newest pools with hooks
        </h2>
        <p className="lead" style={{ marginTop: 16 }}>
          Read from the Uniswap v4 PoolManager on Robinhood Chain, last 400,000 blocks. Hooks are decoded from the hook address.
        </p>
        {!recent && !recentErr && <p className="hint">Reading the chain.</p>}
        {recentErr && <p className="hint">{recentErr}</p>}
        {recent && recent.length === 0 && <p className="hint">No hooked pools with liquidity in this window.</p>}
        <div className="cards" style={{ marginTop: 28 }}>
          {recent?.slice(0, shown).map((p) => <PoolRow key={p.id} p={p} />)}
        </div>
        {recent && recent.length > shown && (
          <button type="button" className="btn btn-ghost" style={{ marginTop: 24 }} onClick={() => setShown((n) => n + 8)}>
            Show more
          </button>
        )}
      </section>
    </div>
  );
}
