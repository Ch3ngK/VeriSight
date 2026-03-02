
const analyzeBtn = document.getElementById("analyzeBtn");
const statusEl = document.getElementById("status");
const titleEl = document.getElementById("title");
const timerEl = document.getElementById("timer");
const urlEl = document.getElementById("url");
const transcriptEl = document.getElementById("transcript");
const loader = document.getElementById("loader");
// Image upload and URL input removed: analysis now works on any website without them.

function setStatus(msg) {
  statusEl.textContent = msg || "";
}

function formatMs(ms) {
  const totalSec = Math.floor(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  const tenths = Math.floor((ms % 1000) / 100);
  return min > 0
    ? `${min}:${String(sec).padStart(2, "0")}.${tenths}s`
    : `${sec}.${tenths}s`;
}

function startTimer() {
  const start = Date.now();
  if (timerEl) timerEl.textContent = "Time: 0.0s";

  const id = setInterval(() => {
    const elapsed = Date.now() - start;
    if (timerEl) timerEl.textContent = `Time: ${formatMs(elapsed)}`;
  }, 100);

  return {
    stop: () => clearInterval(id)
  };
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

function isYouTubeWatchUrl(url) {
  try {
    const u = new URL(url);
    return u.hostname.includes("youtube.com") && u.pathname === "/watch";
  } catch {
    return false;
  }
}

function safeString(x) {
  return typeof x === "string" ? x : "";
}

/* -------------------------------------------------
   CONTENT SCRIPT MESSAGE (with auto injection)
-------------------------------------------------- */
async function sendMessageWithInjection(tabId, message) {
  try {
    return await chrome.tabs.sendMessage(tabId, message);
  } catch {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["content.js"],
    });
    return await chrome.tabs.sendMessage(tabId, message);
  }
}

/* -------------------------------------------------
   FRAME CAPTURE (Plan A → Fallback)
-------------------------------------------------- */
async function captureFrames(tabId) {
  // Try Plan A first (optimized: fewer frames, shorter interval = faster)
  const planA = await sendMessageWithInjection(tabId, {
    type: "VERISIGHT_CAPTURE_FRAMES_PLAN_A",
    options: { count: 3, intervalMs: 300, quality: 0.5 }
  });

  if (planA?.ok) return planA;

  // Fallback: background tab capture (same optimized settings)
  const fallback = await chrome.runtime.sendMessage({
    type: "VERISIGHT_CAPTURE_FRAMES_FALLBACK",
    options: { count: 3, intervalMs: 300, quality: 0.5 }
  });

  return fallback;
}

/* -------------------------------------------------
   STORE & FORWARD (Low Connectivity)
-------------------------------------------------- */
async function savePending(payload) {
  const key = "verisight_pending";
  const existing = (await chrome.storage.local.get(key))[key] || [];
  existing.unshift({ id: crypto.randomUUID(), ts: Date.now(), payload });
  await chrome.storage.local.set({ [key]: existing.slice(0, 20) });
}

async function flushPending() {
  const key = "verisight_pending";
  const existing = (await chrome.storage.local.get(key))[key] || [];
  if (!existing.length) return;

  const remaining = [];

  for (const item of existing) {
    try {
      const res = await fetch("http://127.0.0.1:3000/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(item.payload)
      });
      if (!res.ok) throw new Error("Bad response");
    } catch {
      remaining.push(item);
    }
  }

  await chrome.storage.local.set({ [key]: remaining });
}

/* -------------------------------------------------
   MAIN ANALYZE FLOW
-------------------------------------------------- */

