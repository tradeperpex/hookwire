import { getAddress, type Address } from "viem";
import { NATIVE, RULES_ADDRESS, UNISWAP } from "./chain";
import { erc20Abi, quoterAbi } from "./abis";
import { getClient } from "./client";
import { rulesAbi } from "./rulesAbi";
import { fmtPrice, humanPrice } from "./format";

export const KIND = { TAKE_PROFIT: 0, STOP_LOSS: 1, TRAILING_STOP: 2 } as const;
export type KindId = (typeof KIND)[keyof typeof KIND];
export const STATUS = ["None", "Active", "Executed", "Cancelled"] as const;

export type Meta = { address: Address; symbol: string; decimals: number };

export type PoolKey = { currency0: Address; currency1: Address; fee: number; tickSpacing: number; hooks: Address };

export type RuleView = {
  id: bigint;
  owner: Address;
  tokenIn: Address;
  kind: KindId;
  status: number;
  zeroForOne: boolean;
  slippageBps: number;
  keeperFeeBps: number;
  triggerBps: number;
  expiry: number;
  createdAt: number;
  amountIn: bigint;
  minOut: bigint;
  refPrice: bigint;
  key: PoolKey;
  currentPrice: bigint;
  triggerPrice: bigint;
  triggered: boolean;
  expired: boolean;
  sellable: bigint;
  metaIn: Meta;
  metaOut: Meta;
};

export const rulesContract = () => ({ address: RULES_ADDRESS as Address, abi: rulesAbi });

/** Price of the sold token in the other token, Q96, raw units. Mirrors the contract. */
export function priceQ96(sqrtP: bigint, zeroForOne: boolean): bigint {
  const Q = 1n << 96n;
  if (sqrtP === 0n) return 0n;
  if (zeroForOne) return (sqrtP * sqrtP) / Q;
  const inv = (Q * Q) / sqrtP;
  return (inv * Q) / sqrtP;
}

export function triggerPriceFor(kind: KindId, triggerBps: number, ref: bigint): bigint {
  if (kind === KIND.TAKE_PROFIT) return (ref * BigInt(triggerBps)) / 10_000n;
  return (ref * BigInt(10_000 - triggerBps)) / 10_000n;
}

export function ruleLabel(kind: KindId, triggerBps: number) {
  if (kind === KIND.TAKE_PROFIT) return `reaches ${fmtMultiple(triggerBps / 10_000)}x`;
  if (kind === KIND.STOP_LOSS) return `drops ${triggerBps / 100}% below entry`;
  return `falls ${triggerBps / 100}% from its peak`;
}

export function fmtMultiple(n: number) {
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

const metaCache = new Map<string, Meta>();

export async function readMetas(addrs: Address[]): Promise<Map<string, Meta>> {
  const c = getClient();
  const unique = [...new Set(addrs.map((a) => a.toLowerCase()))] as Address[];
  const need = unique.filter((a) => a !== NATIVE && !metaCache.has(a));
  if (need.length) {
    const res = await c.multicall({
      contracts: need.flatMap((address) => [
        { address, abi: erc20Abi, functionName: "symbol" } as const,
        { address, abi: erc20Abi, functionName: "decimals" } as const,
      ]),
      allowFailure: true,
    });
    need.forEach((address, i) => {
      const s = res[i * 2];
      const d = res[i * 2 + 1];
      metaCache.set(address, {
        address: getAddress(address),
        symbol: s.status === "success" ? String(s.result).slice(0, 14) : `${address.slice(0, 6)}…`,
        decimals: d.status === "success" ? Number(d.result) : 18,
      });
    });
  }
  const out = new Map<string, Meta>();
  for (const a of unique) out.set(a, a === NATIVE ? { address: NATIVE, symbol: "ETH", decimals: 18 } : metaCache.get(a)!);
  return out;
}

export async function loadRules(ids: bigint[]): Promise<RuleView[]> {
  if (!ids.length || !RULES_ADDRESS) return [];
  const c = getClient();
  const base = rulesContract();
  const res = await c.multicall({
    contracts: ids.flatMap((id) => [
      { ...base, functionName: "getRule", args: [id] } as const,
      { ...base, functionName: "check", args: [id] } as const,
    ]),
    allowFailure: true,
  });
  const raw = ids.map((id, i) => ({ id, rule: res[i * 2], chk: res[i * 2 + 1] }));
  const ok = raw.filter((r) => r.rule.status === "success" && r.chk.status === "success");
  const metas = await readMetas(
    ok.flatMap((r) => {
      const k = (r.rule.result as { key: PoolKey }).key;
      return [k.currency0, k.currency1];
    }),
  );
  return ok.map((r) => {
    const g = r.rule.result as unknown as Omit<RuleView, "id" | "currentPrice" | "triggerPrice" | "triggered" | "expired" | "sellable" | "metaIn" | "metaOut" | "refPrice"> & { refPrice: bigint };
    const [status, currentPrice, triggerPrice, triggered, expired, sellable] = r.chk.result as unknown as [number, bigint, bigint, boolean, boolean, bigint];
    const key = { ...g.key, fee: Number(g.key.fee), tickSpacing: Number(g.key.tickSpacing) };
    const inMeta = metas.get(g.tokenIn.toLowerCase())!;
    const otherAddr = g.zeroForOne ? key.currency1 : key.currency0;
    return {
      ...g,
      id: r.id,
      kind: Number(g.kind) as KindId,
      status: Number(status),
      expiry: Number(g.expiry),
      createdAt: Number(g.createdAt),
      slippageBps: Number(g.slippageBps),
      keeperFeeBps: Number(g.keeperFeeBps),
      triggerBps: Number(g.triggerBps),
      key,
      currentPrice,
      triggerPrice,
      triggered,
      expired,
      sellable,
      metaIn: inMeta,
      metaOut: metas.get(otherAddr.toLowerCase())!,
    } as RuleView;
  });
}

export async function quoteSell(key: PoolKey, zeroForOne: boolean, amountIn: bigint): Promise<bigint | null> {
  try {
    const { result } = await getClient().simulateContract({
      address: UNISWAP.quoter,
      abi: quoterAbi,
      functionName: "quoteExactInputSingle",
      args: [{ poolKey: key, zeroForOne, exactAmount: amountIn, hookData: "0x" }],
    });
    return (result as readonly [bigint, bigint])[0];
  } catch {
    return null;
  }
}

export const human = (v: RuleView, q96: bigint) => fmtPrice(humanPrice(q96, v.metaIn.decimals, v.metaOut.decimals));
