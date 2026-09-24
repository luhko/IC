import { useParams, Link } from 'react-router-dom'
import { getDoc } from '../lib/content'
import { categoryLabel } from '../lib/nav'
import { Markdown } from '../components/Markdown'
import { AttackPathView } from '../components/AttackPathView'
import { StatusControl } from '../components/Status'
import { useChecklist } from '../store/checklist'
import type { Doc } from '../lib/types'

function sevClass(sev?: string): string {
  const s = (sev ?? '').toLowerCase()
  if (s.includes('crit')) return 'text-danger border-danger/50 bg-danger/10'
  if (s.includes('high')) return 'text-warn border-warn/50 bg-warn/10'
  return 'text-ink-dim border-edge'
}

function MetaList({ title, items }: { title: string; items?: string[] }) {
  if (!items || items.length === 0) return null
  return (
    <div>
      <h4>{title}</h4>
      <ul>
        {items.map((it, i) => (
          <li key={i}>{it}</li>
        ))}
      </ul>
    </div>
  )
}

function CveMeta({ doc }: { doc: Doc }) {
  if (doc.kind !== 'cve') return null
  return (
    <div className="mb-4 flex flex-wrap gap-2 text-[12px]">
      {doc.cve && (
        <a
          href={`https://nvd.nist.gov/vuln/detail/${doc.cve}`}
          target="_blank"
          rel="noreferrer noopener"
          className="rounded border border-edge px-2 py-1 font-mono text-accent hover:border-accent"
        >
          {doc.cve}
        </a>
      )}
      {doc.severity && (
        <span
          className={`rounded border px-2 py-1 font-semibold ${sevClass(
            doc.severity,
          )}`}
        >
          {doc.severity}
        </span>
      )}
      {doc.patched && (
        <span className="rounded border border-edge px-2 py-1 text-ink-dim">
          Patched: {doc.patched}
        </span>
      )}
    </div>
  )
}

export function DocPage() {
  const params = useParams()
  const slug = params['*'] ?? ''
  const doc = getDoc(slug)

  if (!doc) {
    return (
      <div className="scroll-thin h-full overflow-y-auto">
        <div className="mx-auto max-w-3xl px-8 py-16 text-center">
          <p className="text-ink-dim">Not found: {slug}</p>
          <Link to="/" className="text-accent underline">
            back home
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="scroll-thin h-full overflow-y-auto">
      <article className="mx-auto max-w-3xl px-8 py-8">
        <div className="mb-1 text-[11px] font-semibold uppercase tracking-widest text-accent">
          {categoryLabel(doc.category)}
        </div>
        <h1 className="text-2xl font-semibold text-ink">{doc.title}</h1>
        {doc.aka && (
          <p className="mt-1 text-sm text-ink-dim">aka {doc.aka}</p>
        )}
        {doc.summary && (
          <p className="mt-3 text-[15px] text-ink-dim">{doc.summary}</p>
        )}

        <div className="mt-4">
          <CveMeta doc={doc} />
        </div>

        <div className="mb-6 rounded-lg border border-edge bg-bg-soft px-4 py-3">
          <StatusControl slug={doc.slug} />
        </div>

        {(doc.prerequisites || doc.tools || doc.affected) && (
          <div className="prose-ic mb-6 grid gap-4 rounded-lg border border-edge bg-bg-soft p-4 sm:grid-cols-2">
            <MetaList title="Prerequisites" items={doc.prerequisites} />
            <MetaList title="Tools" items={doc.tools} />
            <MetaList title="Affected" items={doc.affected} />
          </div>
        )}

        {doc.tags.length > 0 && (
          <div className="mb-6 flex flex-wrap gap-1">
            {doc.tags.map((t) => (
              <span
                key={t}
                className="rounded bg-bg-softer px-2 py-0.5 font-mono text-[11px] text-ink-faint"
              >
                #{t}
              </span>
            ))}
          </div>
        )}

        {doc.kind === 'attack-path' ? (
          <AttackPathView doc={doc} />
        ) : (
          <Markdown>{doc.body}</Markdown>
        )}

        {(doc.detection || doc.mitigation) && (
          <div className="prose-ic mt-8 grid gap-4 rounded-lg border border-edge bg-bg-soft p-4 sm:grid-cols-2">
            <MetaList title="Detection" items={doc.detection} />
            <MetaList title="Mitigation" items={doc.mitigation} />
          </div>
        )}

        {doc.refs && doc.refs.length > 0 && (
          <div className="prose-ic mt-8">
            <h4>References</h4>
            <ul>
              {doc.refs.map((r, i) => (
                <li key={i}>
                  <a href={r.url} target="_blank" rel="noreferrer noopener">
                    {r.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}

        <NoteBox slug={doc.slug} />
      </article>
    </div>
  )
}

function NoteBox({ slug }: { slug: string }) {
  const note = useChecklist((s) => s.items[slug]?.note ?? '')
  const setNote = useChecklist((s) => s.setNote)
  return (
    <div className="mt-8">
      <h4 className="mb-2 text-base font-semibold uppercase tracking-wide text-ink-dim">
        Notes
      </h4>
      <textarea
        value={note}
        onChange={(e) => setNote(slug, e.target.value)}
        placeholder="Your engagement notes for this technique (saved locally in your browser)…"
        rows={4}
        spellCheck={false}
        className="scroll-thin w-full resize-y rounded-lg border border-edge bg-bg-soft px-3 py-2 text-sm text-ink outline-none placeholder:text-ink-faint/70 focus:border-accent"
      />
    </div>
  )
}
