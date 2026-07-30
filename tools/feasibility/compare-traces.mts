import { readFile } from 'node:fs/promises'

const artifacts = new URL('../../artifacts/feasibility/', import.meta.url)
const targets = ['node', 'web', 'android'] as const
const traces = await Promise.all(
  targets.map((target) => readFile(new URL(`trace-${target}.json`, artifacts), 'utf8')),
)

const expected = traces[0]
const mismatches = targets.filter((_, index) => traces[index] !== expected)
if (mismatches.length > 0) {
  throw new Error(`Canonical trace mismatch: ${mismatches.join(', ')}`)
}

const parsed = JSON.parse(expected) as {
  events: ReadonlyArray<unknown>
  finalModelFingerprint: string
}
console.log(
  JSON.stringify({
    status: 'pass',
    targets,
    bytes: Buffer.byteLength(expected),
    events: parsed.events.length,
    finalModelFingerprint: parsed.finalModelFingerprint,
  }),
)
