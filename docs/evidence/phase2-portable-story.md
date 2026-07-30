# Phase 2 portable Program and Story evidence

## Outcome

Recorded on 2026-07-30.

Phase 2 implements and verifies the smallest portable Program, Command
contract, Story, canonical trace, and effect-free replay API. It remains an
experiment and does not authorize Phase 3 renderer work by itself.

The implemented API and examples are documented in the
[Phase 2 API guide](../nativescript/19-phase2-portable-api.md). The deliberate
Program-contract addition is recorded in
[ADR-0002](../adr/0002-phase2-portable-contract.md).

## Exit criteria

| Criterion | Status | Evidence |
|---|---|---|
| Core imports no DOM, Node, or NativeScript APIs | Pass | `pnpm verify:portable:imports` scans non-test portable source and passes. |
| Stories run on Windows without a device | Pass | Counter and three Todo flows run under Vitest/Node. |
| Invalid Messages and Commands fail at boundaries | Pass | Focused tests cover invalid Message decode, invalid Command decode/emission, mismatched resolution, and invalid completion tag. |
| Transition traces are deterministic | Pass | The same Todo Story produces byte-identical canonical JSON; replay validates snapshots, Commands, and fingerprints. |
| Public API is documented from examples | Pass | The Phase 2 API guide uses the executable Counter/Todo API and describes every Story step. |

## Implemented behavior

- Program identity and schemas for Flags, Model, Message, and Command.
- Pure synchronous `init` and `update`.
- Frozen tagged value and ordered Transition constructors.
- Exhaustive Command-tag to completion-Message-tag contracts.
- Renderer-neutral Dispatcher and ApplicationHandle types.
- Story origins from Flags or Model snapshots.
- Exact/partial Model and exact Command expectations.
- Explicit Command resolution without effect execution.
- Structural diffs with paths such as `$.draft`.
- Canonical full-snapshot traces and portable SHA-256 fingerprints.
- Offline replay with first-divergence reporting.
- Counter and Todo success/failure/retry examples.

## Test inventory

The portable suite contains:

```text
@orikit/spike-core   14 tests
@orikit/spike-trace   3 tests
@orikit/story        14 tests
total                    31 tests
```

The Story tests specifically prove:

- deterministic Counter and Todo behavior;
- byte-identical repeated traces;
- readable exact and nested partial assertions;
- invalid Message and emitted Command rejection;
- completion-contract and pending-command matching;
- emitted Commands remain inert;
- replay from Flags and Model snapshots;
- first-property divergence and fingerprint divergence.

## Commands and results

```text
PASS: pnpm verify:portable
PASS: pnpm verify:web
PASS: pnpm verify:android
PASS: pnpm lint
PASS: pnpm verify:docs
```

Android device interaction was not required because Phase 2 changes only
portable packages and no native behavior. The Android build is a regression
check, not a new native-behavior claim. The first build invocation in a fresh
shell failed before compilation because `ANDROID_HOME` and `JAVA_HOME` were
not inherited. The same command passed after setting them for the process to
the already documented Android Studio SDK and JBR paths.

iOS remains not run because Windows cannot execute Xcode.

## Time-travel boundary

Phase 2 records schema-decoded Models and fingerprints at every transition.
Those snapshots can be selected later without rerunning Commands. The current
`replayStory` API has no interpreter parameter, so effect execution during
replay is structurally unavailable.

Phase 7 still owns bounded history, redaction, transport, historical renderer
selection, and Resume. Phase 4 must add command/session/branch IDs before
production concurrency.

## Remaining gates before Phase 3

Phase 2 satisfies its portable exit criteria, but ADR-0001 follow-ups still
apply:

1. Closed: attaching to the running physical app now produces a Chrome
   DevTools URL on local port 40000, and the forwarded endpoint accepts a TCP
   connection.
2. Closed for Phase 3 entry: with TalkBack active, labeled native controls
   were exposed, disabled transition controls were non-focusable and skipped,
   and Resume restored the live state. UI Automator's `enabled=true` value
   remains a documented serialization caveat.
3. Accepted implementation constraint: use persistent controls and
   keyed/differential Todo row updates, not the Phase 1 history rebuild.
4. Explicitly deferred by the roadmap: iOS remains not run until macOS
   evidence and no cross-platform-complete claim may be made before it.
