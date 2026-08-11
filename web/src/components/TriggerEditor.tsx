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
      className="flex shrink-0 items-center gap-1 rounded-md border border-[var(--border)] px-1.5 py-0.5 text-[10px] text-neutral-500 hover:text-neutral-200"
    >
      {copied ? <Check className="h-2.5 w-2.5 text-emerald-400" /> : <Copy className="h-2.5 w-2.5" />}
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
              <motion.div
                key={t.id}
                layout
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="card p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-white/5">
                      <Icon className="h-3.5 w-3.5 text-neutral-400" />
                    </span>
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-neutral-200">{meta?.label ?? t.type}</div>
                      {t.type === 'webhook' && (
                        <div className="mt-1.5 flex flex-col gap-1">
                          <div className="flex items-center gap-1.5">
                            <code className="truncate rounded bg-black/30 px-1.5 py-0.5 text-[10px] text-neutral-400">
                              POST {webhookUrl}
                            </code>
                            <CopyButton text={webhookUrl} />
                          </div>
                          <p className="text-[10px] text-neutral-600">
                            header <code className="text-neutral-500">x-webhook-signature</code>: HMAC-SHA256(body, webhook_secret)
                          </p>
                        </div>
                      )}
                      {t.type === 'scheduled' && (
                        <p className="mt-1 text-xs text-neutral-500">
                          cron <code className="rounded bg-black/30 px-1 py-0.5 text-[11px]">{String(t.config.cron)}</code>
                        </p>
                      )}
                      {t.type === 'database_event' && (
                        <p className="mt-1 text-xs text-neutral-500">watching table &ldquo;{String(t.config.watched_table)}&rdquo;</p>
                      )}
                    </div>
                  </div>
                  {canEdit && (
                    <button onClick={() => deleteTrigger(t.id)} className="shrink-0 rounded-md p-1 text-red-400 hover:bg-red-500/10">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
        {triggers.length === 0 && (
          <p className="text-sm text-neutral-500">No triggers yet — this workflow can only be run manually via the Action.</p>
        )}
      </div>

      {canEdit && (
        <>
          {!showAdd ? (
            <button
              onClick={() => setShowAdd(true)}
              className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-[var(--border)] py-3 text-xs text-neutral-500 transition-colors hover:border-violet-500/40 hover:text-violet-300"
            >
              <Plus className="h-3.5 w-3.5" /> Add trigger
            </button>
          ) : (
            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="card p-3">
              <select
                value={type}
                onChange={(e) => onTypeChange(e.target.value as TriggerTypeName)}
                className="mb-2 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-2 py-1.5 text-sm outline-none focus:border-violet-400"
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
                  className="mb-2 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-2.5 py-2 font-mono text-xs outline-none focus:border-violet-400"
                />
              )}
              {error && <p className="mb-2 text-xs text-red-400">{error}</p>}
              <div className="flex gap-2">
                <button
                  onClick={addTrigger}
                  disabled={busy}
                  className="btn-primary flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs disabled:opacity-50"
                >
                  {busy ? 'Adding…' : 'Add trigger'}
                </button>
                <button
                  onClick={() => setShowAdd(false)}
                  className="rounded-lg border border-[var(--border)] px-3.5 py-1.5 text-xs text-neutral-400 hover:text-neutral-200"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          )}
        </>
      )}
    </div>
  );
}
