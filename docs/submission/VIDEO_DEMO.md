# 🎬 EV-Charge Agent — YouTube Demo Script

**목표 길이**: 2분 30초 ~ 3분 (해커톤 심사용)
**핵심 메시지**: "단순 충전소 찾기"가 아니라, **Gemini 에이전트가 실데이터·예측·경로를 스스로 판단해 더 나은 결정을 내려주는 Decision Intelligence Platform.**
**주제 정합성**: *AI for Better Living and Smarter Communities* — 개인(운전자) + 커뮤니티(도시·형평성·환경) 동시 공략.

---

## 0. 사전 준비 (녹화 전 체크리스트)
- [ ] 서버/배포 URL 접속 확인, `make check` 통과
- [ ] 브라우저 풀스크린, 알림/탭 정리, 줌 100%
- [ ] 채팅 히스토리 비우기(새로고침)
- [ ] 데모 동선 1회 리허설 (특히 Tokyo Google 라우팅, Equity 토글)
- [ ] 화면 녹화 + 마이크 레벨 체크. 자막(영문) 준비 권장
- [ ] 백업: 인터넷 끊김 대비 로컬 서버도 준비

---

## 1. 훅 — 문제 제기 (0:00 ~ 0:20)
> 🎙️ *"EV 운전자에게 진짜 질문은 '충전소가 어디 있나'가 아닙니다. '내 차로 갈 수 있고, 내 플러그가 맞고, 지금 비어 있고, 곧 안 붐빌 곳이 어디냐'입니다. 구글맵은 위치만 답하죠. 우리는 그 결정을 대신 내려줍니다."*

**화면**: 헤더 "EV-Charge Agent" + APAC 전역 지도에 **7,842개 실충전소 핀**이 클러스터로 쫙. (스케일 임팩트)

🌟 **Wow #1 — 스케일**: "Open Charge Map 실데이터, APAC 13개국 7,842개 충전소가 BigQuery에 들어가 있습니다."

---

## 2. 차 중심 셋업 (0:20 ~ 0:40)
**행동**:
1. 상단 KPI 스트립 가리키기 (충전소 수 · 공공개방 74.6% · CO₂ 26,921톤/년)
2. "Jump to APAC city" → **Seoul** 선택 → 🚗 차 마커 + 대표 차종 **Hyundai IONIQ 5(CCS)** 자동 세팅
3. 배터리 슬라이더를 **20%로** 내림 → "range 86 km"

> 🎙️ *"도시를 고르면 그 지역 대표 EV가 자동 세팅됩니다 — 서울은 아이오닉 5. 배터리 20%, 주행가능 86km로 시작하죠."*

🌟 **Wow #2 — Car-First**: "충전 결정은 결국 '차'가 결정합니다. 커넥터(CCS)와 잔여거리가 추천에 그대로 반영됩니다."

---

## 3. 핵심 — AI 에이전트 추론 (0:40 ~ 1:30) ⭐ 하이라이트
**행동**: 채팅에 입력 →
> `Find a fast charger near me that won't be busy soon, and explain why`

**화면에서 강조할 것 (순서대로 등장)**:
1. 💬 **🧠 Agent reasoning · tools called** 트레이스 등장:
   - 🔌 Searched live APAC stations (BigQuery **geospatial**)
   - 📈 Forecast congestion (BigQuery ML **ARIMA_PLUS**)
   - 🧭 Computed driving route & ETA (Google Maps / OSM)
2. 우측 추천 카드 — **BEST** + 배지들: `🟢 3/4 free`(라이브) · `📍 0.9km` · `⚡250kW` · `🔌 your plug`(커넥터 매치) · `✅ reachable`(도달가능)
3. 지도에 **경로선 + ETA 박스** 자동 표시
4. 채팅 답변에 **"왜"** 3요인(거리/도달성 · 전력·커넥터 매치 · 곧 붐빌지 예측) 설명

> 🎙️ *"한 문장에 에이전트가 세 개의 데이터 도구를 스스로 호출합니다 — BigQuery 지오스페이셜로 근처를 찾고, ARIMA_PLUS로 미래 혼잡을 예측하고, 경로를 계산합니다. 그리고 '왜 이 충전소인지'를 설명하죠."*

🌟 **Wow #3 — 에이전트가 보이는 추론**: 트레이스가 "그냥 앱"이 아니라 **agentic AI**임을 증명.
🌟 **Wow #4 — 예측 의사결정**: "지금 비어있고(라이브) + 곧 안 붐빌(예측) 곳" — 구글맵이 못 하는 미래 기반 결정.

---

