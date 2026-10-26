import { createPublicClient, http, isAddress, getAddress, type Address, type PublicClient } from "viem";
import { robinhood, UNISWAP, NATIVE } from "./chain";
import { erc20Abi, initializeEvent, stateViewAbi } from "./abis";

export type RawPool = {
  id: `0x${string}`;
  currency0: Address;
  currency1: Address;
  fee: number;
  tickSpacing: number;
  hooks: Address;
  block: number;
};

export type TokenMeta = { address: Address; symbol: string; name: string; decimals: number };

export type Pool = RawPool & {
  sqrtPriceX96: string;
  liquidity: string;
  meta0: TokenMeta;
  meta1: TokenMeta;
};

const STEP = 99_000n;

function client(): PublicClient {
  return createPublicClient({
    chain: robinhood,
    transport: http(process.env.ROBINHOOD_RPC_URL ?? robinhood.rpcUrls.default.http[0], { retryCount: 3, retryDelay: 300 }),
    batch: { multicall: true },
  }) as PublicClient;
}

async function pmap<T, R>(items: T[], n: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (i < items.length) {
        const k = i++;
        out[k] = await fn(items[k]);
      }
    }),
  );
  return out;
}

export function normalizeAddress(a: string | null): Address | null {
  if (!a || !isAddress(a)) return null;
  return getAddress(a) as Address;
}

const deployCache = new Map<string, bigint>();

/** Binary search for the first block where the token has code. Needs an archive RPC. */
export async function deployBlock(token: Address, head: bigint): Promise<bigint> {
  const hit = deployCache.get(token);
  if (hit !== undefined) return hit;
  const c = client();
  const atHead = await c.getCode({ address: token });
  if (!atHead || atHead === "0x") throw new Error("not a contract");
  let lo = 0n;
  let hi = head;
  while (lo < hi) {
    const mid = (lo + hi) / 2n;
    const code = await c.getCode({ address: token, blockNumber: mid });
    if (code && code !== "0x") hi = mid;
    else lo = mid + 1n;
  }
  deployCache.set(token, lo);
  return lo;
}

async function scan(from: bigint, to: bigint, args: Record<string, Address>, concurrency = 12): Promise<RawPool[]> {
  const c = client();
  const ranges: [bigint, bigint][] = [];
  for (let s = from; s <= to; s += STEP) ranges.push([s, s + STEP - 1n > to ? to : s + STEP - 1n]);
  const chunks = await pmap(ranges, concurrency, async ([a, b]) => {
    const logs = await c.getLogs({ address: UNISWAP.poolManager, event: initializeEvent, args, fromBlock: a, toBlock: b });
    return logs.map(
      (l): RawPool => ({
        id: l.args.id!,
        currency0: l.args.currency0!,
        currency1: l.args.currency1!,
        fee: Number(l.args.fee),
        tickSpacing: Number(l.args.tickSpacing),
        hooks: l.args.hooks!,
        block: Number(l.blockNumber),
      }),
    );
  });
  return chunks.flat();
}

type TokenScan = { forwardTo: bigint; backFrom: bigint; deployed: bigint; pools: Map<string, RawPool> };
const tokenCache = new Map<string, TokenScan>();
const BUDGET_MS = 20_000;
export const MAX_POOLS = 300;

async function scanBack(token: Address, from: bigint, to: bigint, deadline: number): Promise<{ pools: RawPool[]; reachedBlock: bigint }> {
  // Newest first, in batches, until the time budget runs out. Returns how far back we got.
  const out: RawPool[] = [];
  let hi = to;
  while (hi >= from && Date.now() < deadline && out.length < MAX_POOLS) {
    const batch: [bigint, bigint][] = [];
    for (let i = 0; i < 8 && hi >= from; i++) {
      const lo = hi - STEP + 1n < from ? from : hi - STEP + 1n;
      batch.push([lo, hi]);
      hi = lo - 1n;
    }
    const got = await Promise.all(
      batch.flatMap(([lo, h]) => [scan(lo, h, { currency0: token }, 1), scan(lo, h, { currency1: token }, 1)]),
    );
    out.push(...got.flat());
  }
  return { pools: out, reachedBlock: hi + 1n };
}

