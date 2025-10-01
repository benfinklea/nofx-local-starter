#!/bin/bash

# NOFX Cloud Run Worker Deployment Script
# Deploys the gate execution worker to Google Cloud Run

set -e  # Exit on error

# Configuration
PROJECT_ID="${GCP_PROJECT_ID:-nofx-production}"
SERVICE_NAME="nofx-gate-worker"
REGION="${GCP_REGION:-us-central1}"
MEMORY="2Gi"
CPU="1"
MIN_INSTANCES="1"  # Keep 1 instance always running to avoid cold starts
MAX_INSTANCES="3"
TIMEOUT="900s"  # 15 minutes (gates can take a while)

echo "🚀 Deploying NOFX Gate Worker to Google Cloud Run"
echo "=================================================="
echo "Project: $PROJECT_ID"
echo "Service: $SERVICE_NAME"
echo "Region: $REGION"
echo ""

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo "❌ Error: gcloud CLI is not installed"
    echo "Install it from: https://cloud.google.com/sdk/docs/install"
    exit 1
fi

# Check if user is authenticated
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" &> /dev/null; then
    echo "❌ Error: Not authenticated with gcloud"
    echo "Run: gcloud auth login"
    exit 1
fi

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "❌ Error: DATABASE_URL environment variable is not set"
    echo "Export it first: export DATABASE_URL='your-supabase-connection-string'"
    exit 1
fi

echo "✅ Authenticated as: $(gcloud auth list --filter=status:ACTIVE --format='value(account)')"
echo ""

# Set project
echo "📦 Setting project to $PROJECT_ID..."
gcloud config set project "$PROJECT_ID"

# Enable required APIs
echo "🔧 Enabling required Google Cloud APIs..."
gcloud services enable cloudbuild.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable containerregistry.googleapis.com

# Build and deploy
echo "🏗️  Building and deploying to Cloud Run..."
gcloud run deploy "$SERVICE_NAME" \
  --source . \
  --region "$REGION" \
  --platform managed \
  --memory "$MEMORY" \
  --cpu "$CPU" \
  --min-instances "$MIN_INSTANCES" \
  --max-instances "$MAX_INSTANCES" \
  --timeout "$TIMEOUT" \
  --set-env-vars "DATABASE_URL=$DATABASE_URL,NODE_ENV=production" \
  --allow-unauthenticated \
  --port 8080

# Get the service URL
SERVICE_URL=$(gcloud run services describe "$SERVICE_NAME" --region "$REGION" --format 'value(status.url)')

echo ""
echo "✅ Deployment successful!"
echo "=================================================="
echo "Service URL: $SERVICE_URL"
echo "Health check: $SERVICE_URL/health"
echo ""
echo "📊 View logs:"
echo "gcloud run logs tail $SERVICE_NAME --region $REGION"
echo ""
echo "🔄 Test the worker by creating a run with gates in NOFX"
