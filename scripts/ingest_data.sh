#!/bin/bash
# scripts/ingest_data.sh
# Automates the Bronze-Silver-Gold pipeline for EV-Charge platform.
# Ingests NREL Alternative Fuel Stations data, uploads to GCS (Bronze),
# and loads to BigQuery with auto-detection (Silver/Gold).

set -e

# Load environment variables if available
if [ -f .env ]; then
  source .env
fi

# Configuration Defaults
PROJECT_ID=${PROJECT_ID:-"project-ec7809f7-0fb5-45d4-b6d"}
GCS_BUCKET=${GCS_BUCKET_NAME:-"ev-charge-data-lake-${PROJECT_ID}"}
BQ_DATASET=${BQ_DATASET:-"ev_data_schema"}
TABLE_NAME="stations"
NREL_API_KEY=${NREL_API_KEY:-"DEMO_KEY"}

# Helper usage
usage() {
  echo "Usage: $0 [options]"
  echo "Options:"
  echo "  -b, --bucket   GCS bucket name (default: $GCS_BUCKET)"
  echo "  -d, --dataset  BigQuery dataset name (default: $BQ_DATASET)"
  echo "  -t, --table    BigQuery target table (default: $TABLE_NAME)"
  echo "  -k, --key      NREL API Key (default: DEMO_KEY)"
  echo "  -h, --help     Show this help message"
  exit 1
}

# Parse options
while [[ $# -gt 0 ]]; do
  case $1 in
    -b|--bucket) GCS_BUCKET="$2"; shift 2 ;;
    -d|--dataset) BQ_DATASET="$2"; shift 2 ;;
    -t|--table) TABLE_NAME="$2"; shift 2 ;;
    -k|--key) NREL_API_KEY="$2"; shift 2 ;;
    -h|--help) usage ;;
    *) echo "Unknown parameter: $1"; usage ;;
  esac
done

echo "========================================================="
echo "Starting Data Ingestion Pipeline: Bronze to Gold"
echo "Project ID:  $PROJECT_ID"
echo "GCS Bucket:  $GCS_BUCKET"
echo "BQ Dataset:  $BQ_DATASET"
echo "BQ Table:    $TABLE_NAME"
echo "========================================================="

# Step 1: Raw Ingestion (Bronze Layer)
echo "Step 1: Downloading raw alternative fuel station data from NREL..."
TEMP_CSV=$(mktemp)
wget -O "$TEMP_CSV" "https://developer.nrel.gov/api/alt-fuel-stations/v1.csv?api_key=${NREL_API_KEY}"

# Check download success
if [ ! -s "$TEMP_CSV" ]; then
  echo "Error: Downloaded CSV is empty or failed."
  rm -f "$TEMP_CSV"
  exit 1
fi
echo "NREL data downloaded successfully."

# Step 2: Upload Raw Dump to GCS (Bronze Lakehouse Storage)
echo "Step 2: Uploading raw CSV to GCS bucket: gs://$GCS_BUCKET/data/$TABLE_NAME.csv..."
# Create bucket if it doesn't exist
if ! gcloud storage buckets describe "gs://$GCS_BUCKET" &>/dev/null; then
  echo "Bucket gs://$GCS_BUCKET does not exist. Creating..."
  gcloud storage buckets create "gs://$GCS_BUCKET" --project "$PROJECT_ID"
fi
gcloud storage cp "$TEMP_CSV" "gs://$GCS_BUCKET/data/$TABLE_NAME.csv"
echo "Uploaded to gs://$GCS_BUCKET/data/$TABLE_NAME.csv (Bronze Layer)"

# Step 3: Load into BigQuery (Silver Schema Enforcement & Transformation)
echo "Step 3: Loading GCS CSV data into BigQuery: $PROJECT_ID:$BQ_DATASET.$TABLE_NAME..."
# Create BQ dataset if it doesn't exist
if ! bq show "$PROJECT_ID:$BQ_DATASET" &>/dev/null; then
  echo "Dataset $BQ_DATASET does not exist. Creating..."
  bq mk --dataset --project_id "$PROJECT_ID" "$BQ_DATASET"
fi

# Load with autodetect
bq load --source_format=CSV --autodetect \
  --project_id "$PROJECT_ID" \
  "$BQ_DATASET.$TABLE_NAME" \
  "gs://$GCS_BUCKET/data/$TABLE_NAME.csv"

echo "========================================================="
echo "Data pipeline execution completed successfully!"
echo "Bronze GCS URI:  gs://$GCS_BUCKET/data/$TABLE_NAME.csv"
echo "Silver BigQuery: $PROJECT_ID:$BQ_DATASET.$TABLE_NAME"
echo "========================================================="

# Clean up temp file
rm -f "$TEMP_CSV"
