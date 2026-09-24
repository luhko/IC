import type { Doc } from '../lib/types'
import { CommandBlock } from './Command'

function Chips({ items, tone }: { items?: string[]; tone: 'need' | 'gain' }) {
  if (!items || items.length === 0) return null
  const cls =
    tone === 'need'
      ? 'border-edge text-ink-dim'
      : 'border-accent/40 text-accent'
  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {items.map((it, i) => (
        <span
          key={i}
          className={`rounded border px-1.5 py-0.5 text-[11px] ${cls}`}
        >
          {tone === 'need' ? '⭠ ' : '⭢ '}
          {it}
        </span>
      ))}
    </div>
  )
}

export function AttackPathView({ doc }: { doc: Doc }) {
  const steps = doc.steps ?? []
  return (
    <ol className="relative ml-3 border-l border-edge">
      {steps.map((s, i) => (
        <li key={i} className="mb-6 ml-6">
          <span className="absolute -left-3 flex h-6 w-6 items-center justify-center rounded-full border border-edge bg-bg-softer text-xs font-semibold text-accent">
            {i + 1}
          </span>
          <h3 className="text-base font-semibold text-ink">{s.title}</h3>
          {s.detail && <p className="mt-1 text-sm text-ink-dim">{s.detail}</p>}
          <div className="flex flex-wrap gap-x-6">
            <Chips items={s.needs} tone="need" />
            <Chips items={s.gains} tone="gain" />
          </div>
          {s.commands && s.commands.length > 0 && (
            <CommandBlock code={s.commands.join('\n')} lang="sh" />
          )}
        </li>
      ))}
    </ol>
  )
}
