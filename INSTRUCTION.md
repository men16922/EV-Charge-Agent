# INSTRUCTION.md — EV Charging Agent 이식 지침 (현대오토에버 / 유럽 CPO)

> **이 문서의 독자**: Claude Sonnet 4.6 (Claude Code 에이전트로 동작).
> **목표**: 검증 완료된 레퍼런스 프로젝트("EV-Charge Agent", APAC/GCP 기반)의 **기술 기반과 UX를 그대로 이식**하되,
> 런타임을 **Google Cloud 제거 → 로컬 우선(AgentCore dev + Claude + 로컬 MCP)** 스택으로 교체하고,
> 도메인을 **유럽 CPO(Charge Point Operator)** 로 전환한다.
> 레퍼런스 코드는 이 저장소(`/Users/men1692/Desktop/GCP/APAC_HACKATHON`)에 있다. **반드시 원본을 먼저 읽고** 동작을 1:1로 재현하라.

---

## 0. 한 문단 요약 (먼저 읽어라)

지도 좌측 + 패널 우측의 단일 화면 웹 대시보드다. 운전자가 차종(현대/기아)·배터리%를 고르고 위치를 잡으면,
**AI 에이전트(Claude)** 가 근처 충전소를 거리·전력·커넥터 호환·**예측 혼잡도**·도달가능성으로 순위화하고 경로까지 그려주며,
**그 이유를 스트리밍으로 설명**한다(채팅 + 실시간 추론 트레이스). 도시 계획가용으로 **충전 사각지대(equity)** 와
**CO₂ 절감량** KPI도 제공한다. 데이터는 실측 충전소(Open Charge Map 유럽 + 계약 CPO의 OCPI 피드)다.
**핵심 기능 집합은 레퍼런스와 동일**하게 유지하고, GCP 종속(BigQuery/BQML/Vertex/Gemini/Google Maps)만 비-GCP 로컬 대체로 갈아끼운다.

---

## 1. 결정된 제약 (이미 확정됨 — 재논의 금지)

| 항목 | 결정 |
| --- | --- |
| 추론 모델 | **Claude**. `MODEL_PROVIDER` env 로 **Bedrock**(`anthropic.claude-*` via inference profile) ↔ **Anthropic API 직접**(`claude-sonnet-4-6`) 전환 |
| 에이전트 런타임 | **Amazon Bedrock AgentCore (로컬 dev 모드)** + **Strands Agents** SDK. 클라우드 배포 없이 `localhost`에서 구동 |
| 도구 연결 | **MCP** (로컬 stdio/HTTP MCP 서버). 에이전트는 MCP로 도구 호출 |
| 지오스페이셜 저장소 | **SQLite + 인메모리 하버사인(haversine)**. BigQuery `GEOGRAPHY`/`ST_DWITHIN`/`ST_DISTANCE` 대체 |
| 라이브 가용성 | **OCPI 2.2.1 연동 + 시뮬레이션 폴백**. Google Places 제거 |
| 라우팅 | **OSRM 전용**(Google Routes 제거). 유럽은 OSRM 커버리지 양호 |
| 수요 예측 | **로컬 statsmodels (ARIMA/SARIMAX)** + 예측구간. BQML `ARIMA_PLUS` 대체 |
| 지도 타일 | **Leaflet + OpenStreetMap**(레퍼런스도 이미 OSM 사용; "Google 스타일"은 CSS일 뿐 — 그대로 유지) |
| 차종 | **현대/기아 전용**(유럽 라인업). 타 브랜드 제거 |
| UI 언어 | **EN / KO 토글 유지** (기존 i18n 구조 보존, 라벨만 도메인에 맞게 조정) |
| 지역 스코프 | **유럽**(데이터/도시/KPI 라벨 APAC→EU 전환) |
| 클라우드 | **Google Cloud 일절 금지**. AWS는 Bedrock(모델/AgentCore)만 선택적 사용 |

---

## 2. 소스 → 타깃 스택 매핑 (이식 핵심)

| 레이어 | 레퍼런스(원본) | 타깃(이식 후) | 비고 |
| --- | --- | --- | --- |
| 모델 | Gemini 2.5 Flash (Vertex AI) | Claude (Bedrock 또는 Anthropic API) | `MODEL_PROVIDER` 추상화 |
| 에이전트 프레임워크 | Google ADK (`adk.Agent`/`adk.Runner`) | Strands Agents + AgentCore 로컬 런타임 | 스트리밍/툴콜 트레이스 동일 재현 |
| 도구 노출 | ADK FunctionTool + MCP(SSE/stdio) 혼합 | **단일 로컬 MCP 서버**로 통일 | 아래 §6 |
| 근처검색/사각지대 | BigQuery `ST_DWITHIN`/`ST_DISTANCE`/`GEOGRAPHY` | SQLite 조회 + 파이썬 **하버사인** | §5, §6.1 |
| 수요예측 | BQML `ML.FORECAST(ARIMA_PLUS)` | statsmodels ARIMA, SQLite 캐시 | §6.3 |
| 라우팅 | Google Routes → OSRM 폴백 | **OSRM 전용** | polyline 디코드 불필요(OSRM=GeoJSON) |
| 라이브 상태 | Google Places(New) → 시뮬 | **OCPI** → 시뮬 폴백 | §6.4 |
| 데이터 소스 | Open Charge Map (APAC 13개국) | **OCM(유럽) + 계약 CPO OCPI Locations** | §5 |
| 웹 백엔드 | Flask + `/api/*` + `/chat/stream`(NDJSON) | **동일**(Flask, 같은 엔드포인트/JSON 계약) | 프론트 변경 최소화 |
| 프론트 | Leaflet + OSM, 지도좌/패널우, i18n EN/KO | **거의 그대로**(차종/도시/라벨만 교체) | §7 |
| 비용가드 | IP 레이트리밋 + 일일 하드캡 | 유지(로컬에선 완화 가능, 코드는 보존) | |

