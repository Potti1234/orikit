import {
  assertCommandCompletion,
  codecsFor,
  type Program,
  type Tagged,
} from '@orikit/spike-core'
import { fingerprint, type JsonValue } from '@orikit/spike-trace'

import { diffValues, formatDiff } from './diff'
import { toJsonValue } from './json'
import type { StoryTrace, StoryTraceState } from './types'

export class ReplayDivergenceError extends Error {
  readonly sequence: number
  readonly path: string

  constructor(sequence: number, subject: string, expected: JsonValue, actual: JsonValue) {
    const diffs = diffValues(expected, actual)
    const first = diffs[0]
    super(`Replay diverged at sequence ${sequence} (${subject}):\n${formatDiff(diffs)}`)
    this.name = 'ReplayDivergenceError'
    this.sequence = sequence
    this.path = first?.path ?? '$'
  }
}

const assertTraceValue = (
  sequence: number,
  subject: string,
  expected: JsonValue,
  actual: JsonValue,
): void => {
  if (diffValues(expected, actual).length > 0) {
    throw new ReplayDivergenceError(sequence, subject, expected, actual)
  }
}

export type ReplayResult<Model, Command> = Readonly<{
  finalModel: Model
  pendingCommands: ReadonlyArray<Command>
  transitions: number
}>

export const replayStory = <Flags, Model, Message extends Tagged, Command extends Tagged>(
  program: Program<Flags, Model, Message, Command>,
  trace: StoryTrace,
): ReplayResult<Model, Command> => {
  const codecs = codecsFor(program)
  if (
    trace.program.name !== program.identity.name ||
    trace.program.schemaVersion !== program.identity.schemaVersion
  ) {
    throw new Error(
      `Trace ${trace.program.name}@${trace.program.schemaVersion} does not match ` +
        `${program.identity.name}@${program.identity.schemaVersion}`,
    )
  }

  let model: Model
  let pendingCommands: Array<Command>
  if (trace.origin._tag === 'Flags') {
    const flags = codecs.decodeFlags(trace.origin.flags)
    const initialized = program.init(flags)
    model = codecs.decodeModel(initialized[0])
    pendingCommands = initialized[1].map((command) => codecs.decodeCommand(command))
  } else {
    // Snapshot replay decodes the stored model through the program boundary.
    model = codecs.decodeModel(trace.origin.model)
    pendingCommands = []
  }

  const assertState = (
    sequence: number,
    expected: StoryTraceState,
    actualModel: Model,
    actualCommands: ReadonlyArray<Command>,
  ): void => {
    // Stored snapshots and commands cross the same schemas as live values.
    codecs.decodeModel(expected.model)
    expected.commands.forEach((command) => {
      codecs.decodeCommand(command)
    })
    const encodedActualModel = toJsonValue(codecs.encodeModel(actualModel))
    assertTraceValue(sequence, 'model', expected.model, encodedActualModel)
    assertTraceValue(
      sequence,
      'model fingerprint',
      expected.modelFingerprint,
      fingerprint(encodedActualModel),
    )
    assertTraceValue(
      sequence,
      'commands',
      toJsonValue(expected.commands),
      toJsonValue(actualCommands.map((command) => codecs.encodeCommand(command))),
    )
  }

  assertState(0, trace.initial, model, pendingCommands)

  for (const event of trace.events) {
    const message = codecs.decodeMessage(event.message)
    if (event.source === 'Resolution') {
      const command = pendingCommands[0]
      if (command === undefined || event.completedCommand === undefined) {
        throw new Error(`Trace resolution at sequence ${event.sequence} has no pending command`)
      }
      assertTraceValue(
        event.sequence,
        'completed command',
        event.completedCommand,
        toJsonValue(codecs.encodeCommand(command)),
      )
      assertCommandCompletion(program.commandContract, command, message)
      pendingCommands.shift()
    }
    const [nextModel, emittedCommands] = program.update(model, message)
    model = codecs.decodeModel(nextModel)
    const validatedCommands = emittedCommands.map((command) => codecs.decodeCommand(command))
    pendingCommands.push(...validatedCommands)
    assertState(event.sequence, event.state, model, validatedCommands)
  }

  return {
    finalModel: model,
    pendingCommands,
    transitions: trace.events.length,
  }
}
