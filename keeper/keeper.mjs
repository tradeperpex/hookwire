// Hookwire keeper bot.
// Reads armed rules, records new peaks for trailing stops, and executes triggered rules
// that would succeed and pay more than their gas.
//
//   KEEPER_PRIVATE_KEY=0x... ROBINHOOD_RPC_URL=... RULES_ADDRESS=0x... node keeper.mjs
//
// Optional: POLL_SECONDS (default 10), POKE_MIN_BPS (default 50, record a peak once price is 0.5% above the stored one),
// EXECUTE_UNPRICED=1 (also run rules whose payout is a token we cannot value against gas), ALLOW_LOSS=1 (run rules even when the
// keeper fee is below gas, for testing), DRY_RUN=1.
import { createPublicClient, createWalletClient, defineChain, formatEther, http, parseAbi } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { readFileSync, existsSync } from "node:fs";

// Minimal .env loader, no dependency.
for (const f of [".env", "../.env.local"]) {
  if (!existsSync(f)) continue;
  for (const line of readFileSync(f, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const need = (k) => {
  const v = process.env[k];
  if (!v) {
    console.error(`Missing ${k}`);
    process.exit(1);
  }
  return v;
};

const RPC = need("ROBINHOOD_RPC_URL");
const RULES = need("RULES_ADDRESS");
const account = privateKeyToAccount(need("KEEPER_PRIVATE_KEY"));
const POLL = Number(process.env.POLL_SECONDS ?? 10) * 1000;
const POKE_MIN_BPS = BigInt(process.env.POKE_MIN_BPS ?? 50);
const DRY = process.env.DRY_RUN === "1";
const UNPRICED = process.env.EXECUTE_UNPRICED === "1";
const ALLOW_LOSS = process.env.ALLOW_LOSS === "1";

const chain = defineChain({
  id: 4663,
  name: "Robinhood Chain",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [RPC] } },
});
const pub = createPublicClient({ chain, transport: http(RPC) });
const wallet = createWalletClient({ account, chain, transport: http(RPC) });

const abi = parseAbi([
  "function ruleCount() view returns (uint256)",
  "function activeRules(uint256 from, uint256 limit) view returns (uint256[] ids, uint256 next)",
  "function check(uint256 id) view returns (uint8 status, uint256 currentPrice, uint256 triggerPrice, bool triggered, bool expired, uint256 sellable)",
  "function getRule(uint256 id) view returns ((address owner, address tokenIn, uint8 kind, uint8 status, bool zeroForOne, uint16 slippageBps, uint16 keeperFeeBps, uint32 triggerBps, uint64 expiry, uint64 createdAt, uint128 amountIn, uint256 minOut, uint256 refPrice, (address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks) key))",
  "function execute(uint256 id) returns (uint256 amountOut)",
  "function poke(uint256 id)",
]);
const rules = { address: RULES, abi };
const ZERO = "0x0000000000000000000000000000000000000000";
const log = (...a) => console.log(new Date().toISOString(), ...a);

const failed = new Map(); // id -> retry after (ms epoch), so a reverting rule does not spam the RPC

async function armedIds() {
  const total = Number(await pub.readContract({ ...rules, functionName: "ruleCount" }));
  const ids = [];
  for (let from = 1; from <= total; from += 200) {
    const [page] = await pub.readContract({ ...rules, functionName: "activeRules", args: [BigInt(from), 200n] });
    ids.push(...page);
  }
  return ids;
}

async function tick() {
  const ids = await armedIds();
  if (!ids.length) return log("no armed rules");
  const gasPrice = await pub.getGasPrice();
  let triggered = 0;
  for (const id of ids) {
    try {
      const [rule, c] = await Promise.all([
        pub.readContract({ ...rules, functionName: "getRule", args: [id] }),
        pub.readContract({ ...rules, functionName: "check", args: [id] }),
      ]);
      const [, price, , isTriggered] = c;

      // Trailing stops only learn a new peak when someone records it.
      if (rule.kind === 2 && rule.refPrice > 0n && price > rule.refPrice + (rule.refPrice * POKE_MIN_BPS) / 10_000n) {
        log(`rule ${id}: new peak, recording`);
        if (!DRY) {
          const hash = await wallet.writeContract({ ...rules, functionName: "poke", args: [id] });
          await pub.waitForTransactionReceipt({ hash });
        }
      }
      if (!isTriggered) continue;
      triggered++;
      if ((failed.get(id) ?? 0) > Date.now()) continue;

      // Simulate first so we never pay gas for a revert, and so we know the payout.
      const { result: out, request } = await pub.simulateContract({ ...rules, functionName: "execute", args: [id], account });
      const fee = (out * BigInt(rule.keeperFeeBps)) / 10_000n;
      const gas = await pub.estimateContractGas({ ...rules, functionName: "execute", args: [id], account });
      const cost = gas * gasPrice;
      const outIsNative = (rule.zeroForOne ? rule.key.currency1 : rule.key.currency0) === ZERO;

      if (outIsNative && fee < cost && !ALLOW_LOSS) {
        log(`rule ${id}: skip, fee ${formatEther(fee)} ETH is below gas ${formatEther(cost)} ETH`);
        failed.set(id, Date.now() + 60_000);
        continue;
      }
      if (!outIsNative && !UNPRICED) {
        log(`rule ${id}: skip, payout is a token we do not price. Set EXECUTE_UNPRICED=1 to run it anyway`);
        failed.set(id, Date.now() + 60_000);
        continue;
      }
      log(`rule ${id}: executing, out ${out}, keeper fee ${fee}, gas ${formatEther(cost)} ETH`);
      if (DRY) continue;
      const hash = await wallet.writeContract(request);
      const rc = await pub.waitForTransactionReceipt({ hash });
      log(`rule ${id}: ${rc.status} ${hash}`);
    } catch (e) {
      log(`rule ${id}: ${(e.shortMessage ?? e.message).split("\n")[0]}`);
      failed.set(id, Date.now() + 30_000);
    }
  }
  log(`${ids.length} armed, ${triggered} triggered`);
}

log(`keeper ${account.address} watching ${RULES}${DRY ? " (dry run)" : ""}`);
for (;;) {
  try {
    await tick();
  } catch (e) {
    log("tick failed:", (e.shortMessage ?? e.message).split("\n")[0]);
  }
  await new Promise((r) => setTimeout(r, POLL));
}
