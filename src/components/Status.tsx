import {
  useChecklist,
  DEFAULT_ITEM,
  type Progress,
  type Result,
} from '../store/checklist'

const PROGRESS: { v: Progress; label: string; active: string }[] = [
  { v: 'untested', label: 'Not tested', active: 'bg-white/10 text-ink' },
  { v: 'in_progress', label: 'In progress', active: 'bg-warn/15 text-warn' },
  { v: 'tested', label: 'Tested', active: 'bg-accent-soft text-accent' },
]

const RESULT: { v: Result; label: string; active: string }[] = [
  { v: 'vuln', label: 'Vuln', active: 'bg-danger/15 text-danger' },
  { v: 'partial', label: 'Partial', active: 'bg-warn/15 text-warn' },
  { v: 'notvuln', label: 'Not vuln', active: 'bg-white/10 text-ink-dim' },
]

/** Colour a status dot: result wins over progress; null when nothing set. */
export function dotColor(status: Progress, result: Result): string | null {
  if (result === 'vuln') return '#ff6b6b'
  if (result === 'partial') return '#e3b341'
  if (result === 'notvuln') return '#6b7684'
  if (status === 'tested') return '#4dd0a7'
  if (status === 'in_progress') return '#e3b341'
  return null
}

export function StatusDot({ slug }: { slug: string }) {
  const item = useChecklist((s) => s.items[slug])
  const c = dotColor(item?.status ?? 'untested', item?.result ?? 'unknown')
  if (!c) return null
  return (
    <span
      className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
      style={{ background: c }}
      aria-hidden
    />
  )
}

function Seg<T extends string>({
  options,
  value,
  onPick,
}: {
  options: { v: T; label: string; active: string }[]
  value: T
  onPick: (v: T) => void
}) {
  return (
    <div className="inline-flex overflow-hidden rounded border border-edge">
      {options.map((o, i) => (
        <button
          key={o.v}
          onClick={() => onPick(o.v)}
          className={[
            'px-2 py-1 text-[11px] transition-colors',
            i > 0 ? 'border-l border-edge' : '',
            value === o.v ? o.active : 'text-ink-faint hover:bg-white/5',
          ].join(' ')}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function StatusControl({ slug }: { slug: string }) {
  const item = useChecklist((s) => s.items[slug]) ?? DEFAULT_ITEM
  const setStatus = useChecklist((s) => s.setStatus)
  const setResult = useChecklist((s) => s.setResult)
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-ink-faint">
          Test
        </span>
        <Seg
          options={PROGRESS}
          value={item.status}
          onPick={(v) => setStatus(slug, v)}
        />
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-ink-faint">
          Result
        </span>
        <Seg
          options={RESULT}
          value={item.result}
          onPick={(v) =>
            setResult(slug, item.result === v ? 'unknown' : v)
          }
        />
      </div>
    </div>
  )
}
