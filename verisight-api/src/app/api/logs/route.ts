import { NextResponse } from "next/server";
import { getLogs } from "../../../lib/requestLog";

export const dynamic = "force-dynamic"; // tell Next not to cache this route

export async function GET() {
  return NextResponse.json(getLogs(), {
    headers: {
      "Cache-Control": "no-store, max-age=0, must-revalidate",
    },
  });
}