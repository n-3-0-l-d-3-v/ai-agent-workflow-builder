#!/usr/bin/env node
// Seeds the two-organization demo scenario described in the assignment's
// Final Task: two orgs, each with their own users/roles, Org A with a
// workflow covering llm_call + http_request + conditional_branch +
// approval_gate, both a manual and a webhook trigger, so the cross-org
// isolation check has real data to try to break.
//
// Plain Node (fetch + crypto only, no deps) against the live nhost Auth
// REST API and Hasura admin GraphQL endpoint -- run with:
//   node scripts/seed.mjs
// after populating .env.local (see .env.example).

import { readFileSync } from 'node:fs';
import { createHmac } from 'node:crypto';

function loadEnvLocal() {
  try {
    const raw = readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
    for (const line of raw.split('\n')) {
      const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
    }
  } catch {
    // fine if it doesn't exist -- assume env is already set
  }
}
loadEnvLocal();

const SUBDOMAIN = process.env.NHOST_SUBDOMAIN;
const REGION = process.env.NHOST_REGION;
const ADMIN_SECRET = process.env.HASURA_GRAPHQL_ADMIN_SECRET;
const GRAPHQL_URL = process.env.HASURA_GRAPHQL_URL ?? `https://${SUBDOMAIN}.hasura.${REGION}.nhost.run/v1/graphql`;
const AUTH_URL = `https://${SUBDOMAIN}.auth.${REGION}.nhost.run`;

if (!SUBDOMAIN || !REGION || !ADMIN_SECRET) {
  console.error('Missing NHOST_SUBDOMAIN / NHOST_REGION / HASURA_GRAPHQL_ADMIN_SECRET in .env.local');
  process.exit(1);
}

async function gql(query, variables) {
  const res = await fetch(GRAPHQL_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-hasura-admin-secret': ADMIN_SECRET },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors) throw new Error(JSON.stringify(json.errors, null, 2));
  return json.data;
}

async function signUp(email, password, displayName) {
  // Idempotent by design: attempt sign-up (ignoring whatever shape the
  // response takes -- it varies depending on whether email verification
  // is required for this project), then resolve the canonical user id via
  // admin GraphQL either way. auth.users is exposed as auth_users --
  // Hasura schema-prefixes tables outside the public schema.
  await fetch(`${AUTH_URL}/v1/signup/email-password`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password, options: { displayName } }),
  }).catch(() => {});

  const data = await gql(
    `query ($email: citext!) { auth_users(where: { email: { _eq: $email } }, limit: 1) { id } }`,
    { email }
  );
  if (data.auth_users[0]) return data.auth_users[0].id;
  throw new Error(`could not resolve a user id for ${email} after sign-up attempt`);
}

const PASSWORD = 'DemoPassw0rd!';

async function main() {
  console.log('Creating demo users...');
  const ownerA = await signUp('owner-a@example.com', PASSWORD, 'Owner A');
  const editorA = await signUp('editor-a@example.com', PASSWORD, 'Editor A');
  const viewerA = await signUp('viewer-a@example.com', PASSWORD, 'Viewer A');
  const ownerB = await signUp('owner-b@example.com', PASSWORD, 'Owner B');

  console.log('Creating Org A (owned by owner-a) and Org B (owned by owner-b)...');
  const orgs = await gql(
    `mutation ($orgA: organizations_insert_input!, $orgB: organizations_insert_input!) {
      a: insert_organizations_one(object: $orgA) { id }
      b: insert_organizations_one(object: $orgB) { id }
    }`,
    {
      orgA: { name: 'Org A — Acme', slug: `acme-${Date.now()}`, created_by: ownerA, quota_calls_allowed: 100 },
      orgB: { name: 'Org B — Globex', slug: `globex-${Date.now()}`, created_by: ownerB, quota_calls_allowed: 100 },
    }
  );
  const orgAId = orgs.a.id;
  const orgBId = orgs.b.id;

  console.log('Adding editor-a and viewer-a to Org A...');
  await gql(
    `mutation ($objects: [org_members_insert_input!]!) {
      insert_org_members(objects: $objects) { affected_rows }
    }`,
    {
      objects: [
        { org_id: orgAId, user_id: editorA, role: 'editor' },
        { org_id: orgAId, user_id: viewerA, role: 'viewer' },
      ],
    }
  );

  console.log('Building the Final Task demo workflow in Org A...');
  const webhookSecret = createHmac('sha256', 'seed').update(orgAId).digest('hex').slice(0, 32);

  const workflow = await gql(
    `mutation ($object: workflows_insert_input!) { insert_workflows_one(object: $object) { id } }`,
    {
      object: {
        org_id: orgAId,
        name: 'Lead triage & escalation',
        description: 'Classifies an inbound lead message, escalates negative sentiment for approval before notifying the team.',
        created_by: ownerA,
      },
    }
  );
  const workflowId = workflow.insert_workflows_one.id;

  await gql(
    `mutation ($objects: [workflow_steps_insert_input!]!) { insert_workflow_steps(objects: $objects) { affected_rows } }`,
    {
      objects: [
        {
          workflow_id: workflowId,
          org_id: orgAId,
          step_order: 1,
          type: 'llm_call',
          name: 'Classify sentiment',
          config: {
            system_prompt: 'Reply with exactly one word: positive, neutral, or negative.',
            prompt: 'Classify the sentiment of this lead message: {{trigger.webhook_payload.message}}',
            temperature: 0,
          },
        },
        {
          workflow_id: workflowId,
          org_id: orgAId,
          step_order: 2,
          type: 'http_request',
          name: 'Enrich lead via public API',
          config: { url: 'https://httpbin.org/get', method: 'GET' },
        },
        {
          workflow_id: workflowId,
          org_id: orgAId,
          step_order: 3,
          type: 'conditional_branch',
          name: 'Branch on sentiment',
          config: { path: 'text', operator: 'contains', value: 'negative', on_true_goto: 4, on_false_goto: 5 },
        },
        {
          workflow_id: workflowId,
          org_id: orgAId,
          step_order: 4,
          type: 'approval_gate',
          name: 'Escalation review',
          config: { reason: 'Negative sentiment detected -- needs a human before we notify the account team' },
        },
        {
          workflow_id: workflowId,
          org_id: orgAId,
          step_order: 5,
          type: 'notify',
          name: 'Notify team',
          config: { channel: 'slack', target: 'https://hooks.slack.com/services/REPLACE/WITH/REAL', message: 'Lead triaged: {{previous}}' },
        },
      ],
    }
  );

  await gql(
    `mutation ($objects: [workflow_triggers_insert_input!]!) { insert_workflow_triggers(objects: $objects) { affected_rows } }`,
    {
      objects: [
        { workflow_id: workflowId, org_id: orgAId, type: 'manual', config: {} },
        { workflow_id: workflowId, org_id: orgAId, type: 'webhook', config: { webhook_secret: webhookSecret } },
      ],
    }
  );

  console.log('\nDone.\n');
  console.log('Demo accounts (password for all: DemoPassw0rd!):');
  console.log('  owner-a@example.com  -- owner of Org A');
  console.log('  editor-a@example.com -- editor of Org A');
  console.log('  viewer-a@example.com -- viewer of Org A');
  console.log('  owner-b@example.com  -- owner of Org B (use this to test cross-org isolation)');
  console.log(`\nOrg A id: ${orgAId}`);
  console.log(`Org B id: ${orgBId}`);
  console.log(`Workflow id: ${workflowId}`);
  console.log(`Webhook secret (for the webhook trigger on this workflow): ${webhookSecret}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
