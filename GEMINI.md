## 1. Project Context
- **Project Name**: EV-Charge AI Agent
- **Domain**: This project is centralized around "EV-Charge", a smart city EV charging infrastructure demand forecasting, routing, and troubleshooting decision platform.
- **Data**: Real-time status data resides in AlloyDB table `live_charger_status` and manual embeddings in `ev_charger_manuals`. Historical charging sessions and ARIMA_PLUS ML forecasting are processed in BigQuery `ev_data_schema` dataset.

## 2. Execution & Data Processing Rules
- **CRITICAL RULE - Structured Specs**: Unstructured manuals parsed via Dataplex semantic inference are stored in the BigQuery/AlloyDB schemas for query.
- **CRITICAL RULE - Dataset Queries**: When referencing tables in BigQuery, ensure you use the dataset ID prefix (`ev_data_schema`). For example, to query historical orders, use `ev_data_schema.historical_charging_orders`.
- **CRITICAL RULE - Vector Search**: Manual searches must utilize ScaNN IVFFLAT cosine similarity metrics inside AlloyDB (`embedding <=> embedding('text-embedding-004', query)::vector`).
- **CRITICAL RULE - Local Development**: Always prioritize testing using `docker-compose.yml` (PostgreSQL with pgvector) and `mcp_server_local.py` for sandbox validation before deploying tools via `deploy.sh`.
