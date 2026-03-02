# How to Run VeriSight

## Quick Start (5 Minutes)

### Prerequisites
✅ Node.js 18+  
✅ npm or yarn  
✅ Chrome/Edge/Brave browser  
✅ OpenAI API key (sk-proj-...)  

---

## Step-by-Step Setup

### Step 1: Verify API Key

Your OpenAI key should already be in `.env`:

```bash
# Check it's there
cat verisight-api\.env | findstr OPENAI_API_KEY

# If not there or expired, get new one:
# 1. Go to https://platform.openai.com/api-keys
# 2. Click "Create new secret key"
# 3. Copy it (format: sk-proj-...)
# 4. Edit verisight-api\.env and paste it
```

### Step 2: Start the Backend

```bash
# Open PowerShell/Terminal 1
cd verisight-api
npm install        # First time only (downloads dependencies)
npm run dev        # Start development server
```

**Wait for this message:**
```
✓ Ready in 2.1s

[Init] Loading NYC 311 data...
✓ Loaded 1000 NYC records

[Init] Loading Chicago crime data...
✓ Loaded 800 Chicago records

[Init] Embedding and indexing datasets...
✓ Indexed 1050 records
✓ Data pipeline ready!

▲ Next.js 16.1.6
- Local:        http://localhost:3000
```

✅ Backend is now running!

### Step 3: Load the Extension in Chrome

1. **Open Chrome, go to:** `chrome://extensions/`
2. **Enable "Developer mode"** (toggle, top-right corner)
3. **Click "Load unpacked"** button
4. **Select folder:** `c:\Users\mytze\VeriSight\verisight-extension`
5. **Click "Select Folder"**

✅ You should see VeriSight extension appear with icon in toolbar!

### Step 4: Test It Works

1. **Visit any website** (YouTube, news, Wikipedia, Twitter, etc.)
2. **Highlight some text** (optional but recommended)
3. **Click VeriSight icon** in toolbar (puzzle piece)
4. **Click "Analyze"** button
5. **Wait 2-5 seconds**

**You should see:**
```
Content Source:
  Title: [Page title]
  URL: [Full URL]
  Platform: generic/youtube/twitter/etc
  Media Type: text/video/image

Analysis Results:
  SUMMARY: [AI analysis]
  CRISIS MODE: OFF (none)
  RECOMMENDED: verify
  
  SIGNALS: [List of detected signals]
  CLAIMS: [Extracted facts to verify]
  
📊 Frame Analysis: [If video detected]
🚨 Emergency Data: [NYC/Chicago incidents]
🌍 Environmental: [Weather alerts]
📍 Geolocation: [Location + facilities]
💬 Offline: [SMS ready status]
```

✅ Everything is working!

---

## Detailed Reference

### All Terminal Commands

```bash
# Backend startup
cd verisight-api
npm install              # Install dependencies (first time)
npm run dev              # Start dev server (watches for changes)
npm run build            # Build for production
npm start                # Start production server

# Testing & debugging
npm run test:data        # Test data loading pipeline
npm run debug:data       # Show vector store status
npm run deepfake:test    # Test deepfake detection

# Extension
# No commands needed - just load in chrome://extensions
```

### API Endpoint (For Testing)

```bash
# Test backend without extension
curl -X POST http://localhost:3000/api/analyze ^
  -H "Content-Type: application/json" ^
  -d "{ \"title\": \"Test\", \"url\": \"https://example.com\", \"transcript\": \"test content\", \"selectedText\": \"sample\", \"frames\": [], \"platform\": \"generic\", \"mediaType\": \"text\" }"
```

---

## Troubleshooting

### Backend Won't Start

**Problem:** "OPENAI_API_KEY is required but not configured"

**Solution:**
```bash
# Check the key is set
cat verisight-api\.env | findstr OPENAI_API_KEY

# If it's there, restart:
# 1. Stop: Ctrl+C
# 2. Start: npm run dev

# If missing, add it:
# Edit verisight-api\.env
# Add: OPENAI_API_KEY=sk-proj-your-actual-key
# Save and restart
```

**Problem:** "Port 3000 already in use"

**Solution:**
```bash
# Find what's using port 3000
netstat -ano | findstr :3000

# Kill it (replace 12345 with PID from above)
taskkill /PID 12345 /F

# Or use different port:
npm run dev -- -p 3001
```

**Problem:** Backend starts but no "Data pipeline ready" message

**Solution:**
```bash
# Check data scripts exist
ls verisight-api\src\lib\dataLoader.ts
ls verisight-api\src\lib\embedder.ts
ls verisight-api\src\lib\retriever.ts

# If missing, re-create from templates
# Test the pipeline:
npm run test:data
npm run debug:data
```

### Extension Issues

**Problem:** Extension doesn't appear in chrome://extensions

**Solution:**
1. Make sure Developer mode is ON (top-right toggle must be blue)
2. Try refreshing the page (F5)
3. Make sure you're in `chrome://extensions` not some other tab

**Problem:** Extension loads but "Cannot connect to API"

