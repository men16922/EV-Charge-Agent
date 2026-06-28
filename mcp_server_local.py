# mcp_server_local.py
# Hybrid Local MCP Server for EV-Charge EV AI Agent
# Dynamically connects to local pgvector PostgreSQL database when active,
# and falls back to static in-memory mock records if the database is offline.

from mcp.server.fastmcp import FastMCP
import json
from sqlalchemy import create_engine, text

mcp = FastMCP("EVChargeLocalServer")

# Configuration
DB_USER = "postgres"
DB_PASSWORD = "localpassword"
DB_HOST = "localhost"
DB_PORT = "5432"
DB_NAME = "ev_charge_db"

# Try to connect to the local pgvector database
def get_db_engine():
    connection_string = f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
    try:
        # Short timeout so starting the agent is fast even if DB is offline
        engine = create_engine(connection_string, connect_args={"connect_timeout": 2})
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        print("[MCP INFO] Connected to local pgvector PostgreSQL database successfully!")
        return engine
    except Exception:
        print("[MCP WARNING] Could not connect to local DB. Using in-memory fallback mocks.")
        return None

engine = get_db_engine()

# Mock database records (Fallback Layer)
CHARGERS = {
    "CHG-1001": {"charger_id": "CHG-1001", "status": "active", "current_load_kw": 45.2, "error_code": "NONE", "last_updated": "2026-06-22 20:55:00"},
    "CHG-1002": {"charger_id": "CHG-1002", "status": "idle", "current_load_kw": 0.0, "error_code": "NONE", "last_updated": "2026-06-22 20:56:00"},
    "CHG-1003": {"charger_id": "CHG-1003", "status": "broken", "current_load_kw": 0.0, "error_code": "ERR_CONN_TIMEOUT", "last_updated": "2026-06-22 18:30:00"},
    "CHG-1004": {"charger_id": "CHG-1004", "status": "broken", "current_load_kw": 0.0, "error_code": "ERR_OVERHEATING", "last_updated": "2026-06-22 20:45:00"},
}

MANUALS = [
    {
        "section_title": "Connector Overheating Troubleshooting Guide (ERR_OVERHEATING)",
        "troubleshooting_steps": "1. Turn off power at main distribution panel. 2. Inspect connector pins for carbon buildup. 3. Verify cooling fan function. 4. Reset thermal fuse.",
        "error_code": "ERR_OVERHEATING"
    },
    {
        "section_title": "Connection Timeout Troubleshooting (ERR_CONN_TIMEOUT)",
        "troubleshooting_steps": "1. Verify cellular/ethernet link LED status. 2. Cycle modem power (switch SW-3). 3. Check signal attenuation in settings dashboard. 4. Re-bind backend endpoints.",
        "error_code": "ERR_CONN_TIMEOUT"
    },
    {
        "section_title": "Standard Operating Specs",
        "troubleshooting_steps": "Standard charging session initialization takes 15 seconds. If timeout occurs, refer to ERR_CONN_TIMEOUT manual section.",
        "error_code": "NONE"
    }
]

@mcp.tool()
def check_charger_status(charger_id: str) -> str:
    """Checks the real-time status (active, idle, broken) and telemetry of a specific EV charger.

    Args:
        charger_id: The unique identifier of the EV charger (e.g., 'CHG-1004').
    """
    if engine:
        try:
            with engine.connect() as conn:
                result = conn.execute(
                    text("SELECT charger_id, status, current_load_kw, error_code, last_updated FROM live_charger_status WHERE charger_id = :id"),
                    {"id": charger_id}
                ).fetchone()
                if result:
                    return json.dumps({
                        "charger_id": result[0],
                        "status": result[1],
                        "current_load_kw": float(result[2]),
                        "error_code": result[3],
                        "last_updated": str(result[4])
                    })
        except Exception as e:
            print(f"[MCP ERROR] live_charger_status query failed: {e}. Falling back.")

    # Fallback to local memory mock
    c = CHARGERS.get(charger_id)
    if c:
        return json.dumps(c)
    return json.dumps({"error": f"Charger {charger_id} not found."})

@mcp.tool()
def search_manual_embeddings(query_text: str, limit_count: int = 1) -> str:
    """Performs similarity search to find troubleshooting steps or specs in the EV charger manuals.

    Args:
        query_text: The search query or error description (e.g. 'overheating warning', 'connector lock failed').
        limit_count: The maximum number of manual entries to return.
    """
    if engine:
        try:
            with engine.connect() as conn:
                # Rank results based on matching the query error code or section title keyword
                sql = """
                    SELECT section_title, troubleshooting_steps, error_code
                    FROM ev_charger_manuals
                    ORDER BY
                      CASE
                        WHEN error_code = :query THEN 1
                        WHEN section_title ILIKE :query_like THEN 2
                        ELSE 3
                      END
                    LIMIT :limit
                """
                query_like = f"%{query_text}%"
                results = conn.execute(
                    text(sql),
                    {"query": query_text, "query_like": query_like, "limit": limit_count}
                ).fetchall()
                if results:
                    return json.dumps([
                        {
                            "section_title": r[0],
                            "troubleshooting_steps": r[1],
                            "error_code": r[2]
                        } for r in results
                    ])
        except Exception as e:
            print(f"[MCP ERROR] ev_charger_manuals query failed: {e}. Falling back.")

    # Fallback to local memory mock
    query_text_lower = query_text.lower()
    matches = []
    for doc in MANUALS:
        score = 0.0
        if doc["error_code"].lower() in query_text_lower:
            score += 0.9
        for word in query_text_lower.split():
            if word in doc["section_title"].lower() or word in doc["troubleshooting_steps"].lower():
                score += 0.2
        if score > 0.0:
            matches.append((score, doc))

    matches.sort(key=lambda x: x[0], reverse=True)
    results = [m[1] for m in matches[:limit_count]]
    if not results:
        results = [MANUALS[2]]
    return json.dumps(results)

@mcp.tool()
def predict_charging_demand(zone_id: str, forecast_horizon: int = 24) -> str:
    """Queries the forecasting model to predict EV charging demand for a specific zone and holiday timeline.

    Args:
        zone_id: The geographic zone ID to forecast demand for (e.g. 'ZONE_GANGNAM').
        forecast_horizon: The forecasting timeline horizon (e.g., 24 for 24 hours, 7 for 7 days).
    """
    # Mocking BQML ARIMA_PLUS forecast output
    predictions = []
    base_demand = 85.0 if "GANGNAM" in zone_id else 45.0
    for hour in range(1, forecast_horizon + 1):
        # Add peak holiday demand fluctuation
        multiplier = 1.3 if (12 <= hour <= 15 or 18 <= hour <= 21) else 0.8
        value = base_demand * multiplier
        predictions.append({
            "forecast_timestamp": f"2026-06-23 {hour:02d}:00:00 UTC",
            "forecast_value": round(value, 2),
            "prediction_interval_lower_bound": round(value * 0.9, 2),
            "prediction_interval_upper_bound": round(value * 1.1, 2)
        })
    return json.dumps(predictions)

if __name__ == "__main__":
    mcp.run()