> **불변 원칙**: API JSON 계약(요청 파라미터/응답 필드)과 NDJSON 스트리밍 이벤트 스키마는 **바이트 호환**으로 유지하라.
> 그래야 `templates/index.html`의 JS를 거의 수정 없이 재사용할 수 있다.

---

## 3. 타깃 아키텍처

```
┌──────────────────────────────────────────────────────────┐
│  Browser — templates/index.html (Leaflet + OSM tiles)     │
│   지도(좌)  +  패널(우): My EV / Find / Demand / Chat      │
└───────────────┬──────────────────────────────────────────┘
                │ HTTP (fetch /api/*, /chat/stream NDJSON)
┌───────────────▼──────────────────────────────────────────┐
│  Web backend — Flask (app.py)                             │
│   /api/stations|nearby|route|forecast|coverage|           │
│   community_stats|live   +   /chat/stream                 │
│   · 지도/패널용 데이터는 core/ 직접 호출(빠른 경로)        │
│   · /chat/stream 은 Agent 런타임으로 프록시(스트리밍)      │
└──────┬───────────────────────────────────┬───────────────┘
       │ import (fast path)                 │ HTTP (local invoke)
       │                                     │
┌──────▼──────────────────┐   ┌────────────▼──────────────────┐
│ core/  (공유 도메인 로직) │   │ Agent (AgentCore local + Strands)│
│  geo.py  haversine 검색  │   │  model: Claude(Bedrock|Anthropic)│
│  route.py OSRM           │   │  tools: via MCP                  │
│  forecast.py statsmodels │   └────────────┬──────────────────┘
│  live.py  OCPI + sim     │                │ MCP (stdio/HTTP)
│  impact.py CO₂/equity    │   ┌────────────▼──────────────────┐
└──────┬──────────────────┘   │ MCP tool server (mcp_server.py) │
       │ read                  │  같은 core/ 함수를 MCP 도구로   │
┌──────▼──────────────────┐   │  노출 (단일 진실 원천)          │
│ data/ev.sqlite           │◄──┴────────────────────────────────┘
│  stations · manuals ·    │
│  charger_status · demand │   외부: Open Charge Map API(유럽 시드),
└──────────────────────────┘        계약 CPO OCPI Locations 피드
```

**설계 원칙 — 단일 진실 원천(core/)**: 레퍼런스는 지오/라우팅 도구를 ADK FunctionTool로도, 웹 `/api/*`에서도
직접 호출하는 **이중 경로**를 쓴다(지도가 빠르게 동작하도록). 이를 그대로 계승하라:
도메인 로직은 `core/` 모듈에 한 번만 구현하고 → (a) **MCP 도구**로 래핑(에이전트용), (b) Flask `/api/*`에서 **직접 import**(지도용).
로직 중복/드리프트를 만들지 마라.

---

## 4. 기능 패리티 체크리스트 (이식 완료 판정 기준)

이식본은 아래를 **레퍼런스와 동일 동작**으로 만족해야 한다. 각 항목은 §8 인수 기준과 연결된다.

- [ ] 지도 좌 + 패널 우 단일 화면, Google 스타일 라이트 테마(CSS 변수 `--blue/--green/...`) 유지
- [ ] KPI 스트립: 충전소 수 / 공공 비율 / 급속·초급속 / **연간 CO₂ 절감** / 사각지대 셀
- [ ] My EV 패널: **현대/기아 차종 선택**, 배터리 슬라이더, 커넥터 칩, 주행거리 실시간 갱신, 지도 차 마커 + 배터리 팝업
- [ ] Find 패널: 현재 위치/도시 점프, 반경·최소전력 선택, **추천받기**, **Equity(사각지대) 토글**
- [ ] 추천 카드: 거리·전력·커넥터매칭(`is_match`)·**도달가능성 배지**(reachable/tight/out-of-range)·라이브 가용성·공공 여부
- [ ] 커넥터 호환 충전소 **우선 정렬**, 0개면 경고 후 최근접 표시
- [ ] 경로: 클릭 시 폴리라인 + 거리/ETA 박스 (OSRM)
- [ ] Demand 스파크라인: 존별 예측 + 최저/피크 라벨
- [ ] 채팅: **NDJSON 스트리밍**(토큰 단위) + **🧠 추론 트레이스**(도구 호출 라벨) + **요청별 새 세션**
- [ ] 사각지대 오버레이: 뷰포트 그리드, 최근접 충전소 거리 기반 색상 셰이딩
- [ ] EN/KO 토글(localStorage), 한국어일 때 에이전트에 "자연스러운 한국어로 답변" 지시 부가
- [ ] 비용가드(레이트리밋) 코드 보존
- [ ] **OCPI 라이브 + 시뮬 폴백**, 응답 `source` 필드로 출처 표기(`ocpi`/`simulated`)

---

## 5. 데이터 레이어 (SQLite + 하버사인)

### 5.1 SQLite 스키마 (`data/ev.sqlite`)

레퍼런스 `scripts/ocm_schema.json`을 SQLite로 옮긴다. `GEOGRAPHY` 컬럼은 버리고 `lat/lon` REAL만 둔다.

