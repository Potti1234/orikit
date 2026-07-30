import { defineCommandContract, defineProgram, tagged, transition } from '@orikit/spike-core'
import { Schema } from 'effect'
import { describe, expect, it } from 'vitest'

import { createProductionRuntime } from './runtime'
import type { CommandContext, ProductionRuntime, RuntimeAbortSignal } from './types'

const TestModel = Schema.Struct({
  count: Schema.Number,
  order: Schema.Array(Schema.String),
})
type TestModel = typeof TestModel.Type
const TestFlags = Schema.Struct({})
type TestFlags = typeof TestFlags.Type

const Add = Schema.TaggedStruct('Add', {
  value: Schema.Number,
  label: Schema.String,
})
const RequestAdd = Schema.TaggedStruct('RequestAdd', { value: Schema.Number })
const AddCompleted = Schema.TaggedStruct('AddCompleted', { value: Schema.Number })
const Explode = Schema.TaggedStruct('Explode', {})
const TestMessage = Schema.Union([Add, RequestAdd, AddCompleted, Explode])
type TestMessage = typeof TestMessage.Type

const AddLater = Schema.TaggedStruct('AddLater', { value: Schema.Number })
const TestCommand = Schema.Union([AddLater])
type TestCommand = typeof TestCommand.Type

const testProgram = defineProgram<TestFlags, TestModel, TestMessage, TestCommand>({
  identity: {
    name: 'runtime-test',
    schemaVersion: 1,
    buildVersion: 'phase4',
  },
  Flags: TestFlags,
  Model: TestModel,
  Message: TestMessage,
  Command: TestCommand,
  commandContract: defineCommandContract<TestCommand, TestMessage>({
    AddLater: ['AddCompleted'],
  }),
  init: () => transition<TestModel, TestCommand>({ count: 0, order: [] }),
  update: (model, message) => {
    switch (message._tag) {
      case 'Add':
        return transition({
          count: model.count + message.value,
          order: [...model.order, message.label],
        })
      case 'RequestAdd':
        return transition(model, tagged('AddLater', { value: message.value }))
      case 'AddCompleted':
        return transition({
          count: model.count + message.value,
          order: [...model.order, `completed-${message.value}`],
        })
      case 'Explode':
        throw new Error('update exploded')
    }
  },
})

const add = (value = 1, label = String(value)): TestMessage => tagged('Add', { value, label })
const requestAdd = (value: number): TestMessage => tagged('RequestAdd', { value })
const addCompleted = (value: number): TestMessage => tagged('AddCompleted', { value })

type Runtime = ProductionRuntime<TestModel, TestMessage, TestCommand>

const immediateInterpreter = async (command: TestCommand): Promise<TestMessage> =>
  addCompleted(command.value)

const makeRuntime = (
  interpret: (
    command: TestCommand,
    context: CommandContext,
  ) => Promise<TestMessage> = immediateInterpreter,
  eventLimit = 1_000,
): Runtime =>
  createProductionRuntime({
    program: testProgram,
    flags: {},
    interpret,
    eventLimit,
    idFactory: (kind, index) => `${kind}-${index}`,
  })

const deferred = <Value>() => {
  let resolvePromise!: (value: Value) => void
  let rejectPromise!: (reason: unknown) => void
  const promise = new Promise<Value>((resolve, reject) => {
    resolvePromise = resolve
    rejectPromise = reject
  })
  return { promise, resolve: resolvePromise, reject: rejectPromise }
}

describe('production runtime dispatch', () => {
  it('does not lose 10,000 Messages and keeps bounded diagnostics', async () => {
    const runtime = makeRuntime(immediateInterpreter, 64)

    for (let index = 0; index < 10_000; index += 1) {
      runtime.dispatch(add(1, String(index)))
    }
    await runtime.flush()

    expect(runtime.current().count).toBe(10_000)
    expect(runtime.current().order).toHaveLength(10_000)
    expect(runtime.current().order[9_999]).toBe('9999')
    expect(runtime.snapshot().sequence).toBe(10_000)
    expect(runtime.events()).toHaveLength(64)
    expect(runtime.metrics()).toMatchObject({
      dispatchedMessages: 10_000,
      committedMessages: 10_000,
      maximumQueueDepth: 10_000,
      droppedEvents: 9_936,
    })
  })

  it('queues nested observer dispatch after the current commit', async () => {
    const runtime = makeRuntime()
    const observed: Array<number> = []
    let nested = false
    runtime.subscribe(({ model }) => {
      observed.push(model.count)
      if (model.count === 1 && !nested) {
        nested = true
        runtime.dispatch(add(1, 'nested'))
      }
    })

    runtime.dispatch(add(1, 'outer'))
    await runtime.flush()

    expect(observed).toEqual([0, 1, 2])
    expect(runtime.current().order).toEqual(['outer', 'nested'])
  })

  it('commits and publishes before starting Commands in returned order', async () => {
    let runtime!: Runtime
    const observations: Array<number> = []
    const starts: Array<number> = []
    runtime = makeRuntime(async (command) => {
      starts.push(command.value)
      expect(runtime.current().count).toBe(0)
      expect(observations.at(-1)).toBe(0)
      return addCompleted(command.value)
    })
    runtime.subscribe(({ model }) => observations.push(model.count))

    runtime.dispatch(requestAdd(3))
    runtime.dispatch(requestAdd(4))
    await runtime.settle()

    expect(starts).toEqual([3, 4])
    expect(runtime.current().count).toBe(7)
    const queued = runtime
      .events()
      .flatMap((event) => (event._tag === 'CommandQueued' ? [event.execution.command.value] : []))
    expect(queued).toEqual([3, 4])
  })
})

