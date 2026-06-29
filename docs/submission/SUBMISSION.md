# Smart-EV Agent — 해커톤 프로토타입 제출

> Gen AI Academy APAC Edition · **Hackathon Prototype Submission**
> 제출 기간: 2026-06-29 19:31 IST → **2026-07-07 03:29 IST** (약 7일). 모든 링크는 공개 접근 가능해야 함.

---

## 1) 제출 폼 항목 (포털에 입력)

| 항목(필수) | 값 / 상태 |
| --- | --- |
| **Challenge** | ⚠️ *포털에서 선택.* 적합: AI 에이전트 / 지속가능·스마트시티 on Google Cloud. |
| **Project Deployment Link** | `https://ev-charge-web-1004528040791.us-central1.run.app` — ✅ **새 React 앱 배포 완료** (rev 00004-265, 2026-06-29). 실제 Places 데이터 포함. |
| **Project PPT (PDF ≤5MB)** | ⬜ 템플릿 채우고 PDF로 내보내기. 슬라이드 내용은 §3. |
| **GitHub Repository Link** | `https://github.com/men16922/EV-Charge-Agent` — ⚠️ **현재 작업 푸시** + repo **public** 전환 (원격엔 초기 커밋만). |
| **Demo Video Link (≤3분)** | ⬜ `docs/submission/youtube_final.mp4`(2:02) 업로드. ⚠️ **신기능으로 재촬영** (현재 컷은 옛 UI). |
| **Brief Description (≤1024자)** | ✅ 완성 — §2 그대로 붙여넣기. |

---

## 2) Brief Description (포털 붙여넣기용 · 영문 · ~990자)

```
Smart-EV Agent is an AI decision-intelligence copilot for EV drivers and city
stakeholders across APAC, built end-to-end on Google Cloud. It combines 7,842 real
charging stations (Open Charge Map in BigQuery, geospatial GEOGRAPHY), BigQuery ML
(ARIMA_PLUS) demand forecasting, and a Gemini 2.5 Flash agent (Vertex AI + ADK) with
10 tools, plus Google Maps Routes/Places and a React dashboard on Cloud Run. It
doesn't just find a plug: it recommends the best charger by distance, connector match,
live availability and predicted congestion; plans multi-stop trips; suggests what to
do while charging (walkable POIs); and visually simulates the autonomous drive + charge
on the map with a TURBO fast-forward. Every recommendation is explainable, the UI is
bilingual (EN/KO), and hard cost guards keep the public demo at ~$0 idle. It targets
APAC-specific gaps: charging deserts & equity, connector fragmentation, and regions
Google can't route (automatic OSRM fallback).
```

---

## 3) PPT 슬라이드 내용 (템플릿 11장에 붙여넣기 · 심사용 영문)

> 국제 심사 기준이라 슬라이드 본문은 영어로 유지.

**Slide 1 — Participant Details**
- Participant Name: `<당신 이름>`
- Problem Statement: Sustainable & equitable EV charging + smart mobility for APAC communities, powered by a Gemini agent on Google Cloud.

**Slide 2 — Brief about the idea**
- An AI copilot that turns "where do I charge?" into a full smart-life plan: best charger → drive → charge → what to do meanwhile — explained, simulated, and grounded in real APAC data.

**Slide 3 — Solution / approach**
- *Google Cloud:* Gemini 2.5 Flash agent (Vertex AI + ADK) orchestrates 10 tools over BigQuery (7,842 OCM stations as GEOGRAPHY; ARIMA_PLUS forecasting), Google Maps Routes/Places, served from Cloud Run.
- *Real-world problem & impact:* EV anxiety isn't just range — it's *will the plug fit, be free, and be worth the trip?* We add equity (charging deserts), congestion foresight, and "use the charge time well," for drivers and city planners.
- *Core workflow:* user/EV context → agent reasons → geospatial + forecast + routing + POI tools → explainable recommendation → on-map autonomous drive+charge simulation.

**Slide 4 — Opportunities / USP**
- Beyond "find a charger" apps: **predictive** (BQML congestion), **explainable** (every "why"), **smart-life** (POIs while charging), and a **visual autonomous drive+charge simulation**. APAC-first: connector matching, charging-desert equity, OSRM fallback where Google can't route (e.g. Korea).