```sql
-- stations: Open Charge Map(유럽) + OCPI Locations 정규화 적재
CREATE TABLE stations (
  station_id     INTEGER PRIMARY KEY,
  title          TEXT, address TEXT, town TEXT, state TEXT,
  country_code   TEXT,                 -- ISO-2 (DE, FR, NL, NO, GB, ...)
  lat            REAL, lon REAL,       -- WGS84 (GEOGRAPHY 대체)
  operator       TEXT,
  usage_type     TEXT,                 -- 'public' 포함 여부로 공공 판정
  usage_cost     TEXT,
  status         TEXT, is_operational INTEGER,
  num_points     INTEGER,              -- 포트 수(=total plugs)
  max_power_kw   REAL,
  connector_types TEXT,                -- 'CCS (Type 2), Type 2' 등 원문
  ocpi_location_id TEXT,               -- OCPI 연동 키(없으면 NULL → 시뮬)
  date_last_verified TEXT
);
CREATE INDEX idx_stations_country ON stations(country_code);
CREATE INDEX idx_stations_bbox    ON stations(lat, lon);  -- 1차 bbox 프리필터용

-- 운영자/매뉴얼/예측은 레퍼런스 mcp_server_local.py 의 목 데이터와 동일 구조
CREATE TABLE charger_status (
  charger_id TEXT PRIMARY KEY, status TEXT, current_load_kw REAL,
  error_code TEXT, last_updated TEXT
);
CREATE TABLE manuals (
  section_title TEXT, troubleshooting_steps TEXT, error_code TEXT
);
CREATE TABLE demand_forecast (   -- forecast.py 가 미리 채우거나 온디맨드 계산
  zone_id TEXT, ts TEXT, kw REAL, lo REAL, hi REAL
);
```

### 5.2 시드 (`scripts/ingest_ocm_eu.py`)

레퍼런스 `scripts/ingest_ocm_apac.py`를 포팅:
- BigQuery 적재 → **SQLite `INSERT`** 로 교체.
- 국가 리스트를 **유럽**으로: 예) `DE, FR, NL, NO, GB, SE, ES, IT, BE, AT, CH, DK, PL, PT, FI` (계약/데모 우선순위로 정렬, 국가별 상한 지정).
- 환경변수: `OPEN_CHARGE_MAP_KEY`. (원본 `.env`에 오타 변수 `OPEN_CHARGE_MAK_KEY`가 있으니 두 이름 모두 허용하는 로직 유지)
- `geog` 생성 단계 삭제. `lat/lon` 그대로 저장.
- (선택) 계약 CPO의 **OCPI Locations** 모듈에서 실충전소를 추가 적재 → `ocpi_location_id` 채움. §6.4 참조.

### 5.3 하버사인 거리 (BigQuery `ST_DISTANCE` 대체) — `core/geo.py`

```python
from math import radians, sin, cos, asin, sqrt
def haversine_m(lat1, lon1, lat2, lon2):
    R = 6371000.0
    dlat, dlon = radians(lat2-lat1), radians(lon2-lon1)
    a = sin(dlat/2)**2 + cos(radians(lat1))*cos(radians(lat2))*sin(dlon/2)**2
    return 2*R*asin(sqrt(a))
```

근처검색은 **bbox 프리필터(SQL) → 하버사인 정밀 거리(파이썬)** 2단계로:
1. `radius_m`로 위경도 델타 계산(`dlat ≈ r/111320`, `dlon ≈ r/(111320*cos(lat))`)해 `WHERE lat BETWEEN ? AND ? AND lon BETWEEN ? AND ?` 로 후보 축소(인덱스 사용).
2. 후보에 대해 `haversine_m`로 정확 거리 계산 → `radius_m` 이내만 → 거리 오름차순.
3. `min_power_kw` 필터, **커넥터 매칭**(아래)으로 `is_match` 부여 후 `is_match DESC, distance_m ASC` 정렬.

> 데이터셋이 수천~수만 행이면 이 방식으로 충분히 빠르다. 더 커지면 SQLite R*Tree(`rtree`) 모듈 도입 검토.

---

## 6. 에이전트 도구 (MCP 서버) — 시그니처/동작 보존

`mcp_server.py` 하나에 아래 도구를 노출한다(레퍼런스의 도구 시그니처·docstring·반환 형태를 최대한 유지).
각 도구는 `core/` 함수를 호출만 한다. **에이전트는 MCP로 이 도구들을 본다.**

### 6.1 지오/추천 도구 (`core/geo.py`, `core/impact.py`)

| MCP 도구 | 레퍼런스 함수 | 핵심 로직(보존) |
| --- | --- | --- |
| `find_nearby_stations(latitude, longitude, radius_km=5, min_power_kw=0, connector="")` | `agent.py:find_nearby_stations` | 하버사인 검색 + 커넥터 매칭. 반환 `{count, compatible, stations[]}`. 각 station에 시뮬/OCPI 라이브 병합 |
| `find_charging_deserts(latitude, longitude, radius_km=8)` | `agent.py:find_charging_deserts` | 정사각 영역을 ~12×12 그리드로 스캔, 각 셀의 최근접 충전소 거리 계산, `>2000m`를 사각지대로 집계. 반환 `{area_km, cells_analyzed, desert_cells, desert_pct, worst_gap_km}` |
| `community_impact(country_code="")` | `agent.py:community_impact` | 총수/급속(≥50)/초급속(≥150)/공공비율/포트합. **CO₂ = points×20×365×0.25/1000 톤/년**. 가정 문자열 동봉 |

