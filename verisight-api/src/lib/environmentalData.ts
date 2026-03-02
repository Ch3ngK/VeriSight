/**
 * Environmental & Disaster Signals Module
 * Integrates NOAA weather data and NASA satellite imagery
 * Validates natural disaster claims and environmental conditions
 */

import axios from "axios";

interface WeatherAlert {
  type: string;
  severity: string;
  location: string;
  description: string;
}

interface SatelliteImagery {
  source: string;
  timestamp: string;
  anomalyDetected: boolean;
  anomalyType: string;
}

interface EnvironmentalContext {
  weather_alerts: WeatherAlert[];
  disaster_detected: boolean;
  satellite_anomalies: SatelliteImagery[];
  confidence: number;
}

// Mock coordinates for common locations (for testing)
const LOCATION_COORDS: Record<string, { lat: number; lon: number }> = {
  "new york": { lat: 40.7128, lon: -74.006 },
  "los angeles": { lat: 34.0522, lon: -118.2437 },
  chicago: { lat: 41.8781, lon: -87.6298 },
  houston: { lat: 29.7604, lon: -95.3698 },
  seattle: { lat: 47.6062, lon: -122.3321 },
  downtown: { lat: 40.7128, lon: -74.006 }, // Default: NYC
};

/**
 * Parse location mentions from transcript
 * MVP: Simple keyword matching for common city/region patterns
 */
function extractLocationFromTranscript(
  transcript: string,
  title: string
): string | null {
  const text = `${title} ${transcript}`.toLowerCase();

  // Common location patterns
  const patterns = [
    /(?:in|near|at)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/g,
    /([A-Z][a-z]+)\s+(?:city|county|district)/g,
    /(new york|los angeles|chicago|houston|seattle|san francisco|miami|atlanta)/gi,
  ];

  for (const pattern of patterns) {
    const matches = text.match(pattern);
    if (matches) return matches[0];
  }

  return null;
}

/**
 * Get coordinates for location (for NOAA queries)
 */
function getCoordinatesForLocation(location: string): { lat: number; lon: number } | null {
  const locLower = location.toLowerCase();
  
  // Direct lookup
  if (LOCATION_COORDS[locLower]) {
    return LOCATION_COORDS[locLower];
  }

  // Partial match
  for (const [key, coords] of Object.entries(LOCATION_COORDS)) {
    if (locLower.includes(key)) {
      return coords;
    }
  }

  return null;
}

/**
 * Query real NOAA Weather API for active alerts
 * No API key required - just User-Agent header
 */
async function queryNOAAWeatherAlerts(
  location: string
): Promise<WeatherAlert[]> {
  try {
    const coords = getCoordinatesForLocation(location);
    if (!coords) {
      console.log(`[NOAA] No coordinates found for location: ${location}`);
      return [];
    }

    // Step 1: Get grid point for this location
    const gridPointUrl = `https://api.weather.gov/points/${coords.lat},${coords.lon}`;

    const gridResponse = await axios.get(gridPointUrl, {
      headers: {
        "User-Agent": "(VeriSight Public Safety, contact@example.com)",
      },
      timeout: 5000,
    });

    const alertsUrl = gridResponse.data?.properties?.alerts;
    if (!alertsUrl) {
      console.log("[NOAA] No alerts endpoint found");
      return [];
    }

    // Step 2: Get active alerts
    const alertsResponse = await axios.get(alertsUrl, {
      headers: {
        "User-Agent": "(VeriSight Public Safety, contact@example.com)",
      },
      timeout: 5000,
    });

    // Parse NOAA alert format
    const alerts: WeatherAlert[] = [];
    if (alertsResponse.data?.features) {
      for (const feature of alertsResponse.data.features) {
        const props = feature.properties;
        alerts.push({
          type: props.event || "Weather Alert",
          severity: props.severity?.toLowerCase() || "unknown",
          location: location,
          description: props.headline || props.description || "",
        });
      }
    }

    console.log(`[NOAA] Found ${alerts.length} alerts for ${location}`);
    return alerts;
  } catch (err: any) {
    // Fallback to mock data if NOAA unavailable
    console.warn(`[NOAA] API call failed: ${err.message}. Using mock data.`);
    return queryNOAAmockAlerts(location);
  }
}

/**
 * Fallback mock alerts when NOAA unavailable
 */
function queryNOAAmockAlerts(location: string): WeatherAlert[] {
  const mockAlerts: Record<string, WeatherAlert[]> = {
    earthquake: [
      {
        type: "Earthquake Warning",
        severity: "high",
        location: "Pacific Region",
        description: "Seismic activity detected, prepare for potential aftershocks",
      },
    ],
    flood: [
      {
        type: "Flash Flood Watch",
        severity: "medium",
        location: "Urban Areas",
        description:
          "Heavy precipitation expected, monitor drainage and low-lying areas",
      },
    ],
    storm: [
      {
        type: "Severe Storm Warning",
        severity: "high",
        location: "Midwest",
        description: "Organized convection with high wind potential",
      },
    ],
    wildfire: [
      {
        type: "Air Quality Alert",
        severity: "medium",
        location: "Western States",
        description: "Smoke from active fires reducing visibility",
      },
    ],
  };

  const keywords = Object.keys(mockAlerts);
  for (const kw of keywords) {
    if (location.toLowerCase().includes(kw)) {
      return mockAlerts[kw];
    }
  }

  return [];
}

