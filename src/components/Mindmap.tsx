import { useEffect, useRef } from 'react'
import { Transformer } from 'markmap-lib'
import { Markmap } from 'markmap-view'

const transformer = new Transformer()

export function Mindmap({ markdown }: { markdown: string }) {
  const svgRef = useRef<SVGSVGElement>(null)
  const mmRef = useRef<Markmap | null>(null)

  useEffect(() => {
    if (!svgRef.current) return
    if (!mmRef.current) {
      mmRef.current = Markmap.create(svgRef.current, {
        duration: 200,
        spacingVertical: 6,
        spacingHorizontal: 90,
        paddingX: 16,
        initialExpandLevel: 2,
      })
    }
    const { root } = transformer.transform(markdown)
    mmRef.current.setData(root)
    mmRef.current.fit()
  }, [markdown])

  return (
    <div className="markmap-root h-full w-full">
      <svg ref={svgRef} className="h-full w-full" />
    </div>
  )
}
