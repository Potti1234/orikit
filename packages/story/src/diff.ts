import { canonicalJson, type JsonValue } from '@orikit/spike-trace'

export type DiffKind = 'Added' | 'Removed' | 'Changed'

export type ValueDiff = Readonly<{
  path: string
  kind: DiffKind
  expected?: JsonValue
  actual?: JsonValue
}>

const childPath = (path: string, key: string): string =>
  /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key) ? `${path}.${key}` : `${path}[${JSON.stringify(key)}]`

const isObject = (value: JsonValue): value is Readonly<Record<string, JsonValue>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

export const diffValues = (
  expected: JsonValue,
  actual: JsonValue,
  path = '$',
): ReadonlyArray<ValueDiff> => {
  if (canonicalJson(expected) === canonicalJson(actual)) {
    return []
  }
  if (Array.isArray(expected) && Array.isArray(actual)) {
    const diffs: Array<ValueDiff> = []
    const length = Math.max(expected.length, actual.length)
    for (let index = 0; index < length; index += 1) {
      if (index >= expected.length) {
        diffs.push({
          path: `${path}[${index}]`,
          kind: 'Added',
          actual: actual[index] as JsonValue,
        })
      } else if (index >= actual.length) {
        diffs.push({
          path: `${path}[${index}]`,
          kind: 'Removed',
          expected: expected[index] as JsonValue,
        })
      } else {
        diffs.push(
          ...diffValues(
            expected[index] as JsonValue,
            actual[index] as JsonValue,
            `${path}[${index}]`,
          ),
        )
      }
    }
    return diffs
  }
  if (isObject(expected) && isObject(actual)) {
    const diffs: Array<ValueDiff> = []
    const keys = [...new Set([...Object.keys(expected), ...Object.keys(actual)])].sort()
    for (const key of keys) {
      if (!(key in expected)) {
        diffs.push({
          path: childPath(path, key),
          kind: 'Added',
          actual: actual[key] as JsonValue,
        })
      } else if (!(key in actual)) {
        diffs.push({
          path: childPath(path, key),
          kind: 'Removed',
          expected: expected[key] as JsonValue,
        })
      } else {
        diffs.push(
          ...diffValues(expected[key] as JsonValue, actual[key] as JsonValue, childPath(path, key)),
        )
      }
    }
    return diffs
  }
  return [{ path, kind: 'Changed', expected, actual }]
}

export const diffPartial = (
  expected: JsonValue,
  actual: JsonValue,
  path = '$',
): ReadonlyArray<ValueDiff> => {
  if (isObject(expected) && isObject(actual)) {
    const diffs: Array<ValueDiff> = []
    for (const key of Object.keys(expected).sort()) {
      if (!(key in actual)) {
        diffs.push({
          path: childPath(path, key),
          kind: 'Removed',
          expected: expected[key] as JsonValue,
        })
      } else {
        diffs.push(
          ...diffPartial(
            expected[key] as JsonValue,
            actual[key] as JsonValue,
            childPath(path, key),
          ),
        )
      }
    }
    return diffs
  }
  return diffValues(expected, actual, path)
}

const print = (value: JsonValue | undefined): string =>
  value === undefined ? '(missing)' : canonicalJson(value)

export const formatDiff = (diffs: ReadonlyArray<ValueDiff>): string =>
  diffs
    .map(
      (diff) =>
        `${diff.path} ${diff.kind.toLowerCase()}: expected ${print(diff.expected)}, actual ${print(
          diff.actual,
        )}`,
    )
    .join('\n')
