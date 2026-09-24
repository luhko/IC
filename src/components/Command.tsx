import { useState, useCallback } from 'react'
import { useVars } from '../store/vars'
import { tokenize, substitute } from '../lib/substitute'

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    try {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      const ok = document.execCommand('copy')
      document.body.removeChild(ta)
      return ok
    } catch {
      return false
    }
  }
}

function CopyButton({ text, label = 'copy' }: { text: string; label?: string }) {
  const [done, setDone] = useState(false)
  const onClick = useCallback(async () => {
    const ok = await copyText(text)
    if (ok) {
      setDone(true)
      setTimeout(() => setDone(false), 1200)
    }
  }, [text])
  return (
    <button
      onClick={onClick}
      className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wide text-ink-faint hover:text-accent hover:bg-accent-soft transition-colors"
      title="Copy (variables substituted)"
    >
      {done ? '✓ copied' : label}
    </button>
  )
}

function Tokens({ cmd }: { cmd: string }) {
  const values = useVars((s) => s.values)
  const tokens = tokenize(cmd, values)
  return (
    <>
      {tokens.map((t, i) => {
        if (t.type === 'text') return <span key={i}>{t.value}</span>
        if (t.resolved !== undefined)
          return (
            <span
              key={i}
              className="text-accent bg-accent-soft rounded px-0.5"
              title={`$${t.value}`}
            >
              {t.resolved}
            </span>
          )
        return (
          <span
            key={i}
            className="text-warn bg-warn/10 rounded px-0.5 underline decoration-dotted"
            title={`$${t.value} is not set — fill it in the context panel`}
          >
            ${t.value}
          </span>
        )
      })}
    </>
  )
}

function CommandLine({ cmd }: { cmd: string }) {
  const values = useVars((s) => s.values)
  return (
    <div className="group/line flex items-start gap-2 px-3 py-0.5 hover:bg-white/5">
      <span className="select-none text-accent/70">$</span>
      <code className="flex-1 whitespace-pre-wrap break-words font-mono text-[13px] leading-relaxed">
        <Tokens cmd={cmd} />
      </code>
      <span className="opacity-0 group-hover/line:opacity-100 transition-opacity">
        <CopyButton text={substitute(cmd, values)} />
      </span>
    </div>
  )
}

export function CommandBlock({ code, lang }: { code: string; lang?: string }) {
  const values = useVars((s) => s.values)
  const lines = code.split('\n')
  const allResolved = substitute(code, values)
  return (
    <div className="my-4 overflow-hidden rounded-lg border border-edge bg-bg-softer">
      <div className="flex items-center justify-between border-b border-edge/70 bg-black/20 px-3 py-1">
        <span className="font-mono text-[10px] uppercase tracking-widest text-ink-faint">
          {lang || 'sh'}
        </span>
        <CopyButton text={allResolved} label="copy block" />
      </div>
      <div className="scroll-thin overflow-x-auto py-1.5">
        {lines.map((line, i) => {
          const trimmed = line.trim()
          if (trimmed === '')
            return <div key={i} className="h-2" aria-hidden />
          if (trimmed.startsWith('#'))
            return (
              <div
                key={i}
                className="px-3 py-0.5 font-mono text-[12px] italic text-ink-faint"
              >
                {line}
              </div>
            )
          return <CommandLine key={i} cmd={line} />
        })}
      </div>
    </div>
  )
}
