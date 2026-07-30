import { describe, expect, it } from 'vitest'

import {
  decodeCounterMessage,
  deviceInfoLoaded,
  incremented,
  initialCounterModel,
  nativeGreetingLoaded,
  updateCounter,
} from './domain'

describe('counter domain', () => {
  it('updates deterministically without mutating the input model', () => {
    const before = initialCounterModel()
    const [after, commands] = updateCounter(before, incremented())

    expect(before.count).toBe(0)
    expect(after.count).toBe(1)
    expect(commands).toEqual([])
  })

  it('decodes platform results as typed Messages', () => {
    const [withDevice] = updateCounter(initialCounterModel(), deviceInfoLoaded('SM-G781B', 33))
    const [withGreeting] = updateCounter(withDevice, nativeGreetingLoaded('Hello from Kotlin'))

    expect(withGreeting.device).toEqual({ _tag: 'Loaded', model: 'SM-G781B', sdk: 33 })
    expect(withGreeting.greeting).toEqual({ _tag: 'Loaded', value: 'Hello from Kotlin' })
  })

  it('rejects invalid Messages at the boundary', () => {
    expect(() => decodeCounterMessage({ _tag: 'Unknown' })).toThrow()
  })
})
