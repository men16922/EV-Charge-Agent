# ⚡ Smart-EV Agent

### Your autonomous EV copilot for APAC — charge, drive & live smarter

An AI decision-intelligence copilot that doesn't just find a plug — it plans the drive,
**simulates it on the map**, and tells you what to do while you charge. Built end-to-end
on Google Cloud.

|   |   |
| --- | --- |
| 🔗 **Live demo** | https://ev-charge-web-1004528040791.us-central1.run.app |
| 📦 **Repository** | https://github.com/men16922/EV-Charge-Agent |
| 🧰 **Stack** | Gemini 2.5 Flash · Vertex AI ADK · BigQuery + BigQuery ML · Cloud Run · Google Maps (Routes/Places) · React + Vite |

---

## What it is

EV drivers across the Asia-Pacific region face more than range anxiety: *will the plug
fit my car, be free when I arrive, and be worth the trip?* **Smart-EV Agent** is a
Gemini-powered agent + React dashboard that answers all of that — and turns "where do I
charge?" into a full smart-life plan: **best charger → drive → charge → what to do
meanwhile** — every recommendation explained, and the whole journey simulated on the map.

It runs on **7,842 real charging stations** (Open Charge Map, APAC) stored as BigQuery
`GEOGRAPHY`, with BigQuery ML (ARIMA_PLUS) demand forecasting and live availability.

## Key features

- 🔌 **Connector-aware recommendation** — ranks chargers by distance, power (kW), live
  availability, your car's connector, and reachability on current battery; explains *why*.
- 🚗 **Autonomous drive simulation** — the car drives the route on the map (inline HUD)
  or in a cinematic modal, with **TURBO 1×/4×/16×**. Hybrid routing: Google Routes →
  **OSRM fallback** for regions Google can't route (e.g. Korea).
- 🔋 **Charging simulation** — battery animates to target, with kW + minutes, synced to
  the EV panel (battery curve / taper modeled).
- 🍴 **Smart-life POIs** — "leave the car charging and grab lunch": walkable restaurants/
  cafes/shopping near the stop (Google Places), fitted to the charge window.
- 🗺️ **Multi-stop trip planning** — shopping → dinner → parking, with per-leg ETA + totals.
- 🌍 **Equity & impact** — charging-desert overlay for underserved areas, community CO₂
  avoided, BigQuery ML demand-forecast cards.
- 🤖 **Explainable & live** — streaming agent reasoning trace, structured plan/forecast
  UI cards reconstructed from tool results, bilingual **EN/KO**.

## Architecture

```
React + Vite (Leaflet)  ──┐
                          ├─►  Flask on Cloud Run (single service, scale-to-zero, $0 idle)
   /api/* · /chat/stream ─┘            │
                                       ├─►  Vertex AI · Gemini 2.5 Flash + ADK (agent, 10 tools)
                                       ├─►  BigQuery — ev_charging_stations (GEOGRAPHY) + ARIMA_PLUS
                                       ├─►  Google Maps — Routes (→ OSRM fallback) · Places (New)
                                       └─►  MCP toolbox (status / manuals / forecast)
```
The Vite frontend is built inside `Dockerfile.web` (multi-stage: Node build → Python
runtime) and served by Flask from the **same** Cloud Run service — no CORS, one deploy.

## Agent tools (10)

| Tool | Source | Purpose |
| --- | --- | --- |
| `find_nearby_stations` | BigQuery (geospatial) | nearest compatible chargers + live status |
| `plan_route` | Google Routes → OSRM | driving distance & ETA |
| `find_pois_near` | Google Places (New) | walkable things to do while charging |
| `plan_trip` | chained routing | multi-stop trip ETAs & totals |
| `find_charging_deserts` | BigQuery (geospatial) | coverage gaps / equity |
| `community_impact` | BigQuery | public-access share, CO₂ avoided |
| `check_live_availability` | Google Places / sim | is this station free now |
| `check_charger_status` · `search_manual_embeddings` · `predict_charging_demand` | MCP toolbox | telemetry · RAG manuals · ARIMA_PLUS forecast |

## Run it locally

**Prerequisites:** Python 3.10+, Node 18+, and Google Cloud ADC for live data
(`gcloud auth application-default login`; BigQuery + Vertex AI access).

```bash
# 1) Build the React frontend (served by Flask from ../dist)
cd frontend && npm install && npm run build && cd ..

# 2) Run the app (serves the built UI + APIs + streaming agent)
python3 agent.py            # → http://localhost:8090

# Offline checks (compilation + agent evaluation, no cost)
make check
```

**Frontend dev mode (hot reload):** run `python3 agent.py` (8090) in one terminal and
`cd frontend && npm run dev` (5173) in another — Vite proxies `/api` and `/chat` to Flask.

## Deploy (Cloud Run, single service, ~$0 idle)

```bash
gcloud builds submit --config cloudbuild.web.yaml      # build + push image
gcloud run deploy ev-charge-web \
  --image gcr.io/$PROJECT_ID/ev-charge-web:latest \
  --region us-central1 --max-instances 1 --allow-unauthenticated
```

## Cost & safety

- **$0 idle:** Cloud Run scales to zero; `--max-instances 1` bounds spend.
- **Hard app caps:** paid endpoints rate-limited (chat/route + Places `poi`/`live` 50/day).
- **Places toggle:** `make places-on` (real POIs, paid) / `make places-off` (simulated, free).
- **Backstops:** GCP budget alert + Maps daily quota; honest 429 handling + retry/backoff.

## Project layout

- `agent.py` — Flask app: agent (ADK/Gemini), 10 tools, JSON APIs, SSE chat, serves `dist/`.
- `frontend/` — React + Vite + Leaflet UI (drive/charge simulation, plan/forecast cards, tabs).
- `Dockerfile.web` / `cloudbuild.web.yaml` — multi-stage build + Cloud Run deploy.
- `Makefile` — `make check` (gate), `make places-on/off` (cost toggle).
- `docs/submission/SUBMISSION.md` — hackathon submission checklist & deck content.
