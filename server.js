const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;
const PAKISTAN_BOUNDS = { latMin: 23, latMax: 37, lngMin: 60, lngMax: 78 };
const MAX_PAYLOAD_BYTES = 1024;

// Middleware
app.use(cors());
app.use(express.json());

/**
 * Calculates dynamic flood metrics based on spatial coordinates.
 * Generates deterministic values based on lat/lng inputs for reproducible testing.
 */
function computeSpatialMetrics(lat, lng) {
  // Deterministic seed using geographic coordinate hashing
  const seed = Math.abs(Math.sin(lat * 12.9898 + lng * 78.233)) * 43758.5453;
  const pseudoRandom = seed - Math.floor(seed);

  const inundated_km2 = parseFloat((0.5 + pseudoRandom * 44.5).toFixed(1));
  const water_depth_m = parseFloat((0.2 + (1 - pseudoRandom) * 3.8).toFixed(1));

  // Determine Hazard Level (Scale 1-5) based on depth and coverage
  let hazard_lvl = 1;
  if (water_depth_m > 2.5 && inundated_km2 > 20.0) {
    hazard_lvl = 5;
  } else if (water_depth_m > 1.8 || inundated_km2 > 12.0) {
    hazard_lvl = 4;
  } else if (water_depth_m > 1.0 || inundated_km2 > 5.0) {
    hazard_lvl = 3;
  } else if (water_depth_m > 0.5) {
    hazard_lvl = 2;
  }

  return { inundated_km2, water_depth_m, hazard_lvl };
}

/**
 * Fallback SitRep generator for offline/unauthenticated dev environments
 */
function getFallbackSitRep(inundated_km2, water_depth_m) {
  return {
    en: `Inundation of ${inundated_km2} sq km detected with average depth of ${water_depth_m}m. Emergency response teams advised to monitor local access routes.`,
    ur: `متاثرہ علاقہ ${inundated_km2} مربع کلومیٹر اور پانی کی اوسط گہرائی ${water_depth_m} میٹر ہے۔ امدادی ٹیموں کو راستوں کی نگرانی کی ہدایت کی جاتی ہے۔`
  };
}

/**
 * Calls Alibaba Cloud DashScope Qwen-Max API via native fetch
 */
async function getQwenSitRep(lat, lng, metrics) {
  const apiKey = process.env.DASHSCOPE_API_KEY;

  if (!apiKey) {
    console.warn('[DashScope Notice] DASHSCOPE_API_KEY missing in environment. Using fallback SitRep.');
    return getFallbackSitRep(metrics.inundated_km2, metrics.water_depth_m);
  }

  const prompt = `
System: You are an emergency situation awareness AI for NDMA Pakistan.
Context:
- Coordinates: Lat ${lat.toFixed(4)}, Lng ${lng.toFixed(4)}
- Inundated Area: ${metrics.inundated_km2} sq km
- Water Depth: ${metrics.water_depth_m} meters
- Hazard Level: ${metrics.hazard_lvl}/5

Task: Generate a concise bilingual Situation Report (exactly 1 English sentence and 1 Urdu sentence).
Output JSON strictly with keys "en" and "ur". Do not include Markdown formatting or extra text.
`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000); // 4-second timeout boundary

    const response = await fetch('https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'qwen-max',
        input: {
          messages: [{ role: 'user', content: prompt }]
        },
        parameters: {
          result_format: 'message'
        }
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`DashScope HTTP Error: ${response.status}`);
    }

    const data = await response.json();
    const rawContent = data?.output?.choices?.[0]?.message?.content;
    if (typeof rawContent !== 'string') throw new Error('DashScope returned no text content');
    
    // Clean response of potential markdown wrapping
    const cleanJson = rawContent.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(cleanJson);

    return {
      en: typeof parsed.en === 'string' && parsed.en.trim()
        ? parsed.en.trim()
        : `Critical water accumulation of ${metrics.water_depth_m}m recorded in region.`,
      ur: typeof parsed.ur === 'string' && parsed.ur.trim()
        ? parsed.ur.trim()
        : `منطقے میں ${metrics.water_depth_m} میٹر گہرے پانی کی آمد ریکارڈ کی گئی ہے۔`
    };

  } catch (error) {
    console.error('[DashScope Fallback Triggered]:', error.message);
    return getFallbackSitRep(metrics.inundated_km2, metrics.water_depth_m);
  }
}

function serializePayload(payload) {
  const result = { ...payload };
  let jsonString = JSON.stringify(result);

  // Keep both language fields while progressively shortening the least
  // important text until the transport contract is satisfied.
  while (Buffer.byteLength(jsonString, 'utf8') >= MAX_PAYLOAD_BYTES) {
    const english = result.ai_sitrep_en || '';
    const urdu = result.ai_sitrep_ur || '';
    if (english.length >= urdu.length && english.length > 20) {
      result.ai_sitrep_en = `${english.slice(0, Math.max(20, english.length - 20))}...`;
    } else if (urdu.length > 20) {
      result.ai_sitrep_ur = `${urdu.slice(0, Math.max(20, urdu.length - 20))}...`;
    } else {
      result.ai_sitrep_en = 'Flood assessment available.';
      result.ai_sitrep_ur = 'سیلاب کا تخمینہ دستیاب ہے۔';
      jsonString = JSON.stringify(result);
      break;
    }
    jsonString = JSON.stringify(result);
  }

  if (Buffer.byteLength(jsonString, 'utf8') >= MAX_PAYLOAD_BYTES) {
    throw new Error('Unable to serialize assessment below 1 KB');
  }
  return jsonString;
}

/**
 * POST /api/assess - Primary assessment endpoint
 */
app.post('/api/assess', async (req, res) => {
  try {
    const { lat, lng } = req.body ?? {};

    // Input Validation (Pakistan Bounding Box Check)
    if (
      typeof lat !== 'number' ||
      typeof lng !== 'number' ||
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      lat < PAKISTAN_BOUNDS.latMin ||
      lat > PAKISTAN_BOUNDS.latMax ||
      lng < PAKISTAN_BOUNDS.lngMin ||
      lng > PAKISTAN_BOUNDS.lngMax
    ) {
      return res.status(400).json({ error: 'Invalid or missing lat/lng coordinates.' });
    }

    // 1. Calculate dynamic spatial metrics
    const metrics = computeSpatialMetrics(lat, lng);

    // 2. Fetch AI SitRep from Qwen-Max or local fallback
    const sitrep = await getQwenSitRep(lat, lng, metrics);

    // 3. Assemble micro-JSON payload
    const payload = {
      loc: { 
        lat: parseFloat(lat.toFixed(4)), 
        lng: parseFloat(lng.toFixed(4)) 
      },
      inundated_km2: metrics.inundated_km2,
      water_depth_m: metrics.water_depth_m,
      hazard_lvl: metrics.hazard_lvl,
      ai_sitrep_en: sitrep.en,
      ai_sitrep_ur: sitrep.ur,
      ts: Math.floor(Date.now() / 1000)
    };

    // 4. Payload Size Enforcement Guard (< 1,024 Bytes)
    const jsonString = serializePayload(payload);

    res.setHeader('Content-Type', 'application/json');
    return res.status(200).send(jsonString);

  } catch (err) {
    console.error('[Server Error]:', err);
    return res.status(500).json({ error: 'Internal server error processing spatial query.' });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'active', system: 'FloodSight-DevServer' });
});

app.listen(PORT, () => {
  console.log(`[FloodSight Server] Running on port ${PORT}`);
  console.log(`[Endpoint] POST http://localhost:${PORT}/api/assess`);
});