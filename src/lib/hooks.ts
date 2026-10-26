// Uniswap v4 encodes which hook callbacks a pool uses in the low 14 bits of the hook address.
const FLAGS: [number, string, "info" | "warn"][] = [
  [1 << 13, "beforeInitialize", "info"],
  [1 << 12, "afterInitialize", "info"],
  [1 << 11, "beforeAddLiquidity", "info"],
  [1 << 10, "afterAddLiquidity", "info"],
  [1 << 9, "beforeRemoveLiquidity", "info"],
  [1 << 8, "afterRemoveLiquidity", "info"],
  [1 << 7, "beforeSwap", "warn"],
  [1 << 6, "afterSwap", "warn"],
  [1 << 5, "beforeDonate", "info"],
  [1 << 4, "afterDonate", "info"],
  [1 << 3, "beforeSwapReturnsDelta", "warn"],
  [1 << 2, "afterSwapReturnsDelta", "warn"],
  [1 << 1, "afterAddLiquidityReturnsDelta", "info"],
  [1 << 0, "afterRemoveLiquidityReturnsDelta", "info"],
];

export const ZERO = "0x0000000000000000000000000000000000000000";

export function hookFlags(hooks: string) {
  if (hooks.toLowerCase() === ZERO) return [];
  const n = Number(BigInt(hooks) & 0x3fffn);
  return FLAGS.filter(([bit]) => (n & bit) !== 0).map(([, name, level]) => ({ name, level }));
}

/** A hook that runs on swaps can change what you receive, or block the sale. */
export function swapRisk(hooks: string): "none" | "swap-hooks" {
  return hookFlags(hooks).some((f) => f.level === "warn") ? "swap-hooks" : "none";
}
