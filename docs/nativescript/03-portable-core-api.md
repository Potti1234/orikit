# 3. Portable core API

This document is normative for the first implementation. Names may evolve
through an ADR, but the semantics must remain explicit.

## 3.1 Constraints

The core must:

- Compile as strict TypeScript.
- Run in Node tests, browsers, NativeScript Android, and NativeScript iOS.
- Have no DOM, Node, or NativeScript runtime dependency.
- Use immutable public values.
- Expose schemas for Flags, Model, Message, and Command descriptions.
- Be understandable without code generation.
- Avoid classes whose behavior depends on object identity.

The spike uses Effect Schema and Match if they run correctly in NativeScript.
If Effect runtime features fail but Schema and Match succeed, effect
interpretation may be isolated behind a portable interface. Any larger
departure is a go/no-go decision.

## 3.2 Program

```ts
import type { Schema } from "effect"

export type Program<
  Flags,
  Model,
  Message,
  Command,
> = Readonly<{
  identity: ProgramIdentity
  Flags: Schema.Schema<Flags>
  Model: Schema.Schema<Model>
  Message: Schema.Schema<Message>
  Command: Schema.Schema<Command>
  init: Init<Flags, Model, Command>
  update: Update<Model, Message, Command>
}>
```

The Program contains descriptions and pure functions. It does not contain a
running Effect runtime, native application object, dispatcher, or renderer.

## 3.3 Transition

```ts
export type Transition<Model, Command> = readonly [
  model: Model,
  commands: ReadonlyArray<Command>,
]

export const transition = <Model, Command>(
  model: Model,
  ...commands: ReadonlyArray<Command>
): Transition<Model, Command> => [model, commands]
```

Requirements:

- Preserve Command order.
- Never expose a mutable command array.
- An empty Command array is normal.
- A Transition is data; it does not schedule work.

## 3.4 Model

A Model:

- Is immutable by convention and static typing.
- Has a complete Effect Schema.
- Has stable structural equality and canonical serialization.
- Contains only logical values.
- May use tagged unions to make invalid states unrepresentable.

Example:

```ts
const TodoModel = Schema.Struct({
  draft: Schema.String,
  todos: Schema.Array(Todo),
  loading: Schema.Union([
    Schema.TaggedStruct("Idle", {}),
    Schema.TaggedStruct("Loading", {}),
    Schema.TaggedStruct("Failed", { problem: Schema.String }),
  ]),
})

type TodoModel = typeof TodoModel.Type
```

Avoid optional fields when a tagged state describes the domain more precisely.

## 3.5 Message

Messages are facts or user intentions:

```ts
const ChangedDraft = message("ChangedDraft", {
  value: Schema.String,
})

const ClickedAdd = message("ClickedAdd")

const CompletedLoadTodos = message("CompletedLoadTodos", {
  todos: Schema.Array(Todo),
})

const FailedLoadTodos = message("FailedLoadTodos", {
  problem: LoadProblem,
})
```

Rules:

- Use a stable `_tag` discriminator.
- Payloads are immutable values.
- Do not put callbacks, promises, Effects, errors with unstable prototypes, or
  native objects in Messages.
- Expected failures are typed failure Messages.
- Command outcomes re-enter the runtime as Messages.
- High-frequency presentation-only signals should remain renderer-local unless
  they affect product behavior.

## 3.6 Update

```ts
export type Update<Model, Message, Command> = (
  model: Model,
  message: Message,
) => Transition<Model, Command>
```

Use exhaustive tagged matching:

```ts
export const update: Update<TodoModel, TodoMessage, TodoCommand> = (
  model,
  msg,
) =>
  Match.value(msg).pipe(
    Match.tagsExhaustive({
      ChangedDraft: ({ value }) => [
        { ...model, draft: value },
        [],
      ],
      ClickedAdd: () => [
        addDraft(model),
        [SaveTodos({ todos: addDraft(model).todos })],
      ],
      CompletedLoadTodos: ({ todos }) => [
        { ...model, todos, loading: { _tag: "Idle" } },
        [],
      ],
      FailedLoadTodos: ({ problem }) => [
        { ...model, loading: { _tag: "Failed", problem } },
        [],
      ],
    }),
  )
```

Update must:

