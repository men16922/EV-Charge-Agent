# 🎥 VIDEO.md — Demo Video Script (Meet the Builders submission)

**Length:** 2:45–3:00 · **Audience:** Gen AI Academy APAC judges · **Narration:** English (add EN captions)
**One-liner:** *A Gemini agent that decides — not just shows — where to charge, for your car, your city, the planet.*
**Goal:** prove it's an agentic, explainable Decision-Intelligence platform on Google Cloud (not a map lookup).

> Detailed Korean shot-by-shot beats also exist in [VIDEO_DEMO.md](VIDEO_DEMO.md). This file is the submission-ready cut.

---

## Pre-record checklist
- [ ] Use the **public Cloud Run URL** (not localhost). `GOOGLE_MAPS_API_KEY` set in Cloud Run.
- [ ] Browser fullscreen, 100% zoom, notifications off, fresh reload (clear chat).
- [ ] Rehearse once: Seoul recommend → Tokyo Google route → Equity → CO₂ chat.
- [ ] Screen recorder + mic; capture a few extra seconds around each click for editing.

---

## Scene 1 — Hook (0:00–0:20)
**Screen:** Full APAC map, 7,842 station pins clustering in. Pan briefly over Korea/Japan.
**VO:** "Every EV map shows you where chargers are. But the real question is harder — *which one can my car reach right now, fits my plug, is free, and won't be busy when I arrive?* That's a decision. Meet **EV-Charge Agent**, built on Google Cloud."

## Scene 2 — Car-first setup (0:20–0:40)
**Screen:** Point to KPI strip (7,842 stations · public share · ~26,921 t CO₂/yr). Select city **Seoul** → IONIQ 5 auto-loads, battery slider to ~20% (range ~86 km).
**VO:** "Pick a city and it loads a representative local EV — here, a Hyundai IONIQ 5 at 20% battery. Because charging decisions depend on *your car* — its connector and range."

## Scene 3 — The agentic core ⭐ (0:40–1:35)
**Screen:** Type in chat: *"Find a fast charger near me that won't be busy soon, and explain why."* Let the **🧠 Agent reasoning · tools called** trace appear; zoom in on it. Then show the recommendation cards (BEST + badges: 🟢 free · your plug · reachable) and the route drawn on the map.
**VO:** "One sentence, and the Gemini agent — using Google's Agent Development Kit — decides which data to pull: BigQuery geospatial to find stations, **BigQuery ML to forecast congestion**, and Google Maps to route. You can *see* it reason. Then it recommends the best charger for this car and explains why — distance, connector match, and whether it'll be busy soon."
**Wow:** pause on the tools-called trace + the predictive 'won't be busy' logic.

## Scene 4 — Connector matching is real (1:35–1:55)
**Screen:** Switch vehicle to **Toyota bZ4X (CHAdeMO)**, Recommend → the ⚠️ *"no CHAdeMO-compatible chargers in range"* warning. Switch back to IONIQ 5 → compatible CCS stations rank first.
**VO:** "It won't send a CHAdeMO car to a Tesla plug. Incompatible chargers are filtered out — and if nothing fits, it says so honestly."

## Scene 5 — Google Maps routing, region-aware (1:55–2:15)
**Screen:** Select **Tokyo** → Recommend → route box shows **"via Google Maps"** with accurate ETA. Note Seoul showed "via OpenStreetMap".
**VO:** "In Tokyo, routing uses the Google Maps Routes API with live traffic. Where Google can't route — like Korea — it falls back to OpenStreetMap automatically. Seamless across APAC."

## Scene 6 — Community & sustainability ⭐ (2:15–2:40)
**Screen:** Toggle **🌍 Equity view** (zoom out a touch) → red charging-desert grid + desert % KPI. Then chat: *"Where are the charging deserts near me, and how much CO₂ does this network avoid?"* → trace shows community_impact + find_charging_deserts.
**VO:** "It's not just for drivers. The same agent maps **charging deserts** — underserved areas for city planners — and estimates the CO₂ this network helps avoid. Decision intelligence for the whole community."

## Scene 7 — Close (2:40–3:00)
**Screen:** Wide shot; point to header stack tags.
**VO:** "All on Google Cloud — Gemini and the Agent Development Kit, BigQuery Geospatial and ML, Cloud Run, and Google Maps. From one car's next charge to a city's next decision. EV-Charge Agent — AI for better living and smarter communities."
**End card:** demo URL · GitHub · `#MeetTheBuilders #GenAIAcademy #GoogleCloud`

---

## Must-hit wow moments (priority)
1. 🧠 **Agent reasoning trace** — proves it's agentic (most important).
2. **Predictive "won't be busy"** — live + ARIMA_PLUS forecast.
3. **Real connector matching** (CHAdeMO 0-match honesty).
4. **Charging deserts / equity** — community + theme fit.
5. **Google Maps hybrid routing** (Tokyo Google ↔ Seoul OSM).

## Editing tips
- Freeze ~1.5s on the tools-called trace; add a subtle highlight box.
- Keep battery low (15–20%) so reachability logic looks meaningful.
- Trim long agent replies; keep the trace chips legible.
- Show the "simulated" label on live status — honesty builds trust.
- Burn in EN captions; keep VO calm and concrete.
