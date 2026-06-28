# 🎬 유튜브 데모 스크립트 — FINAL (Meet the Builders · Gen AI Academy APAC)

> **언어 정책:** VO(음성 내레이션)만 영어(+영어 번인 자막), 나머지 문서·화면지시·하단자막은 한글.

**제목(YouTube):** EV-Charge Agent — 내 차·도시·지구를 위해 충전소를 *결정해주는* Gemini 에이전트 (Google Cloud, APAC)
**길이:** 2:50 · **내레이션:** 영어 + 영어 번인 자막 · **화면:** 1080p, 16:9
**라이브 데모:** https://ev-charge-web-1004528040791.us-central1.run.app
**한 줄 요약:** *모든 EV 지도는 충전소가 "어디 있는지" 보여준다. 이 Gemini 에이전트는 내 차가 실제로 가야 할 곳을 결정하고, 그 이유까지 보여준다.*

**심사 포인트 (촬영 내내 의식할 것):**
1. **진짜 APAC 문제** — 주행거리 불안 + 충전 사각지대, 그리고 지역 특수성(한국은 Google Maps 운전 경로가 안 나옴).
2. **진짜 agentic한 Google AI** — Gemini + ADK가 도구를 실시간으로 고르는 장면을 화면에 노출(추론 트레이스가 핵심 샷).
3. **커뮤니티 임팩트** — 충전 사각지대 형평성 지도 + CO₂ 절감("AI for Better Living & Smarter Communities").

---

## 촬영 전 체크리스트
- [ ] **공개 Cloud Run URL** 사용(로컬호스트 금지). Cloud Run에 `GOOGLE_MAPS_API_KEY` 설정 확인.
- [ ] 브라우저 전체화면, 100% 줌, 알림 끄기, 채팅 비우기, 새로고침.
- [ ] 배터리 슬라이더 **약 18–20%**로 고정 → 도달 가능성 배지가 의미 있게 보이도록.
- [ ] 리허설 1회: 서울 추천 → 추론 트레이스 → CHAdeMO 0매칭 → 도쿄 Google 경로 → 형평성 + CO₂.
- [ ] 클릭마다 앞뒤 몇 초 여유 녹화(편집 여유분).

---

## 씬 1 — 훅 · 진짜 질문 (0:00–0:22)
**화면:** APAC 전체 지도, 7,842개 충전소 핀이 클러스터링되며 등장. 한국 → 일본 → 동남아로 천천히 팬.
**하단자막:** `실제 충전소 7,842개 · APAC 13개국 · Open Charge Map → BigQuery`
**VO (영어):**
> "Every EV map shows you *where* the chargers are. But the question that actually causes range anxiety is harder — *which one can my car reach right now, fits my plug, is free, and won't be jammed by the time I arrive?* That's not a lookup. That's a decision. This is **EV-Charge Agent**, built on Google Cloud."

## 씬 2 — 차 중심 설정 (0:22–0:42)
**화면:** KPI 스트립(충전소 수 · 공공 충전소 비율 · 연 ~26,921t CO₂) 가리키기. **서울** 선택 → IONIQ 5 자동 로드 → 배터리 ~20%로 드래그(주행거리 ~86km).
**하단자막:** `충전 결정은 차에 달려 있다 — 커넥터·배터리·주행거리`
**VO (영어):**
> "Pick a city and it loads a representative local EV — here a Hyundai IONIQ 5 at twenty percent. Because a charging decision depends on *your* car: its connector, its battery, how far it can actually go."

## 씬 3 — Agentic 코어 ⭐ (0:42–1:35)
**화면:** 채팅 입력: *"Find a fast charger near me that won't be busy soon, and explain why."* **🧠 Agent reasoning · tools called** 트레이스가 뜨는 동안 **줌 + 하이라이트 박스, 약 2초 정지.** 이어서 추천 카드(BEST + 배지: 🟢 빈자리 · 내 플러그 · 도달가능) 와 지도에 그려지는 경로 노출.
**하단자막:** `Gemini 2.5 Flash + Google ADK · 실시간 도구 호출: BigQuery Geo → BigQuery ML → Maps`
**VO (영어):**
> "One sentence — and the Gemini agent, using Google's Agent Development Kit, decides which data to pull. BigQuery geospatial to find stations, **BigQuery ML to forecast congestion**, Google Maps to route. You can literally *watch it reason*. Then it picks the best charger for this car and tells you why — distance, plug match, and whether it'll be busy soon."
**편집 노트:** 이 트레이스가 영상에서 가장 중요한 프레임. 반드시 또렷하게.

