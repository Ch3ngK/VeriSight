/**
 * AI-Generated Text Detection Module
 * Detects patterns indicating AI-written content (ChatGPT, Claude, etc.)
 */

interface TextAnalysisResult {
  ai_probability: number; // 0-1 score
  indicators: {
    sentence_variety: number;
    filler_words_ratio: number;
    grammar_perfection: number;
    repetition_score: number;
    awkward_phrasing: number;
  };
  warnings: string[];
  conclusion: "likely_human" | "uncertain" | "likely_ai";
}

/**
 * Calculate sentence length variety (AI tends to be uniform)
 */
function analyzeSentenceVariety(text: string): number {
  const sentences = text.match(/[.!?]+/g) || [];
  if (sentences.length < 3) return 0.5;

  const words = text.split(/\s+/);
  const sentencesByWord = text
    .split(/[.!?]+/)
    .filter((s) => s.trim())
    .map((s) => s.trim().split(/\s+/).length);

  if (sentencesByWord.length === 0) return 0.5;

  // Calculate variance in sentence length
  const avg = sentencesByWord.reduce((a, b) => a + b, 0) / sentencesByWord.length;
  const variance =
    sentencesByWord.reduce((sum, len) => sum + Math.pow(len - avg, 2), 0) /
    sentencesByWord.length;
  const stdDev = Math.sqrt(variance);

  // AI tends to have lower variance (more uniform)
  // Human writing has higher variance
  // Score: 1 = very predictable (likely AI), 0 = varied (likely human)
  return Math.min(1, 1 / (1 + stdDev / 5));
}

/**
 * Count filler words (um, uh, like, you know, etc.)
 * AI rarely uses these; humans use them frequently
 */
function analyzeFillerWords(text: string): number {
  const fillerWords = [
    "um",
    "uh",
    "like",
    "you know",
    "basically",
    "literally",
    "actually",
    "honestly",
    "well",
    "i mean",
  ];

  const textLower = text.toLowerCase();
  let fillerCount = 0;

  for (const filler of fillerWords) {
    const regex = new RegExp(`\\b${filler}\\b`, "g");
    fillerCount += (textLower.match(regex) || []).length;
  }

  const totalWords = text.split(/\s+/).length;
  const ratio = fillerCount / totalWords;

  // High filler ratio = likely human (score 0)
  // Low filler ratio = likely AI (score 1)
  return Math.max(0, Math.min(1, ratio < 0.02 ? 0.8 : 0.2));
}

/**
 * Check grammar perfection
 * AI writing has suspiciously perfect grammar; humans make mistakes
 */
function analyzeGrammarPerfection(text: string): number {
  // Regional indicators (accents in speech)
  const informalities = [
    "ain't",
    "gonna",
    "wanna",
    "coulda",
    "shoulda",
    "dont",
    "it's",
    "im",
  ];

  const textLower = text.toLowerCase();
  let informalCount = 0;

  for (const inform of informalities) {
    if (textLower.includes(inform)) informalCount++;
  }

  // AI tends to avoid informalities
  // Score: 1 = very formal (likely AI), 0 = informal (likely human)
  return informalCount === 0 ? 0.7 : 0.2;
}

/**
 * Detect repetition patterns
 * AI tends to repeat phrases/structures more than humans
 */
function analyzeRepetition(text: string): number {
  const words = text.toLowerCase().split(/\s+/);
  const wordFreq: Record<string, number> = {};

  for (const word of words) {
    if (word.length > 4) {
      // Only long words to avoid "the", "and", etc.
      wordFreq[word] = (wordFreq[word] || 0) + 1;
    }
  }

  const repetitionFrequencies = Object.values(wordFreq).filter((count) => count > 2);
  const repetitionScore = repetitionFrequencies.length / Object.keys(wordFreq).length;

  // High repetition = likely AI (score 1), low repetition = likely human (score 0)
  return Math.min(1, repetitionScore * 2);
}

/**
 * Detect awkward phrasing patterns AI uses
 */
