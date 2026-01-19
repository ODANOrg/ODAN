<p align="center">
  <img src="frontend/public/logo.svg" alt="ODAN Logo" width="240" />
</p>

<h1 align="center">ODAN - Open Digital Assistance Network</h1>

<p align="center">
  A community-first platform that connects people who need technology help with volunteers who provide human support.
</p>

---

ODAN ships as a full stack: Next.js frontend, Fastify backend, Python AI moderation service, PostgreSQL, ElasticSearch, Redis, and MinIO, all orchestrated with Docker Compose.

## Contents
- Overview
- Features
- Technology Stack
- Getting Started
- Development Workflow
- Environment Variables
- Project Structure
- Scripts
- CI/CD
- Contributing
- License
- Security and Responsible Use

## Overview

ODAN reduces the digital divide by pairing requesters with volunteers, keeping every interaction transparent, moderated, and verifiable through blockchain-backed records and issued certificates.

### How it works
1. A requester opens a ticket describing the problem.
2. Volunteers accept tickets and provide real-time assistance (chat + whiteboard).
3. All contributions are logged immutably and can be verified.
4. Volunteers earn verifiable certificates with QR codes.

## Features

**For requesters**
- Ticket creation with detailed descriptions and image uploads
- Real-time chat with volunteers
- Similar-ticket detection via ElasticSearch to avoid duplicates

**For volunteers**
- Time tracking per ticket and response editor with source capture
- Collaborative whiteboard for visual explanations
- Dashboard with contribution statistics and verifiable certificates

**Platform**
- OAuth (Telegram, Google, GitHub, X) and JWT sessions
- AI moderation for text and images (HuggingFace API with local fallback)
- Immutable activity log backed by a local blockchain
- Multi-language UI (English, Portuguese-BR, Spanish) and dark mode

## Technology Stack
- Frontend: Next.js 14 (App Router), TypeScript, Tailwind CSS, shadcn/ui, next-intl, next-themes, React Query, Zustand, Socket.io client
- Backend: Fastify 4, TypeScript, Prisma, Socket.io, BullMQ, PDFKit, QRCode, Zod
- AI Moderation Service: Python 3.11, FastAPI, HuggingFace Transformers (API + local fallback)
- Data: PostgreSQL 16, ElasticSearch 8, Redis 7, MinIO (S3-compatible)
- Packaging: Docker Compose with service-specific Dockerfiles

## Getting Started

Prerequisites: Docker, Docker Compose, Git, Node.js 20+, Python 3.11 (for local dev without containers).

```bash
git clone https://github.com/your-org/odan.git
cd odan

# Configure environment
cp .env.example .env

# Start everything
chmod +x scripts/*.sh
./scripts/start.sh
```

Access:
- Frontend: http://localhost:3000
- API: http://localhost:4000
- MinIO Console: http://localhost:9001

## Development Workflow

Run only the infrastructure via Docker, then start services locally:

```bash
./scripts/dev.sh

# Terminals for each service
cd backend && npm install && npm run dev
cd frontend && npm install && npm run dev
cd ai-service && pip install -r requirements.txt && python main.py
```

## Environment Variables

- Copy [.env.example](.env.example) to `.env` and adjust secrets.
- Critical for production: `JWT_SECRET`, `POSTGRES_PASSWORD`, OAuth credentials for at least one provider, and MinIO credentials.

Frontend-specific public variables:
- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_SOCKET_URL`
- `ODAN_API_URL` (server-only, used for Docker-internal routing)

Backend/service variables are documented inline in [.env.example](.env.example).

## Project Structure

```
odan/
├── backend/            Fastify API, Prisma, Socket.io
├── frontend/           Next.js 14 (App Router)
├── ai-service/         FastAPI moderation service
├── scripts/            Automation scripts (start/stop/dev/backup)
├── data/               Persistent blockchain data
├── docker-compose.yml  Orchestration for all services
└── .github/workflows/  CI/CD pipelines
```

## Scripts

| Script | Purpose |
| --- | --- |
| `./scripts/start.sh` | Start all services via Docker Compose |
| `./scripts/stop.sh` | Stop all services |
| `./scripts/restart.sh` | Restart all services |
| `./scripts/logs.sh [service]` | Tail logs from a service |
| `./scripts/dev.sh` | Launch infrastructure only for local dev |
| `./scripts/backup.sh` | Backup persistent data |

## CI/CD

- [.github/workflows/ci.yml](.github/workflows/ci.yml) runs lint/build/test across backend, frontend, AI service, and builds Docker images for validation.
- [.github/workflows/release.yml](.github/workflows/release.yml) builds and pushes Docker images to GHCR on tags or manual dispatch (configure registry credentials if needed).

## Contributing

- See [CONTRIBUTING.md](CONTRIBUTING.md) for branching, coding standards, and review guidelines.
- Pull Requests should keep lint and build checks passing and include relevant tests when applicable.

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.

## Security and Responsible Use

- All assistance is free; no data is sold.
- AI moderation is enforced for text and images; reports are supported.
- The project must not be used for unlawful activities. Report security issues via a private channel before disclosing.
