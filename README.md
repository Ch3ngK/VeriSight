# VeriSight

# Model Update Notice

**2026-03:** The OpenAI models `gpt-4-vision-preview`, `gpt-4-vision`, and `gpt-4-1106-vision` are deprecated. VeriSight now uses `gpt-4-1106-vision` (gpt-4.1) for all image and video analysis. If you encounter image analysis errors, ensure your API key supports the new model.

---

## Simplified Workflow (2026-03)
- The popup now has a single "Overview" section for all analysis results.
- There are no image upload or URL input fields; analysis works on any website automatically.
- There is no separate "Image Analysis" section; all results are unified in the Overview.

## Enhanced Analysis: API-Based Fact-Checking and AI Detection

The "Enhanced Analysis" section provides AI-generated text detection and deepfake signal analysis by combining:
- **Transcript text** and **metadata** (title, URL, publish date)
- **Extracted claims** and **detected signals** from the Overview
- **Fact-check snippets** fetched from external search APIs (Bing, etc.)

### How It Works

1. The backend extracts claims and signals from the page transcript (Overview analysis).
2. For each claim, it fetches 2–3 fact-check snippets from a search API.
3. All this data is formatted as readable text (not raw JSON) and passed to an AI detector.
4. The detector returns a plain English verdict on AI generation likelihood, top indicators found, and confidence estimate.
5. Results are displayed in the "Enhanced Analysis" section of the popup.

### Error Handling & Fallbacks

- If fact-check snippets cannot be fetched, the detector uses "None" instead.
- If the detector API fails or times out, Enhanced Analysis shows "Detection unavailable".
- No numeric placeholders (0, NaN) are ever returned to the client.

### Checkpoint Procedure

Before deploying changes:
```bash
git add .
git commit -m "Checkpoint: working Overview baseline"
git tag checkpoint-working
```

After verifying the new feature works:
```bash
git add .
git commit -m "Checkpoint: add API-based detection for Enhanced Analysis"
git tag checkpoint-enhanced-detection
```

To revert to a checkpoint:
```bash
git reset --hard checkpoint-working
```