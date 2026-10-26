// Waits until the deployer wallet has gas, deploys HookwireRules, verifies it, writes the address to .env.local.
import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const root = new URL("..", import.meta.url).pathname;
const env = Object.fromEntries(readFileSync(root + ".env.local", "utf8").split("\n").map((l) => l.match(/^([A-Z0-9_]+)=(.*)$/)).filter(Boolean).map((m) => [m[1], m[2]]));
const RPC = env.ROBINHOOD_RPC_URL;
const { address, private_key } = JSON.parse(readFileSync(root + ".secrets/deployer.json", "utf8"));
const MIN = 300_000_000_000_000n; // 0.0003 ETH
const sh = (cmd, args, opts = {}) => execFileSync(cmd, args, { encoding: "utf8", cwd: root + "contracts", ...opts }).trim();
const log = (...a) => console.log(new Date().toISOString(), ...a);

log("watching", address);
for (;;) {
  const bal = BigInt(sh("cast", ["balance", address, "--rpc-url", RPC]));
  if (bal >= MIN) {
    log("funded", bal.toString(), "wei. deploying");
    break;
  }
  await new Promise((r) => setTimeout(r, 5000));
}

const out = sh("forge", ["script", "script/Deploy.s.sol", "--rpc-url", RPC, "--broadcast", "--private-key", private_key], { env: { ...process.env, PRIVATE_KEY: private_key } });
const addr = out.match(/HookwireRules\s+(0x[0-9a-fA-F]{40})/)?.[1];
if (!addr) {
  log("deploy output had no address\n", out);
  process.exit(1);
}
log("deployed", addr);

// Verify on chain.
const code = sh("cast", ["code", addr, "--rpc-url", RPC]);
const pm = sh("cast", ["call", addr, "poolManager()(address)", "--rpc-url", RPC]);
log("code bytes", (code.length - 2) / 2, "poolManager", pm);
if (code === "0x" || pm.toLowerCase() !== "0x8366a39cc670b4001a1121b8f6a443a643e40951") {
  log("verification failed");
  process.exit(1);
}

let cur = readFileSync(root + ".env.local", "utf8");
cur = cur.match(/^NEXT_PUBLIC_RULES_ADDRESS=/m) ? cur.replace(/^NEXT_PUBLIC_RULES_ADDRESS=.*$/m, `NEXT_PUBLIC_RULES_ADDRESS=${addr}`) : cur.trimEnd() + `\nNEXT_PUBLIC_RULES_ADDRESS=${addr}\n`;
writeFileSync(root + ".env.local", cur);
log("wrote NEXT_PUBLIC_RULES_ADDRESS to .env.local");
