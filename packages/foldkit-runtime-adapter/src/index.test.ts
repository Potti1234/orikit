import { Effect, Match as M, Schema as S } from 'effect'
import { Command, Message, type Update } from 'foldkit/portable'
import { describe, expect, it } from 'vitest'

import {
  createFoldKitProductionRuntime,
  defineFoldKitProgramAdapter,
  type FoldKitCommandDescription,
} from './index'

const Model = S.Struct({ count: S.Number })
type Model = typeof Model.Type
const Flags = S.Struct({})
type Flags = typeof Flags.Type

const RequestedAdd = Message.m('RequestedAdd', { value: S.Number })
const CompletedAdd = Message.m('CompletedAdd', { value: S.Number })
const UnexpectedAdd = Message.m('UnexpectedAdd', { value: S.Number })
const TestMessage = S.Union([RequestedAdd, CompletedAdd, UnexpectedAdd])
type TestMessage = typeof TestMessage.Type
type CompletionMessage = typeof CompletedAdd.Type | typeof UnexpectedAdd.Type
type Return = Update.Return<Model, TestMessage>

type Harness = ReturnType<typeof makeHarness>

const makeHarness = (
  effectFor: (value: number) => Effect.Effect<CompletionMessage, never, never>,
) => {
  let executions = 0
  let commandConstructions = 0
  const AddLater = Command.define('AddLater', {
    args: { value: S.Number },
    messages: [CompletedAdd, UnexpectedAdd],
    execute: ({ value }) =>
      Effect.suspend(() => {
        executions += 1
        return effectFor(value)
      }),
  })
  const makeAddLater = (value: number) => {
    commandConstructions += 1
    return AddLater({ value })
  }

  const adapter = defineFoldKitProgramAdapter<Flags, Model, TestMessage>({
    identity: {
      name: 'foldkit-command-adapter-test',
      schemaVersion: 1,
      buildVersion: 'slice-2',
    },
    Flags,
    Model,
    Message: TestMessage,
    commands: {
      AddLater: {
        completions: ['CompletedAdd'],
      },
    },
    init: () => [{ count: 0 }, []],
    update: (model, message): Return =>
      M.value(message).pipe(
        M.withReturnType<Return>(),
        M.tagsExhaustive({
          RequestedAdd: ({ value }) => [model, [makeAddLater(value)]],
          CompletedAdd: ({ value }) => [{ count: model.count + value }, []],
          UnexpectedAdd: () => [model, []],
        }),
      ),
  })

  return {
    adapter,
    executions: () => executions,
    commandConstructions: () => commandConstructions,
  }
}

const runtimeFor = (harness: Harness) =>
  createFoldKitProductionRuntime(harness.adapter, {
    flags: {},
    idFactory: (kind, index) => `${kind}-${index}`,
  })

const description = (value: number): FoldKitCommandDescription => ({
  _tag: 'AddLater',
  name: 'AddLater',
  args: { value },
})

const deferred = <Value>() => {
  let resolve!: (value: Value) => void
  const promise = new Promise<Value>((complete) => {
    resolve = complete
  })
  return { promise, resolve }
}

describe('FoldKit production runtime adapter', () => {
  it('records only a JSON Command projection and executes the Effect live', async () => {
    const harness = makeHarness((value) => Effect.succeed(CompletedAdd({ value })))
    const runtime = runtimeFor(harness)

    runtime.dispatch(RequestedAdd({ value: 3 }))
    await runtime.settle()

    expect(runtime.current()).toEqual({ count: 3 })
    expect(harness.executions()).toBe(1)
    expect(harness.commandConstructions()).toBe(1)
    const serializedEvents = JSON.stringify(runtime.events())
    expect(serializedEvents).toContain('"name":"AddLater"')
    expect(serializedEvents).not.toContain('effect')
    expect(runtime.events()).toContainEqual(
      expect.objectContaining({
        _tag: 'CommandCompleted',
        completion: CompletedAdd({ value: 3 }),
      }),
    )
  })

  it('projects repeatable transitions without executing a Command Effect', () => {
    const harness = makeHarness((value) => Effect.succeed(CompletedAdd({ value })))
    const first = harness.adapter.program.update({ count: 0 }, RequestedAdd({ value: 4 }))
    const replayed = harness.adapter.program.update({ count: 0 }, RequestedAdd({ value: 4 }))

    expect(harness.executions()).toBe(0)
    expect(first).toEqual([{ count: 0 }, [description(4)]])
    expect(replayed).toEqual(first)
    expect(JSON.stringify(first)).not.toContain('effect')
    expect(harness.executions()).toBe(0)
  })

  it('rejects unknown or non-JSON Command metadata before execution', () => {
    const harness = makeHarness((value) => Effect.succeed(CompletedAdd({ value })))

    expect(() => harness.adapter.describe({ name: 'UnregisteredCommand' })).toThrow(
      'Unregistered FoldKit Command',
    )
    expect(() =>
      harness.adapter.describe({
        name: 'AddLater',
        args: { value: () => 4 },
      }),
    ).toThrow()
    expect(harness.executions()).toBe(0)
    expect(harness.commandConstructions()).toBe(0)
  })

  it('interrupts the Effect fiber when the runtime is disposed', async () => {
    let finalized = false
    const harness = makeHarness((value) =>
      Effect.never.pipe(
        Effect.ensuring(
          Effect.sync(() => {
            finalized = true
          }),
        ),
        Effect.as(CompletedAdd({ value })),
      ),
    )
    const runtime = runtimeFor(harness)
    runtime.dispatch(RequestedAdd({ value: 5 }))
    await runtime.flush()
    await Promise.resolve()

    runtime.dispose()
    await expect.poll(() => finalized).toBe(true)
    await expect.poll(() => runtime.metrics().quarantinedCompletions).toBe(1)

    expect(runtime.current()).toEqual({ count: 0 })
    expect(runtime.metrics()).toMatchObject({
      commandsCancelled: 1,
      quarantinedCompletions: 1,
    })
  })

  it('quarantines an interrupted Effect from a stale branch', async () => {
    const completion = deferred<CompletionMessage>()
    const harness = makeHarness(() =>
      Effect.promise(() => completion.promise).pipe(Effect.uninterruptible),
    )
    const runtime = runtimeFor(harness)
    runtime.dispatch(RequestedAdd({ value: 7 }))
    await runtime.flush()
    await Promise.resolve()

    runtime.replaceBranch()
    completion.resolve(CompletedAdd({ value: 7 }))
    await expect
      .poll(() => runtime.events().some((event) => event._tag === 'QuarantinedCompletion'))
      .toBe(true)

    expect(runtime.current()).toEqual({ count: 0 })
    expect(runtime.events()).toContainEqual(
      expect.objectContaining({
        _tag: 'QuarantinedCompletion',
        reason: 'BranchChanged',
        outcome: 'Rejected',
      }),
    )
  })

  it('retains the registered completion contract', async () => {
    const harness = makeHarness((value) => Effect.succeed(UnexpectedAdd({ value })))
    const runtime = runtimeFor(harness)
    runtime.dispatch(RequestedAdd({ value: 9 }))
    await runtime.settle()

    expect(runtime.current()).toEqual({ count: 0 })
    expect(runtime.status()).toMatchObject({
      _tag: 'Crashed',
      phase: 'Command',
      defect: { name: 'CommandContractError' },
    })
  })
})


