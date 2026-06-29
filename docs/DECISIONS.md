# Decisions

되돌리기 어려운 선택(provider/infra/데이터 모델/문서 정책/public workflow)을 기록한다.

## 2026-06-28 — Pillow 기반 비디오 프레임별 자막 렌더링 파이프라인 구축
- **Decision**: FFmpeg 필터(`subtitles`, `drawtext`) 대신 **Python (Pillow)을 사용한 프레임별 다이렉트 자막 드로잉 및 파이프라인**을 설계하여 비디오를 렌더링 및 편집.
- **Reason**: 로컬 개발 환경의 FFmpeg 빌드가 `--enable-libass` 및 `--enable-libfreetype` 옵션 없이 컴파일되어 `subtitles`와 `drawtext` 필터를 지원하지 않음(No such filter 에러).
- **Impact**: 외부 라이브러리 의존성 없이 로컬의 가용 폰트(Arial/AppleGothic)를 활용하여 정교한 영문 VO 캡션 및 하단 안내 라벨(Cyan)을 다중 번인 처리함. CPU 기반의 파이핑으로 인해 다소 인코딩 시간이 소요되나 2분 영상 기준 약 1분 내외로 정상 처리됨.

## 2026-06-27 — 제품 피벗: "Predictive Charging Copilot" (Open Charge Map APAC)
- **Decision**: 운영자용 목업 6대 컨셉 → **시민/도시 대상 예측 충전 의사결정 에이전트**로 피벗. 데이터는 **Open Charge Map**(전세계/APAC, 무료)을 채택해 13개국 7,842개 실충전소를 BigQuery `ev_charging_stations`(GEOGRAPHY)에 적재. NREL(미국 전용)은 APAC 부적합으로 미채택.
- **Reason**: 해커톤 주제("AI for Better Living and Smarter Communities")는 시민·커뮤니티·예측을 강조. APAC 심사 → 전세계 커버리지 필요. OCM이 무료+APAC 포함으로 최적.
- **Impact**: 충전소 데이터에 실좌표 확보 → 지도/지오스페이셜/사각지대 가능. 단, OCM 한국 커버리지는 희소(161개)라 한국 사각지대가 과장됨("오픈데이터 커버리지 격차"로 프레이밍). OCM 무료 API 키 필요(`.env OPEN_CHARGE_MAP_KEY`).

## 2026-06-27 — 하이브리드 라우팅 (Google Routes → OSRM 폴백) + 지오/도구는 BigQuery 직접경로
- **Decision**: 경로는 **Google Routes API**(교통 반영) 우선, 빈 응답이면 **OSRM 자동 폴백**. 신규 지오스페이셜·라이브·사각지대·커뮤니티 도구는 MCP 재배포 없이 **Flask에서 BigQuery 직접 쿼리**(컴퓨트 SA가 bigquery 권한 보유).
- **Reason**: **Google Maps는 한국 운전경로 미지원**(데이터 반출 규제) → 한국은 OSRM 필수. 일본/호주 등은 Google이 정확. 도구를 BigQuery 직접경로로 두면 로컬·배포 동일 동작 + 툴박스 재배포 불필요.
- **Impact**: 어디서든 경로 표시(provider 배지로 명시). Google Maps 키는 서버에서만 호출 → 브라우저 미노출. 호출당 과금이나 데모 규모 센트~달러.

## 2026-06-27 — 공개 데모 안전: 요청별 세션 + 레이트리밋 + max-instances 1
- **Decision**: `/chat`·`/chat/stream`은 **요청마다 새 ADK 세션** 생성. 유료 엔드포인트(chat/route/live)에 **레이트리밋**(IP/분 + 전역 일일 하드캡), 배포 `--max-instances 1`.
- **Reason**: 공유 global_session은 사용자 간 맥락 혼입 + 히스토리 누적 시 도구 미호출 유발. 공개 URL은 인증 없어 어뷰즈 비용 위험 → 하드캡으로 상한 고정(전역 카운터는 단일 인스턴스에서 정확).
- **Impact**: 트레이스 일관 렌더, 교차맥락 제거, 최악 비용 상한 고정. 트레이드오프: 멀티턴 대화 메모리 없음(질의에 차/위치 컨텍스트 포함하므로 무방), 동시처리 1인스턴스 제한.

