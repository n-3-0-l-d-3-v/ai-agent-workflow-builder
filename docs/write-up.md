# Design write-up

## Schema reasoning

Every tenant-scoped table (`workflows`, `workflow_steps`, `workflow_triggers`,
`workflow_runs`, `step_runs`, `notifications`, `workflow_outputs`, `leads`)
carries `org_id` directly, rather than only being reachable by walking
`workflow -> workflow_run -> ...`. That's not denormalization for its own
sake: every one of these tables also needs a fast, indexed org-scoping
check in its Hasura permission (see below), and a chain of joins through
mutable parent rows is both slower and a worse place to make a security
mistake than a single indexed column comparison against `org_members`.

`workflow_runs` / `step_runs` intentionally have **no** insert/update
permission for authenticated users. Every write to them goes through the
`triggerWorkflowRun` / `approveStep` Action handlers, using the admin
secret. That's the actual boundary that makes quota enforcement and retry
logic trustworthy: if a client could `insert_workflow_runs`, they could
skip the quota check entirely.

`notifications` and `workflow_outputs` exist as their own tables (not just
JSON blobs on `step_runs.output`) because the assignment is explicit that
`notify` should be an Event Trigger and `db_write` should save into "your
own tables" — both need something concrete to point an event trigger or a
query at.

`leads` is a small stand-in "real" business table. The `database_event`
trigger type needs *something* plausible to watch, and picking an actual
domain table (new lead comes in -> auto-run an enrichment/triage workflow)
demonstrates the feature doing something a real product would use it for,
instead of a synthetic `_test_events` table that only exists to prove the
box is checked.

## The two permission layers, and why they're enforced differently

**Layer 1 (org + role scoping)** is a single Hasura role, `user` — not
three roles named `owner`/`editor`/`viewer`. A user's role is *per
organization* (owner in Org A, viewer in Org B is a valid, expected
state), and Hasura roles are a single static claim per request. Modeling
role as a Hasura role would mean either re-authenticating per org or
smuggling the "current org" into the role name, both worse than the
alternative: every permission is a relationship check against
`org_members`, e.g.

```yaml
filter:
  _exists:
    _table: { schema: public, name: org_members }
    _where:
      _and:
        - org_id: { _ceq: org_id }
        - user_id: { _eq: X-Hasura-User-Id }
```

with role-gated mutations adding `role: { _in: [owner, editor] }` to the
same `_exists`. This is checked on every table independently — there is no
single "am I in this org" gate that everything else trusts.

**Layer 2 (step-level gating)** splits into two genuinely different
mechanisms on purpose:

- Restricting *who can add* a `db_write`/`notify` step or a `webhook`
  trigger to owners is still just a row check at write time (does this
  insert's `type`/`org_id` combination satisfy an owner-only condition) —
  so it lives directly in the `workflow_steps` / `workflow_triggers`
  insert/update permissions, right next to layer 1, no Action needed.
- Clearing an `approval_gate` is **not** a row read/write — it's a
  decision about whether a specific in-flight, paused execution is allowed
  to continue *right now*. There's no row whose static permission
  expression can capture "was this run already paused, and is the caller
  currently an owner/editor of its org" in a way that's safe to evaluate
  ahead of time. So `approveStep` (`functions/actions/approveStep.ts`)
  re-fetches the step_run, checks it's actually `paused`, looks up the
  caller's *current* role in the run's org via `functions/lib/auth.ts`,
  and only then flips the row and resumes execution. If the check lived in
  a database permission instead, "was this approved" would collapse into
  "can this user write to step_runs at all" — much coarser than what the
  assignment asks for.

## Approval-gate pause/resume

Execution (`functions/lib/runEngine.ts`) is written to be resumable by
construction rather than needing separate "start" and "resume" code
paths: `executeRun(runId)` always re-fetches the run's `step_runs`, finds
the first `workflow_step` that doesn't have one yet, and continues from
there. Hitting an `approval_gate` step creates a `step_run` with
`status: paused`, sets the `workflow_run` to `paused`, and returns —
nothing distinguishes "first execution reaching this point" from "resuming
after a previous pause" in the loop itself.

`approveStep` doesn't contain any run-stepping logic of its own. On
`approve`, it flips the gated `step_run` to `succeeded` (recording
`approved_by`/`approved_at`) and the `workflow_run` back to `running`, then
just calls `executeRun(runId)` again — which sees the gate step is now
terminal, skips it, and keeps going. On `reject`, it marks both the
`step_run` and the `workflow_run` `failed` and stops, no re-entry into the
engine at all.

Because the run engine talks to Hasura with the admin secret and every
mutation it issues lands as a normal row write, a client subscribed to
`step_runs` for that `workflow_run_id` sees each step transition
(`running` -> `succeeded`/`paused`/`failed`) the instant it happens —
independent of whether the *outer* `triggerWorkflowRun`/`approveStep` HTTP
call is still in flight. That's what makes the frontend's live status feed
work without polling, even though the Action itself runs the whole chain
synchronously from the caller's perspective.

## Other decisions worth flagging

- **Webhook trigger as a signed HTTP endpoint, not a GraphQL Action call.**
  `functions/webhooks/workflow.ts` is a plain HTTP handler an external
  system POSTs to directly (HMAC-SHA256 signature over the raw body,
  keyed by a per-trigger secret), rather than requiring the caller to
  construct a Hasura Action GraphQL mutation. It shares the exact same
  `startRun()`/`executeRun()` core as every other trigger path — the only
  thing that differs between "manual", "webhook", "scheduled", and
  "database_event" is how the run gets started, not how it runs.
- **Scheduled triggers are one Hasura cron trigger, not one per workflow.**
  Hasura cron triggers are static (fixed schedule, defined in metadata).
  Since each workflow's schedule is a row in `workflow_triggers.config`,
  there's a single cron trigger (`dispatch_scheduled_workflows`, every
  minute) that evaluates every enabled `scheduled` trigger's stored cron
  expression itself (`functions/lib/cron.ts`) rather than needing a
  metadata deploy every time a user changes a schedule.
- **No external dependencies in `functions/`.** Every handler is Node
  18+ `fetch`/`crypto` only. The call graph is a handful of HTTP requests
  and GraphQL mutations; pulling in an SDK for any one of them would be
  more surface area to audit than code it saves.
- **`db_write`/`notify` step type restriction and the webhook-trigger
  restriction are UI-mirrored, not UI-enforced.** The frontend hides
  owner-only step/trigger types from the type picker for non-owners
  (`web/src/lib/stepDefaults.ts`), but that's a UX nicety — the Hasura
  insert/update permission is what actually stops the request if someone
  edits the payload by hand.