describe('production runtime supervision', () => {
  it('cancels active work and listeners on idempotent disposal', async () => {
    const completion = deferred<TestMessage>()
    let signal: RuntimeAbortSignal | undefined
    const runtime = makeRuntime(async (_command, context) => {
      signal = context.signal
      return completion.promise
    })
    const observations: Array<number> = []
    runtime.subscribe(({ model }) => observations.push(model.count))
    runtime.dispatch(requestAdd(2))
    await runtime.flush()
    await Promise.resolve()

    runtime.dispose()
    runtime.dispose()
    runtime.dispatch(add(1, 'ignored'))

    expect(signal?.aborted).toBe(true)
    expect(runtime.status()).toEqual({ _tag: 'Disposed' })
    expect(runtime.snapshot().activeCommands).toEqual([])
    expect(observations).toEqual([0, 0])
    expect(runtime.metrics().commandsCancelled).toBe(1)
  })

  it('quarantines a completion from a replaced branch', async () => {
    const completion = deferred<TestMessage>()
    const runtime = makeRuntime(async () => completion.promise)
    runtime.dispatch(requestAdd(5))
    await runtime.flush()
    await Promise.resolve()
    const firstBranch = runtime.snapshot().branchId

    const secondBranch = runtime.replaceBranch()
    completion.resolve(addCompleted(5))
    await Promise.resolve()
    await Promise.resolve()
    await runtime.flush()

    expect(secondBranch).not.toBe(firstBranch)
    expect(runtime.current().count).toBe(0)
    expect(runtime.metrics()).toMatchObject({
      commandsCancelled: 1,
      quarantinedCompletions: 1,
    })
    expect(runtime.events()).toContainEqual(
      expect.objectContaining({
        _tag: 'QuarantinedCompletion',
        reason: 'BranchChanged',
        outcome: 'Resolved',
      }),
    )
  })

  it('quarantines late callbacks after disposal', async () => {
    const completion = deferred<TestMessage>()
    const runtime = makeRuntime(async () => completion.promise)
    runtime.dispatch(requestAdd(8))
    await runtime.flush()
    await Promise.resolve()
    runtime.dispose()

    completion.resolve(addCompleted(8))
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(runtime.current().count).toBe(0)
    expect(runtime.events()).toContainEqual(
      expect.objectContaining({
        _tag: 'QuarantinedCompletion',
        reason: 'Disposed',
      }),
    )
  })

  it('turns update defects into inspectable crash state', async () => {
    const runtime = makeRuntime()
    runtime.dispatch(tagged('Explode'))
    runtime.dispatch(add(1, 'queued-after-defect'))
    await runtime.flush()

    expect(runtime.status()).toMatchObject({
      _tag: 'Crashed',
      phase: 'Update',
      defect: { message: 'update exploded' },
    })
    expect(runtime.events()).toContainEqual(expect.objectContaining({ _tag: 'RuntimeCrashed' }))
    expect(runtime.metrics().quarantinedMessages).toBe(1)

    runtime.dispatch(add(1, 'ignored-after-crash'))
    await runtime.flush()
    expect(runtime.current().count).toBe(0)
  })

  it('crashes on interpreter defects and invalid completion contracts', async () => {
    const rejected = makeRuntime(async () => {
      throw new Error('interpreter exploded')
    })
    rejected.dispatch(requestAdd(1))
    await rejected.settle()
    expect(rejected.status()).toMatchObject({
      _tag: 'Crashed',
      phase: 'Command',
      defect: { message: 'interpreter exploded' },
    })

    const invalid = makeRuntime(async () => add(1, 'not-a-completion'))
    invalid.dispatch(requestAdd(1))
    await invalid.settle()
    expect(invalid.status()).toMatchObject({
      _tag: 'Crashed',
      phase: 'Command',
      defect: { name: 'CommandContractError' },
    })
  })

  it('records lifecycle, observer defects, IDs, and timing metrics', async () => {
    let clock = 0
    const runtime = createProductionRuntime({
      program: testProgram,
      flags: {},
      interpret: immediateInterpreter,
      eventLimit: 20,
      now: () => clock++,
      idFactory: (kind, index) => `${kind}-test-${kind === 'session' ? 42 : index}`,
    })
    runtime.subscribe(() => {
      throw new Error('renderer failed')
    })
    runtime.reportLifecycle('Launched')
    runtime.reportLifecycle('EnteredBackground')
    runtime.dispatch(add(2, 'timed'))
    await runtime.flush()

    expect(runtime.snapshot()).toMatchObject({
      sessionId: 'session-test-42',
      branchId: 'branch-test-1',
      sequence: 1,
    })
    expect(runtime.metrics()).toMatchObject({
      observerDefects: 2,
      totalUpdateMilliseconds: 1,
      maximumUpdateMilliseconds: 1,
    })
    expect(
      runtime
        .events()
        .filter((event) => event._tag === 'LifecycleReported')
        .map(({ lifecycle }) => lifecycle),
    ).toEqual(['Launched', 'EnteredBackground'])
  })
})
