'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronUp, ChevronDown as ChevronDownIcon, Trash2, Plus, Save, Pencil, X, Lock } from 'lucide-react';
import { gqlRequest, GraphQLRequestError } from '@/lib/graphql';
import { ADD_STEP_MUTATION, DELETE_STEP_MUTATION, SWAP_STEP_ORDER_MUTATION, UPDATE_STEP_MUTATION } from '@/lib/queries';
import { STEP_TYPES, StepTypeName, OWNER_ONLY_STEP_TYPES, DEFAULT_STEP_CONFIG } from '@/lib/stepDefaults';
import { STEP_TYPE_META } from '@/lib/stepMeta';

interface Step {
  id: string;
  step_order: number;
  type: string;
  name: string;
  config: unknown;
}

function ConfigPreview({ type, config }: { type: string; config: unknown }) {
  const c = (config ?? {}) as Record<string, unknown>;
  let preview = '';
  if (type === 'llm_call') preview = String(c.prompt ?? '');
  else if (type === 'http_request') preview = `${c.method ?? 'GET'} ${c.url ?? ''}`;
  else if (type === 'db_write') preview = `key: ${c.key ?? ''}`;
  else if (type === 'notify') preview = `${c.channel ?? ''} → ${c.target ?? ''}`;
  else if (type === 'conditional_branch') preview = `if ${c.path} ${c.operator} "${c.value}"`;
  else if (type === 'approval_gate') preview = String(c.reason ?? '');
  return <p className="truncate text-xs text-neutral-500">{preview || '—'}</p>;
}

