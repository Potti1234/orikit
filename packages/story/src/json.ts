import type { JsonValue } from '@orikit/spike-trace'

export const toJsonValue = (input: unknown, path = '$'): JsonValue => {
  if (input === null || typeof input === 'boolean' || typeof input === 'string') {
    return input
  }
  if (typeof input === 'number') {
    if (!Number.isFinite(input)) {
      throw new TypeError(`${path} contains a non-finite number`)
    }
    return input
  }
  if (Array.isArray(input)) {
    return input.map((value, index) => toJsonValue(value, `${path}[${index}]`))
  }
  if (typeof input === 'object') {
    const output: Record<string, JsonValue> = {}
    for (const [key, value] of Object.entries(input)) {
      if (value === undefined) {
        throw new TypeError(`${path}.${key} contains undefined`)
      }
      output[key] = toJsonValue(value, `${path}.${key}`)
    }
    return output
  }
  throw new TypeError(`${path} contains non-serializable ${typeof input}`)
}