## 씬 4 — 정직한 커넥터 매칭 (1:35–1:55)
**화면:** 차량을 **Toyota bZ4X (CHAdeMO)**로 전환 → 추천 → ⚠️ *"no CHAdeMO-compatible chargers in range"* 경고. 다시 **IONIQ 5**로 → 호환 CCS 충전소가 상위 정렬.
**하단자막:** `진짜 커넥터 매칭 — 거짓말하지 않는다`
**VO (영어):**
> "It won't send a CHAdeMO car to a Tesla plug. Incompatible chargers are filtered out — and when nothing fits, it says so honestly instead of faking a result."

## 씬 5 — 지역 인식형 Google Maps 라우팅 (1:55–2:15)
**화면:** **도쿄** 선택 → 추천 → 경로 박스에 **"via Google Maps"** + 실시간 교통 ETA 표시. 서울에서는 **"via OpenStreetMap"** 이었음을 자막으로 콜백.
**하단자막:** `지원 지역은 Google Maps Routes API · 미지원 지역(예: 한국)은 OSM 폴백`
**VO (영어):**
> "In Tokyo, routing uses the Google Maps Routes API with live traffic. But Google Maps can't route driving inside South Korea — a data-export rule — so there it falls back to OpenStreetMap automatically. Seamless, right across Asia-Pacific."

## 씬 6 — 커뮤니티 & 지속가능성 ⭐ (2:15–2:38)
**화면:** **🌍 형평성 보기** 토글, 살짝 줌아웃 → 빨간 충전 사각지대 그리드 + 사각지대 % KPI. 이어 채팅: *"Where are the charging deserts near me, and how much CO₂ does this network avoid?"* → 트레이스에 `find_charging_deserts` + `community_impact` 노출.
**하단자막:** `충전 사각지대(형평성) + CO₂ 절감 — 도시 계획가를 위한 의사결정 인텔리전스`
**VO (영어):**
> "And it isn't only for drivers. The same agent maps **charging deserts** — the underserved neighborhoods a city should build in next — and estimates the CO₂ this network helps avoid. Decision intelligence for the whole community."

## 씬 7 — 마무리 (2:38–2:50)
**화면:** 대시보드 와이드샷, 헤더의 스택 태그 가리키기. 엔드카드로 컷.
**VO (영어):**
> "All on Google Cloud — Gemini and the Agent Development Kit, BigQuery Geospatial and ML, Cloud Run, Google Maps. From one car's next charge to a city's next decision. **EV-Charge Agent.**"
**엔드카드(4초 정지):**
`Live demo: ev-charge-web-1004528040791.us-central1.run.app`
`Code: <github-url>  ·  #MeetTheBuilders #GenAIAcademy #GoogleCloud`

---

## 유튜브 설명문 (영상 아래 붙여넣기 — 국제 심사용이라 영어 유지 권장)
> A Gemini agent that *decides* where your EV should charge — for your car, your city, and the planet. Built on Google Cloud for **Meet the Builders (Gen AI Academy APAC)**.
>
> Ask in plain language and a Gemini agent (Google ADK) chooses which data to pull: 7,842 real APAC charging stations (Open Charge Map → BigQuery geospatial), congestion forecasts (BigQuery ML ARIMA_PLUS), live availability, and Google Maps routing — then explains *why*, factoring in your car's connector, battery and range. It also maps charging deserts and estimated CO₂ avoided for city planners.
>
> 🔗 Live demo: https://ev-charge-web-1004528040791.us-central1.run.app
> 💻 Code: <github-url>  ·  ✍️ Write-up: <blog-url>
> Stack: Gemini 2.5 Flash · Google ADK · Vertex AI · BigQuery (Geospatial + ML) · Cloud Run · Google Maps · Leaflet.
> #MeetTheBuilders #GenAIAcademy #GoogleCloud #Gemini #EV #SmartCity #APAC

## 촬영 / 편집 팁
- 씬 3 추론 트레이스에서 약 2초 정지 + 은은한 하이라이트 박스 — agentic하다는 증거이므로 최우선.
- 배터리 15–20% 유지 → 도달 가능성 배지가 의미 있게 보임.
- 긴 에이전트 답변은 잘라내고, 도구 호출 칩은 가독성 있게.
- 라이브 상태의 "simulated" 라벨은 그대로 노출 — 정직함이 심사 신뢰도로 읽힘.
- VO는 차분하고 구체적으로. 과장 표현 없이 트레이스가 말하게.
- 먼저 **비공개(unlisted)** 업로드 → 내부 검수 → 제출 직전 **공개(public)** 전환.

---

> **참고:** 하단자막·엔드카드·제목을 영어로 통일하고 싶으면(국제 심사 일관성) 말씀해 주세요. 현재는 "음성 외 한글" 요청에 맞춰 화면 텍스트를 한글로 두되, 발행 설명문만 영어로 유지했습니다.
