# 5. Runtime, Commands, Subscriptions, and resources

## 5.1 Runtime responsibilities

The runtime:

- Decodes Flags.
- Calls init once.
- Owns the live and visible Models.
- Serializes Message dispatch.
- Calls update.
- Records transitions.
- Publishes the visible Model.
- Schedules Commands.
- Reconciles Subscriptions and resources.
- Quarantines stale callbacks.
- Supports travel, resume, and branch modes.
- Disposes all owned work.

## 5.2 Dispatch queue

Dispatch is non-blocking:

```ts
dispatch(message): void
```

Required behavior:

1. Validate the Message in development and at remote boundaries.
2. Attach source and causal metadata.
3. Append to the queue.
4. Schedule one drain if no drain is active.
5. Return.
6. Process Messages sequentially.

Nested native callbacks, Command completions, and DevTools dispatch must all
enter the same queue.

## 5.3 Commit order

For one Message:

1. Capture `modelBefore`.
2. Call update.
3. Validate Transition and Command schemas.
4. Make `modelAfter` the live Model.
5. Record the event.
6. Publish Model when in live mode.
7. Reconcile Subscriptions/resources.
8. Schedule Commands in returned order.

The Model commit occurs before Commands begin.

## 5.4 Command identity

Runtime metadata:

```ts
type CommandExecution = Readonly<{
  commandId: string
  sessionId: string
  branchId: string
  causedBySequence: number
  command: EncodedValue
  status: "Queued" | "Running" | "Completed" | "Cancelled" | "Failed"
}>
```

IDs are runtime metadata and are excluded from semantic Command equality.

## 5.5 Completion contract

An ordinary Command:

- Produces exactly one terminal Message.
- May be cancelled.
- Must translate expected failures into typed Messages.
- Must not mutate the Model.
- Must not call update.

An unexpected interpreter defect transitions the runtime to its configured
crash policy and records the command metadata.

## 5.6 Cancellation and stale callbacks

Each Command receives an `AbortSignal`, but native SDKs may not support true
cancellation. Therefore every completion is checked:

```text
session matches
branch matches
command remains active
runtime not disposed
```

If any check fails, record `QuarantinedCompletion` and do not dispatch.

This is mandatory for camera, location, Bluetooth, payments, notifications,
pickers, and native callbacks.

## 5.7 Effect integration

Effect may be used inside interpreters:

```ts
const interpret = (command, context) =>
  Effect.runPromise(
    handler(command).pipe(
      Effect.tap(message =>
        Effect.sync(() => context.dispatch(message)),
      ),
    ),
  )
```

The portable Command description must remain independent from a particular
Effect runtime service. Browser and NativeScript layers provide their own
capabilities.

The spike verifies Effect fibers, interruption, Schema, Stream, Scope, Clock,
and timeout behavior on Android. iOS repeats the same vectors.

## 5.8 Subscriptions

Subscriptions represent ongoing event sources:

- Timers.
- Connectivity.
- App lifecycle.
- WebSocket messages.
- Location updates.
- Sensor streams.

After each commit:

1. Evaluate which subscriptions are active.
2. Compute stable keys.
3. Preserve subscriptions with equal ID/key.
4. Cancel removed or changed subscriptions.
5. Start newly active subscriptions.

Every emitted value becomes a Message through dispatch.

## 5.9 Managed resources

Long-lived handles are stored outside the Model:

```ts
type ResourceDefinition<Model, Handle, Message> = Readonly<{
  id: string
  desired: (model: Model) => false | unknown
  acquire: (key: unknown, dispatch: Dispatch<Message>) => Promise<Handle>
  release: (handle: Handle) => Promise<void>
}>
```

Examples:

- WebSocket connection.
- Audio session.
- Camera preview.
- Database.
- Native observer token.

Resource handles are never serialized. History records lifecycle metadata,
not the handle.

## 5.10 Main thread

NativeScript JavaScript normally runs on the UI thread. Update and view
description generation must stay within their budgets.

Use a Worker or native implementation for:

- Large image transforms.
- Compression.
- Encryption with large payloads.
- Heavy parsing.
- Audio/video processing.
- Long synchronous loops.

Workers have isolated contexts. Messages crossing the Worker boundary must be
explicitly serializable. Native UI operations remain on the UI thread.

## 5.11 Lifecycle

The mobile host reports lifecycle as Messages or runtime control events:

- Launched.
- Became active/resumed.
- Became inactive/paused.
- Entered background.
- Returned foreground.
- Low memory.
- Terminating/disposed.

Product-significant lifecycle changes are Messages. Runtime housekeeping may
remain control events but must be visible in diagnostics.

Background execution is governed by Android/iOS policy. A JavaScript runtime
cannot assume it continues indefinitely in the background.

## 5.12 Persistence

Persistence is a Command or managed resource:

```text
update requests SaveTodos
interpreter writes storage
interpreter dispatches CompletedSaveTodos or FailedSaveTodos
```

Do not hide persistence in Model setters or view handlers.

For application restoration:

- Persist a versioned, serializable subset.
- Decode and migrate before constructing Flags.
- Reject incompatible data visibly.
- Never persist native handles or active continuations.

## 5.13 Crash policy

Development:

- Stop accepting ordinary UI dispatch.
- Cancel or quarantine active work.
- Preserve history and error metadata.
- Render a diagnostic crash view.
- Keep remote inspector access where safe.

Release:

- Report the defect with redacted context.
- Use a product-specific fallback or restart policy.
- Never convert arbitrary programming defects into misleading domain failure
  Messages.

## 5.14 Disposal

`dispose()` is idempotent and:

1. Marks the runtime disposed.
2. Stops accepting new ordinary dispatch.
3. Cancels Commands.
4. Cancels Subscriptions.
5. Releases managed resources.
6. Detaches renderer listeners.
7. Closes DevTools transports.
8. Clears references that retain native views/controllers.

Repeated open/close tests must prove no retained Activity, UIViewController, or
renderer root.
