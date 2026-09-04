# FloodSight Pakistan

Offline-first flood response platform for Pakistan's **Rescue 1122**, NDMA/PDMA command centres, and field units.

Built for the **Alibaba Cloud AI Hackathon 2026**, FloodSight Pakistan combines Sentinel-1 SAR imagery processing on **Alibaba Cloud Function Compute**, AI-generated bilingual situation reports via **DashScope Qwen-Max**, and a low-bandwidth PWA front-end that keeps working when cellular networks fail.

---

## Architecture

```textn┌─────────────────────────────────────────────────────────────────────┐
│  Field Operator Device (React + Vite + Tailwind + Leaflet + idb)    │
│  - Tactical Field PWA (boat launches, hazards, offline maps)        │
│  - Macro Command Dashboard (NDMA/PDMA risk ranking, SitRep export)  │
│  - IndexedDB cache for uc_payloads, seed-on-first-boot              │
└──────────────┬──────────────────────────────────────────────────────┘
               │  2G EDGE / SMS sync, micro-JSON (< 1 KB)
               ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Alibaba Cloud OSS buckets                                          │
│  - Raw Sentinel-1 SAR GeoTIFF uploads                               │
│  - Compressed JSON flood-boundary results                           │
└──────────────┬──────────────────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Function Compute — SAR Ingestion (`main.py`)                       │
│  - STS auth, GDAL backscatter thresholding, polygon simplification  │
│  - Outputs WGS84 flood boundaries < 1 KB                            │
└──────────────┬──────────────────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Function Compute — AI SitRep (`qwen_sitrep.py`)                    │
│  - DashScope Qwen-Max JSON-mode generation                          │
│  - Retries + deterministic English/Urdu fallback template           │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Repository Layout

```textn/app
├── src
│   ├── App.jsx                       # View toggle: Field PWA ↔ Command Dashboard
│   ├── components
│   │   ├── CommandDashboard.jsx      # NDMA/PDMA macro command console
│   │   └── RescueFieldPWA.jsx        # Offline-first tactical field view
│   ├── data
│   │   └── mockData.js               # Mock UC payloads and SitRep data
│   └── utils
│       └── db.js                     # IndexedDB helper (idb) with seeding
├── backend/function_compute
│   ├── main.py                       # SAR ingestion handler
│   ├── qwen_sitrep.py                # DashScope AI SitRep generator
│   └── requirements.txt              # Python dependencies
├── package.json
└── README.md
```

---

## Frontend Setup & Run

Requires **Node.js 18+** and npm.

```bash
cd /app
npm install
npm run dev
```

The Vite dev server will start (default `http://localhost:5173`). Use the tab bar to switch between the **Tactical Field PWA** and the **Macro Command Dashboard**.

---

## Backend (Function Compute)

Python 3.10+ is recommended. Install dependencies with:

```bash
cd /app/backend/function_compute
pip install -r requirements.txt
```

### SAR Ingestion Handler

Entry point: `main.process_sar_image(event, context)`

Environment variables:

- `OSS_ENDPOINT` — OSS endpoint (default: `oss-cn-beijing-internal.aliyuncs.com`)
- `DST_BUCKET` — destination bucket for JSON results
- `DST_PREFIX` — prefix for result keys (default: `flood-results/`)
- `FLOOD_THRESHOLD_DB` — backscatter threshold in dB (default: `-15.0`)

### AI SitRep Generator

Entry point: `qwen_sitrep.generate_ai_sitrep(event, context)`

Environment variables:

- `DASHSCOPE_API_KEY` — DashScope API key

---

## License

Submitted as part of the Alibaba Cloud AI Hackathon 2026 — FloodSight Pakistan team.
