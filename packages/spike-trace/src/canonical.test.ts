import { describe, expect, it } from 'vitest'

import { canonicalJson, sha256Hex } from './canonical'
import { canonicalCounterTrace, runCounterFixture } from './counter-trace'
import { canonicalTodoTrace, runTodoFixture } from './todo-trace'

describe('canonical trace', () => {
  it('orders object keys deterministically', () => {
    expect(canonicalJson({ z: 1, a: { y: 2, b: 3 } })).toBe('{"a":{"b":3,"y":2},"z":1}')
  })

  it('implements the SHA-256 reference vector', () => {
    expect(sha256Hex('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    )
  })

  it('produces the expected Counter fixture', () => {
    const trace = runCounterFixture()
    expect(trace.events).toHaveLength(5)
    expect(trace.events.at(-1)?.message).toEqual({ _tag: 'Incremented' })
    expect(canonicalCounterTrace()).toBe(canonicalJson(trace))
  })

  it('produces a stable complete Todo fixture', () => {
    const first = canonicalTodoTrace()
    const second = canonicalTodoTrace()
    expect(second).toBe(first)
    expect(runTodoFixture().events).toHaveLength(12)
    expect(runTodoFixture().events.some((event) => event.commands.length > 0)).toBe(true)
  })
})