export async function poolsForToken(token: Address): Promise<{ pools: RawPool[]; head: bigint; deployed: bigint; complete: boolean; scannedFrom: bigint }> {
  const c = client();
  const head = await c.getBlockNumber();
  const deployed = await deployBlock(token, head);
  const deadline = Date.now() + BUDGET_MS;
  let st = tokenCache.get(token);
  if (!st) {
    st = { forwardTo: head, backFrom: head + 1n, deployed, pools: new Map() };
    tokenCache.set(token, st);
  } else if (head > st.forwardTo) {
    const [a, b] = await Promise.all([
      scan(st.forwardTo + 1n, head, { currency0: token }),
      scan(st.forwardTo + 1n, head, { currency1: token }),
    ]);
    for (const p of [...a, ...b]) st.pools.set(p.id, p);
    st.forwardTo = head;
  }
  if (st.backFrom > deployed) {
    const { pools, reachedBlock } = await scanBack(token, deployed, st.backFrom - 1n, deadline);
    for (const p of pools) st.pools.set(p.id, p);
    st.backFrom = reachedBlock;
  }
  return { pools: [...st.pools.values()], head, deployed, complete: st.backFrom <= deployed, scannedFrom: st.backFrom };
}

export async function recentPools(blocks = 400_000n): Promise<{ pools: RawPool[]; head: bigint }> {
  const c = client();
  const head = await c.getBlockNumber();
  const pools = await scan(head - blocks, head, {} as Record<string, Address>, 4);
  return { pools, head };
}

const metaCache = new Map<string, TokenMeta>();

export async function tokenMetas(addrs: Address[]): Promise<Map<string, TokenMeta>> {
  const c = client();
  const unique = [...new Set(addrs.map((a) => a.toLowerCase()))] as Address[];
  const need = unique.filter((a) => a !== NATIVE && !metaCache.has(a));
  if (need.length) {
    const calls = need.flatMap((address) => [
      { address, abi: erc20Abi, functionName: "symbol" } as const,
      { address, abi: erc20Abi, functionName: "decimals" } as const,
      { address, abi: erc20Abi, functionName: "name" } as const,
    ]);
    const res = await c.multicall({ contracts: calls, allowFailure: true });
    need.forEach((address, i) => {
      const [s, d, n] = [res[i * 3], res[i * 3 + 1], res[i * 3 + 2]];
      metaCache.set(address, {
        address,
        symbol: s.status === "success" ? String(s.result).slice(0, 14) : `${address.slice(0, 6)}…`,
        decimals: d.status === "success" ? Number(d.result) : 18,
        name: n.status === "success" ? String(n.result).slice(0, 40) : "",
      });
    });
  }
  const out = new Map<string, TokenMeta>();
  for (const a of unique) {
    out.set(a, a === NATIVE ? { address: NATIVE, symbol: "ETH", name: "Ether", decimals: 18 } : metaCache.get(a)!);
  }
  return out;
}

export async function hydrate(pools: RawPool[]): Promise<Pool[]> {
  if (!pools.length) return [];
  const c = client();
  const calls = pools.flatMap((p) => [
    { address: UNISWAP.stateView, abi: stateViewAbi, functionName: "getSlot0", args: [p.id] } as const,
    { address: UNISWAP.stateView, abi: stateViewAbi, functionName: "getLiquidity", args: [p.id] } as const,
  ]);
  const [res, metas] = await Promise.all([
    c.multicall({ contracts: calls, allowFailure: true }),
    tokenMetas(pools.flatMap((p) => [p.currency0, p.currency1])),
  ]);
  return pools.map((p, i) => {
    const s = res[i * 2];
    const l = res[i * 2 + 1];
    return {
      ...p,
      sqrtPriceX96: s.status === "success" ? String((s.result as unknown as readonly [bigint])[0]) : "0",
      liquidity: l.status === "success" ? String(l.result) : "0",
      meta0: metas.get(p.currency0.toLowerCase())!,
      meta1: metas.get(p.currency1.toLowerCase())!,
    };
  });
}
