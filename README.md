# AI Agent Workflow Builder

A mini n8n for chaining AI agent steps, built on nhost (Postgres + Hasura + Auth + Functions) with a Next.js frontend.

Work in progress — full setup instructions land in [docs/setup.md](docs/setup.md) as pieces come together.

## Stack

- **Database / API**: nhost (Postgres + Hasura GraphQL Engine + Auth)
- **Frontend**: Next.js (App Router) + TypeScript + Tailwind
- **Workflow execution**: Hasura Actions backed by nhost serverless functions
- **LLM provider**: Groq

## Repo layout

```
nhost/       Hasura migrations, metadata, config (source of truth for the DB/API layer)
functions/   Serverless functions backing Hasura Actions, cron jobs, event trigger handlers
web/         Next.js frontend
docs/        Architecture notes and write-up
```
