# VeriSight Data Pipeline & RAG Implementation

## Overview

VeriSight now includes a **Retrieval-Augmented Generation (RAG)** system that grounds the AI analysis in real data from public emergency, crime, and environmental datasets instead of using generic placeholders.

### Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   User Request                          │
└────────────────────┬────────────────────────────────────┘
                     │
        ┌────────────▼───────────────┐
        │  Data Initialization       │ (1st request only)
        │ - Load datasets            │
        │ - Generate embeddings      │
        │ - Index in vector store    │
        └────────────┬───────────────┘
                     │
        ┌────────────▼──────────────────────────────┐
        │  On-Demand Retrieval (Each Analysis)     │
        │ - Hybrid search (vector + keyword)       │
        │ - Top-5 relevant records                 │
        │ - Calculate incident counts              │
        └────────────┬──────────────────────────────┘
                     │
        ┌────────────▼──────────────────────────────┐
        │  AI Analysis with Context                │
        │ - OpenAI GPT-4o mini                     │
        │ - Augmented with real data               │
        │ - Returns typed results                  │
        └────────────┬──────────────────────────────┘
                     │
        ┌────────────▼──────────────────────────────┐
        │  Enhanced Analysis Output                │
        │ - Emergency data with incident counts    │
        │ - Environmental alerts from NOAA         │
        │ - Geolocation context from Mapbox        │
        │ - AI & Deepfake detections               │
        └────────────┬──────────────────────────────┘
                     │
        ┌────────────▼───────────────┐
        │  Frontend Display          │
        │ Real numbers, not placeholders!
        └────────────────────────────┘
```

## Modules

### 1. **dataLoader.ts**
Loads public datasets with caching.

**Features:**
- NYC 311 complaint data (1000+ recent records)
- Chicago crime statistics
- NOAA weather alerts
- 1-hour cache TTL (configurable)

**Usage:**
```typescript
import { loadNYC311Data, loadChicagoData } from "./dataLoader";

const nyc311 = await loadNYC311Data();
const crimes = await loadChicagoData();
```

### 2. **embedder.ts**
Converts text data into vector embeddings for similarity search.

**Features:**
- Uses OpenAI's `text-embedding-3-large` model
- Stores embeddings in memory (production: use Pinecone/Weaviate)
- Batch embedding with rate limiting
- Vector store statistics

**Usage:**
```typescript
import { generateEmbedding, embedRecords, addToVectorStore } from "./embedder";

const embedding = await generateEmbedding("shooting event");
const embedded = await embedRecords(records, "NYC_311", "complaint_type");
addToVectorStore(embedded);
```

### 3. **retriever.ts**
Performs semantic search using vectors and keywords.

**Features:**
- Cosine similarity matching
- Hybrid search (vector + keyword-based BM25)
- Configurable top-k and minimum similarity threshold
- Constructs  augmented context for AI prompts

**Usage:**
```typescript
import { retrieveRelevantData, hybridRetrieval } from "./retriever";

// Vector search only
const results = await retrieveRelevantData("shooting", 5, 0.3);

// Hybrid search (recommended)
const hybrid = await hybridRetrieval("Are there shootings?", ["shooting", "gun"], 5);
```

### 4. **dataInitializer.ts**
Orchestrates the data pipeline at server startup.

**Called automatically:**
- On first `/api/analyze` request
- Loads datasets once
- Generates and indexes embeddings
- Prints statistics

## Configuration

### Environment Variables (`.env.local`)

```bash
# Data Source Flags
ENABLE_REAL_NYC_DATA=true          # Query real NYC 311 API
ENABLE_REAL_CHICAGO_DATA=true      # Query real Chicago Police data
ENABLE_ENVIRONMENTAL_DATA=true     # Enable NOAA weather queries
ENABLE_GEO_CONTEXT=true            # Enable geolocation features

# OpenAI (REQUIRED)
OPENAI_API_KEY=sk-proj-...         # For embeddings

# Optional: Mapbox (for better geolocation)
MAPBOX_API_KEY=pk.eyJ...           # Get from https://mapbox.com
```

### Feature Flags (In Code)

```typescript
// In any module
if (process.env.ENABLE_REAL_NYC_DATA === "true") {
  // Use real NYC 311 API
}
```

## Usage Examples

### Example 1: Emergency Data Analysis

**Input Analysis:**
```
Title: "Active Shooter Event Downtown"
Transcript: "Multiple shots fired near the civic center"
Keywords: ["shooting", "gun", "active threat"]
```

**RAG Process:**
1. Load NYC 311 data (~1000 records)
2. Embed the keywords and transcript
3. Retrieve top-5 similar incidents from database
4. AI analyzes with context: "Recent shootings: 3 in past month"
5. Output shows real incident count instead of placeholder

**Output:**
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

### Example 2: Running Tests

```bash
# Test data loading and retrieval
npm run test:data

