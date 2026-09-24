import type { Doc } from './types'

export function docHref(d: Doc): string {
  return `/n/${d.slug}`
}

/** Drop the redundant "AD / " prefix for display — this is an AD cheat sheet. */
export function categoryLabel(category: string): string {
  return category.replace(/^AD \/ /, '')
}

export function kindLabel(kind: Doc['kind']): string {
  switch (kind) {
    case 'cve':
      return 'CVE'
    case 'attack-path':
      return 'PATH'
    case 'mindmap':
      return 'MAP'
    default:
      return 'DOC'
  }
}
