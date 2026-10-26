# Hookwire design spec

Status: Phase 1. Marketing site, in-browser rule builder, paper simulation, live chain read. Nothing here holds funds or executes trades.

## 0. Research that shaped this

Verified on 26 Oct 2026.

| Fact | Source |
| --- | --- |
| Pons has limit orders by target price or market value. Its docs do not describe take-profit or stop-loss. | coinlive.com news flash 21 Jul, docs.ponsfamily.com |
| Trade Labs runs stop loss, staged take profit and trailing stop on Robinhood Chain from a desktop app. The app must stay running. | tradelabs.org/integrations/robinhood-chain |
| Open-source sniper bots run locally. Some read a private key from an `.env` file. Bodkin is local and non-custodial. | github.com/waveterncleanse, github.com/Phosphenq/bodkin |
| Uniswap v4 limit order and take-profit hooks exist as teaching and hackathon demos. | LearnWeb3 repo, ETHGlobal Bangkok showcase |
| Hookshade watch hooks run sealed in the browser, read the chain every 30 s and record a match in local history. They do not trade. | hookshade.com/docs |
| Crius, ScanHood, Opsis and TrustSwap cover token safety scans and hook permissions. | their docs |
| Pools.trade (Uniswap Labs) offers Crowd and Instant launches. | blog.uniswap.org |
| Robinhood Chain is an Arbitrum L2, chain ID 4663, public RPC `https://rpc.mainnet.chain.robinhood.com`, rate limited. | docs.robinhood.com/chain |

Positioning that survives this: TP and SL already exist. What does not is the custody model. Today you either keep an app running with your wallet, or put a private key in a file. Hookwire is designed around a scoped session key and keepers. That is a design, not a live feature, and the site says so.

Reference screens studied with Refero: Apple (store, Apple Card, macOS pages), Linear, Stripe-style fintech (Column), Raycast, Wealthsimple, Robinhood marketing. Takeaways used:
- Apple: one idea per screen, 60 to 70 percent of the viewport is empty, type does the work, media sits in rounded frames, links are quiet.
- Column and Wealthsimple: a serif-led headline on a light page reads as trustworthy money without looking like a bank. Product UI is rebuilt, not screenshotted.
- Raycast and Linear: tight type, hairlines instead of boxes, restrained motion that confirms state.
- Rejected: dark neon crypto, three equal feature cards, logo walls.

## 1. Principles

1. Light, quiet, exact. One ink, one paper, one accent used for the wire and nothing else.
2. One signature moment: the sentence is the interface. Everything else is still.
3. Say what is true and what is not live. Every Phase 2 item carries "Not live".
4. No invented numbers. Demo values are labelled Simulation.

## 2. Tokens

### Color
| Token | Hex | Use |
| --- | --- | --- |
| `--paper` | `#FAFAF8` | page |
| `--paper-2` | `#F3F2EE` | quiet surfaces, control fills |
| `--card` | `#FFFFFF` | cards |
| `--ink` | `#141413` | text, primary button |
| `--ink-2` | `#55544F` | body copy (7.4:1 on paper) |
| `--muted` | `#6B6A66` | captions (5.2:1 on paper) |
| `--faint` | `#A3A19B` | ghost chart line, decorative only |
| `--line` | `rgba(20,20,19,.10)` | hairlines |
| `--line-2` | `rgba(20,20,19,.16)` | stronger hairlines, control borders |
| `--wire` | `#CF4116` | the one accent (4.75:1 on white) |
| `--wire-soft` | `rgba(207,65,22,.12)` | accent wash |

Rules: accent never fills a button. It is the wire, the fired marker, the live dot and focus ring. No green or red for price. No gradients on the page. No dark mode in v1.

### Type
| Role | Family | Size (mobile to desktop) | Weight | Tracking | Line height |
| --- | --- | --- | --- | --- | --- |
| Hero sentence | Instrument Serif | `clamp(2.15rem, 1rem + 5.4vw, 5.25rem)` | 400 | -0.03em | 1.02 |
| H2 | Instrument Serif | `clamp(2.1rem, 1.2rem + 3.4vw, 3.75rem)` | 400 | -0.028em | 1.04 |
| Step title | Instrument Serif | `clamp(1.8rem, 1.3rem + 1.6vw, 2.5rem)` | 400 | -0.02em | 1.1 |
| Lead | Geist | 1.125rem to 1.3125rem | 400 | -0.011em | 1.5 |
| Body | Geist | 1rem | 400 | -0.006em | 1.6 |
| UI | Geist | 0.875rem to 0.9375rem | 500 | -0.005em | 1.3 |
| Label | Geist Mono | 0.6875rem to 0.75rem, uppercase | 500 | 0.08em | 1.3 |
| Numerals in chart | Geist Mono | 0.75rem | 400 | 0 | 1 |

All headings `text-wrap: balance`. Body `text-wrap: pretty`. Fonts self-hosted through `next/font`.

