import { RULES_ADDRESS } from "./chain";

// Single place for public facts. Change these when the domain and handle are bought.
export const SITE = {
  name: "Hookwire",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://hookwire.io",
  x: "https://x.com/hookwire",
  xHandle: "@hookwire",
  explorer: "https://robinhoodchain.blockscout.com",
  chainId: 4663,
  rpc: "https://rpc.mainnet.chain.robinhood.com",
  tagline: "Rules that act while you sleep.",
  description:
    "Write a rule on a token as a sentence. Hookwire executes it on Robinhood Chain through Uniswap v4, inside a limit you set, while you sleep. Beta, unaudited.",
} as const;

/** True once HookwireRules is deployed and NEXT_PUBLIC_RULES_ADDRESS is set. */
export const LIVE = RULES_ADDRESS !== "";
export { RULES_ADDRESS };
