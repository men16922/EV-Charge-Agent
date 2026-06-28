# EV-Charge Agent: An AI Decision-Intelligence Platform for Smarter, Greener Charging across APAC

> Built for **Meet the Builders · Gen AI Academy (APAC Edition)** — using Google AI to solve a real, local problem.
> 🔗 Live demo: `<demo-url>` · 📹 Video: `<youtube-url>` · 💻 Code: `<github-url>`

*(Embed the YouTube demo here)*

---

## The real question isn't "where is a charger?"

If you drive an EV in Seoul, Tokyo, or Jakarta, you don't actually need a map of every charging station — Google Maps already has that. The question that causes range anxiety is harder:

> *"Which charger can my car actually reach right now, fits my plug, is free, and won't be jammed by the time I arrive?"*

That's not a lookup. That's a **decision** — and it depends on your car, the live state of the grid, and the near future. So I built an agent that makes that decision for you, and explains why.

**EV-Charge Agent** is an AI Decision-Intelligence platform for EV drivers *and* city stakeholders across Asia-Pacific. It runs entirely on Google Cloud.

## What it does

Ask in plain language — *"Find a fast charger near me that won't be busy soon"* — and a **Gemini agent (Google ADK)** decides which data tools to call:

- 🔌 **Find nearby stations** — 7,800+ real APAC charging stations (Open Charge Map) in **BigQuery**, queried with **geospatial SQL** (`ST_DWITHIN`, `ST_DISTANCE`).
- 📈 **Forecast congestion** — **BigQuery ML ARIMA_PLUS** predicts upcoming charging demand, so the agent steers you away from soon-to-be-busy sites.
- 🧭 **Route + ETA** — **Google Maps Routes API** (traffic-aware) where supported, with automatic OpenStreetMap fallback for regions Google can't route (e.g. South Korea).
- 🟢 **Live availability** — simulated live plug status with a Google Places real-time fallback.

Then it ranks the options **for your specific car** and explains the trade-off.

## Car-first decisions

EV charging is decided by the *vehicle*. Pick a car (the demo auto-selects a representative model per APAC city — Hyundai IONIQ 5 in Seoul, Toyota bZ4X in Tokyo, BYD Atto 3 in Bangkok, Tata Nexon EV in Mumbai…) and the app uses its:

- **Connector** (CCS / CHAdeMO / Tesla-NACS) — only **compatible** chargers are recommended. A CHAdeMO car in Gangnam correctly sees *"0 compatible chargers in range"* instead of being sent to a Tesla Supercharger.
- **Battery % → range** — each option is flagged ✅ reachable / ⚠️ tight / ❌ out of range.

*(Screenshot: My EV panel + recommendation cards with "your plug" / reachable badges)*

## Explainable, agentic by design

This is the part judges should watch. Every chat reply shows a **"🧠 Agent reasoning · tools called"** trace — you literally see Gemini decide to hit BigQuery geospatial, then ARIMA_PLUS forecasting, then routing, before answering. The recommendation always states the *why* in three factors: distance/reachability, power & connector fit, and predicted congestion. That's **Responsible & Explainable AI**, not a black box.

*(Screenshot: agent reasoning trace in chat)*

## Not just convenience — community intelligence

The same engine serves **city stakeholders**:

- 🌍 **Charging deserts (equity map)** — a BigQuery geospatial grid shades areas by distance to the nearest charger, surfacing **underserved neighborhoods**. Accessibility and inclusive-community planning, from open data.
- 🌱 **Community impact KPIs** — total stations, **public-charger share**, and **estimated CO₂ avoided per year** across the network.

This is what "AI for Better Living and Smarter Communities" looks like in practice: one platform that helps an individual driver *and* informs where a city should build next.

*(Screenshot: equity overlay + KPI strip)*

## Architecture

```
Browser (Leaflet map + chat)
        │  REST / /chat
        ▼
Flask app on Cloud Run  ──►  Gemini 2.5 Flash via Vertex AI (Google ADK agent)
   │  tools (FunctionTool + MCP)
   ├─ find_nearby_stations     → BigQuery  ev_charging_stations (GEOGRAPHY)
   ├─ predict_charging_demand  → BigQuery ML  ARIMA_PLUS
   ├─ plan_route               → Google Maps Routes API → OSRM fallback
   ├─ check_live_availability  → Google Places → simulated fallback
   ├─ find_charging_deserts    → BigQuery geospatial grid
   └─ community_impact         → BigQuery aggregates
```

- **Data:** Open Charge Map → BigQuery (`ev_charging_stations`, GEOGRAPHY column) across 13 APAC countries.
- **Serverless & cheap:** Cloud Run scales to zero; BigQuery stays in the free tier. Idle cost ≈ \$0.
- **Stack:** Vertex AI · Gemini · Google ADK · BigQuery (Geospatial + ML) · Cloud Run · Google Maps · Leaflet.

## What I learned / gotchas

- **Google Maps doesn't route driving in South Korea** (data-export regulation) — a hybrid router with OSM fallback keeps the experience seamless region to region.
- **Connector matching has to be real**, not cosmetic — ranking compatible plugs first (and honestly reporting zero matches) is what makes the recommendation trustworthy.
- **White cars on white backgrounds** are a surprisingly hard image problem — ML background removal (rembg) beat every threshold heuristic.

## Try it

- 🔗 Live: `<demo-url>` — pick an APAC city, set your battery, hit **Recommend**.
- 📹 Demo video: `<youtube-url>`
- 💻 Code: `<github-url>`

Built with ❤️ on Google Cloud for **Meet the Builders — Gen AI Academy APAC**.
`#MeetTheBuilders #GenAIAcademy #GoogleCloud #Gemini #EV #SmartCity`
