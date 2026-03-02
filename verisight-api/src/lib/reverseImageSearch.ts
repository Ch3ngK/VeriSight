/**
 * Reverse Image Search Module
 * Finds original sources of video frames
 */

interface ImageSearchResult {
  original_found: boolean;
  source_url: string | null;
  source_title: string | null;
  upload_date: string | null;
  match_count: number;
  conclusion: "original" | "reused" | "old_footage" | "unknown";
}

/**
 * Extract image metadata from base64
 */
function extractImageMetadata(base64Frame: string): {
  size: number;
  colorProfile: string;
} {
  return {
    size: base64Frame.length,
    colorProfile: base64Frame.substring(0, 20),
  };
}

/**
 * Query mock reverse image search
 * In production: would use Google Images API, TinEye API, etc.
 */
async function searchImageOnline(
  frameBase64: string
): Promise<ImageSearchResult> {
  try {
    // For MVP: Return mock search results
    // In production: would call real reverse image search APIs

    // Simulate that sometimes images are found in old footage
    const random = Math.random();

    if (random < 0.3) {
      // 30% chance of finding the original
      return {
        original_found: true,
        source_url: "https://news.example.com/incident-2024-01-15",
        source_title: "Breaking News: Incident Report",
        upload_date: "2024-01-15T14:22:00Z",
        match_count: 47,
        conclusion: "original",
      };
    } else if (random < 0.6) {
      // 30% chance of finding reused footage
      return {
        original_found: true,
        source_url: "https://youtube.com/watch?v=oldvideo",
        source_title: "Previous Incident Coverage",
        upload_date: "2023-06-10T09:00:00Z",
        match_count: 23,
        conclusion: "reused",
      };
    } else {
      // 40% chance of no match
      return {
        original_found: false,
        source_url: null,
        source_title: null,
        upload_date: null,
        match_count: 0,
        conclusion: "unknown",
      };
    }
  } catch (err) {
    console.warn("[ReverseImageSearch] Search failed:", err);
    return {
      original_found: false,
      source_url: null,
      source_title: null,
      upload_date: null,
      match_count: 0,
      conclusion: "unknown",
    };
  }
}

/**
 * Perform reverse image search on multiple frames
 */
export async function reverseImageSearch(
  frames: string[]
): Promise<{
  matches: ImageSearchResult[];
  primary_conclusion: "original" | "reused" | "old_footage" | "unknown";
  warnings: string[];
}> {
  if (!frames || frames.length === 0) {
    return {
      matches: [],
      primary_conclusion: "unknown",
      warnings: ["No frames available for reverse image search"],
    };
  }

  const matches: ImageSearchResult[] = [];
  const conclusions: string[] = [];
  const warnings: string[] = [];

  // Search first 3 frames (to avoid redundancy)
  for (let i = 0; i < Math.min(3, frames.length); i++) {
    const result = await searchImageOnline(frames[i]);
    matches.push(result);
    conclusions.push(result.conclusion);

    if (result.conclusion === "reused") {
      warnings.push(
        `🟡 Frame ${i + 1}: Footage appears reused or from older incident (found: ${result.source_title})`
      );
    } else if (result.conclusion === "original") {
      warnings.push(
        `✅ Frame ${i + 1}: Original source found (${result.source_title})`
      );
    }
  }

  // Determine primary conclusion
  let primaryConclusion: "original" | "reused" | "old_footage" | "unknown" = "unknown";

  if (conclusions.includes("reused")) {
    primaryConclusion = "reused";
  } else if (conclusions.includes("original")) {
    primaryConclusion = "original";
  } else {
    primaryConclusion = "unknown";
  }

  return {
    matches,
    primary_conclusion: primaryConclusion,
    warnings,
  };
}

/**
 * Validate timestamp authenticity
 * Check if video claims match upload date
 */export async function validateTimestampAuthenticity(
  title: string,
  transcript: string,
  frameSearchResults: {
    primary_conclusion: string;
    matches: ImageSearchResult[];
  }
): Promise<{
  timestamp_authentic: boolean;
  inconsistencies: string[];
  notes: string[];
}> {
  const inconsistencies: string[] = [];
  const notes: string[] = [];

  // Extract date mentions from title/transcript
  const datePattern = /(\d{4}[-\/]\d{1,2}[-\/]\d{1,2})|(\w+ \d{1,2}, \d{4})/g;
  const mentionedDates = title.match(datePattern) || [];

  if (frameSearchResults.matches.length > 0) {
    const firstMatch = frameSearchResults.matches[0];

    if (firstMatch.upload_date && mentionedDates.length > 0) {
      const uploadDate = new Date(firstMatch.upload_date);
      const mentionedDate = new Date(mentionedDates[0]!);

      const daysDiff = Math.abs(
        (uploadDate.getTime() - mentionedDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (daysDiff > 7) {
        inconsistencies.push(
          `Video claims recent incident but footage found from ${daysDiff} days ago`
        );
      }

      if (frameSearchResults.primary_conclusion === "reused") {
        notes.push(
          "⚠️ Footage may be from a different, older incident. Verify context."
        );
      }
    }
  }

  const timestampAuthentic = inconsistencies.length === 0;

  return {
    timestamp_authentic: timestampAuthentic,
    inconsistencies,
    notes,
  };
}

/**
 * Enhance analysis with reverse image search results
 */
export async function enrichWithReverseImageSearch(
  analysis: any,
  frames: string[],
  title: string,
  transcript: string
): Promise<any> {
  if (!frames || frames.length === 0) {
    return analysis;
  }

  const searchResults = await reverseImageSearch(frames);
  const timestampValidation = await validateTimestampAuthenticity(
    title,
    transcript,
    searchResults
  );

  analysis.reverse_image_search = {
    original_found: searchResults.matches.some((m) => m.original_found),
    matches_count: searchResults.matches.filter((m) => m.original_found).length,
    primary_conclusion: searchResults.primary_conclusion,
    matches: searchResults.matches.map((m) => ({
      source: m.source_title,
      url: m.source_url,
      upload_date: m.upload_date,
      match_count: m.match_count,
    })),
    timestamp_validation: {
      authentic: timestampValidation.timestamp_authentic,
      inconsistencies: timestampValidation.inconsistencies,
    },
    warnings: searchResults.warnings,
  };

  // Add warnings to public safety notes
  if (!timestampValidation.timestamp_authentic) {
    if (!analysis.public_safety_notes) analysis.public_safety_notes = [];
    analysis.public_safety_notes.push(
      `⚠️ TIMESTAMP: Video timestamp inconsistencies detected. ${timestampValidation.inconsistencies.join(" ")}`
    );
  }

  if (searchResults.primary_conclusion === "reused") {
    if (!analysis.public_safety_notes) analysis.public_safety_notes = [];
    analysis.public_safety_notes.push(
      "⚠️ FOOTAGE: Video appears to contain reused or old footage. Verify current status."
    );
  }

  return analysis;
}
