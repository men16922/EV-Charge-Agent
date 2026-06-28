### 1. 현재 해커톤의 일정 및 목표

*   **해커톤 일정:** 이번 'Google Cloud Gen AI Academy APAC Edition (Cohort 2)'는 2026년 4월부터 7월까지 진행되는 프로그램입니다. 현재까지 논의된 바에 따르면(이전 대화 기준), 6월 25일에 대시보드 내 팀 빌딩 및 프로젝트 제출(Submission) 창이 정식으로 오픈됩니다.
*   **해커톤 목표:** 정형 및 비정형 데이터를 AI, 데이터 분석, 지능형 자동화를 통해 '실행 가능한 인텔리전스(Actionable Intelligence)'로 변환하는 **'AI 기반 의사결정 인텔리전스 플랫폼(AI-Powered Decision Intelligence Platform)'**을 구축하는 것입니다. 궁극적으로 AI와 데이터를 활용하여 더 안전하고, 건강하며, 효율적이고, 지속 가능한 지역 사회(스마트 커뮤니티)를 만드는 방법을 증명해야 합니다.

---

### 2. 선택한 주제

*   **메인 트랙:** 주제 1. AI-Powered Decision Intelligence Platform
*   **세부 유스케이스 (Use Case):** 스마트 시티 및 공공 서비스 (Smart Cities & Public Services) - 교통 개선, 공공 안전, 도시 계획.
*   **프로젝트명 (가칭):** EV-Charge AI Agent (스마트 시티 EV 충전 인프라 수요 예측 및 라우팅 에이전트)
    *   **선정 배경:** 질문자님의 글로벌 EV 충전 플랫폼(eMSP) 백엔드 개발 및 SRE 경험(EV-Charge), 그리고 멀티 에이전트 구축(AWS Bedrock Hackathon) 역량을 100% 발휘할 수 있는 주제입니다.

---

### 3. 주제 상세한 제안 (Antigravity 2.0 IDE 개발 지시용 프롬프트 구조)

AI 중심 개발 환경인 **Antigravity IDE**는 대규모 멀티모달 컨텍스트와 자율 도구 사용 기능이 통합되어 있어, 프롬프트만으로 복잡한 데이터 파이프라인과 코드를 생성할 수 있습니다. 아래의 상세 명세서를 Antigravity 2.0의 'Data Agent Kit 확장 프로그램' 채팅 창에 붙여넣어 에이전트가 전체 아키텍처 코드를 작성하도록 지시하십시오.

#### 🚀 [Antigravity 2.0 입력용 시스템 아키텍처 및 개발 명세서]

**[Project Overview]**
이 프로젝트는 Google Cloud 생태계(BigQuery, AlloyDB, MCP, ADK, Vertex AI)를 활용하여 '스마트 시티 EV 충전 인프라 라우팅 및 수요 예측 에이전트'를 구축하는 것입니다. 보안(MCP), 제로 ETL 페더레이션(Lakehouse Federation), 실시간 트랜잭션(HTAP)을 모두 포함하는 3티어 아키텍처를 작성해 주세요.

**[Architecture Layers & Component Specs]**

**Layer 1. Data Ingestion & Warehouse (BigQuery & Dataplex)**
*   **요구사항:** Cloud Storage 버킷(`ev_data_bucket`)에 저장된 'EV 충전기 장애 대응 매뉴얼(PDF)' 및 '과거 충전 이력(CSV)'을 수집합니다.
*   **작업 지시:**
    1. Dataplex DataScan 작업 코드를 구성하고, 반드시 **'의미론적 추론 사용 설정(Enable Semantic Inference)'**을 포함하여 비정형 PDF에서 알레르기/재료를 뽑아내듯 충전기 모델 스펙과 장애 해결 지침을 추론하여 BigQuery 테이블(`ev_data_schema`)로 구조화하는 SQL 스키마를 생성하세요.
    2. 과거 충전 이력(Orders/Sessions) 데이터를 BigQuery에 적재하는 DDL을 작성하세요.

