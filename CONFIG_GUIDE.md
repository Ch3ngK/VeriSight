# VeriSight API Configuration Guide

## Issue: Missing API Credentials

If you see an error like "credentials are missing" when running the backend, follow these steps:

---

## ✅ Quick Fix (Required)

### 1. Get OpenAI API Key
- Go to: https://platform.openai.com/api-keys
- Log in or create an account
- Click **"Create new secret key"**
- Copy the key (format: `sk-proj-...` or `sk-...`)
- ⚠️ **Save it immediately** - you won't see it again!

### 2. Configure Environment Variables
Create or edit file: `verisight-api/.env.local`

```
OPENAI_API_KEY=sk-proj-your-actual-key-here
```

Replace `sk-proj-your-actual-key-here` with your actual OpenAI API key.
**Both `sk-proj-` and `sk-` formats are supported.**

### 3. Restart Backend
```bash
npm run dev
```

The error should be gone!

---

## 📋 Optional Features

If you want to enable advanced features, add these to `.env.local`:

```bash
# Fact-checking integration (requires Google API key)
ENABLE_REAL_FACT_CHECK=false
GOOGLE_FACT_CHECK_API_KEY=your-key

# AI detection (requires local model or API)
ENABLE_AI_TEXT_DETECTION=false

# Deepfake detection (requires local model)
ENABLE_DEEPFAKE_DETECTION=false

# Fact-check from Snopes/FactCheck (mock by default)
ENABLE_FACT_CHECK=false

# Reverse image search
ENABLE_REVERSE_IMAGE_SEARCH=false

# Emergency SMS alerts (requires Twilio)
EMERGENCY_CONTACT_PHONE=+1234567890
```

---

## 🔍 Troubleshooting

### "OPENAI_API_KEY is required but not configured"
- → File `.env.local` is missing or empty
- → Add `OPENAI_API_KEY=sk-proj-xxx` to `.env.local`
- → **IMPORTANT**: After editing `.env.local`, you MUST restart the dev server

### "OPENAI_API_KEY has invalid format"
- → Your key doesn't start with `sk-`
- → Should start with either `sk-proj-` (new) or `sk-` (old)
- → Verify the key is copied correctly from https://platform.openai.com/api-keys

### "401 Unauthorized" or "invalid_api_key"
- → Your key is invalid or revoked
- → Check your key at: https://platform.openai.com/api-keys
- → Try generating a new key
- → Verify no extra spaces: `sk-proj-xxxxx` (not `sk-proj-xxxxx `)

### "quota exceeded" or "rate limit"
- → Your OpenAI account hit usage limits
- → Check billing: https://platform.openai.com/account/billing/overview
- → Add payment method if needed or check usage

### Changes to `.env.local` not taking effect
- → **Stop the dev server**: `Ctrl+C`
- → **Restart**: `npm run dev`
- → Next.js doesn't hot-reload env vars
- → Wait 3-5 seconds for startup validation messages

---

## 📚 What Credentials Do What?

- **OPENAI_API_KEY** (REQUIRED): Powers the main AI analysis (gpt-4o-mini model)
- **GOOGLE_FACT_CHECK_API_KEY** (optional): Real-time fact-checking from Google's API
- **SMS credentials** (optional): Emergency SMS alerts via Twilio
- **External data APIs** (optional): Real-time weather, emergency, geo data

---

## ✨ See Also

- `.env.local` template: See `verisight-api/.env.local`
- Backend: `verisight-api/src/app/api/analyze/route.ts`
- OpenAI docs: https://platform.openai.com/docs
