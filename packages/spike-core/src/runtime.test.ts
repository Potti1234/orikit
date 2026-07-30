import { describe, expect, it } from 'vitest'

import {
  type CounterCommand,
  type CounterMessage,
  type CounterModel,
  decodeCounterMessage,
  incremented,
  initialCounterModel,
  updateCounter,
} from './domain'
import { createSpikeRuntime } from './runtime'

const makeRuntime = () =>
  createSpikeRuntime<CounterModel, CounterMessage, CounterCommand>({
    initialModel: initialCounterModel(),
    decodeMessage: decodeCounterMessage,
    update: updateCounter,
  })

describe('spike runtime', () => {
  it('queues nested dispatch after the current transition', async () => {
    const runtime = makeRuntime()
    const counts: Array<number> = []
    let nested = false
    runtime.subscribe(({ liveModel }) => {
      counts.push(liveModel.count)
      if (liveModel.count === 1 && !nested) {
        nested = true
        runtime.dispatch(incremented())
      }
    })

    runtime.dispatch(incremented())
    await runtime.flush()

    expect(runtime.current().count).toBe(2)
    expect(counts).toEqual([0, 1, 2])
  })

  it('does not lose 10,000 queued Messages', async () => {
    const runtime = makeRuntime()
    for (let index = 0; index < 10_000; index += 1) {
      runtime.dispatch(incremented())
    }
    await runtime.flush()

    expect(runtime.current().count).toBe(10_000)
    expect(runtime.history()).toHaveLength(10_001)
  })

  it('keeps the historical Model visible while live processing continues', async () => {
    const runtime = makeRuntime()
    runtime.dispatch(incremented())
    runtime.dispatch(incremented())
    await runtime.flush()

    runtime.travelTo(1)
    expect(runtime.visible().count).toBe(1)

    runtime.dispatch(incremented())
    await runtime.flush()
    expect(runtime.current().count).toBe(3)
    expect(runtime.visible().count).toBe(1)

    runtime.resume()
    expect(runtime.visible().count).toBe(3)
  })

  it('prevents observers from mutating nested portable state', () => {
    const runtime = makeRuntime()
    runtime.subscribe(({ visibleModel }) => {
      expect(() => {
        const device = visibleModel.device as { _tag: string }
        device._tag = 'Loaded'
      }).toThrow()
    })
    expect(runtime.visible().device._tag).toBe('Unknown')
  })

  it('rejects invalid input and ignores dispatch after disposal', async () => {
    const runtime = makeRuntime()
    expect(() => runtime.dispatch({ _tag: 'Invalid' })).toThrow()

    runtime.dispose()
    runtime.dispatch(incremented())
    await runtime.flush()
    expect(runtime.current().count).toBe(0)
    expect(runtime.status()).toEqual({ _tag: 'Disposed' })
  })
})