**커넥터 매칭 규칙(SQL CASE → 파이썬으로 이식)**: `connector` 소문자화 후
- 빈 문자열 → `is_match=0`
- `'tesla'` → `connector_types`에 `tesla` 또는 `nacs` 포함 시 1
- 그 외(`ccs`/`chademo`/`type 2`) → `connector_types`에 해당 문자열 포함 시 1
- **유럽 보강**: 현대/기아는 전부 **CCS Combo 2**. OCM 유럽 표기는 `"CCS (Type 2)"`/`"Combo"` 등으로 다양하므로,
  `ccs` 매칭 시 `ccs`·`combo`·`type 2` 부분문자열을 함께 허용하라(누락 방지).

### 6.2 라우팅 (`core/route.py`)

| MCP 도구 | 레퍼런스 | 변경점 |
| --- | --- | --- |
| `plan_route(from_lat, from_lon, to_lat, to_lon)` | `agent.py:plan_route` + `_osrm_route` | **OSRM 전용**. `https://router.project-osrm.org/route/v1/driving/{olon},{olat};{dlon},{dlat}?overview=full&geometries=geojson`. 반환 `{provider:'osrm', distance_km, duration_min}` (도구) / coords 포함(`/api/route`) |

- Google Routes(`_google_route`)·polyline 디코더(`_decode_polyline`)는 **삭제**.
- (운영) 공개 OSRM demo 서버는 레이트리밋이 있으니, 프로덕션은 **자체 호스팅 OSRM**(Docker, 유럽 추출본) 또는 Valhalla 권장. 환경변수 `OSRM_BASE_URL`로 추상화.

### 6.3 수요 예측 (`core/forecast.py`)

| MCP 도구 | 레퍼런스 | 대체 |
| --- | --- | --- |
| `predict_charging_demand(zone_id, forecast_horizon)` | `tools.yaml:predict_charging_demand` / `mcp_server_local.py` 목 | **statsmodels** ARIMA/SARIMAX |

- BQML `ML.FORECAST(... STRUCT(168 horizon, 0.9 confidence))` → statsmodels로 동일 산출:
  존별 시계열(시드 또는 합성 일주기/주간 패턴) 학습 → `get_forecast(steps=horizon)` → `predicted_mean` + `conf_int(alpha=0.1)`.
- 반환 행 형태 유지: `{forecast_timestamp, forecast_value, prediction_interval_lower_bound, prediction_interval_upper_bound}`.
- `/api/forecast`는 `{zone, series:[{t,kw,lo,hi}], peak_kw}` 형태로 매핑(레퍼런스 동일). 결과를 `demand_forecast` 테이블에 캐시해 재계산 비용 절감.
- 데모 존: 유럽 기준으로 재명명(예: `ZONE_BERLIN_MITTE`). 레퍼런스의 `ZONE_GANGNAM` 위치 차지.

### 6.4 라이브 상태 — OCPI + 시뮬 (`core/live.py`)

| MCP 도구 | 레퍼런스 | 대체 |
| --- | --- | --- |
| `check_live_availability(latitude, longitude, station_name)` | `agent.py:check_live_availability` + `_places_live` | **OCPI** → 시뮬 폴백 |

- **시뮬레이션(`sim_live_status`)은 그대로 이식**(무료·결정론적):
  5분 버킷(`int(time.time()//300)`) + `station_id` 해시로 가용/점유 산출, ~8% offline. 반환 `{live, available, total, source:'simulated'}`.
- **OCPI 어댑터(`ocpi_client.py`)**:
  - OCPI 2.2.1 **Locations 모듈** 사용. 인증: 토큰 헤더 `Authorization: Token <CREDENTIALS_TOKEN_C>` (base64). 환경변수 `OCPI_BASE_URL`, `OCPI_TOKEN`, `OCPI_PARTY_ID`, `OCPI_COUNTRY_CODE`.
  - 충전소의 `ocpi_location_id`로 `GET {base}/cpo/2.2.1/locations/{country}/{party}/{location_id}` 조회 → `evses[].status`(`AVAILABLE`/`CHARGING`/`OUTOFORDER`/`BLOCKED`/...) 집계.
  - 정규화: `available = AVAILABLE 개수`, `total = EVSE 개수`, `live = available>0 ? 'available' : (모두 OUTOFORDER면 'offline' : 'busy')`, `source='ocpi'`.
  - 자격증명/`ocpi_location_id` 없으면 → 시뮬 폴백. 응답에 `note`로 명시.
- 근처검색 결과의 각 station에도 라이브 병합(레퍼런스 `query_nearby_stations` 말미의 `r.update(sim_live_status(...))` 자리에서 OCPI 우선 시도 → 폴백).

### 6.5 운영자/매뉴얼 도구 (`core/ops.py`)

| MCP 도구 | 레퍼런스 | 대체 |
| --- | --- | --- |
| `check_charger_status(charger_id)` | `tools.yaml` / `mcp_server_local.py` | SQLite `charger_status` 조회 (목 데이터 시드) |
| `search_manual_embeddings(query_text, limit_count=1)` | 동일 | SQLite `manuals` 키워드/에러코드 매칭(원본 STRPOS/ILIKE 랭킹 로직 이식). 진짜 임베딩 RAG가 필요하면 차후 로컬 벡터(sqlite-vss/Chroma)로 확장 |