# Debug the pipeline
npm run debug:data
```

## Testing & Debugging

### Test Script (`npm run test:data`)
Verifies:
- Dataset loading
- Embedding generation  
- Retrieval accuracy
- Vector store stats

### Debug Script (`npm run debug:data`)
Displays:
- All indexed records
- Vector store memory usage
- Example retrieval results
- Dataset statistics

## Performance Optimization

### Caching Strategy
- NYC 311 cache: 1 hour TTL
- Chicago data cache: 1 hour TTL
- Vector embeddings: In-memory (1536 dimensions)
- Estimated memory: ~6KB per record

### Rate Limiting
- NYC 311 API: 1 req/sec
- Chicago API: 1 req/sec
- Embeddings: 25k tokens/min (depends on OpenAI plan)

### Scalability Path

For production (1M+ records):
1. Switch to **Pinecone** or **Weaviate** for vector DB
2. Use **Redis** for dataset caching
3. Implement **async embedding jobs** queued with Bull
4. Add **API rate limiting** middleware
5. Use **batch embeddings** (up to 100 at once)

## Adding New Datasets

### Step 1: Create Data Loader
```typescript
// In dataLoader.ts
export async function loadMyDataset(): Promise<any[]> {
  const cacheKey = "my_dataset";
  
  const cached = getFromCache(cacheKey);
  if (cached) return cached;
  
  // Fetch from API or file
  const data = await fetch("...").then(r => r.json());
  
  setCache(cacheKey, "MyDataset", data);
  return data;
}
```

### Step 2: Initialize in dataInitializer.ts
```typescript
const myData = await loadMyDataset();
if (myData.length > 0) {
  const embedded = await embedRecords(myData.slice(0, 50), "MyDataset", "name");
  addToVectorStore(embedded);
}
```

### Step 3: Use in Analysis
```typescript
import { hybridRetrieval } from "./retriever";

const results = await hybridRetrieval(query, keywords, 5);
// Results will now include MyDataset records
```

## Troubleshooting

### "No records in vector store"
- Check `ENABLE_REAL_*_DATA` flags in `.env.local`
- Run `npm run debug:data` to see what loaded
- Check logs for API errors

### "OPENAI_API_KEY missing"
- Required for embedding generation
- Get key from https://platform.openai.com/api-keys
- Add to `.env.local`

### "Slow startup on first request"
- First request embeds all datasets (normal)
- Subsequent requests use cache
- Can run embedding as background job in production

### "Results show 0 incidents"
- Data loaded but no matches found
- Try different keywords
- Check if keywords match field names in dataset

## API Reference

### dataLoader

- `loadNYC311Data()`: Load NYC 311 complaints
- `loadChicagoData()`: Load Chicago crimes
- `loadNOAAWeatherData(lat, lon)`: Load weather alerts
- `getDatasetStats()`: Get summary statistics
- `clearCache(key?)`: Clear cached data

### embedder

- `generateEmbedding(text)`: Generate embedding vector
- `embedRecords(records, source, textField)`: Batch embed
- `addToVectorStore(records)`: Store embeddings
- `getVectorStoreStats()`: Get vector store info
- `getAllRecords(source?)`: Get all stored records

### retriever

- `retrieveRelevantData(query, topK, minSimilarity)`: Vector search
- `retrieveByKeywords(keywords, topK)`: Keyword search
- `hybridRetrieval(query, keywords, topK)`: Combined search
- `constructAugmentedContext(data, maxLength)`: Build prompt context

## Future Enhancements

- [ ] PostgreSQL + pgvector for persistent storage
- [ ] Scheduled async embedding updates
- [ ] Multi-language embeddings
- [ ] Real-time alert subscription (WebSocket)
- [ ] Custom ONNX models for local embeddings
- [ ] GraphQL API for data access
- [ ] Data validation pipeline
- [ ] Incident clustering and pattern detection

## References

- [OpenAI Embeddings](https://platform.openai.com/docs/guides/embeddings)
- [Retrieval-Augmented Generation](https://arxiv.org/abs/2005.11401)
- NYC Open Data: https://data.cityofnewyork.us/
- Chicago Data: https://data.cityofchicago.org/
- NOAA API: https://www.weather.gov/documentation/services-web-api
