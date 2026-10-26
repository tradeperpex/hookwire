# Hookwire

Rules that act while you sleep. A non-custodial rule engine for Uniswap v4 on Robinhood Chain (chain ID 4663). Take profit, stop loss and trailing stop, executed by keepers for a fee. Beta. Not independently audited.

Pieces.

| Piece | Where |
| --- | --- |
| Rule contract (Solidity, Foundry) | `contracts/src/HookwireRules.sol` |
| Web app. Create and manage rules, pool explorer, keeper board, docs | `src/app` (`/app`, `/pools`, `/keepers`, `/docs`) |
| Keeper bot (Node, viem) | `keeper/keeper.mjs` |
| Marketing home page with paper simulation | `src/app/page.tsx` |
| Review notes and mainnet test results | `AUDIT.md` |

Stack. Next.js App Router, React, TypeScript, Tailwind v4, `viem`, Foundry.

## Run

```bash
npm install
npm run dev        # http://localhost:3000
```

## Build and check

```bash
npm run build
npm run start -- -p 3100
npm run lint
```

## Environment

| Variable | Use | Where |
| --- | --- | --- |
| `ROBINHOOD_RPC_URL` | RPC for pool lookups and the `/api/rpc` read proxy. Server only, never sent to the browser | `.env.local` and Vercel project settings |
| `NEXT_PUBLIC_RULES_ADDRESS` | Deployed `HookwireRules` address. Empty means the app says the contract is not deployed | `.env.local` and Vercel |
| `NEXT_PUBLIC_SITE_URL` | Canonical URL, Open Graph, sitemap | default `https://hookwire.fun` |

Copy `.env.example` to `.env.local`. `.env*` is git-ignored. If a key was ever pasted into a chat or a ticket, rotate it.

The browser reads the chain through `/api/rpc`, a read-only JSON-RPC proxy with a method allowlist. It refuses `eth_sendRawTransaction`. Transactions go from the user's wallet to the wallet's own RPC.

## Deployed

| What | Where |
| --- | --- |
| `HookwireRules` on Robinhood Chain (4663) | [`0x3c2c53453cE0699f9f24c025EA202d7605BAb3e0`](https://robinhoodchain.blockscout.com/address/0x3c2c53453cE0699f9f24c025EA202d7605BAb3e0) |
| Deploy transaction | [`0xc37bb8b9…ae0cb6b`](https://robinhoodchain.blockscout.com/tx/0xc37bb8b925395c99731d344c3c7762985fca21e1da5f700572309b4b3ae0cb6b) |
| Uniswap v4 PoolManager it uses | `0x8366a39CC670B4001A1121B8F6A443A643e40951` |
| Constructor | treasury `0x0` and protocol fee `0`, so the only fee is the keeper fee a rule owner sets |

Do not trust this table, check it. The deployed bytecode is exactly what this repository compiles to.

```bash
git clone --recurse-submodules <this repo> && cd hookwire/contracts
node ../scripts/verify-bytecode.mjs   # prints MATCH when the creation code on chain equals the local build
```

An earlier build at `0x6D9F6325ffD336833D4AC27C7FB090F53Ce64a71` is superseded and holds no rules. See [AUDIT.md](AUDIT.md) for why.

## The contract

```bash
cd contracts
forge build

# Fork tests against the real PoolManager on Robinhood Chain mainnet
ROBINHOOD_RPC_URL=... forge test --match-contract HookwireRulesForkTest

# Deploy (needs a funded key, pays gas only)
PRIVATE_KEY=0x... forge script script/Deploy.s.sol --rpc-url $ROBINHOOD_RPC_URL --broadcast
# optional: TREASURY=0x... PROTOCOL_FEE_BPS=20 (max 100)
```

Then set `NEXT_PUBLIC_RULES_ADDRESS` to the printed address, redeploy the site, and regenerate the ABI after any contract change with `node scripts/gen-abi.mjs`.

`script/E2EPool.s.sol` deploys a throwaway ETH/HWTEST pool on mainnet with a little liquidity, so a rule can be created, triggered and executed for real. `scripts/e2e-ui.mjs` drives the real web app in headless Chrome with a scripted test wallet. The results are in AUDIT.md.

`script/LocalDemo.s.sol` deploys the contract plus a demo ETH/DEMO pool on an anvil fork of mainnet, for end to end UI tests. It refuses to run off chain 4663 and is not for mainnet.

## Keeper bot

Anyone can run one. It reads armed rules, records new peaks for trailing stops, simulates each triggered rule and sends only the ones that would succeed and pay more than their gas.

```bash
cd keeper
cp .env.example .env     # ROBINHOOD_RPC_URL, RULES_ADDRESS, KEEPER_PRIVATE_KEY
node keeper.mjs          # DRY_RUN=1 to only log
```

Use a fresh key holding only gas money. It is never your owner key.

## Known limits

- A keeper only earns the fee a rule owner sets. On a tiny rule that fee is below the gas to run it, and the bot skips it (`ALLOW_LOSS=1` overrides, for testing).
- Triggers read the pool spot price. A large trade inside one block can push it. Slippage and a minimum output limit the damage, a TWAP trigger is planned.
- A trailing stop only learns a new peak when someone calls `poke`. The keeper bot does.
- Hooks on a pool can change or block a sale. The Pools page decodes them.
- Not audited.

## Deploy to Vercel

1. Push this folder to a Git repository.
2. In Vercel choose Add New Project and import the repository. Framework preset is Next.js, no other settings are needed.
3. Add `NEXT_PUBLIC_SITE_URL` once the domain is bought, then redeploy.
4. Add the domain under Project Settings, Domains, and set the DNS records Vercel shows.

Or from the terminal.

```bash
npx vercel          # preview
npx vercel --prod   # production
```

## Where things are

| Path | What |
| --- | --- |
| `DESIGN.md` | Research, tokens, components, copy, accessibility plan |
| `src/app` | Layout, pages, `/api/*`, icons, robots, sitemap |
| `src/components` | Hero sentence builder, nav, sections, simulator chart |
| `src/lib/sim.ts` | Deterministic demo price paths and rule evaluation |
| `src/lib/site.ts` | Domain, handle, explorer, tagline. Edit when you buy things |

## Not live

Session keys, a TWAP trigger and the token do not exist yet. They appear on the roadmap marked Not live and nowhere else as fact. Keep it that way when editing copy.
