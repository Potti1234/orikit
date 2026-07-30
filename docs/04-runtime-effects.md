# 4. Runtime, Commands, Subscriptions, and resources

## 4.1 Runtime invariants

The runtime must guarantee:

1. Only one Message is reduced at a time.
2. Message sequence numbers are strictly increasing.
3. update receives the last committed Model.
4. Model publication happens after update returns.
5. Commands are scheduled only after the new Model is committed.
6. A command completion re-enters through dispatch.
7. Disposing cancels commands, subscriptions, and observers.
8. Time-travel mode never executes historical Commands.
9. A crashed runtime does not continue silently.
10. DevTools observation cannot change program semantics.

## 4.2 Event-loop algorithm

Use a coroutine-owned queue or actor pattern. Do not rely on
`MutableStateFlow.update` as the serialization mechanism.

Pseudocode:

```text
start:
  transition = program.init(flags)
  commit initialization model
  start commands
  reconcile subscriptions

dispatch(message):
  enqueue LiveMessage(message)

event loop:
  for event in queue:
    if disposed: ignore
    if traveling and event is LiveMessage:
      buffer or reject according to policy
    old = current model
    started = monotonic clock
    next = program.update(old, event.message)
    commit next.model
    record message, before/after fingerprints, commands, duration
    reconcile subscriptions against next.model
    launch next.commands
```

Default queue policy:

- Unbounded queue in development to avoid silent loss.
- Configurable bounded queue with explicit overflow crash/report in production.
- Never silently drop application Messages.

## 4.3 Threading

- Runtime reduction runs on a configured serial dispatcher.
- Model observation is safe from any target thread.
- Android UI collection occurs on its lifecycle-aware main context.
- Swift facade delivers observable changes on `MainActor`.
- Command handlers may switch contexts internally.
- The runtime must not hold a UI thread while a Command runs.

`StateFlow` is appropriate for current-state observation and is thread-safe,
but it conflates fast updates. Therefore DevTools history must listen to the
runtime's lossless event stream, not infer history from `StateFlow`.

## 4.4 Command identity

Each scheduled command receives:

```kotlin
data class CommandEnvelope<Command>(
    val commandId: CommandId,
    val causedBy: EventSequence,
    val command: Command,
    val policy: CommandPolicy,
)
```

```kotlin
data class CommandPolicy(
    val key: String?,
    val concurrency: CommandConcurrency,
)

enum class CommandConcurrency {
    Parallel,
    KeepFirst,
    KeepLatest,
    Queue,
}
```

Initial implementation supports `Parallel` and `KeepLatest`. Add the others
after tests specify their exact behavior.

## 4.5 Cancellation

Commands run as child jobs of the application scope.

- `dispose()` cancels all jobs.
- `KeepLatest` cancels the prior job with the same key.
- Cancellation does not dispatch a failure Message by default.
- A command may explicitly map cancellation to a Message if product behavior
  requires it.
- Commands must cooperate with coroutine cancellation.

Record cancellation in DevTools without treating it as a domain failure.

## 4.6 Subscription definition

Subscriptions describe ongoing streams derived from the current Model:

```kotlin
interface Subscription<Model, Message> {
    val id: SubscriptionId
    fun key(model: Model): Any?
    fun messages(model: Model): Flow<Message>
}
```

A Program may provide:

```kotlin
fun subscriptions(model: Model): List<SubscriptionSpec<Message>>
```

The runtime diffs subscription identity plus key:

- Same ID and equivalent key: retain existing collection.
- Same ID and changed key: cancel and restart.
- Removed ID: cancel.
- New ID: start.

Do not restart streams merely because an unrelated Model field changed.

## 4.7 Managed resources

Resources such as sockets should be tied to subscription lifetime:

```kotlin
fun chatMessages(roomId: RoomId): Flow<Message> =
    callbackFlow {
        val socket = socketFactory.connect(roomId)
        socket.onMessage { trySend(ReceivedChatMessage(it)) }
        awaitClose { socket.close() }
    }
```

Acquisition failure becomes a typed Message. Unhandled defects go to the
runtime crash reporter.

## 4.8 Platform capabilities

Construct the command handler from explicit ports:

```kotlin
interface Clock {
    fun now(): Instant
    suspend fun sleep(duration: Duration)
}

interface SecureStore {
    suspend fun read(key: String): SecureValue?
    suspend fun write(key: String, value: SecureValue)
}

interface TodoApi {
    suspend fun loadTodos(): List<Todo>
}
```

The handler maps port results to Messages. Story tests do not use the handler;
handler tests use fake ports.

## 4.9 Failure taxonomy

Use three categories:

1. **Domain outcome**: expected and represented as Message data.
2. **Cancellation**: lifecycle/control flow, recorded but normally no Message.
3. **Defect**: invariant violation or unexpected exception; crashes or invokes
   the configured crash policy.

Do not turn every Throwable into a stringly typed `Failed` Message.

## 4.10 Crash behavior

```kotlin
data class CrashContext<Model, Message>(
    val crashId: String,
    val model: Model,
    val message: Message?,
    val phase: RuntimePhase,
    val throwable: Throwable,
)
```

Default development behavior:

- Record crash.
- Cancel active work.
- Set status to `Crashed`.
- Keep the last Model inspectable.
- Reject dispatch until restarted.

Production policy may display platform-native fallback UI and report the crash.

## 4.11 Slow warnings

Measure:

- Queue wait
- update duration
- Model serialization duration
- Model publication duration
- subscription reconciliation
- command startup

Thresholds are configuration, not hardcoded. Measurements use a monotonic
clock. DevTools overhead is separately measured.

## 4.12 Lifecycle

Platform lifecycle events enter as either:

- Runtime controls: start, stop observation, dispose.
- Shared Messages: `EnteredBackground`, `OpenedDeepLink`, when behavior needs
  to change.

Do not automatically cancel the entire runtime when an Android activity
recreates or a SwiftUI view disappears. The platform application container
owns runtime lifetime.

