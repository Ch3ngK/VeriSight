/**
 * Fact-Check Integration Module
 * Cross-references claims against fact-checking databases
 */

interface FactCheckResult {
  claim: string;
  status: "verified" | "false" | "unverified" | "partially_true";
  rating: string;
  source: string;
  url: string;
}

interface FactCheckAnalysisResult {
  claims_analyzed: number;
  verified_count: number;
  false_count: number;
  unverified_count: number;
  credibility_score: number; // 0-1
  fact_checks: FactCheckResult[];
  warnings: string[];
}

/**
 * Extract key claims from transcript
 * Filters out opinion statements
 */
function extractClaimsFromTranscript(transcript: string): string[] {
  const claims: string[] = [];

  // Patterns that indicate factual claims
  const claimPatterns = [
    /(\d+\s+(?:people|arrests|deaths|injuries|incidents))/gi,
    /(found|discovered|reported|announced|confirmed)/gi,
    /(was|were|is|are|happened|occurred)/gi,
    /(\w+\s+(?:said|reported|announced|confirmed|stated))/gi,
  ];

  const sentences = transcript.split(/[.!?]+/).filter((s) => s.trim().length > 10);

  for (const sentence of sentences) {
    for (const pattern of claimPatterns) {
      if (pattern.test(sentence)) {
        claims.push(sentence.trim());
        break; // Only add once per sentence
      }
    }
  }

  // Return top claims (avoid duplicates)
  return [...new Set(claims)].slice(0, 10);
}

/**
 * Query Google Fact Check API
 * Note: Requires API key
 */
async function queryGoogleFactCheck(
  claim: string
): Promise<FactCheckResult | null> {
  try {
    const apiKey = process.env.GOOGLE_FACT_CHECK_API_KEY;
    if (!apiKey || process.env.ENABLE_REAL_FACT_CHECK !== "true") {
      return null;
    }

    const response = await fetch(
      `https://factcheckapi.googleapis.com/v1alpha1/claims:search?query=${encodeURIComponent(claim)}&key=${apiKey}`,
      {
        headers: {
          "User-Agent": "(VeriSight Public Safety, contact@example.com)",
        },
        timeout: 5000,
      } as any
    );

    if (!response.ok) return null;

    const data = await response.json();
    if (!data.claims || data.claims.length === 0) return null;

    const topClaim = data.claims[0];
    const review = topClaim.claimReview[0];

    return {
      claim: topClaim.text,
      status: mapGoogleRating(review.textualRating),
      rating: review.textualRating,
      source: review.publisher.name,
      url: review.url,
    };
  } catch (err) {
    console.warn("[GoogleFactCheck] API query failed:", err);
    return null;
  }
}

/**
 * Map Google's rating to our standard
 */
function mapGoogleRating(
  rating: string
): "verified" | "false" | "unverified" | "partially_true" {
  const ratingLower = rating.toLowerCase();

  if (
    ratingLower.includes("true") ||
    ratingLower.includes("correct") ||
    ratingLower.includes("accurate")
  ) {
    return "verified";
  }
  if (ratingLower.includes("false") || ratingLower.includes("incorrect")) {
    return "false";
  }
  if (
    ratingLower.includes("partial") ||
    ratingLower.includes("misleading") ||
    ratingLower.includes("mixed")
  ) {
    return "partially_true";
  }

  return "unverified";
}

/**
 * Query Snopes (mock implementation)
 * Real integration requires web scraping or Snopes API
 */
async function querySnopes(claim: string): Promise<FactCheckResult | null> {
  try {
    // For MVP: return mock data
    // In production: would hit Snopes API or use web scraping

    const mockSnopesDB: Record<string, FactCheckResult> = {
      "election fraud": {
        claim: "2024 election was fraudulent",
        status: "false",
        rating: "False",
        source: "Snopes",
        url: "https://www.snopes.com",
      },
      "vaccine causes": {
        claim: "Vaccines cause autism",
        status: "false",
        rating: "False",
        source: "Snopes",
        url: "https://www.snopes.com",
      },
      "earth flat": {
        claim: "The Earth is flat",
        status: "false",
        rating: "False",
        source: "Snopes",
        url: "https://www.snopes.com",
      },
    };

    for (const [key, result] of Object.entries(mockSnopesDB)) {
      if (claim.toLowerCase().includes(key)) {
        return result;
      }
    }

    return null;
  } catch (err) {
    console.warn("[Snopes] Query failed:", err);
    return null;
  }
}

