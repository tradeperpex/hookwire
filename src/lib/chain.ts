import { defineChain, type Address } from "viem";

export const CHAIN_ID = 4663;

export const robinhood = defineChain({
  id: CHAIN_ID,
  name: "Robinhood Chain",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.mainnet.chain.robinhood.com"] } },
  blockExplorers: { default: { name: "Blockscout", url: "https://robinhoodchain.blockscout.com" } },
  contracts: { multicall3: { address: "0xcA11bde05977b3631167028862bE2a173976CA11" } },
});

// Uniswap v4 on Robinhood Chain. Source: developers.uniswap.org/docs/protocols/v4/deployments
export const UNISWAP = {
  poolManager: "0x8366a39cc670b4001a1121b8f6a443a643e40951",
  stateView: "0xf3334192d15450cdd385c8b70e03f9a6bd9e673b",
  quoter: "0x8dc178efb8111bb0973dd9d722ebeff267c98f94",
  weth: "0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73",
} as const satisfies Record<string, Address>;

export const NATIVE = "0x0000000000000000000000000000000000000000" as const;

/** Set after deploying contracts/src/HookwireRules.sol. Empty means the rule contract is not live. */
export const RULES_ADDRESS = (process.env.NEXT_PUBLIC_RULES_ADDRESS || "") as Address | "";

export const explorer = {
  address: (a: string) => `https://robinhoodchain.blockscout.com/address/${a}`,
  tx: (h: string) => `https://robinhoodchain.blockscout.com/tx/${h}`,
};
