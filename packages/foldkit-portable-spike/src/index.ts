import {
  createFoldKitProductionRuntime,
  defineFoldKitProgramAdapter,
} from '@orikit/foldkit-runtime-adapter'
import { Effect, Match as M, Schema as S } from 'effect'
import { Command, Message, type Update } from 'foldkit/portable'

export const PortableCounterModel = S.Struct({ count: S.Number })
export type PortableCounterModel = typeof PortableCounterModel.Type
const PortableCounterFlags = S.Struct({})

export const RequestedPortableIncrement = Message.m('RequestedPortableIncrement')
export const IncrementedPortableCounter = Message.m('IncrementedPortableCounter')
export const ResetPortableCounter = Message.m('ResetPortableCounter')

export const PortableCounterMessage = S.Union([
  RequestedPortableIncrement,
  IncrementedPortableCounter,
  ResetPortableCounter,
])
export type PortableCounterMessage = typeof PortableCounterMessage.Type

export type PortableCounterCommand = Command.Command<PortableCounterMessage>
export type PortableCounterUpdate = Update.Return<PortableCounterModel, PortableCounterMessage>

export const initialPortableCounterModel = (): PortableCounterModel => ({
  count: 0,
})

export const decodePortableCounterMessage = S.decodeUnknownSync(PortableCounterMessage)

export const updatePortableCounter = (
  model: PortableCounterModel,
  message: PortableCounterMessage,
): PortableCounterUpdate =>
  M.value(message).pipe(
    M.withReturnType<PortableCounterUpdate>(),
    M.tagsExhaustive({
      RequestedPortableIncrement: () => [model, [VerifyPortableCommand()]],
      IncrementedPortableCounter: () => [{ count: model.count + 1 }, []],
      ResetPortableCounter: () => [{ count: 0 }, []],
    }),
  )

export const VerifyPortableCommand = Command.define('VerifyPortableCommand', {
  messages: [IncrementedPortableCounter],
  execute: Effect.succeed(IncrementedPortableCounter()),
})

export const portableCounterAdapter = defineFoldKitProgramAdapter<
  typeof PortableCounterFlags.Type,
  PortableCounterModel,
  PortableCounterMessage
>({
  identity: {
    name: 'foldkit-portable-counter',
    schemaVersion: 1,
    buildVersion: 'command-adapter-slice',
  },
  Flags: PortableCounterFlags,
  Model: PortableCounterModel,
  Message: PortableCounterMessage,
  commands: {
    VerifyPortableCommand: {
      completions: ['IncrementedPortableCounter'],
    },
  },
  init: () => [initialPortableCounterModel(), []],
  update: updatePortableCounter,
})

export const createPortableCounterRuntime = () =>
  createFoldKitProductionRuntime(portableCounterAdapter, { flags: {} })

export type PortableCounterRuntime = ReturnType<typeof createPortableCounterRuntime>

export const verifyPortableCommand = async (
  runtime: PortableCounterRuntime,
): Promise<Readonly<{ name: string; wasDeferred: boolean; serializedEffect: boolean }>> => {
  runtime.dispatch(RequestedPortableIncrement())
  const wasDeferred = runtime.current().count === 0
  await runtime.settle()
  const completed = runtime
    .events()
    .find(
      (event) =>
        event._tag === 'CommandCompleted' &&
        event.execution.command.name === 'VerifyPortableCommand',
    )
  if (completed === undefined) {
    throw new Error('VerifyPortableCommand did not complete')
  }
  return {
    name: 'VerifyPortableCommand',
    wasDeferred,
    serializedEffect: JSON.stringify(runtime.events()).includes('effect'),
  }
}

export const runPortableCounterFixture = (): Readonly<{
  finalCount: number
  messageTags: ReadonlyArray<string>
}> => {
  const messages = [
    IncrementedPortableCounter(),
    IncrementedPortableCounter(),
    ResetPortableCounter(),
    IncrementedPortableCounter(),
  ]
  let model = initialPortableCounterModel()
  for (const message of messages) {
    ;[model] = updatePortableCounter(model, message)
  }
  return { finalCount: model.count, messageTags: messages.map((message) => message._tag) }
}


