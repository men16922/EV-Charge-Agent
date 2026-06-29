#!/bin/bash
# deploy.sh
# Script to build and deploy EV-Charge EV MCP Toolbox to Google Cloud Run

# Exit on any error
set -e

# Load environment variables
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

# Ensure PROJECT_ID is set
if [ -z "$PROJECT_ID" ] || [ "$PROJECT_ID" == "your-gcp-project-id" ]; then
  echo "Error: PROJECT_ID is not set in .env file"
  exit 1
fi

REGION=${GOOGLE_CLOUD_LOCATION:-us-central1}
IMAGE_TAG="gcr.io/${PROJECT_ID}/ev-mcp-toolbox:latest"
SERVICE_NAME="ev-mcp-toolbox"

echo "========================================================="
echo "Building EV MCP Toolbox Container using Cloud Build..."
echo "Project ID: ${PROJECT_ID}"
echo "Region:     ${REGION}"
echo "Image Tag:  ${IMAGE_TAG}"
echo "========================================================="

# Submit build to Google Cloud Build
gcloud builds submit --tag "$IMAGE_TAG" --project "$PROJECT_ID"

echo "========================================================="
echo "Deploying to Google Cloud Run..."
echo "========================================================="

# Deploy image to Cloud Run
# Using allow-unauthenticated for simplicity in hackathon, secure for production as needed.
gcloud run deploy "$SERVICE_NAME" \
  --image "$IMAGE_TAG" \
  --region "$REGION" \
  --allow-unauthenticated \
  --min-instances 0 \
  --max-instances 2 \
  --set-env-vars="PROJECT_ID=${PROJECT_ID}" \
  --project "$PROJECT_ID"

echo "========================================================="
echo "EV MCP Toolbox successfully deployed to Cloud Run!"
echo "Retrieve the URL of your service using: gcloud run services describe $SERVICE_NAME --region $REGION --format='value(status.url)'"
echo "========================================================="
