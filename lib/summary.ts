export type Fill = {
  ts?: string;
  side?: string;
  price?: number;
  shares?: number;
  cost?: number;
  strategy?: string;
  maker?: boolean;
};

export type WindowRow = {
  window: string | null;
  ts: string | null;
  when: string;
  date: string;
  cost: number;
  pnl: number | null;
  result: string | null;
  up_shares: number;
  down_shares: number;
  paired: boolean;
  strategies: string[];
  up_won: boolean | null;
};

export type Summary = {
  now: string;
  today: string;
  last: WindowRow | null;
  last_fills: Fill[];
  day: {
    n: number;
    wins: number;
    losses: number;
    flats: number;
    pnl: number;
    spent: number;
    paired: number;
    naked: number;
    best: WindowRow | null;
    worst: WindowRow | null;
  };
  recent: WindowRow[];
  curve: { when: string; cum: number; pnl: number | null }[];
  error?: string;
};

const IL_OFFSET_MS = 3 * 60 * 60 * 1000;

function parseTs(ts: unknown): Date | null {
  if (!ts) return null;
  const s = String(ts).replace("Z", "+00:00");
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function ilParts(d: Date) {
  const shifted = new Date(d.getTime() + IL_OFFSET_MS);
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const day = String(shifted.getUTCDate()).padStart(2, "0");
  const hh = String(shifted.getUTCHours()).padStart(2, "0");
  const mm = String(shifted.getUTCMinutes()).padStart(2, "0");
  const ss = String(shifted.getUTCSeconds()).padStart(2, "0");
  return { date: `${y}-${m}-${day}`, time: `${hh}:${mm}`, clock: `${hh}:${mm}:${ss}` };
}

function settled(row: Record<string, unknown>, nowSec: number): boolean {
  const end = row.window_end;
  if (end != null) {
    const n = Number(end);
    if (!Number.isNaN(n)) return n <= nowSec - 1;
  }
  const dt = parseTs(row.ts);
  return dt != null && dt.getTime() / 1000 <= nowSec - 1;
}

function shape(row: Record<string, unknown>): WindowRow {
  const up = Number(row.up_shares || 0);
  const dn = Number(row.down_shares || 0);
  const ts = parseTs(row.ts);
  const il = ts ? ilParts(ts) : { date: "", time: "", clock: "" };
  return {
    window: (row.window_slug as string) || null,
    ts: (row.ts as string) || null,
    when: il.time,
    date: il.date,
    cost: Number(row.cost || 0),
    pnl: row.estimated_pnl == null ? null : Number(row.estimated_pnl),
    result: (row.result as string) || null,
    up_shares: up,
    down_shares: dn,
    paired: Math.abs(up - dn) < 0.5 && Math.min(up, dn) > 0.01,
    strategies: (row.strategies as string[]) || [],
    up_won: (row.up_won as boolean | null) ?? null,
  };
}

export function buildSummary(
  raw: Record<string, unknown>[],
  fills: Fill[],
): Summary {
  const nowSec = Date.now() / 1000;
  const today = ilParts(new Date()).date;
  const settledRows = raw.filter((r) => settled(r, nowSec)).map(shape);
  const day = settledRows.filter((w) => w.date === today);
  const last = settledRows[0] ?? null;
  const wins = day.filter((w) => w.result === "win");
  const losses = day.filter((w) => w.result === "loss");
  const flats = day.filter((w) => w.result === "flat");
  const paired = day.filter((w) => w.paired);
  const naked = day.filter((w) => !w.paired);
  const pnls = day.map((w) => w.pnl).filter((n): n is number => n != null);
  const chrono = [...day].reverse();
  let run = 0;
  const curve = chrono.map((w) => {
    if (w.pnl != null) run += w.pnl;
    return { when: w.when, cum: Math.round(run * 100) / 100, pnl: w.pnl };
  });
  const best = day.length
    ? day.reduce((a, b) => ((a.pnl ?? -1e9) >= (b.pnl ?? -1e9) ? a : b))
    : null;
  const worst = day.length
    ? day.reduce((a, b) => ((a.pnl ?? 1e9) <= (b.pnl ?? 1e9) ? a : b))
    : null;
  return {
    now: ilParts(new Date()).clock,
    today,
    last,
    last_fills: fills,
    day: {
      n: day.length,
      wins: wins.length,
      losses: losses.length,
      flats: flats.length,
      pnl: Math.round(pnls.reduce((s, n) => s + n, 0) * 100) / 100,
      spent: Math.round(day.reduce((s, w) => s + w.cost, 0) * 100) / 100,
      paired: paired.length,
      naked: naked.length,
      best,
      worst,
    },
    recent: settledRows.slice(0, 16),
    curve,
  };
}
