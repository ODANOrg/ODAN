#!/bin/bash

# ===========================================
# ODAN - Backup Script
# ===========================================

set -e

BACKUP_DIR="./backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

echo "💾 Starting ODAN backup..."

# Create backup directory
mkdir -p $BACKUP_DIR

# Load environment variables
export $(grep -v '^#' .env | xargs)

# Backup PostgreSQL
echo "📦 Backing up PostgreSQL..."
docker-compose exec -T postgres pg_dump -U $POSTGRES_USER $POSTGRES_DB > "$BACKUP_DIR/postgres_$TIMESTAMP.sql"

# Backup blockchain data
echo "⛓️  Backing up blockchain data..."
cp -r data/blockchain "$BACKUP_DIR/blockchain_$TIMESTAMP" 2>/dev/null || echo "No blockchain data yet"

# Backup Redis (RDB snapshot)
echo "📦 Backing up Redis..."
docker-compose exec redis redis-cli -a $REDIS_PASSWORD BGSAVE
sleep 2
docker cp odan-redis:/data/dump.rdb "$BACKUP_DIR/redis_$TIMESTAMP.rdb" 2>/dev/null || echo "Redis backup skipped"

# Compress backup
echo "🗜️  Compressing backup..."
tar -czf "$BACKUP_DIR/odan_backup_$TIMESTAMP.tar.gz" \
    "$BACKUP_DIR/postgres_$TIMESTAMP.sql" \
    "$BACKUP_DIR/blockchain_$TIMESTAMP" \
    "$BACKUP_DIR/redis_$TIMESTAMP.rdb" 2>/dev/null || true

# Clean up individual files
rm -f "$BACKUP_DIR/postgres_$TIMESTAMP.sql"
rm -rf "$BACKUP_DIR/blockchain_$TIMESTAMP"
rm -f "$BACKUP_DIR/redis_$TIMESTAMP.rdb"

echo ""
echo "✅ Backup completed: $BACKUP_DIR/odan_backup_$TIMESTAMP.tar.gz"
