import { createPublicClient, defineChain, formatGwei, http } from "viem";
import { SITE } from "@/lib/site";

// Read-only. No keys, no signing, no funds. Cached for a few seconds so the
// public RPC is not hit once per visitor.
const robinhood = defineChain({
  id: SITE.chainId,
  name: "Robinhood Chain",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [SITE.rpc] } },
  blockExplorers: { default: { name: "Blockscout", url: SITE.explorer } },
});

const client = createPublicClient({
  chain: robinhood,
  transport: http(SITE.rpc, { timeout: 4000, retryCount: 1 }),
});


export async function GET() {
  try {
    const [block, gas] = await Promise.all([client.getBlockNumber(), client.getGasPrice()]);
    return Response.json(
      { ok: true, chainId: SITE.chainId, block: block.toString(), gwei: formatGwei(gas) },
      { headers: { "Cache-Control": "public, s-maxage=10, stale-while-revalidate=30" } },
    );
  } catch {
    return Response.json(
      { ok: false },
      { status: 200, headers: { "Cache-Control": "public, s-maxage=5" } },
    );
  }
}
