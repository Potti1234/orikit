import { describe, expect, it } from 'vitest'
import { canonicalJson, fingerprint } from './canonical'

describe('DevTools canonical values', () => {
  it('sorts object keys and fingerprints deterministically', () => {
    expect(canonicalJson({ z: 1, a: { y: 2 } })).toBe('{"a":{"y":2},"z":1}')
    expect(fingerprint({ z: 1, a: { y: 2 } })).toBe(fingerprint({ a: { y: 2 }, z: 1 }))
  })
})
