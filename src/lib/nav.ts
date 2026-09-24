import type { Doc } from './types'

export function docHref(d: Doc): string {
  return `/n/${d.slug}`
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
