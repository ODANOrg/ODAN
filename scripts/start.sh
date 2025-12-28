#!/bin/bash

# ===========================================
# ODAN - Start Script
# ===========================================

set -e

echo "🚀 Starting ODAN..."

# Check if .env exists
if [ ! -f .env ]; then
    echo "⚠️  .env file not found. Copying from .env.example..."
    cp .env.example .env
    echo "📝 Please edit .env with your configuration and run this script again."
    exit 1
fi

# Load environment variables
export $(grep -v '^#' .env | xargs)

# Create necessary directories
mkdir -p data/blockchain

# Start services
echo "📦 Building and starting Docker containers..."
docker-compose up -d --build

# Wait for services to be ready
echo "⏳ Waiting for services to be ready..."
sleep 10

# Run database migrations
echo "🔄 Running database migrations..."
docker-compose exec backend npx prisma migrate deploy

# Create MinIO bucket if not exists
echo "🪣 Setting up MinIO bucket..."
docker-compose exec minio mc alias set local http://localhost:9000 $MINIO_ROOT_USER $MINIO_ROOT_PASSWORD || true
docker-compose exec minio mc mb local/$MINIO_BUCKET --ignore-existing || true
docker-compose exec minio mc anonymous set download local/$MINIO_BUCKET || true

# Setup ElasticSearch indices
echo "🔍 Setting up ElasticSearch indices..."
curl -X PUT "http://localhost:9200/tickets" -H 'Content-Type: application/json' -d'
{
  "settings": {
    "analysis": {
      "analyzer": {
        "ticket_analyzer": {
          "type": "custom",
          "tokenizer": "standard",
          "filter": ["lowercase", "asciifolding", "snowball"]
        }
      }
    }
  },
  "mappings": {
    "properties": {
      "id": { "type": "keyword" },
      "title": { 
        "type": "text",
        "analyzer": "ticket_analyzer",
        "fields": {
          "keyword": { "type": "keyword" }
        }
      },
      "description": { 
        "type": "text",
        "analyzer": "ticket_analyzer"
      },
      "category": { "type": "keyword" },
      "status": { "type": "keyword" },
      "createdAt": { "type": "date" },
      "responses": {
        "type": "nested",
        "properties": {
          "content": { "type": "text", "analyzer": "ticket_analyzer" }
        }
      }
    }
  }
}
' 2>/dev/null || true

echo ""
echo "✅ ODAN is now running!"
echo ""
echo "📍 Access points:"
echo "   Frontend:      http://localhost:3000"
echo "   Backend API:   http://localhost:4000"
echo "   MinIO Console: http://localhost:9001"
echo "   ElasticSearch: http://localhost:9200"
echo ""
echo "📋 Useful commands:"
echo "   Stop:    ./scripts/stop.sh"
echo "   Logs:    ./scripts/logs.sh"
echo "   Restart: ./scripts/restart.sh"
echo ""
