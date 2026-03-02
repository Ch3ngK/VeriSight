# VeriSight Backend: Data Pipeline Implementation

## What Changed?

The backend now uses **Retrieval-Augmented Generation (RAG)** to display real data instead of placeholders in the "Enhanced Analysis" section of the popup.

### Before (Mock Data)
```json
{
  "emergency_data_validation": {
    "datasets_available": 0,
    "contextual_confidence_boost": 0,
    "description": "No data available"
  }
}
```

### After (Real Data with RAG)
```json
{
  "emergency_data_validation": {
    "emergency_datasets_available": 12,
    "matching_incident_patterns": [
      {
        "source": "NYC 311 (85% match)",
        "incidentCount": 3,
        "category": "Shooting",
        "confidence": 0.85
      }
    ],
    "contextual_confidence_boost": 0.85
  }
}
```

## New Files Added

### Core Pipeline Modules
1. **`src/lib/dataLoader.ts`** - Loads and caches public datasets (NYC 311, Chicago Police, NOAA)
2. **`src/lib/embedder.ts`** - Converts data to embeddings using OpenAI
3. **`src/lib/retriever.ts`** - Finds relevant records using vector similarity
4. **`src/lib/dataInitializer.ts`** - Orchestrates pipeline initialization

### Scripts & Documentation
5. **`scripts/testData.ts`** - Test suite for the data pipeline
6. **`scripts/debugData.ts`** - Debug tool to inspect loaded datasets
7. **`DATA_PIPELINE.md`** - Complete technical documentation
8. **`.env.local`** - Configuration template  (in root dir)

## How It Works

### Step 1: Initialization (First Request)
When the backend starts, on the first `/api/analyze` request:
1. Loads NYC 311 complaint data (1000+ records)
2. Loads Chicago crime data
3. Generates vector embeddings for each record
4. Stores embeddings in memory vector store
5. Caches data for 1 hour (no repeated API calls)

### Step 2: On Each Analysis Request
When user clicks "Analyze":
1. Extract keywords from transcript ("shooting", "fire", "assault", etc.)
2. Perform hybrid search (vector similarity + keyword matching)
3. Retrieve top-5 most relevant incidents from database
4. Get real incident counts
5. Pass to OpenAI with context:
   ```
   "RELEVANT CONTEXT: Found 3 shooting incidents in NYC in past month 
    from NYC 311 (85% relevance)"
   ```
6. AI generates analysis informed by real data

### Step 3: Return to Frontend
Frontend now displays:
- ✅ Real incident counts (e.g., "3 incidents")
- ✅ Real data sources (e.g., "NYC 311 Police")
- ✅ Confidence scores (e.g., "85% match")
- ✅ Categorized incidents

## Configuration

### Enable/Disable Data Sources

Edit `.env.local` in `verisight-api/` folder:

```bash
# Data Source Flags (default: true)
ENABLE_REAL_NYC_DATA=true          # NYC 311 Complaints API
ENABLE_REAL_CHICAGO_DATA=true      # Chicago Police Data Portal
ENABLE_ENVIRONMENTAL_DATA=true     # NOAA Weather Alerts
ENABLE_GEO_CONTEXT=true            # Mapbox Geolocation

# Required for embeddings
OPENAI_API_KEY=sk-proj-your-key-here

# Optional: Mapbox for better location context
MAPBOX_API_KEY=pk.eyJ...
```

## Testing the Pipeline

### Run Data Loading Tests
```bash
cd verisight-api
npm run test:data
```

Output:
```
✓ NYC 311: 1000 records
✓ Chicago: 800 records  
✓ Generated embedding (dimension: 1536)
✓ Keyword retrieval: 3 results
✓ All tests passed!
```

### Debug Pipeline Status
```bash
npm run debug:data
```

Output:
```
📊 Vector Store Statistics:
   Total records: 1800
   Memory usage: 10.8MB
   Sources:
     - NYC_311: 1000
     - Chicago_Police: 800

📈 Dataset Summary:
   NYC 311: 1000 complaints
   Chicago: 800 crimes
   Last updated: 2026-03-02T14:23:45.123Z
```

## Performance

### Load Times
- First request: ~3-5 seconds (loading + embedding)
- Subsequent requests: <100ms (using cache)