## 4. Google Maps 정확 라우팅 (1:30 ~ 1:55)
**행동**: 도시 → **Tokyo** 선택 (차종 자동 bZ4X/CHAdeMO로 전환) → Recommend
**화면**: 지도 우상단 경로 박스에 **`via Google Maps`** + 정확한 ETA(교통 반영). (서울은 `via OpenStreetMap` 폴백)

> 🎙️ *"도쿄에서는 Google Maps Routes API로 교통까지 반영한 정확한 ETA를. 한국처럼 구글이 운전경로를 막아둔 곳은 OpenStreetMap으로 자동 폴백 — 어디서든 끊기지 않습니다."*

🌟 **Wow #5 — 하이브리드 라우팅**: 지역 제약을 우아하게 자동 처리 + 차종도 지역따라 전환(글로벌 일관성).

---

## 5. 공공·커뮤니티 임팩트 (1:55 ~ 2:25) ⭐ 주제 정합성
**행동**:
1. **🌍 Equity View** 토글 → 지도에 커버리지 격자 (초록=촘촘, 빨강=**충전 사각지대**) + KPI에 사각지대% 갱신
2. 채팅: `How much CO2 does this network help avoid, and where are the charging deserts?`
   - 트레이스: 🌱 community_impact + 🌍 find_charging_deserts
   - 답변: "APAC 26,921톤 CO₂/년 절감", "이 지역 56% 사각지대"

> 🎙️ *"운전자뿐 아니라 도시를 위한 도구이기도 합니다. 어느 동네가 충전 인프라 부족한지(charging desert), 이 네트워크가 연간 얼마의 CO₂를 줄이는지 — 정책 결정자를 위한 인사이트까지 같은 에이전트가 답합니다."*

🌟 **Wow #6 — Better Living & Smarter Communities**: 형평성·환경·도시계획 = 주제 키워드 정면 명중. Explainable AI까지.

---

## 6. 마무리 — 기술 스택 & 클로징 (2:25 ~ 2:45)
**화면**: 헤더 태그 "Gemini · BigQuery ML · ADK · Google Maps" 가리키기, 전체 화면 한 컷.

> 🎙️ *"전부 Google Cloud 위에서 돌아갑니다 — Gemini + Agent Development Kit, BigQuery 지오스페이셜과 ARIMA_PLUS ML, Cloud Run 서버리스, Google Maps. 실데이터로, 차 한 대의 결정부터 도시 전체의 형평성까지. EV-Charge Agent였습니다."*

---

## 🏆 심사 기준 매핑 (영상에 자연스럽게 녹일 포인트)
| 주제/기술 키워드 | 영상 속 증거 장면 |
|---|---|
| Decision Intelligence Platform | 추천 + "왜" 설명 (Sec 3) |
| Natural language interface | 채팅 질의 (Sec 3, 5) |
| Predictive analytics & forecasting | ARIMA_PLUS 혼잡 예측 (Sec 3) |
| LLM + agentic (ADK) | 🧠 tools-called 트레이스 (Sec 3) |
| Responsible & Explainable AI | "왜 이 충전소" 3요인 (Sec 3) |
| Urban mobility / Energy / Smart utilities | 추천·라우팅·수요예측 (Sec 3-4) |
| Accessibility & inclusive communities | Equity / charging deserts (Sec 5) |
| Environmental sustainability | CO₂ 절감 KPI (Sec 2, 5) |
| Google Cloud 스택 | 클로징 (Sec 6) |

## 🎯 절대 빠지면 안 되는 5대 Wow 모먼트 (우선순위)
1. **🧠 에이전트 추론 트레이스** — agentic AI 증명 (가장 중요)
2. **예측 기반 결정** — "지금 비어있고 + 곧 안 붐빌" (차별점)
3. **차종 기반 + 라이브 + 도달가능성 + 커넥터 매치** 한 카드에
4. **충전 사각지대(Equity)** — 커뮤니티/주제 정합성
5. **Google Maps 하이브리드 라우팅** (도쿄=Google, 서울=OSM 폴백)

## 💡 촬영 팁
- 트레이스(🧠)가 뜨는 순간 **잠깐 멈추고 확대** — 심사 임팩트 핵심.
- 배터리를 **낮게(15~20%)** 두면 도달가능성/추천 로직이 더 드라마틱.
- Equity View는 **줌아웃 상태**에서 켜야 빨간 사각지대가 잘 보임.
- 답변이 길면 편집으로 빠르게. 트레이스 칩은 또렷이 보이게.
- 라이브 배지(🟢 free)는 'simulated' 라벨이 보이게 — 정직함이 신뢰를 줌.
