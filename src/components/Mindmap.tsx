import { useEffect, useRef, useCallback } from 'react'
import { Transformer } from 'markmap-lib'
import { Markmap, deriveOptions } from 'markmap-view'

const transformer = new Transformer()

// Palette that reads well on the dark theme; one hue per top-level branch.
const PALETTE = [
  '#4dd0a7',
  '#58a6ff',
  '#e3b341',
  '#bc8cff',
  '#ff7b72',
  '#7ee787',
  '#f778ba',
  '#ffa657',
  '#56d4dd',
  '#d2a8ff',
  '#79c0ff',
]

// deriveOptions turns the JSON-style options (color array, colorFreezeLevel,
// initialExpandLevel, maxWidth) into a runtime options object with a proper
// per-branch colour function.
const derived = deriveOptions({
  color: PALETTE,
  colorFreezeLevel: 2,
  initialExpandLevel: 3,
  maxWidth: 340,
})

export function Mindmap({ markdown }: { markdown: string }) {
  const svgRef = useRef<SVGSVGElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const mmRef = useRef<Markmap | null>(null)

  useEffect(() => {
    if (!svgRef.current) return
    if (!mmRef.current) {
      mmRef.current = Markmap.create(svgRef.current, {
        ...derived,
        duration: 300,
        spacingVertical: 10,
        spacingHorizontal: 120,
        paddingX: 24,
        nodeMinHeight: 18,
        fitRatio: 0.9,
        lineWidth: (node) => Math.max(5 - (node.state?.depth ?? 0), 1.5),
      })
    }
    const { root } = transformer.transform(markdown)
    mmRef.current.setData(root)
    const id = requestAnimationFrame(() =>
      requestAnimationFrame(() => mmRef.current?.fit()),
    )
    return () => cancelAnimationFrame(id)
  }, [markdown])

  useEffect(() => {
    if (!wrapRef.current) return
    const ro = new ResizeObserver(() => mmRef.current?.fit())
    ro.observe(wrapRef.current)
    return () => ro.disconnect()
  }, [])

  const fit = useCallback(() => mmRef.current?.fit(), [])
  const zoom = useCallback((f: number) => mmRef.current?.rescale(f), [])

  return (
    <div ref={wrapRef} className="markmap-root relative h-full w-full">
      <svg ref={svgRef} className="h-full w-full" />
      <div className="absolute right-3 top-3 flex items-center gap-1">
        <MapBtn label="+" onClick={() => zoom(1.25)} title="Zoom in" />
        <MapBtn label="−" onClick={() => zoom(0.8)} title="Zoom out" />
        <MapBtn label="Fit" onClick={fit} title="Fit to screen" />
      </div>
    </div>
  )
}

function MapBtn({
  label,
  onClick,
  title,
}: {
  label: string
  onClick: () => void
  title: string
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="min-w-7 rounded border border-edge bg-bg-soft/90 px-2 py-1 text-xs font-medium text-ink-dim backdrop-blur hover:border-accent/60 hover:text-accent"
    >
      {label}
    </button>
  )
}