### Space and shape
- Space scale (px): 4, 8, 12, 16, 24, 32, 48, 64, 96, 144. Section padding: 96 mobile, 144 desktop.
- Container: 1200 max, 24 padding below 900, 40 above.
- Radii: card 24, inner card 16, control 14, button 12, pill 999, media frame 28.
- Shadow (one recipe): `0 1px 0 rgba(20,20,19,.04), 0 24px 60px -28px rgba(20,20,19,.22)`.
- Hairline dividers over boxes wherever possible.

### Motion
- One curve: `--ease: cubic-bezier(0.16, 1, 0.3, 1)`.
- Entrance: translateY 14px and opacity, 700 ms, stagger 60 ms. Transform and opacity only.
- Sentence control change: 240 ms.
- Simulation: 5.2 s from first point to the last, linear in index, paused 600 ms at the crossing.
- Fired marker: one ring pulse, 900 ms, once.
- `prefers-reduced-motion`: no entrances, no loops, simulation jumps to its end state, video hidden and poster shown.

### Breakpoints
320 (floor), 375, 640 (phone tweaks), 768, 900 (nav collapses), 1280, 1512. Use `svh`, never `vh`.

## 3. Components

- `Nav`: sticky, 56 px, paper at 80 percent with 16 px blur and a hairline once scrolled. Brand left. Links: How it works, Controls, Roadmap, Token. One CTA: Try the simulator. Below 900 px: brand and menu button, CTA moves into the menu.
- `ChainStatus`: mono label, live dot, block number from `/api/chain`. On failure shows "Chain read unavailable".
- `RuleSentence`: serif sentence with three inline `Dropdown`s.
- `Dropdown`: button plus listbox popover. Arrow keys, Enter, Escape, outside click. 44 px target on touch.
- `SimulationCard`: white card, header (Simulation badge, token, legend), SVG chart, footer (status line, Play button).
- `MediaFrame`: 28 px radius frame, 21:9 on desktop, 4:3 on phones. Video loop with poster.
- `StepList`: three rows divided by hairlines, number, serif title left, copy right.
- `LimitPreview`: spend cap slider, expiry segmented control, token chips, revoke button. Labelled "Preview. No key is created."
- `RoadmapList`: three groups, each item with a status label.
- `TokenMechanics`: three plain lines and a one-row fee flow drawn on a wire.
- `Footer`: brand, three short lines of links, disclaimer.

## 4. Structure and copy

All copy final. Periods and commas only.

### Nav
Hookwire. How it works. Controls. Roadmap. Token. Button: Try the simulator.

### Hero
Eyebrow: `Robinhood Chain` · `Simulation` · block number.
H1: When **$ORBIT** **falls 30% from its peak**, **sell all.**
Sub: Write the rule once. Hookwire holds the line, inside a limit you set, while you sleep.
Primary: Play the simulation. Secondary: How it stays non-custodial.
Card caption: Simulated prices on a demo token. Nothing here trades.

Rule options
- Tokens: $ORBIT, $LANTERN, $MOSS. Menu note: Demo tokens, not real.
- Conditions: falls 30% from its peak, reaches 3x, drops 40% below entry.
- Actions: sell all, sell half, sell a quarter.

Result line: `Wire crossed at 0.70x of the peak. Sold all. Simulation.`

### Media
Caption: `Fig. 1. A rule is a line. The price either crosses it or it does not.`

### How it works
H2: Three steps, one line.
1. Set a line. Write a rule as a sentence: a price, a drop from the peak, a change in a pool. Hookwire reads it back to you as a trigger you can check.
2. Grant a limit. Give Hookwire a scoped session key with a spend cap, a token list and an expiry. It cannot act outside that box.
3. It acts. Keepers watch the chain and execute the rule when the line is crossed. They earn a small fee. You can revoke the key at any time.
Note: Steps two and three describe the planned system. Not live. The simulator above runs only in your browser.

### What you control
H2: You set the limits.
Lead: A session key is not your wallet. It can only do what the box allows.
List: Spend cap. Token list. Expiry. Kill switch. Readable on chain.
Card: LimitPreview. Note: Preview. No key is created.

### Roadmap
H2: What is live, and what is not.
- Live: Website and rule builder, in your browser. Simulation on demo tokens. Live chain read of Robinhood Chain.
- Next, Not live: Rule engine on testnet, no real funds. Session key design published for review.
- Later, Not live: Mainnet execution with low limits, after testing and an audit. Keeper network. Token.

### Token
H2: One token, one job.
Lead: It pays for keepers and lowers your fee. It is not an investment, and it is not launched.
Lines: Keeper fees fund buyback and burn. Holding or staking lowers your fee and raises how many rules you can run. Contract address: not published.
Risk: Tokens can lose all of their value. Only use money you can afford to lose. These mechanics are design intent and may change before launch.