// Allow analysis on any page, not just YouTube. Generalize logic for all sites.
analyzeBtn.addEventListener("click", async () => {
  analyzeBtn.disabled = true;
  loader.style.display = "block";
  setStatus("Preparing…");
  const t = startTimer();

  try {
    const tab = await getActiveTab();
    if (!tab?.id || !tab.url) throw new Error("No active tab.");

    // Always try to get selected text and page content
    const selResp = await sendMessageWithInjection(tab.id, { type: "VERISIGHT_GET_SELECTION" });
    const pageSelection = safeString(selResp?.selectedText).trim();

    // Always try to capture frames, but only show status if on YouTube
    let frames = [];
    try {
      setStatus("Capturing frames…");
      const frameResult = await captureFrames(tab.id);
      if (frameResult?.ok && Array.isArray(frameResult.frames)) {
        frames = frameResult.frames.slice(0, 5);
        setStatus(`Frames captured via ${frameResult.method}.`);
      }
    } catch (frameErr) {
      // Not all sites support frame capture; continue without frames
      console.warn("Frame capture unavailable:", frameErr);
    }

    // Always try to extract transcript and metadata
    setStatus("Extracting page content…");
    const resp = await sendMessageWithInjection(tab.id, { type: "VERISIGHT_ANALYZE" });
    const title = safeString(resp?.title) || document.title || "Untitled";
    const url = safeString(resp?.url) || tab.url;
    const transcript = safeString(resp?.transcript).trim();
    const selectedText = safeString(resp?.selectedText).trim() || pageSelection;

    // update UI early
    const selectedElInit = document.getElementById("selectedText");
    if (selectedElInit) selectedElInit.textContent = selectedText || "—";
    titleEl.textContent = title || "—";
    urlEl.textContent = url || "—";

    // Image upload and URL input removed: analysis now works on any website without them.
    // Send to backend
    setStatus("Running AI analysis…");
    const payload = { title, url, transcript, frames, selectedText };

    let analysis;
    try {
      const res = await fetch("http://127.0.0.1:3000/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error("Backend error");
      analysis = await res.json();
      await flushPending();
    } catch {
      await savePending(payload);
      throw new Error("Offline — stored for later sync.");
    }


    /* ---------- 5. Render Results ---------- */

    const crisis = analysis.crisis_mode || {};
    const recommended = analysis.recommended_action || "verify";

    const signalsText = Array.isArray(analysis.signals)
      ? analysis.signals
          .map(s => `- [${s.severity}] ${s.label}: ${s.why}`)
          .join("\n")
      : "";

    const claimsText = Array.isArray(analysis.claims)
      ? analysis.claims
          .map((c, i) =>
            `${i + 1}. ${c.claim}\n   Verify: ${(c.verify_steps || []).join("; ")}`
          )
          .join("\n\n")
      : "";

    transcriptEl.textContent =
      `SUMMARY:\n${analysis.summary}\n\n` +
      (analysis.selected_text ? `SELECTED TEXT:\n${analysis.selected_text}\n\n` : "") +
      `CRISIS MODE: ${crisis.is_crisis ? "ON" : "OFF"} (${crisis.category || "none"})\n` +
      `WHY: ${crisis.why || "—"}\n\n` +
      `RECOMMENDED ACTION: ${recommended.toUpperCase()}\n\n` +
      `SIGNALS:\n${signalsText}\n\n` +
      `CLAIMS:\n${claimsText}\n\n` +
      `SAFETY NOTES:\n${(analysis.public_safety_notes || []).join("\n")}`;

    // Render enhanced analysis data
    const enhancedEl = document.getElementById("enhancedContent");
    if (enhancedEl) {
      enhancedEl.style.display = "block";

      // Image Analysis section removed: all results now shown in Overview.

      // Frame analysis
      const frameAnalysisEl = document.getElementById("frameAnalysis");
      if (frameAnalysisEl && analysis.frame_analysis) {
        const fa = analysis.frame_analysis;
        frameAnalysisEl.textContent =
          `Frames: ${fa.frames_analyzed}\n` +
          `Motion: ${fa.motion_detected ? "Detected" : "None"}\n` +
          `Quality: ${fa.average_quality}\n` +
          `Signals: ${fa.visual_signals.join(", ") || "None"}`;
      }

      // Emergency data
      const emergencyEl = document.getElementById("emergencyData");
      if (emergencyEl && analysis.emergency_data_validation) {
        const ed = analysis.emergency_data_validation;
        emergencyEl.textContent =
          `Datasets: ${ed.emergency_datasets_available}\n` +
          `Confidence: ${(ed.contextual_confidence_boost * 100).toFixed(0)}%\n` +
          (ed.matching_incident_patterns?.map(m => `  • ${m.source}: ${m.incidentCount} incidents`).join("\n") || "");
      }

      // Environmental data
      const envEl = document.getElementById("environmentalData");
      if (envEl && analysis.environmental_validation) {
        const ev = analysis.environmental_validation;
        envEl.textContent =
          `Weather Alerts: ${ev.weather_alerts_count}\n` +
          `Satellites: ${ev.satellite_anomalies_count}\n` +
          `Confidence: ${(ev.disaster_pattern_confidence * 100).toFixed(0)}%\n` +
          (ev.weather_alerts?.map(w => `  • ${w.type}`).join("\n") || "");
      }

      // Geo context
      const geoEl = document.getElementById("geoData");
      if (geoEl && analysis.geolocation_context) {
        const gc = analysis.geolocation_context;
        geoEl.textContent =
          `Location: ${gc.extracted_location || "Unknown"}\n` +
          `Confidence: ${(gc.location_confidence * 100).toFixed(0)}%\n` +
          `Facilities: ${gc.nearby_emergency_facilities?.length || 0}\n` +
          (gc.nearby_emergency_facilities?.map(f => `  • ${f.type}: ${f.distance}km`).join("\n") || "");
      }

      // Offline capabilities
      const offlineEl = document.getElementById("offlineData");
      if (offlineEl && analysis.offline_capabilities) {
        const oc = analysis.offline_capabilities;
        offlineEl.textContent =
          `SMS Alerts: ${oc.sms_alerts_enabled ? "Enabled" : "Disabled"}\n` +
          `Pending: ${oc.pending_sms_count}\n` +
          `Message: ${oc.sms_message_template}`;
      }

      // AI-generated text detection
      const aiDetectionEl = document.getElementById("aiDetection");
      if (aiDetectionEl && analysis.ai_detection) {
        const ad = analysis.ai_detection;
        aiDetectionEl.textContent =
          `Probability: ${(ad.ai_probability * 100).toFixed(0)}%\n` +
          `Conclusion: ${ad.conclusion}\n` +
          `Sentence Variety: ${(ad.indicators?.sentence_variety * 100).toFixed(0) || 0}%\n` +
          `Grammar Perfection: ${(ad.indicators?.grammar_perfection * 100).toFixed(0) || 0}%\n` +
          (ad.warnings?.length > 0 ? `Warnings: ${ad.warnings.join(", ")}` : "");
      }

      // Deepfake detection
      const deepfakeEl = document.getElementById("deepfakeDetection");
      if (deepfakeEl && analysis.deepfake_detection) {
        const dd = analysis.deepfake_detection;
        deepfakeEl.textContent =
          `Probability: ${(dd.deepfake_probability * 100).toFixed(0)}%\n` +
          `Conclusion: ${dd.conclusion}\n` +
          `Facial Inconsistencies: ${dd.artifacts?.facial_inconsistencies ? "Detected" : "None"}\n` +
          `Lighting Issues: ${dd.artifacts?.lighting_anomalies ? "Found" : "None"}\n` +
          (dd.warnings?.length > 0 ? `Warnings: ${dd.warnings.join(", ")}` : "");
      }

      // Fact-check verification
      const factCheckEl = document.getElementById("factCheck");
      if (factCheckEl && analysis.fact_check) {
        const fc = analysis.fact_check;
        factCheckEl.textContent =
          `Claims Analyzed: ${fc.claims_analyzed}\n` +
          `Verified: ${fc.verified_count} | False: ${fc.false_count} | Unverified: ${fc.unverified_count}\n` +
          `Credibility Score: ${(fc.credibility_score * 100).toFixed(0)}%\n` +
          (fc.fact_checks?.length > 0 ? `Sources: ${fc.fact_checks.map(f => f.source).join(", ")}` : "");
      }

      // Reverse image search
      const reverseImageEl = document.getElementById("reverseImageSearch");
      if (reverseImageEl && analysis.reverse_image_search) {
        const ris = analysis.reverse_image_search;
        reverseImageEl.textContent =
          `Primary Conclusion: ${ris.primary_conclusion}\n` +
          `Matches Found: ${ris.matches?.length || 0}\n` +
          `Timestamp Inconsistencies: ${ris.timestamp_inconsistencies?.length || 0}\n` +
          (ris.matches?.length > 0 ? `Sources: ${ris.matches.map(m => m.source).join(", ")}` : "");
      }
    }

    setStatus("Done.");
  } catch (err) {
    setStatus(`Error: ${err.message}`);
  } finally {
    t.stop();
    loader.style.display = "none";
    analyzeBtn.disabled = false;
  }
});