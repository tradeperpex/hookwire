// Checks that the creation code on chain equals what this repository compiles to.
//   cd contracts && node ../scripts/verify-bytecode.mjs [address] [deployTxHash]
// Needs `forge` and `cast` on the PATH. Reads the chain through https://rpc.mainnet.chain.robinhood.com unless RPC is set.
import { execFileSync } from "node:child_process";

const ADDRESS = process.argv[2] ?? "0x3c2c53453cE0699f9f24c025EA202d7605BAb3e0";
const TX = process.argv[3] ?? "0xc37bb8b925395c99731d344c3c7762985fca21e1da5f700572309b4b3ae0cb6b";
const RPC = process.env.RPC ?? process.env.ROBINHOOD_RPC_URL ?? "https://rpc.mainnet.chain.robinhood.com";
const POOL_MANAGER = "0x8366a39CC670B4001A1121B8F6A443A643e40951";
const sh = (c, a) => execFileSync(c, a, { encoding: "utf8" }).trim();

const onchain = sh("cast", ["tx", TX, "input", "--rpc-url", RPC]).toLowerCase();
const args = sh("cast", ["abi-encode", "constructor(address,address,uint16)", POOL_MANAGER, "0x0000000000000000000000000000000000000000", "0"]);
sh("forge", ["build", "--force"]);
const local = (sh("forge", ["inspect", "HookwireRules", "bytecode"]) + args.slice(2)).toLowerCase();
const code = sh("cast", ["code", ADDRESS, "--rpc-url", RPC]);
console.log("contract", ADDRESS, "has", (code.length - 2) / 2, "bytes of runtime code");
if (onchain === local) console.log("MATCH. The creation code in", TX, "is exactly the local build.");
else { console.log("DIFFERENT. Check solc 0.8.26, via_ir, optimizer 200, cancun, and that lib/v4-core is the pinned commit."); process.exit(1); }