> 레퍼런스의 목 데이터(CHG-1001~1004, ERR_OVERHEATING/ERR_CONN_TIMEOUT 매뉴얼)를 그대로 시드해 데모 시나리오를 보존하라.

### 6.6 TOOL_LABELS (추론 트레이스용)

레퍼런스 `agent.py:TOOL_LABELS` 딕셔너리를 **그대로 이식**하되 문구의 데이터 출처만 갱신:
- `🔌 Searched live EU stations (SQLite geo)` / `🧭 Computed route & ETA (OSRM)` / `📈 Forecast congestion (statsmodels ARIMA)` /
  `🌍 Analyzed coverage gaps (SQLite geo)` / `🌱 Computed community impact & CO₂ (SQLite)` / `🟢 Checked live availability (OCPI / sim)` /
  `⚙️ Checked charger telemetry (SQLite)` / `📖 Searched troubleshooting manuals (RAG)`.
- 스트리밍에서 도구 호출 이벤트를 이 라벨로 변환해 `{type:'step', label}` 푸시.

---

## 7. 에이전트 런타임 (AgentCore 로컬 + Strands + Claude)

### 7.1 구성

- 프레임워크: **Strands Agents**(`strands-agents`). 도구는 §6 MCP 서버를 **MCP 클라이언트**로 연결.
- 모델 추상화 (`core/llm.py`):
  ```python
  provider = os.getenv("MODEL_PROVIDER", "anthropic")  # 'anthropic' | 'bedrock'
  if provider == "bedrock":
      from strands.models import BedrockModel
      model = BedrockModel(model_id=os.getenv("BEDROCK_MODEL_ID",
                 "eu.anthropic.claude-sonnet-4-6-v1:0"),  # ※ EU inference profile; 정확 ID는 리전에서 확인
                 region_name=os.getenv("AWS_REGION", "eu-central-1"))
  else:
      from strands.models.anthropic import AnthropicModel
      model = AnthropicModel(model_id=os.getenv("ANTHROPIC_MODEL_ID", "claude-sonnet-4-6"),
                 client_args={"api_key": os.getenv("ANTHROPIC_API_KEY")})
  ```
  > Bedrock 모델 ID/인퍼런스 프로파일 접두사(`eu.`)와 정확한 버전 suffix는 설치된 SDK/리전 문서로 **반드시 확인**하라(시간에 따라 변동).
- AgentCore 로컬: `bedrock-agentcore` + `bedrock-agentcore-starter-toolkit`. 에이전트를 `BedrockAgentCoreApp`으로 감싸고
  로컬 실행(`agentcore launch --local` 또는 앱을 직접 `localhost:8080`에서 서빙)한 뒤 `/invocations`로 호출.
  > **정확한 CLI/엔트리포인트는 설치된 toolkit 버전 문서로 확인**하라. 핵심은 "Strands 에이전트를 AgentCore 로컬 런타임으로 노출"이다.
- 시스템 프롬프트: 레퍼런스 `agent.py`의 `instruction=""" ... """` 블록을 **거의 그대로 이식**하되:
  - "APAC" → "Europe", "Gangnam" 예시 → 유럽 도시 예시로 교체.
  - 데이터 출처 문구: "Open Charge Map, in BigQuery" → "Open Charge Map + partner CPO via OCPI (local SQLite)".
  - 차량 맥락: 현대/기아 전제(전부 CCS) 명시.
  - **CAR-FIRST / EXPLAINABLE / COMMUNITY / RESPONSE STYLE 섹션은 그대로 유지**(이 프로젝트의 차별점이다).

### 7.2 스트리밍 계약 (절대 변경 금지)

프론트(`index.html`의 `askAgent`)는 **NDJSON 라인 스트림**을 기대한다. 각 라인은 JSON 객체:
- `{"type":"step","label":"<TOOL_LABELS 문자열>"}` — 도구 호출 시작 1회(중복 억제: 같은 도구명 1번만)
- `{"type":"token","text":"<델타>"}` — 답변 토큰 델타(스트리밍) 또는 비스트리밍이면 전체 1회
- `{"type":"done"}` — 종료

이식 구현(`/chat/stream`, Flask):
1. 레퍼런스의 **스레드+큐 브리지 패턴 유지**(Flask sync ↔ async 에이전트). `agent.py:chat_stream`의 `worker()`/`queue`/`gen()` 구조 그대로.
2. 내부 루프만 ADK `runner.run_async` → **Strands `agent.stream_async(prompt)`** 로 교체:
   - 텍스트 델타 이벤트 → `{type:'token', text}` 큐잉.
   - 툴 사용 시작 이벤트 → 도구명 추출 → `TOOL_LABELS` 변환 → `{type:'step', label}` (최초 1회).
   - 스트림 종료 → `{type:'done'}`.
   > Strands 스트림 이벤트의 정확한 키(예: 텍스트 델타/`current_tool_use`)는 Strands `stream_async` 문서로 확인해 매핑하라. **출력 NDJSON 스키마는 위와 동일하게** 맞추는 게 핵심.
3. **요청별 새 세션** 유지(교차 맥락 제거) — 레퍼런스가 `create_session`을 요청마다 호출하는 의도 보존.
4. 폴백: 모델 오류/무응답 시 레퍼런스 `local_agent_fallback`에 해당하는 **간단한 규칙 기반 응답** 유지(CHG-*, ERR_*, forecast 키워드). 단, sqlalchemy 등 무거운 의존은 빼고 SQLite 직접 조회로 단순화(레퍼런스 STATUS의 "폴백 취약점" 해소).

