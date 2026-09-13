/** Polymarket Gamma — official Up/Down winner, not the bot's TWAP guess. */

const GAMMA = "https://gamma-api.polymarket.com";
const SNAP_WIN = 0.92;
const SNAP_LOSE = 0.08;

export type OfficialWinner = boolean | null;

const snapped = new Map<string, boolean>();

function asList(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string") {
    try {
      const v = JSON.parse(raw);
      return Array.isArray(v) ? v : [];
    } catch {
      return [];
    }
  }
  return [];
}

export function parseOfficialUpWon(event: unknown): OfficialWinner {
  const markets = (event as { markets?: unknown[] } | null)?.markets;
  const m = Array.isArray(markets) ? markets[0] : null;
  if (!m || typeof m !== "object") return null;
  const row = m as { outcomePrices?: unknown; outcomes?: unknown };
  const prices = asList(row.outcomePrices).map(Number);
  const outcomes = asList(row.outcomes).map((o) => String(o).toLowerCase());
  if (prices.length < 2 || outcomes.length < 2) return null;
  const by: Record<string, number> = {};
  for (let i = 0; i < outcomes.length && i < prices.length; i++) {
    by[outcomes[i]] = prices[i];
  }
  let up = by.up;
  let dn = by.down;
  if (up == null || dn == null) {
    up = prices[0];
    dn = prices[1];
  }
  if (!Number.isFinite(up) || !Number.isFinite(dn)) return null;
  if (up >= SNAP_WIN && dn <= SNAP_LOSE) return true;
  if (dn >= SNAP_WIN && up <= SNAP_LOSE) return false;
  return null;
}

export async function fetchOfficialUpWon(slug: string): Promise<OfficialWinner> {
  const hit = snapped.get(slug);
  if (hit !== undefined) return hit;
  const ctrl = AbortSignal.timeout(8000);
  const r = await fetch(`${GAMMA}/events?slug=${encodeURIComponent(slug)}`, {
    cache: "no-store",
    signal: ctrl,
  });
  if (!r.ok) return null;
  const data = (await r.json()) as unknown[];
  const winner = parseOfficialUpWon(data?.[0]);
  if (winner !== null) snapped.set(slug, winner);
  return winner;
}

export function estimatedPnl(
  windowPnl: unknown,
  upWon: boolean | null,
  upShares: number,
  downShares: number,
  cost: number,
): number | null {
  if (windowPnl != null && windowPnl !== "") return Number(windowPnl);
  const up = Number(upShares || 0);
  const dn = Number(downShares || 0);
  const c = Number(cost || 0);
  if (upWon === true) return Math.round((up - c) * 10000) / 10000;
  if (upWon === false) return Math.round((dn - c) * 10000) / 10000;
  const paired = Math.min(up, dn);
  if (paired > 0.01 && Math.abs(up - dn) < 0.5) {
    return Math.round((paired - c) * 10000) / 10000;
  }
  return null;
}

export function classify(traded: boolean, pnl: number | null): string | null {
  if (!traded) return "skip";
  if (pnl == null) return "open";
  if (pnl > 0.005) return "win";
  if (pnl < -0.005) return "loss";
  return "flat";
}

/** Naked held leg — a wrong winner flips a +$2 into a −$20. Exits/pairs do not. */
export function needsOfficialWinner(upShares: number, downShares: number): boolean {
  const up = Number(upShares || 0);
  const dn = Number(downShares || 0);
  return (up > 0.01 && dn < 0.01) || (dn > 0.01 && up < 0.01);
}

export function applyOfficial(
  row: Record<string, unknown>,
  upWon: boolean,
): { up_won: boolean; estimated_pnl: number | null; result: string | null } {
  const pnl = estimatedPnl(
    null,
    upWon,
    Number(row.up_shares || 0),
    Number(row.down_shares || 0),
    Number(row.cost || 0),
  );
  return {
    up_won: upWon,
    estimated_pnl: pnl,
    result: classify(true, pnl),
  };
}
