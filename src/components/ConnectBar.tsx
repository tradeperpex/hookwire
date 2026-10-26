"use client";

import { CHAIN_ID } from "@/lib/chain";
import { short } from "@/lib/format";
import { useWallet } from "@/lib/wallet";

export function ConnectBar() {
  const w = useWallet();
  const wrong = w.account && w.chainId !== CHAIN_ID;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12 }}>
      {!w.account ? (
        <button type="button" className="btn btn-primary" onClick={w.connect} disabled={w.busy}>
          {w.busy ? "Waiting for wallet" : "Connect wallet"}
        </button>
      ) : wrong ? (
        <button type="button" className="btn btn-primary" onClick={w.switchChain}>
          Switch to Robinhood Chain
        </button>
      ) : (
        <>
          <span className="pillbox">
            <span className="live-dot" aria-hidden="true" />
            {short(w.account)}
          </span>
          <button type="button" className="btn btn-ghost" onClick={w.disconnect}>
            Disconnect
          </button>
        </>
      )}
      {w.error && (
        <p role="alert" style={{ color: "var(--ink-2)", fontSize: "0.875rem", flexBasis: "100%" }}>
          {w.error}
        </p>
      )}
    </div>
  );
}
