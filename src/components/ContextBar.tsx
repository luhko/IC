import { useMemo, useState } from 'react'
import { variableDefs } from '../lib/content'
import { useVars } from '../store/vars'
import type { VariableDef } from '../lib/types'

export function ContextBar() {
  const values = useVars((s) => s.values)
  const setVar = useVars((s) => s.setVar)
  const clearAll = useVars((s) => s.clearAll)
  const [custom, setCustom] = useState('')

  const groups = useMemo(() => {
    const known = new Set(variableDefs.map((v) => v.name))
    const extra: VariableDef[] = Object.keys(values)
      .filter((k) => !known.has(k))
      .map((k) => ({ name: k, label: k, group: 'Custom' }))
    const all = [...variableDefs, ...extra]
    const map = new Map<string, VariableDef[]>()
    for (const v of all) {
      const arr = map.get(v.group) ?? []
      arr.push(v)
      map.set(v.group, arr)
    }
    return [...map.entries()]
  }, [values])

  const setCount = Object.values(values).filter((v) => v).length

  return (
    <aside className="scroll-thin flex h-full w-72 shrink-0 flex-col overflow-y-auto border-l border-edge bg-bg-soft">
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-edge bg-bg-soft px-4 py-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-widest text-ink-dim">
            Context
          </div>
          <div className="text-[11px] text-ink-faint">
            {setCount} variable{setCount === 1 ? '' : 's'} set
          </div>
        </div>
        <button
          onClick={clearAll}
          className="rounded px-2 py-1 text-[11px] text-ink-faint hover:bg-white/5 hover:text-danger"
        >
          clear
        </button>
      </div>

      <div className="flex-1 px-3 py-3">
        {groups.map(([group, defs]) => (
          <div key={group} className="mb-4">
            <div className="mb-1 px-1 text-[10px] font-semibold uppercase tracking-widest text-ink-faint">
              {group}
            </div>
            <div className="space-y-1.5">
              {defs.map((def) => (
                <label key={def.name} className="block">
                  <div className="flex items-baseline justify-between">
                    <span className="font-mono text-[12px] text-accent">
                      ${def.name}
                    </span>
                    <span className="truncate pl-2 text-[10px] text-ink-faint">
                      {def.label}
                    </span>
                  </div>
                  <input
                    value={values[def.name] ?? ''}
                    onChange={(e) => setVar(def.name, e.target.value)}
                    placeholder={def.example ?? ''}
                    spellCheck={false}
                    autoComplete="off"
                    className="mt-0.5 w-full rounded border border-edge bg-bg px-2 py-1 font-mono text-[12px] text-ink outline-none placeholder:text-ink-faint/60 focus:border-accent"
                  />
                </label>
              ))}
            </div>
          </div>
        ))}

        <form
          onSubmit={(e) => {
            e.preventDefault()
            const name = custom.trim().replace(/^\$/, '')
            if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
              setVar(name, '')
              setCustom('')
            }
          }}
          className="mt-2"
        >
          <input
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            placeholder="+ add variable (e.g. share)"
            spellCheck={false}
            autoComplete="off"
            className="w-full rounded border border-dashed border-edge bg-transparent px-2 py-1 font-mono text-[12px] text-ink outline-none placeholder:text-ink-faint/60 focus:border-accent"
          />
        </form>
      </div>
    </aside>
  )
}
