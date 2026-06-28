#!/usr/bin/env python3
# scripts/load_data_local.py
# Downloads NREL Alternative Fuel Stations data and inserts it directly
# into the local Dockerized pgvector PostgreSQL database.
# This script runs entirely locally with NO cloud costs.

import os
import sys
import subprocess

# Auto-install dependencies if missing (convenient for hackathon sandbox)
required_packages = ["pandas", "sqlalchemy", "psycopg2-binary", "requests"]
missing_packages = []

for pkg in required_packages:
    try:
        __import__(pkg.replace("-binary", ""))
    except ImportError:
        missing_packages.append(pkg)

if missing_packages:
    print(f"Installing missing local packages: {missing_packages}...")
    try:
        subprocess.check_call([sys.executable, "-m", "pip", "install"] + missing_packages)
        print("Packages installed successfully!")
    except Exception as e:
        print(f"Error installing packages: {e}")
        print("Please run: pip install " + " ".join(missing_packages))
        sys.exit(1)

import pandas as pd
import requests
from sqlalchemy import create_engine, text

# Configuration
DB_USER = "postgres"
DB_PASSWORD = "localpassword"
DB_HOST = "localhost"
DB_PORT = "5432"
DB_NAME = "ev_charge_db"
NREL_API_KEY = "DEMO_KEY"

# SQLite-like Local Fallback option (just in case Docker is not active)
LOCAL_CSV_FILE = "stations_local.csv"

def download_data():
    print("Downloading raw fuel station data from NREL...")
    url = f"https://developer.nrel.gov/api/alt-fuel-stations/v1.csv?api_key={NREL_API_KEY}"
    try:
        response = requests.get(url, timeout=30)
        response.raise_for_status()
        with open(LOCAL_CSV_FILE, "wb") as f:
            f.write(response.content)
        print(f"Alternative fuel stations data saved to {LOCAL_CSV_FILE}.")
        return LOCAL_CSV_FILE
    except Exception as e:
        print(f"Failed to download data: {e}")
        if os.path.exists(LOCAL_CSV_FILE):
            print(f"Using existing local file: {LOCAL_CSV_FILE}")
            return LOCAL_CSV_FILE
        else:
            print("No local file found. Generating offline mock stations dataset...")
            import csv
            mock_data = [
                {"ID": 1001, "Status Code": "E"},
                {"ID": 1002, "Status Code": "P"},
                {"ID": 1003, "Status Code": "T"},
                {"ID": 1004, "Status Code": "T"},
                {"ID": 1005, "Status Code": "E"},
                {"ID": 1006, "Status Code": "P"}
            ]
            with open(LOCAL_CSV_FILE, "w", newline="") as f:
                writer = csv.DictWriter(f, fieldnames=["ID", "Status Code"])
                writer.writeheader()
                writer.writerows(mock_data)
            print(f"Generated mock NREL dataset at {LOCAL_CSV_FILE}.")
            return LOCAL_CSV_FILE

def load_to_postgres(file_path):
    connection_string = f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
    print(f"Connecting to local pgvector PostgreSQL database at {DB_HOST}:{DB_PORT}...")

    try:
        engine = create_engine(connection_string)
        # Test connection
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        print("Connection successful!")
    except Exception as e:
        print(f"Error connecting to local DB: {e}")
        print("\n[PRO-TIP] Make sure your Docker daemon is running and launch the database using:")
        print("  docker-compose up -d")
        sys.exit(1)

    # Enable pgvector extension
    with engine.begin() as conn:
        print("Enabling pgvector extension if not exists...")
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector;"))

    # Load and clean CSV
    print(f"Reading and cleaning {file_path}...")
    df = pd.read_csv(file_path, low_memory=False)

    # Select subset of columns to fit ev-charge schemas
    # Map NREL columns to live_charger_status
    df_clean = pd.DataFrame()
    df_clean['charger_id'] = "CHG-" + df['ID'].astype(str)

    # Map status
    status_map = {'E': 'active', 'P': 'idle', 'T': 'broken'}
    df_clean['status'] = df['Status Code'].map(status_map).fillna('idle')
    df_clean['current_load_kw'] = 0.0

    # Synthesize error codes
    df_clean['error_code'] = df_clean['status'].apply(lambda x: 'ERR_CONN_TIMEOUT' if x == 'broken' else 'NONE')
    df_clean['last_updated'] = pd.Timestamp.now()

    # Deduplicate
    df_clean = df_clean.drop_duplicates(subset=['charger_id'])

    print(f"Loading {len(df_clean)} rows to table 'live_charger_status'...")
    df_clean.to_sql("live_charger_status", engine, if_exists="replace", index=False)
    print("Table 'live_charger_status' loaded successfully!")

    # Load Mock troubleshooting manual data
    manuals_data = [
        {
            "section_title": "Connector Overheating Troubleshooting Guide (ERR_OVERHEATING)",
            "troubleshooting_steps": "1. Turn off power at main distribution panel. 2. Inspect connector pins for carbon buildup. 3. Verify cooling fan function. 4. Reset thermal fuse.",
            "error_code": "ERR_OVERHEATING",
            "embedding": [0.012] * 768  # Mock embedding vector of size 768
        },
        {
            "section_title": "Connection Timeout Troubleshooting (ERR_CONN_TIMEOUT)",
            "troubleshooting_steps": "1. Verify cellular/ethernet link LED status. 2. Cycle modem power (switch SW-3). 3. Check signal attenuation in settings dashboard. 4. Re-bind backend endpoints.",
            "error_code": "ERR_CONN_TIMEOUT",
            "embedding": [0.034] * 768
        },
        {
            "section_title": "Standard Operating Specs",
            "troubleshooting_steps": "Standard charging session initialization takes 15 seconds. If timeout occurs, refer to ERR_CONN_TIMEOUT manual section.",
            "error_code": "NONE",
            "embedding": [0.056] * 768
        }
    ]

    df_manuals = pd.DataFrame(manuals_data)

    # Create ev_charger_manuals table if not exists with vector column
    with engine.begin() as conn:
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS ev_charger_manuals (
                section_title TEXT,
                troubleshooting_steps TEXT,
                error_code VARCHAR(50),
                embedding vector(768)
            );
        """))
        conn.execute(text("TRUNCATE TABLE ev_charger_manuals;"))

    print("Loading manuals and technical specifications into 'ev_charger_manuals'...")
    for index, row in df_manuals.iterrows():
        # Use psycopg2 parameter binding for vector insert
        with engine.begin() as conn:
            conn.execute(
                text("INSERT INTO ev_charger_manuals (section_title, troubleshooting_steps, error_code, embedding) VALUES (:title, :steps, :code, CAST(:embed AS vector))"),
                {"title": row['section_title'], "steps": row['troubleshooting_steps'], "code": row['error_code'], "embed": str(row['embedding'])}
            )

    print("Table 'ev_charger_manuals' loaded successfully with vector dimensions!")

if __name__ == "__main__":
    file_path = download_data()
    load_to_postgres(file_path)
    print("\n[SUCCESS] Local data ingestion pipeline completed! Total cost: $0.00")