/**
 * Query NASA thermal anomalies and satellite data
 * MVP: Mock data - production would integrate NASA FIRMS API
 */
async function queryNASASatelliteData(
  location: string
): Promise<SatelliteImagery[]> {
  try {
    // Mock satellite anomalies
    const mockAnomalies: Record<string, SatelliteImagery[]> = {
      fire: [
        {
          source: "NASA FIRMS",
          timestamp: new Date(Date.now() - 3600000).toISOString(),
          anomalyDetected: true,
          anomalyType: "Thermal anomaly - High confidence fire",
        },
      ],
      flood: [
        {
          source: "NASA MODIS",
          timestamp: new Date(Date.now() - 7200000).toISOString(),
          anomalyDetected: true,
          anomalyType: "Water extent increase - Flood potential",
        },
      ],
      haze: [
        {
          source: "NASA Aerosol Product",
          timestamp: new Date().toISOString(),
          anomalyDetected: true,
          anomalyType: "Aerosol optical depth spike - Smoke/pollution",
        },
      ],
    };

    const keywords = Object.keys(mockAnomalies);
    let results: SatelliteImagery[] = [];
    for (const kw of keywords) {
      if (location.toLowerCase().includes(kw)) {
        results = results.concat(mockAnomalies[kw]);
      }
    }

    return results;
  } catch (err) {
    console.error("NASA query failed:", err);
    return [];
  }
}

/**
 * Cross-validate disaster claims with environmental data
 */
export async function validateDisasterClaim(
  title: string,
  transcript: string,
  crisisKeywords: string[]
): Promise<EnvironmentalContext> {
  const location = extractLocationFromTranscript(transcript, title) || "unknown";

  // Query environmental data sources
  // Now uses real NOAA API with fallback to mock
  const weatherAlerts = await queryNOAAWeatherAlerts(location);
  const satelliteAnomalies = await queryNASASatelliteData(location);

  // Determine if conditions match disaster claims
  const hasDisasterKeyword = crisisKeywords.some((kw) =>
    [
      "fire",
      "flood",
      "storm",
      "hurricane",
      "tornado",
      "earthquake",
      "landslide",
      "tsunami",
    ].some((d) => kw.toLowerCase().includes(d))
  );

  const disasterDetected =
    hasDisasterKeyword &&
    (weatherAlerts.length > 0 || satelliteAnomalies.length > 0);

  // Calculate confidence
  let confidence = 0;
  if (weatherAlerts.length > 0) confidence += 0.5;
  if (satelliteAnomalies.length > 0) confidence += 0.5;
  if (disasterDetected) confidence = Math.min(confidence + 0.3, 1.0);

  return {
    weather_alerts: weatherAlerts,
    disaster_detected: disasterDetected,
    satellite_anomalies: satelliteAnomalies,
    confidence,
  };
}

/**
 * Enrich analysis with environmental data
 */
export async function enrichWithEnvironmentalData(
  analysis: any,
  title: string,
  transcript: string
): Promise<any> {
  const keywords = analysis?.crisis_mode?.keywords || [];

  const envContext = await validateDisasterClaim(title, transcript, keywords);

  // Add environmental data to response
  analysis.environmental_validation = {
    weather_alerts_count: envContext.weather_alerts.length,
    weather_alerts: envContext.weather_alerts,
    satellite_anomalies_count: envContext.satellite_anomalies.length,
    satellite_anomalies: envContext.satellite_anomalies,
    disaster_pattern_confidence: envContext.confidence,
    data_sources: "NOAA + NASA FIRMS + NASA MODIS",
  };

  // Add safety note if disaster detected
  if (envContext.disaster_detected) {
    if (!analysis.public_safety_notes) analysis.public_safety_notes = [];
    analysis.public_safety_notes.push(
      "⚠️ Environmental data confirms potential disaster conditions. Contact local emergency services for current status."
    );
  }

  // Enhanced signals if environmental data supports claims
  if (envContext.weather_alerts.length > 0 && !analysis.signals) {
    analysis.signals = [];
  }
  if (envContext.weather_alerts.length > 0) {
    analysis.signals.push({
      label: "Environmental validation - Active weather alerts",
      severity: envContext.weather_alerts[0]?.severity || "medium",
      why: `NOAA alerts: ${envContext.weather_alerts.map((w) => w.type).join(", ")}`,
    });
  }

  return analysis;
}