---

## 8. 웹 백엔드 (`app.py`) — 엔드포인트 계약 보존

레퍼런스 `agent.py`의 Flask 라우트를 **동일 경로/파라미터/응답 필드**로 이식. 데이터 접근만 `core/`로 교체.

| 엔드포인트 | 파라미터 | 응답(보존) | 소스 |
| --- | --- | --- | --- |
| `GET /` | — | `index.html` | |
| `GET /api/stations` | `country?`, `limit=8000` | `{count, stations[]}` | `core/geo.list_stations` |
| `GET /api/nearby` | `lat,lon`(필수), `radius_km=5, min_power_kw=0, limit=20, connector=""` | `{count, compatible, stations[]}` | `core/geo.query_nearby` |
| `GET /api/route` | `from_lat,from_lon,to_lat,to_lon` | `{provider, distance_m, duration_s, coords[[lat,lon]]}` | `core/route` (OSRM) |
| `GET /api/forecast` | `zone=ZONE_*, horizon=12` | `{zone, series[{t,kw,lo,hi}], peak_kw}` | `core/forecast` |
| `GET /api/coverage` | `south,west,north,east, threshold_m=2000` | `{cell_deg, threshold_m, cells[{lat,lon,nearest_m}], total, deserts, desert_pct}` | `core/geo.coverage_grid` |
| `GET /api/community_stats` | `country?` | `{total, fast, ultra, public_pct, avg_kw, total_points, countries, co2_avoided_tonnes_yr, co2_assumption}` | `core/impact` |
| `GET /api/live` | `lat,lon`(필수), `title, station_id, total` | `{live, available, total, source}` | `core/live` (OCPI→sim) |
| `POST /chat/stream` | body `{message}` | NDJSON 스트림(§7.2) | Agent |
| `POST /chat`(비스트림) | body `{message}` | `{agent_reply, agent_steps[]}` | Agent |

- **비용가드**: `rate_limited(kind)`(IP/분 + 일일 하드캡 `{chat:600, route:500, live:150}`) **코드 보존**. 로컬 개발 편의를 위해 env `RATE_LIMIT_DISABLED=1`로 우회 토글만 추가.
- `coverage`/`deserts` 그리드: 레퍼런스의 적응형 스텝(`span/14`, 셀 ≤500 캡) 로직을 하버사인으로 이식.

---

## 9. 프론트엔드 (`templates/index.html`) — 최소 변경

레퍼런스 파일을 복사 후 **아래만 수정**한다. 구조/CSS/스트리밍 JS는 그대로 둔다.

1. **차종 → 현대/기아 전용**(`VEHICLES` 배열 교체). 유럽 라인업, 전부 CCS:
   ```js
   const VEHICLES = [
     { id:'ioniq5', name:'Hyundai IONIQ 5',   conn:'ccs', connLabel:'CCS', range:481, img:'/static/vehicles/ioniq5.png' },
     { id:'ioniq6', name:'Hyundai IONIQ 6',   conn:'ccs', connLabel:'CCS', range:614, img:'/static/vehicles/ioniq6.png' },
     { id:'ioniq5n',name:'Hyundai IONIQ 5 N', conn:'ccs', connLabel:'CCS', range:448, img:'/static/vehicles/ioniq5n.png' },
     { id:'kona',   name:'Hyundai Kona Electric', conn:'ccs', connLabel:'CCS', range:454, img:'/static/vehicles/kona.png' },
     { id:'ev6',    name:'Kia EV6',           conn:'ccs', connLabel:'CCS', range:528, img:'/static/vehicles/ev6.png' },
     { id:'ev9',    name:'Kia EV9',           conn:'ccs', connLabel:'CCS', range:563, img:'/static/vehicles/ev9.png' },
     { id:'niro',   name:'Kia Niro EV',       conn:'ccs', connLabel:'CCS', range:460, img:'/static/vehicles/niro.png' },
   ];
   ```
   > 차량 투명 PNG는 `static/vehicles/`에 동일 파일명으로 준비. (레퍼런스는 `rembg`로 배경 제거; 동일 절차 사용 가능. 없으면 `onerror` 폴백이 이미 있음.)
2. **도시 → 유럽**(`CITIES` 배열 교체) + `CITY_VEHICLE`도 현대/기아로 매핑. 전부 OSRM이므로 `route` 필드는 제거하거나 `'osrm'` 고정. 예: Berlin/Munich/Frankfurt/Paris/Amsterdam/Oslo/London/Madrid/Rome/Stockholm/Brussels/Vienna/Copenhagen.
   - 초기 지도 `setView`도 유럽 중심(예: Berlin `[52.52, 13.405]`)으로.
3. **라벨/문구**: i18n 사전(`I18N.en`/`I18N.ko`)에서 "APAC"→"EU/Europe", 헤더 태그 `Gemini · BigQuery ML · ADK · Google Maps` → `Claude · AgentCore · MCP · OCPI · OpenStreetMap`. Demand 패널 존명 `ZONE_GANGNAM`→유럽 존. **EN/KO 키 구조는 유지**.
4. **라이브 출처 라벨**: `liveText`의 `s.source==='google_places'?'live · Google'` → `s.source==='ocpi'?'live · OCPI':'simulated'`.
5. 그 외(`askAgent` NDJSON 파서, `formatMarkdown`, `renderRecommendations`의 도달가능성/커넥터/공공 배지, `drawRoute`, `toggleEquity`, 스파크라인)는 **변경 없음**.

