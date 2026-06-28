# 📦 Submission Plan — Meet the Builders (Gen AI Academy APAC)

**Project:** EV-Charge Agent — AI Decision Intelligence for Smarter, Greener EV Charging across APAC
**Submission type:** Both (Blog + Video)
**Program opens:** mid-July 2026 (~Jul 15). Today: 2026-06-27 → ~2.5 weeks runway.

---

## 1. Deliverables checklist
- [ ] Public live demo URL (Cloud Run) — must stay up through judging
- [ ] YouTube demo video (2.5–3 min) — script in [VIDEO.md](VIDEO.md)
- [ ] Blog article (dev.to canonical) — draft in [ARTICLE.md](ARTICLE.md)
- [ ] Cross-post to Medium (Google Cloud Community)
- [ ] LinkedIn post (summary + links + video) with program hashtags
- [ ] Register for Gen AI Academy APAC Edition (prerequisite)
- [ ] Submit blog + video URLs on the official program page

## 2. Where to publish the article (ranked)
| Venue | Why | Role |
|---|---|---|
| **dev.to** | Dev audience, free, easy YouTube embed + code, strong SEO, tag `#googlecloud #gemini #ai #ev` | **Canonical / submit this URL** |
| **Medium — Google Cloud Community** | Google-ecosystem credibility, big reach (needs pub approval) | Cross-post (canonical link back to dev.to) |
| **LinkedIn** | Personal network + program visibility | Summary post linking dev.to + embedded video |

> Tip: set the dev.to post as canonical, then add `canonical_url` on Medium cross-post to avoid SEO duplication.

## 3. Timeline (to mid-July)
**Week 1 — Jun 27 → Jul 3 · Ship & freeze**
- Deploy full stack to Cloud Run (public URL), inject `GOOGLE_MAPS_API_KEY`, verify Tokyo (Google route) + Seoul (OSM) + agent trace + live status on the public URL.
- Freeze feature scope. Capture clean screenshots + a few real query results for the article.
- Register for Gen AI Academy APAC.

**Week 2 — Jul 4 → Jul 10 · Produce**
- Record the demo following [VIDEO.md](VIDEO.md) (screen + voiceover). Capture B-roll: APAC map zoom, agent reasoning trace, equity overlay, Tokyo Google routing.
- Edit to 2.5–3 min, add captions (EN), upload to YouTube (unlisted first for review).
- Write the article from [ARTICLE.md](ARTICLE.md); paste real numbers/screenshots; embed the YouTube video.
- Internal review pass (accuracy, claims, links).

**Week 3 — Jul 11 → Jul 15 · Publish & submit**
- Publish YouTube (public). Publish dev.to article. Cross-post Medium.
- LinkedIn post (draft below) tagging peers, `#MeetTheBuilders #GenAIAcademy #GoogleCloud`.
- Submit blog + video URLs on the program page once it opens.

## 4. LinkedIn post (draft)
> 🚗⚡ I built **EV-Charge Agent** for #MeetTheBuilders (Gen AI Academy APAC) — an AI decision-intelligence platform that helps EV drivers AND city planners across Asia-Pacific make smarter, greener charging decisions.
>
> Ask it in plain language and a **Gemini agent (Google ADK)** decides which data to pull: 7,800+ real APAC stations (BigQuery geospatial), **demand congestion forecasts (BigQuery ML ARIMA_PLUS)**, live availability, and Google Maps routing — then explains *why*, factoring in your car's connector, battery and range.
>
> It even maps **charging deserts** (underserved areas) and estimated CO₂ avoided — decision intelligence for the whole community.
>
> 📹 Demo: <YouTube link>  ·  ✍️ How I built it: <dev.to link>
> Built on Google Cloud: Gemini · ADK · BigQuery (Geospatial + ML) · Cloud Run · Google Maps.
> #MeetTheBuilders #GenAIAcademy #GoogleCloud #Gemini #EV #SmartCity

## 5. Links to fill in before submitting
- Live demo: `https://ev-charge-web-…run.app`
- GitHub repo: `<url>`
- YouTube: `<url>`
- dev.to: `<url>`  · Medium: `<url>`  · LinkedIn: `<url>`