**Solution:**
1. Verify backend is running: `npm run dev` in another terminal
2. Verify it's on localhost:3000 (not 3001 or other port)
3. Refresh extension (Ctrl+R in chrome://extensions)
4. Click VeriSight icon again

**Problem:** Click "Analyze", nothing happens

**Solution:**
1. You must be on a real webpage (not chrome://)
2. Open F12 (Developer Tools)
3. Look for errors in Console tab
4. Try highlighting text on the page first
5. Refresh extension

### Analysis Results Issues

**Problem:** Numbers show as 0 or "No data available"

**Solution:**
```bash
# Check data pipeline loaded:
npm run debug:data

# Should show: Total records: 1800+
# If it shows 0, check:

grep ENABLE_REAL verisight-api\.env
# Should show: ENABLE_REAL_NYC_DATA=true etc

# If flags are false, change to true and restart
npm run dev
```

**Problem:** Analysis takes 10+ seconds

**Solution:**
- First request: normal, takes 3-5 sec (embedding datasets)
- After that: should be <100ms
- If still slow, restart backend:
  ```bash
  # Terminal 1
  Ctrl+C
  npm run dev
  ```

**Problem:** Red errors in popup

**Solution:**
1. Open F12 in Chrome (Developer Tools)
2. Go to Console tab
3. Read the error message
4. Check backend logs too

---

## Verify Everything is Working

### Quick Health Check

```bash
# Terminal 1: Start backend
cd verisight-api
npm run dev

# Terminal 2: Test data pipeline
cd verisight-api
npm run debug:data

# Should output:
# ✓ Vector Store Statistics:
#   Total records: 1800
#   Sources: NYC_311: 1000, Chicago_Police: 800
#   Memory: ~10.8MB
```

### Chrome Extension Check

1. Go to `chrome://extensions/`
2. Look for "VeriSight" in the list
3. Should show "Enabled"
4. Click icon in toolbar
5. Should open popup without errors

### Test Analysis

1. Visit YouTube: https://www.youtube.com/watch?v=dQw4w9WgXcQ
2. Highlight: "never gonna"
3. Click VeriSight icon
4. Click "Analyze"
5. Should see results in 2-5 seconds with:
   - Title ✓
   - URL ✓
   - Selected text ✓
   - Analysis results (not errors)

---

## What Each Component Does

### `verisight-api` (Backend)
- Runs on `http://localhost:3000`
- Accepts POST to `/api/analyze`
- Calls OpenAI for AI analysis
- Loads & searches emergency datasets
- Returns comprehensive JSON

### `verisight-extension` (Extension)
- Injects into webpages you visit
- Extracts titles, text, transcripts
- Sends to backend when you click "Analyze"
- Displays results in pretty popup

### Data Pipeline (Part of Backend)
- Loads NYC 311, Chicago Police datasets (on startup)
- Creates vector embeddings for semantic search
- Stores in memory (fast access)
- Retrieves relevant incidents for each analysis

---

## Configuration Reference

### `.env` File (verisight-api root)

**Currently Configured:**
```
OPENAI_API_KEY=sk-proj-...     ← Already should have your key
MAPBOX_API_KEY=pk.eyJ...       ← Already set
NASA_API_KEY=...                ← Already set
```

**Data Source Flags (default TRUE):**
```
ENABLE_REAL_NYC_DATA=true           ← Real NYC 311 API
ENABLE_REAL_CHICAGO_DATA=true       ← Real Chicago Police API
ENABLE_ENVIRONMENTAL_DATA=true      ← Real NOAA weather
ENABLE_GEO_CONTEXT=true             ← Mapbox location services
```

**Optional (Twilio SMS):**
```
TWILIO_ACCOUNT_SID=              ← Skip for MVP
TWILIO_AUTH_TOKEN=               ← Skip for MVP
TWILIO_PHONE_NUMBER=             ← Skip for MVP
EMERGENCY_CONTACT_PHONE=         ← Skip for MVP
```

---

## Performance Expectations

| Task | Time |
|------|------|
| Backend startup | 2-3 sec |
| First request (data init) | 3-5 sec ⏸️ |
| Subsequent requests | 1-2 sec ✓ |
| Vector search | 50-100ms |
| Extension response | <300ms |

💡 **Tip:** First request is slowest (initializing embeddings). It gets cached!

---

## Port & Connection Info

| Component | Port | URL |
|-----------|------|-----|
| Backend | 3000 | http://localhost:3000 |
| API | 3000 | http://localhost:3000/api/analyze |
| Extension | N/A | chrome://extensions |

If port 3000 is taken, use: `npm run dev -- -p 3001`

---

## Need More Help?

### Documentation Files
- **`README.md`** - Project overview
- **`CONFIG_GUIDE.md`** - Environment & API keys
- **`DATA_PIPELINE.md`** - How RAG works technically
- **`RAG_IMPLEMENTATION.md`** - Data modules deep-dive
- **`QUICKSTART.md`** - Enhanced features overview

### Debug Tools
```bash
npm run debug:data    # Show all indexed data
npm run test:data     # Test pipeline components
npm run deepfake:test # Test deepfake module
```

### Check Logs
```bash
# Backend logs appear in terminal where you ran: npm run dev
# Extension logs: F12 in Chrome → Console tab
# Both tell you what's happening
```

---

## Quick Reference Card

```
START BACKEND:
  cd verisight-api && npm run dev
  → Wait for "✓ Data pipeline ready!"

LOAD EXTENSION:
  chrome://extensions → Developer mode ON
  → Load unpacked → verisight-extension folder

TEST:
  Go to any website
  Highlight text
  Click VeriSight icon
  Click "Analyze"
  → See results in 2-5 sec

DEBUG:
  npm run debug:data          (check data status)
  npm run test:data           (test pipeline)
  F12 in Chrome               (browser console)
  Check backend terminal logs (startup messages)

RESTART:
  Backend: Ctrl+C → npm run dev
  Extension: Ctrl+R in chrome://extensions
```

---

**Status:** ✅ Ready to run!  
**Version:** MVP with real data (RAG)  
**Next:** Try it with different websites and keywords  
