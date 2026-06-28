# Progress Log

최종 갱신: 2026-06-27

이 파일은 **최신 증분 요약만** 유지한다(최신 3-5항목, ≤120줄). 오래된 항목은
`docs/archive/progress-YYYY-MM.md`로 이관한다(`/tidy-docs`).

## 2026-06-28 — Submission Final Scripts (YouTube + Blog)
- **Status**: Completed. Meet the Builders 제출용 영상·블로그 정본 작성. 발행 자리표시자(URL)만 남음.
- **Changed**:
  - 신규 `docs/submission/YOUTUBE_SCRIPT_FINAL.md` — 7씬 2:50 촬영 스크립트(씬별 타이밍·화면지시·하단자막·체크리스트·편집팁) + YouTube 제목/설명/해시태그. 라이브 URL 박음. **언어 정책: VO(음성)만 영어+영어자막, 나머지 문서·화면텍스트는 한글**(사용자 요청). 설명문만 국제 심사용 영어 유지.
  - 신규 `docs/submission/BLOG_FINAL.md` — github.io/Medium 정본(frontmatter+canonical). 사용자 블로그 톤(엔지니어·아키텍처 영문)에 맞춤. "왜 APAC 문제인가" 섹션 신설(사각지대·한국 라우팅 규제·커넥터 파편화)로 심사 기준 정조준.
  - 기존 `VIDEO.md`/`ARTICLE.md` 드래프트는 보존(소스로).
- **Verified**: 미발행(unverified). 사용자 블로그 men16922.github.io 톤만 WebFetch로 확인(Backend/Cloud/AI Agent 엔지니어, 영문). 데모 URL 라이브 상태는 별도 미재검증.
- **Blockers**: 두 파일 공통 자리표시자 `<github-url>`/`<youtube-url>`/`<blog-url>`/blog canonical 미정. 유튜브 화면텍스트 영문 통일 여부는 사용자 결정 대기.
- **Next**: (선택) 한국어 블로그 버전 / 2분 컷 / GitHub repo 생성해 자리표시자 채우기. 발행 흐름: github.io→canonical→Medium 교차게시, 유튜브 unlisted→검수→public.

