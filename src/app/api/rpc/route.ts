import { NextResponse } from "next/server";

// Read-only JSON-RPC proxy. Keeps the provider key on the server and only forwards read methods.
const ALLOW = new Set([
  "eth_chainId",
  "net_version",
  "eth_blockNumber",
  "eth_call",
  "eth_getBalance",
  "eth_getCode",
  "eth_getLogs",
  "eth_getTransactionReceipt",
  "eth_getTransactionByHash",
  "eth_getTransactionCount",
  "eth_getBlockByNumber",
  "eth_estimateGas",
  "eth_gasPrice",
  "eth_maxPriorityFeePerGas",
  "eth_feeHistory",
  "eth_getStorageAt",
]);

type Req = { jsonrpc: string; id: unknown; method: string; params?: unknown };

export async function POST(req: Request) {
  const upstream = process.env.ROBINHOOD_RPC_URL;
  if (!upstream) return NextResponse.json({ error: "RPC not configured" }, { status: 503 });

  const text = await req.text();
  if (text.length > 200_000) return NextResponse.json({ error: "too large" }, { status: 413 });
  let body: Req | Req[];
  try {
    body = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }
  const list = Array.isArray(body) ? body : [body];
  if (list.length === 0 || list.length > 50) return NextResponse.json({ error: "bad batch" }, { status: 400 });
  for (const r of list) {
    if (!r || typeof r.method !== "string" || !ALLOW.has(r.method)) {
      return NextResponse.json({ error: `method not allowed: ${String(r?.method)}` }, { status: 403 });
    }
  }

  const res = await fetch(upstream, { method: "POST", headers: { "content-type": "application/json" }, body: text, cache: "no-store" });
  const out = await res.text();
  return new NextResponse(out, { status: res.status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
}
