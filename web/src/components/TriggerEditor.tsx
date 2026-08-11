'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trash2, Copy, Check, KeyRound } from 'lucide-react';
import { gqlRequest, GraphQLRequestError } from '@/lib/graphql';
import { ADD_TRIGGER_MUTATION, DELETE_TRIGGER_MUTATION } from '@/lib/queries';
import { TRIGGER_TYPES, TriggerTypeName, OWNER_ONLY_TRIGGER_TYPES, DEFAULT_TRIGGER_CONFIG } from '@/lib/stepDefaults';
import { TRIGGER_TYPE_META } from '@/lib/stepMeta';

interface Trigger {
  id: string;
  type: string;
  is_enabled: boolean;
  config: Record<string, unknown>;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => {
        await navigator.clipboard.writeText(text).catch(() => {});
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="mono flex shrink-0 items-center gap-1 rounded border border-[var(--border)] px-1.5 py-0.5 text-[10px] text-[var(--muted)] hover:text-neutral-200"
    >
      {copied ? <Check className="h-2.5 w-2.5 text-[var(--success)]" /> : <Copy className="h-2.5 w-2.5" />}
      {copied ? 'copied' : 'copy'}
    </button>
  );
}

export function TriggerEditor({
  workflowId,
  orgId,
  triggers,
  isOwner,
  canEdit,
  onChanged,
}: {
  workflowId: string;
  orgId: string;
  triggers: Trigger[];
  isOwner: boolean;
  canEdit: boolean;
  onChanged: () => void;
}) {
  const [type, setType] = useState<TriggerTypeName>('manual');
  const [configText, setConfigText] = useState(JSON.stringify(DEFAULT_TRIGGER_CONFIG.manual, null, 2));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showAdd, setShowAdd] = useState(false);

  const availableTypes = TRIGGER_TYPES.filter((t) => isOwner || !OWNER_ONLY_TRIGGER_TYPES.includes(t));

  const onTypeChange = (next: TriggerTypeName) => {
    setType(next);
    setConfigText(JSON.stringify(DEFAULT_TRIGGER_CONFIG[next], null, 2));
  };

  const addTrigger = async () => {
    setError(null);
    let config: unknown;
    try {
      config = JSON.parse(configText);
    } catch {
      setError('config must be valid JSON');
      return;
    }
    setBusy(true);
    try {
      await gqlRequest(ADD_TRIGGER_MUTATION, {
        object: { workflow_id: workflowId, org_id: orgId, type, config, is_enabled: true },
      });
      setShowAdd(false);
      onChanged();
    } catch (err) {
      setError(err instanceof GraphQLRequestError ? err.message : 'failed to add trigger');
    } finally {
      setBusy(false);
    }
  };

  const deleteTrigger = async (id: string) => {
    await gqlRequest(DELETE_TRIGGER_MUTATION, { id });
    onChanged();
  };

  const subdomain = process.env.NEXT_PUBLIC_NHOST_SUBDOMAIN;
  const region = process.env.NEXT_PUBLIC_NHOST_REGION;
  const webhookBaseUrl =
    subdomain && region ? `https://${subdomain}.functions.${region}.nhost.run/v1` : '<nhost functions URL>';

  return (
    <div>
      <div className="mb-4 flex flex-col gap-2">
        <AnimatePresence initial={false}>
          {triggers.map((t) => {
            const meta = TRIGGER_TYPE_META[t.type as TriggerTypeName];
            const Icon = meta?.icon ?? KeyRound;
            const webhookUrl = `${webhookBaseUrl}/webhooks/workflow?trigger_id=${t.id}`;
            return (
              <motion.div key={t.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="card p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-2.5">
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded border border-[var(--border)] text-[var(--muted)]">
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="mono text-sm text-neutral-200">{meta?.label ?? t.type}</div>
                      {t.type === 'webhook' && (
                        <div className="mt-1.5 flex min-w-0 flex-col gap-1">
                          <div className="flex min-w-0 items-center gap-1.5">
                            <code className="mono min-w-0 truncate rounded bg-black/20 px-1.5 py-0.5 text-[10px] text-[var(--muted)]">
                              POST {webhookUrl}
                            </code>
                            <CopyButton text={webhookUrl} />
                          </div>
                          <p className="break-words text-[10px] text-[var(--muted-2)]">
                            header <code className="mono text-[var(--muted-2)]">x-webhook-signature</code>: HMAC-SHA256(body, webhook_secret)
                          </p>
                        </div>
                      )}
                      {t.type === 'scheduled' && (
                        <p className="mono mt-1 text-xs text-[var(--muted)]">{String(t.config.cron)}</p>
                      )}
                      {t.type === 'database_event' && (
                        <p className="mono mt-1 text-xs text-[var(--muted)]">watching &ldquo;{String(t.config.watched_table)}&rdquo;</p>
                      )}
                    </div>
                  </div>
                  {canEdit && (
                    <button onClick={() => deleteTrigger(t.id)} className="shrink-0 rounded p-1 text-[var(--danger)] hover:bg-[var(--danger)]/10">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
        {triggers.length === 0 && (
          <p className="text-sm text-[var(--muted)]">No triggers yet — this workflow can only be run manually via the Action.</p>
        )}
      </div>

      {canEdit && (
        <>
          {!showAdd ? (
            <button
              onClick={() => setShowAdd(true)}
              className="flex w-full items-center justify-center gap-1.5 rounded border border-dashed border-[var(--border)] py-3 text-xs text-[var(--muted)] transition-colors hover:border-[var(--border-strong)] hover:text-neutral-200"
            >
              <Plus className="h-3.5 w-3.5" /> Add trigger
            </button>
          ) : (
            <div className="card p-3">
              <select
                value={type}
                onChange={(e) => onTypeChange(e.target.value as TriggerTypeName)}
                className="mb-2 w-full rounded border border-[var(--border)] bg-[var(--surface-2)] px-2 py-1.5 text-sm outline-none focus:border-[var(--accent)]"
              >
                {availableTypes.map((t) => (
                  <option key={t} value={t}>
                    {TRIGGER_TYPE_META[t].label}
                  </option>
                ))}
              </select>
              {type !== 'manual' && (
                <textarea
                  value={configText}
                  onChange={(e) => setConfigText(e.target.value)}
                  rows={3}
                  spellCheck={false}
                  className="mono mb-2 w-full rounded border border-[var(--border)] bg-[var(--surface-2)] px-2.5 py-2 text-xs outline-none focus:border-[var(--accent)]"
                />
              )}
              {error && <p className="mb-2 text-xs text-[var(--danger)]">{error}</p>}
              <div className="flex gap-2">
                <button
                  onClick={addTrigger}
                  disabled={busy}
                  className="btn-primary flex items-center gap-1.5 rounded px-3.5 py-1.5 text-xs disabled:opacity-50"
                >
                  {busy ? 'Adding…' : 'Add trigger'}
                </button>
                <button
                  onClick={() => setShowAdd(false)}
                  className="rounded border border-[var(--border)] px-3.5 py-1.5 text-xs text-[var(--muted)] hover:text-neutral-200"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
