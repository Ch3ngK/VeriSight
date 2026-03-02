import { NextRequest, NextResponse } from "next/server";
import Twilio from "twilio";

export const runtime = "nodejs";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-API-KEY",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function GET() {
  return NextResponse.json(
    { ok: true, note: "SMS endpoint is working. Use POST to send SMS." },
    { status: 200, headers: corsHeaders }
  );
}

export async function POST(req: NextRequest) {
  try {
    const apiKey = req.headers.get("x-api-key");
    if (!process.env.SMS_API_KEY || apiKey !== process.env.SMS_API_KEY) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401, headers: corsHeaders }
      );
    }

    // Accept both JSON and "message=..." bodies
    let message = "VeriSight SMS Alert";
    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      const body = await req.json().catch(() => ({} as any));
      if (typeof body.message === "string" && body.message.trim()) {
        message = body.message.trim();
      }
    } else {
      const raw = await req.text().catch(() => "");
      const params = new URLSearchParams(raw);
      const maybe = params.get("message") || raw;
      if (maybe && maybe.trim()) message = maybe.trim();
    }

    const to = process.env.EMERGENCY_TO_NUMBER;
    const from = process.env.TWILIO_FROM_NUMBER;
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;

    if (!to || !from || !sid || !token) {
      return NextResponse.json(
        { ok: false, error: "Missing Twilio config" },
        { status: 400, headers: corsHeaders }
      );
    }

    const client = Twilio(sid, token);

    const result = await client.messages.create({
      to,
      from,
      body: message,
    });

    return NextResponse.json(
      { ok: true, sid: result.sid },
      { status: 200, headers: corsHeaders }
    );
  } catch (err: any) {
    console.error("[SMS ERROR]", err);
    const msg = err?.message || "SMS failed";
    return NextResponse.json(
      { ok: false, error: msg },
      { status: 500, headers: corsHeaders }
    );
  }
}