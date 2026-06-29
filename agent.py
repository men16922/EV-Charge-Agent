import os
import asyncio
from flask import (Flask, request, jsonify, render_template, Response,
                   stream_with_context, send_from_directory, abort)
from dotenv import load_dotenv

# ADK and MCP Imports
from google import adk
from google.adk.sessions import InMemorySessionService
from google.adk.tools import McpToolset
from google.adk.tools.mcp_tool.mcp_toolset import SseConnectionParams, StdioConnectionParams
from mcp import StdioServerParameters
from google.genai import types as genai_types

# Load environment variables
load_dotenv()

PROJECT_ID = os.getenv("PROJECT_ID", "project-ec7809f7-0fb5-45d4-b6d")
LOCATION = os.getenv("GOOGLE_CLOUD_LOCATION", "us-central1")
MODEL = os.getenv("MODEL", "gemini-2.5-flash")
MCP_URL = os.getenv("MCP_TOOLBOX_SERVER_URL", "https://mcp-toolbox-xxxxxx.a.run.app")
BQ_DATASET = os.getenv("BQ_DATASET", "ev_data_schema")
STATIONS_TABLE = f"{PROJECT_ID}.{BQ_DATASET}.ev_charging_stations"
USER = "default_user"
APP_NAME = "EVChargeAIPlatform"

app = Flask(__name__, static_folder='static', static_url_path='/static')

# Built React (Vite) bundle lives in ./dist and is served from this same
# Cloud Run service (single-service deploy → $0 idle, no CORS).
DIST_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'dist')

# --- Cost guardrails for the public demo --------------------------------------
# Hard daily caps on the paid operations so abuse can never run up the bill.
# In-memory; for an exact global cap deploy the demo with --max-instances 1.
import time as _time
from collections import defaultdict

DAILY_CAPS = {"chat": 600, "route": 500, "live": 50, "poi": 50}  # per day, across all users
IP_PER_MIN = 12                                          # per-IP burst guard
_rl = {"day": "", "global": defaultdict(int), "ip": defaultdict(list)}


def rate_limited(kind):
    """Returns (blocked: bool, message: str|None) for a paid endpoint hit."""
    day = _time.strftime("%Y-%m-%d", _time.gmtime())
    if _rl["day"] != day:
        _rl["day"] = day
        _rl["global"].clear()
        _rl["ip"].clear()
    ip = (request.headers.get("X-Forwarded-For", request.remote_addr or "?")).split(",")[0].strip()
    now = _time.time()
    recent = [t for t in _rl["ip"][ip] if now - t < 60]
    _rl["ip"][ip] = recent
    if len(recent) >= IP_PER_MIN:
        return True, "Too many requests — please slow down and try again in a minute."
    if _rl["global"][kind] >= DAILY_CAPS.get(kind, 10_000):
        return True, "This public demo hit its daily limit. Please try again tomorrow. 🙏"
    recent.append(now)
    _rl["global"][kind] += 1
    return False, None


# --- BigQuery geospatial layer (real APAC charging stations from Open Charge Map) ---
# Queried directly (no MCP) so the map and the agent share one fast path that works
# identically in local dev and on Cloud Run.
_bq_client = None


def get_bq():
    global _bq_client
    if _bq_client is None:
        from google.cloud import bigquery
        _bq_client = bigquery.Client(project=PROJECT_ID)
    return _bq_client


