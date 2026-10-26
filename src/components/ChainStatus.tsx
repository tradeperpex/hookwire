"use client";

import { useEffect, useState } from "react";

type State = { kind: "loading" } | { kind: "ok"; block: string; gwei: string } | { kind: "off" };

export function ChainStatus() {
  const [s, setS] = useState<State>({ kind: "loading" });

  useEffect(() => {
    let dead = false;
    const read = async () => {
      try {
        const r = await fetch("/api/chain", { cache: "no-store" });
        const j = await r.json();
        if (dead) return;
        if (j.ok) setS({ kind: "ok", block: j.block, gwei: j.gwei });
        else setS({ kind: "off" });
      } catch {
        if (!dead) setS({ kind: "off" });
      }
    };
    read();
    const t = setInterval(read, 20000);
    return () => {
      dead = true;
      clearInterval(t);
    };
  }, []);

  return (
    <p className="label" style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
        <span className="live-dot" aria-hidden="true" style={s.kind === "off" ? { background: "var(--faint)", animation: "none" } : undefined} />
        Robinhood Chain
      </span>
      <span aria-hidden="true" style={{ color: "var(--faint)" }}>
        /
      </span>
      <span aria-live="polite">
        {s.kind === "ok" && (
          <>
            Block {Number(s.block).toLocaleString("en-US")}
          </>
        )}
        {s.kind === "loading" && "Reading chain"}
        {s.kind === "off" && "Chain read unavailable"}
      </span>
    </p>
  );
}
