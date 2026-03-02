/**
 * Geolocation Context Module
 * Extracts locations from transcripts and provides facility proximity data
 * Helps contextualize incident severity and response capabilities
 */

import axios from "axios";

interface EmergencyFacility {
  type: "hospital" | "fire" | "police" | "shelter";
  name: string;
  distance: number; // km
  distanceClass: "nearby" | "moderate" | "far";
}

interface LocationContext {
  extractedLocation: string | null;
  confidence: number;
  nearbyFacilities: EmergencyFacility[];
  response_recommendation: string;
}

/**
 * Enhanced location extraction with better pattern matching
 */
function extractLocationPatterns(text: string): string[] {
  const locations: Set<string> = new Set();

  // Pattern 1: Explicit location mentions
  const explicitPattern =
    /(?:in|near|at|around|happened at|occurred at)\s+([A-Z][a-z\s,\.]+?)(?:\.|,|;|$|\s(?:on|the|a|this|near))/g;
  let match;
  while ((match = explicitPattern.exec(text)) !== null) {
    locations.add(match[1].trim());
  }

  // Pattern 2: Known city/landmark names
  const cityPattern =
    /\b(New York|Los Angeles|Chicago|Houston|Dallas|Seattle|San Francisco|Miami|Atlanta|Boston|Philadelphia|Denver|Washington|Austin|Portland|Las Vegas|Phoenix|Minneapolis|Toronto|Vancouver|Singapore|London)\b/g;
  while ((match = cityPattern.exec(text)) !== null) {
    locations.add(match[1]);
  }

  // Pattern 3: Venue types (mentioned locations)
  const venuePattern =
    /(?:at the|in the|at)\s+(downtown|uptown|airport|station|mall|park|street|avenue|building|warehouse|factory)\s+([A-Za-z\s]+?)(?:area|district|region|zone)?/gi;
  while ((match = venuePattern.exec(text)) !== null) {
    locations.add(`${match[1]} ${match[2]}`.trim());
  }

  return Array.from(locations);
}

/**
 * Get emergency facilities near extracted location
 * MVP: Mock data - production would query OpenStreetMap or Google Places
 */
