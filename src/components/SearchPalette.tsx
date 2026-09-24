import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { search } from '../lib/search'
import { docHref, kindLabel } from '../lib/nav'
import { useUI } from '../store/ui'

export function SearchPalette() {
  const open = useUI((s) => s.paletteOpen)
  const close = useUI((s) => s.closePalette)
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [sel, setSel] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const results = useMemo(() => search(q), [q])

  useEffect(() => {
    if (open) {
      setQ('')
      setSel(0)
      setTimeout(() => inputRef.current?.focus(), 0)
    }
  }, [open])

  useEffect(() => {
    setSel(0)
  }, [q])

  if (!open) return null

  const go = (i: number) => {
    const item = results[i]
    if (!item) return
    navigate(docHref(item))
    close()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 pt-[12vh]"
      onClick={close}
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-xl border border-edge bg-bg-soft shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              setSel((s) => Math.min(s + 1, results.length - 1))
            } else if (e.key === 'ArrowUp') {
              e.preventDefault()
              setSel((s) => Math.max(s - 1, 0))
            } else if (e.key === 'Enter') {
              e.preventDefault()
              go(sel)
            } else if (e.key === 'Escape') {
              close()
            }
          }}
          placeholder="Search techniques, CVEs, commands…"
          spellCheck={false}
          autoComplete="off"
          className="w-full border-b border-edge bg-transparent px-4 py-3 text-sm text-ink outline-none placeholder:text-ink-faint"
        />
        <ul className="scroll-thin max-h-[50vh] overflow-y-auto py-1">
          {results.length === 0 && q && (
            <li className="px-4 py-6 text-center text-sm text-ink-faint">
              No results for “{q}”
            </li>
          )}
          {results.map((r, i) => (
            <li key={r.slug}>
              <button
                onMouseEnter={() => setSel(i)}
                onClick={() => go(i)}
                className={`flex w-full items-center justify-between px-4 py-2 text-left ${
                  i === sel ? 'bg-accent-soft' : ''
                }`}
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm text-ink">
                    {r.title}
                  </span>
                  <span className="block truncate text-[11px] text-ink-faint">
                    {r.category}
                    {r.aka ? ` · ${r.aka}` : ''}
                  </span>
                </span>
                <span className="ml-3 shrink-0 rounded border border-edge px-1.5 py-0.5 text-[9px] font-semibold text-ink-faint">
                  {kindLabel(r.kind)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
