export type DocKind = 'doc' | 'cve' | 'attack-path' | 'mindmap'

export interface Reference {
  label: string
  url: string
}

export interface Doc {
  id: string
  slug: string
  title: string
  category: string
  tags: string[]
  kind: DocKind
  order: number
  /** technique/CVE metadata (from frontmatter) */
  summary?: string
  prerequisites?: string[]
  tools?: string[]
  detection?: string[]
  mitigation?: string[]
  refs?: Reference[]
  /** CVE-specific */
  cve?: string
  aka?: string
  severity?: string
  affected?: string[]
  patched?: string
  /** markdown body (doc / cve) */
  body: string
  /** attack-path steps */
  steps?: AttackStep[]
  /** precomputed, lowercased search haystack */
  text: string
}

export interface AttackStep {
  title: string
  detail?: string
  commands?: string[]
  needs?: string[]
  gains?: string[]
}

export interface VariableDef {
  name: string
  label: string
  example?: string
  group: string
}

export interface CategoryGroup {
  name: string
  docs: Doc[]
}
