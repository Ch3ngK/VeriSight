import { NextResponse } from "next/server";
import { getLogs } from "../../../lib/requestLog";

export const dynamic = "force-dynamic";

export async function GET() {
  const logs = getLogs();

  const total = logs.length;
  const crisisCount = logs.filter(l => l.isCrisis).length;

  const byAction = logs.reduce((acc: any, l: any) => {
    acc[l.recommendedAction] = (acc[l.recommendedAction] || 0) + 1;
    return acc;
  }, {});

  const byCategory = logs.reduce((acc: any, l: any) => {
    acc[l.crisisCategory] = (acc[l.crisisCategory] || 0) + 1;
    return acc;
  }, {});

  const avgMs =
    total === 0 ? 0 : Math.round(logs.reduce((s: number, l: any) => s + l.durationMs, 0) / total);

  return NextResponse.json({
    total,
    crisisCount,
    avgMs,
    byAction,
    byCategory,
    recent: logs.slice(0, 10)
  }, {
    headers: { "Cache-Control": "no-store" }
  });
}