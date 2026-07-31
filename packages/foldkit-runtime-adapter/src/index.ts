import {
  type CommandContext,
  createProductionRuntime,
  type LiveRuntimeProgram,
  type ProductionRuntime,
  type RuntimeOptions,
  type ScheduledCommand,
} from '@orikit/runtime'
import {
  defineProgram,
  type Program,
  type ProgramIdentity,
  type Tagged,
  type Transition,
} from '@orikit/spike-core'
import { Effect, Fiber, Schema } from 'effect'
import type { Update } from 'foldkit/portable'

export const FoldKitCommandDescription = Schema.Struct({
  _tag: Schema.String,
  name: Schema.String,
  args: Schema.optional(Schema.Json),
  key: Schema.optional(Schema.String),
})
export type FoldKitCommandDescription = typeof FoldKitCommandDescription.Type

export type FoldKitLiveCommand = Readonly<{
  name: string
  args?: Readonly<Record<string, unknown>>
  key?: string
  effect: Effect.Effect<unknown, unknown, never>
}>

export type FoldKitCommandRegistration<Message extends Tagged> = Readonly<{
  completions: ReadonlyArray<Message['_tag']>
}>

export type FoldKitCommandRegistry<Message extends Tagged> = Readonly<
  Record<string, FoldKitCommandRegistration<Message>>
>

export type FoldKitProgramDefinition<Flags, Model, Message extends Tagged> = Readonly<{
  identity: ProgramIdentity
  Flags: Program<Flags, Model, Message, FoldKitCommandDescription>['Flags']
  Model: Program<Flags, Model, Message, FoldKitCommandDescription>['Model']
  Message: Program<Flags, Model, Message, FoldKitCommandDescription>['Message']
  commands: FoldKitCommandRegistry<Message>
  init: (flags: Flags) => Update.Return<Model, Message>
  update: (model: Model, message: Message) => Update.Return<Model, Message>
}>

export type FoldKitProgramAdapter<Flags, Model, Message extends Tagged> = Readonly<{
  program: Program<Flags, Model, Message, FoldKitCommandDescription>
  liveProgram: LiveRuntimeProgram<Flags, Model, Message, FoldKitCommandDescription>
  describe: (command: FoldKitCommandMetadata) => FoldKitCommandDescription
}>

const decodeJson = Schema.decodeUnknownSync(Schema.Json)
const decodeDescription = Schema.decodeUnknownSync(FoldKitCommandDescription)

export type FoldKitCommandMetadata = Readonly<{
  name: string
  args?: Readonly<Record<string, unknown>>
  key?: string
}>

const descriptionOf = <Message extends Tagged>(
  registry: FoldKitCommandRegistry<Message>,
  command: FoldKitCommandMetadata,
): FoldKitCommandDescription => {
  if (registry[command.name] === undefined) {
    throw new Error(`Unregistered FoldKit Command "${command.name}"`)
  }
  return decodeDescription({
    _tag: command.name,
    name: command.name,
    ...(command.args === undefined ? {} : { args: decodeJson(command.args) }),
    ...(command.key === undefined ? {} : { key: command.key }),
  })
}

const project = <Model, Message extends Tagged>(
  registry: FoldKitCommandRegistry<Message>,
  result: Update.Return<Model, Message>,
): Transition<Model, FoldKitCommandDescription> => [
  result[0],
  result[1].map((command) => descriptionOf(registry, command)),
]

const executeLiveCommand = async <Message>(
  command: FoldKitLiveCommand,
  context: CommandContext,
): Promise<Message> => {
  const fiber = Effect.runFork(command.effect)
  const interrupt = (): void => fiber.interruptUnsafe()
  context.signal.addEventListener('abort', interrupt, { once: true })
  if (context.signal.aborted) {
    interrupt()
  }
  try {
    return (await Effect.runPromise(Fiber.join(fiber))) as Message
  } finally {
    context.signal.removeEventListener('abort', interrupt)
  }
}

const schedule = <Message extends Tagged>(
  registry: FoldKitCommandRegistry<Message>,
  command: FoldKitLiveCommand,
): ScheduledCommand<FoldKitCommandDescription, Message> => ({
  description: descriptionOf(registry, command),
  execute: (context) => executeLiveCommand(command, context),
})

const projectLive = <Model, Message extends Tagged>(
  registry: FoldKitCommandRegistry<Message>,
  result: Update.Return<Model, Message>,
): readonly [Model, ReadonlyArray<ScheduledCommand<FoldKitCommandDescription, Message>>] => [
  result[0],
  result[1].map((command) => schedule(registry, command)),
]

export const defineFoldKitProgramAdapter = <Flags, Model, Message extends Tagged>(
  definition: FoldKitProgramDefinition<Flags, Model, Message>,
): FoldKitProgramAdapter<Flags, Model, Message> => {
  const commandContract: Record<string, ReadonlyArray<Message['_tag']>> = {}
  for (const [name, registration] of Object.entries(definition.commands)) {
    commandContract[name] = registration.completions
  }

  const program = defineProgram<Flags, Model, Message, FoldKitCommandDescription>({
    identity: definition.identity,
    Flags: definition.Flags,
    Model: definition.Model,
    Message: definition.Message,
    Command: FoldKitCommandDescription,
    commandContract,
    init: (flags) => project(definition.commands, definition.init(flags)),
    update: (model, message) => project(definition.commands, definition.update(model, message)),
  })

  const liveProgram: LiveRuntimeProgram<Flags, Model, Message, FoldKitCommandDescription> = {
    init: (flags) => projectLive(definition.commands, definition.init(flags)),
    update: (model, message) => projectLive(definition.commands, definition.update(model, message)),
  }

  return {
    program,
    liveProgram,
    describe: (command) => descriptionOf(definition.commands, command),
  }
}

export const createFoldKitProductionRuntime = <Flags, Model, Message extends Tagged>(
  adapter: FoldKitProgramAdapter<Flags, Model, Message>,
  options: Omit<
    RuntimeOptions<Flags, Model, Message, FoldKitCommandDescription>,
    'program' | 'interpret'
  >,
): ProductionRuntime<Model, Message, FoldKitCommandDescription> =>
  createProductionRuntime({
    ...options,
    program: adapter.program,
    liveProgram: adapter.liveProgram,
  })


