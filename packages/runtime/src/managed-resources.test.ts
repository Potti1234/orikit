import { defineCommandContract, defineProgram, tagged, transition } from '@orikit/spike-core'
import { Schema } from 'effect'
import { describe, expect, it } from 'vitest'

import { withManagedResources } from './managed-resources'
import { createProductionRuntime } from './runtime'

const Model = Schema.Struct({
  enabled: Schema.Boolean,
  channel: Schema.String,
  count: Schema.Number,
})
type Model = typeof Model.Type
const Message = Schema.Union([
  Schema.TaggedStruct('SetChannel', { channel: Schema.String }),
  Schema.TaggedStruct('Increment', {}),
  Schema.TaggedStruct('Disable', {}),
])
type Message = typeof Message.Type
type Command = never
const program = defineProgram<Record<string, never>, Model, Message, Command>({
  identity: { name: 'managed-test', schemaVersion: 1, buildVersion: 'phase8' },
  Flags: Schema.Struct({}),
  Model,
  Message,
  Command: Schema.Never,
  commandContract: defineCommandContract<Command, Message>({}),
  init: () => transition<Model, Command>({ enabled: true, channel: 'one', count: 0 }),
  update: (model, message) => {
    switch (message._tag) {
      case 'SetChannel':
        return transition<Model, Command>({ ...model, channel: message.channel })
      case 'Increment':
        return transition<Model, Command>({ ...model, count: model.count + 1 })
      case 'Disable':
        return transition<Model, Command>({ ...model, enabled: false })
    }
  },
})
const base = () =>
  createProductionRuntime({
    program,
    flags: {},
    interpret: async () => {
      throw new Error('No commands')
    },
  })

describe('managed resources', () => {
  it('preserves equal keys, restarts a changed key once, and stops when inactive', async () => {
    const starts: Array<string> = []
    const stops: Array<string> = []
    const runtime = withManagedResources(base(), {
      subscriptions: [
        {
          id: 'channel',
          key: (model) => model.channel,
          active: (model) => model.enabled,
          start: (model, { signal }) => {
            starts.push(model.channel)
            signal.addEventListener('abort', () => stops.push(model.channel), { once: true })
          },
        },
      ],
    })
    runtime.dispatch(tagged('Increment'))
    await runtime.flush()
    expect(starts).toEqual(['one'])
    runtime.dispatch(tagged('SetChannel', { channel: 'two' }))
    await runtime.flush()
    expect(starts).toEqual(['one', 'two'])
    expect(stops).toEqual(['one'])
    runtime.dispatch(tagged('Disable'))
    await runtime.flush()
    expect(stops).toEqual(['one', 'two'])
  })

  it('releases resource handles exactly once on disposal', async () => {
    const released: Array<string> = []
    const runtime = withManagedResources(base(), {
      resources: [
        {
          id: 'socket',
          desired: (model) => model.channel,
          acquire: (key) => `handle:${String(key)}`,
          release: (handle) => {
            released.push(handle as string)
          },
        },
      ],
    })
    await runtime.settleManagedResources()
    runtime.dispose()
    await runtime.settleManagedResources()
    runtime.dispose()
    expect(released).toEqual(['handle:one'])
  })

  it('attaches causal metadata to emitted messages', async () => {
    let emit: (() => void) | undefined
    const runtime = withManagedResources(base(), {
      subscriptions: [
        {
          id: 'timer',
          key: () => false,
          start: (_model, context) => {
            emit = () => context.dispatch(tagged('Increment'))
          },
        },
      ],
    })
    emit?.()
    await runtime.flush()
    const committed = runtime
      .events()
      .find((event) => event._tag === 'TransitionCommitted' && event.sequence === 1)
    expect(committed?._tag === 'TransitionCommitted' ? committed.source : undefined).toEqual({
      _tag: 'Subscription',
      subscriptionId: 'timer',
      generation: 1,
    })
  })

  it('records defects and applies the bounded restart policy', async () => {
    let attempts = 0
    const runtime = withManagedResources(base(), {
      delay: async () => undefined,
      subscriptions: [
        {
          id: 'fragile',
          key: () => 'stable',
          restart: { maxAttempts: 2 },
          start: async () => {
            attempts += 1
            throw new Error('fixture defect')
          },
        },
      ],
    })
    await runtime.settleManagedResources()
    expect(attempts).toBe(3)
    expect(
      runtime.managedResourceEvents().filter((event) => event.action === 'Failed'),
    ).toHaveLength(3)
    expect(runtime.managedResources()[0]?.status).toBe('Failed')
  })
})
