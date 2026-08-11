import { Bot, Globe, Database, Bell, GitBranch, ShieldCheck, LucideIcon, MousePointerClick, Webhook, CalendarClock, Table2 } from 'lucide-react';
import type { StepTypeName, TriggerTypeName } from './stepDefaults';

export const STEP_TYPE_META: Record<StepTypeName, { icon: LucideIcon; color: string; ring: string; label: string }> = {
  llm_call: { icon: Bot, color: 'text-violet-300', ring: 'from-violet-500/25 to-fuchsia-500/10', label: 'LLM call' },
  http_request: { icon: Globe, color: 'text-cyan-300', ring: 'from-cyan-500/25 to-blue-500/10', label: 'HTTP request' },
  db_write: { icon: Database, color: 'text-emerald-300', ring: 'from-emerald-500/25 to-teal-500/10', label: 'DB write' },
  notify: { icon: Bell, color: 'text-amber-300', ring: 'from-amber-500/25 to-orange-500/10', label: 'Notify' },
  conditional_branch: { icon: GitBranch, color: 'text-pink-300', ring: 'from-pink-500/25 to-rose-500/10', label: 'Branch' },
  approval_gate: { icon: ShieldCheck, color: 'text-red-300', ring: 'from-red-500/25 to-orange-500/10', label: 'Approval gate' },
};

export const TRIGGER_TYPE_META: Record<TriggerTypeName, { icon: LucideIcon; label: string }> = {
  manual: { icon: MousePointerClick, label: 'Manual' },
  webhook: { icon: Webhook, label: 'Webhook' },
  scheduled: { icon: CalendarClock, label: 'Scheduled' },
  database_event: { icon: Table2, label: 'Database event' },
};
