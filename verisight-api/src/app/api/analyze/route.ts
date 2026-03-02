import { NextResponse } from "next/server";
import OpenAI from "openai";
import { addLog } from "../../../lib/requestLog";
import { analyzeFrames, enhanceAnalysisWithFrameContext } from "../../../lib/frameEnhancement";
import { enrichWithEmergencyData } from "../../../lib/emergencyData";
import { enrichWithEnvironmentalData } from "../../../lib/environmentalData";
import { enrichWithGeoContext } from "../../../lib/geoContext";
import { enrichWithSMSCapability, queueSMSAlert } from "../../../lib/smsFallback";
import { enrichWithAIDetection } from "../../../lib/aiTextDetection";
import { enrichWithDeepfakeDetection } from "../../../lib/deepfakeDetection";
import { enrichWithFactChecking } from "../../../lib/factCheckIntegration";
import { enrichWithReverseImageSearch } from "../../../lib/reverseImageSearch";
import { enrichWithStatisticalValidation } from "../../../lib/statisticalValidator";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "*",
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

function ruleBasedCrisis(title: string, transcript: string, selectedText: string = "") {
  const text = `${title}\n${transcript}\n${selectedText}`.toLowerCase();
  const keywords = [
    "shoot", "stabbing", "knife", "attack", "assault",
    "riot", "explosion", "bomb", "fire", "smoke",
    "missing", "kidnap", "abduct",
    "earthquake", "flood", "storm", "haze",
    "outbreak", "virus", "infection"
  ];

  const hit = keywords.filter((k) => text.includes(k));
  // special-case trigger words: fire/smoke always count
  const fireTerms = ["fire", "smoke", "flames"];
  const hasFire = hit.some(k => fireTerms.some(t => k.toLowerCase().includes(t)));

  // big adjectives that should elevate any single keyword to crisis
  const magnifiers = ["large","massive","paramount","huge","major","significant","catastrophic"];
  const hasMagnifier = magnifiers.some(adj => text.includes(adj));

  // crisis if two keywords OR fire present OR (one keyword + magnifier)
  const isCrisis = hit.length >= 2 || hasFire || (hit.length >= 1 && hasMagnifier);

  // derive category if possible from first hit or magnifier context
  let category: CrisisCategory = "none";
  if (isCrisis) {
    if (hit.some(h => h.toLowerCase().includes("shoot"))) category = "crime";
    else if (hit.some(h => h.toLowerCase().includes("fire") || h.toLowerCase().includes("smoke"))) category = "fire";
    else if (hit.some(h => h.toLowerCase().includes("ambulance") || h.toLowerCase().includes("medical"))) category = "medical";
    else if (hasMagnifier) category = "other";
    else category = "other";
  }

  return {
    is_crisis: isCrisis,
    category: category,
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
    console.log("[analyze] transcript length:", transcript.length);
    console.log("[analyze] transcript preview:", transcript.slice(0, 80));
    const selectedText = ((body.selectedText || "") as string).slice(0, 5000);

    // We won’t send huge images; just tell AI how many frames exist (MVP)
    const frameCount = Array.isArray(body.frames) ? body.frames.length : 0;

    const userPrompt = `
  TITLE: ${title}
  URL: ${url}

  TRANSCRIPT:
  ${transcript}

  VISUAL FRAMES:
  ${frameCount > 0 ? `(received ${frameCount} sampled frames)` : "(none)"}

  SELECTED TEXT:
  ${selectedText ? selectedText : "(none)"}

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
      model: "gpt-4o-mini",
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
    const rb = ruleBasedCrisis(title, transcript, selectedText);

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
    let response = {
      summary: parsed?.summary || "",
      crisis_mode: crisis,
      recommended_action,
      signals: Array.isArray(parsed?.signals) ? parsed.signals : [],
      claims: Array.isArray(parsed?.claims) ? parsed.claims : [],
      public_safety_notes: Array.isArray(parsed?.public_safety_notes) ? parsed.public_safety_notes : [],
      caveats: Array.isArray(parsed?.caveats) ? parsed.caveats : [],
      selected_text: selectedText || ""
    } as any;

    // Initialize all detection modules with defaults so UI always has data
    response.ai_detection = {
      ai_probability: 0,
      conclusion: "uncertain",
      indicators: {},
      warnings: []
    };
    response.frame_analysis = {
      frames_analyzed: 0,
      motion_detected: false,
      average_quality: "low",
      visual_signals: [],
      recommendation: "No frames analyzed"
    };
    response.deepfake_detection = {
      deepfake_probability: 0,
      conclusion: "uncertain",
      artifacts: {},
      warnings: []
    };
    response.fact_check = {
      claims_analyzed: 0,
      verified_count: 0,
      false_count: 0,
      unverified_count: 0,
      credibility_score: 0.5,
      fact_checks: [],
      warnings: []
    };
    response.reverse_image_search = {
      matches: [],
      primary_conclusion: "unknown",
      timestamp_inconsistencies: [],
      warnings: []
    };

    // defaults for other enhancements so UI doesn't show dashes
    response.emergency_data_validation = {
      emergency_datasets_available: 0,
      matching_incident_patterns: [],
      contextual_confidence_boost: 0,
      dataset_note: "",
    };
    response.environmental_validation = {
      weather_alerts_count: 0,
      satellite_anomalies_count: 0,
      disaster_pattern_confidence: 0,
      weather_alerts: [],
    };
    response.geolocation_context = {
      extracted_location: "",
      location_confidence: 0,
      nearby_emergency_facilities: [],
    };

    /* ----- RUN ALL ENHANCEMENTS IN PARALLEL FOR SPEED ----- */
    const enhancementPromises: Promise<any>[] = [];

    // ENHANCEMENT 1: Frame-based analysis (always run)
    response = await enhanceAnalysisWithFrameContext(body.frames || [], response);

    // ENHANCEMENT 2-9: Run all async enrichments in parallel
    if (process.env.ENABLE_EMERGENCY_DATA !== "false") {
      enhancementPromises.push(
        enrichWithEmergencyData(response, title, transcript).then(r => ({ type: "emergency", data: r }))
      );
    }

    if (process.env.ENABLE_ENVIRONMENTAL_DATA !== "false") {
      enhancementPromises.push(
        enrichWithEnvironmentalData(response, title, transcript).then(r => ({ type: "environmental", data: r }))
      );
    }

    if (process.env.ENABLE_GEO_CONTEXT !== "false") {
      enhancementPromises.push(
        enrichWithGeoContext(response, title, transcript).then(r => ({ type: "geo", data: r }))
      );
    }

    if (process.env.ENABLE_AI_TEXT_DETECTION === "true" && transcript) {
      enhancementPromises.push(
        enrichWithAIDetection(response, transcript).then(r => ({ type: "ai_detection", data: r }))
      );
    }

    if (process.env.ENABLE_DEEPFAKE_DETECTION === "true" && Array.isArray(body.frames) && body.frames.length > 0) {
      enhancementPromises.push(
        enrichWithDeepfakeDetection(response, body.frames).then(r => ({ type: "deepfake", data: r }))
      );
    }

    const factText = (transcript || selectedText || "").trim();

    if (process.env.ENABLE_FACT_CHECK === "true" && factText) {
      enhancementPromises.push(
        enrichWithFactChecking(response, factText).then(r => ({ type: "fact_check", data: r }))
      );
    }

    if (process.env.ENABLE_REVERSE_IMAGE_SEARCH === "true" && Array.isArray(body.frames) && body.frames.length > 0) {
      enhancementPromises.push(
        enrichWithReverseImageSearch(response, body.frames, title, transcript).then(r => ({ type: "reverse_image", data: r }))
      );
    }

    // Execute all enrichments concurrently with 5-second timeout per module
    const timeoutPromise = (promise: Promise<any>, timeoutMs = 5000) =>
      Promise.race([
        promise,
        new Promise(reject =>
          setTimeout(() => reject(new Error('Enrichment timeout')), timeoutMs)
        )
      ]);

    const results = await Promise.all(
      enhancementPromises.map(p => timeoutPromise(p).catch(err => {
        console.warn('Enrichment failed:', err.message);
        return null;
      }))
    );

    // Merge results back into response (preserve all properties)
    for (const result of results) {
      if (result && result.data) {
        response = { ...response, ...result.data };
      }
    }

    // ENHANCEMENT 5: SMS (sync operation, no await needed)
    response = enrichWithSMSCapability(response);

    // Queue SMS alerts for high-priority incidents
    if (crisis.is_crisis && recommended_action === "escalate") {
      // In production, would use user's registered emergency contact from storage
      const emergencyPhone = process.env.EMERGENCY_CONTACT_PHONE || "";
      if (emergencyPhone) {
        queueSMSAlert(emergencyPhone, response, "high");
      }
    }

    return NextResponse.json(response, { headers: corsHeaders });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "AI failed" },
      { status: 500, headers: corsHeaders }
    );
  }
}