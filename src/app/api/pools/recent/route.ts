import { NextResponse } from "next/server";
import { hydrate, recentPools } from "@/lib/pools.server";
import { ZERO } from "@/lib/hooks";

export const maxDuration = 60;

export async function GET() {
  try {
    const { pools, head } = await recentPools();
    const hooked = pools.filter((p) => p.hooks.toLowerCase() !== ZERO).sort((a, b) => b.block - a.block).slice(0, 120);
    const full = (await hydrate(hooked)).filter((p) => BigInt(p.liquidity) > 0n).slice(0, 40);
    return NextResponse.json(
      { head: String(head), scanned: pools.length, pools: full },
      { headers: { "cache-control": "public, s-maxage=60, stale-while-revalidate=300" } },
    );
  } catch {
    return NextResponse.json({ error: "Could not read recent pools." }, { status: 502 });
  }
}