**Slide 5 — Features**
- Connector-aware charger recommendation (distance, power, live availability, reachability).
- Hybrid routing (Google Routes → OSRM fallback) with on-map drive animation + TURBO.
- Charging simulation (battery 20→80%, kW, minutes) synced to the EV panel.
- POI "smart-life" (find_pois_near) + multi-stop trip planning (plan_trip).
- Charging-desert / equity overlay; community CO₂ impact; BQML demand-forecast cards.
- Live agent reasoning trace; structured plan/forecast UI cards; bilingual EN/KO; cost guards.

**Slide 6 — Process flow / use-case diagram**
- Flow: *EV state → Agent (Gemini/ADK) → [geospatial | forecast | routing | POI] tools → Explainable plan → Map simulation.* (`docs/submission/ev-charge-agent-architecture.svg` 활용.)

**Slide 7 — Wireframes / mockups**
- 대시보드 스크린샷 삽입: 지도+사이드패널(My EV, Find charging, Trip), 플랜/예보 카드가 있는 채팅, 시네마틱 drive+charge 모달.

**Slide 8 — Architecture diagram**
- `docs/submission/ev-charge-agent-architecture.png` 삽입. Cloud Run (React + Flask) → Vertex AI (Gemini 2.5 Flash, ADK) → BigQuery (stations GEOGRAPHY, ARIMA_PLUS) + MCP toolbox; Google Maps Routes/Places; OSRM fallback.

**Slide 9 — Technologies / Google services**
- **Vertex AI + Gemini 2.5 Flash** (reasoning), **ADK** (tool orchestration), **BigQuery + BigQuery ML** (geospatial + ARIMA_PLUS), **Cloud Run** (single-service, scale-to-zero $0 idle), **Google Maps Routes/Places (New)**. *Why:* managed, serverless, scales to zero for cost; BQML keeps forecasting in-warehouse; ADK makes tools first-class & explainable.

**Slide 10 — Snapshots of the prototype**
- 삽입: (1) 추천+지도 경로, (2) drive+charge 시뮬 모달 80%, (3) "충전하는 동안 할 거리" POI, (4) 수요 예보 카드, (5) 충전 사각지대 equity 오버레이.

**Slide 11 — Closing / Thank you**
- Live URL · GitHub · 3-min demo. Tagline: *"Charge, drive & live smarter — your autonomous EV copilot for APAC."*

---

## 4) 제출 전 체크리스트 (이 순서대로)

- [x] **Cloud Run 새 React 빌드 재배포** — 완료(rev 00004-265). 라이브 URL이 새 Smart-EV 앱 서빙, Places 실데이터·0 에러 검증됨.
- [ ] **비용 가드(Places 유료 ON):** GCP **예산 알림 $20** + **Maps 일일 쿼터** 설정. 앱 캡은 이미 poi/live 50/일. (또는 `make places-off`로 $0 데모.)
- [ ] **GitHub public + 푸시:** `.env` ignore 유지(확인됨 ✓), 작업 커밋·푸시, repo **public** 전환. README에 라이브 URL + 실행법.
- [ ] **데모 영상(≤3분):** 현재 `youtube_final.mp4`는 옛 UI — 추천 → drive+charge 시뮬 → POI → trip → 예보 카드 순으로 재촬영. 업로드(비공개 → 검수 → 공개).
- [ ] **PPT → PDF(≤5MB):** §3 + 스크린샷 + 아키텍처 이미지로 템플릿 채우고 PDF 내보내기.
- [ ] **Challenge 옵션 선택.**
- [ ] **최종 링크 점검:** 배포 URL·GitHub·영상을 시크릿 창에서 열어 전부 공개·정상 확인.

---

## 5) 리스크 / 메모

- ⚠️ **가장 큰 블로커: 배포 불일치.** 현재 라이브 URL은 **옛 바닐라 UI**(rev 00003). 새 React 앱 **재배포** 필수. 영상도 옛 UI라 **재촬영** 필요.
- ⚠️ **GitHub:** 원격엔 초기 커밋만 → 이번 작업 푸시 + **public**. `.env`는 ignore 확인됨(키 유출 X).
- 데모 영상 **3분 이하** 규칙 — 기존 2:02 길이는 OK, 내용만 신버전으로 교체.
- 솔로 제출 가능 여부는 포털 규칙 확인.
