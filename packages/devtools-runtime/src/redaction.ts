const redacted = '[REDACTED]'

const visit = (value: unknown, path: string, sensitive: ReadonlySet<string>): unknown => {
  if (sensitive.has(path) || sensitive.has(path.split('.').at(-1) ?? '')) return redacted
  if (Array.isArray(value))
    return value.map((item, index) => visit(item, `${path}.${index}`, sensitive))
  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [
        key,
        visit(child, path === '' ? key : `${path}.${key}`, sensitive),
      ]),
    )
  }
  return value
}

export const redactValue = (value: unknown, sensitivePaths: ReadonlyArray<string>): unknown =>
  visit(value, '', new Set(sensitivePaths))
