# Contributing to ODAN

Thank you for helping improve ODAN. This guide outlines how to propose changes, run checks locally, and submit pull requests.

## Ground rules
- Keep contributions focused and incremental; avoid unrelated changes in a single PR.
- Maintain accessibility and clarity in UI changes (contrast, keyboard navigation, language support).
- Do not commit secrets or production credentials. Use `.env.local` files for local overrides and keep them out of version control.

## Branching model
- Base branch: `main`
- Feature branches: `feature/<short-title>`
- Fix branches: `fix/<issue-id-or-title>`

## Development setup
1. Install prerequisites (Docker, Node.js 20+, Python 3.11).
2. Copy environment variables: `cp .env.example .env` and adjust as needed.
3. Start dependencies for local dev: `./scripts/dev.sh`.
4. Run services locally:
   - Backend: `cd backend && npm install && npm run dev`
   - Frontend: `cd frontend && npm install && npm run dev`
   - AI Service: `cd ai-service && pip install -r requirements.txt && python main.py`

## Running with Docker Compose
If you prefer containers, the repo ships Dockerfiles for each service. Typical flow:
- Build images: `docker compose build backend frontend ai-service`
- Start databases and infra: `docker compose up -d postgres redis elasticsearch minio`
- Start services: `docker compose up -d backend ai-service frontend`
- Watch logs: `docker compose logs -f backend frontend ai-service`

You can also run everything in one shot with `docker compose up --build`, but starting infra first makes it easier to spot service issues.

## Quality checks
Run these before opening a PR:
- Backend: `cd backend && npm run lint && npm run build && npm test -- --runInBand`
- Frontend: `cd frontend && npm run lint && npm run build && npm test -- --runInBand`
- AI Service: `cd ai-service && python -m compileall .`

The CI pipeline mirrors these steps and will block merges if checks fail.

## Coding standards
- TypeScript: prefer explicit types on public interfaces; keep functions small and pure where possible.
- Python: favor clear, typed functions; keep modules cohesive.
- API changes: document request/response shapes and update validation where applicable.
- UI: keep strings in the localization files and support dark mode; avoid hard-coded colors.

## Pull requests
- Describe the problem, the solution, and any trade-offs.
- Include screenshots or short clips for UI changes when possible.
- Link related issues and note breaking changes explicitly.
- Keep commits meaningful; rebasing is preferred over merging for keeping history clean.

## Security
Report vulnerabilities privately before public disclosure. Avoid adding dependencies that are unmaintained or unlicensed.
