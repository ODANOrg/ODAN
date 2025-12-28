#!/bin/bash

# ===========================================
# ODAN - Restart Script
# ===========================================

echo "🔄 Restarting ODAN..."

./scripts/stop.sh
./scripts/start.sh
