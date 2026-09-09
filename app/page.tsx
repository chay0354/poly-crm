"use client";

import { useEffect, useState } from "react";
import type { Summary } from "@/lib/summary";

const money = (n: number | null | undefined) =>
  n == null ? "—" : `${n >= 0 ? "+" : ""}${n.toFixed(2)}$`;
const cls = (n: number | null | undefined) =>
  n == null ? "flat" : n > 0.005 ? "win" : n < -0.005 ? "loss" : "flat";

export default function Page() {
  const [d, setD] = useState<Summary | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    let dead = false;
    const tick = async () => {
      try {
        const r = await fetch("/api/summary", { cache: "no-store" });
        const j = (await r.json()) as Summary & { error?: string };
        if (dead) return;
        if (j.error) setErr(j.error);
        else {
          setErr("");
          setD(j);
        }
      } catch {
        if (!dead) setErr("network");
      }
    };
    tick();
    const id = setInterval(tick, 8000);
    return () => {
      dead = true;
      clearInterval(id);
    };
  }, []);

  return (
    <>
      <header>
        <div>
          <h1>תוצאות הבוט</h1>
          <div className="sub">רק משחקים שנגמרו · בלי החלון הפתוח · מתעדכן כל 8 שניות</div>
        </div>
        <div className="sub">{err ? `שגיאה: ${err}` : d ? `עודכן ${d.now}` : "טוען…"}</div>
      </header>
      <main>
        {d && <Dash d={d} />}
      </main>
    </>
  );
}

function Dash({ d }: { d: Summary }) {
  const t = d.day;
  const last = d.last;
  return (
    <>
      <div className="row">
        <Kpi k="PnL היום" v={money(t.pnl)} c={cls(t.pnl)} />
        <Kpi k="משחקים היום" v={String(t.n)} c="" />
        <Kpi
          k="ניצחונות / הפסדים"
          v={`${t.wins} / ${t.losses}`}
          c={t.wins >= t.losses ? "win" : "loss"}
        />
        <Kpi k="זוגות מאוזנים" v={`${t.paired} · חד־צדדי ${t.naked}`} c="" />
      </div>
      <div className="half">
        <div className="card">
          <div className="k">המשחק הקודם</div>
          {!last ? (
            <div className="fill">עוד אין משחק שנסגר</div>
          ) : (
            <>
              <div className={`v ${cls(last.pnl)}`}>{money(last.pnl)}</div>
              <div className="fill" style={{ margin: "8px 0 10px" }}>
                {last.when} · עלות ${last.cost.toFixed(2)} · Up {last.up_shares.toFixed(2)} / Down{" "}
                {last.down_shares.toFixed(2)} · {last.paired ? "זוג נעול" : "לא מאוזן"}
              </div>
              <div className="fill">
                {(d.last_fills || []).length
                  ? d.last_fills.map((f, i) => (
                      <div key={i}>
                        {f.side} {Number(f.shares).toFixed(2)} @ {Number(f.price).toFixed(2)} ($
                        {Number(f.cost).toFixed(2)}) {f.strategy || ""}
                      </div>
                    ))
                  : "אין מילויים"}
              </div>
            </>
          )}
        </div>
        <div className="card">
          <div className="k">מצטבר היום</div>
          <Chart pts={d.curve || []} />
        </div>
      </div>
      <div className="card wide">
        <div className="k">חלונות שנסגרו</div>
        <table>
          <thead>
            <tr>
              <th>שעה</th>
              <th>תוצאה</th>
              <th>PnL</th>
              <th>עלות</th>
              <th>Up / Down</th>
              <th>סוג</th>
            </tr>
          </thead>
          <tbody>
            {d.recent.map((w) => (
              <tr key={`${w.window}-${w.ts}`}>
                <td>{w.when}</td>
                <td>
                  <span className={`pill ${w.result || "flat"}`}>{w.result || "—"}</span>
                </td>
                <td className={cls(w.pnl)}>{money(w.pnl)}</td>
                <td>${w.cost.toFixed(2)}</td>
                <td>
                  {w.up_shares.toFixed(1)} / {w.down_shares.toFixed(1)}
                </td>
                <td>{w.paired ? "זוג" : "צד אחד"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Kpi({ k, v, c }: { k: string; v: string; c: string }) {
  return (
    <div className="card">
      <div className="k">{k}</div>
      <div className={`v ${c}`}>{v}</div>
    </div>
  );
}

function Chart({ pts }: { pts: { when: string; cum: number; pnl: number | null }[] }) {
  if (pts.length < 2) {
    return <svg className="chart" viewBox="0 0 400 120" preserveAspectRatio="none" />;
  }
  const ys = pts.map((p) => p.cum);
  const min = Math.min(...ys, 0);
  const max = Math.max(...ys, 0);
  const span = max - min || 1;
  const coords = pts.map((p, i) => {
    const x = (i / (pts.length - 1)) * 400;
    const y = 110 - ((p.cum - min) / span) * 100;
    return [x, y] as const;
  });
  const dth = coords
    .map((c, i) => `${i ? "L" : "M"}${c[0].toFixed(1)},${c[1].toFixed(1)}`)
    .join(" ");
  const color = pts[pts.length - 1].cum >= 0 ? "#3dd68c" : "#ff6b6b";
  const zeroY = (110 - ((0 - min) / span) * 100).toFixed(1);
  return (
    <svg className="chart" viewBox="0 0 400 120" preserveAspectRatio="none">
      <path d={dth} fill="none" stroke={color} strokeWidth="2.2" />
      <line x1="0" y1={zeroY} x2="400" y2={zeroY} stroke="#262c36" />
    </svg>
  );
}