> 외부 CDN(Leaflet/markercluster/Roboto/unpkg)은 그대로 사용 가능. 오프라인/사내망 제약이 있으면 해당 자산을 `static/`에 벤더링.

---

## 10. 프로젝트 레이아웃 (생성할 구조)

```
ev-charge-eu/
├─ app.py                      # Flask: /api/*, /chat/stream  (§8)
├─ agent_runtime.py            # AgentCore 로컬 + Strands 에이전트 (§7)
├─ mcp_server.py               # 단일 MCP 도구 서버 (§6)
├─ core/
│  ├─ geo.py                   # 하버사인 검색·커버리지 그리드 (§5.3, §6.1)
│  ├─ route.py                 # OSRM (§6.2)
│  ├─ forecast.py              # statsmodels ARIMA (§6.3)
│  ├─ live.py                  # 라이브 병합(OCPI→sim) (§6.4)
│  ├─ ocpi_client.py           # OCPI 2.2.1 Locations 어댑터 (§6.4)
│  ├─ ops.py                   # charger_status / manuals (§6.5)
│  ├─ impact.py                # CO₂·KPI (§6.1)
│  └─ llm.py                   # MODEL_PROVIDER 추상화 (§7.1)
├─ data/
│  └─ ev.sqlite                # scripts/ingest_ocm_eu.py 로 생성
├─ scripts/
│  ├─ ingest_ocm_eu.py         # OCM(유럽)→SQLite (§5.2)
│  ├─ seed_ops.py              # charger_status/manuals 목 시드
│  └─ build_forecast.py        # 존별 시계열 학습/캐시
├─ templates/index.html        # 레퍼런스 포팅 (§9)
├─ static/
│  ├─ vehicles/*.png           # 현대/기아 7종 투명 PNG
│  └─ ev-agent.png             # 로고/아바타
├─ .env.example                # §11
├─ requirements.txt            # §11
└─ README.md
```

---

## 11. 설정 / 의존성

### `.env.example`
```ini
# --- Model ---
MODEL_PROVIDER=anthropic              # anthropic | bedrock
ANTHROPIC_API_KEY=
ANTHROPIC_MODEL_ID=claude-sonnet-4-6
# (bedrock일 때)
AWS_REGION=eu-central-1
BEDROCK_MODEL_ID=eu.anthropic.claude-sonnet-4-6-v1:0   # ※ 리전 inference profile 확인

# --- Data ---
SQLITE_PATH=data/ev.sqlite
OPEN_CHARGE_MAP_KEY=

# --- Routing ---
OSRM_BASE_URL=https://router.project-osrm.org          # 운영은 자체호스팅 권장

# --- OCPI (계약 CPO) ---
OCPI_BASE_URL=
OCPI_TOKEN=
OCPI_COUNTRY_CODE=
OCPI_PARTY_ID=

# --- Guards ---
RATE_LIMIT_DISABLED=0
PORT=8080
```

### `requirements.txt` (GCP 의존 전면 제거)
```
flask>=3.0.0
python-dotenv>=1.1.0
requests>=2.31.0
statsmodels>=0.14.0
pandas>=2.0.0
numpy>=1.26.0
strands-agents>=0.1.0            # 버전은 설치 시 확인
bedrock-agentcore                # AgentCore 로컬 런타임
bedrock-agentcore-starter-toolkit
mcp>=1.0.0                       # MCP 서버/클라이언트
anthropic>=0.40.0               # MODEL_PROVIDER=anthropic 경로
boto3>=1.34.0                   # MODEL_PROVIDER=bedrock 경로
```
> 제거 대상(이식하면 안 됨): `google-adk`, `google-cloud-bigquery`, `google-cloud-aiplatform`, `toolbox-core`, `google-antigravity`, `sqlalchemy`(폴백 단순화로 불필요).

---

## 12. 구현 단계 (순서대로 — 각 단계 인수 기준 충족 후 다음)

> **Phase 0**부터 순서대로. 각 단계 끝에 "인수 기준"을 직접 실행해 확인하라.

**Phase 0 — 스캐폴드 & 데이터**
- 레이아웃(§10) 생성, `.env`/`requirements` 작성, `pip install`.
- `ingest_ocm_eu.py`로 유럽 충전소를 `data/ev.sqlite`에 적재, `seed_ops.py`로 목 데이터 시드.
- 인수: `sqlite3 data/ev.sqlite "SELECT country_code, COUNT(*) FROM stations GROUP BY 1"` 에 유럽 국가별 행 존재.

**Phase 1 — core/ 도메인 로직 (GCP 무관, 단위 검증 가능)**
- `geo.py`(하버사인 검색·커버리지), `route.py`(OSRM), `forecast.py`(ARIMA), `live.py`+`ocpi_client.py`, `impact.py`, `ops.py`.
- 인수: 각 함수 파이썬에서 직접 호출 시 레퍼런스와 **동일 형태 dict** 반환(필드명·타입 일치). 커넥터 매칭/도달가능성/사각지대 수치 sanity 확인.

**Phase 2 — 웹 백엔드 + 프론트 (에이전트 없이 지도 동작)**
- `app.py`의 `/api/*`를 `core/` 직접 호출로 구현. `index.html` 포팅(§9: 차종/도시/라벨/라이브출처).
- 인수: 브라우저에서 지도·핀·KPI·도시점프·**추천받기(카드+경로+배지)**·Equity 오버레이·스파크라인이 모두 동작(채팅 제외).

