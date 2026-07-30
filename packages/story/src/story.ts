import {
  assertCommandCompletion,
  codecsFor,
  type Program,
  type Tagged,
} from '@orikit/spike-core'
import { canonicalJson, fingerprint, type JsonValue } from '@orikit/spike-trace'

import { diffPartial, diffValues, formatDiff } from './diff'
import { toJsonValue } from './json'
import type { StoryTrace, StoryTraceEvent, StoryTraceState } from './types'

export type DeepPartial<Value> =
  Value extends ReadonlyArray<infer Item>
    ? ReadonlyArray<DeepPartial<Item>>
    : Value extends object
      ? { readonly [Key in keyof Value]?: DeepPartial<Value[Key]> }
      : Value

type FlagsStep<Flags> = Readonly<{ _tag: 'Flags'; flags: Flags }>
type ModelStep<Model> = Readonly<{ _tag: 'Model'; model: Model }>
type MessageStep<Message> = Readonly<{ _tag: 'Message'; message: Message }>
type ExpectModelStep<Model> = Readonly<{ _tag: 'ExpectModel'; model: Model }>
type ExpectModelPartialStep<Model> = Readonly<{
  _tag: 'ExpectModelPartial'
  model: DeepPartial<Model>
}>
type ExpectCommandStep<Command> = Readonly<{ _tag: 'ExpectCommand'; command: Command }>
type ResolveStep<Message, Command> = Readonly<{
  _tag: 'Resolve'
  command: Command
  message: Message
}>

export type StoryStep<Flags, Model, Message, Command> =
  | FlagsStep<Flags>
  | ModelStep<Model>
  | MessageStep<Message>
  | ExpectModelStep<Model>
  | ExpectModelPartialStep<Model>
  | ExpectCommandStep<Command>
  | ResolveStep<Message, Command>

export type StoryResult<Model, Command> = Readonly<{
  finalModel: Model
  pendingCommands: ReadonlyArray<Command>
  trace: StoryTrace
}>

export class StoryFailure extends Error {
  readonly step: number

  constructor(step: number, message: string, cause?: unknown) {
    super(`Story step ${step}: ${message}`, { cause })
    this.name = 'StoryFailure'
    this.step = step
  }
}

const stateFor = <Model, Command>(
  encodeModel: (model: Model) => unknown,
  encodeCommand: (command: Command) => unknown,
  model: Model,
  commands: ReadonlyArray<Command>,
): StoryTraceState => {
  const encodedModel = toJsonValue(encodeModel(model))
  return {
    model: encodedModel,
    modelFingerprint: fingerprint(encodedModel),
    commands: commands.map((command) => toJsonValue(encodeCommand(command))),
  }
}

const assertEqual = (
  step: number,
  subject: string,
  expected: JsonValue,
  actual: JsonValue,
  partial = false,
): void => {
  const diffs = partial ? diffPartial(expected, actual) : diffValues(expected, actual)
  if (diffs.length > 0) {
    throw new StoryFailure(step, `${subject} did not match:\n${formatDiff(diffs)}`)
  }
}

