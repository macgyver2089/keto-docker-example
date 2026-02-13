#!/bin/sh
set -e

echo "Starting Keto server..."
# Start Keto in the background
keto serve -c /etc/keto/keto.yaml &
KETO_PID=$!

echo "Waiting for Keto to be ready..."
# Wait for Keto to be healthy
until wget -q --spider http://localhost:4466/health/ready 2>/dev/null; do
  echo "Waiting for Keto..."
  sleep 1
done

echo ""
echo "Keto is ready! Loading relationships..."
keto relation-tuple create /etc/keto/relationships.json \
  --insecure-disable-transport-security \
  --read-remote localhost:4466 \
  --write-remote localhost:4467

echo ""
echo "Relationships loaded successfully!"
echo ""
echo "Sample permission checks you can try:"
echo "  docker compose exec keto keto check alice view File file-1 --insecure-disable-transport-security"
echo "  docker compose exec keto keto check alice view File folder-1 --insecure-disable-transport-security"
echo ""
echo "Keto is ready and running on ports 4466 (read) and 4467 (write)"

# Wait for the background process
wait $KETO_PID