## 2026-06-27 — 제출 게시 정책: dev.to 정본 + LinkedIn 요약 + 영상 티저
- **Decision**: 아티클 **정본=dev.to**(제출 URL), Medium "Google Cloud - Community" 교차게시(canonical=dev.to). LinkedIn은 짧은 포스트+링크(전문 미게재, 링크는 첫 댓글). 풀영상=YouTube. **오늘은 영상만 티저**(링크/배포 노출 없음), 아티클·라이브 링크는 7월 런칭.
- **Reason**: 포럼/LinkedIn은 SEO·신뢰도 약함 → 정본은 블로그. 제출 전 아티클 조기발행은 런칭 효과 분산. 티저는 비용 0(영상만).
- **Impact**: 단일 정본으로 SEO 집중, 2단계 런칭(티저→본편). 상세 `docs/submission/SUBMISSION_PLAN.md`.

## 2026-06-26 — 데이터 백엔드 AlloyDB → BigQuery 단일화 + 웹 별도 Cloud Run 서비스
- **Decision**: 충전기 상태·매뉴얼 저장소를 AlloyDB에서 **BigQuery로 이전**하여 모든 데이터 도구를 `bigquery-source`로 통일. 매뉴얼 검색은 pgvector/임베딩 대신 **STRPOS 키워드 매칭**. Flask 웹앱은 루트 `Dockerfile`(툴박스 전용)과 분리된 **`Dockerfile.web`로 별도 Cloud Run 서비스(`ev-charge-web`)** 배포, 원격 툴박스에 SSE 연결.
- **Reason**: AlloyDB는 scale-to-zero 불가로 상시 과금(월 $200+)이 최소비용 원칙과 충돌. BigQuery는 serverless+무료티어로 데모 규모 사실상 $0이며 ARIMA_PLUS 예측 모델과 동일 백엔드로 통합 가능. 임베딩 모델 연결 비용/복잡도 회피 위해 키워드 매칭 채택.
- **Impact**: 인메모리 목업 없이 실데이터로 공개 배포 가능, 유휴 시 ~$0. 트레이드오프: 매뉴얼 검색이 의미기반(벡터)이 아니라 키워드 기반 — 정밀 시맨틱 검색 필요 시 BigQuery VECTOR_SEARCH+ML.GENERATE_EMBEDDING로 승격 필요. 로컬 dev는 여전히 docker postgres+stdio MCP 경로 사용(클라우드와 백엔드 상이).

## 2026-06-23 — Agent Model = gemini-2.5-flash (Vertex AI)
- **Decision**: 에이전트 LLM을 `gemini-2.5-flash`로 고정 (Vertex AI/ADC 경로).
- **Reason**: 이 GCP 프로젝트는 Gemini 3.x 세대(`gemini-3.5-flash` 등) 접근 권한이 없어 전부 404. 2.5 세대(flash/pro/flash-lite)만 호출 가능. 3.5 모델 자체는 2026-05-19 GA로 존재하나 본 프로젝트 권한/리전 게이팅으로 미사용.
- **Impact**: 잘못된 모델명으로 인한 silent 폴백(regex 응답) 제거. 3.x가 필요하면 프로젝트 권한 승격 또는 다른 리전(`global`/`us-east5`) 검증 필요.

## 2026-06-23 — Local Database Ingestion & Hybrid Fallback Design
- **Decision**: Flask 백엔드의 local_agent_fallback과 로컬 FastMCP 서버의 하이브리드 데이터베이스 연결 구조 채택.
- **Reason**: 클라우드 모델 엑세스 차단(404 에러) 우려를 근본적으로 차단하고 오프라인에서 $0 비용으로 즉각 구동(Run-ability) 가능한 안정적인 데모 보장.
- **Impact**: 오프라인 샌드박스에서도 도커를 활용한 실제 DB 쿼리 연동 검증이 가능해져 해커톤 제출 및 평가 안정성 대폭 상승.