def sim_live_status(station_id, total_points):
    """Deterministic simulated live availability for a station (free; no API call).

    Varies on a ~5-minute bucket so the map feels live, but is stable within a
    window and consistent across calls. Clearly surfaced as 'simulated' in the UI.
    """
    import time
    total = max(1, int(total_points or 1))
    bucket = int(time.time() // 300)  # changes every 5 minutes
    h = (int(station_id) * 2654435761 + bucket * 40503) & 0xFFFFFFFF
    if h % 100 < 8:  # ~8% offline
        return {"live": "offline", "available": 0, "total": total, "source": "simulated"}
    occupied = (h >> 5) % (total + 1)
    available = total - occupied
    state = "available" if available > 0 else "busy"
    return {"live": state, "available": available, "total": total, "source": "simulated"}


def query_nearby_stations(lat, lon, radius_m=5000.0, min_power_kw=0.0, limit=20, connector=""):
    """Return charging stations within radius_m of (lat, lon).

    When a connector is given (ccs / chademo / tesla / type 2), stations whose
    plug matches the car are flagged (is_match) and ranked first, so the driver
    gets COMPATIBLE chargers before incompatible ones.
    """
    from google.cloud import bigquery
    conn = (connector or "").lower().strip()
    sql = f"""
        SELECT station_id, title, town, operator, status, max_power_kw,
               connector_types, usage_cost, num_points, lat, lon,
               ROUND(ST_DISTANCE(geog, ST_GEOGPOINT(@lon, @lat))) AS distance_m,
               CASE
                 WHEN @conn = '' THEN 0
                 WHEN @conn = 'tesla' AND (LOWER(connector_types) LIKE '%tesla%'
                                           OR LOWER(connector_types) LIKE '%nacs%') THEN 1
                 WHEN @conn != 'tesla' AND LOWER(connector_types) LIKE CONCAT('%', @conn, '%') THEN 1
                 ELSE 0
               END AS is_match
        FROM `{STATIONS_TABLE}`
        WHERE ST_DWITHIN(geog, ST_GEOGPOINT(@lon, @lat), @radius_m)
          AND (@min_power_kw <= 0 OR max_power_kw >= @min_power_kw)
        ORDER BY is_match DESC, distance_m
        LIMIT @limit
    """
    cfg = bigquery.QueryJobConfig(query_parameters=[
        bigquery.ScalarQueryParameter("lat", "FLOAT64", float(lat)),
        bigquery.ScalarQueryParameter("lon", "FLOAT64", float(lon)),
        bigquery.ScalarQueryParameter("radius_m", "FLOAT64", float(radius_m)),
        bigquery.ScalarQueryParameter("min_power_kw", "FLOAT64", float(min_power_kw)),
        bigquery.ScalarQueryParameter("limit", "INT64", int(limit)),
        bigquery.ScalarQueryParameter("conn", "STRING", conn),
    ])
    rows = [dict(r) for r in get_bq().query(sql, job_config=cfg).result()]
    for r in rows:  # attach free simulated live availability
        r.update(sim_live_status(r["station_id"], r.get("num_points")))
    return rows


def find_nearby_stations(latitude: float, longitude: float,
                         radius_km: float = 5.0, min_power_kw: float = 0.0,
                         connector: str = "") -> dict:
    """Find real EV charging stations near a geographic location.

    Use this whenever the user shares or implies a location (e.g. "near me",
    "around Gangnam") and wants charging options. Returns the closest stations
    with operator, connector types, max power (kW), distance, and live availability.
    Pass the car's connector to rank COMPATIBLE chargers first and get a count of
    how many actually fit the car.

    Args:
        latitude: Latitude of the user's location (decimal degrees).
        longitude: Longitude of the user's location (decimal degrees).
        radius_km: Search radius in kilometers (default 5).
        min_power_kw: Only return stations with at least this power in kW
            (e.g. 50 for DC fast charging). Use 0 for no filter.
        connector: The car's connector — 'ccs', 'chademo', 'tesla', or 'type 2'.
            Stations with a matching plug (is_match=1) are ranked first. If 0 are
            compatible, tell the user and suggest widening the search.
    """
    rows = query_nearby_stations(latitude, longitude, radius_km * 1000.0,
                                 min_power_kw, limit=8, connector=connector)
    compatible = sum(1 for r in rows if r.get("is_match"))
    return {"count": len(rows), "compatible": compatible, "stations": rows}


def plan_route(from_latitude: float, from_longitude: float,
               to_latitude: float, to_longitude: float) -> dict:
    """Compute a driving route to a charging station with distance and ETA.

    Uses Google Routes API (traffic-aware) where available, and automatically
    falls back to OpenStreetMap routing for regions Google cannot route (e.g.
    South Korea). Use this after recommending a station, to tell the user how far
    and how long the drive is.

    Args:
        from_latitude: Origin latitude.
        from_longitude: Origin longitude.
        to_latitude: Destination (station) latitude.
        to_longitude: Destination (station) longitude.
    """
    r = (_google_route(from_latitude, from_longitude, to_latitude, to_longitude)
         or _osrm_route(from_latitude, from_longitude, to_latitude, to_longitude))
    if not r:
        return {"error": "no route found"}
    return {
        "provider": r["provider"],
        "distance_km": round((r.get("distance_m") or 0) / 1000.0, 2),
        "duration_min": round((r.get("duration_s") or 0) / 60.0),
    }


def check_live_availability(latitude: float, longitude: float, station_name: str) -> dict:
    """Get the live availability of a specific charging station (how many of its
    plugs are free right now). Tries real-time data from Google Maps first and
    falls back to a simulated live estimate. Use when the user asks whether a
    particular station is free / busy / available right now.

    Args:
        latitude: Station latitude.
        longitude: Station longitude.
        station_name: Station name/title to look up.
    """
    real = _places_live(station_name, latitude, longitude)
    if real:
        return real
    sim = sim_live_status(abs(hash(station_name)) % 1_000_000, 4)
    sim["note"] = "Real-time feed unavailable here; showing a simulated estimate."
    return sim


def find_charging_deserts(latitude: float, longitude: float, radius_km: float = 8.0) -> dict:
    """Analyze charging-infrastructure equity around a location: find 'charging
    deserts' — sub-areas where the nearest charger is far away (>2 km). Use this
    for community / city-planning questions about coverage gaps and underserved
    areas, not for routing a single driver.

    Args:
        latitude: Center latitude of the area to analyze.
        longitude: Center longitude of the area to analyze.
        radius_km: Half-size of the square area to scan (default 8 km).
    """
    from google.cloud import bigquery
    half = radius_km / 111.0
    step = round(2 * half / 12, 4)
    sql = f"""
        WITH grid AS (
          SELECT lat_c, lon_c
          FROM UNNEST(GENERATE_ARRAY(@s, @n, @step)) AS lat_c,
               UNNEST(GENERATE_ARRAY(@w, @e, @step)) AS lon_c
        ),
        nn AS (
          SELECT (SELECT MIN(ST_DISTANCE(s.geog, ST_GEOGPOINT(lon_c, lat_c)))
                  FROM `{STATIONS_TABLE}` s
                  WHERE ST_DWITHIN(s.geog, ST_GEOGPOINT(lon_c, lat_c), 25000)) AS nm
          FROM grid
        )
        SELECT COUNT(*) AS cells, COUNTIF(nm > 2000) AS deserts,
               ROUND(MAX(nm)) AS worst_gap_m
        FROM nn
    """
    cfg = bigquery.QueryJobConfig(query_parameters=[
        bigquery.ScalarQueryParameter("s", "FLOAT64", latitude - half),
        bigquery.ScalarQueryParameter("n", "FLOAT64", latitude + half),
        bigquery.ScalarQueryParameter("w", "FLOAT64", longitude - half),
        bigquery.ScalarQueryParameter("e", "FLOAT64", longitude + half),
        bigquery.ScalarQueryParameter("step", "FLOAT64", step),
    ])
    try:
        row = dict(list(get_bq().query(sql, job_config=cfg).result())[0])
        cells = row.get("cells") or 0
        deserts = row.get("deserts") or 0
        return {
            "area_km": radius_km * 2,
            "cells_analyzed": cells,
            "desert_cells": deserts,
            "desert_pct": round(deserts / cells * 100, 1) if cells else 0,
            "worst_gap_km": round((row.get("worst_gap_m") or 0) / 1000.0, 1),
            "note": "Based on Open Charge Map open data; gaps reflect open-data coverage.",
        }
    except Exception as e:
        return {"error": str(e)}


def community_impact(country_code: str = "") -> dict:
    """Community / sustainability impact stats for the charging network: number of
    stations, share open to the public, fast/ultra counts, and estimated CO2
    avoided per year. Use for environmental-impact and city-stakeholder questions.

    Args:
        country_code: Optional ISO-2 code (e.g. 'KR', 'JP') to scope to one country;
            empty for all of APAC.
    """
    from google.cloud import bigquery
    where = "WHERE country_code = @c" if country_code else ""
    params = [bigquery.ScalarQueryParameter("c", "STRING", country_code)] if country_code else []
    sql = f"""
        SELECT COUNT(*) AS total, COUNTIF(max_power_kw>=50) AS fast,
               COUNTIF(max_power_kw>=150) AS ultra,
               ROUND(SAFE_DIVIDE(COUNTIF(LOWER(usage_type) LIKE '%public%'), COUNT(*))*100,1) AS public_pct,
               SUM(num_points) AS total_points
        FROM `{STATIONS_TABLE}` {where}
    """
    try:
        row = dict(list(get_bq().query(sql, job_config=bigquery.QueryJobConfig(query_parameters=params)).result())[0])
        points = row.get("total_points") or 0
        row["co2_avoided_tonnes_yr"] = round(points * 20 * 365 * 0.25 / 1000)
        row["co2_assumption"] = "≈20 kWh/port/day, 0.25 kg CO2 avoided per kWh"
        return row
    except Exception as e:
        return {"error": str(e)}


def find_pois_near(latitude: float, longitude: float, poi_type: str = "restaurant",
                   charge_minutes: int = 0) -> dict:
    """Find walkable points of interest (restaurants, cafes, shopping, parking,
    attractions) near a charging stop, so the driver can use the time while the car
    charges — a 'smart life' suggestion, not just a charge. Combine the estimated
    charge time with nearby POIs to propose a concrete plan.

    Args:
        latitude: The charging station latitude.
        longitude: The charging station longitude.
        poi_type: One of 'restaurant', 'cafe', 'shopping_mall', 'parking',
            'tourist_attraction'.
        charge_minutes: Estimated minutes the car will be charging. When > 0, only
            POIs whose round-trip walk plus a short visit fit the window are kept.
    """
    real = _places_pois(latitude, longitude, poi_type)
    pois = real if real is not None else _sim_pois(latitude, longitude, poi_type)
    if charge_minutes and charge_minutes > 0:
        fits = [p for p in pois if p["walk_min"] * 2 + 10 <= charge_minutes]
    else:
        fits = pois
    return {"poi_type": poi_type, "charge_minutes": charge_minutes,
            "count": len(fits or pois), "pois": fits or pois,
            "source": "google_places" if real is not None else "simulated"}


def plan_trip(stops: list) -> dict:
    """Plan a multi-stop EV trip. `stops` is an ORDERED list of waypoints, each a
    dict {name, latitude, longitude}. Computes each leg's driving distance/ETA
    (Google Routes → OSRM fallback), totals them, and is the basis for suggesting
    where to charge or where congestion may bite. Use for 'plan a trip from A to B
    to C', road-trips, or shopping/dinner/parking multi-destination requests.

    Args:
        stops: Ordered waypoints [{name, latitude, longitude}, ...] (2 or more).
    """
    if not stops or len(stops) < 2:
        return {"error": "need at least 2 stops"}
    legs = []
    for a, b in zip(stops, stops[1:]):
        r = plan_route(a.get("latitude"), a.get("longitude"),
                       b.get("latitude"), b.get("longitude"))
        legs.append({"from": a.get("name"), "to": b.get("name"),
                     "distance_km": r.get("distance_km"), "duration_min": r.get("duration_min"),
                     "provider": r.get("provider")})
    total_km = round(sum((l.get("distance_km") or 0) for l in legs), 1)
    total_min = round(sum((l.get("duration_min") or 0) for l in legs))
    return {"legs": legs, "total_km": total_km, "total_min": total_min, "stops": len(stops)}

@app.route('/')
def index():
    """Serve the built React (Vite) app; fall back to the legacy template."""
    if os.path.exists(os.path.join(DIST_DIR, 'index.html')):
        return send_from_directory(DIST_DIR, 'index.html')
    return render_template('index.html')


@app.route('/assets/<path:filename>')
def dist_assets(filename):
    """Vite hashed JS/CSS bundles."""
    return send_from_directory(os.path.join(DIST_DIR, 'assets'), filename)


@app.route('/<path:filename>')
def dist_root(filename):
    """SPA fallback for top-level files (favicon, vite.svg, client routes).
    Never shadows API / chat / static — those are 404'd here and handled by
    their own (more specific) registered routes first."""
    if filename.startswith(('api/', 'chat', 'static/', 'assets/')):
        abort(404)
    full = os.path.join(DIST_DIR, filename)
    if os.path.isfile(full):
        return send_from_directory(DIST_DIR, filename)
    # unknown path → SPA entry point
    if os.path.exists(os.path.join(DIST_DIR, 'index.html')):
        return send_from_directory(DIST_DIR, 'index.html')
    abort(404)

# Global variables for agent and runner
agent = None
runner = None
global_session = None
session_service = None

async def init_agent():
    global agent, runner, global_session, session_service
    print("Initializing EV-Charge EV AI Agent...")

    # Determine whether to use remote SSE or local Stdio for MCP server
    # Cloud Run MCP server uses SSE transport. Locally, we might run it via stdio command.
    if MCP_URL and not MCP_URL.startswith("https://mcp-toolbox-xxxxxx"):
        print(f"Connecting to remote MCP server via SSE: {MCP_URL}")
        # Ensure the URL endpoints for SSE are correctly formatted
        sse_url = MCP_URL if "/sse" in MCP_URL else f"{MCP_URL.rstrip('/')}/sse"
        connection_params = SseConnectionParams(
            url=sse_url,
            timeout=30.0
        )
    else:
        print("Falling back to local MCP Stdio server configuration...")
        server_params = StdioServerParameters(
            command="python3",
            args=["mcp_server_local.py"] # Local mock server file
        )
        connection_params = StdioConnectionParams(
            server_params=server_params,
            timeout=30.0
        )

    # Initialize McpToolset with connection params
    toolset = McpToolset(connection_params=connection_params)

    # Retrieve tools exposed by the MCP database toolbox
    try:
        all_tools = await toolset.get_tools()
        print(f"Successfully loaded {len(all_tools)} tools from MCP server:")
        for t in all_tools:
            tool_name = getattr(t, 'name', getattr(t, 'tool_name', str(t)))
            print(f" - {tool_name}")
    except Exception as e:
        print(f"Warning: Could not connect to MCP server ({e}). Using empty tool list for local testing.")
        all_tools = []

    # Add BigQuery-backed geospatial + hybrid-routing tools (real APAC stations).
    # ADK auto-wraps typed, docstring'd Python callables as FunctionTools.
    all_tools.append(find_nearby_stations)
    all_tools.append(plan_route)
    all_tools.append(find_charging_deserts)
    all_tools.append(community_impact)
    all_tools.append(check_live_availability)
    all_tools.append(find_pois_near)
    all_tools.append(plan_trip)

    # Configure the Smart-EV Agent (predictive charging + smart-life decision intelligence)
    agent = adk.Agent(
        name="Smart_EV_Agent",
        model=MODEL,
        description="Smart-EV copilot: charging, routing, trip planning and what-to-do-while-charging for drivers and city stakeholders across APAC.",
        tools=all_tools,
        instruction="""
You are the Smart-EV Agent, an AI Decision Intelligence copilot that helps EV drivers and
city stakeholders across the Asia-Pacific region make better charging AND everyday-life decisions.
You don't just find a plug — you plan the drive, simulate it, and suggest what to do while the car
charges. You combine real charging-station geodata (Open Charge Map, in BigQuery) with BigQuery ML
demand forecasting, Google Maps routing, nearby points of interest, and Gemini reasoning.

TOOLS & WHEN TO USE THEM:
1. find_nearby_stations(latitude, longitude, radius_km, min_power_kw):
   - PRIMARY tool. Use it whenever the user shares or implies a location ("near me",
     "around Gangnam", coordinates) and wants charging options.
   - For "fast" / "급속" charging, set min_power_kw=50. For "ultra" set min_power_kw=150.
   - Each result includes live availability (live/available/total, 'source' shows simulated vs
     real). PREFER stations with free plugs now (available > 0); avoid 'offline'.
   - Recommend the best 1-3 options. Justify with distance, power (kW), connector type,
     live availability, and operator. Mention if a station is Tesla-only vs open to all.

1b. check_live_availability(latitude, longitude, station_name):
   - Use when the user asks if a SPECIFIC station is free/busy right now. Tries real Google data,
     falls back to a simulated estimate (the response's 'source' tells which).

2. plan_route(from_latitude, from_longitude, to_latitude, to_longitude):
   - ALWAYS call this for the SINGLE station you ultimately recommend, using that station's
     coordinates as the destination — even if the user didn't explicitly ask for a route. The app
     uses this call to draw the route on the map, animate the drive, and keep the on-screen plan
     card in sync with YOUR recommendation. Then report the real driving distance and ETA.

3. predict_charging_demand(zone_id, forecast_horizon):
   - Use when the user asks about congestion / busy times / demand outlook for an area.
   - Combine with nearby results: if demand is forecast to peak soon, steer the user toward
     stations with more connectors or higher power to avoid waiting. This predictive steer is
     the core value — don't just list stations, reason about FUTURE congestion.

4. find_charging_deserts(latitude, longitude, radius_km):
   - For community / city-planning questions ("charging deserts", "underserved areas",
     "coverage gaps near me"). Report desert % and the worst coverage gap.

5. community_impact(country_code):
   - For sustainability / city-stakeholder questions ("CO2 avoided", "how green", "how many
     public chargers"). Report stations, public-access share, and estimated CO2 avoided/year.

6. check_charger_status / search_manual_embeddings:
   - For operator-style queries about a specific charger id (e.g. CHG-1004) or troubleshooting
     an error code, use these as before.

7. find_pois_near(latitude, longitude, poi_type, charge_minutes):
   - SMART-LIFE tool. When the user wants to use the charging time productively ("leave the car
     charging and grab lunch", "what's near the charger", "coffee while I charge", "somewhere to
     eat while it charges"), call this with the recommended station's coordinates, a poi_type
     ('restaurant', 'cafe', 'shopping_mall', 'parking', 'tourist_attraction'), and the estimated
     charge minutes. Estimate charge time from the car's battery and the station's kW.
   - Then give a concrete plan, e.g. "~28 min charge — enough for lunch at <name>, a 4-min walk".

8. plan_trip(stops):
   - For multi-destination or road-trip requests ("shopping then dinner then parking", "trip from
     A to B to C"), build the ordered list of {name, latitude, longitude} waypoints and call this.
     Report per-leg ETA, the total distance/time, and suggest where to charge if the battery would
     run low. Reason about congestion from the demand forecast where relevant.

CAR-FIRST DECISIONS (this is an EV — reason about the specific vehicle):
- The user message includes their EV model, connector type, battery %, and remaining range.
- Prefer stations that (a) MATCH their connector and (b) are comfortably REACHABLE on the current
  battery (treat driving distance as roughly straight-line × 1.3; warn if it eats most of the range).
- If battery is low, prioritize a closer, reachable charger even over a faster but distant one — and say so.

EXPLAINABLE RECOMMENDATIONS (important — this is Responsible/Explainable AI):
- When you recommend a station, ALWAYS state the 'why' in terms of: (1) distance/ETA & reachability
  on the current battery, (2) power & connector match for their car, (3) predicted congestion if known.
- Make the trade-off explicit (e.g. "slightly farther but 250kW, your CCS fits, reachable, quieter at 6pm").

COMMUNITY LENS:
- You serve both individual drivers AND city stakeholders. When relevant, note public-good
  angles: public-access vs members-only, distributing load to ease grid peaks, and coverage gaps
  (charging deserts) for underserved areas.

RESPONSE STYLE:
- Be concise, structured, action-oriented. Lead with the recommendation, then the reasoning.
- Use clean markdown with bullets. Never dump raw IDs or jargon without explanation.
- When you recommend stations, always include their name and approximate distance so the UI can
  highlight them on the map.
- If the user has not shared a location, ask for it or suggest they use the "Use my location" button.
"""
    )

    # Initialize Session Service & Runner
    session_service = InMemorySessionService()
    runner = adk.Runner(
        agent=agent,
        app_name=APP_NAME,
        session_service=session_service
    )

    try:
        global_session = await session_service.create_session(app_name=APP_NAME, user_id=USER)
        print(f"Agent session initialized: {global_session.id}")
    except Exception as e:
        print(f"Error creating session: {e}")

# Helper to run async initializations
loop = asyncio.new_event_loop()
asyncio.set_event_loop(loop)
loop.run_until_complete(init_agent())

def local_agent_fallback(user_input):
    user_input_upper = user_input.upper()
    import re
    import json

    # 1. Charger Status
    charger_match = re.search(r'(CHG-\d+)', user_input_upper)
    if charger_match:
        charger_id = charger_match.group(1)
        from mcp_server_local import check_charger_status
        try:
            status_json = check_charger_status(charger_id)
            status_data = json.loads(status_json)
            if "error" in status_data:
                return f"❌ **Error**: Charger **{charger_id}** was not found in the live status database."
            return f"""
### 🔌 EV Charger Telemetry Status: {charger_id}

*   **Status**: `{status_data.get('status')}`
*   **Current Load**: `{status_data.get('current_load_kw')} kW`
*   **Active Error Code**: `{status_data.get('error_code')}`
*   **Telemetry Timestamp**: `{status_data.get('last_updated')}`

*(Local Sandbox Fallback Mode - Live DB Connected)*
"""
        except Exception as err:
            return f"❌ **Error retrieving status**: {err}"

    # 2. Troubleshooting Manual RAG
    if any(k in user_input_upper for k in ["ERR_", "OVERHEATING", "TIMEOUT", "MANUAL", "TROUBLESHOOT"]):
        query_text = "ERR_OVERHEATING" if "OVERHEATING" in user_input_upper else "ERR_CONN_TIMEOUT"
        from mcp_server_local import search_manual_embeddings
        try:
            manual_json = search_manual_embeddings(query_text, 1)
            manual_data = json.loads(manual_json)
            if manual_data:
                doc = manual_data[0]
                return f"""
### 📖 Troubleshooting Guide: {doc.get('section_title')}

*   **Target Error Code**: `{doc.get('error_code')}`
*   **Action Steps**:
{doc.get('troubleshooting_steps')}

*(Local Sandbox Fallback Mode - Live DB Connected)*
"""
        except Exception as err:
            return f"❌ **Error retrieving manuals**: {err}"

    # 3. BQML Demand Forecast
    if any(k in user_input_upper for k in ["FORECAST", "PREDICT", "DEMAND", "GANGNAM"]):
        zone = "ZONE_GANGNAM" if "GANGNAM" in user_input_upper else "ZONE_SEOUL"
        from mcp_server_local import predict_charging_demand
        try:
            forecast_json = predict_charging_demand(zone, 6)
            forecast_data = json.loads(forecast_json)
            rows = []
            for f in forecast_data:
                rows.append(f"| {f.get('forecast_timestamp')} | {f.get('forecast_value')} kW | [{f.get('prediction_interval_lower_bound')}, {f.get('prediction_interval_upper_bound')}] |")
            return f"""
### 📊 BQML ARIMA_PLUS Charging Demand Forecast: {zone}

| Timestamp | Expected Load | 95% Confidence Interval |
| :--- | :--- | :--- |
{"\n".join(rows)}

*(Local Sandbox Fallback Mode - Mocked Forecast Output)*
"""
        except Exception as err:
            return f"❌ **Error forecasting**: {err}"

    return f"""
### 🤖 EV-Charge Assistant (Sandbox Fallback Mode)

I am running in local fallback mode because the Vertex AI model could not be reached in this project. However, the database is active! You can try:
1.  **Charger status queries** (e.g., "Check status of CHG-1003")
2.  **Troubleshooting guide searches** (e.g., "Manual for ERR_CONN_TIMEOUT")
3.  **Demand forecasting** (e.g., "Forecast demand in Gangnam")

**Your Query**: "{user_input}"
"""

@app.route('/api/stations')
def api_stations():
    """Stations for map pins. Optional ?country=KR and ?limit=N (default 8000)."""
    from google.cloud import bigquery
    country = request.args.get('country')
    try:
        limit = int(request.args.get('limit', 8000))
    except ValueError:
        limit = 8000
    where = "WHERE country_code = @country" if country else ""
    params = [bigquery.ScalarQueryParameter("country", "STRING", country)] if country else []
    params.append(bigquery.ScalarQueryParameter("lim", "INT64", limit))
    sql = f"""
        SELECT station_id, title, town, country_code, operator, status,
               max_power_kw, connector_types, lat, lon
        FROM `{STATIONS_TABLE}`
        {where}
        ORDER BY max_power_kw DESC
        LIMIT @lim
    """
    cfg = bigquery.QueryJobConfig(query_parameters=params)
    try:
        rows = [dict(r) for r in get_bq().query(sql, job_config=cfg).result()]
        return jsonify({"count": len(rows), "stations": rows})
    except Exception as e:
        return jsonify({"error": str(e), "stations": []}), 500


@app.route('/api/nearby')
def api_nearby():
    """Nearby stations for the map. ?lat&lon required; optional radius_km, min_power_kw, limit."""
    try:
        lat = float(request.args['lat'])
        lon = float(request.args['lon'])
    except (KeyError, ValueError):
        return jsonify({"error": "lat and lon query params are required"}), 400
    radius_km = float(request.args.get('radius_km', 5))
    min_power = float(request.args.get('min_power_kw', 0))
    limit = int(request.args.get('limit', 20))
    connector = request.args.get('connector', '')
    try:
        rows = query_nearby_stations(lat, lon, radius_km * 1000.0, min_power, limit, connector)
        compatible = sum(1 for r in rows if r.get("is_match"))
        return jsonify({"count": len(rows), "compatible": compatible, "stations": rows})
    except Exception as e:
        return jsonify({"error": str(e), "stations": []}), 500


def _decode_polyline(s):
    """Decode a Google-encoded polyline string to [[lat, lon], ...]."""
    coords, idx, lat, lng = [], 0, 0, 0
    while idx < len(s):
        for is_lat in (True, False):
            shift, result = 0, 0
            while True:
                b = ord(s[idx]) - 63; idx += 1
                result |= (b & 0x1f) << shift; shift += 5
                if b < 0x20:
                    break
            d = ~(result >> 1) if (result & 1) else (result >> 1)
            if is_lat:
                lat += d
            else:
                lng += d
        coords.append([lat / 1e5, lng / 1e5])
    return coords


def _google_route(o_lat, o_lon, d_lat, d_lon):
    """Try Google Routes API. Returns dict or None (e.g. unsupported region like Korea)."""
    key = os.getenv("GOOGLE_MAPS_API_KEY")
    if not key:
        return None
    import json as _json
    import urllib.request
    body = _json.dumps({
        "origin": {"location": {"latLng": {"latitude": o_lat, "longitude": o_lon}}},
        "destination": {"location": {"latLng": {"latitude": d_lat, "longitude": d_lon}}},
        "travelMode": "DRIVE",
        "routingPreference": "TRAFFIC_AWARE",
    }).encode()
    req = urllib.request.Request(
        "https://routes.googleapis.com/directions/v2:computeRoutes",
        data=body, method="POST",
        headers={
            "Content-Type": "application/json",
            "X-Goog-Api-Key": key,
            "X-Goog-FieldMask": "routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline",
        })
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            data = _json.load(r)
        routes = data.get("routes") or []
        if not routes:
            return None  # region unsupported (Korea) or no route
        rt = routes[0]
        enc = (rt.get("polyline") or {}).get("encodedPolyline")
        dur = rt.get("duration", "0s")
        dur_s = int(str(dur).rstrip("s")) if str(dur).rstrip("s").isdigit() else None
        return {
            "provider": "google",
            "distance_m": rt.get("distanceMeters"),
            "duration_s": dur_s,
            "coords": _decode_polyline(enc) if enc else [],
        }
    except Exception:
        return None


def _osrm_route(o_lat, o_lon, d_lat, d_lon):
    """Fallback routing via the public OSRM demo server (free, covers Korea)."""
    import json as _json
    import urllib.request
    url = (f"https://router.project-osrm.org/route/v1/driving/"
           f"{o_lon},{o_lat};{d_lon},{d_lat}?overview=full&geometries=geojson")
    try:
        with urllib.request.urlopen(url, timeout=15) as r:
            data = _json.load(r)
        routes = data.get("routes") or []
        if not routes:
            return None
        rt = routes[0]
        geo = rt.get("geometry", {}).get("coordinates", [])  # [lon, lat]
        return {
            "provider": "osrm",
            "distance_m": round(rt.get("distance", 0)),
            "duration_s": round(rt.get("duration", 0)),
            "coords": [[c[1], c[0]] for c in geo],
        }
    except Exception:
        return None


def _places_live(title, lat, lon):
    """Real-time EV plug availability via Google Places API (New). Returns a dict
    with available/total when the region exposes live data, else None. One call."""
    key = os.getenv("GOOGLE_MAPS_API_KEY")
    if not key or not title:
        return None
    import json as _json
    import urllib.request
    body = _json.dumps({
        "textQuery": title,
        "locationBias": {"circle": {"center": {"latitude": lat, "longitude": lon}, "radius": 400.0}},
        "maxResultCount": 1,
    }).encode()
    req = urllib.request.Request(
        "https://places.googleapis.com/v1/places:searchText", data=body, method="POST",
        headers={
            "Content-Type": "application/json",
            "X-Goog-Api-Key": key,
            "X-Goog-FieldMask": "places.displayName,places.evChargeOptions",
        })
    try:
        with urllib.request.urlopen(req, timeout=12) as r:
            data = _json.load(r)
        places = data.get("places") or []
        if not places:
            return None
        ev = places[0].get("evChargeOptions") or {}
        aggs = ev.get("connectorAggregation") or []
        avail = sum(a.get("availableCount", 0) for a in aggs if "availableCount" in a)
        total = ev.get("connectorCount") or sum(a.get("count", 0) for a in aggs)
        if not aggs or not any("availableCount" in a for a in aggs):
            return None  # no live availability in this region
        return {"live": "available" if avail > 0 else "busy",
                "available": avail, "total": total or avail, "source": "google_places"}
    except Exception:
        return None


@app.route('/api/live')
def api_live():
    """Live status for one station: real (Google Places) if available, else simulated."""
    blocked, msg = rate_limited("live")
    if blocked:
        return jsonify({"error": msg}), 429
    title = request.args.get('title', '')
    try:
        lat = float(request.args['lat']); lon = float(request.args['lon'])
    except (KeyError, ValueError):
        return jsonify({"error": "lat/lon required"}), 400
    sid = request.args.get('station_id', '0')
    total = request.args.get('total', '4')
    real = _places_live(title, lat, lon)
    if real:
        return jsonify(real)
    try:
        sid_i = int(sid); total_i = int(total)
    except ValueError:
        sid_i, total_i = 0, 4
    return jsonify(sim_live_status(sid_i, total_i))


_POI_LABELS = {
    "restaurant": "Restaurant", "cafe": "Cafe", "shopping_mall": "Mall",
    "parking": "Parking", "tourist_attraction": "Attraction",
}


def _sim_pois(lat, lon, poi_type="restaurant", limit=6):
    """Deterministic simulated POIs near a point (free; no API call). Stable per
    location/type, clearly surfaced as 'simulated'. Mirrors sim_live_status."""
    label = _POI_LABELS.get(poi_type, "Place")
    base = (abs(hash((round(lat, 3), round(lon, 3), poi_type))) % 1_000_000)
    out = []
    for i in range(limit):
        h = (base * 2654435761 + i * 40503) & 0xFFFFFFFF
        dlat = ((h % 1000) / 1000 - 0.5) * 0.009          # ~±500 m
        dlon = (((h >> 10) % 1000) / 1000 - 0.5) * 0.009
        dist_m = round(((dlat * 111000) ** 2 + (dlon * 90000) ** 2) ** 0.5)
        out.append({
            "name": f"{label} {chr(65 + i)}",
            "type": poi_type, "lat": round(lat + dlat, 6), "lon": round(lon + dlon, 6),
            "dist_m": dist_m, "walk_min": max(1, round(dist_m / 80)),
            "rating": round(3.8 + (h % 12) / 10, 1), "source": "simulated",
        })
    out.sort(key=lambda p: p["dist_m"])
    return out


def _places_pois(lat, lon, poi_type="restaurant", radius_m=600, limit=6):
    """Walkable POIs near a charging stop via Google Places (New) Nearby Search.
    Returns a list of dicts, or None when unavailable (→ simulated fallback)."""
    key = os.getenv("GOOGLE_MAPS_API_KEY")
    if not key:
        return None
    import json as _json
    import urllib.request
    body = _json.dumps({
        "includedTypes": [poi_type],
        "maxResultCount": limit,
        "locationRestriction": {"circle": {
            "center": {"latitude": lat, "longitude": lon}, "radius": float(radius_m)}},
    }).encode()
    req = urllib.request.Request(
        "https://places.googleapis.com/v1/places:searchNearby", data=body, method="POST",
        headers={
            "Content-Type": "application/json",
            "X-Goog-Api-Key": key,
            "X-Goog-FieldMask": "places.displayName,places.location,places.rating,places.primaryType",
        })
    try:
        with urllib.request.urlopen(req, timeout=12) as r:
            data = _json.load(r)
        places = data.get("places") or []
        if not places:
            return None
        out = []
        for p in places:
            loc = p.get("location") or {}
            plat, plon = loc.get("latitude"), loc.get("longitude")
            if plat is None or plon is None:
                continue
            dist_m = round(haversine_m(lat, lon, plat, plon))
            out.append({
                "name": (p.get("displayName") or {}).get("text", "Place"),
                "type": p.get("primaryType", poi_type), "lat": plat, "lon": plon,
                "dist_m": dist_m, "walk_min": max(1, round(dist_m / 80)),
                "rating": p.get("rating"), "source": "google_places",
            })
        out.sort(key=lambda x: x["dist_m"])
        return out or None
    except Exception:
        return None


def haversine_m(lat1, lon1, lat2, lon2):
    from math import radians, sin, cos, asin, sqrt
    dlat = radians(lat2 - lat1); dlon = radians(lon2 - lon1)
    a = sin(dlat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon / 2) ** 2
    return 2 * 6371000 * asin(sqrt(a))


@app.route('/api/poi')
def api_poi():
    """Walkable POIs near a charging stop: real (Google Places) if available,
    else a simulated set. Rate-limited under the 'poi' daily cap."""
    blocked, msg = rate_limited("poi")
    if blocked:
        return jsonify({"error": msg}), 429
    try:
        lat = float(request.args['lat']); lon = float(request.args['lon'])
    except (KeyError, ValueError):
        return jsonify({"error": "lat/lon required"}), 400
    poi_type = request.args.get('type', 'restaurant')
    real = _places_pois(lat, lon, poi_type)
    pois = real if real is not None else _sim_pois(lat, lon, poi_type)
    return jsonify({"type": poi_type, "count": len(pois),
                    "source": "google_places" if real is not None else "simulated",
                    "pois": pois})


@app.route('/api/forecast')
def api_forecast():
    """BQML ARIMA_PLUS demand forecast series for a zone (for the mini-chart)."""
    from google.cloud import bigquery
    zone = request.args.get('zone', 'ZONE_GANGNAM')
    try:
        horizon = int(request.args.get('horizon', 12))
    except ValueError:
        horizon = 12
    sql = f"""
        SELECT FORMAT_TIMESTAMP('%H:%M', forecast_timestamp) AS t,
               ROUND(forecast_value, 1) AS kw,
               ROUND(prediction_interval_lower_bound, 1) AS lo,
               ROUND(prediction_interval_upper_bound, 1) AS hi
        FROM ML.FORECAST(MODEL `{PROJECT_ID}.{BQ_DATASET}.ev_demand_forecast_model`,
                         STRUCT(168 AS horizon, 0.9 AS confidence_level))
        WHERE zone_id = @zone
        ORDER BY forecast_timestamp
        LIMIT @h
    """
    cfg = bigquery.QueryJobConfig(query_parameters=[
        bigquery.ScalarQueryParameter("zone", "STRING", zone),
        bigquery.ScalarQueryParameter("h", "INT64", horizon),
    ])
    try:
        rows = [dict(r) for r in get_bq().query(sql, job_config=cfg).result()]
        peak = max((r["kw"] for r in rows), default=0)
        return jsonify({"zone": zone, "series": rows, "peak_kw": peak})
    except Exception as e:
        return jsonify({"error": str(e), "series": []}), 500


@app.route('/api/route')
def api_route():
    """Hybrid driving route: Google Routes (accurate, traffic-aware) where supported,
    OSRM fallback for regions Google can't route (e.g. South Korea)."""
    blocked, msg = rate_limited("route")
    if blocked:
        return jsonify({"error": msg}), 429
    try:
        o_lat = float(request.args['from_lat']); o_lon = float(request.args['from_lon'])
        d_lat = float(request.args['to_lat']); d_lon = float(request.args['to_lon'])
    except (KeyError, ValueError):
        return jsonify({"error": "from_lat/from_lon/to_lat/to_lon required"}), 400
    route = _google_route(o_lat, o_lon, d_lat, d_lon) or _osrm_route(o_lat, o_lon, d_lat, d_lon)
    if not route:
        return jsonify({"error": "no route found"}), 502
    return jsonify(route)


@app.route('/api/community_stats')
def api_community_stats():
    """Community-impact KPIs for the dashboard strip. Optional ?country=KR."""
    from google.cloud import bigquery
    country = request.args.get('country')
    where = "WHERE country_code = @c" if country else ""
    params = [bigquery.ScalarQueryParameter("c", "STRING", country)] if country else []
    sql = f"""
        SELECT
          COUNT(*) AS total,
          COUNTIF(max_power_kw >= 50) AS fast,
          COUNTIF(max_power_kw >= 150) AS ultra,
          ROUND(SAFE_DIVIDE(COUNTIF(LOWER(usage_type) LIKE '%public%'), COUNT(*)) * 100, 1) AS public_pct,
          ROUND(AVG(max_power_kw), 0) AS avg_kw,
          SUM(num_points) AS total_points,
          COUNT(DISTINCT country_code) AS countries
        FROM `{STATIONS_TABLE}`
        {where}
    """
    cfg = bigquery.QueryJobConfig(query_parameters=params)
    try:
        row = dict(list(get_bq().query(sql, job_config=cfg).result())[0])
        points = row.get("total_points") or 0
        # Transparent estimate: avg 20 kWh delivered per charge-point/day, EV displaces
        # ICE emitting ~0.25 kg CO2 per equivalent kWh of driving. Annual tonnes.
        co2_tonnes = round(points * 20 * 365 * 0.25 / 1000)
        row["co2_avoided_tonnes_yr"] = co2_tonnes
        row["co2_assumption"] = "≈20 kWh/port/day · 0.25 kg CO₂ avoided/kWh"
        return jsonify(row)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/coverage')
def api_coverage():
    """Charging-desert / equity grid for the current map viewport.

    Params: south, west, north, east (viewport bounds), threshold_m (default 2000).
    Returns grid cells with distance to the nearest station so the map can shade
    coverage gaps (an open-data accessibility view for city stakeholders).
    """
    from google.cloud import bigquery
    try:
        south = float(request.args['south']); west = float(request.args['west'])
        north = float(request.args['north']); east = float(request.args['east'])
    except (KeyError, ValueError):
        return jsonify({"error": "south/west/north/east required"}), 400
    threshold = float(request.args.get('threshold_m', 2000))
    # Adaptive step: aim for ~14 cells across the larger span, capped for payload safety.
    span = max(north - south, east - west, 0.02)
    step = round(span / 14, 4)
    sql = f"""
        WITH grid AS (
          SELECT lat_c, lon_c
          FROM UNNEST(GENERATE_ARRAY(@south, @north, @step)) AS lat_c,
               UNNEST(GENERATE_ARRAY(@west, @east, @step)) AS lon_c
        )
        SELECT g.lat_c AS lat, g.lon_c AS lon,
          ROUND((
            SELECT MIN(ST_DISTANCE(s.geog, ST_GEOGPOINT(g.lon_c, g.lat_c)))
            FROM `{STATIONS_TABLE}` s
            WHERE ST_DWITHIN(s.geog, ST_GEOGPOINT(g.lon_c, g.lat_c), 25000)
          )) AS nearest_m
        FROM grid g
        LIMIT 500
    """
    cfg = bigquery.QueryJobConfig(query_parameters=[
        bigquery.ScalarQueryParameter("south", "FLOAT64", south),
        bigquery.ScalarQueryParameter("north", "FLOAT64", north),
        bigquery.ScalarQueryParameter("west", "FLOAT64", west),
        bigquery.ScalarQueryParameter("east", "FLOAT64", east),
        bigquery.ScalarQueryParameter("step", "FLOAT64", step),
    ])
    try:
        cells = [dict(r) for r in get_bq().query(sql, job_config=cfg).result()]
        deserts = sum(1 for c in cells if (c["nearest_m"] or 1e9) > threshold)
        return jsonify({
            "cell_deg": step, "threshold_m": threshold,
            "cells": cells, "total": len(cells), "deserts": deserts,
            "desert_pct": round(deserts / len(cells) * 100, 1) if cells else 0,
        })
    except Exception as e:
        return jsonify({"error": str(e), "cells": []}), 500


# Human-readable labels for the agent's tools, so the UI can show the
# reasoning trace (which data sources the agent decided to query).
TOOL_LABELS = {
    "find_nearby_stations": "🔌 Searched live APAC stations (BigQuery geospatial)",
    "plan_route": "🧭 Computed driving route & ETA (Google Maps / OSM)",
    "predict_charging_demand": "📈 Forecast congestion (BigQuery ML ARIMA_PLUS)",
    "find_charging_deserts": "🌍 Analyzed coverage gaps / charging deserts (BigQuery geospatial)",
    "community_impact": "🌱 Computed community impact & CO₂ avoided (BigQuery)",
    "check_live_availability": "🟢 Checked live plug availability (Google Places / live)",
    "check_charger_status": "⚙️ Checked charger telemetry (BigQuery)",
    "search_manual_embeddings": "📖 Searched troubleshooting manuals (RAG)",
    "find_pois_near": "🍴 Found things to do near the charger (Google Places)",
    "plan_trip": "🗺️ Planned a multi-stop trip (Google Maps / OSM)",
}


def _safe_json(obj):
    """Coerce a tool arg/result into a JSON-serializable structure (or {})."""
    import json as _j
    try:
        return _j.loads(_j.dumps(obj, default=str))
    except Exception:
        return {}


QUOTA_MSG = ("⚠️ The AI is briefly rate-limited right now (Gemini quota · error 429). "
             "This is a temporary cloud limit — your data is fine. Please wait ~30 seconds and try again.")


def _is_quota_error(e):
    """True for Vertex/Gemini rate-limit (429) errors, so we surface an honest
    'try again' message instead of the offline mock (which can look like real data)."""
    s = str(e).upper()
    return "RESOURCE_EXHAUSTED" in s or "429" in s or "QUOTA" in s


def _stream_run_config():
    """RunConfig with token streaming if this ADK version supports it, else None."""
    try:
        from google.adk.agents.run_config import RunConfig, StreamingMode
        return RunConfig(streaming_mode=StreamingMode.SSE)
    except Exception:
        return None


@app.route('/chat/stream', methods=['POST'])
def chat_stream():
    """Server-streamed agent run: emits NDJSON events — {type:step|token|done}.
    Steps (tool calls) and answer tokens are pushed live as the agent reasons."""
    import json as _json
    import queue as _queue
    import threading
    blocked, msg = rate_limited("chat")
    user_input = (request.json or {}).get("message", "")

    def err_stream(text):
        yield _json.dumps({"type": "token", "text": text}, ensure_ascii=False) + "\n"
        yield _json.dumps({"type": "done"}, ensure_ascii=False) + "\n"

    if blocked:
        return Response(err_stream(msg), mimetype="application/x-ndjson", status=429)
    if not runner or not session_service:
        return Response(err_stream("System is still initializing…"), mimetype="application/x-ndjson")

    content = genai_types.Content(role='user', parts=[genai_types.Part(text=user_input)])
    q = _queue.Queue()

    def worker():
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)

        async def run():
            # Retry transient Vertex 429s with backoff — but ONLY while nothing has
            # been emitted yet, so a mid-stream failure never duplicates output.
            backoffs = [3, 6]   # waits before attempts 2 and 3
            attempt = 0
            while True:
                seen_steps = set()
                streamed_partial = False   # saw token deltas (streaming mode)
                any_token = False
                finals = []                # consolidated text (non-streaming fallback)
                emitted = False            # any step/call/data/token sent this attempt
                try:
                    # Fresh session per request → no cross-user context bleed, and the
                    # agent always reasons from scratch (consistent tool calls).
                    sess = await session_service.create_session(app_name=APP_NAME, user_id=USER)
                    rc = _stream_run_config()
                    kwargs = dict(new_message=content, user_id=USER, session_id=sess.id)
                    if rc is not None:
                        kwargs["run_config"] = rc
                    async for event in runner.run_async(**kwargs):
                        parts = getattr(getattr(event, 'content', None), 'parts', None)
                        if not parts:
                            continue
                        is_partial = bool(getattr(event, 'partial', False))
                        for part in parts:
                            fc = getattr(part, 'function_call', None)
                            if fc and getattr(fc, 'name', None):
                                if fc.name not in seen_steps:
                                    seen_steps.add(fc.name)
                                    q.put({"type": "step", "label": TOOL_LABELS.get(fc.name, f"🔧 {fc.name}")}); emitted = True
                                try:
                                    args = dict(fc.args) if getattr(fc, 'args', None) else {}
                                except Exception:
                                    args = {}
                                # structured tool CALL (args reveal the agent's chosen coords)
                                q.put({"type": "call", "tool": fc.name, "args": _safe_json(args)}); emitted = True
                            fr = getattr(part, 'function_response', None)
                            if fr and getattr(fr, 'name', None):
                                # structured tool RESULT (stations / pois / route numbers)
                                q.put({"type": "data", "tool": fr.name, "result": _safe_json(getattr(fr, 'response', None))}); emitted = True
                            txt = getattr(part, 'text', None)
                            if txt:
                                if is_partial:
                                    streamed_partial = True
                                    any_token = True; emitted = True
                                    q.put({"type": "token", "text": txt})   # delta
                                else:
                                    finals.append(txt)   # consolidated; emit only if no partials
                    if not streamed_partial:
                        full = "".join(finals).strip()
                        if full:
                            any_token = True; emitted = True
                            q.put({"type": "token", "text": full})
                    if not any_token:
                        q.put({"type": "token", "text": local_agent_fallback(user_input)}); emitted = True
                    break   # success
                except Exception as e:
                    print(f"[stream] agent error: {e}")
                    if _is_quota_error(e) and not emitted and attempt < len(backoffs):
                        wait = backoffs[attempt]; attempt += 1
                        print(f"[stream] quota 429 — retrying in {wait}s (attempt {attempt + 1}/3)")
                        await asyncio.sleep(wait)
                        continue
                    # 429/quota → honest retry message; other errors → offline fallback.
                    q.put({"type": "token", "text": QUOTA_MSG if _is_quota_error(e) else local_agent_fallback(user_input)})
                    break
            q.put({"type": "done"})

        loop.run_until_complete(run())
        loop.close()

    threading.Thread(target=worker, daemon=True).start()

    def gen():
        while True:
            item = q.get()
            yield _json.dumps(item, ensure_ascii=False) + "\n"
            if item.get("type") == "done":
                break

    return Response(stream_with_context(gen()), mimetype="application/x-ndjson")


