import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { navGroups, attackPaths, searchable } from '../lib/content'
import { docHref } from '../lib/nav'
import { StatusControl, StatusDot } from '../components/Status'
import { useChecklist, DEFAULT_ITEM } from '../store/checklist'
import { useVars } from '../store/vars'

function exportState() {
  const data = {
    version: 1,
    exportedAt: new Date().toISOString(),
    variables: useVars.getState().values,
    checklist: useChecklist.getState().items,
  }
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `ic-engagement-${Date.now()}.json`
  a.click()
  URL.revokeObjectURL(url)
}

function importState(file: File) {
  const reader = new FileReader()
  reader.onload = () => {
    try {
      const data = JSON.parse(String(reader.result))
      if (data.variables && typeof data.variables === 'object')
        useVars.setState({ values: data.variables })
      if (data.checklist && typeof data.checklist === 'object')
        useChecklist.setState({ items: data.checklist })
    } catch {
      alert('Invalid engagement file.')
    }
  }
  reader.readAsText(file)
}

type Filter =
  | 'all'
  | 'untested'
  | 'in_progress'
  | 'tested'
  | 'vuln'
  | 'partial'
  | 'notvuln'

const FILTERS: { v: Filter; label: string }[] = [
  { v: 'all', label: 'All' },
  { v: 'untested', label: 'Not tested' },
  { v: 'in_progress', label: 'In progress' },
  { v: 'tested', label: 'Tested' },
  { v: 'vuln', label: 'Vulnerable' },
  { v: 'partial', label: 'Partial' },
  { v: 'notvuln', label: 'Not vuln' },
]

export function ChecklistPage() {
  const items = useChecklist((s) => s.items)
  const clearAll = useChecklist((s) => s.clearAll)
  const [filter, setFilter] = useState<Filter>('all')
  const fileRef = useRef<HTMLInputElement>(null)

  const groups = useMemo(
    () => [...navGroups, { name: 'AD / Attack paths', docs: attackPaths }],
    [],
  )

  const counts = useMemo(() => {
    const c = {
      total: searchable.length,
      tested: 0,
      in_progress: 0,
      untested: 0,
      vuln: 0,
      partial: 0,
      notvuln: 0,
    }
    for (const d of searchable) {
      const it = items[d.slug] ?? DEFAULT_ITEM
      c[it.status]++
      if (it.result !== 'unknown') c[it.result]++
    }
    return c
  }, [items])

  const match = (slug: string): boolean => {
    if (filter === 'all') return true
    const it = items[slug] ?? DEFAULT_ITEM
    if (filter === 'untested' || filter === 'in_progress' || filter === 'tested')
      return it.status === filter
    return it.result === filter
  }

  return (
    <div className="scroll-thin h-full overflow-y-auto">
      <div className="mx-auto max-w-3xl px-8 py-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold text-ink">Checklist</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={exportState}
              className="rounded border border-edge px-3 py-1.5 text-[12px] text-ink-faint hover:border-accent/60 hover:text-accent"
              title="Download variables + checklist as JSON"
            >
              export
            </button>
            <button
              onClick={() => fileRef.current?.click()}
              className="rounded border border-edge px-3 py-1.5 text-[12px] text-ink-faint hover:border-accent/60 hover:text-accent"
              title="Load an engagement JSON"
            >
              import
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) importState(f)
                e.target.value = ''
              }}
            />
            <button
              onClick={() => {
                if (confirm('Clear all test statuses and notes?')) clearAll()
              }}
              className="rounded border border-edge px-3 py-1.5 text-[12px] text-ink-faint hover:border-danger/60 hover:text-danger"
            >
              clear all
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-4 text-sm text-ink-dim">
          <span>
            <span className="font-mono text-lg text-accent">{counts.tested}</span>
            <span className="text-ink-faint">/{counts.total}</span> tested
          </span>
          <span>
            <span className="font-mono text-lg text-warn">
              {counts.in_progress}
            </span>{' '}
            in progress
          </span>
          <span>
            <span className="font-mono text-lg text-danger">{counts.vuln}</span>{' '}
            vuln
          </span>
          <span>
            <span className="font-mono text-lg text-warn">{counts.partial}</span>{' '}
            partial
          </span>
        </div>

        <div className="mt-4 flex flex-wrap gap-1">
          {FILTERS.map((f) => (
            <button
              key={f.v}
              onClick={() => setFilter(f.v)}
              className={`rounded border px-2 py-1 text-[11px] transition-colors ${
                filter === f.v
                  ? 'border-accent/50 bg-accent-soft text-accent'
                  : 'border-edge text-ink-faint hover:bg-white/5'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="mt-6 space-y-6">
          {groups.map((g) => {
            const rows = g.docs.filter((d) => match(d.slug))
            if (rows.length === 0) return null
            return (
              <div key={g.name}>
                <div className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-accent">
                  {g.name}
                </div>
                <div className="space-y-1.5">
                  {rows.map((d) => (
                    <div
                      key={d.slug}
                      className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded border border-edge/60 bg-bg-soft px-3 py-2"
                    >
                      <StatusDot slug={d.slug} />
                      <Link
                        to={docHref(d)}
                        className="min-w-0 flex-1 truncate text-[13px] text-ink hover:text-accent"
                      >
                        {d.title}
                      </Link>
                      <StatusControl slug={d.slug} />
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