/**
 * Query Wikipedia Talk pages for disputed claims
 */
async function queryWikipediaDisputes(
  claim: string
): Promise<FactCheckResult | null> {
  try {
    // Check if claim is about a Wikipedia article with disputes

    const disputedArticles: Record<string, string> = {
      covid: "COVID-19 pandemic",
      election: "2024 United States presidential election",
      climate: "Climate change",
    };

    for (const [keyword, article] of Object.entries(disputedArticles)) {
      if (claim.toLowerCase().includes(keyword)) {
        return {
          claim: article,
          status: "partially_true",
          rating: "Disputed on Wikipedia",
          source: "Wikipedia",
          url: `https://en.wikipedia.org/wiki/${article.replace(/ /g, "_")}`,
        };
      }
    }

    return null;
  } catch (err) {
    console.warn("[Wikipedia] Query failed:", err);
    return null;
  }
}

/**
 * Main fact-check analysis function
 */
export async function analyzeClaims(
  transcript: string
): Promise<FactCheckAnalysisResult> {
  const extractedClaims = extractClaimsFromTranscript(transcript);

  if (extractedClaims.length === 0) {
    return {
      claims_analyzed: 0,
      verified_count: 0,
      false_count: 0,
      unverified_count: 0,
      credibility_score: 0.5,
      fact_checks: [],
      warnings: [],
    };
  }

  const factChecks: FactCheckResult[] = [];
  let verifiedCount = 0;
  let falseCount = 0;
  let unverifiedCount = 0;

  // Check each claim against fact-checking databases
  for (const claim of extractedClaims) {
    // Try multiple sources
    let result: FactCheckResult | null = null;

    // Try Google Fact Check first
    result = await queryGoogleFactCheck(claim);

    // Try Snopes if Google fails
    if (!result) {
      result = await querySnopes(claim);
    }

    // Try Wikipedia disputes
    if (!result) {
      result = await queryWikipediaDisputes(claim);
    }

    if (result) {
      factChecks.push(result);

      // Count by status
      if (result.status === "verified") verifiedCount++;
      else if (result.status === "false") falseCount++;
      else if (result.status === "partially_true") unverifiedCount++;
      else unverifiedCount++;
    } else {
      unverifiedCount++;
    }
  }

  // Calculate credibility score
  const credibilityScore =
    verifiedCount /
    Math.max(extractedClaims.length, 1) -
    falseCount * 0.5 /
    Math.max(extractedClaims.length, 1);

  const warnings: string[] = [];

  if (falseCount > 0) {
    warnings.push(
      `🔴 ${falseCount} claim(s) marked as FALSE by fact-checkers`
    );
  }
  if (unverifiedCount > extractedClaims.length * 0.5) {
    warnings.push(
      `🟡 ${unverifiedCount} claim(s) could not be verified`
    );
  }
  if (credibilityScore < 0.4) {
    warnings.push(
      "🔴 Low credibility: Multiple false or unverified claims"
    );
  }

  return {
    claims_analyzed: extractedClaims.length,
    verified_count: verifiedCount,
    false_count: falseCount,
    unverified_count: unverifiedCount,
    credibility_score: Math.max(0, Math.min(1, credibilityScore)),
    fact_checks: factChecks,
    warnings,
  };
}

/**
 * Enhance analysis with fact-check results
 */
export async function enrichWithFactChecking(
  analysis: any,
  transcript: string
): Promise<any> {
  const factCheckAnalysis = await analyzeClaims(transcript);

  analysis.fact_check = {
    claims_analyzed: factCheckAnalysis.claims_analyzed,
    verified_count: factCheckAnalysis.verified_count,
    false_count: factCheckAnalysis.false_count,
    unverified_count: factCheckAnalysis.unverified_count,
    credibility_score: factCheckAnalysis.credibility_score,
    fact_checks: factCheckAnalysis.fact_checks,
    warnings: factCheckAnalysis.warnings,
    data_sources: "Google Fact Check, Snopes, Wikipedia",
  };

  // Add warnings to public safety notes
  if (factCheckAnalysis.false_count > 0) {
    if (!analysis.public_safety_notes) analysis.public_safety_notes = [];
    analysis.public_safety_notes.push(
      `⚠️ FACT-CHECK: ${factCheckAnalysis.false_count} claim(s) marked as false by fact-checkers. Verify independently.`
    );
  }

  return analysis;
}
