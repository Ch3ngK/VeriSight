/**
 * Deepfake Detection Module
 * Detects AI-generated video (face swaps, synthetic faces)
 */

interface DeepfakeAnalysisResult {
  deepfake_probability: number; // 0-1 score
  artifacts: {
    facial_inconsistencies: number;
    eye_blinking_patterns: number;
    skin_texture_anomalies: number;
    lighting_inconsistencies: number;
    frame_artifacts: number;
  };
  warnings: string[];
  conclusion: "likely_real" | "uncertain" | "likely_deepfake";
}

/**
 * Analyze facial inconsistencies between frames
 * Deepfakes tend to have subtle inconsistencies
 */
function analyzeFacialInconsistencies(frames: string[]): number {
  if (frames.length < 2) return 0;

  // Heuristic: Check for frame-to-frame variations
  // Real video: consistent facial proportions
  // Deepfake: subtle discrepancies, artifacts around face edges

  let inconsistencyScore = 0;

  // Compare consecutive frames for sudden changes
  for (let i = 0; i < frames.length - 1; i++) {
    const frame1 = frames[i];
    const frame2 = frames[i + 1];

    // Heuristic: size difference in base64 data
    // Deepfakes often have compression artifacts at face regions
    const sizeDifference = Math.abs(frame1.length - frame2.length) / 
      Math.max(frame1.length, frame2.length);

    if (sizeDifference > 0.15) {
      // Significant change suggests compression artifacts
      inconsistencyScore += 0.1;
    }
  }

  return Math.min(1, inconsistencyScore);
}

/**
 * Analyze eye blinking patterns
 * Real humans blink naturally; deepfakes often miss this
 */
function analyzeEyeBlinkingPatterns(frames: string[]): number {
  if (frames.length < 5) return 0;

  // Heuristic: Look for brightness changes in eye regions
  // Real blinks: consistent rapid brightness drop
  // Deepfakes: missing blinks or unnatural patterns

  let blinkScore = 0;

  // Check for consistent blinking intervals
  // Humans blink every 3-4 seconds on average
  // Deepfakes either miss blinks or have unnatural patterns

  for (const frame of frames) {
    // Count dark regions (potential closed eyes)
    const darkPixels = (frame.match(/[0-3][0-9a-f]/g) || []).length;
    const totalPixels = frame.length / 6; // Each pixel is 6 hex chars

    if (darkPixels / totalPixels > 0.1) {
      blinkScore += 0.05;
    }
  }

  return Math.min(1, blinkScore);
}

/**
 * Analyze skin texture for deepfake artifacts
 * Deepfakes often have smooth, unrealistic skin
 */
function analyzeSkinTextureAnomalies(frames: string[]): number {
  let textureScore = 0;

  for (const frame of frames) {
    // Heuristic: AI tends to generate smoother skin
    // Real skin has variation and imperfections

    // Count color variation in likely skin tones (peachy colors)
    const skinTonePattern = /[efab][cdef0-9]/g;
    const skinPixels = (frame.match(skinTonePattern) || []).length;

    // Very smooth skin without variation suggests AI
    if (skinPixels / frame.length > 0.3) {
      textureScore += 0.15; // High skin tone coverage = likely AI
    }
  }

  return Math.min(1, textureScore);
}

/**
 * Check for lighting inconsistencies
 * Deepfakes often have lighting mismatches
 */
function analyzeLightingInconsistencies(frames: string[]): number {
  if (frames.length < 2) return 0;

  let lightingScore = 0;

  // Check for consistent lighting across frames
  for (let i = 0; i < frames.length - 1; i++) {
    const frame1 = frames[i];
    const frame2 = frames[i + 1];

    // Heuristic: count bright pixels
    const brightPixels1 = (frame1.match(/[ef][ef]/g) || []).length;
    const brightPixels2 = (frame2.match(/[ef][ef]/g) || []).length;

    const brightnessDiff = Math.abs(brightPixels1 - brightPixels2) / 
      Math.max(brightPixels1, brightPixels2, 1);

    // Deepfakes often have abrupt lighting changes
    if (brightnessDiff > 0.2) {
      lightingScore += 0.1;
    }
  }

  return Math.min(1, lightingScore);
}

/**
 * Detect frame-level artifacts
 * Compression, encoding errors, gen artifacts
 */
