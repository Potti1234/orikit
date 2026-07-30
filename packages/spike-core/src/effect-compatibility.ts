import { Effect, Fiber, Stream } from 'effect'
import { TestClock } from 'effect/testing'

import {
  CounterMessage,
  decodeCounterMessage,
  encodeCounterMessage,
  incremented,
  initialCounterModel,
  updateCounter,
} from './domain'

export type CompatibilityStatus = 'pass' | 'fail'

export type CompatibilityCheck = Readonly<{
  status: CompatibilityStatus
  detail?: string
}>

export type EffectCompatibilityResult = Readonly<{
  runtime: string
  checks: Readonly<Record<string, CompatibilityCheck>>
}>

const detailOf = (error: unknown): string =>
  error instanceof Error ? `${error.name}: ${error.message}` : String(error)

export const runEffectCompatibilityChecks = async (
  runtime: string,
): Promise<EffectCompatibilityResult> => {
  const checks: Record<string, CompatibilityCheck> = {}

  const check = async (name: string, test: () => void | Promise<void>): Promise<void> => {
    try {
      await test()
      checks[name] = { status: 'pass' }
    } catch (error) {
      checks[name] = { status: 'fail', detail: detailOf(error) }
    }
  }

  await check('schemaEncodeDecode', () => {
    const encoded = encodeCounterMessage(incremented())
    const decoded = decodeCounterMessage(encoded)
    if (decoded._tag !== 'Incremented') {
      throw new Error('Tagged Message did not survive encode/decode')
    }
  })

  await check('schemaInvalidDecode', () => {
    let rejected = false
    try {
      decodeCounterMessage({ _tag: 'NotAMessage' })
    } catch {
      rejected = true
    }
    if (!rejected) {
      throw new Error('Invalid Message was accepted')
    }
  })

  await check('taggedUnion', () => {
    const decoded = decodeCounterMessage({ _tag: 'DeviceInfoLoaded', model: 'test', sdk: 33 })
    if (decoded._tag !== 'DeviceInfoLoaded' || decoded.sdk !== 33) {
      throw new Error('Tagged union payload mismatch')
    }
  })

  await check('matchExhaustive', () => {
    const [model] = updateCounter(initialCounterModel(), incremented())
    if (model.count !== 1) {
      throw new Error('Exhaustive Match produced the wrong Model')
    }
  })

  await check('effectSync', () => {
    const value = Effect.runSync(Effect.sync(() => 42))
    if (value !== 42) {
      throw new Error('Effect.sync returned the wrong value')
    }
  })

  await check('effectPromise', async () => {
    const value = await Effect.runPromise(Effect.promise(() => Promise.resolve(42)))
    if (value !== 42) {
      throw new Error('Effect.promise returned the wrong value')
    }
  })

  await check('testClock', async () => {
    let completed = false
    const program = Effect.gen(function* () {
      const fiber = yield* Effect.gen(function* () {
        yield* Effect.sleep('1 hour')
        completed = true
      }).pipe(Effect.forkChild)
      yield* TestClock.adjust('1 hour')
      yield* Fiber.join(fiber)
    }).pipe(Effect.provide(TestClock.layer()))

    await Effect.runPromise(program)
    if (!completed) {
      throw new Error('TestClock did not resume the sleeping fiber')
    }
  })

  await check('scopeAcquireRelease', async () => {
    const events: Array<string> = []
    const resource = Effect.acquireRelease(
      Effect.sync(() => {
        events.push('acquire')
        return 'resource'
      }),
      () =>
        Effect.sync(() => {
          events.push('release')
        }),
    )
    await Effect.runPromise(Effect.scoped(resource))
    if (events.join(',') !== 'acquire,release') {
      throw new Error(`Unexpected scope events: ${events.join(',')}`)
    }
  })

  await check('fiberInterruption', async () => {
    let finalized = false
    const program = Effect.gen(function* () {
      const fiber = yield* Effect.never.pipe(
        Effect.ensuring(
          Effect.sync(() => {
            finalized = true
          }),
        ),
        Effect.forkChild({ startImmediately: true }),
      )
      yield* Fiber.interrupt(fiber)
    })
    await Effect.runPromise(program)
    if (!finalized) {
      throw new Error('Interrupted fiber did not run its finalizer')
    }
  })

  await check('stream', async () => {
    const values = await Effect.runPromise(Stream.fromIterable([1, 2, 3]).pipe(Stream.runCollect))
    if (values.join(',') !== '1,2,3') {
      throw new Error('Stream values were not collected in order')
    }
  })

  // Retain a direct schema reference in this compatibility module so bundlers
  // cannot accidentally tree-shake the union constructor from the vector.
  void CounterMessage

  return {
    runtime,
    checks,
  }
}
