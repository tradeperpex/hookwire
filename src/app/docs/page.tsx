import type { Metadata } from "next";
import { PageHead } from "@/components/PageHead";
import Link from "next/link";
import { UNISWAP, explorer } from "@/lib/chain";
import { LIVE, RULES_ADDRESS } from "@/lib/site";

export const metadata: Metadata = {
  title: "Docs. Hookwire",
  description: "How Hookwire rules work, what they cost, and every risk, written plainly.",
  alternates: { canonical: "/docs" },
};

export default function DocsPage() {
  return (
    <div className="container pagehead">
      <PageHead kicker="Written plainly" title="How it works.">
        Hookwire is a small contract on Robinhood Chain that sells a token for you when its price crosses a line you set. This page says what it does and what it cannot protect you from.
      </PageHead>

      <div className="prose">
        <h2>The status</h2>
        <p>
          {LIVE ? (
            <>
              The rule contract is live on Robinhood Chain mainnet at{" "}
              <a className="link-quiet" style={{ minHeight: 0 }} href={explorer.address(RULES_ADDRESS)} target="_blank" rel="noopener noreferrer">
                <code>{RULES_ADDRESS}</code>
              </a>
              . It is beta software and has not been audited.
            </>
          ) : (
            <>The rule contract is built and tested on a fork of mainnet, and is not deployed yet. This page describes what it does once it is.</>
          )}{" "}
          It has no owner, no upgrade path and no admin key. Use only money you can afford to lose.
        </p>

        <h2>The three rules</h2>
        <ul>
          <li>
            <strong>Take profit.</strong> Sell when the price reaches a multiple of your entry price. 2x means double.
          </li>
          <li>
            <strong>Stop loss.</strong> Sell when the price falls a set percent below your entry price.
          </li>
          <li>
            <strong>Trailing stop.</strong> Sell when the price falls a set percent from its highest point since you created the rule. The peak moves up, never down. <strong>The contract only learns a new peak when someone calls <code>poke</code></strong>, and a keeper bot does that for you. If nobody records the peak while the price climbs, the stop trails from an old high and can fire later than you expect. Anyone can poke, and the app has a button.
          </li>
        </ul>
        <p>Entry price is the pool price at the moment you create the rule. Prices are read from the pool in the same units the pool uses.</p>

        <h2>What happens when you create a rule</h2>
        <ul>
          <li>You pick the token, the exact pool, the rule type, the amount, the slippage guard, the keeper fee and an expiry.</li>
          <li>
            You approve the token to the rule contract. <strong>That allowance is your spend limit.</strong> A rule sells the smallest of the amount you set, your balance and your allowance.
          </li>
          <li>Nothing moves yet. Your tokens stay in your wallet.</li>
        </ul>

        <h2>What happens when it fires</h2>
        <ul>
          <li>Anyone, called a keeper, sends <code>execute</code>. The contract checks the rule is active, not expired and past its trigger.</li>
          <li>It pulls the tokens from you, swaps them in the pool you chose through the Uniswap v4 PoolManager, and sends the output straight to you.</li>
          <li>The keeper fee, up to 2%, comes out of the output and goes to the keeper. The contract keeps nothing between transactions.</li>
          <li>If the output is below your slippage guard or your minimum, the whole execution reverts and the rule stays armed.</li>
        </ul>

        <h2>Stopping a rule</h2>
        <ul>
          <li>
            <strong>Cancel</strong> the rule from the app. Only you can.
          </li>
          <li>
            Or <strong>set the allowance to zero</strong>. Nothing can then sell your tokens, whatever the rule says. The app has a button for it.
          </li>
          <li>Rules also end on their own at the expiry.</li>
        </ul>

        <h2>Fees</h2>
        <ul>
          <li>The pool fee, as for any swap.</li>
          <li>The keeper fee you chose, 0% to 2%, paid only when a rule fires.</li>
          <li>A protocol fee, fixed at deploy, capped at 1%. {LIVE ? "Read it from the contract." : "It is zero unless set at deploy."}</li>
          <li>Gas for creating, cancelling and approving.</li>
        </ul>

        <h2>Risks</h2>
        <ul>
          <li>
            <strong>Spot price can be pushed.</strong> Rules read the pool spot price. Someone with enough capital can move it inside one block, trip your rule and take the other side. The app sets a price floor on every rule it creates. The sale must fill at no worse than the trigger price minus your slippage, which stops a pushed price from forcing a bad sale. On a stop loss or trailing stop you can switch the floor off, and then a gap far below the trigger still sells but a pushed price can cost you. A time weighted trigger is on the roadmap.
          </li>
          <li>
            <strong>Hooks can change a swap.</strong> A Uniswap v4 hook can take a cut, change the price you get, or block a sale. The Pools page decodes the hook on every pool and flags swap hooks. Read it first.
          </li>
          <li>
            <strong>Thin pools.</strong> A sale can move the price a lot. The app shows a quote and price impact. The slippage guard stops a sale that fills too far from spot.
          </li>
          <li>
            <strong>Keepers are not guaranteed.</strong> A rule only runs if someone sends the transaction. The fee is the reason they will, and a low fee on a small rule may not be worth the gas. You can always run it yourself from the Keepers page.
          </li>
          <li>
            <strong>Sequencer.</strong> Robinhood Chain is an Arbitrum Nitro L2 with a central sequencer. If it is down, nothing runs.
          </li>
          <li>
            <strong>Bugs.</strong> The contract is tested against real pools on a fork. It is not audited.
          </li>
        </ul>
        <p>This page describes software. It does not tell you what to buy or sell.</p>

        <h2>Run a keeper</h2>
        <p>
          Use the <Link className="link-quiet" style={{ minHeight: 0 }} href="/keepers">Keepers page</Link> by hand, or run the bot from the repository. It reads armed rules, simulates each triggered one, and sends only the ones that would succeed and pay more than their gas.
        </p>
        <pre>{`cd keeper
cp .env.example .env
# set KEEPER_PRIVATE_KEY, ROBINHOOD_RPC_URL, RULES_ADDRESS
node keeper.mjs`}</pre>

        <h2>Addresses</h2>
        <ul>
          <li>
            Chain: Robinhood Chain, chain ID <code>4663</code>.
          </li>
          <li>
            Uniswap v4 PoolManager:{" "}
            <a className="link-quiet" style={{ minHeight: 0 }} href={explorer.address(UNISWAP.poolManager)} target="_blank" rel="noopener noreferrer">
              <code>{UNISWAP.poolManager}</code>
            </a>
          </li>
          <li>Rule contract: {LIVE ? <code>{RULES_ADDRESS}</code> : "not deployed yet"}</li>
        </ul>

        <h2>Contract interface</h2>
        <pre>{`createRule(key, tokenIn, kind, triggerBps, amountIn,
           slippageBps, keeperFeeBps, expiry, minOut) -> id
cancel(id)
poke(id)                 // trailing stop peak
execute(id) -> amountOut // anyone
check(id)  -> status, price, triggerPrice, triggered, expired, sellable
rulesOf(owner), activeRules(from, limit), ruleCount()`}</pre>
        <p>kind is 0 take profit, 1 stop loss, 2 trailing stop. triggerBps is 30000 for 3x on take profit, and 2000 for a 20% drop on the others.</p>
      </div>
    </div>
  );
}
