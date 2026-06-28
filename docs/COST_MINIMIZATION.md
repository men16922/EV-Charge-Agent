# EV-Charge AI Agent 비용 최소화 가이드 (Cost Minimization Guide)

이 문서는 **무료 크레딧 계정**을 사용하는 개발자가 **EV-Charge EV AI Agent** 플랫폼을 개발, 테스트, 데모할 때 GCP 크레딧 차감을 방지하고 비용을 최소화하기 위한 구체적인 가이드라인을 제공합니다.

---

## 1. 로컬 테스트 케이스 (Local Testing Case - 비용 0원)

GCP에 리소스를 배포하기 전, 로컬 환경에서 개발을 진행하는 단계로 **비용이 전혀 발생하지 않습니다 (₩0원)**.

### 💡 핵심 최적화 방안
1. **로컬 벡터 DB 활용**:
   - GCP AlloyDB 대신 로컬 Docker로 `ankane/pgvector:v0.5.1` 이미지를 실행하여 벡터 임베딩 저장 및 유사도 검색을 오프라인에서 무료로 테스트합니다.
2. **모의 MCP 서버 (`mcp_server_local.py`)**:
   - BigQuery 및 AlloyDB 쿼리 요청을 가로채서 하드코딩된 Mock JSON 데이터를 반환하는 FastMCP 서버를 구동하여 데이터베이스 비용을 차단합니다.
3. **Vertex AI 및 gcloud 인증 활용**:
   - Vertex AI 서비스를 사용하므로, 로컬 환경에서도 `gcloud auth application-default login`을 수행하여 `yeongsigchoe7@gmail.com` 계정의 GCP 크레딧 및 권한을 사용하여 Gemini 1.5/3.5 Flash API를 호출합니다.


### 🛠️ 로컬 실행 방법
```bash
# 1. 로컬 PostgreSQL+pgvector 실행
docker-compose up -d

# 2. 에이전트 실행 (자동으로 local mcp 서버 기동하여 Stdio 통신)
python3 agent.py
```

---

## 2. GCP 배포 케이스 (GCP Deployment Case - 무료 크레딧 방어)

로컬 검증을 마친 후 GCP에 플랫폼을 실배포하는 단계입니다. 관리 소홀 시 비용이 급증할 수 있으므로 아래 수칙을 반드시 이행해야 합니다.

### 💰 핵심 리소스별 요금 방어 전략

### 2.1 AlloyDB for PostgreSQL (비용 유발 1순위)
AlloyDB는 데이터가 없더라도 인스턴스가 켜져 있으면 지속적으로 vCPU 및 RAM 비용이 시간당 청구됩니다.
* **방어 대책**: **개발/시연이 끝나면 즉시 인스턴스를 정지(Stop)하십시오.**
* **인스턴스 정지 (컴퓨트 요금 $0):**
  ```bash
  gcloud alloydb instances stop ev-charge-primary --cluster=ev-charge-alloydb-cluster --region=us-central1
  ```
* **인스턴스 시작 (테스트 재개 시):**
  ```bash
  gcloud alloydb instances start ev-charge-primary --cluster=ev-charge-alloydb-cluster --region=us-central1
  ```
* **효과**: 24시간 가동 시 **월 약 $195.56 (₩270,000)**이 소모되나, 1일 1시간만 기동할 경우 **월 약 $8.15 (₩11,000)**로 95% 이상 비용을 아낄 수 있습니다. (정지 상태 시 스토리지 요금 $0.30/GB-month만 부과됨)

### 2.2 Cloud Run (MCP Toolbox)
* **방어 대책**: 최소 인스턴스 개수를 `0`으로 지정하여 배포합니다.
  ```bash
  gcloud run deploy ev-mcp-toolbox \
    --image gcr.io/your-project-id/ev-mcp-toolbox \
    --region us-central1 \
    --min-instances 0 \
    --max-instances 2
  ```
* **효과**: 요청이 없을 때 컨테이너가 자동으로 완전히 내려가기 때문에 (Scale-to-Zero), 월 200만 CPU-초에 해당하는 무료 티어 안에서 100% 무료 운영이 가능합니다.

### 2.3 BigQuery & BigQuery ML (ARIMA_PLUS)
BigQuery는 온디맨드 쿼리 스캔량(TB) 단위로 과금되며, 특히 BQML 모델 학습(CREATE MODEL)은 다량의 하이퍼파라미터를 탐색하므로 스캔 요금이 비쌉니다 ($312.50 / TB).
* **방어 대책**:
  - `historical_charging_orders` 조회 시 `SELECT *` 대신 필요한 컬럼만 지정하고, `LIMIT` 및 `WHERE session_start_timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 7 DAY)` 등의 날짜 파티션 필터를 반드시 적용하여 쿼리 당 스캔량을 수 MB 수준으로 제한합니다.
  - BQML `CREATE MODEL` 명령어는 잦은 실행을 피하고, 1~2회만 실행하여 모델을 생성한 뒤 `ML.FORECAST`로 호출만 수행합니다.

### 2.4 Vertex AI (Gemini 3.5 Flash)
* **방어 대책**:
  - 개발 시 가격이 무거운 `Gemini Pro` 모델 대신, **Gemini 3.5 Flash**를 기본 모델로 사용합니다. (Flash 모델은 Pro 대비 약 20배 저렴합니다.)
  - 장애 대응 매뉴얼 텍스트가 큰 경우 **Context Caching** 기능을 사용하여 중복 입력되는 컨텍스트 비용을 50% 수준으로 절감합니다.
