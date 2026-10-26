import { formatUnits } from "viem";

export const short = (a?: string) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "");

export function fmtToken(v: bigint, decimals: number, maxFrac = 4) {
  const s = formatUnits(v, decimals);
  const [i, f = ""] = s.split(".");
  // Below 1, keep significant digits instead of cutting at a fixed number of decimals, so 0.00002 does not read as 0.
  if (i === "0" && f) {
    const lead = f.match(/^0*/)![0].length;
    return `0.${f.slice(0, Math.max(maxFrac, lead + 4)).replace(/0+$/, "")}`;
  }
  const frac = f.slice(0, maxFrac).replace(/0+$/, "");
  const intWithCommas = i.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return frac ? `${intWithCommas}.${frac}` : intWithCommas;
}

const SCALE = 10n ** 36n;
/** Price of one whole input token in whole output tokens, from a Q96 price in raw units. */
export function humanPrice(q96: bigint, decIn: number, decOut: number) {
  const v = (q96 * SCALE) >> 96n;
  return (Number(v) / 1e36) * 10 ** (decIn - decOut);
}

export function fmtPrice(p: number) {
  if (!isFinite(p) || p === 0) return "0";
  if (p >= 1000) return p.toLocaleString("en-US", { maximumFractionDigits: 2 });
  if (p >= 1) return p.toLocaleString("en-US", { maximumSignificantDigits: 5 });
  return p.toPrecision(4).replace(/\.?0+$/, (m) => (m.includes("e") ? m : ""));
}

export function fmtCompact(n: number) {
  if (n >= 1e15) return n.toExponential(2).replace("e+", "e");
  return Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 2 }).format(n);
}

export function timeLeft(expirySec: number, nowSec = Math.floor(Date.now() / 1000)) {
  const d = expirySec - nowSec;
  if (d <= 0) return "expired";
  if (d < 3600) return `${Math.ceil(d / 60)} min left`;
  if (d < 86400) return `${Math.floor(d / 3600)} h left`;
  return `${Math.floor(d / 86400)} d left`;
}

/** Pool fee in hundredths of a bip. The 0x800000 flag marks a dynamic fee set by the hook. */
export function fmtPoolFee(fee: number) {
  return fee & 0x800000 ? "dynamic" : `${(fee / 10000).toFixed(2)}%`;
}