### Footer
Hookwire. Links: X, Robinhood Chain explorer, Back to top.
Disclaimer: Hookwire is not affiliated with Robinhood, Uniswap Labs or any token mentioned. Demo tokens are fictional. On-chain trading can lose everything you put in.

## 5. Accessibility plan
- Skip link, landmarks, one H1 containing the real sentence, `aria-label` on both navs.
- Dropdowns: `aria-haspopup="listbox"`, `aria-expanded`, `role="listbox"` and `option`, roving focus, Escape returns focus.
- Chart: `role="img"` with a text alternative, result in an `aria-live="polite"` region.
- Focus ring: 2 px `--wire`, offset 3 px, on every interactive element.
- Targets 44 px on touch, inputs 16 px minimum.
- Reduced motion handled as above. Text contrast 4.5:1 or better.

## 6. Checks
No horizontal scroll at 320, 375, 640, 768, 900, 1280, 1512. Hero H1 at most three lines on phones, two on desktop. Lighthouse 95+ on all four. Zero em dashes, exclamation marks, ellipses or banned words in shipped copy.

## QA log, 26 Oct 2026

Checked on the production build with headless Chrome driven over the DevTools protocol, plus Lighthouse.

| Check | Result |
| --- | --- |
| Horizontal scroll at 320, 375, 640, 768, 900, 1280, 1512 | None. `scrollWidth` equals viewport width at every width. |
| Hero sentence line count | 2 lines at 768 and up. 4 to 5 lines at 320 to 640 because the chips wrap inside themselves. |
| Mobile menu | Opens, locks page scroll, moves focus to the first link, traps Tab, closes on Escape and returns focus to the menu button. |
| Reduced motion | Background video hidden, poster shown, simulation jumps to its end state. |
| Tap targets | Controls are 44px or taller after the fixes below. |
| Lighthouse (mobile, throttled) | Performance 95, Accessibility 96 before the contrast fix, Best practices 100, SEO 100. LCP 2.9 s, CLS 0, TBT 10 ms. |

Fixes made during QA.

1. Chip chevron dropped under the label because the global reset makes SVG `display: block`. Set it inline.
2. The comma after the condition chip wrapped alone onto its own line. Joined with a word joiner.
3. Hero chip text overflowed at 320. Chip text now wraps inside the chip.
4. Nav right group sat in the middle column when the link list was hidden. Pinned to the third column.
5. `dynamic = "force-dynamic"` is not allowed with Cache Components. Removed from the chain route.
6. Reveal and hero effects called `setState` inside effects. Reveal now toggles a class, and the hero resets from the change handlers.
7. "How it stays non-custodial" link and the spend cap slider were under 44px tall. Raised.
8. Footer year line used the decorative gray. Moved to the muted gray for contrast.
9. Copy audit. Removed colons and the phrase "financial advice" from public copy, changed "red line" to "orange line" to match the wire.

Not verified.

- Lighthouse was run once on a laptop. Re-run it on the deployed URL.
- LCP is the wordmark text, which waits on the display font. Preloading the font on the deployed site is the next lever.
- The public RPC is rate limited. The chain read is cached for 10 seconds on the server and degrades to "Chain read unavailable".

## Phase 2. App pages

The home page stays the cinematic pitch. The working pages reuse the same tokens and stay plain on purpose.

- `/app` rule builder. Two column on desktop, the left panel is the form, the right panel is a live sentence, price, trigger, quote and price impact. Below it, the user's rules as cards.
- `/pools` token lookup plus newest hooked pools. Every pool shows its decoded hook and a swap hook badge in the wire colour.
- `/keepers` armed rules, triggered first, with a simulated payout and one button.
- `/docs` prose at 68ch. Says what can go wrong before it says anything else.
- Status badges. Armed is a paper chip, Triggered uses the wire colour, Executed is solid ink, Cancelled and Expired are muted.
- Copy rule. Anything not live says so in one sentence. The home page reads `LIVE` from `NEXT_PUBLIC_RULES_ADDRESS` and changes its wording.

## Dark cinematic redesign

The whole site now uses one dark system.

- Base is pure black with white text. Secondary text is white at 70 and 55 percent. Lines are white at 10 percent.
- Accent is `#3054ff` for primary arrows, `#b4c0ff` as the end of headline gradients. The wire orange stays for anything that means "the line".
- Type is Instrument Sans for UI and headlines, Instrument Serif for kickers and section titles, Geist Mono for small labels and numbers.
- The home hero is a muted looping HLS video (hls.js, Safari native fallback) under a 60 percent black overlay with two blurred blue glows. It is skipped when the visitor prefers reduced motion.
- The nav is fixed and transparent, and gets a blurred black backing after scroll.
- Inner pages share `PageHead`, a serif kicker over a gradient sans title.
- The paper simulation moved below the hero as its own section, "Try a rule on paper".
- Primary actions are white pills. The hero action carries a blue arrow disc (`CtaButton`).
