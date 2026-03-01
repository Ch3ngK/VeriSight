import { NextResponse } from "next/server";
import OpenAI from "openai";
import { addLog } from "../../../lib/requestLog";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

type CrisisCategory =
  | "none"
  | "crime"
  | "fire"
  | "medical"
  | "missing_person"
  | "disaster"
  | "terror"
  | "outbreak"
  | "other";

type RecommendedAction = "ignore" | "monitor" | "verify" | "escalate";

function ruleBasedCrisis(title: string, transcript: string) {
  const text = `${title}\n${transcript}`.toLowerCase();
  const keywords = [
    "shoot", "stabbing", "knife", "attack", "assault",
    "riot", "explosion", "bomb", "fire", "smoke",
    "missing", "kidnap", "abduct",
    "earthquake", "flood", "storm", "haze",
    "outbreak", "virus", "infection"
  ];

  const hit = keywords.filter((k) => text.includes(k));
  const isCrisis = hit.length >= 2;

  return {
    is_crisis: isCrisis,
    category: (isCrisis ? "other" : "none") as CrisisCategory,
    why: isCrisis
      ? `Matched keywords: ${hit.slice(0, 6).join(", ")}`
      : "No strong crisis indicators.",
    keywords: hit.slice(0, 10),
  };
}

function safeAction(x: any): RecommendedAction {
  return x === "ignore" || x === "monitor" || x === "verify" || x === "escalate"
    ? x
    : "verify";
}

function safeCategory(x: any): CrisisCategory {
  const allowed: CrisisCategory[] = [
    "none","crime","fire","medical","missing_person","disaster","terror","outbreak","other"
  ];
  return allowed.includes(x) ? x : "other";
}

export async function POST(req: Request) {
  const start = Date.now();

  try {
    const body = await req.json();

    const title = (body.title || "Untitled") as string;
    const url = (body.url || "") as string;
    const transcript = ((body.transcript || "") as string).slice(0, 12000);

    // We won’t send huge images; just tell AI how many frames exist (MVP)
    const frameCount = Array.isArray(body.frames) ? body.frames.length : 0;

    const userPrompt = `
TITLE: ${title}
URL: ${url}

TRANSCRIPT:
${transcript}

VISUAL FRAMES:
${frameCount > 0 ? `(received ${frameCount} sampled frames)` : "(none)"}

You are a public safety + media integrity assistant.

Rules:
- Do NOT declare content true/false.
- Provide risk-based signals and verification guidance.
- No vigilantism. Encourage official sources.
- Return STRICT JSON ONLY.

Return this exact JSON structure:

{
  "summary": "...",
  "crisis_mode": {
    "is_crisis": true|false,
    "category": "none|crime|fire|medical|missing_person|disaster|terror|outbreak|other",
    "why": "...",
    "keywords": ["..."]
  },
  "recommended_action": "ignore|monitor|verify|escalate",
  "signals": [
    {"label":"...","severity":"low|medium|high","why":"..."}
  ],
  "claims": [
    {
      "claim":"...",
      "type":"claim|opinion|unclear",
      "confidence":"low|medium|high",
      "verify_steps":["..."],
      "search_queries":["..."]
    }
  ],
  "public_safety_notes": [
    "Short practical safety notes. No vigilantism. Encourage official sources."
  ],
  "caveats":["..."]
}
`;

    const completion = await client.chat.completions.create({
      model: "gpt-4.1-mini",
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are VeriSight. You extract checkable claims and provide verification steps and public-safety risk signals. You must output STRICT JSON only."
        },
        { role: "user", content: userPrompt }
      ]
    });

    const content = completion.choices[0].message.content!;
    const parsed: any = JSON.parse(content);

    // Fallbacks / sanitization (so UI won’t break)
    const rb = ruleBasedCrisis(title, transcript);

    const crisis = {
      is_crisis: typeof parsed?.crisis_mode?.is_crisis === "boolean"
        ? parsed.crisis_mode.is_crisis
        : rb.is_crisis,
      category: safeCategory(parsed?.crisis_mode?.category || rb.category),
      why: (parsed?.crisis_mode?.why || rb.why || "") as string,
      keywords: Array.isArray(parsed?.crisis_mode?.keywords)
        ? parsed.crisis_mode.keywords.slice(0, 12)
        : rb.keywords
    };

    const recommended_action: RecommendedAction = safeAction(parsed?.recommended_action);

    const duration = Date.now() - start;

    const highSeveritySignals =
      Array.isArray(parsed?.signals)
        ? parsed.signals.filter((s: any) => s?.severity === "high").length
        : 0;

    // Log for dashboard (Option C later)
    addLog({
      id: crypto.randomUUID(),
      title,
      transcriptLength: transcript.length,
      timestamp: Date.now(),
      durationMs: duration,

      // NEW fields (make sure requestLog.ts supports these)
      recommendedAction: recommended_action,
      isCrisis: crisis.is_crisis,
      crisisCategory: crisis.category,
      highSeveritySignals
    } as any);

    // Ensure response includes our fields even if model omitted them
    const response = {
      summary: parsed?.summary || "",
      crisis_mode: crisis,
      recommended_action,
      signals: Array.isArray(parsed?.signals) ? parsed.signals : [],
      claims: Array.isArray(parsed?.claims) ? parsed.claims : [],
      public_safety_notes: Array.isArray(parsed?.public_safety_notes) ? parsed.public_safety_notes : [],
      caveats: Array.isArray(parsed?.caveats) ? parsed.caveats : []
    };

    return NextResponse.json(response, { headers: corsHeaders });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "AI failed" },
      { status: 500, headers: corsHeaders }
    );
  }
}