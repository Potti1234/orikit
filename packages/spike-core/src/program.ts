import { Schema } from 'effect'

export type Transition<Model, Command> = readonly [model: Model, commands: ReadonlyArray<Command>]

export const transition = <Model, Command>(
  model: Model,
  ...commands: ReadonlyArray<Command>
): Transition<Model, Command> => [model, commands]

export const ProgramIdentity = Schema.Struct({
  name: Schema.String,
  schemaVersion: Schema.Natural,
  buildVersion: Schema.String,
})

export type ProgramIdentity = typeof ProgramIdentity.Type

export type PortableCodec<Value> = Schema.Codec<Value, unknown, never, never>

export type Init<Flags, Model, Command> = (flags: Flags) => Transition<Model, Command>

export type Update<Model, Message, Command> = (
  model: Model,
  message: Message,
) => Transition<Model, Command>

export type Tagged = Readonly<{ _tag: string }>

type Tags<Value extends Tagged> = Value['_tag']

export type CommandContract<Command extends Tagged, Message extends Tagged> = Readonly<{
  [Tag in Tags<Command>]: ReadonlyArray<Tags<Message>>
}>

export type Program<Flags, Model, Message extends Tagged, Command extends Tagged> = Readonly<{
  identity: ProgramIdentity
  Flags: PortableCodec<Flags>
  Model: PortableCodec<Model>
  Message: PortableCodec<Message>
  Command: PortableCodec<Command>
  commandContract: CommandContract<Command, Message>
  init: Init<Flags, Model, Command>
  update: Update<Model, Message, Command>
}>

export const defineProgram = <Flags, Model, Message extends Tagged, Command extends Tagged>(
  definition: Program<Flags, Model, Message, Command>,
): Program<Flags, Model, Message, Command> => {
  const identity = Schema.decodeUnknownSync(ProgramIdentity)(definition.identity)
  return Object.freeze({
    ...definition,
    identity: Object.freeze(identity),
    commandContract: Object.freeze(definition.commandContract),
  })
}

export type ProgramCodecs<Flags, Model, Message, Command> = Readonly<{
  decodeFlags: (input: unknown) => Flags
  decodeModel: (input: unknown) => Model
  decodeMessage: (input: unknown) => Message
  decodeCommand: (input: unknown) => Command
  encodeFlags: (value: Flags) => unknown
  encodeModel: (value: Model) => unknown
  encodeMessage: (value: Message) => unknown
  encodeCommand: (value: Command) => unknown
}>

export const codecsFor = <Flags, Model, Message extends Tagged, Command extends Tagged>(
  program: Program<Flags, Model, Message, Command>,
): ProgramCodecs<Flags, Model, Message, Command> => ({
  decodeFlags: Schema.decodeUnknownSync(program.Flags),
  decodeModel: Schema.decodeUnknownSync(program.Model),
  decodeMessage: Schema.decodeUnknownSync(program.Message),
  decodeCommand: Schema.decodeUnknownSync(program.Command),
  encodeFlags: Schema.encodeSync(program.Flags),
  encodeModel: Schema.encodeSync(program.Model),
  encodeMessage: Schema.encodeSync(program.Message),
  encodeCommand: Schema.encodeSync(program.Command),
})

export function tagged<Tag extends string>(tag: Tag): Readonly<{ _tag: Tag }>
export function tagged<Tag extends string, Payload extends Readonly<Record<string, unknown>>>(
  tag: Tag,
  payload: Payload,
): Readonly<{ _tag: Tag } & Payload>
export function tagged(
  tag: string,
  payload: Readonly<Record<string, unknown>> = {},
): Readonly<Record<string, unknown> & { _tag: string }> {
  return Object.freeze({
    _tag: tag,
    ...payload,
  })
}

export type Dispatcher<Message> = (message: Message) => void

export type ApplicationSnapshot<Model> = Readonly<{
  model: Model
  sequence: number
}>

export type ApplicationHandle<Model, Message> = Readonly<{
  dispatch: Dispatcher<Message>
  current: () => ApplicationSnapshot<Model>
  subscribe: (observer: (snapshot: ApplicationSnapshot<Model>) => void) => () => void
  dispose: () => void
}>
