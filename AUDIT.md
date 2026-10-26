# Review notes

This is a self-review by the author, with tests and a real mainnet run. It is not an independent audit and it does not replace one. Nothing here is a promise that the contract is free of bugs. Read the code, it is 360 lines.

Scope. `contracts/src/HookwireRules.sol`, the keeper bot, and the web app flow that creates a rule.

## What was checked

| Check | Result |
| --- | --- |
| Fork tests against the real Uniswap v4 PoolManager on Robinhood Chain (13 tests, `forge test`) | Pass |
| Bytecode on chain equals the repository build (`scripts/verify-bytecode.mjs`) | Match |
| Rule created through the real web app with a scripted wallet (`scripts/e2e-ui.mjs`) | Approve and create both sent, rule shown as Armed |
| Price pushed below the trigger on mainnet, rule run by the real keeper bot (`keeper/keeper.mjs`) | Executed, owner received exactly proceeds minus keeper fee |
| Contract balances after execution | 0 ETH and 0 tokens held |
| RPC key present in the client bundle | Not present |
| `/api/rpc` accepts `eth_sendRawTransaction` | Refused |

## Mainnet run

Throwaway ETH/HWTEST pool (`script/E2EPool.s.sol`), test wallet `0x221a548121802a9c47befBCf9eA8E3F859Ce8BFF`, rule 1 on `0x3c2c53453cE0699f9f24c025EA202d7605BAb3e0`.

| Step | Transaction |
| --- | --- |
| Rule created from the web app. Stop loss 10% below entry, slippage 10%, price floor on, keeper fee 0.3% | `0x4ef6835e27d06bada6d33e54df3d10df2229ee29aab61592a7134caced4e0630` |
| Keeper executes after the price was pushed under the trigger | `0x12f40ded6b55758cc5d9b41445c2b8788998f302f84fae87f297841e006dc8f0` |

Execution paid out 16,960,604,176,278 wei. The keeper fee was 50,881,812,528 wei (0.3%). The owner balance rose by 16,909,722,363,750 wei, which is exactly the difference. The 0.02 HWTEST rule amount left the owner and nothing stayed in the contract.

## Findings

| # | Severity | Finding | Status |
| --- | --- | --- | --- |
| 1 | Medium | The optional price floor (`minOut`) was set for the full rule amount. If the owner held less than that when the rule fired, the contract sold the smaller amount against the full floor and reverted with `Slippage()` every time. Funds were never at risk, but the rule could not protect the owner. | Fixed. The floor now scales with the amount actually sold. Regression test `test_floor_scales_down_when_balance_is_lower_than_rule_amount` fails on the old code and passes on the new. The first build at `0x6D9F6325ffD336833D4AC27C7FB090F53Ce64a71` had this bug and held no rules. It is superseded. |
| 2 | Low | The app showed estimated proceeds of `0 ETH` for small amounts because token amounts were cut at four decimals. | Fixed in `fmtToken`. |
| 3 | Known limit | Triggers read the pool spot price, and `execute` reads it in the same transaction. A large trade in the same block can push it. | Not fixed. Limited by the owner's slippage and the price floor, so the loss is bounded by the slippage the owner chose. A TWAP trigger is planned. |
| 4 | Known limit | A trailing stop only learns a new peak when `poke` or `execute` is called. A spike and drop between two keeper polls is not seen. | Not fixed. The keeper pokes on every poll. |
| 5 | Known limit | A hook on the pool can change or block a swap, so a rule on a hooked pool may not execute. | Not fixed. The app and Pools page decode and flag hooks. Funds stay in the wallet. |
| 6 | Info | A keeper earns only the fee the owner sets. A small rule pays less than its gas, so the reference bot skips it. | By design. `ALLOW_LOSS=1` overrides it for testing. |
| 7 | Info | If a protocol fee were set and the treasury were a contract that rejects ETH, every execute that pays out in ETH would revert. | Not reachable. The deployed instance has treasury `0x0` and protocol fee 0, both immutable. |
| 8 | Info | Fee-on-transfer and rebasing tokens. The settle step should fail and revert the whole execute, so nothing is taken. | Reasoned from the code, not tested. |

## Design properties worth attacking

- The contract holds no funds between transactions. Execution pulls the sold token from the owner straight into the PoolManager and sends proceeds straight back out.
- The owner's ERC-20 allowance is the spend limit. Setting it to zero, or calling `cancel`, stops a rule.
- `unlockCallback` only answers the PoolManager. `execute` is `nonReentrant`.
- Fees are capped in code. Keeper at most 2%, protocol at most 1%, slippage at most 50%.

## What an independent audit should cover

Hook interactions with `beforeSwapReturnsDelta`, the delta accounting in `unlockCallback` for exotic tokens, behaviour on pools with a dynamic fee, and economic attacks on the spot-price trigger. The fork tests use a hook-less pool.
