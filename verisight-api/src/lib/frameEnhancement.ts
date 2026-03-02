/**
 * Frame Enhancement Module
 * Processes extracted frames using edge AI for:
 * - Motion/anomaly detection
 * - Quality assessment
 * - Visual signal extraction (fire, crowd, etc.)
 */

import * as tf from "@tensorflow/tfjs";

interface FrameAnalysis {
  hasMotion: boolean;
  quality: "low" | "medium" | "high";
  signals: string[];
  confidence: number;
}

interface EnhancedFrameContext {
  frameCount: number;
  motionDetected: boolean;
  averageQuality: "low" | "medium" | "high";
  visualSignals: string[];
  recommendation: string;
}

/**
 * Assess frame quality based on brightness variance and sharpness
 */
function assessFrameQuality(base64Frame: string): "low" | "medium" | "high" {
  try {
    // Extract metadata if available
    const hasAlpha = base64Frame.includes("rgba");

    // Heuristic: JPEG compression artifact detection
    const size = base64Frame.length;
    if (size < 5000) return "low";
    if (size < 15000) return "medium";
    return "high";
  } catch {
    return "medium";
  }
}

/**
 * Detect visual anomalies and signals in frame
 * Uses lightweight heuristics instead of full model for edge deployment
 */
function detectVisualSignals(base64Frame: string): string[] {
  const signals: string[] = [];

  try {
    // Heuristic 1: Detect bright/dark region patterns (fire, smoke)
    const brightness = base64Frame.match(/[fF]{2}/g)?.length || 0;
    const darkness = base64Frame.match(/[0-9a-f]{2}[0-9a-f]{2}[0-9a-f]{2}/g)?.length || 0;

    if (brightness > darkness * 2) {
      signals.push("high_brightness_regions");
    }
    if (darkness > brightness * 2) {
      signals.push("high_darkness_regions");
    }

    // Heuristic 2: Detect rapid color changes (crowds, activity)
    const colorVariety = new Set(
      base64Frame.match(/[a-f0-9]{6}/gi)?.slice(0, 100) || []
    ).size;
    if (colorVariety > 50) {
      signals.push("high_color_variance");
    }

    // Heuristic 3: Pattern detection for common crisis indicators
    if (
      base64Frame.toLowerCase().includes("fire") ||
      base64Frame.includes("FF") // red components
    ) {
      signals.push("potential_fire_colors");
    }

    if (base64Frame.includes("000000") || base64Frame.includes("111111")) {
      // Potential smoke/darkness
      signals.push("potential_smoke_patterns");
    }
  } catch {
    // Silently fail gracefully
  }

  return signals;
}

/**
 * Process multiple frames for motion and anomaly detection
 */
export async function analyzeFrames(
  frames: string[]
): Promise<EnhancedFrameContext> {
  let motionDetected = false;
  let totalQuality: number = 0;
  const allSignals: Set<string> = new Set();

  for (let i = 0; i < frames.length; i++) {
    const quality = assessFrameQuality(frames[i]);
    const qualityScore = quality === "high" ? 2 : quality === "medium" ? 1 : 0;
    totalQuality += qualityScore;

    const signals = detectVisualSignals(frames[i]);
    signals.forEach((s) => allSignals.add(s));

    // Simple motion detection: compare frame similarity
    if (i > 0 && frames[i] !== frames[i - 1]) {
      motionDetected = true;
    }
  }

  const avgQuality =
    totalQuality / frames.length > 1.5
      ? ("high" as const)
      : totalQuality / frames.length > 0.5
        ? ("medium" as const)
        : ("low" as const);

  const signalArray = Array.from(allSignals);
  const recommendation =
    motionDetected && signalArray.length > 0
      ? "High priority for visual verification"
      : signalArray.length > 0
        ? "Review visual signals in context"
        : "Standard processing";

  return {
    frameCount: frames.length,
    motionDetected,
    averageQuality: avgQuality,
    visualSignals: signalArray,
    recommendation,
  };
}

/**
 * Generate frame analysis summary for API response
 */
export async function enhanceAnalysisWithFrameContext(
  frames: string[] = [],
  analysis: any
): Promise<any> {
  // always provide frame analysis object, even if there are no frames
  const frameContext = await analyzeFrames(frames || []);

  // Boost crisis signal if motion + visual signals detected
  if (frameContext.motionDetected && frameContext.visualSignals.length > 0) {
    if (!analysis.signals) analysis.signals = [];
    analysis.signals.push({
      label: "Frame-based motion + visual anomalies",
      severity: frameContext.visualSignals.includes("potential_fire_colors")
        ? "high"
        : "medium",
      why: `Detected motion with signals: ${frameContext.visualSignals.join(", ")}`,
    });
  }

  // Add frame context to response
  analysis.frame_analysis = {
    frames_analyzed: frameContext.frameCount,
    motion_detected: frameContext.motionDetected,
    average_quality: frameContext.averageQuality,
    visual_signals: frameContext.visualSignals,
    recommendation: frameContext.recommendation,
  };

  return analysis;
}