**Phase 3 — MCP 도구 서버**
- `mcp_server.py`에서 §6 도구 노출. MCP 인스펙터/클라이언트로 도구 목록·호출 검증.
- 인수: MCP로 `find_nearby_stations`/`plan_route`/`predict_charging_demand`/`check_live_availability` 등 호출 성공.

**Phase 4 — 에이전트 런타임 + 스트리밍**
- `agent_runtime.py`(Strands+AgentCore 로컬, `MODEL_PROVIDER` 추상화, MCP 도구 연결, 시스템 프롬프트 이식).
- `/chat/stream`을 스레드+큐 브리지로 NDJSON(§7.2) 출력. TOOL_LABELS 트레이스.
- 인수: 채팅에서 **토큰 스트리밍 + 🧠 도구 트레이스**가 보이고, "추천받기"가 트리거한 자동 질의에 에이전트가 거리·전력·커넥터·혼잡·도달가능성으로 **이유 있는 추천**을 답함. `MODEL_PROVIDER` 양쪽 전환 동작.

**Phase 5 — OCPI 실연동 & 폴백**
- 계약 CPO 자격증명으로 OCPI Locations 라이브 상태 표시. 자격증명 없을 때 시뮬 폴백 + `source` 표기.
- 인수: `/api/live`가 OCPI 가용 시 `source:'ocpi'`, 미가용 시 `source:'simulated'` 반환. 근처검색 카드의 라이브 배지가 출처를 정확히 표기.

**Phase 6 — 마감**
- 비용가드 토글, EN/KO 전수 점검, README(로컬 실행법), 시드/재현 스크립트 정리.
- 인수: §4 패리티 체크리스트 전 항목 ✅.

---

## 13. 도메인 노트 (유럽 CPO — 정확도 위해 반드시 인지)

- **OCPI(Open Charge Point Interface)** 는 유럽 CPO↔eMSP 표준. 핵심 모듈: **Locations**(충전소/EVSE/커넥터/상태), Sessions, CDRs, Tariffs, Tokens.
  본 프로젝트는 **Locations**(정적+상태)만 사용. EVSE `status`: `AVAILABLE/CHARGING/RESERVED/OUTOFORDER/BLOCKED/INOPERATIVE/PLANNED/REMOVED/UNKNOWN`.
- **커넥터 표준(유럽)**: AC는 **Type 2**, DC 급속은 **CCS Combo 2(CCS2)**, 일부 구형 **CHAdeMO**. 현대/기아 전 차종 **CCS2** + Type 2 AC.
  → 커넥터 매칭은 사실상 "이 충전소가 CCS/Type2를 지원하는가" 확인. `is_match` 로직은 유지하되 §6.1의 `ccs/combo/type 2` 보강 적용.
- **요금/지불**은 본 범위 밖(데모는 `usage_cost` 텍스트 표기까지만). 필요 시 OCPI Tariffs로 확장 가능.
- **데이터 정확도**: OCM은 오픈데이터라 커버리지 편차 존재(사각지대 수치는 "오픈데이터 기준"임을 UI에 명시 — 레퍼런스 문구 유지). 계약 CPO의 OCPI 피드가 해당 사업자 충전소에 대해 더 정확.
- **GDPR**: 운전자 위치는 브라우저에서만 처리하고 서버 영속화 금지(레퍼런스도 위치를 저장하지 않음 — 유지).

---

## 14. 흔한 함정 (레퍼런스 STATUS/DECISIONS에서 학습한 것)

- **폴백 취약점 재발 방지**: 레퍼런스는 폴백이 무거운 DB 모듈(sqlalchemy)을 import해 깨졌다. 이식본 폴백은 **SQLite 직접 조회**로 단순화.
- **예측 일반화**: BQML은 한 존만 학습했었다. statsmodels도 학습 데이터 있는 존만 정확; 그 외 존은 에이전트가 일반화함을 UI/프롬프트에 명시.
- **OSRM 공개 서버 한계**: 데모는 가능하나 운영은 레이트리밋/안정성 이슈 → 자체 호스팅으로.
- **모델 ID 드리프트**: Bedrock inference profile/Anthropic 모델 ID는 변동. **하드코딩하지 말고 env + 실행 시 검증**.
- **AgentCore/Strands API 버전차**: 정확한 CLI·스트림 이벤트 키는 설치 버전 문서로 확인. 본 문서는 **계약(입출력 스키마)** 을 기준으로 삼아라 — 내부 구현이 달라도 NDJSON/JSON 계약만 맞으면 프론트가 동작한다.
- **스키마 호환 사수**: §8 응답 필드와 §7.2 NDJSON 스키마를 바꾸면 `index.html`이 깨진다. 바꾸지 마라.

---

## 15. 작업 시작 전 체크

1. 이 저장소의 레퍼런스 원본을 먼저 정독: `agent.py`(전체), `templates/index.html`, `tools.yaml`, `mcp_server_local.py`, `scripts/ingest_ocm_apac.py`, `scripts/ocm_schema.json`, `docs/STATUS.md`, `docs/DECISIONS.md`.
2. §1 결정사항·§4 패리티 체크리스트를 작업 기준선으로 고정.
3. §12 Phase 0부터 순차 실행. 각 Phase 인수 기준을 직접 실행해 통과 확인 후 진행.
4. 불명확한 외부 API(AgentCore CLI, Strands 스트림 키, Bedrock 모델 ID, OCPI 엔드포인트 버전)는 **설치된 SDK/파트너 문서로 검증**하고, 본 문서의 입출력 계약을 불변식으로 유지.
```
