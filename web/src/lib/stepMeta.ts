import { Bot, Globe, Database, Bell, GitBranch, ShieldCheck, LucideIcon, MousePointerClick, Webhook, CalendarClock, Table2 } from 'lucide-react';
import type { StepTypeName, TriggerTypeName } from './stepDefaults';

/*
 * Deliberately monochrome — every step type shares the same neutral icon
 * treatment except approval_gate, which is the one step type that means
 * "a human needs to look at this". Color here is a signal, not decoration.
 */
export const STEP_TYPE_META: Record<StepTypeName, { icon: LucideIcon; label: string; accented?: boolean }> = {
  llm_call: { icon: Bot, label: 'LLM call' },
  http_request: { icon: Globe, label: 'HTTP request' },
  db_write: { icon: Database, label: 'DB write' },
  notify: { icon: Bell, label: 'Notify' },
  conditional_branch: { icon: GitBranch, label: 'Branch' },
  approval_gate: { icon: ShieldCheck, label: 'Approval gate', accented: true },
};

export const TRIGGER_TYPE_META: Record<TriggerTypeName, { icon: LucideIcon; label: string }> = {
  manual: { icon: MousePointerClick, label: 'Manual' },
  webhook: { icon: Webhook, label: 'Webhook' },
  scheduled: { icon: CalendarClock, label: 'Scheduled' },
  database_event: { icon: Table2, label: 'Database event' },
};
