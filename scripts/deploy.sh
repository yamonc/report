#!/bin/bash
set -e

DEPLOY_DIR="/opt/report"
COMPOSE_FILE="docker-compose.prod.yml"

echo "=== Deploy Start ==="
cd "$DEPLOY_DIR"

# Pull latest image
echo "Pulling latest image..."
docker compose -f "$COMPOSE_FILE" pull

# Restart services
echo "Restarting services..."
docker compose -f "$COMPOSE_FILE" up -d --remove-orphans

# Wait for health check
echo "Waiting for health check..."
sleep 5

# Check status
if docker compose -f "$COMPOSE_FILE" ps | grep -q "unhealthy"; then
    echo "ERROR: Service is unhealthy!"
    docker compose -f "$COMPOSE_FILE" logs --tail 50
    exit 1
fi

# Clean up old images
docker image prune -f

echo "=== Deploy Completed at $(date) ==="
