import { createProductionRuntime, withManagedResources } from '@orikit/runtime'
import { defineCommandContract, defineProgram, tagged, transition } from '@orikit/spike-core'
import { Schema } from 'effect'
import { describe, expect, it } from 'vitest'

import { createDevtoolsHistory } from './history'
import { redactValue } from './redaction'

const Model = Schema.Struct({ draft: Schema.String })
type Model = typeof Model.Type
const Message = Schema.TaggedStruct('Changed', { value: Schema.String })
type Message = typeof Message.Type
const Command = Schema.Never
type Command = never
type Flags = Record<string, never>
const program = defineProgram<Flags, Model, Message, Command>({
  identity: { name: 'history-test', schemaVersion: 1, buildVersion: 'phase7' },
  Flags: Schema.Struct({}),
  Model,
  Message,
  Command,
  commandContract: defineCommandContract<Command, Message>({}),
  init: () => transition<Model, Command>({ draft: '' }),
  update: (_model, message) => transition<Model, Command>({ draft: message.value }),
})
const changed = (value: string): Message => tagged('Changed', { value })
const runtime = () =>
  createProductionRuntime({
    program,
    flags: {},
    interpret: async (): Promise<Message> => changed('unused'),
    idFactory: (kind, index) => `${kind}-${index}`,
  })

describe('DevTools history', () => {
  it('travels while live processing continues and resumes explicitly', async () => {
    const live = runtime()
    const history = createDevtoolsHistory({ program, runtime: live })
    live.dispatch(changed('past'))
    await live.flush()
    const pastSequence = live.snapshot().sequence
    history.travelTo(pastSequence)
    live.dispatch(changed('live keeps moving'))
    await live.flush()
    expect(history.snapshot().mode).toEqual({ _tag: 'Traveling', sequence: pastSequence })
    expect(history.snapshot().visibleModel.draft).toBe('past')
    expect(history.snapshot().liveModel.draft).toBe('live keeps moving')
    history.resumeLive()
    expect(history.snapshot().visibleModel.draft).toBe('live keeps moving')
  })

  it('reconstructs from snapshots without effects', async () => {
    const live = runtime()
    const history = createDevtoolsHistory({ program, runtime: live, snapshotInterval: 2 })
    live.dispatch(changed('one'))
    live.dispatch(changed('two'))
    await live.flush()
    expect(history.reconstruct(live.snapshot().sequence).draft).toBe('two')
  })

  it('bounds records and keeps the first retained record replayable', async () => {
    const live = runtime()
    const history = createDevtoolsHistory({ program, runtime: live, maxEvents: 3 })
    for (let index = 0; index < 5; index += 1) live.dispatch(changed(String(index)))
    await live.flush()
    expect(history.records()).toHaveLength(3)
    expect(history.records()[0]?.snapshot).toBe(true)
    expect(history.reconstruct(live.snapshot().sequence).draft).toBe('4')
  })

  it('also bounds history by approximate serialized bytes', async () => {
    const live = runtime()
    const history = createDevtoolsHistory({ program, runtime: live, maxEvents: 100, maxBytes: 900 })
    for (let index = 0; index < 8; index += 1) live.dispatch(changed(`${index}-${'x'.repeat(100)}`))
    await live.flush()
    expect(history.records().length).toBeLessThan(9)
    expect(history.records()[0]?.snapshot).toBe(true)
    expect(history.reconstruct(live.snapshot().sequence).draft).toContain('7-')
  })

  it('redacts configured paths before export', async () => {
    const live = runtime()
    const history = createDevtoolsHistory({
      program,
      runtime: live,
      sensitivePaths: ['draft', 'value'],
      nowIso: () => '2026-07-30T00:00:00.000Z',
    })
    live.dispatch(changed('secret'))
    await live.flush()
    const exported = history.exportHistory()
    expect(JSON.stringify(exported)).not.toContain('secret')
    expect(exported.records.at(-1)?.modelAfterFingerprint).toMatch(/^redacted-v1:/)
  })

  it('records managed lifecycle and never restarts resources during travel', async () => {
    let starts = 0
    let emit: ((value: string) => void) | undefined
    const managed = withManagedResources(runtime(), {
      subscriptions: [
        {
          id: 'fixture.timer',
          key: () => 'one-second',
          start: (_model, context) => {
            starts += 1
            emit = (value) => context.dispatch(changed(value))
          },
        },
      ],
    })
    const history = createDevtoolsHistory({
      program,
      runtime: managed,
      managedResources: managed.managedResources,
      managedResourceEvents: managed.managedResourceEvents,
    })
    emit?.('from resource')
    await managed.flush()
    expect(
      history
        .records()
        .at(-1)
        ?.resourceChanges.map((change) => change.action),
    ).toContain('Emitted')
    expect(history.resources()[0]).toMatchObject({ id: 'fixture.timer', generation: 1 })
    history.travelTo(0)
    history.resumeLive()
    expect(starts).toBe(1)
  })
})

describe('redactValue', () => {
  it('does not modify live values', () => {
    const source = { auth: { token: 'secret' } }
    expect(redactValue(source, ['auth.token'])).toEqual({ auth: { token: '[REDACTED]' } })
    expect(source.auth.token).toBe('secret')
  })

  it('redacts matching field names inside resource arrays', () => {
    expect(redactValue([{ id: 'socket', key: 'secret-token' }], ['key'])).toEqual([
      { id: 'socket', key: '[REDACTED]' },
    ])
  })
})
