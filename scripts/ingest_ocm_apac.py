#!/usr/bin/env python3
"""Ingest APAC EV charging stations from Open Charge Map into BigQuery.

Fetches real charging-station POIs (with coordinates, connectors, operator,
power) for a curated set of APAC countries and loads them into
`<BQ_DATASET>.ev_charging_stations` with a GEOGRAPHY column for geospatial
queries (ST_DWITHIN / ST_DISTANCE).

Usage:
    python3 scripts/ingest_ocm_apac.py

Reads from .env:
    PROJECT_ID, BQ_DATASET, OPEN_CHARGE_MAK_KEY  (note: var name has a typo upstream)
"""
import json
import os
import sys
import time
import urllib.parse
import urllib.request

# --- Config -----------------------------------------------------------------
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def load_env():
    env = {}
    path = os.path.join(ROOT, ".env")
    with open(path) as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            env[k.strip()] = v.strip()
    return env


ENV = load_env()
PROJECT_ID = ENV.get("PROJECT_ID")
BQ_DATASET = ENV.get("BQ_DATASET", "ev_data_schema")
# Accept both the correct name and the earlier typo'd one.
OCM_KEY = ENV.get("OPEN_CHARGE_MAP_KEY") or ENV.get("OPEN_CHARGE_MAK_KEY")
TABLE = "ev_charging_stations"

# APAC focus. (code, label, max stations to pull)
APAC_COUNTRIES = [
    ("KR", "South Korea", 2500),
    ("JP", "Japan", 2500),
    ("AU", "Australia", 1500),
    ("SG", "Singapore", 800),
    ("TW", "Taiwan", 1000),
    ("NZ", "New Zealand", 800),
    ("HK", "Hong Kong", 800),
    ("TH", "Thailand", 800),
    ("MY", "Malaysia", 800),
    ("ID", "Indonesia", 800),
    ("PH", "Philippines", 600),
    ("VN", "Vietnam", 600),
    ("IN", "India", 1500),
]

OCM_BASE = "https://api.openchargemap.io/v3/poi/"


def fetch_country(code, maxresults):
    params = {
        "output": "json",
        "countrycode": code,
        "maxresults": maxresults,
        "compact": "false",   # keep expanded OperatorInfo / ConnectionType / StatusType
        "verbose": "false",
        "key": OCM_KEY,
    }
    url = OCM_BASE + "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"User-Agent": "ev-charge-hackathon/1.0"})
    with urllib.request.urlopen(req, timeout=60) as resp:
        return json.load(resp)


def transform(poi, country_code):
    ai = poi.get("AddressInfo") or {}
    lat = ai.get("Latitude")
    lon = ai.get("Longitude")
    if lat is None or lon is None:
        return None  # cannot place on a map

    conns = poi.get("Connections") or []
    powers = [c.get("PowerKW") for c in conns if c.get("PowerKW")]
    max_power = max(powers) if powers else None
    ctypes = sorted({
        (c.get("ConnectionType") or {}).get("Title")
        for c in conns if (c.get("ConnectionType") or {}).get("Title")
    })

    op = (poi.get("OperatorInfo") or {}).get("Title")
    usage = (poi.get("UsageType") or {}).get("Title")
    status = (poi.get("StatusType") or {}).get("Title")
    is_op = (poi.get("StatusType") or {}).get("IsOperational")

    return {
        "station_id": poi.get("ID"),
        "title": ai.get("Title"),
        "address": ai.get("AddressLine1"),
        "town": ai.get("Town"),
        "state": ai.get("StateOrProvince"),
        "country_code": country_code,
        "lat": lat,
        "lon": lon,
        "geog": f"POINT({lon} {lat})",  # WKT -> loaded as GEOGRAPHY
        "operator": op,
        "usage_type": usage,
        "usage_cost": poi.get("UsageCost"),  # free-text, often null (e.g. "Free", "₩300/kWh")
        "status": status,
        "is_operational": bool(is_op) if is_op is not None else None,
        "num_points": poi.get("NumberOfPoints"),
        "max_power_kw": max_power,
        "connector_types": ", ".join(ctypes) if ctypes else None,
        "date_last_verified": poi.get("DateLastVerified"),
    }


def main():
    if not OCM_KEY:
        sys.exit("ERROR: OPEN_CHARGE_MAK_KEY not found in .env")
    if not PROJECT_ID:
        sys.exit("ERROR: PROJECT_ID not found in .env")

    rows = []
    seen = set()
    for code, label, maxn in APAC_COUNTRIES:
        try:
            data = fetch_country(code, maxn)
        except Exception as e:
            print(f"  ! {label} ({code}) failed: {e}")
            continue
        kept = 0
        for poi in data:
            r = transform(poi, code)
            if r and r["station_id"] not in seen:
                seen.add(r["station_id"])
                rows.append(r)
                kept += 1
        print(f"  {label:14s} ({code}): {len(data):5d} fetched -> {kept:5d} kept")
        time.sleep(1)  # be polite to the free API

    print(f"\nTotal unique stations with coordinates: {len(rows)}")

    out = os.path.join(ROOT, "scripts", "_ocm_apac.ndjson")
    with open(out, "w") as f:
        for r in rows:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")
    print(f"Wrote NDJSON -> {out}")
    print("\nNext: load into BigQuery with bq load (see scripts/ocm_schema.json).")


if __name__ == "__main__":
    main()
