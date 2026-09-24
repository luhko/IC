import yaml from 'js-yaml'
import type { Doc, VariableDef, CategoryGroup, AttackStep } from './types'

/* ------------------------------------------------------------------ */
/* Raw content, loaded at build time from ../../content                */
/* ------------------------------------------------------------------ */

const mdRaw = import.meta.glob('../../content/**/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

const yamlRaw = import.meta.glob('../../content/**/*.{yaml,yml}', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function rel(key: string): string {
  const i = key.indexOf('/content/')
  return i >= 0 ? key.slice(i + '/content/'.length) : key
}

function stripExt(p: string): string {
  return p.replace(/\.(md|ya?ml)$/i, '')
}

function parseFrontmatter(raw: string): {
  data: Record<string, unknown>
  body: string
} {
  const norm = raw.replace(/\r\n/g, '\n')
  if (!norm.startsWith('---\n')) return { data: {}, body: norm }
  const end = norm.indexOf('\n---', 3)
  if (end === -1) return { data: {}, body: norm }
  const fm = norm.slice(4, end)
  const body = norm.slice(end + 4).replace(/^\n+/, '')
  let data: Record<string, unknown> = {}
  try {
    data = (yaml.load(fm) as Record<string, unknown>) ?? {}
  } catch (e) {
    console.error('[content] frontmatter parse error in', raw.slice(0, 60), e)
  }
  return { data, body }
}

function firstH1(body: string): string | undefined {
  return body.match(/^#\s+(.+)$/m)?.[1]?.trim()
}

function asStrArr(v: unknown): string[] | undefined {
  if (Array.isArray(v)) return v.map(String)
  if (typeof v === 'string') return [v]
  return undefined
}

function prettyFromSlug(slug: string): string {
  const last = slug.split('/').pop() ?? slug
  return last.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

const CATEGORY_ORDER = [
  'AD / Recon',
  'AD / Credentials',
  'AD / Relay & Coercion',
  'AD / ADCS',
  'AD / Delegation',
  'AD / ACL abuse',
  'AD / Lateral Movement',
  'AD / Domain Privesc',
  'AD / Persistence',
  'AD / CVE',
]
function catWeight(c: string): number {
  const i = CATEGORY_ORDER.indexOf(c)
  return i === -1 ? 500 : i
}

/* ------------------------------------------------------------------ */
/* Build documents                                                     */
/* ------------------------------------------------------------------ */

const docs: Doc[] = []
const attackPaths: Doc[] = []
export const mindmaps: { id: string; title: string; body: string }[] = []
export let variableDefs: VariableDef[] = []

function haystack(d: Partial<Doc>): string {
  return [
    d.title,
    d.category,
    d.aka,
    d.cve,
    d.summary,
    (d.tags ?? []).join(' '),
    (d.prerequisites ?? []).join(' '),
    (d.tools ?? []).join(' '),
    d.body,
    (d.steps ?? [])
      .map((s) => `${s.title} ${s.detail ?? ''} ${(s.commands ?? []).join(' ')}`)
      .join(' '),
  ]
    .filter(Boolean)
    .join(' \n ')
    .toLowerCase()
}

// Markdown files -> docs / cve / mindmap
for (const [key, raw] of Object.entries(mdRaw)) {
  const slug = stripExt(rel(key))
  const { data, body } = parseFrontmatter(raw)

  if (slug.includes('/mindmap/') || slug.startsWith('mindmap/')) {
    mindmaps.push({
      id: slug,
      title: (data.title as string) || firstH1(body) || prettyFromSlug(slug),
      body,
    })
    continue
  }

  const isCve = slug.includes('/cve/') || Boolean(data.cve)
  const category =
    (data.category as string) || (isCve ? 'AD / CVE' : 'AD / Misc')

  const doc: Doc = {
    id: slug,
    slug,
    title: (data.title as string) || firstH1(body) || prettyFromSlug(slug),
    category,
    tags: asStrArr(data.tags) ?? [],
    kind: isCve ? 'cve' : 'doc',
    order: typeof data.order === 'number' ? data.order : 100,
    summary: data.summary as string | undefined,
    prerequisites: asStrArr(data.prerequisites),
    tools: asStrArr(data.tools),
    detection: asStrArr(data.detection),
    mitigation: asStrArr(data.mitigation),
    refs: Array.isArray(data.refs)
      ? (data.refs as { label: string; url: string }[])
      : undefined,
    cve: data.cve as string | undefined,
    aka: data.aka as string | undefined,
    severity: data.severity as string | undefined,
    affected: asStrArr(data.affected),
    patched: data.patched as string | undefined,
    body,
    text: '',
  }
  doc.text = haystack(doc)
  docs.push(doc)
}

// YAML files -> variables / attack paths
for (const [key, raw] of Object.entries(yamlRaw)) {
  const slug = stripExt(rel(key))
  let data: Record<string, unknown> = {}
  try {
    data = (yaml.load(raw) as Record<string, unknown>) ?? {}
  } catch (e) {
    console.error('[content] yaml parse error in', slug, e)
    continue
  }

  if (slug === 'variables') {
    const list = (data.variables as unknown[]) ?? []
    variableDefs = list.map((v) => {
      const o = v as Record<string, unknown>
      return {
        name: String(o.name),
        label: (o.label as string) || String(o.name),
        example: o.example as string | undefined,
        group: (o.group as string) || 'General',
      }
    })
    continue
  }

  if (slug.startsWith('attack-paths/')) {
    const steps = ((data.steps as unknown[]) ?? []).map((s) => {
      const o = s as Record<string, unknown>
      return {
        title: String(o.title),
        detail: o.detail as string | undefined,
        commands: asStrArr(o.commands),
        needs: asStrArr(o.needs),
        gains: asStrArr(o.gains),
      } as AttackStep
    })
    const doc: Doc = {
      id: slug,
      slug,
      title: (data.title as string) || prettyFromSlug(slug),
      category: (data.category as string) || 'AD / Attack paths',
      tags: asStrArr(data.tags) ?? [],
      kind: 'attack-path',
      order: typeof data.order === 'number' ? data.order : 100,
      summary: data.summary as string | undefined,
      body: '',
      steps,
      text: '',
    }
    doc.text = haystack(doc)
    attackPaths.push(doc)
  }
}

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

docs.sort((a, b) => a.order - b.order || a.title.localeCompare(b.title))
attackPaths.sort((a, b) => a.order - b.order || a.title.localeCompare(b.title))
mindmaps.sort((a, b) => a.title.localeCompare(b.title))

export { docs, attackPaths }

export const searchable: Doc[] = [...docs, ...attackPaths]

const bySlug = new Map<string, Doc>()
for (const d of searchable) bySlug.set(d.slug, d)
export function getDoc(slug: string): Doc | undefined {
  return bySlug.get(slug)
}

export const navGroups: CategoryGroup[] = (() => {
  const map = new Map<string, Doc[]>()
  for (const d of docs) {
    const arr = map.get(d.category) ?? []
    arr.push(d)
    map.set(d.category, arr)
  }
  return [...map.entries()]
    .map(([name, ds]) => ({ name, docs: ds }))
    .sort((a, b) => catWeight(a.name) - catWeight(b.name) || a.name.localeCompare(b.name))
})()

export const stats = {
  techniques: docs.filter((d) => d.kind === 'doc').length,
  cves: docs.filter((d) => d.kind === 'cve').length,
  paths: attackPaths.length,
  mindmaps: mindmaps.length,
}
