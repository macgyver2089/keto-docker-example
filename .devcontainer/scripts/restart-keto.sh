#!/bin/bash
set -e

echo "🔄 Restarting Keto service..."
docker compose -f /workspace/docker/docker-compose.yml --watch restart keto

echo "⏳ Waiting for Keto to be ready..."
sleep 3

until curl -sf http://localhost:4466/health/ready > /dev/null 2>&1; do
  echo "   Still waiting..."
  sleep 1
done

echo "✅ Keto is ready!"
echo ""
echo "You can now run your tests:"
echo "  cd keto-test && node test-permissions.js"
