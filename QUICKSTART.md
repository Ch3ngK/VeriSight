# VeriSight Enhanced - Quick Start Guide

## What's New

Your VeriSight widget now has **5 major enhancements** for stronger public safety analysis:

1. ✅ **Frame Enhancement** - Motion & visual anomaly detection
2. ✅ **Emergency Data** - Validates against NYC/Chicago crime datasets  
3. ✅ **Environmental Data** - Confirms disaster claims with NOAA/NASA
4. ✅ **Geolocation** - Extracts location & finds nearby emergency facilities
5. ✅ **SMS Alerts** - Offline emergency notifications (store-and-forward)

---

## Installation

### 1. Install Dependencies
```bash
cd verisight-api
npm install
```

### 2. Load Extension
- Open `chrome://extensions/`
- Enable "Developer mode"
- Click "Load unpacked"
- Select `verisight-extension/` folder

### 3. Start Backend
```bash
npm run dev
# Starts on http://127.0.0.1:3000
```

---

## Testing the Enhancements

### Test Scenario 1: Crisis Detection
1. Go to any YouTube video
2. Open extension popup
3. Click **Analyze**
4. Check that enhanced sections appear:
   - 📊 Frame Analysis (if frames captured)
   - 🚨 Emergency Data (cross-reference with NYC/Chicago)
   - 🌍 Environmental Signals
   - 📍 Geolocation Context
   - 💬 Offline Capabilities

### Test Scenario 2: Fire Detection
```bash
# Terminal test
curl -X POST http://127.0.0.1:3000/api/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Building fire in downtown area",
    "transcript": "I see smoke and flames downtown near the mall",
    "url": "https://youtube.com/watch?v=example",
    "frames": []
  }'
```

**Expected Response Includes:**
- ✅ `crisis_mode.is_crisis: true`
- ✅ `emergency_data_validation`: Fire dataset matches
- ✅ `environmental_validation`: Weather/satellite data
- ✅ `geolocation_context`: Location = "downtown" with nearby facilities
- ✅ `offline_capabilities`: SMS ready if configured

### Test Scenario 3: Offline Mode
1. Disconnect API (or stop `npm run dev`)
2. Click Analyze in extension
3. Should see: **"Offline — stored for later sync"**
4. Restart backend
5. Click Analyze again
6. Pending requests flush automatically

---

## Viewing Enhanced Analysis

The extension now shows **5 new sections**:

### 📊 Frame Analysis
```
Frames: 5
Motion: Detected
Quality: medium
Signals: high_brightness_regions
```

### 🚨 Emergency Data Validation
```
Datasets: 1
Confidence: 85%
  • NYC 311: 3 incidents
```

### 🌍 Environmental Signals
```
Weather Alerts: 1
Satellites: 1
Confidence: 75%
  • Fire weather watch
```

### 📍 Geolocation Context
```
Location: downtown
Confidence: 75%
Facilities: 3
  • hospital: 0.8km
  • fire: 0.3km
  • police: 0.5km
```

### 💬 Offline Capabilities
```
SMS Alerts: Enabled
Pending: 0
Message: ALERT: Potential fire signal...
```

---

## Configuration

### Enable SMS Alerts (Optional)

**With Twilio:**
```env
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=+1234567890
EMERGENCY_CONTACT_PHONE=+1234567890
```

**Without Twilio (MVP):**
- SMS alerts are logged to console
- Pending alerts queue for later
- Ready for production SMS integration

---

## Understanding the Response

