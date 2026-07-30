# 3. Core API specification

This document is normative for the first implementation. Names may change
through an ADR, but semantics must not change accidentally.

## 3.1 Design constraints

The public core must be:

- Usable from `commonMain`.
- Small enough to understand in one sitting.
- Independent of UI and platform libraries.
- Friendly to Kotlin/Native export.
- Explicit rather than clever.
- Serializable at DevTools boundaries.
- Usable without code generation.

## 3.2 Program

```kotlin
interface Program<Flags, Model, Message, Command> {
    val identity: ProgramIdentity

    fun init(flags: Flags): Next<Model, Command>

    fun update(
        model: Model,
        message: Message,
    ): Next<Model, Command>
}
```

Do not put command handlers, dispatchers, clocks, or platform dependencies in
`Program`.

## 3.3 Next

```kotlin
data class Next<out Model, out Command>(
    val model: Model,
    val commands: List<Command>,
)

fun <Model, Command> next(
    model: Model,
    vararg commands: Command,
): Next<Model, Command> =
    Next(model, commands.toList())
```

Requirements:

- Preserve command order.
- Never expose a mutable command list.
- Empty commands are normal.
- A `Next` value is a transition result, not a running effect.

Potential optimization with persistent collections is deferred until measured.

## 3.4 Model

A Model:

- Is immutable by convention and API.
- Uses `val` fields.
- Uses immutable collection interfaces.
- Is serializable for DevTools-enabled programs.
- Contains logical application state, not native objects.
- Has stable equality semantics.

Recommended:

```kotlin
@Serializable
data class TodoModel(
    val todos: List<Todo>,
    val draft: String,
    val status: Status,
)
```

Forbidden:

```kotlin
data class BadModel(
    val context: android.content.Context,
    val viewController: platform.UIKit.UIViewController,
    val socket: NativeSocket,
    var mutableCounter: Int,
)
```

## 3.5 Message

Messages are facts or user intentions and should be named in the past tense
when representing events:

```kotlin
@Serializable
sealed interface TodoMessage {
    @Serializable
    data class ChangedDraft(val value: String) : TodoMessage

    @Serializable
    data object ClickedAddTodo : TodoMessage

    @Serializable
    data class CompletedLoadTodos(
        val todos: List<Todo>,
    ) : TodoMessage

    @Serializable
    data class FailedLoadTodos(
        val problem: LoadProblem,
    ) : TodoMessage
}
```

Rules:

- Every Message payload must be a value.
- Do not place callbacks in Messages.
- Do not use native SDK objects as payloads.
- User gestures are Messages if they affect logical behavior.
- Command outcomes are Messages.
- Unexpected exceptions are runtime defects, not domain Messages.

## 3.6 Command

Commands describe work; they do not execute it:

```kotlin
@Serializable
sealed interface TodoCommand {
    @Serializable
    data object LoadTodos : TodoCommand

    @Serializable
    data class SaveTodo(val todo: Todo) : TodoCommand
}
```

The initial API uses an application-wide Command union. This is intentionally
boring and makes serialization and exhaustive handlers reliable.

Every command kind declares its completion contract in generated metadata:

```text
LoadTodos -> CompletedLoadTodos | FailedLoadTodos
SaveTodo  -> CompletedSaveTodo  | FailedSaveTodo
```

Kotlin's type system cannot directly express a heterogeneous serializable
command union where each subtype has a distinct result union without making
interop difficult. Enforce the result mapping through generated manifests,
tests, and handler DSLs.

## 3.7 Command handler

```kotlin
fun interface CommandHandler<Command, Message> {
    suspend fun handle(command: Command): Message
}
```

Version 1 requires exactly one terminal Message per command. Streaming work
belongs in Subscriptions.

The runtime converts thrown exceptions into a configurable crash report.
Expected failures must be returned as typed failure Messages.

Future API:

```kotlin
interface CommandExecution<Message> {
    suspend fun emit(message: Message)
}
```

Do not add multi-message commands until a real use case cannot be represented
as a Subscription.

## 3.8 Dispatch

```kotlin
fun interface Dispatcher<Message> {
    fun dispatch(message: Message)
}
```

Dispatch is non-suspending and thread-safe. It enqueues work and returns. It
must not synchronously run update on an arbitrary caller thread.

## 3.9 Runtime observation

Avoid exposing `MutableStateFlow`.

```kotlin
interface ModelSource<Model> {
    val current: Model
    val models: StateFlow<Model>
}

interface ApplicationHandle<Model, Message> :
    ModelSource<Model>,
    Dispatcher<Message> {
    val status: StateFlow<RuntimeStatus>
    fun dispose()
}
```

If exporting `StateFlow` to Swift is uncomfortable in the stable Objective-C
interop path, expose an additional callback facade:

```kotlin
interface Cancellable {
    fun cancel()
}

fun watchModel(
    observer: (Model) -> Unit,
): Cancellable
```

Swift export can later offer `AsyncSequence`, but its Alpha status must not be
a requirement for version 1.

## 3.10 Runtime status

```kotlin
sealed interface RuntimeStatus {
    data object Starting : RuntimeStatus
    data object Running : RuntimeStatus
    data class Traveling(val cursor: EventSequence) : RuntimeStatus
    data class Crashed(val crashId: String) : RuntimeStatus
    data object Disposed : RuntimeStatus
}
```

## 3.11 Codecs

The runtime must not assume JSON internally:

```kotlin
interface ValueCodec<T> {
    fun encode(value: T): ByteArray
    fun decode(bytes: ByteArray): T
}

data class ProgramCodecs<Flags, Model, Message, Command>(
    val flags: ValueCodec<Flags>,
    val model: ValueCodec<Model>,
    val message: ValueCodec<Message>,
    val command: ValueCodec<Command>,
)
```

The first provided implementation uses `kotlinx.serialization` JSON because it
is inspectable and interoperable. Binary formats are optional later.

## 3.12 OutMessages and features

A child feature may emit:

- Internal child Messages, handled by the child.
- Typed OutMessages, handled by the parent.

Proposed contract:

```kotlin
data class FeatureNext<Model, Command, OutMessage>(
    val model: Model,
    val commands: List<Command>,
    val outMessages: List<OutMessage>,
)
```

Parent adapters map child Commands and Messages into parent unions. Avoid
reflection in the core composition path.

## 3.13 API review checklist

Before adding any core API:

1. Can the use case be implemented outside core?
2. Is it common to web, Android, and iOS?
3. Does it keep update deterministic?
4. Can it be exported to Swift without exotic generics?
5. Can it be serialized or represented in DevTools?
6. Can an AI agent understand it from one example?
7. Is its lifecycle explicit?
8. Does it have a Story-test interpretation?