async function getCoordinatesForLocation(locationName: string): Promise<{ lat: number; lon: number } | null> {
  // First, try hardcoded lookup for common locations
  const knownLocations: Record<string, { lat: number; lon: number }> = {
    downtown: { lat: 40.7128, lon: -74.006 },
    "new york": { lat: 40.7128, lon: -74.006 },
    "los angeles": { lat: 34.0522, lon: -118.2437 },
    chicago: { lat: 41.8781, lon: -87.6298 },
    houston: { lat: 29.7604, lon: -95.3698 },
    seattle: { lat: 47.6062, lon: -122.3321 },
    "san francisco": { lat: 37.7749, lon: -122.4194 },
    miami: { lat: 25.7617, lon: -80.1918 },
    atlanta: { lat: 33.749, lon: -84.388 },
  };

  const locLower = locationName.toLowerCase();
  if (knownLocations[locLower]) {
    return knownLocations[locLower];
  }

  // Optional: Try Nominatim API for dynamic geocoding
  if (process.env.NOMINATIM_ENABLED === "true") {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(locationName)}&format=json&limit=1`,
        {
          headers: {
            "User-Agent": "(VeriSight Public Safety, contact@example.com)",
          },
        }
      );

      if (!response.ok) throw new Error("Nominatim request failed");

      const data = await response.json();
      if (data.length > 0) {
        return {
          lat: parseFloat(data[0].lat),
          lon: parseFloat(data[0].lon),
        };
      }
    } catch (err) {
      console.warn(`[Nominatim] Geocoding failed for "${locationName}"`);
    }
  }

  // Fallback: couldn't find location
  return null;
}

/**
 * Get emergency facilities near extracted location
 * MVP: Mock data - production would query OpenStreetMap or Google Places
 */
function getEmergencyFacilitiesNear(
  location: string
): EmergencyFacility[] {
  // Mock facilities database
  const mockFacilities: Record<string, EmergencyFacility[]> = {
    downtown: [
      {
        type: "hospital",
        name: "Metropolitan Medical Center",
        distance: 0.8,
        distanceClass: "nearby",
      },
      {
        type: "fire",
        name: "Downtown Fire Station 1",
        distance: 0.3,
        distanceClass: "nearby",
      },
      {
        type: "police",
        name: "Central Police Precinct",
        distance: 0.5,
        distanceClass: "nearby",
      },
    ],
    uptown: [
      {
        type: "hospital",
        name: "Uptown Hospital",
        distance: 1.2,
        distanceClass: "nearby",
      },
      {
        type: "fire",
        name: "Uptown Fire Station 5",
        distance: 2.1,
        distanceClass: "moderate",
      },
    ],
    airport: [
      {
        type: "police",
        name: "Airport Police Station",
        distance: 0.1,
        distanceClass: "nearby",
      },
      {
        type: "hospital",
        name: "Airport Medical Center",
        distance: 0.5,
        distanceClass: "nearby",
      },
    ],
    park: [
      {
        type: "police",
        name: "Park Patrol Station",
        distance: 0.2,
        distanceClass: "nearby",
      },
    ],
  };

  const locLower = location.toLowerCase();
  for (const [key, facilities] of Object.entries(mockFacilities)) {
    if (locLower.includes(key)) {
      return facilities;
    }
  }

  // Default: generic nearby facilities
  return [
    {
      type: "hospital",
      name: "Nearest Hospital",
      distance: 2.5,
      distanceClass: "moderate",
    },
    {
      type: "police",
      name: "Nearest Police Station",
      distance: 1.8,
      distanceClass: "moderate",
    },
  ];
}

/**
 * Generate response recommendation based on location and facilities
 */
function generateLocationRecommendation(
  location: string,
  facilities: EmergencyFacility[],
  isCrisis: boolean
): string {
  if (!isCrisis) {
    return `Continue monitoring. Context: ${location || "Location unknown"}`;
  }

  const nearbyCount = facilities.filter(
    (f) => f.distanceClass === "nearby"
  ).length;

  if (nearbyCount >= 2) {
    return `PRIORITY: Emergency response available nearby (${nearbyCount} facilities within 2km). Escalate to dispatch.`;
  } else if (nearbyCount === 1) {
    return `Response available at moderate distance. Contact dispatch for nearest unit.`;
  } else {
    return `Remote location. Activate mutual aid protocols. Alert neighboring jurisdictions.`;
  }
}

/**
 * Extract comprehensive location context from video analysis
 */
export async function extractLocationContext(
  title: string,
  transcript: string,
  isCrisis: boolean
): Promise<LocationContext> {
  const allText = `${title} ${transcript}`.trim();

  // Extract possible locations
  const locationMatches = extractLocationPatterns(allText);

  let primaryLocation: string | null = null;
  let confidence = 0;

  if (locationMatches.length > 0) {
    // Use first/most confident match
    primaryLocation = locationMatches[0];
    // Confidence based on specificity and matches
    confidence = Math.min(0.5 + locationMatches.length * 0.2, 1.0);
  }

  // Get nearby facilities
  const facilities = primaryLocation
    ? getEmergencyFacilitiesNear(primaryLocation)
    : [];

  // Generate response recommendation
  const recommendation = generateLocationRecommendation(
    primaryLocation || "unknown",
    facilities,
    isCrisis
  );

  return {
    extractedLocation: primaryLocation,
    confidence,
    nearbyFacilities: facilities,
    response_recommendation: recommendation,
  };
}

/**
 * Enrich analysis with geolocation context
 */
export async function enrichWithGeoContext(
  analysis: any,
  title: string,
  transcript: string
): Promise<any> {
  const isCrisis = analysis?.crisis_mode?.is_crisis || false;

  const geoContext = await extractLocationContext(title, transcript, isCrisis);

  analysis.geolocation_context = {
    extracted_location: geoContext.extractedLocation,
    location_confidence: geoContext.confidence,
    nearby_emergency_facilities: geoContext.nearbyFacilities,
    response_recommendation: geoContext.response_recommendation,
    data_source: "Transcript parsing + OpenStreetMap mock",
  };

  // Add facility info to signals if crisis
  if (isCrisis && geoContext.nearbyFacilities.length > 0) {
    if (!analysis.signals) analysis.signals = [];
    const facilityTypes = geoContext.nearbyFacilities
      .map((f) => f.type)
      .filter((v, i, a) => a.indexOf(v) === i); // unique
    analysis.signals.push({
      label: "Emergency facilities proximity",
      severity: "low",
      why: `${facilityTypes.join(", ")} available near location`,
    });
  }

  // Add recommendation to public safety notes
  if (analysis.public_safety_notes && !Array.isArray(analysis.public_safety_notes)) {
    analysis.public_safety_notes = [];
  }
  if (!analysis.public_safety_notes) {
    analysis.public_safety_notes = [];
  }
  if (geoContext.response_recommendation) {
    analysis.public_safety_notes.push(
      `📍 ${geoContext.response_recommendation}`
    );
  }

  return analysis;
}

/**
 * Format location for dispatch systems
 */
export function formatLocationForDispatch(
  geoContext: LocationContext
): string {
  return (
    geoContext.extractedLocation ||
    `Unknown (${geoContext.confidence > 0.5 ? "possible" : "no"} location data)`
  );
}
