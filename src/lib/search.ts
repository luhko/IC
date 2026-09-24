import Fuse from 'fuse.js'
import { searchable } from './content'
import type { Doc } from './types'

const fuse = new Fuse(searchable, {
  includeScore: true,
  ignoreLocation: true,
  threshold: 0.38,
  minMatchCharLength: 2,
  keys: [
    { name: 'title', weight: 3 },
    { name: 'cve', weight: 3 },
    { name: 'aka', weight: 2.5 },
    { name: 'tags', weight: 2 },
    { name: 'category', weight: 1.2 },
    { name: 'summary', weight: 1.2 },
    { name: 'text', weight: 0.6 },
  ],
})

export function search(q: string, limit = 25): Doc[] {
  const query = q.trim()
  if (!query) return []
  return fuse.search(query, { limit }).map((r) => r.item)
}
