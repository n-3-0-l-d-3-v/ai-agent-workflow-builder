# Dispatch

https://github.com/user-attachments/assets/578908af-20e0-44a7-98cc-b080dd1ae5bb

**Live app**: https://dispatch-subspace.vercel.app

**Demo recording**: [Final Task scenario walkthrough](docs/demo/final-task-walkthrough.mp4)

An AI agent workflow orchestrator — a mini n8n purpose-built for chaining AI
agent steps. Organizations build
workflows out of `llm_call`, `http_request`, `db_write`, `notify`,
`conditional_branch`, and `approval_gate` steps; runs start manually, on a
schedule, via a signed webhook, or off a database event; and every action
is checked against two independent permission layers (org+role scoping,
and step-level gating for the steps that reach outside the sandbox).

Design reasoning (schema, both permission layers, approval-gate
pause/resume) is written up in [docs/write-up.md](docs/write-up.md) — read
that for *why* things are structured this way, not just what's there.

## Stack

- **Database / API**: [nhost](https://nhost.io) (Postgres + Hasura GraphQL Engine + Auth + Functions)
- **Frontend**: Next.js (App Router) + TypeScript + Tailwind, deployed on Vercel
- **Workflow execution**: Hasura Actions (`triggerWorkflowRun`, `approveStep`) backed by nhost serverless functions
- **LLM provider**: [Groq](https://console.groq.com) (OpenAI-compatible chat completions)

## Repo layout

```
nhost/       Hasura migrations, metadata, config -- source of truth for the DB/API layer
functions/   Hasura Action / Event Trigger / Cron handlers (the run engine lives here)
web/         Next.js frontend
scripts/     seed.mjs -- builds the two-org demo scenario used for the final walkthrough
docs/        Design write-up
```

## Data model

`organizations` -> `org_members` (per-org role) -> `workflows` ->
`workflow_steps` / `workflow_triggers`, and `workflows` -> `workflow_runs`
-> `step_runs`. `notifications` and `workflow_outputs` are where `notify`
and `db_write` steps actually land data; `leads` is a small stand-in
business table the `database_event` trigger type watches. Full schema in
[nhost/migrations](nhost/migrations).

## Permissions (two layers)

1. **Org + role scoping** — a single Hasura role (`user`); every
   permission is a relationship check against `org_members`, since a
   user's role is per-organization, not a global claim.
2. **Step-level gating** — `db_write`/`notify` steps and `webhook`
   triggers can only be added by an owner (enforced in the Hasura insert
   permission on `workflow_steps`/`workflow_triggers`). Clearing an
   `approval_gate` is a mid-execution decision, so it's checked fresh
   inside the `approveStep` Action handler
   ([functions/actions/approveStep.ts](functions/actions/approveStep.ts)),
   not a database permission.

## Running it locally

nhost's CLI has no native Windows build (WSL2/Docker only on Windows), so
this project targets a real hosted nhost project rather than a local
Docker stack — see **Setup** below.

### 1. nhost project

1. Create a project at [app.nhost.io](https://app.nhost.io).
2. Connect this GitHub repo under **Settings -> Deployments** so
   migrations, Hasura metadata, and `functions/` deploy automatically on
   push to `main`.
3. Under **Settings -> Environment Variables**, note your project's
   `NHOST_SUBDOMAIN` / `NHOST_REGION` (or read them off the project URL:
   `https://<subdomain>.hasura.<region>.nhost.run`).
4. Under **Settings -> Secrets**, set `HASURA_GRAPHQL_ADMIN_SECRET` to a
   value you choose (secrets are write-only in the dashboard). Nothing
   else needs configuring for the functions themselves -- nhost
   auto-injects `NHOST_GRAPHQL_URL` / `NHOST_ADMIN_SECRET` into every
   function's environment already (see
   [functions/lib/hasura.ts](functions/lib/hasura.ts)).
5. Optionally set `GROQ_API_KEY` as a secret so `llm_call` steps hit a
   real model instead of the disclosed stub (see
   [functions/lib/llm.ts](functions/lib/llm.ts) — without a key, `llm_call`
   still runs end-to-end with a clearly-labelled stubbed response and an
   artificial delay).

### 2. Push schema + metadata

```bash
cp .env.example .env.local   # fill in NHOST_SUBDOMAIN / NHOST_REGION / HASURA_GRAPHQL_ADMIN_SECRET
cd nhost
hasura migrate apply  --endpoint "$HASURA_GRAPHQL_ENDPOINT" --admin-secret "$HASURA_GRAPHQL_ADMIN_SECRET" --database-name default
hasura metadata apply --endpoint "$HASURA_GRAPHQL_ENDPOINT" --admin-secret "$HASURA_GRAPHQL_ADMIN_SECRET"
```

(The [Hasura CLI](https://hasura.io/docs/latest/hasura-cli/install-hasura-cli/) has native Windows/macOS/Linux binaries — this part doesn't need WSL.)

### 3. Seed the two-org demo scenario

```bash
node scripts/seed.mjs
```

Creates `owner-a` / `editor-a` / `viewer-a` in Org A, `owner-b` in Org B
(password `DemoPassw0rd!` for all), and a demo workflow in Org A covering
`llm_call` -> `http_request` -> `conditional_branch` -> `approval_gate` ->
`notify`, with both a manual and a webhook trigger.

### 4. Frontend

```bash
cd web
cp .env.example .env.local   # NEXT_PUBLIC_NHOST_SUBDOMAIN / NEXT_PUBLIC_NHOST_REGION
npm install
npm run dev
```

## Deploying

- **nhost**: automatic on push to `main` once the GitHub repo is
  connected (Settings -> Deployments).
- **Frontend**: `cd web && vercel` (or connect the repo in the Vercel
  dashboard), with `NEXT_PUBLIC_NHOST_SUBDOMAIN` / `NEXT_PUBLIC_NHOST_REGION`
  set as project env vars.

## Stubbed vs. real integrations

| Integration | Real | Fallback |
|---|---|---|
| `llm_call` | Groq (`GROQ_API_KEY`) | disclosed stub with artificial delay |
| `notify` (email) | Resend (`RESEND_API_KEY`) | logs the message server-side, clearly labelled |
| `notify` (slack) | real Slack incoming webhook | — (works as soon as `target` is a real webhook URL) |