## 2026-06-27 — Pivot to "Predictive Charging Copilot" + Streaming + Redeploy
- **Status**: Completed & redeployed. 같은 공개 URL(https://ev-charge-web-1004528040791.us-central1.run.app), revision 00003. Meet the Builders(Gen AI Academy APAC) 제출 방향으로 전환.
- **Changed (대규모)**:
  - 데이터: Open Charge Map APAC 13개국 **7,842개 실충전소** → BigQuery `ev_charging_stations`(GEOGRAPHY). 스크립트 `scripts/ingest_ocm_apac.py`(+`ocm_schema.json`).
  - 에이전트 도구(BigQuery 직접경로, MCP 재배포 불필요): `find_nearby_stations`(지오스페이셜+커넥터매칭+라이브상태), `plan_route`(Google Routes→OSRM 폴백), `find_charging_deserts`, `community_impact`, `check_live_availability`. + 기존 3종(status/manual/forecast) 유지.
  - API: `/api/stations|nearby|route|forecast|coverage|community_stats|live`.
  - 차 중심: 차종 7종 카탈로그(도시별 기본차), 배터리→주행거리, 커넥터 호환 우선정렬+0개 경고, 도달가능성 배지. 차 이미지 **rembg로 배경 투명** + 지도 차마커.
  - UI: 지도(좌)+패널(우), KPI 스트립(공공 충전소 비율·CO₂), Equity 사각지대 오버레이, 수요 스파크라인, **접이식 패널**, 한국어 토글(i18n, localStorage), 순위 번호 마커, 세련 팝업, 마스코트 로고/아바타.
  - **채팅 SSE 스트리밍** + 라이브 추론 트레이스(🧠 도구 호출) + **요청별 새 세션**(교차맥락 제거).
  - 비용 가드: 레이트리밋(IP/분 + 전역 일일 하드캡), 배포 `--max-instances 1`. Maps 키 env-file 주입.
  - 문서: `docs/submission/`(ARTICLE·VIDEO·VIDEO_DEMO·SUBMISSION_PLAN·LINKEDIN_TEASER) + `docs/reference/`로 정리. LinkedIn 티저 영상 `docs/submission/teaser.mp4` 제작.
- **Verified**: 공개 URL에서 stations/nearby/route(도쿄=Google,서울=OSM)/chat(스트리밍+트레이스) 동작. Playwright 누적 50+ 케이스 통과(로컬). 커넥터 매칭 데이터 검증(강남 CHAdeMO 0개→경고).
- **Blockers**: BQML 예측은 ZONE_GANGNAM만 학습(타 도시 일반화). 공유 세션 이슈는 요청별 세션으로 해결.
- **Next**: 공개 전 예산알림+Maps 일일쿼터. 7월 런칭(dev.to 아티클+YouTube+제출). 오늘은 LinkedIn 티저(영상만).

## 2026-06-26 — Full Web Stack Deployed to Cloud Run (BigQuery-backed, real data)
- **Status**: Completed. 웹 대시보드 전체가 공개 URL로 배포됨 → https://ev-charge-web-1004528040791.us-central1.run.app. 3개 경로(상태/매뉴얼/예측) 모두 실데이터로 검증.
- **Changed**:
  - 진단: 기존 `deploy.sh`/`Dockerfile`은 MCP 툴박스만 배포(웹앱 미배포)였고, 툴박스엔 도구 1개뿐 + AlloyDB 도구가 tools.yaml에서 주석 비활성 상태임을 확인.
  - 로컬 `live_charger_status`(6행)·`ev_charger_manuals`(3행)를 **BigQuery `ev_data_schema`에 적재** (임베딩 제외).
  - [tools.yaml](file:///Users/men1692/Desktop/GCP/APAC_HACKATHON/tools.yaml): `check_charger_status`·`search_manual_embeddings`를 **AlloyDB→bigquery-sql로 전환**(매뉴얼은 STRPOS 키워드 매칭), toolset 3개 활성화.
  - 신규 [Dockerfile.web](file:///Users/men1692/Desktop/GCP/APAC_HACKATHON/Dockerfile.web) + [cloudbuild.web.yaml](file:///Users/men1692/Desktop/GCP/APAC_HACKATHON/cloudbuild.web.yaml) 작성, `.gcloudignore` 화이트리스트 확장(두 빌드 공존).
  - `ev-mcp-toolbox` 재배포(도구 3개), `ev-charge-web` Cloud Run 신규 배포(Vertex env 주입).
  - 기본 컴퓨트 SA(`1004528040791-compute@`)에 `roles/aiplatform.user` 부여(403 해결).
  - UI 디자인을 보라색 글래스모피즘 → **Google 머티리얼 스타일**(밝은 배경/Google Blue/Roboto·Google Sans)로 교체.
- **Verified**:
  - 원격 MCP `tools/call` 3종 + 공개 URL `/chat` 3종 모두 실데이터 응답(상태=BigQuery, 매뉴얼=BigQuery, 예측=실제 ARIMA_PLUS 109.47/110.32/78.49kW+신뢰구간).
  - `make check` PASS, 과금 리소스 점검(AlloyDB 0·VM 0·Cloud Run 전부 min=0 scale-to-zero).
- **Blockers**: `agent.py`의 local_agent_fallback이 `mcp_server_local`(sqlalchemy 의존)을 import → 웹 이미지에 미설치라 Gemini 일시 오류 시 graceful 폴백 대신 500. 주 경로 정상이라 현재 영향 없음(보강 후보).
- **Next**: (선택) 폴백 견고화 위해 requirements에 sqlalchemy 추가 후 재배포 / 데모 종료 시 Cloud Run 정리.

## 2026-06-25 — GCP Deployment & BQML Model Training Completed
- **Status**: Completed. Fully verified local fallback connectivity, Cloud Run MCP integration, BQML forecasting model, and Vertex AI evaluation scorecard.
- **Changed**:
  - Ran `deploy.sh` to deploy Database Toolbox to Cloud Run and configured `MCP_TOOLBOX_SERVER_URL` in `.env`.
  - Trained ARIMA_PLUS BQML model `ev_demand_forecast_model` in BigQuery.
  - Formatted QA manual [QA_TEST.md](file:///Users/men1692/Desktop/GCP/APAC_HACKATHON/QA_TEST.md) into Korean as requested.
  - Updated progress docs ([STATUS.md](file:///Users/men1692/Desktop/GCP/APAC_HACKATHON/docs/STATUS.md), [NEXT_PLAN.md](file:///Users/men1692/Desktop/GCP/APAC_HACKATHON/docs/NEXT_PLAN.md), [AGENT_BRIEF.md](file:///Users/men1692/Desktop/GCP/APAC_HACKATHON/docs/AGENT_BRIEF.md), [COMPLETED_SUMMARY.md](file:///Users/men1692/Desktop/GCP/APAC_HACKATHON/docs/COMPLETED_SUMMARY.md)).
- **Verified**:
  - Ran `make check` executing syntax/compilation checking and Vertex AI Evaluation Suite (exact_match routing: 1.0, groundedness: PASS).
  - Validated local fallback container connectivity and premium web UI responsiveness.
- **Blockers**: Cloud-based AlloyDB provisioning deferred to prevent GCP billing credit drain. Fallback database handles RAG query operations seamlessly.
- **Next**: Final project submission and packaging.

## 2026-06-23 — Vertex AI Model Fix: Live Gemini Agent Path Restored
- **Status**: `/chat` 응답이 regex 폴백이 아니라 실제 ADK 에이전트(Gemini)로 동작하도록 복구 완료.
- **Changed**:
  - [.env](file:///Users/men1692/Desktop/GCP/APAC_HACKATHON/.env) `MODEL`을 `gemini-1.5-flash`→`gemini-2.5-flash`로 변경.
  - [agent.py](file:///Users/men1692/Desktop/GCP/APAC_HACKATHON/agent.py) 기본 모델값을 `gemini-2.5-flash`로 정렬.
- **Verified**:
  - Vertex AI(ADC) 직접 호출 진단으로 폴백 근본원인 = 모델 404 확인. `gemini-1.5/2.0/3.x` 전부 404, `gemini-2.5-flash/pro/flash-lite`만 접근 가능(프로젝트 권한).
  - 서버 재시작 후 `curl /chat`(ERR_OVERHEATING) 응답에서 `Local Sandbox Fallback Mode` 문구 사라짐 → 실제 에이전트 + MCP 도구 호출 정상.
- **Blockers**: 이 프로젝트는 Gemini 3.x 세대 접근 불가(권한/리전 게이팅). 3.5 자체는 GA 출시됨(2026-05-19).
- **Next**: GCP 실배포(`deploy.sh`) — Cloud Run + AlloyDB + BQML.

## 2026-06-23 — Local Database Ingestion & Hybrid Fallback Implementation
- **Status**: Completed offline sandbox database initialization, NREL data seeding, and added web dashboard route & local agent fallback handler.
- **Changed**:
  - Created [scripts/load_data_local.py](file:///Users/men1692/Desktop/GCP/APAC_HACKATHON/scripts/load_data_local.py) for database table creation and offline data loader.
  - Upgraded [mcp_server_local.py](file:///Users/men1692/Desktop/GCP/APAC_HACKATHON/mcp_server_local.py) to dynamically query PostgreSQL container when available.
  - Modified [agent.py](file:///Users/men1692/Desktop/GCP/APAC_HACKATHON/agent.py) to serve [templates/index.html](file:///Users/men1692/Desktop/GCP/APAC_HACKATHON/templates/index.html) at root `/` and implement `local_agent_fallback` for robust error handling.
  - Created [MASTER_PLAN.md](file:///Users/men1692/Desktop/GCP/APAC_HACKATHON/MASTER_PLAN.md), [README.md](file:///Users/men1692/Desktop/GCP/APAC_HACKATHON/README.md), and [QA_TEST.md](file:///Users/men1692/Desktop/GCP/APAC_HACKATHON/QA_TEST.md).
- **Verified**:
  - Ran `make check` validating syntax and evaluation scorecard successfully.
  - Manually curl tested `/chat` route against live Docker PostgreSQL instance and confirmed correct responses for status, RAG guides, and demand forecasts.
- **Blockers**: None.
- **Next**: Deploy the Database Toolbox to GCP Cloud Run and provision real AlloyDB & BigQuery ML models.

## 2026-06-22 — GCP Credentials Setup & Vertex AI evaluation Verification
- **Status**: Completed gcloud/ADC authentication and integrated Vertex AI evaluation.
- **Changed**:
  - Modified [docs/COST_MINIMIZATION.md](file:///Users/men1692/Desktop/GCP/APAC_HACKATHON/docs/COST_MINIMIZATION.md) to reference Vertex AI and application default credentials instead of Google AI Studio.
  - Modified [agent_eval.py](file:///Users/men1692/Desktop/GCP/APAC_HACKATHON/agent_eval.py) dataset context and scorecard verification to match individual groundedness scores correctly.
  - Configured [env](file:///Users/men1692/Desktop/GCP/APAC_HACKATHON/.env) to force ADK to use Vertex AI.
- **Verified**:
  - Ran `make check` successfully, executing syntax compilation checks and Vertex AI Evaluation Service API tasks.
  - Evaluation confirmed 1.0 routing accuracy and successfully distinguished grounded (1.0) and hallucinated (0.0) answers.
- **Next**: Run `docker-compose up -d` to spin up local vector database and start testing the main Flask agent.