### Memory Usage
- Empty: ~2MB
- With 2000 records: ~12MB (6KB per record)
- Scales to ~5-10k records before DB needed

### API Calls
- NYC 311: 1 call (loads 1000 records)
- Chicago: 1 call (loads 800 records)
- NOAA: Per-location queries (small payloads)
- Embeddings: ~100 records/API calls (batched)

## Real Data Sources

### NYC 311 Complaints
- **API**: https://data.cityofnewyork.us/api/views/erm2-nwe9/rows.json
- **Data**: Service requests, complaints, incidents
- **Auth**: None (public API)
- **Rate**: Unlimited (but practical limit ~1/sec)
- **Fields**: complaint_type, agency, created_date, status

**Sample Record**:
```json
{
  "complaint_type": "Shooting",
  "agency": "NYPD",
  "created_date": "2026-03-02",
  "status": "Open"
}
```

### Chicago Police Data
- **API**: https://data.cityofchicago.org/api/views/ijzp-q8t2/rows.json
- **Data**: Crime incidents, arrests, investigations
- **Auth**: None (public API)
- **Rate**: Unlimited (practical limit ~1/sec)
- **Fields**: primary_type, description, district, date

**Sample Record**:
```json
{
  "primary_type": "ASSAULT",
  "description": "Simple/Agg",
  "district": "001",
  "date": "2026-03-02"
}
```

### NOAA Weather Alerts
- **API**: https://api.weather.gov/
- **Data**: Weather alerts, warnings, watches by location
- **Auth**: None (no API key needed, just User-Agent)
- **Rate**: Should be <15 req/min per location

**Coverage**: Continental US + territories

## Troubleshooting

### Numbers Still Showing as 0 or Placeholders

**Check 1: Data Flags Enabled?**
```bash
grep ENABLE_REAL .env.local
# Should show TRUE values
```

**Check 2: Vector Store Has Data?**
```bash
npm run debug:data
# Look for "Total records: > 0"
```

**Check 3: API Keys Set?**
```bash
grep OPENAI_API_KEY .env.local
# Should show sk-proj-...
```

### API Calls Failing

**NYC 311 Rate Limit Hit?**
- Data is cached for 1 hour
- Check logs for "429 Too Many Requests"
- Solution: Wait or reduce request load

**NOAA Weather Timeout?**
- Common if network is slow
- Solution: Increase timeout in environmentalData.ts

**OpenAI Embedding Error?**
- Check OPENAI_API_KEY is valid
- Check OpenAI account has credits
- Reduce batch size in embedder.ts

### Slow Startup

This is normal:
1. **First request**: 3-5 seconds (embedding 1000+ records)
2. **Subsequent requests**: <100ms (cached)

Production solution: Move embedding to async background job

## Architecture Decision: Why RAG?

Instead of:
- Hard-coded mock data ❌
- Random number generation ❌
- Placeholder responses ❌

We use:
- **Real public datasets** ✅
- **Vector embeddings** for semantic matching ✅
- **Hybrid search** (vector + keyword) ✅
- **Cached results** for performance ✅

This grounds the AI analysis in actual data, making results more reliable and meaningful for public safety analysis.

## Next Steps (Production Ready-up)

### Immediate (Week 1)
- [ ] Add more data sources (FBI UCR, CDC, USGS)
- [ ] Implement Redis caching
- [ ] Add PostgreSQL + pgvector backend

### Short Term (Week 2-3)
- [ ] Background embedding jobs (Bull queues)
- [ ] Real-time WebSocket alerts
- [ ] GraphQL API for data access
- [ ] Multi-language embeddings

### Medium Term (Month 1-2)
- [ ] Custom ONNX models for local embeddings
- [ ] Incident clustering & pattern detection
- [ ] Dashboard showing dataset statistics
- [ ] Data freshness monitoring

## Files Modified

- `src/app/api/analyze/route.ts` - Added initialization call
- `src/lib/emergencyData.ts` - Updated to use dataLoader + retriever
- `package.json` - Added test scripts

## See Also

- [`DATA_PIPELINE.md`](./DATA_PIPELINE.md) - Technical documentation
- [`CONFIG_GUIDE.md`](../CONFIG_GUIDE.md) - Environment setup
- Source modules: `src/lib/{dataLoader,embedder,retriever}.ts`