**Layer 2. HTAP & Zero-ETL Database (AlloyDB)**
*   **요구사항:** 실시간 충전기 트랜잭션 데이터베이스이자 벡터 검색 엔진인 AlloyDB를 구성합니다.
*   **작업 지시:**
    1. 실시간 충전기 상태(사용 중, 대기, 고장)를 저장할 `live_charger_status` 테이블 DDL을 작성하세요.
    2. AlloyDB에서 BigQuery의 `ev_data_schema`를 쿼리할 수 있도록 **Lakehouse Federation (외부 데이터 래퍼)** 연결 SQL 스크립트를 작성하여 데이터를 복제하지 않고(Zero ETL) 실시간 분석이 가능하게 하세요.
    3. 매뉴얼 텍스트 검색을 위해 `pgvector`가 아닌 Google Research의 **ScaNN 인덱스**를 활용하여 IVFFLAT 고성능 벡터 유사도 검색을 수행하는 SQL을 작성하세요.

**Layer 3. Secure API Layer (MCP Toolbox on Cloud Run)**
*   **요구사항:** AI 에이전트가 프로덕션 데이터베이스에 직접 접근하는 것을 막는 보안 추상화 레이어를 구축합니다.
*   **작업 지시:**
    1. `tools.yaml` 파일을 선언적으로 작성하세요. 에이전트가 호출할 수 있는 도구로 `check_charger_status` (AlloyDB 라이브 상태 확인), `search_manual_embeddings` (ScaNN 유사도 검색), `predict_charging_demand` (BigQuery 통합 데이터 기반 쿼리) 세 가지를 정의하세요.
    2. 이 도구 상자를 Cloud Run에 배포하기 위한 Dockerfile 및 gcloud CLI 배포 스크립트를 생성하세요.

**Layer 4. AI Orchestration Layer (ADK & Gemini 3.5 Flash)**
*   **요구사항:** Agent Development Kit (ADK)의 `MCPToolset`을 사용하여 Cloud Run에 배포된 MCP 서버와 통신하는 Flask 기반의 에이전트를 구축합니다.
*   **작업 지시:**
    1. `app.py` 또는 `agent.py`를 작성하세요. `LlmAgent`와 `InMemorySessionService`를 초기화하고, `MCPToolset`의 `SseServerParams`(원격) 또는 `StdioServerParameters`(로컬)를 설정하여 앞서 만든 MCP 도구 상자와 바인딩하세요.
    2. Gemini Flash 모델을 백엔드로 사용하도록 설정하세요.

**Layer 5. BQML & Evaluation (ML.FORECAST & Gemini Eval API)**
*   **요구사항:** 시스템의 안전성을 증명하고 관리자용 수요 예측 대시보드를 구축합니다.
*   **작업 지시:**
    1. **평가 파이프라인:** `agent_eval.py`를 작성하여 Gemini Agent Eval API (`vertexai.evaluation`)를 사용한 이중 트랙 평가 코드를 작성하세요. 1단계 '도구 라우팅 정확성(Exact Match)', 2단계 '의도적 할루시네이션 및 SQL 인젝션 방어(Grounding)' 시나리오를 포함하세요.
    2. **데이터 예측:** BigQuery ML을 활용하여 특정 구역의 명절 연휴 EV 충전 수요를 시계열로 예측하는 `CREATE MODEL ... OPTIONS(model_type='ARIMA_PLUS')` 및 `ML.FORECAST` SQL 쿼리 코드를 생성하세요.

**[Execution Strategy for Antigravity]**
위의 명세서를 바탕으로 `requirements.txt`, `.env` 템플릿 파일, `tools.yaml`, `agent.py`, `agent_eval.py` 코드를 순서대로 작업 공간에 자동 생성해 줘.