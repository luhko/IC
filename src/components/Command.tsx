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

// Split an unquoted shell comment (inline or full-line) off a command line.
// The command part is what we copy; the comment stays visible but dimmed.
function splitComment(line: string): { code: string; comment: string } {
  let inS = false
  let inD = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === "'" && !inD) inS = !inS
    else if (c === '"' && !inS) inD = !inD
    else if (c === '#' && !inS && !inD && (i === 0 || /\s/.test(line[i - 1])))
      return {
        code: line.slice(0, i).replace(/\s+$/, ''),
        comment: line.slice(i),
      }
  }
  return { code: line, comment: '' }
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

// A single logical command — may span several physical lines via `\`
// continuations. Rendered with one prompt and one copy button.
function CommandLine({ lines }: { lines: string[] }) {
  const values = useVars((s) => s.values)
  return (
    <div className="group/line flex items-start gap-2 px-3 py-0.5 hover:bg-white/5">
      <span className="select-none pt-px text-accent/70">$</span>
      <code className="flex-1 whitespace-pre-wrap break-words font-mono text-[13px] leading-relaxed">
        {lines.map((l, i) => (
          <span key={i} className="block">
            <Tokens cmd={l} />
          </span>
        ))}
      </code>
      <span className="opacity-0 group-hover/line:opacity-100 transition-opacity">
        <CopyButton text={substitute(lines.join('\n'), values)} />
      </span>
    </div>
  )
}

export function CommandBlock({ code, lang }: { code: string; lang?: string }) {
  const values = useVars((s) => s.values)
  const lines = code.split('\n')

  // Build the render list: comments go to a note below; consecutive physical
  // lines joined by a trailing `\` become one logical command.
  const notes: string[] = []
  const render: ({ kind: 'spacer' } | { kind: 'cmd'; lines: string[] })[] = []
  let pending: string[] = []
  const flush = () => {
    if (pending.length) {
      render.push({ kind: 'cmd', lines: pending })
      pending = []
    }
  }
  for (const raw of lines) {
    const { code: c, comment } = splitComment(raw)
    if (comment) notes.push(comment.replace(/^\s*#+\s?/, ''))
    if (raw.trim() === '') {
      flush()
      render.push({ kind: 'spacer' })
      continue
    }
    if (c.trim() === '') continue // pure comment line — already captured
    pending.push(c)
    if (!/\\\s*$/.test(c)) flush()
  }
  flush()

  const cleanBlock = render
    .flatMap((r) => (r.kind === 'cmd' ? [substitute(r.lines.join('\n'), values)] : []))
    .join('\n')

  return (
    <div className="my-4">
      <div className="overflow-hidden rounded-lg border border-edge bg-bg-softer">
        <div className="flex items-center justify-between border-b border-edge/70 bg-black/20 px-3 py-1">
          <span className="font-mono text-[10px] uppercase tracking-widest text-ink-faint">
            {lang || 'sh'}
          </span>
          <CopyButton text={cleanBlock} label="copy block" />
        </div>
        <div className="scroll-thin overflow-x-auto py-1.5">
          {render.map((r, i) =>
            r.kind === 'spacer' ? (
              <div key={i} className="h-2" aria-hidden />
            ) : (
              <CommandLine key={i} lines={r.lines} />
            ),
          )}
        </div>
      </div>
      {notes.length > 0 && (
        <div className="mt-1.5 border-l-2 border-edge pl-3 text-[12px] italic leading-relaxed text-ink-faint">
          {notes.map((n, i) => (
            <div key={i}>{n}</div>
          ))}
        </div>
      )}
    </div>
  )
}
