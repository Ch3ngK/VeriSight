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
import { analyzeImageWithOpenAI } from "../../../lib/openaiVision"; // Added for OpenAI vision
import axios from "axios"; // For fetching image URLs

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

/**
 * Fetch fact-check snippets from a search API (e.g., Bing)
 * Returns 2-3 short snippets or [] on failure/timeout
 * Enhanced Analysis uses external API data to strengthen fact-checking
 */
async function fetchFactCheckSnippets(claim: string): Promise<string[]> {
  try {
    // Use Bing Search API if configured
    const bingKey = process.env.BING_SEARCH_API_KEY;
    if (!bingKey) return [];

    const searchUrl = `https://api.bing.microsoft.com/v7.0/search?q=${encodeURIComponent(claim)}&count=3`;
    const response = await Promise.race([
      axios.get(searchUrl, {
        headers: { "Ocp-Apim-Subscription-Key": bingKey },
        timeout: 3000
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 3500))
    ]);

    const results = (response as any).data?.webPages?.value || [];
    return results.slice(0, 3).map((r: any) => r.snippet || "").filter((s: string) => s.length > 0);
  } catch (err) {
    console.warn("[FactCheckSnippets] Failed:", err instanceof Error ? err.message : "unknown");
    return [];
  }
}

/**
 * Check if input text appears AI-generated using GPT model
 * Sends readable text payload (not raw JSON) including transcript, metadata, claims, signals, fact_check_snippets
 * Returns plain English string; "Detection unavailable" on error
 */
async function checkAIGeneratedText(inputText: string): Promise<string> {
  try {
    const systemPrompt = `You are VeriSight Detector. Using the provided transcript, metadata, claims, signals, and fact-check snippets, determine whether the text appears AI-generated. Look for unnatural phrasing, repetition, overuse of qualifiers, improbable factual density, mismatch with cited sources, and any deepfake-related claims. Respond in 3–5 plain English sentences: a short verdict (Likely AI generated / Possibly AI generated / Likely human), the top 2 indicators found, and a confidence estimate (low/medium/high).`;

    const completion = await Promise.race([
      client.chat.completions.create({
        model: "gpt-4o-mini",
        temperature: 0.2,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: inputText }
        ]
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 5000)) as any
    ]);

    return (completion as any).choices[0]?.message?.content || "Detection unavailable";
  } catch (err) {
    console.error("[AIDetector] Error:", err instanceof Error ? err.message : "unknown");
    return "Detection unavailable";
  }
}

