# ADR-0003: Portable Promise-based production runtime

## Status

Accepted on 2026-07-30 for Phase 4.

## Context and evidence

The Phase 3 Todo application scheduled Commands by observing the Phase 1
history runtime. That proved command-after-commit behavior but did not own
command identity, cancellation, stale completion quarantine, lifecycle
diagnostics, bounded runtime events, or crash state.

The runtime must remain usable in Node, Foldkit-adjacent TypeScript,
NativeScript Android V8, and later iOS JavaScriptCore. Portable consumers
compile without DOM libraries, so a browser `AbortSignal` type cannot leak
through the package boundary.

Foldkit web applications already have a mature Foldkit runtime. Replacing it
would weaken the project's claim that web remains a normal Foldkit
application.

## Decision

Create a dedicated portable `@orikit/runtime` package below platform
applications and above the portable Program contract.

The runtime:

- Accepts a schema-defined Program, decoded Flags, and one Command
  interpreter.
- Uses a non-blocking serialized Message queue.
- Commits and publishes a Model before starting returned Commands.
- Assigns session, branch, sequence, and command identity.
- Requires each ordinary interpreter invocation to return one terminal
  Message as a Promise.
- Validates terminal Messages against the Program's command completion
  contract.
- Provides a small structural `RuntimeAbortSignal` with abort state, reason,
  listeners, and `throwIfAborted()`.
- Quarantines completions whose Command is inactive or whose
  session/branch/runtime state is stale.
- Stops in an inspectable crash state for unexpected update, validation, or
  interpreter defects.
- Keeps runtime diagnostic events bounded independently of logical state.
- Records lifecycle control events without placing platform handles in the
  Model.

Effect remains allowed inside an interpreter, but it is not part of the
portable interpreter signature.

NativeScript Todo now uses this runtime. The Foldkit web Todo continues using
Foldkit's own Runtime and Command facilities while sharing the exact portable
Program and trace fixtures.

## Consequences

Positive:

- Portable packages do not import DOM, Node, or NativeScript APIs.
- Native late callbacks can be rejected using runtime-owned identity even
  when the underlying SDK cannot truly cancel.
- Runtime crashes preserve status, defect, command metadata, metrics, and
  recent diagnostic events.
- Tests can inject clocks and ID factories.
- The Android host can report suspend, resume, low-memory, and termination
  lifecycle events.

Costs:

- The structural cancellation signal is not nominally the browser
  `AbortSignal`; adapters for APIs requiring the full native/browser object
  may be needed.
- Foldkit web and OriKit native runtimes remain separate implementations
  with shared semantic fixtures.
- Branch replacement exists as a low-level runtime primitive, but the
  historical branch user experience remains Phase 7.
- Subscriptions and managed resources remain Phase 8.

## Alternatives

Keep observing Phase 1 history:

- Rejected because scheduling is indirect and cannot supervise work
  correctly.

Bind Effect directly into every Command:

- Rejected because it makes portable Commands and interpreters depend on a
  particular runtime service model.

Expose DOM `AbortSignal`:

- Rejected because it broke portable consumers that intentionally compile
  without DOM libraries.

Replace Foldkit Runtime on web:

- Rejected because the web target should remain a genuine Foldkit
  application.

## Verification

- `pnpm verify:portable`
- `pnpm --filter @orikit/runtime test`
- `pnpm evidence:runtime`
- `pnpm verify:android:todo:device`

The focused suite covers 10,000 queued Messages, nested dispatch, commit
ordering, command ordering, disposal, abort, branch replacement, late
completion quarantine, update defects, interpreter defects, invalid
completion contracts, lifecycle events, bounded diagnostics, and metrics.

## Reversal conditions and cost

The Promise interpreter may be wrapped or replaced if Effect integration
materially improves cancellation/resource supervision on both Android and
iOS. `RuntimeAbortSignal` may grow a standards-compatible adapter. Neither
change affects portable Command descriptions or update functions.
