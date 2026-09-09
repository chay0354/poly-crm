import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { buildSummary, type Fill } from "@/lib/summary";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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
