/**
 * FloodSight Pakistan - Payload Parser & Validator Utility
 * Ensures spatial data integrity, strict sub-1KB payload enforcement, 
 * and string sanitization for live NDMA situation reports.
 */

// Pakistan Geographic Bounding Box Limits
const PAKISTAN_BOUNDS = {
  LAT_MIN: 23.0,
  LAT_MAX: 37.0,
  LNG_MIN: 60.0,
  LNG_MAX: 78.0,
};

// Maximum Allowed Payload Size in Bytes (Sub-1 KB Limit)
const MAX_PAYLOAD_BYTES = 1024;

/**
 * Cleans unwanted Markdown symbols, backticks, line breaks, and excess whitespace from SitReps.
 * 
 * @param {string} text - Raw string returned from Qwen-Max or fallback engine
 * @returns {string} Cleaned, single-line text string
 */
export function sanitizeSitRep(text) {
  if (typeof text !== 'string') return '';

  return text
    // Remove Markdown headers, bold/italic markers (*, _, #, `)
    .replace(/[*_#`~]/g, '')
    // Replace newlines, carriage returns, and tabs with a single space
    .replace(/[\r\n\t]+/g, ' ')
    // Collapse multiple spaces into a single space
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Validates incoming JSON responses from the /api/assess endpoint.
 * Checks spatial bounds, schema properties, types, ranges, and byte-size constraints.
 * 
 * @param {Object} payload - The JSON payload returned from Function Compute or backend server
 * @returns {{ valid: boolean, errors: string[] }} Object containing validation state and array of error messages
 */
export function validatePayload(payload) {
  const errors = [];

  // 1. Root Object Validation
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return {
      valid: false,
      errors: ['Invalid payload format: Expected a non-null JSON object.'],
    };
  }

  // 2. Strict Payload Byte-Size Check (< 1,024 Bytes)
  try {
    const jsonString = JSON.stringify(payload);
    // Use Blob or TextEncoder to measure actual UTF-8 byte length (critical for Urdu characters)
    const byteLength = new TextEncoder().encode(jsonString).length;

    if (byteLength >= MAX_PAYLOAD_BYTES) {
      errors.push(
        `Payload size violation: Size is ${byteLength} bytes, exceeding the ${MAX_PAYLOAD_BYTES} byte limit.`
      );
    }
  } catch (err) {
    errors.push(`Payload serialization failed: ${err.message}`);
  }

  // 3. Location (`loc`) & Pakistan Bounds Validation
  if (!payload.loc || typeof payload.loc !== 'object') {
    errors.push('Missing or invalid field: "loc" must be an object.');
  } else {
    const { lat, lng } = payload.loc;

    if (typeof lat !== 'number' || Number.isNaN(lat)) {
      errors.push('Invalid coordinate: "loc.lat" must be a valid number.');
    } else if (lat < PAKISTAN_BOUNDS.LAT_MIN || lat > PAKISTAN_BOUNDS.LAT_MAX) {
      errors.push(
        `Out of bounds: Latitude ${lat} is outside Pakistan boundary (${PAKISTAN_BOUNDS.LAT_MIN} to ${PAKISTAN_BOUNDS.LAT_MAX}).`
      );
    }

    if (typeof lng !== 'number' || Number.isNaN(lng)) {
      errors.push('Invalid coordinate: "loc.lng" must be a valid number.');
    } else if (lng < PAKISTAN_BOUNDS.LNG_MIN || lng > PAKISTAN_BOUNDS.LNG_MAX) {
      errors.push(
        `Out of bounds: Longitude ${lng} is outside Pakistan boundary (${PAKISTAN_BOUNDS.LNG_MIN} to ${PAKISTAN_BOUNDS.LNG_MAX}).`
      );
    }
  }

  // 4. Metric Field Range & Type Checks
  if (typeof payload.inundated_km2 !== 'number' || payload.inundated_km2 < 0) {
    errors.push('Invalid field: "inundated_km2" must be a non-negative number.');
  }

  if (typeof payload.water_depth_m !== 'number' || payload.water_depth_m < 0) {
    errors.push('Invalid field: "water_depth_m" must be a non-negative number.');
  }

  if (
    typeof payload.hazard_lvl !== 'number' ||
    !Number.isInteger(payload.hazard_lvl) ||
    payload.hazard_lvl < 1 ||
    payload.hazard_lvl > 5
  ) {
    errors.push('Invalid field: "hazard_lvl" must be an integer between 1 and 5.');
  }

  // 5. Situation Report (SitRep) Presence Validation
  if (typeof payload.ai_sitrep_en !== 'string' || !payload.ai_sitrep_en.trim()) {
    errors.push('Missing field: "ai_sitrep_en" must be a non-empty string.');
  }

  if (typeof payload.ai_sitrep_ur !== 'string' || !payload.ai_sitrep_ur.trim()) {
    errors.push('Missing field: "ai_sitrep_ur" must be a non-empty string.');
  }

  // 6. Timestamp Validation
  if (
    typeof payload.ts !== 'number' ||
    !Number.isInteger(payload.ts) ||
    payload.ts <= 0
  ) {
    errors.push('Invalid field: "ts" must be a valid UNIX timestamp in seconds.');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Utility to process, sanitize, and validate incoming payload in a single step.
 * 
 * @param {Object} payload 
 * @returns {{ valid: boolean, data: Object|null, errors: string[] }}
 */
export function processAssessResponse(payload) {
  const validation = validatePayload(payload);

  if (!validation.valid) {
    return {
      valid: false,
      data: null,
      errors: validation.errors,
    };
  }

  // Return deeply sanitized version of the payload
  const sanitizedData = {
    ...payload,
    ai_sitrep_en: sanitizeSitRep(payload.ai_sitrep_en),
    ai_sitrep_ur: sanitizeSitRep(payload.ai_sitrep_ur),
  };

  return {
    valid: true,
    data: sanitizedData,
    errors: [],
  };
}