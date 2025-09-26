#!/bin/bash

# Script to check Vercel deployment status after git push
# Usage: ./check-deployment.sh

echo "🚀 Checking Vercel deployment status..."

# Wait a bit for Vercel to pick up the push
sleep 5

# Get the latest deployment
LATEST_DEPLOYMENT=$(vercel ls nofx-control-plane --json 2>/dev/null | jq -r '.deployments[0]')

if [ -z "$LATEST_DEPLOYMENT" ]; then
    echo "❌ Could not fetch deployment info"
    exit 1
fi

DEPLOYMENT_URL=$(echo $LATEST_DEPLOYMENT | jq -r '.url')
DEPLOYMENT_STATE=$(echo $LATEST_DEPLOYMENT | jq -r '.state')
DEPLOYMENT_ID=$(echo $LATEST_DEPLOYMENT | jq -r '.uid')

echo "📦 Latest deployment: $DEPLOYMENT_URL"
echo "🔄 Initial status: $DEPLOYMENT_STATE"

# Poll for deployment completion (max 3 minutes)
MAX_ATTEMPTS=36
ATTEMPT=0

while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
    DEPLOYMENT_INFO=$(vercel inspect $DEPLOYMENT_URL --json 2>/dev/null)
    STATE=$(echo $DEPLOYMENT_INFO | jq -r '.readyState')

    case $STATE in
        "READY")
            echo "✅ Deployment successful!"
            echo "🌐 URL: https://$DEPLOYMENT_URL"
            exit 0
            ;;
        "ERROR")
            echo "❌ Deployment failed!"
            echo "Fetching error logs..."

            # Try to get error details
            ERROR_MESSAGE=$(echo $DEPLOYMENT_INFO | jq -r '.errorMessage // "No error message available"')
            echo "Error: $ERROR_MESSAGE"

            # Show build logs if available
            echo -e "\n📋 Recent build output:"
            vercel logs $DEPLOYMENT_URL 2>/dev/null | tail -50

            exit 1
            ;;
        "CANCELED")
            echo "⚠️ Deployment was canceled"
            exit 1
            ;;
        *)
            echo -n "."
            sleep 5
            ATTEMPT=$((ATTEMPT + 1))
            ;;
    esac
done

echo ""
echo "⏱️ Timeout: Deployment is taking longer than expected"
echo "Check manually at: https://vercel.com/volacci/nofx-control-plane"
exit 1