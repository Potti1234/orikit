# Phase 4 production runtime MVP

Date: 2026-07-30

## Outcome

Phase 4 replaces the Todo application's Phase 1 history-observer scheduler
with the portable `@orikit/runtime` package.

The runtime owns:

- Serialized non-blocking dispatch.
- Session, branch, Message sequence, and Command IDs.
- Model commit before Command scheduling.
- Command completion contract validation.
- Cancellation signals and active Command metadata.
- Stale completion and queued Message quarantine.
- Running, crashed, and disposed status.
- Native host lifecycle reports.
- Bounded runtime diagnostic events.
- Update, queue, Command, cancellation, and quarantine metrics.

The pure Todo Program, Foldkit web view, NativeScript view, Stories, and
canonical logical trace did not change.

## Runtime contract

The interpreter boundary is:

```ts
type CommandInterpreter<Command, Message> = (
  command: Command,
  context: {
    commandId: string
    sessionId: string
    branchId: string
    causedBySequence: number
    signal: RuntimeAbortSignal
  },
) => Promise<Message>
```

Expected domain failures return typed completion Messages. An unexpected
rejection or invalid terminal Message produces an inspectable `Crashed`
runtime status rather than a misleading domain failure.

The structural cancellation signal avoids a DOM type dependency while
supporting abort state, reason, abort listeners, and `throwIfAborted()`.

## Exit criteria

| Criterion | Status | Evidence |
|---|---|---|
| 10,000 dispatches lose no Messages | Passed locally | Stress test and benchmark finish at sequence 10,001 after the initial Todo load completion |
| Nested dispatch remains ordered | Passed locally | Observer dispatch produces initial, outer, then nested snapshots and FIFO Model order |
| Dispose cancels work and listeners | Passed locally | Signal aborts, active Commands become empty, dispatch is ignored, and observers stop |
| Late callback cannot mutate wrong branch/runtime | Passed locally | Branch replacement and disposal tests record `QuarantinedCompletion`; Model remains unchanged |
| Runtime defects are inspectable | Passed locally | Update, interpreter, and completion-contract defects produce `Crashed` status and `RuntimeCrashed` events |

## Additional correctness evidence

- Commands are queued only after their causal transition is committed and
  published.
- Commands returned together start in declaration order.
- Every accepted terminal Message is schema-decoded and checked against the
  Program command contract.
- A crash quarantines remaining queued Messages so `flush()` cannot deadlock.
- Command terminal events retain the complete execution identity and
  description.
- Runtime events are bounded while aggregate metrics continue increasing.
- Observer defects do not roll back an already committed transition or stop
  other observers.
- `dispose()` is idempotent.
- Low-level branch replacement cancels old work before publishing the new
  branch identity.

## Performance measurement

Command:

```text
pnpm evidence:runtime
```

Windows result for 10,000 Todo draft Messages:

```json
{
  "status": "Running",
  "messages": 10000,
  "finalSequence": 10001,
  "finalDraft": "draft-9999",
  "elapsedMilliseconds": 115.4102,
  "messagesPerSecond": 86647.45,
  "maximumQueueDepth": 10000,
  "maximumUpdateMilliseconds": 0.4673,
  "averageUpdateMilliseconds": 0.0048,
  "retainedRuntimeEvents": 256,
  "droppedRuntimeEvents": 9748
}
```

This is a development-host diagnostic, not a public performance guarantee.
Renderer and physical-device latency remain separate measurements.

## NativeScript integration

The Todo application now constructs the production runtime directly and maps
storage Commands through its interpreter boundary. Initial `LoadTodos` is
identified as caused by sequence zero. Later persistence Commands carry their
committing Message sequence.

The NativeScript host reports:

- `Launched`
- `BecameActive`
- `EnteredBackground`
- `ReturnedForeground`
- `LowMemory`
- `Terminating`

The Android readiness record includes runtime status, session, branch,
sequence, and aggregate metrics.

## Verification

Passed:

```text
pnpm --filter @orikit/runtime typecheck
pnpm --filter @orikit/runtime test
pnpm verify:portable
pnpm verify:web
pnpm evidence:runtime
```

Portable verification runs 54 tests across core, runtime, Todo, trace, Story,
Foldkit Scene, and native semantic/reconciliation suites.

Android build passed. The final physical-device rerun is pending because the
connected Samsung currently reports `unauthorized`; unlock the device and
accept its USB debugging RSA prompt before rerunning:

```text
pnpm verify:android:todo:device
```

Repository-wide `pnpm lint` is not currently a clean Phase 4 signal because
unrelated `branding/` SVG and `site/index.html` files contain accessibility
diagnostics. All Phase 4 implementation files pass targeted Biome checks and
those unrelated files were not modified.

Not run:

- iOS build or runtime. No macOS/Xcode evidence exists.

## Boundaries retained for later phases

- Phase 4 does not execute Commands during replay.
- Phase 4 does not implement a remote inspector or history UI.
- Phase 4 does not acquire Subscriptions or managed resources.
- Phase 4 does not introduce a portable view AST.
- Phase 4 does not replace Foldkit Runtime on web.
- Phase 4 does not claim true cancellation for native SDKs that ignore abort;
  identity-based quarantine remains mandatory.

## Decision

See [ADR-0003](../adr/0003-production-runtime-mvp.md).

## Next phase

Phase 5 applies the runtime to a real Android capability with permissions,
streaming or callback behavior, a narrow Kotlin boundary, cancellation, and
late-callback quarantine on the physical phone.
