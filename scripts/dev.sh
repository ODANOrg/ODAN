#!/bin/bash

# ===========================================
# ODAN - Development Script
# ===========================================

set -e

echo "🔧 Starting ODAN in development mode..."

# Check if .env exists
if [ ! -f .env ]; then
    echo "⚠️  .env file not found. Copying from .env.example..."
    cp .env.example .env
    echo "📝 Please edit .env with your configuration."
fi

# Load environment variables
export $(grep -v '^#' .env | xargs)

# Start only infrastructure services
echo "📦 Starting infrastructure services (PostgreSQL, Redis, ElasticSearch, MinIO)..."
docker-compose up -d postgres redis elasticsearch minio

# Wait for services
echo "⏳ Waiting for services to be ready..."
sleep 15

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
      "createdAt": { "type": "date" }
    }
  }
}
' 2>/dev/null || true

echo ""
echo "✅ Infrastructure is ready!"
echo ""
echo "📍 Services:"
echo "   PostgreSQL:    localhost:5432"
echo "   Redis:         localhost:6379"
echo "   ElasticSearch: localhost:9200"
echo "   MinIO:         localhost:9000 (Console: 9001)"
echo ""
echo "🔧 Now run in separate terminals:"
echo "   Backend:     cd backend && npm run dev"
echo "   Frontend:    cd frontend && npm run dev"
echo "   AI Service:  cd ai-service && python main.py"
echo ""
