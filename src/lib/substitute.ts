export interface SubToken {
  type: 'text' | 'var'
  /** for text: the literal; for var: the variable name (without $) */
  value: string
  /** for var only: the resolved value, or undefined when unset */
  resolved?: string
}

// $name or ${name}. Excludes $( , $1 , $$ … so shell constructs survive.
const VAR_RE = /\$\{([a-zA-Z_][a-zA-Z0-9_]*)\}|\$([a-zA-Z_][a-zA-Z0-9_]*)/g

export function tokenize(
  cmd: string,
  values: Record<string, string>,
): SubToken[] {
  const tokens: SubToken[] = []
  let last = 0
  for (const m of cmd.matchAll(VAR_RE)) {
    const idx = m.index ?? 0
    if (idx > last) tokens.push({ type: 'text', value: cmd.slice(last, idx) })
    const name = m[1] ?? m[2]
    const v = values[name]
    tokens.push({
      type: 'var',
      value: name,
      resolved: v ? v : undefined,
    })
    last = idx + m[0].length
  }
  if (last < cmd.length) tokens.push({ type: 'text', value: cmd.slice(last) })
  return tokens
}

/** Render a command with variables filled in; unset vars keep their $name form. */
export function substitute(
  cmd: string,
  values: Record<string, string>,
): string {
  return tokenize(cmd, values)
    .map((t) => (t.type === 'text' ? t.value : t.resolved ?? `$${t.value}`))
    .join('')
}

/** Distinct variable names referenced by a command. */
export function usedVars(cmd: string): string[] {
  const out: string[] = []
  for (const m of cmd.matchAll(VAR_RE)) {
    const name = m[1] ?? m[2]
    if (!out.includes(name)) out.push(name)
  }
  return out
}