- Return synchronously.
- Be deterministic.
- Never throw for an expected domain outcome.
- Never dispatch recursively.
- Never execute a Command.
- Never mutate the incoming Model.

Development builds should deep-freeze Models when the cost is acceptable.

## 3.7 Command description

The portable Command is a serializable description:

```ts
const LoadTodos = command("LoadTodos")

const SaveTodos = command("SaveTodos", {
  todos: Schema.Array(Todo),
})
```

This differs deliberately from current Foldkit `Command.define`, which binds
an Effect to the definition. Separating description and interpreter makes the
same Program portable across browser and NativeScript runtimes.

Each Command kind declares allowed completion Message tags:

```ts
const TodoCommandContract = defineCommandContract({
  LoadTodos: ["CompletedLoadTodos", "FailedLoadTodos"],
  SaveTodos: ["CompletedSaveTodos", "FailedSaveTodos"],
})
```

The runtime validates completion Messages in development and tests.

## 3.8 Command interpreter

```ts
export type CommandContext<Message> = Readonly<{
  signal: AbortSignal
  dispatch: (message: Message) => void
}>

export type CommandInterpreter<Command, Message> = (
  command: Command,
  context: CommandContext<Message>,
) => Promise<void>
```

Version 1 requires exactly one terminal Message for ordinary Commands.
Streaming behavior belongs in a Subscription.

An interpreter may internally use Effect, Promise, NativeScript APIs, Kotlin,
or Swift. That implementation is not part of the portable Command value.

## 3.9 Dispatcher and application handle

```ts
export type Dispatcher<Message> = Readonly<{
  dispatch: (message: Message) => void
}>

export type Cancel = () => void

export type ApplicationHandle<Model, Message> =
  Dispatcher<Message> &
  Readonly<{
    current: () => Model
    visible: () => Model
    subscribe: (observer: (model: Model) => void) => Cancel
    status: () => RuntimeStatus
    dispose: () => void
  }>
```

`dispatch` enqueues and returns. It must not synchronously enter update from an
arbitrary native callback stack.

## 3.10 Runtime status

```ts
type RuntimeStatus =
  | { readonly _tag: "Starting" }
  | { readonly _tag: "Running" }
  | { readonly _tag: "Traveling"; readonly sequence: number }
  | { readonly _tag: "Crashed"; readonly crashId: string }
  | { readonly _tag: "Disposed" }
```

## 3.11 Subscription

```ts
type Subscription<Model, Message> = Readonly<{
  id: string
  key: (model: Model) => unknown
  active: (model: Model) => boolean
  start: (
    model: Model,
    context: {
      signal: AbortSignal
      dispatch: (message: Message) => void
    },
  ) => Promise<void>
}>
```

The runtime compares `id` and canonical key values after each committed Model.
It starts, preserves, or cancels each Subscription accordingly.

## 3.12 Submodels and OutMessages

A feature may return internal Messages and domain facts for its parent:

```ts
type FeatureTransition<Model, Command, OutMessage> = Readonly<{
  model: Model
  commands: ReadonlyArray<Command>
  outMessages: ReadonlyArray<OutMessage>
}>
```

Parent adapters explicitly map child Messages, Commands, and OutMessages. Do
not depend on string prefix conventions or global registries for correctness.

## 3.13 Serialization

Every DevTools-enabled Program provides canonical codecs derived from schemas.

Requirements:

- Stable `_tag` discriminators.
- Stable field names.
- Deterministic object-key ordering for fingerprints.
- Defined number handling.
- Defined treatment of `undefined`; preferably disallow it in encoded values.
- Explicit schema and build versions.
- No ordinary JavaScript object `hashCode` or identity comparison.

Initial transport:

- JSON for messages and inspection.
- SHA-256 of canonical JSON for fingerprints.
- Typed in-memory Model remains authoritative.

## 3.14 API review checklist

Before expanding the portable API:

1. Is the use case demonstrated by an example?
2. Can it be implemented outside core?
3. Does it work without DOM, Node, and NativeScript?
4. Does it preserve deterministic update?
5. Can it be represented in schema and history?
6. Does it have a Story interpretation?
7. Can an AI agent understand it from one canonical example?
8. Does the API hide a platform difference that should remain explicit?