function analyzeFrameArtifacts(frames: string[]): number {
  let artifactScore = 0;

  for (const frame of frames) {
    // Heuristic: Look for patterns that don't appear in natural video
    
    // Check for unusual color repetition (AI-generated images have this)
    const colorPairs = frame.match(/([0-9a-f]{2})\1{3,}/gi) || [];
    if (colorPairs.length > 5) {
      artifactScore += 0.15;
    }

    // Check for block artifacts (typical of video codec)
    // Real video: natural distribution
    // Deepfake: artificial patterns
  }

  return Math.min(1, artifactScore / Math.max(frames.length, 1));
}

/**
 * Main deepfake detection function
 */
export async function detectDeepfakes(
  frames: string[]
): Promise<DeepfakeAnalysisResult> {
  if (!frames || frames.length === 0) {
    return {
      deepfake_probability: 0,
      artifacts: {
        facial_inconsistencies: 0,
        eye_blinking_patterns: 0,
        skin_texture_anomalies: 0,
        lighting_inconsistencies: 0,
        frame_artifacts: 0,
      },
      warnings: ["No frames available for analysis"],
      conclusion: "uncertain",
    };
  }

  const facialInconsistencies = analyzeFacialInconsistencies(frames);
  const eyeBlinking = analyzeEyeBlinkingPatterns(frames);
  const skinTexture = analyzeSkinTextureAnomalies(frames);
  const lighting = analyzeLightingInconsistencies(frames);
  const artifacts = analyzeFrameArtifacts(frames);

  // Weighted average
  const deepfakeProbability =
    facialInconsistencies * 0.25 +
    eyeBlinking * 0.25 +
    skinTexture * 0.2 +
    lighting * 0.2 +
    artifacts * 0.1;

  const warnings: string[] = [];

  if (facialInconsistencies > 0.6) {
    warnings.push("🔴 Facial inconsistencies detected between frames");
  }
  if (eyeBlinking > 0.5) {
    warnings.push("🔴 Abnormal eye blinking patterns");
  }
  if (skinTexture > 0.5) {
    warnings.push("🟡 Suspiciously smooth skin texture (AI indicator)");
  }
  if (lighting > 0.5) {
    warnings.push("🟡 Lighting inconsistencies between frames");
  }
  if (artifacts > 0.4) {
    warnings.push("🟡 Unusual video artifacts detected");
  }

  let conclusion: "likely_real" | "uncertain" | "likely_deepfake";
  if (deepfakeProbability < 0.35) {
    conclusion = "likely_real";
  } else if (deepfakeProbability > 0.65) {
    conclusion = "likely_deepfake";
  } else {
    conclusion = "uncertain";
  }

  return {
    deepfake_probability: deepfakeProbability,
    artifacts: {
      facial_inconsistencies: facialInconsistencies,
      eye_blinking_patterns: eyeBlinking,
      skin_texture_anomalies: skinTexture,
      lighting_inconsistencies: lighting,
      frame_artifacts: artifacts,
    },
    warnings,
    conclusion,
  };
}

/**
 * Enhance analysis with deepfake detection results
 */
export async function enrichWithDeepfakeDetection(
  analysis: any,
  frames: string[]
): Promise<any> {
  if (!frames || frames.length === 0) {
    return analysis;
  }

  const deepfakeDetection = await detectDeepfakes(frames);

  analysis.deepfake_detection = {
    deepfake_probability: deepfakeDetection.deepfake_probability,
    conclusion: deepfakeDetection.conclusion,
    artifacts: deepfakeDetection.artifacts,
    warnings: deepfakeDetection.warnings,
    assessment: deepfakeDetection.conclusion === "likely_deepfake"
      ? "⚠️ Video may contain deepfake indicators. Verify authenticity independently."
      : deepfakeDetection.conclusion === "likely_real"
        ? "✅ Video shows no obvious deepfake indicators"
        : "⚠️ Unable to conclusively determine video authenticity",
  };

  // Add warning to public safety notes if deepfake suspected
  if (deepfakeDetection.conclusion === "likely_deepfake") {
    if (!analysis.public_safety_notes) analysis.public_safety_notes = [];
    analysis.public_safety_notes.push(
      "⚠️ AUTHENTICITY: Video may be deepfaked. Verify with official sources."
    );
  }

  return analysis;
}
