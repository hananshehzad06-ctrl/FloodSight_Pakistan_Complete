"""
FloodSight Pakistan — DashScope AI SitRep Generator (Function Compute)

Generates bilingual situation reports using Qwen-Max or a deterministic fallback.
"""

import os
import json
import time
import dashscope


# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

dashscope.api_key = os.environ.get("DASHSCOPE_API_KEY", "")

_QWEN_MODEL = "qwen-max"
_MAX_RETRIES = 3
_RETRY_DELAY_SECONDS = 1.5


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _build_prompt(metrics):
    """Return a strict JSON-mode prompt for the LLM."""
    return (
        "You are a senior Pakistan disaster management analyst. "
        "Write a concise situational awareness summary for NDMA/PDMA duty officers. "
        "Return ONLY a JSON object with exactly two keys: ai_summary_en and ai_summary_ur. "
        "Each value must be a single paragraph under 120 words. "
        "Use these metrics:\n"
        f"- Flooded area: {metrics.get('flooded_sq_km', 0)} km²\n"
        f"- Affected Union Councils: {metrics.get('affected_ucs', 0)}\n"
        f"- Displaced population: {metrics.get('displaced_pop', 0):,}\n"
        f"- Active rescue boats: {metrics.get('active_boats', 0)}\n"
        f"- Relief camps needed: {metrics.get('relief_camps_needed', 0)}\n"
        "Now output JSON:"
    )


def _fallback_sitrep(metrics):
    """Deterministic bilingual fallback if DashScope is unreachable."""
    flooded = metrics.get("flooded_sq_km", 0)
    ucs = metrics.get("affected_ucs", 0)
    displaced = metrics.get("displaced_pop", 0)
    boats = metrics.get("active_boats", 0)
    camps = metrics.get("relief_camps_needed", 0)

    en = (
        f"FloodSight update: approximately {flooded} km² is inundated across {ucs} "
        f"Union Councils, affecting an estimated {displaced:,} displaced persons. "
        f"{boats} rescue boats are active and {camps} relief camps are required. "
        "Prioritise high-hazard zones, ensure boat launch continuity, and expedite camp establishment."
    )
    ur = (
        f"فلڈ سائٹ اپ ڈیٹ: تقریباً {flooded} مربع کلومیٹر علاقہ زیر آب ہے جس میں {ucs} "
        f"یونین کونسلز متاثر ہیں اور {displaced:,} افراد بے گھر ہوئے ہیں۔ "
        f"موجودہ وقت میں {boats} بچاؤ کشیاں فعال ہیں اور {camps} ریلیف کیمپس درکار ہیں۔ "
        "اعلی خطرے والے علاقوں کو ترجیح دیں، کشتیوں کے آپریشن کو جاری رکھیں، اور ریلیف کیمپس قائم کرنے میں تیزی کریں۔"
    )
    return {"ai_summary_en": en, "ai_summary_ur": ur, "source": "fallback_template"}


def _call_qwen_json(prompt):
    """Call DashScope Generation API with retries; return parsed JSON."""
    last_error = None
    for attempt in range(_MAX_RETRIES):
        try:
            response = dashscope.Generation.call(
                model=_QWEN_MODEL,
                messages=[{"role": "user", "content": prompt}],
                response_format={"type": "json_object"},
                result_format="message",
            )
            if response.status_code == 200:
                content = response.output.choices[0].message.content
                parsed = json.loads(content)
                if "ai_summary_en" in parsed and "ai_summary_ur" in parsed:
                    parsed["source"] = "qwen-max"
                    return parsed
                raise ValueError("Missing required keys in LLM response")
            last_error = f"API status {response.status_code}: {response.message}"
        except Exception as exc:  # pylint: disable=broad-except
            last_error = str(exc)

        if attempt < _MAX_RETRIES - 1:
            time.sleep(_RETRY_DELAY_SECONDS * (attempt + 1))

    raise RuntimeError(f"DashScope failed after {_MAX_RETRIES} retries: {last_error}")


# ---------------------------------------------------------------------------
# Function Compute handler
# ---------------------------------------------------------------------------

def generate_ai_sitrep(event, context):
    # Accept either a raw dict or an FC HTTP-style body.
    if isinstance(event, str):
        event = json.loads(event)
    if "body" in event:
        body = event["body"]
        if isinstance(body, str):
            body = json.loads(body)
        event = body

    metrics = {
        "flooded_sq_km": event.get("flooded_sq_km", 0),
        "affected_ucs": event.get("affected_ucs", 0),
        "displaced_pop": event.get("displaced_pop", 0),
        "active_boats": event.get("active_boats", 0),
        "relief_camps_needed": event.get("relief_camps_needed", 0),
    }

    try:
        prompt = _build_prompt(metrics)
        result = _call_qwen_json(prompt)
        return {
            "statusCode": 200,
            "headers": {"Content-Type": "application/json"},
            "body": json.dumps(result),
        }
    except Exception as exc:  # pylint: disable=broad-except
        fallback = _fallback_sitrep(metrics)
        fallback["warning"] = str(exc)
        return {
            "statusCode": 200,
            "headers": {"Content-Type": "application/json"},
            "body": json.dumps(fallback),
        }
