import { Link } from 'react-router-dom'
import { navGroups, stats } from '../lib/content'
import { docHref, categoryLabel } from '../lib/nav'
import { useUI } from '../store/ui'

export function HomePage() {
  const openPalette = useUI((s) => s.openPalette)
  return (
    <div className="scroll-thin h-full overflow-y-auto">
      <div className="mx-auto max-w-3xl px-8 py-10">
        <div className="flex items-baseline gap-3">
          <h1 className="font-mono text-3xl font-bold text-accent">IC</h1>
          <span className="text-sm uppercase tracking-widest text-ink-faint">
            Internal Cheatsheet
          </span>
        </div>
        <p className="mt-3 max-w-2xl text-[15px] text-ink-dim">
          A local AD assessment reference. Set your target once in the{' '}
          <span className="text-ink">Context</span> panel on the right — every
          command fills in <code className="text-accent">$ip</code>,{' '}
          <code className="text-accent">$user</code>,{' '}
          <code className="text-accent">$domain</code> … and copies ready to
          paste.
        </p>

        <div className="mt-4 flex flex-wrap gap-3 text-[13px]">
          <button
            onClick={openPalette}
            className="rounded border border-edge px-3 py-1.5 hover:border-accent/60"
          >
            Search <kbd className="ml-1 font-mono text-[11px]">Ctrl K</kbd>
          </button>
          <Link
            to="/mindmap"
            className="rounded border border-edge px-3 py-1.5 hover:border-accent/60"
          >
            Open mindmap
          </Link>
        </div>

        <div className="mt-6 flex gap-6 text-sm text-ink-dim">
          <span>
            <span className="font-mono text-lg text-ink">{stats.techniques}</span>{' '}
            techniques
          </span>
          <span>
            <span className="font-mono text-lg text-danger">{stats.cves}</span>{' '}
            CVE
          </span>
          <span>
            <span className="font-mono text-lg text-warn">{stats.paths}</span>{' '}
            attack paths
          </span>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {navGroups.map((g) => (
            <div
              key={g.name}
              className="rounded-lg border border-edge bg-bg-soft p-4"
            >
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-accent">
                {categoryLabel(g.name)}
              </div>
              <ul className="space-y-1">
                {g.docs.slice(0, 6).map((d) => (
                  <li key={d.slug}>
                    <Link
                      to={docHref(d)}
                      className="text-[13px] text-ink-dim hover:text-ink"
                    >
                      {d.title}
                    </Link>
                  </li>
                ))}
                {g.docs.length > 6 && (
                  <li className="text-[11px] text-ink-faint">
                    +{g.docs.length - 6} more
                  </li>
                )}
              </ul>
            </div>
          ))}
        </div>

        <p className="mt-10 border-t border-edge pt-4 text-[11px] text-ink-faint">
          For authorized engagements only. You own scope and legality.
        </p>
      </div>
    </div>
  )
}
