import { createPublicClient, http, type PublicClient } from "viem";
import { robinhood } from "./chain";

let cached: PublicClient | undefined;

/** Browser reads go through /api/rpc so the provider key never ships to the client. */
export function getClient(): PublicClient {
  if (cached) return cached;
  const url = typeof window !== "undefined" ? `${window.location.origin}/api/rpc` : (process.env.ROBINHOOD_RPC_URL ?? robinhood.rpcUrls.default.http[0]);
  cached = createPublicClient({
    chain: robinhood,
    transport: http(url, { batch: { batchSize: 20, wait: 16 }, retryCount: 2 }),
    batch: { multicall: true },
  }) as PublicClient;
  return cached;
}