function StepNode({
  step,
  index,
  total,
  canEdit,
  isOwner,
  onMove,
  onDelete,
  onSave,
}: {
  step: Step;
  index: number;
  total: number;
  canEdit: boolean;
  isOwner: boolean;
  onMove: (i: number, d: -1 | 1) => void;
  onDelete: (id: string) => void;
  onSave: (id: string, name: string, config: unknown) => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(step.name);
  const [configText, setConfigText] = useState(JSON.stringify(step.config, null, 2));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const meta = STEP_TYPE_META[step.type as StepTypeName];
  const Icon = meta?.icon ?? Lock;
  const locked = OWNER_ONLY_STEP_TYPES.includes(step.type as StepTypeName) && !isOwner;

  const startEdit = () => {
    setName(step.name);
    setConfigText(JSON.stringify(step.config, null, 2));
    setError(null);
    setEditing(true);
    setExpanded(true);
  };

  const save = async () => {
    setError(null);
    let config: unknown;
    try {
      config = JSON.parse(configText);
    } catch {
      setError('config must be valid JSON');
      return;
    }
    setSaving(true);
    try {
      await onSave(step.id, name, config);
      setEditing(false);
    } catch (err) {
      setError(err instanceof GraphQLRequestError ? err.message : 'failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }} className="relative flex gap-3">
      {/* connecting line + order dot */}
      <div className="flex flex-col items-center">
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${meta?.ring ?? 'from-neutral-700 to-neutral-800'} ring-1 ring-white/10`}
        >
          <Icon className={`h-4 w-4 ${meta?.color ?? 'text-neutral-400'}`} />
        </div>
        {index < total - 1 && <div className="my-1 w-px flex-1 bg-gradient-to-b from-[var(--border)] to-transparent" style={{ minHeight: 20 }} />}
      </div>

      <div className="card card-hover mb-4 flex-1 overflow-hidden">
        <button onClick={() => setExpanded((v) => !v)} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-neutral-600">#{step.step_order}</span>
              <span className="truncate text-sm font-medium text-neutral-100">{step.name}</span>
              <span className={`rounded-full bg-white/5 px-1.5 py-0.5 text-[10px] uppercase tracking-wide ${meta?.color ?? 'text-neutral-500'}`}>
                {meta?.label ?? step.type}
              </span>
              {locked && <Lock className="h-3 w-3 text-neutral-600" />}
            </div>
            {!expanded && <ConfigPreview type={step.type} config={step.config} />}
          </div>
          {expanded ? <ChevronUp className="h-4 w-4 shrink-0 text-neutral-500" /> : <ChevronDownIcon className="h-4 w-4 shrink-0 text-neutral-500" />}
        </button>

        <AnimatePresence initial={false}>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden border-t border-[var(--border)]"
            >
              <div className="px-4 py-3">
                {editing ? (
                  <div className="flex flex-col gap-2">
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-2.5 py-1.5 text-sm outline-none focus:border-violet-400"
                    />
                    <textarea
                      value={configText}
                      onChange={(e) => setConfigText(e.target.value)}
                      rows={7}
                      spellCheck={false}
                      className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-2.5 py-2 font-mono text-xs outline-none focus:border-violet-400"
                    />
                    {error && <p className="text-xs text-red-400">{error}</p>}
                    <div className="flex gap-2">
                      <button
                        onClick={save}
                        disabled={saving}
                        className="btn-primary flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs disabled:opacity-50"
                      >
                        <Save className="h-3 w-3" /> {saving ? 'Saving…' : 'Save'}
                      </button>
                      <button
                        onClick={() => setEditing(false)}
                        className="flex items-center gap-1.5 rounded-md border border-[var(--border)] px-3 py-1.5 text-xs text-neutral-400 hover:text-neutral-200"
                      >
                        <X className="h-3 w-3" /> Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <pre className="overflow-x-auto whitespace-pre-wrap break-all rounded-lg bg-black/30 px-3 py-2 text-[11px] text-neutral-400">
                    {JSON.stringify(step.config, null, 2)}
                  </pre>
                )}

                {canEdit && !editing && (
                  <div className="mt-3 flex items-center gap-1 border-t border-[var(--border)] pt-3">
                    <button onClick={startEdit} className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-neutral-400 hover:bg-white/5 hover:text-neutral-100">
                      <Pencil className="h-3 w-3" /> Edit
                    </button>
                    <button
                      onClick={() => onMove(index, -1)}
                      disabled={index === 0}
                      className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-neutral-400 hover:bg-white/5 hover:text-neutral-100 disabled:opacity-30"
                    >
                      <ChevronUp className="h-3 w-3" /> Move up
                    </button>
                    <button
                      onClick={() => onMove(index, 1)}
                      disabled={index === total - 1}
                      className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-neutral-400 hover:bg-white/5 hover:text-neutral-100 disabled:opacity-30"
                    >
                      <ChevronDown className="h-3 w-3" /> Move down
                    </button>
                    <button
                      onClick={() => onDelete(step.id)}
                      className="ml-auto flex items-center gap-1 rounded-md px-2 py-1 text-xs text-red-400 hover:bg-red-500/10"
                    >
                      <Trash2 className="h-3 w-3" /> Remove
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
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
  const [showAdd, setShowAdd] = useState(false);

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
      setShowAdd(false);
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

  const saveStep = async (id: string, stepName: string, config: unknown) => {
    await gqlRequest(UPDATE_STEP_MUTATION, { id, name: stepName, config });
    onChanged();
  };

  const moveStep = async (index: number, direction: -1 | 1) => {
    const other = steps[index + direction];
    const current = steps[index];
    if (!other) return;
    await gqlRequest(SWAP_STEP_ORDER_MUTATION, {
      stepAId: current.id,
      stepBId: other.id,
      orderA: current.step_order,
      orderB: other.step_order,
      temp: -1,
    });
    onChanged();
  };

  return (
    <div>
      <div className="flex flex-col">
        <AnimatePresence initial={false}>
          {steps.map((s, i) => (
            <StepNode
              key={s.id}
              step={s}
              index={i}
              total={steps.length}
              canEdit={canEdit}
              isOwner={isOwner}
              onMove={moveStep}
              onDelete={deleteStep}
              onSave={saveStep}
            />
          ))}
        </AnimatePresence>
        {steps.length === 0 && <p className="text-sm text-neutral-500">No steps yet.</p>}
      </div>

      {canEdit && (
        <>
          {!showAdd ? (
            <button
              onClick={() => setShowAdd(true)}
              className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-[var(--border)] py-3 text-xs text-neutral-500 transition-colors hover:border-violet-500/40 hover:text-violet-300"
            >
              <Plus className="h-3.5 w-3.5" /> Add step
            </button>
          ) : (
            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="card p-3">
              <div className="mb-2 flex gap-2">
                <select
                  value={type}
                  onChange={(e) => onTypeChange(e.target.value as StepTypeName)}
                  className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-2 py-1.5 text-sm outline-none focus:border-violet-400"
                >
                  {availableTypes.map((t) => (
                    <option key={t} value={t}>
                      {STEP_TYPE_META[t].label}
                    </option>
                  ))}
                </select>
                <input
                  placeholder="step name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-2.5 py-1.5 text-sm outline-none focus:border-violet-400"
                />
              </div>
              {!isOwner && (
                <p className="mb-2 text-xs text-neutral-600">db_write and notify are owner-only step types.</p>
              )}
              <textarea
                value={configText}
                onChange={(e) => setConfigText(e.target.value)}
                rows={6}
                spellCheck={false}
                className="mb-2 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-2.5 py-2 font-mono text-xs outline-none focus:border-violet-400"
              />
              {error && <p className="mb-2 text-xs text-red-400">{error}</p>}
              <div className="flex gap-2">
                <button
                  onClick={addStep}
                  disabled={busy}
                  className="btn-primary flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs disabled:opacity-50"
                >
                  {busy ? 'Adding…' : 'Add step'}
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