export async function POST(req: Request) {
  const start = Date.now();

  try {

    // Accept JSON or multipart (for image upload)
    let body: any;
    let imageBase64: string | undefined;
    let imageUrl: string | undefined;
    const contentType = req.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      body = await req.json();
      imageBase64 = body.imageBase64; // Accept base64 image in JSON
      imageUrl = body.imageUrl; // Accept image URL in JSON
    } else if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      body = {};
      for (const [key, value] of form.entries()) {
        if (typeof value === "string") {
          body[key] = value;
        } else if (value instanceof File) {
          // Read file as base64
          const arrayBuffer = await value.arrayBuffer();
          imageBase64 = Buffer.from(arrayBuffer).toString("base64");
        }
      }
      if (form.has("imageUrl")) imageUrl = form.get("imageUrl") as string;
    } else {
      body = await req.json();
      imageBase64 = body.imageBase64;
      imageUrl = body.imageUrl;
    }


    const title = (body.title || "Untitled") as string;
    const url = (body.url || "") as string;
    const transcript = ((body.transcript || "") as string).slice(0, 12000);
    console.log("[analyze] transcript length:", transcript.length);
    console.log("[analyze] transcript preview:", transcript.slice(0, 80));
    const selectedText = ((body.selectedText || "") as string).slice(0, 5000);

    // Log incoming request for debugging
    console.log("ANALYZE REQ KEYS:", Object.keys(body || {}));
    console.log("ANALYZE REQ - Title:", title, "URL:", url, "Transcript length:", transcript.length);


    // We won’t send huge images; just tell AI how many frames exist (MVP)
    const frameCount = Array.isArray(body.frames) ? body.frames.length : 0;

    // --- IMAGE ANALYSIS (NEW, supports base64 or URL) ---
    let imageAnalysis = null;
    let usedImageBase64 = imageBase64;
    // Always ensure base64 is a data URL for OpenAI
    if (usedImageBase64 && !usedImageBase64.startsWith("data:")) {
      usedImageBase64 = `data:image/jpeg;base64,${usedImageBase64}`;
    }
    if (!usedImageBase64 && imageUrl) {
      // Fetch image from URL and convert to base64
      try {
        const imgResp = await axios.get(imageUrl, { responseType: "arraybuffer" });
        const contentType = imgResp.headers["content-type"] || "image/jpeg";
        usedImageBase64 = Buffer.from(imgResp.data, "binary").toString("base64");
        usedImageBase64 = `data:${contentType};base64,${usedImageBase64}`;
      } catch (e) {
        let details = (typeof e === "object" && e && "message" in e) ? (e as any).message : String(e);
        imageAnalysis = { error: "Failed to fetch image from URL", details };
      }
    }
    if (usedImageBase64) {
      try {
        // For image analysis, use plain English output (not JSON)
        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        const imgPrompt = "You are VeriSight. You analyze images for public safety, media integrity, and misinformation risk. Respond in clear English sentences suitable for display to end users. Do not use JSON.";
        const imgMessages = [
          { role: "system", content: imgPrompt },
          { role: "user", content: [
            { type: "image_url", image_url: { url: usedImageBase64 } }
          ] as any } // Cast as any to satisfy type, safe for this context
        ];
        const completion = await openai.chat.completions.create({
          model: "gpt-4.1",
          temperature: 0.2,
          messages: imgMessages
        });
        imageAnalysis = completion.choices[0].message.content;
      } catch (e) {
        // Log error but do not break text analysis
        console.error("Image analysis failed", e);
        let details = (typeof e === "object" && e && "message" in e) ? (e as any).message : String(e);
        imageAnalysis = { error: "Image analysis failed", details };
      }
    }

    // --- Unify image and video analysis logic ---
    // If only image is provided (no transcript/frames), run enhancements with image context
    if (!transcript && !Array.isArray(body.frames) && imageAnalysis) {
      // Optionally, pass imageAnalysis fields to enhancement modules if needed
      // For now, just include imageAnalysis in response and run default enhancements
    }

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

    // --- TEXT ANALYSIS (existing) ---
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

    // --- Merge image analysis if present (NEW) ---
    if (imageAnalysis) {
      // If image analysis is present, return it as plain English in the analysis field
      return NextResponse.json({ analysis: imageAnalysis }, { headers: corsHeaders });
    }

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

    // --- ENHANCED ANALYSIS: API-Based AI Text Detection ---
    // Build a safe context object with fallbacks to prevent NaN/0/empty outputs
    const extractedClaims = Array.isArray(parsed?.claims) ? parsed.claims.map((c: any) => c.claim || "") : [];
    const detectedSignals = Array.isArray(parsed?.signals) ? parsed.signals.map((s: any) => s.label || "") : [];

    // Fetch fact-check snippets for extracted claims (parallel requests with fallback to empty array)
    const factCheckSnippetsByclaim = await Promise.all(
      extractedClaims.slice(0, 3).map((claim: string) => fetchFactCheckSnippets(claim))
    );
    const flattenedSnippets = factCheckSnippetsByclaim.flat();

    // Build context object with sensible fallbacks
    const detectionContext = {
      transcript: transcript || "No transcript available",
      metadata: {
        title: title || "Unknown title",
        url: url || "Unknown URL",
        published: (body.publishDate as string) || "Unknown date"
      },
      claims: extractedClaims.length > 0 ? extractedClaims : ["No claims detected"],
      signals: detectedSignals.length > 0 ? detectedSignals : ["No signals detected"],
      fact_check_snippets: flattenedSnippets.length > 0 ? flattenedSnippets : []
    };

    // Format context as readable text (not raw JSON) for the detector
    const detectorInput = `
TRANSCRIPT: ${detectionContext.transcript}
METADATA:
  - Title: ${detectionContext.metadata.title}
  - URL: ${detectionContext.metadata.url}
  - Published: ${detectionContext.metadata.published}
CLAIMS: ${detectionContext.claims.join("; ")}
SIGNALS: ${detectionContext.signals.join("; ")}
FACT-CHECK SNIPPETS: ${detectionContext.fact_check_snippets.join(" || ") || "None found"}
    `.trim();

    // Call AI detector and capture result (with graceful fallback)
    let enhancedAnalysis = "Enhanced analysis unavailable";
    try {
      enhancedAnalysis = await checkAIGeneratedText(detectorInput);
      if (!enhancedAnalysis || typeof enhancedAnalysis !== "string") {
        enhancedAnalysis = "Enhanced analysis unavailable";
      }
    } catch (eaErr) {
      console.error("Enhanced analysis failed:", eaErr);
      enhancedAnalysis = "Enhanced analysis unavailable";
    }

    // Add enhanced_analysis to the full response object
    response.enhanced_analysis = enhancedAnalysis;

    // Log for debugging
    console.log("OVERVIEW RESULT:", response.summary);
    console.log("ENHANCED ANALYSIS RESULT:", enhancedAnalysis);

    // Return the complete response object with all analysis data + enhanced_analysis
    return NextResponse.json(response, { headers: corsHeaders });
  } catch (err: any) {
    console.error("[Analyze] Handler error:", err);
    return NextResponse.json(
      { error: err.message || "AI analysis failed", overview: "Error during analysis", enhanced_analysis: "Detection unavailable" },
      { status: 500, headers: corsHeaders }
    );
  }
}