// Mainnet end to end test through the real UI, in headless Chrome, with a scripted wallet.
//
//   E2E_PRIVATE_KEY=0x... TOKEN=0x... node scripts/e2e-ui.mjs create
//
// The page gets a window.ethereum that signs with E2E_PRIVATE_KEY (a throwaway test wallet)
// and forwards everything else to the RPC. Nothing is mocked on chain. This sends real transactions.
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { createWalletClient, defineChain, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const root = new URL("..", import.meta.url).pathname;
const env = Object.fromEntries(readFileSync(root + ".env.local", "utf8").split("\n").map((l) => l.match(/^([A-Z0-9_]+)=(.*)$/)).filter(Boolean).map((m) => [m[1], m[2]]));
const RPC = env.ROBINHOOD_RPC_URL;
const SITE = process.env.SITE ?? "http://localhost:3100";
const account = privateKeyToAccount(process.env.E2E_PRIVATE_KEY);
const TOKEN = process.env.TOKEN;
const chain = defineChain({ id: 4663, name: "Robinhood Chain", nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 }, rpcUrls: { default: { http: [RPC] } } });
const wallet = createWalletClient({ account, chain, transport: http(RPC) });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const port = 9300 + Math.floor(Math.random() * 500);
const proc = spawn("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", ["--headless=new", "--disable-gpu", "--remote-debugging-port=" + port, "--user-data-dir=/tmp/hw/e2e-" + port, "about:blank"], { stdio: "ignore" });
const done = (code) => { proc.kill(); process.exit(code); };
setTimeout(() => { console.log("TIMEOUT"); done(1); }, 240_000);

let wsUrl;
for (let i = 0; i < 60 && !wsUrl; i++) {
  try { wsUrl = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((t) => t.type === "page")?.webSocketDebuggerUrl; } catch {}
  await sleep(200);
}
const ws = new WebSocket(wsUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0;
const pend = new Map();
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pend.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (e) => (await send("Runtime.evaluate", { expression: e, returnByValue: true, awaitPromise: true })).result?.result?.value;

ws.onmessage = async (m) => {
  const d = JSON.parse(m.data);
  if (d.id && pend.has(d.id)) { pend.get(d.id)(d); pend.delete(d.id); return; }
  if (d.method === "Runtime.consoleAPICalled" && d.params.type === "error") console.log("CONSOLE ERROR", d.params.args.map((a) => a.value ?? a.description).join(" ").slice(0, 300));
  if (d.method === "Runtime.bindingCalled" && d.params.name === "__hwReq") {
    const { rid, method, params } = JSON.parse(d.params.payload);
    let result, error;
    try {
      if (method === "eth_sendTransaction") {
        const t = params[0];
        console.log("WALLET sendTransaction to", t.to);
        result = await wallet.sendTransaction({ to: t.to, data: t.data, value: t.value ? BigInt(t.value) : undefined });
        console.log("WALLET tx", result);
      } else {
        const r = await (await fetch(RPC, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) })).json();
        if (r.error) throw new Error(r.error.message);
        result = r.result;
      }
    } catch (e) { error = e.message; }
    await send("Runtime.evaluate", { expression: `window.__hwRes(${rid}, ${JSON.stringify(result ?? null)}, ${JSON.stringify(error ?? null)})` });
  }
};

await send("Page.enable");
await send("Runtime.enable");
await send("Runtime.addBinding", { name: "__hwReq" });
await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 1400, deviceScaleFactor: 1, mobile: false });
await send("Page.addScriptToEvaluateOnNewDocument", {
  source: `(() => {
    const pending = new Map(); let n = 0;
    window.__hwRes = (rid, result, error) => { const p = pending.get(rid); pending.delete(rid); error ? p.rej(Object.assign(new Error(error), { code: -32000 })) : p.res(result); };
    const local = { eth_chainId: "0x1237", eth_accounts: ["${account.address}"], eth_requestAccounts: ["${account.address}"], wallet_switchEthereumChain: null };
    window.ethereum = {
      isMetaMask: false,
      request: ({ method, params }) => method in local ? Promise.resolve(local[method]) : new Promise((res, rej) => { const rid = ++n; pending.set(rid, { res, rej }); window.__hwReq(JSON.stringify({ rid, method, params })); }),
      on() {}, removeListener() {},
    };
  })()`,
});

const clickText = (scope, text, exact = true) =>
  ev(`(() => { const b = [...document.querySelectorAll('${scope}')].find(x => ${exact ? "x.textContent.trim() === " : "x.textContent.trim().startsWith("}${JSON.stringify(text)}${exact ? "" : ")"}); if (!b) return false; b.click(); return true; })()`);
const main = () => ev("document.querySelector('main').innerText");
const waitFor = async (fn, label, ms = 60_000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn()) return true; await sleep(500); } console.log("WAIT FAILED:", label); console.log((await main())?.slice(0, 1500)); done(1); };

await send("Page.navigate", { url: SITE + "/app" });
await sleep(3500);
console.log("PAGE", await ev("location.href + ' | ' + document.title + ' | ' + document.body.innerText.slice(0,200)"));
await ev(`(() => { const i = document.querySelector('#token'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(i, '${TOKEN}'); i.dispatchEvent(new Event('input', { bubbles: true })); })()`);
await waitFor(async () => /HWTEST, 18 decimals/.test(await main()), "token meta");
await waitFor(async () => /HWTEST \/ ETH|ETH \/ HWTEST/.test(await main()), "pool listed");
console.log("token and pool found");

await clickText(".seg button", "Drops below entry");
await ev(`(() => { const i = document.querySelector('input[aria-label="Percent"]'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(i, '10'); i.dispatchEvent(new Event('input', { bubbles: true })); })()`);
await clickText(".seg button", "All");
await clickText(".seg button", "10%");
await clickText(".seg button", "0.3%");
await sleep(800);
await clickText("button", "Connect wallet", false);
await waitFor(async () => /Will not sell below/.test(await main()) && (await ev("[...document.querySelectorAll('button.btn-primary')].some(b => /Approve|Create/.test(b.textContent))")), "wallet connected");
console.log("SUMMARY BEFORE SUBMIT\n" + (await main()).split("YOUR RULE")[1]?.slice(0, 700));

const count = async () => BigInt((await (await fetch(RPC, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_call", params: [{ to: env.NEXT_PUBLIC_RULES_ADDRESS, data: "0xf6bcf633" }, "latest"] }) })).json()).result);
const before = await count();
await ev("[...document.querySelectorAll('button.btn-primary')].find(b => /Approve|Create/.test(b.textContent)).click()");
await waitFor(async () => (await count()) > before, "rule on chain", 120_000);
console.log("ruleCount", String(await count()));
await waitFor(async () => !/No rules yet/.test(await main()), "rule card in UI", 60_000);
await sleep(4000);
console.log("AFTER\n" + (await main()).slice(-1600));
done(0);
