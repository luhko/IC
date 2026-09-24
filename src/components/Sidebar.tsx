import { NavLink } from 'react-router-dom'
import { navGroups, attackPaths, mindmaps, stats } from '../lib/content'
import { docHref, kindLabel } from '../lib/nav'
import { useUI } from '../store/ui'
import { StatusDot } from './Status'
import type { Doc } from '../lib/types'

function itemClass(active: boolean): string {
  return [
    'block truncate rounded px-2 py-1 text-[13px] transition-colors',
    active
      ? 'bg-accent-soft text-accent'
      : 'text-ink-dim hover:bg-white/5 hover:text-ink',
  ].join(' ')
}

function KindTag({ kind }: { kind: Doc['kind'] }) {
  if (kind === 'doc') return null
  const color =
    kind === 'cve'
      ? 'text-danger border-danger/40'
      : 'text-warn border-warn/40'
  return (
    <span
      className={`ml-1 rounded border px-1 text-[9px] font-semibold ${color}`}
    >
      {kindLabel(kind)}
    </span>
  )
}

function DocLink({ doc }: { doc: Doc }) {
  return (
    <NavLink
      to={docHref(doc)}
      className={({ isActive }) =>
        [
          'flex items-center gap-1.5 rounded px-2 py-1 text-[13px] transition-colors',
          isActive
            ? 'bg-accent-soft text-accent'
            : 'text-ink-dim hover:bg-white/5 hover:text-ink',
        ].join(' ')
      }
    >
      <StatusDot slug={doc.slug} />
      <span className="min-w-0 flex-1 truncate">{doc.title}</span>
      <KindTag kind={doc.kind} />
    </NavLink>
  )
}

export function Sidebar() {
  const openPalette = useUI((s) => s.openPalette)

  return (
    <nav className="scroll-thin flex h-full w-64 shrink-0 flex-col overflow-y-auto border-r border-edge bg-bg-soft">
      <div className="sticky top-0 z-10 bg-bg-soft px-4 pb-2 pt-4">
        <NavLink to="/" className="flex items-baseline gap-2">
          <span className="font-mono text-lg font-bold text-accent">IC</span>
          <span className="text-[11px] uppercase tracking-widest text-ink-faint">
            Internal Cheatsheet
          </span>
        </NavLink>
        <button
          onClick={openPalette}
          className="mt-3 flex w-full items-center justify-between rounded border border-edge bg-bg px-2 py-1.5 text-[12px] text-ink-faint hover:border-accent/50"
        >
          <span>Search…</span>
          <kbd className="rounded bg-bg-softer px-1 font-mono text-[10px]">
            Ctrl K
          </kbd>
        </button>
      </div>

      <div className="px-2 py-1">
        <NavLink to="/" end className={({ isActive }) => itemClass(isActive)}>
          Home
        </NavLink>
        <NavLink
          to="/checklist"
          className={({ isActive }) => itemClass(isActive)}
        >
          Checklist
        </NavLink>
        {mindmaps.length > 0 && (
          <NavLink
            to="/mindmap"
            className={({ isActive }) => itemClass(isActive)}
          >
            Mindmap
          </NavLink>
        )}
      </div>

      {navGroups.map((group) => (
        <div key={group.name} className="px-2 py-1">
          <div className="px-2 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-widest text-ink-faint">
            {group.name}
          </div>
          {group.docs.map((doc) => (
            <DocLink key={doc.slug} doc={doc} />
          ))}
        </div>
      ))}

      {attackPaths.length > 0 && (
        <div className="px-2 py-1">
          <div className="px-2 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-widest text-ink-faint">
            AD / Attack paths
          </div>
          {attackPaths.map((doc) => (
            <DocLink key={doc.slug} doc={doc} />
          ))}
        </div>
      )}

      <div className="mt-auto border-t border-edge px-4 py-3 text-[10px] text-ink-faint">
        {stats.techniques} techniques · {stats.cves} CVE · {stats.paths} paths
      </div>
    </nav>
  )
}
