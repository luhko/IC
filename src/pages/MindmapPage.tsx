import { useState } from 'react'
import { mindmaps } from '../lib/content'
import { Mindmap } from '../components/Mindmap'

export function MindmapPage() {
  const [idx, setIdx] = useState(0)
  const mm = mindmaps[idx]

  if (!mm) {
    return (
      <div className="flex h-full items-center justify-center text-ink-faint">
        No mindmap yet — add one under <code className="mx-1">content/**/mindmap/</code>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-edge px-6 py-3">
        <h1 className="text-sm font-semibold uppercase tracking-widest text-ink-dim">
          Mindmap
        </h1>
        {mindmaps.length > 1 && (
          <select
            value={idx}
            onChange={(e) => setIdx(Number(e.target.value))}
            className="rounded border border-edge bg-bg px-2 py-1 text-sm text-ink outline-none"
          >
            {mindmaps.map((m, i) => (
              <option key={m.id} value={i}>
                {m.title}
              </option>
            ))}
          </select>
        )}
        <span className="text-[11px] text-ink-faint">
          scroll to zoom · drag to pan · click a node to fold
        </span>
      </div>
      <div className="min-h-0 flex-1">
        <Mindmap markdown={mm.body} />
      </div>
    </div>
  )
}
