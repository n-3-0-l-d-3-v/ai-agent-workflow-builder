'use client';

import { useState } from 'react';
import { gqlRequest, GraphQLRequestError } from '@/lib/graphql';
import { ADD_STEP_MUTATION, DELETE_STEP_MUTATION, SWAP_STEP_ORDER_MUTATION } from '@/lib/queries';
import { STEP_TYPES, StepTypeName, OWNER_ONLY_STEP_TYPES, DEFAULT_STEP_CONFIG } from '@/lib/stepDefaults';

interface Step {
  id: string;
  step_order: number;
  type: string;
  name: string;
  config: unknown;
}

export function StepEditor({
  workflowId,
  orgId,
  steps,
  isOwner,
  canEdit,
  onChanged,
}: {
  workflowId: string;
  orgId: string;
  steps: Step[];
  isOwner: boolean;
  canEdit: boolean;
  onChanged: () => void;
}) {
  const [type, setType] = useState<StepTypeName>('llm_call');
  const [name, setName] = useState('');
  const [configText, setConfigText] = useState(JSON.stringify(DEFAULT_STEP_CONFIG.llm_call, null, 2));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const availableTypes = STEP_TYPES.filter((t) => isOwner || !OWNER_ONLY_STEP_TYPES.includes(t));

  const onTypeChange = (next: StepTypeName) => {
    setType(next);
    setConfigText(JSON.stringify(DEFAULT_STEP_CONFIG[next], null, 2));
  };

  const addStep = async () => {
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
      await gqlRequest(ADD_STEP_MUTATION, {
        object: {
          workflow_id: workflowId,
          org_id: orgId,
          step_order: (steps.at(-1)?.step_order ?? 0) + 1,
          type,
          name: name || type,
          config,
        },
      });
      setName('');
      onChanged();
    } catch (err) {
      setError(err instanceof GraphQLRequestError ? err.message : 'failed to add step');
    } finally {
      setBusy(false);
    }
  };

  const deleteStep = async (id: string) => {
    await gqlRequest(DELETE_STEP_MUTATION, { id });
    onChanged();
  };

  const moveStep = async (index: number, direction: -1 | 1) => {
    const other = steps[index + direction];
    const current = steps[index];
    if (!other) return;
    setError(null);
    try {
      await gqlRequest(SWAP_STEP_ORDER_MUTATION, {
        stepAId: current.id,
        stepBId: other.id,
        orderA: current.step_order,
        orderB: other.step_order,
        temp: -1,
      });
      onChanged();
    } catch (err) {
      setError(err instanceof GraphQLRequestError ? err.message : 'failed to reorder step');
    }
  };

  return (
    <div>
      <ol className="flex flex-col gap-2 mb-4">
        {steps.map((s, i) => (
          <li key={s.id} className="border border-neutral-800 rounded px-3 py-2 flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-medium">
                <span className="text-neutral-500 mr-2">#{s.step_order}</span>
                {s.name} <span className="text-xs text-neutral-500">({s.type})</span>
              </div>
              <pre className="text-xs text-neutral-500 mt-1 max-w-lg whitespace-pre-wrap break-all">
                {JSON.stringify(s.config)}
              </pre>
            </div>
            {canEdit && (
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => moveStep(i, -1)}
                  disabled={i === 0}
                  title="move up"
                  className="text-xs text-neutral-400 hover:text-neutral-200 disabled:opacity-30 disabled:hover:text-neutral-400"
                >
                  ↑
                </button>
                <button
                  onClick={() => moveStep(i, 1)}
                  disabled={i === steps.length - 1}
                  title="move down"
                  className="text-xs text-neutral-400 hover:text-neutral-200 disabled:opacity-30 disabled:hover:text-neutral-400"
                >
                  ↓
                </button>
                <button onClick={() => deleteStep(s.id)} className="text-xs text-red-400 hover:text-red-300">
                  remove
                </button>
              </div>
            )}
          </li>
        ))}
        {steps.length === 0 && <p className="text-sm text-neutral-500">No steps yet.</p>}
      </ol>

      {canEdit && (
        <div className="border border-neutral-800 rounded p-3">
          <div className="flex gap-2 mb-2">
            <select
              value={type}
              onChange={(e) => onTypeChange(e.target.value as StepTypeName)}
              className="bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-sm"
            >
              {availableTypes.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <input
              placeholder="step name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="flex-1 bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-sm"
            />
          </div>
          {!isOwner && OWNER_ONLY_STEP_TYPES.includes(type) === false && (
            <p className="text-xs text-neutral-600 mb-2">db_write and notify are owner-only step types.</p>
          )}
          <textarea
            value={configText}
            onChange={(e) => setConfigText(e.target.value)}
            rows={6}
            spellCheck={false}
            className="w-full bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-xs font-mono mb-2"
          />
          {error && <p className="text-xs text-red-400 mb-2">{error}</p>}
          <button
            onClick={addStep}
            disabled={busy}
            className="text-xs bg-neutral-100 text-neutral-900 rounded px-3 py-1.5 font-medium disabled:opacity-50"
          >
            {busy ? 'adding...' : 'add step'}
          </button>
        </div>
      )}
    </div>
  );
}
