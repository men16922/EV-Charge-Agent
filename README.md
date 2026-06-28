# EV-Charge: Smart EV Charging Platform with AI Decision Agent

**EV-Charge** is a smart city EV charging infrastructure demand forecasting, routing, and troubleshooting decision platform. It integrates real-time telemetry, semantic manual search, and time-series demand forecasting using Google Cloud (AlloyDB, BigQuery ML) and Google ADK (Agent Development Kit).

---

## 🚀 Instant Local Run (Run-ability in 1-Click)

To run and evaluate the platform locally in a 100% offline, free sandbox environment:

### Prerequisites
*   Docker & Docker Compose
*   Python 3.10+

### Step 1: Spin up Vector DB, Ingest Data & Run Verification
Run the following commands to start the PostgreSQL+pgvector database, load raw NREL fuel stations & technical manual embeddings, and execute syntax checking & offline evaluations:
```bash
# Start local pgvector container
docker-compose up -d

# Ingest NREL data and technical troubleshooting steps locally
python3 scripts/load_data_local.py

# Verify compilation and run evaluation tests
make check
```

### Step 2: Start the Web Dashboard & Agent
Start the Flask web backend using the mock local MCP server:
```bash
python3 agent.py
```
Open **`http://localhost:8080`** in your browser to interact with the premium operator dashboard.

---

## 🛠️ Project Structure

*   **[`agent.py`](file:///Users/men1692/Desktop/GCP/APAC_HACKATHON/agent.py)**: Core Flask application. Initialises the Google ADK Agent, session runner, and routes user questions to database tools.
*   **[`agent_eval.py`](file:///Users/men1692/Desktop/GCP/APAC_HACKATHON/agent_eval.py)**: Offline/Online evaluation suite. Assesses Agent tool routing accuracy and groundedness (hallucination defense) using the Vertex Gen AI Evaluation Service.
*   **[`mcp_server_local.py`](file:///Users/men1692/Desktop/GCP/APAC_HACKATHON/mcp_server_local.py)**: FastMCP server providing simulated tools for offline testing without hitting GCP costs.
*   **[`tools.yaml`](file:///Users/men1692/Desktop/GCP/APAC_HACKATHON/tools.yaml)**: Database Toolbox configuration defining SQL statements for AlloyDB and BigQuery.
*   **[`docker-compose.yml`](file:///Users/men1692/Desktop/GCP/APAC_HACKATHON/docker-compose.yml)**: Local postgres database container configured with `pgvector` extension.
*   **[`scripts/ingest_data.sh`](file:///Users/men1692/Desktop/GCP/APAC_HACKATHON/scripts/ingest_data.sh)**: Automated shell script to download NREL Alternative Fuel Stations dataset, upload to GCS (Bronze), and load into BigQuery with auto schema detection (Silver/Gold).
*   **[`scripts/load_data_local.py`](file:///Users/men1692/Desktop/GCP/APAC_HACKATHON/scripts/load_data_local.py)**: Local Python script that downloads NREL dataset and loads it along with troubleshooting manual embeddings directly into the local `pgvector` container ($0 cost).
*   **[`MASTER_PLAN.md`](file:///Users/men1692/Desktop/GCP/APAC_HACKATHON/MASTER_PLAN.md)**: Full architecture design, data strategy (Zero-ETL Federation, external datasets), safety compliance, and cost minimization guidelines.
*   **[`QA_TEST.md`](file:///Users/men1692/Desktop/GCP/APAC_HACKATHON/QA_TEST.md)**: Step-by-step test guide to verify charger status, troubleshooting manuals, and ARIMA_PLUS forecasting locally.

---

## 📊 Evaluation Scorecard

Running `make check` evaluates the agent against test sets. The output includes routing precision and groundedness metrics:

*   **Routing exact_match**: Confirms requests map correctly to tools and parameters (e.g. `check_charger_status` for ID `CHG-1004`).
*   **Groundedness score**: Validates that agent responses are strictly grounded in retrieved database context and successfully flags/defends against hallucinations and prompt injection.

---

## 🛡️ Cost & Safety Architecture
For production environments, the platform incorporates:
1.  **Scale-to-Zero Auto-scaling**: Cloud Run container scales down to 0 instances when idle.
2.  **AlloyDB Start/Stop Scheduler**: Shuts down transactional databases in non-testing windows.
3.  **Human-in-the-Loop Safety Gate**: Pending action states written to Firestore to require SRE operator authorization.
4.  **Zero-ETL Lakehouse Federation**: Unifies AlloyDB live status and BigQuery analytical forecasts without data replication pipeline costs.
