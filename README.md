# Reprompt

Query rewriter that optimizes customer queries to trigger ChatGPT's shopping/product recommendation behavior. Built as an interview project for Profound.

## Quick Start

### Prerequisites

- Python 3.12+
- Node.js 20+ (install via `fnm install --lts`)
- [uv](https://astral.sh/uv) package manager

### Backend

```bash
cd api
cp .env.example .env          # Add your ANTHROPIC_API_KEY (optional — mock mode works without it)
uv sync --all-extras
uv run uvicorn reprompt.main:app --reload --port 8000
```

### Frontend

```bash
cd web
npm install
npm run dev                    # Opens on http://localhost:3000
```

### Or use Make

```bash
make dev-api    # Terminal 1
make dev-web    # Terminal 2
make test       # Run all tests
```

## Features

- **Query Rewriter**: 8 strategies (specificity injection, preference framing, problem-to-product bridge, comparison trigger, use-case anchoring, conciseness optimization, co-citation targeting, Turn 1 opener)
- **Composite Scorer**: 6 sub-scorers (lexical, structural, specificity, Google Shopping proxy, citation cluster, Turn 1 fitness)
- **Batch Mode**: CSV upload → CSV download with scored rewrites
- **Prompt Baskets**: 5 curated topic clusters (135 prompts) with before/after aggregate analysis
- **Mock Mode**: Works without API keys for development

## Architecture

```
api/                    # FastAPI backend
  reprompt/
    services/           # 6 sub-scorers + composite scorer + rewriter + basket runner
    routes/             # /rewrite, /rewrite/batch, /strategies, /baskets
    data/               # co_citation_map.json, strategies.json, baskets/*.jsonl
  tests/                # 42 unit tests

web/                    # Next.js 15 + Tailwind v4 frontend
  src/
    app/                # Pages: rewrite, batch, baskets
    components/         # ScoreRing, RewriteCard, ScoreComparison, etc.
    lib/api.ts          # Backend API client
    types/              # TypeScript interfaces
```

## API Endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/rewrite` | POST | Single query → scored rewrites |
| `/rewrite/batch` | POST | CSV upload → CSV download |
| `/strategies` | GET | List all 8 strategies |
| `/baskets` | GET | List available prompt baskets |
| `/baskets/{name}/run` | POST | Run basket → aggregate results |
| `/health` | GET | Health check |