### Full Enhanced Response Structure
```json
{
  "summary": "AI summary of video",
  "crisis_mode": {
    "is_crisis": true,   // Main crisis detection
    "category": "fire",
    "why": "Fire keywords detected, validated by datasets"
  },
  "frame_analysis": {
    "frames_analyzed": 5,
    "motion_detected": true,
    "visual_signals": ["high_brightness_regions"],
    "recommendation": "High priority for visual verification"
  },
  "emergency_data_validation": {
    "emergency_datasets_available": 1,
    "matching_incident_patterns": [
      {
        "source": "NYC 311",
        "incidentCount": 3,
        "confidence": 0.85
      }
    ]
  },
  "environmental_validation": {
    "weather_alerts_count": 1,
    "weather_alerts": [
      {
        "type": "Fire Weather Watch",
        "severity": "high"
      }
    ],
    "disaster_pattern_confidence": 0.75
  },
  "geolocation_context": {
    "extracted_location": "downtown",
    "location_confidence": 0.75,
    "nearby_emergency_facilities": [
      {
        "type": "fire",
        "name": "Downtown Fire Station 1",
        "distance": 0.3
      }
    ],
    "response_recommendation": "PRIORITY: Emergency response available nearby"
  },
  "offline_capabilities": {
    "sms_alerts_enabled": true,
    "pending_sms_count": 0,
    "sms_message_template": "ALERT: Fire detected downtown..."
  },
  "signals": [...],     // AI-detected signals
  "claims": [...],      // Checkable claims extracted
  "public_safety_notes": [...]  // Safety recommendations
}
```

---

## Common Scenarios

### ✅ Video: "Shooting in downtown"
```
Frame Analysis: Motion detected
Emergency Data: Shooting incidents in NYC database
Geolocation: Downtown with police station nearby
Result: is_crisis=true, category=crime, action=escalate
SMS: "ALERT: Potential crime detected. Action: ESCALATE. Verify with dispatch."
```

### ✅ Video: "Heavy rain, flooding predicted"
```
Frame Analysis: Darkness regions detected (sky)
Environmental: NOAA flood watch active
Geolocation: Flood-prone area identified
Result: is_crisis=true, category=disaster, action=monitor
Response: "Monitor closely, evacuation alerts may follow"
```

### ✅ Video: "Normal day at beach"
```
Frame Analysis: High color variance (sky/water)
Emergency Data: No incident pattern match
Environmental: No weather alerts
Result: is_crisis=false
Response: "No crisis detected, standard content"
```

---

## Troubleshooting

### Issue: "Frame Analysis shows —"
- **Cause:** Frames not captured or not passed to API
- **Fix:** Make sure YouTube tab has transcript panel open

### Issue: "Emergency Data empty"
- **Cause:** Using mock data (no real API keys)
- **Fix:** Add NYC/Chicago API keys to `.env` for real data

### Issue: "Location not extracted"
- **Cause:** Location not mentioned in transcript
- **Fix:** Ensure video clearly states location

### Issue: SMS not working
- **Cause:** Twilio not configured (MVP uses console log)
- **Fix:** Add Twilio API keys or check console for mock SMS output

---

## Next Steps

1. **Test Core Features**
   - Run test scenarios above
   - Verify each enhancement appears in response

2. **Configure API Keys** (optional)
   - NOAA for real weather alerts
   - NASA for real satellite data
   - Twilio for real SMS

3. **Integrate with First Responders**
   - Dashboard for incident review
   - Integration with CAD systems
   - Multi-user analysis

4. **Scale to Multiple Communities**
   - Add more emergency datasets
   - Regional facility mapping
   - Multi-language support

---

## Architecture at a Glance

```
YouTube Video
    ↓
VeriSight Extension
(captures: title, transcript, frames)
    ↓
    → API /analyze
       ├─ OpenAI (crisis detection)
       ├─ Frame Enhancement (motion + signals)
       ├─ Emergency Data (NYC/Chicago validation)
       ├─ Environmental Data (NOAA/NASA)
       ├─ Geolocation (facilities lookup)
       └─ SMS Fallback (offline mode)
    ↓
Enhanced Analysis
(with 5 new data layers)
    ↓
Extension displays results
with visual sections
```

---

**Status:** ✅ All 5 Enhancements Implemented  
**Ready for:** Testing, integration, deployment  
**next:** Connect to real data APIs, add first responder dashboard
