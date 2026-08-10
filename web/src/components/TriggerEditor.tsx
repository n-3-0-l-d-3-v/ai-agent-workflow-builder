'use client';

import { useState } from 'react';
import { gqlRequest, GraphQLRequestError } from '@/lib/graphql';
import { ADD_TRIGGER_MUTATION, DELETE_TRIGGER_MUTATION } from '@/lib/queries';
import { TRIGGER_TYPES, TriggerTypeName, OWNER_ONLY_TRIGGER_TYPES, DEFAULT_TRIGGER_CONFIG } from '@/lib/stepDefaults';

interface Trigger {
  id: string;
  type: string;
  is_enabled: boolean;
  config: Record<string, unknown>;
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
    subdomain && region ? `https://${subdomain}.functions.${region}.nhost.run` : '<nhost functions URL>';

  return (
    <div>
      <ul className="flex flex-col gap-2 mb-4">
        {triggers.map((t) => (
          <li key={t.id} className="border border-neutral-800 rounded px-3 py-2">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-medium">{t.type}</div>
                {t.type === 'webhook' && (
                  <div className="text-xs text-neutral-500 mt-1 break-all">
                    POST {webhookBaseUrl}/webhooks/workflow?trigger_id={t.id}
                    <br />
                    header x-webhook-signature: HMAC-SHA256(body, webhook_secret)
                  </div>
                )}
                {t.type === 'scheduled' && (
                  <div className="text-xs text-neutral-500 mt-1">cron: {String(t.config.cron)}</div>
                )}
                {t.type === 'database_event' && (
                  <div className="text-xs text-neutral-500 mt-1">watching table: {String(t.config.watched_table)}</div>
                )}
              </div>
              {canEdit && (
                <button onClick={() => deleteTrigger(t.id)} className="text-xs text-red-400 hover:text-red-300 shrink-0">
                  remove
                </button>
              )}
            </div>
          </li>
        ))}
        {triggers.length === 0 && <p className="text-sm text-neutral-500">No triggers yet — this workflow can only be run manually via the Action.</p>}
      </ul>

      {canEdit && (
        <div className="border border-neutral-800 rounded p-3">
          <div className="flex gap-2 mb-2">
            <select
              value={type}
              onChange={(e) => onTypeChange(e.target.value as TriggerTypeName)}
              className="bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-sm"
            >
              {availableTypes.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          {type !== 'manual' && (
            <textarea
              value={configText}
              onChange={(e) => setConfigText(e.target.value)}
              rows={3}
              spellCheck={false}
              className="w-full bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-xs font-mono mb-2"
            />
          )}
          {error && <p className="text-xs text-red-400 mb-2">{error}</p>}
          <button
            onClick={addTrigger}
            disabled={busy}
            className="text-xs bg-neutral-100 text-neutral-900 rounded px-3 py-1.5 font-medium disabled:opacity-50"
          >
            {busy ? 'adding...' : 'add trigger'}
          </button>
        </div>
      )}
    </div>
  );
}
