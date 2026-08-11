'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

type Line =
  | { kind: 'cmd'; text: string }
  | { kind: 'step'; name: string; type: string; time: string; status: 'ok' | 'paused' | 'note' }
  | { kind: 'blank' }
  | { kind: 'result'; text: string };

const SCRIPT: Line[] = [
  { kind: 'cmd', text: 'workflow run lead-triage' },
  { kind: 'blank' },
  { kind: 'step', name: 'classify_sentiment', type: 'llm_call', time: '142ms', status: 'ok' },
  { kind: 'step', name: 'branch_on_sentiment', type: 'conditional_branch', time: '3ms', status: 'ok' },
  { kind: 'step', name: 'escalation_review', type: 'approval_gate', time: '—', status: 'paused' },
  { kind: 'blank' },
  { kind: 'cmd', text: 'workflow approve escalation_review --run 8f21c9' },
  { kind: 'blank' },
  { kind: 'step', name: 'escalation_review', type: 'approval_gate', time: '1.8s', status: 'ok' },
  { kind: 'step', name: 'notify_team', type: 'notify', time: '88ms', status: 'ok' },
  { kind: 'blank' },
  { kind: 'result', text: 'run 8f21c9 · succeeded in 2.1s' },
];

export function TerminalDemo() {
  const [visible, setVisible] = useState(0);

  useEffect(() => {
    if (visible >= SCRIPT.length) return;
    const line = SCRIPT[visible];
    const delay = line.kind === 'blank' ? 120 : line.kind === 'cmd' ? 420 : 260;
    const t = setTimeout(() => setVisible((v) => v + 1), delay);
    return () => clearTimeout(t);
  }, [visible]);

  const done = visible >= SCRIPT.length;

  return (
    <div className="term">
      <div className="term-bar">
        <span className="term-dot" />
        <span className="term-dot" />
        <span className="term-dot" />
        <span className="mono ml-2 text-[11px] text-[var(--muted-2)]">workflows — zsh</span>
      </div>
      <div className="mono px-4 py-4 text-[12.5px] leading-[1.9] sm:text-[13px]">
        {SCRIPT.slice(0, visible).map((line, i) => {
          if (line.kind === 'blank') return <div key={i} className="h-2" />;
          if (line.kind === 'cmd')
            return (
              <motion.div key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-neutral-200">
                <span className="text-[var(--accent)]">❯</span> {line.text}
              </motion.div>
            );
          if (line.kind === 'result')
            return (
              <motion.div key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-1 text-[var(--success)]">
                {line.text}
              </motion.div>
            );
          const statusChar = line.status === 'paused' ? '◐' : '✓';
          const statusColor = line.status === 'paused' ? 'text-[var(--accent)]' : 'text-[var(--success)]';
          return (
            <motion.div key={i} initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-3 text-[var(--muted)]">
              <span className={statusColor}>{statusChar}</span>
              <span className="text-neutral-300">{line.name}</span>
              <span className="text-[var(--muted-2)]">{line.type}</span>
              <span className="ml-auto shrink-0 tabular-nums">{line.time}</span>
              {line.status === 'paused' && <span className="shrink-0 text-[var(--accent)]">awaiting approval</span>}
            </motion.div>
          );
        })}
        <div className="mt-1 text-neutral-200">
          <span className="text-[var(--accent)]">❯</span> <span className={done ? 'caret' : ''} />
        </div>
      </div>
    </div>
  );
}
