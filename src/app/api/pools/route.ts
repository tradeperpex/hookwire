import { NextResponse } from "next/server";
import { hydrate, MAX_POOLS, normalizeAddress, poolsForToken } from "@/lib/pools.server";

export const maxDuration = 60;

export async function GET(req: Request) {
  const token = normalizeAddress(new URL(req.url).searchParams.get("token"));
  if (!token) return NextResponse.json({ error: "Invalid token address" }, { status: 400 });
  try {
    const { pools, head, deployed, complete, scannedFrom } = await poolsForToken(token);
    const newest = [...pools].sort((a, b) => b.block - a.block).slice(0, MAX_POOLS);
    const full = (await hydrate(newest)).filter((p) => p.sqrtPriceX96 !== "0");
    full.sort((a, b) => (BigInt(b.liquidity) > BigInt(a.liquidity) ? 1 : -1));
    return NextResponse.json(
      { token, head: String(head), deployedAt: String(deployed), complete, scannedFrom: String(scannedFrom), pools: full },
      { headers: { "cache-control": complete ? "public, s-maxage=20, stale-while-revalidate=60" : "no-store" } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "lookup failed";
    return NextResponse.json({ error: msg === "not a contract" ? "That address is not a token contract on Robinhood Chain." : "Pool lookup failed. Try again." }, { status: 502 });
  }
}