@app.route('/chat', methods=['POST'])
def chat():
    global global_session
    blocked, msg = rate_limited("chat")
    if blocked:
        return jsonify({"agent_reply": msg, "agent_steps": []}), 429
    user_input = request.json.get("message", "")

    if not runner or not session_service:
        return jsonify({"agent_reply": "System is still initializing..."})

    content = genai_types.Content(role='user', parts=[genai_types.Part(text=user_input)])
    tool_labels = TOOL_LABELS

    async def run_agent_loop():
        accumulated_text = []
        steps = []  # ordered tool-call trace for the UI
        try:
            print(f"\n--- Starting Agent Execution: {user_input} ---")
            sess = await session_service.create_session(app_name=APP_NAME, user_id=USER)
            async for event in runner.run_async(
                new_message=content,
                user_id=USER,
                session_id=sess.id
            ):
                print(f"[ADK Event]: {type(event).__name__}")
                content_obj = getattr(event, 'content', None)
                parts = getattr(content_obj, 'parts', None) if content_obj else None
                if parts:
                    for part in parts:
                        fc = getattr(part, 'function_call', None)
                        if fc and getattr(fc, 'name', None):
                            label = tool_labels.get(fc.name, f"🔧 {fc.name}")
                            if label not in steps:
                                steps.append(label)
                        if getattr(part, 'text', None):
                            accumulated_text.append(part.text)
                elif getattr(event, 'text', None):
                    accumulated_text.append(event.text)

            reply = "".join(accumulated_text).strip()
            print(f"--- Execution Complete (tools: {steps}) ---\n")
            return reply, steps
        except Exception as e:
            print(f"Error during agent loop: {e}. Falling back to local rules-based database querying.")
            if _is_quota_error(e):
                return QUOTA_MSG, []
            return local_agent_fallback(user_input), []

    try:
        reply, steps = asyncio.run(run_agent_loop())
        return jsonify({"agent_reply": reply, "agent_steps": steps})
    except Exception as e:
        reply = QUOTA_MSG if _is_quota_error(e) else local_agent_fallback(user_input)
        return jsonify({"agent_reply": reply, "agent_steps": []})

if __name__ == '__main__':
    # Local default 8090 (8080 is often taken by other dev containers). Cloud Run
    # always injects PORT (8080), so production is unaffected.
    port = int(os.environ.get('PORT', 8090))
    app.run(host='0.0.0.0', port=port, debug=False)