export const runStory = <Flags, Model, Message extends Tagged, Command extends Tagged>(
  program: Program<Flags, Model, Message, Command>,
  steps: ReadonlyArray<
    StoryStep<NoInfer<Flags>, NoInfer<Model>, NoInfer<Message>, NoInfer<Command>>
  >,
): StoryResult<Model, Command> => {
  const codecs = codecsFor(program)
  const first = steps[0]
  if (first === undefined || (first._tag !== 'Flags' && first._tag !== 'Model')) {
    throw new StoryFailure(0, 'the first step must provide Flags or a Model snapshot')
  }

  let model: Model
  let pendingCommands: Array<Command>
  let origin: StoryTrace['origin']
  try {
    if (first._tag === 'Flags') {
      const flags = codecs.decodeFlags(first.flags)
      const [initialModel, initialCommands] = program.init(flags)
      model = codecs.decodeModel(initialModel)
      pendingCommands = initialCommands.map((command) => codecs.decodeCommand(command))
      origin = { _tag: 'Flags', flags: toJsonValue(codecs.encodeFlags(flags)) }
    } else {
      model = codecs.decodeModel(first.model)
      pendingCommands = []
      origin = { _tag: 'Model', model: toJsonValue(codecs.encodeModel(model)) }
    }
  } catch (cause) {
    throw new StoryFailure(0, 'initial boundary validation failed', cause)
  }

  const initial = stateFor(codecs.encodeModel, codecs.encodeCommand, model, pendingCommands)
  const events: Array<StoryTraceEvent> = []

  for (let index = 1; index < steps.length; index += 1) {
    const step = steps[index] as StoryStep<Flags, Model, Message, Command>
    try {
      if (step._tag === 'Flags' || step._tag === 'Model') {
        throw new StoryFailure(index, 'Flags or Model may only appear as the first step')
      }
      if (step._tag === 'ExpectModel') {
        const expected = toJsonValue(codecs.encodeModel(codecs.decodeModel(step.model)))
        const actual = toJsonValue(codecs.encodeModel(model))
        assertEqual(index, 'model', expected, actual)
        continue
      }
      if (step._tag === 'ExpectModelPartial') {
        const expected = toJsonValue(step.model)
        const actual = toJsonValue(codecs.encodeModel(model))
        assertEqual(index, 'model', expected, actual, true)
        continue
      }
      if (step._tag === 'ExpectCommand') {
        const expectedCommand = codecs.decodeCommand(step.command)
        const actualCommand = pendingCommands[0]
        if (actualCommand === undefined) {
          throw new StoryFailure(index, 'expected a pending command, but the queue was empty')
        }
        assertEqual(
          index,
          'command',
          toJsonValue(codecs.encodeCommand(expectedCommand)),
          toJsonValue(codecs.encodeCommand(actualCommand)),
        )
        continue
      }

      let message: Message
      let source: StoryTraceEvent['source']
      let completedCommand: JsonValue | undefined
      if (step._tag === 'Resolve') {
        const expectedCommand = codecs.decodeCommand(step.command)
        const actualCommand = pendingCommands[0]
        if (actualCommand === undefined) {
          throw new StoryFailure(index, 'cannot resolve a command because the queue was empty')
        }
        assertEqual(
          index,
          'resolved command',
          toJsonValue(codecs.encodeCommand(expectedCommand)),
          toJsonValue(codecs.encodeCommand(actualCommand)),
        )
        message = codecs.decodeMessage(step.message)
        assertCommandCompletion(program.commandContract, actualCommand, message)
        completedCommand = toJsonValue(codecs.encodeCommand(actualCommand))
        pendingCommands.shift()
        source = 'Resolution'
      } else {
        message = codecs.decodeMessage(step.message)
        source = 'Message'
      }

      const [nextModel, emittedCommands] = program.update(model, message)
      model = codecs.decodeModel(nextModel)
      const validatedCommands = emittedCommands.map((command) => codecs.decodeCommand(command))
      pendingCommands.push(...validatedCommands)
      events.push({
        sequence: events.length + 1,
        source,
        message: toJsonValue(codecs.encodeMessage(message)),
        ...(completedCommand === undefined ? {} : { completedCommand }),
        state: stateFor(codecs.encodeModel, codecs.encodeCommand, model, validatedCommands),
      })
    } catch (cause) {
      if (cause instanceof StoryFailure) {
        throw cause
      }
      const detail = cause instanceof Error ? `: ${cause.message}` : ''
      throw new StoryFailure(index, `boundary validation or transition failed${detail}`, cause)
    }
  }

  const trace: StoryTrace = {
    formatVersion: 1,
    program: program.identity,
    origin,
    initial,
    events,
  }
  // Prove that the trace itself is portable before returning it.
  canonicalJson(toJsonValue(trace))
  return { finalModel: model, pendingCommands, trace }
}

export const Story = {
  flags: <Flags>(flags: Flags): FlagsStep<Flags> => ({ _tag: 'Flags', flags }),
  model: <Model>(model: Model): ModelStep<Model> => ({ _tag: 'Model', model }),
  message: <Message>(message: Message): MessageStep<Message> => ({ _tag: 'Message', message }),
  expectModel: <Model>(model: Model): ExpectModelStep<Model> => ({
    _tag: 'ExpectModel',
    model,
  }),
  expectModelPartial: <Model>(model: DeepPartial<Model>): ExpectModelPartialStep<Model> => ({
    _tag: 'ExpectModelPartial',
    model,
  }),
  expectCommand: <Command>(command: Command): ExpectCommandStep<Command> => ({
    _tag: 'ExpectCommand',
    command,
  }),
  resolve: <Message, Command>(
    command: Command,
    message: Message,
  ): ResolveStep<Message, Command> => ({
    _tag: 'Resolve',
    command,
    message,
  }),
  run: runStory,
}
