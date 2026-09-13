import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import {
  applyOfficial,
  fetchOfficialUpWon,
  needsOfficialWinner,
} from "@/lib/gamma";
import { buildSummary, type Fill } from "@/lib/summary";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const BATCH = 6;
const MAX_CHECK = 24;

async function settleFromGamma(rows: Record<string, unknown>[]) {
  const candidates = rows
    .filter((r) => needsOfficialWinner(Number(r.up_shares || 0), Number(r.down_shares || 0)))
    .slice(0, MAX_CHECK);
  const patches: { slug: string; fields: ReturnType<typeof applyOfficial> }[] = [];
  for (let i = 0; i < candidates.length; i += BATCH) {
    const chunk = candidates.slice(i, i + BATCH);
    const winners = await Promise.all(
      chunk.map(async (row) => {
        const slug = String(row.window_slug || "");
        if (!slug) return { row, winner: null as boolean | null };
        try {
          return { row, winner: await fetchOfficialUpWon(slug) };
        } catch {
          return { row, winner: null as boolean | null };
        }
      }),
    );
    for (const { row, winner } of winners) {
      if (winner == null || winner === row.up_won) continue;
      const fields = applyOfficial(row, winner);
      Object.assign(row, fields, { gamma: true });
      patches.push({ slug: String(row.window_slug), fields });
    }
  }
  return patches;
}

export async function GET() {
  const url = process.env.SUPABASE_URL || "";
  const key = process.env.SUPABASE_SECRET_KEY || "";
  if (!url || !key) {
    return NextResponse.json(
      { error: "supabase not configured" },
      { status: 500 },
    );
  }
  const sb = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: raw, error } = await sb
    .from("windows")
    .select("*")
    .eq("mode", "live")
    .order("ts", { ascending: false })
    .limit(80);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const rows = (raw || []) as Record<string, unknown>[];
  const patches = await settleFromGamma(rows);
  for (const p of patches) {
    await sb
      .from("windows")
      .update(p.fields)
      .eq("mode", "live")
      .eq("window_slug", p.slug);
  }
  const summary = buildSummary(rows, []);
  let fills: Fill[] = [];
  if (summary.last?.window) {
    const { data: fdata } = await sb
      .from("fills")
      .select("ts,side,price,shares,cost,strategy,maker")
      .eq("mode", "live")
      .eq("window_slug", summary.last.window)
      .order("ts", { ascending: true });
    fills = (fdata || []) as Fill[];
  }
  return NextResponse.json(
    { ...summary, last_fills: fills },
    { headers: { "Cache-Control": "no-store" } },
  );
}