function analyzeAwkwardPhrasing(text: string): number {
  const awkwardPatterns = [
    /as an ai/i,
    /i don't have/i,
    /i don't have access/i,
    /it's important to note/i,
    /in conclusion/i,
    /furthermore/i,
    /moreover/i,
    /delve into/i,
    /the implications of/i,
    /in today's world/i,
  ];

  let awkwardCount = 0;
  for (const pattern of awkwardPatterns) {
    if (pattern.test(text)) awkwardCount++;
  }

  // Each awkward pattern increases likelihood
  return Math.min(1, awkwardCount * 0.15);
}

/**
 * Main AI text detection function
 */
export async function detectAIGeneratedText(
  text: string
): Promise<TextAnalysisResult> {
  if (!text || text.length < 50) {
    return {
      ai_probability: 0,
      indicators: {
        sentence_variety: 0,
        filler_words_ratio: 0,
        grammar_perfection: 0,
        repetition_score: 0,
        awkward_phrasing: 0,
      },
      warnings: ["Text too short for analysis"],
      conclusion: "uncertain",
    };
  }

  const sentenceVariety = analyzeSentenceVariety(text);
  const fillerWords = analyzeFillerWords(text);
  const grammarPerfection = analyzeGrammarPerfection(text);
  const repetition = analyzeRepetition(text);
  const awkwardPhrasing = analyzeAwkwardPhrasing(text);

  // Weighted average (heavier weight on indicators with more evidence)
  const aiProbability =
    sentenceVariety * 0.2 +
    fillerWords * 0.25 +
    grammarPerfection * 0.25 +
    repetition * 0.2 +
    awkwardPhrasing * 0.1;

  const warnings: string[] = [];

  if (sentenceVariety > 0.6) {
    warnings.push(
      "🔴 Uniform sentence structure (AI indicator)"
    );
  }
  if (fillerWords > 0.6) {
    warnings.push(
      "🔴 Very few filler words (AI tends to avoid these)"
    );
  }
  if (grammarPerfection > 0.6) {
    warnings.push(
      "🔴 Suspiciously perfect grammar (humans make mistakes)"
    );
  }
  if (repetition > 0.5) {
    warnings.push(
      "🟡 High phrase repetition detected"
    );
  }
  if (awkwardPhrasing > 0.3) {
    warnings.push(
      "🟡 Contains patterns typical of AI writing"
    );
  }

  let conclusion: "likely_human" | "uncertain" | "likely_ai";
  if (aiProbability < 0.35) {
    conclusion = "likely_human";
  } else if (aiProbability > 0.65) {
    conclusion = "likely_ai";
  } else {
    conclusion = "uncertain";
  }

  return {
    ai_probability: aiProbability,
    indicators: {
      sentence_variety: sentenceVariety,
      filler_words_ratio: fillerWords,
      grammar_perfection: grammarPerfection,
      repetition_score: repetition,
      awkward_phrasing: awkwardPhrasing,
    },
    warnings,
    conclusion,
  };
}

/**
 * Enhance analysis with AI detection results
 */
export async function enrichWithAIDetection(
  analysis: any,
  transcript: string
): Promise<any> {
  const aiDetection = await detectAIGeneratedText(transcript);

  analysis.ai_detection = {
    ai_probability: aiDetection.ai_probability,
    conclusion: aiDetection.conclusion,
    indicators: aiDetection.indicators,
    warnings: aiDetection.warnings,
    assessment: aiDetection.conclusion === "likely_ai"
      ? "⚠️ Transcript may be AI-generated. Verify with official sources."
      : aiDetection.conclusion === "likely_human"
        ? "✅ Transcript shows signs of human speech patterns"
        : "⚠️ Unable to determine if transcript is human or AI-generated",
  };

  // Add warning to public safety notes
  if (aiDetection.conclusion === "likely_ai") {
    if (!analysis.public_safety_notes) analysis.public_safety_notes = [];
    analysis.public_safety_notes.push(
      "⚠️ CREDIBILITY: Transcript may be AI-generated. Independently verify before acting."
    );
  }

  return analysis;
}
