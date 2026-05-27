#!/bin/sh
set -e

echo "Starting Go backend..."
/usr/local/bin/report-server &

echo "Starting nginx..."
exec nginx -g "daemon off;"
