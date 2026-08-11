export const STEP_TYPES = ['llm_call', 'http_request', 'db_write', 'notify', 'conditional_branch', 'approval_gate'] as const;
export type StepTypeName = (typeof STEP_TYPES)[number];

export const TRIGGER_TYPES = ['manual', 'webhook', 'scheduled', 'database_event'] as const;
export type TriggerTypeName = (typeof TRIGGER_TYPES)[number];

// Step types that reach outside the sandbox — layer 2 restricts these to
// owners only (enforced by the Hasura permission, mirrored here so the UI
// doesn't even offer the option to a non-owner).
export const OWNER_ONLY_STEP_TYPES: StepTypeName[] = ['db_write', 'notify'];
export const OWNER_ONLY_TRIGGER_TYPES: TriggerTypeName[] = ['webhook'];

export const DEFAULT_STEP_CONFIG: Record<StepTypeName, unknown> = {
  llm_call: {
    system_prompt: 'You are a support ticket triage assistant. Reply with one word: positive, neutral, or negative.',
    prompt: 'Classify the sentiment of this message: {{trigger.webhook_payload.message}}',
    temperature: 0.2,
  },
  http_request: {
    url: 'https://jsonplaceholder.typicode.com/todos/1',
    method: 'GET',
  },
  db_write: {
    key: 'llm_result',
    value: '{{previous}}',
  },
  notify: {
    channel: 'slack',
    target: 'https://hooks.slack.com/services/REPLACE/WITH/YOUR_WEBHOOK',
    message: 'Workflow step produced: {{previous}}',
  },
  conditional_branch: {
    path: 'text',
    operator: 'contains',
    value: 'negative',
    on_true_goto: null,
    on_false_goto: null,
  },
  approval_gate: {
    reason: 'Review the LLM output before continuing',
  },
};

export const DEFAULT_TRIGGER_CONFIG: Record<TriggerTypeName, unknown> = {
  manual: {},
  webhook: { webhook_secret: crypto.randomUUID?.() ?? Math.random().toString(36).slice(2) },
  scheduled: { cron: '*/5 * * * *' },
  database_event: { watched_table: 'leads' },
};
