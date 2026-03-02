// openaiVision.ts
// Helper for OpenAI vision model image analysis
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Analyze an image using OpenAI's vision model (gpt-4-vision-preview or gpt-4o).
 * @param {string} base64Image - The image as a base64-encoded string (data URL or raw base64).
 * @param {string} [prompt] - Optional prompt for the vision model.
 * @returns {Promise<any>} - The parsed JSON result from the model.
 */
// Unified model usage: gpt-4.1 (gpt-4-1106-vision) for both image and video analysis (2026-03)
// Deprecated models (gpt-4-vision-preview, gpt-4-vision, gpt-4-1106-vision) are no longer used.
// See: https://platform.openai.com/docs/guides/vision
// For image analysis, return plain English sentences (not JSON)
export async function analyzeImageWithOpenAI(base64Image: string, prompt = "Analyze this image for public safety, media integrity, and misinformation risk. Respond in clear English sentences suitable for display to end users. Do not use JSON.") {
  // Accept data URL or raw base64
  let imageData = base64Image;
  if (!base64Image.startsWith("data:")) {
    imageData = `data:image/jpeg;base64,${base64Image}`;
  }
  // gpt-4.1 expects user message content as array: [{type: "image_url", image_url: {url: ...}}]
  const messages = [
    {
      role: "system",
      content: "You are VeriSight. You analyze images for public safety, media integrity, and misinformation risk. Respond in clear English sentences suitable for display to end users. Do not use JSON."
    },
    {
      role: "user",
      content: [
        { type: "image_url", image_url: { url: imageData } }
      ]
    }
  ];
  try {
    const completion = await client.chat.completions.create({
      model: "gpt-4.1",
      temperature: 0.2,
      messages
    });
    return completion.choices[0].message.content!;
  } catch (err) {
    // Log error for debugging, return error for frontend
    console.error("OpenAI image analysis error", err);
    return `Image analysis failed: ${err?.message || err?.toString()}`;
  }
}
