# 9. Step-by-step implementation roadmap

## How to use this roadmap

Implement phases in order. A phase is complete only when its exit criteria
pass. Do not begin compiler work while core runtime or Swift ergonomics remain
unproven.

Every implementation change should include:

- Focused tests
- Relevant documentation update
- No unrelated refactor
- Verification commands recorded in the change

## Phase 0 — repository and toolchain

### Objective

Create a reproducible KMP monorepo with no framework behavior yet.

### Steps

1. Initialize Git and add `.gitignore` and `.editorconfig`; retain the accepted
   MIT license.
2. Create Gradle wrapper and Kotlin DSL root build.
3. Add a version catalog.
4. Pin compatible Kotlin, Gradle, AGP, coroutines, serialization, KSP, and
   Detekt versions.
5. Add `packages:core` with JVM, JS, Android, iOS device, and iOS simulator
   targets.
6. Add `packages:core` common and per-target smoke tests.
7. Add a tiny Kotlin/JS library export and compile it.
8. Add an Android empty Compose application.
9. Add an iOS empty SwiftUI application with direct KMP integration.
10. Add CI fast lane and macOS native lane.
11. Add `AGENTS.md` from the architecture rules.
12. Add dependency-update policy: upgrades only in dedicated changes.
13. Set Android `minSdk` to 23 and add API 23/29/current test devices.
14. Set the iOS deployment target to 15.
15. Document evergreen-browser test versions.
16. Add the independent-project disclaimer to public package metadata.
17. Implement the host-aware `doctor` command and the stable verification
    aliases specified in
    [Development environment and self-verification](18-development-environment.md).
18. Add Ubuntu, Windows, Android emulator, and macOS CI lanes.
19. Add canonical cross-platform smoke artifacts and a comparison job.

### Deliverables

- Reproducible builds
- Target matrix document
- Empty apps compiling
- CI artifact/report retention

### Exit criteria

- JVM and JS tests pass on a non-macOS worker.
- Android debug app builds.
- iOS simulator app builds on macOS.
- Swift imports one Kotlin function successfully.
- No experimental Swift export dependency.
- Android app installs on API 23 and API 29 emulators.
- License and independent-project status are visible.
- `doctor` correctly distinguishes applicable, failed, and unavailable host
  capabilities.
- Root verification aliases work without knowledge of module task names.
- CI conformance output matches on JVM, JS, Android, and iOS.

## Phase 1 — pure core API

### Objective

Implement the contracts in [core API](03-core-api.md) without coroutines.

### Steps

1. Implement `ProgramIdentity`.
2. Implement `Program`.
3. Implement `Next` and `next`.
4. Implement `Dispatcher` and observation interfaces without concrete runtime.
5. Implement Runtime status value types.
6. Add API documentation and code examples.
7. Add binary/API dump tooling where supported.
8. Create a pure Counter Program.
9. Test exhaustive Message handling by compile-test fixture.
10. Verify all declarations compile for every target.

### Exit criteria

- `core` has no coroutine, serialization, or platform dependency.
- Counter update is deterministic and fully tested.
- Public API dump is checked in.
- Swift build can see only the intended facade types.

## Phase 2 — Story test interpreter

### Objective

Prove the programming model before building the production runtime.

### Steps

1. Add `packages:story`.
2. Implement Story initialization.
3. Implement `send`.
4. Capture ordered Commands.
5. Implement exact and partial Model assertions.
6. Implement `expectCommand`, `expectCommandsExactly`, and
   `expectNoCommands`.
7. Implement command selection by value and index.
8. Implement `resolve`.
9. Implement readable transition traces.
10. Add snapshot/golden support.
11. Add Todo Program and representative Stories.
12. Run Stories on JVM, JS, and iOS simulator.

### Exit criteria

- Todo loading, add, delete, failure, and retry Stories pass.
- Story tests never execute real effects.
- Failure output identifies the exact transition and diff.
- Cross-backend serialized results are equivalent.

## Phase 3 — production runtime MVP

### Objective

Implement one serialized dispatch loop and command execution.

### Steps

1. Add `packages:runtime` with coroutines.
2. Implement application scope ownership.
3. Implement thread-safe non-suspending dispatch queue.
4. Implement initialization transition.
5. Implement single-message reduction.
6. Publish Model via read-only `StateFlow`.
7. Implement command scheduling after commit.
8. Add command IDs and causal sequence numbers.
9. Dispatch terminal command Messages.
10. Implement disposal.
11. Implement crash policy and status.
12. Instrument basic timings.
13. Run runtime contract tests on JVM and JS.
14. Run concurrency/cancellation tests on iOS simulator.

### Exit criteria

- 10,000 concurrent dispatch requests produce a valid ordered history with no
  lost Messages.
- Slow observers do not block update.
- Disposing cancels active command jobs.
- Expected failures are Messages; defects crash visibly.
- Core API remains free of coroutines.

## Phase 4 — Android and iOS vertical slice

### Objective

Render the Todo Program with genuinely native UIs.

### Android steps

1. Create `TodoViewModel`.
2. Bind Model to Compose.
3. Dispatch UI Messages.
4. Implement native list, form, navigation, errors, and retry.
5. Implement fake/in-memory command ports.
6. Add Compose semantic IDs.
7. Add Compose UI tests.
8. Test recreation and restoration policy.

### iOS steps

1. Create feature-specific Kotlin controller facade.
2. Create `@MainActor ObservableObject` wrapper.
3. Bind Model to SwiftUI.
4. Dispatch UI Messages.
5. Implement native list, form, `NavigationStack`, errors, and retry.
6. Implement fake/in-memory Swift or `iosMain` ports.
7. Add accessibility identifiers.
8. Add XCTest UI tests.
9. Test controller disposal and retain-cycle behavior.

### Exit criteria

- Both apps use platform-native controls and navigation.
- No shared UI tree exists.
- Same Todo Stories drive shared behavior.
- Native accessibility inspection passes.
- iOS has no leaked controller after repeated open/close.
- Android survives configuration recreation.

## Phase 5 — FoldKit web adapter

### Objective

Use the same shared Program in a real FoldKit web application.

### Steps

1. Add Kotlin/JS export module.
2. Export a flat JSON facade.
3. Define canonical JSON discriminators.
4. Build an Effect Schema decoder for the exported Model.
5. Map FoldKit UI Messages into shared Messages.
6. Map shared Commands to web handlers.
7. Ensure only one authoritative reducer.
8. Add FoldKit Story-equivalence vectors.
9. Add FoldKit Scene tests for critical UI flow.
10. Measure bundle size and dispatch cost.
11. Document limitations of JSON boundary.

### Exit criteria

- One shared behavior implementation serves all three targets.
- Web UI remains normal FoldKit DOM code.
- Invalid shared payloads fail at the adapter boundary.
- Todo cross-backend conformance fixtures match.

## Phase 6 — serialization and program manifests

### Objective

Create reliable runtime metadata and schema versioning.

### Steps

1. Add serialization module and JSON codecs.
2. Standardize sealed-type discriminator.
3. Add schema version to Program identity.
4. Define canonical JSON and fingerprint algorithm.
5. Add annotations for Model, Message, Command, sensitive fields, semantic IDs,
   and command completion.
6. Implement KSP manifest generation.
7. Generate registry wiring.
8. Add golden tests for every output.
9. Add migration interface and incompatible-version error.
10. Generate initial TypeScript declarations/Effect Schema metadata.

### Exit criteria

- Round-trip and canonical fingerprint tests pass on every target.
- Stale generated output fails CI.
- Sensitive fields are identified in the manifest.
- An incompatible history file is rejected with a useful error.

## Phase 7 — event history and basic DevTools

### Objective

Make every transition inspectable.

### Steps

1. Add `devtools-protocol`.
2. Add lossless runtime event tap.
3. Record Message source and causal IDs.
4. Record before/after fingerprints and Commands.
5. Add periodic snapshots.
6. Implement in-memory bounded history.
7. Implement redaction.
8. Implement export/import.
9. Build a minimal browser inspector.
10. Build debug-only Android and iOS inspectors or a shared remote inspector
    connection.
11. Add performance overhead benchmarks.

### Exit criteria

- Every transition can be inspected on all targets.
- Event history does not rely on StateFlow emissions.
- Secret test fixtures never appear in exports.
- History truncation remains replayable.
- Debug overhead stays within the verification budget.

## Phase 8 — time travel

### Objective

Implement safe inspect, resume, and branch semantics.

### Steps

1. Implement Runtime modes.
2. Capture live head on travel.
3. Pause publication of live changes.
4. Cancel/quarantine active Commands.
5. Cancel Subscriptions.
6. Reconstruct Model from snapshot and Messages.
7. Compare replay fingerprints and Commands.
8. Publish inspection Model.
9. Implement cursor movement and cache.
10. Implement resume-live.
11. Implement branch-from-history.
12. Reject stale command completions by session/branch/command ID.
13. Add divergence diagnostics.
14. Execute the common replay fixture on every target.

### Exit criteria

- No historical Command executes.
- Late callbacks cannot alter an inspection or wrong branch.
- Resume restores the exact captured live head.
- Branch produces a new valid live history.
- Cross-platform replay matches every expected fingerprint.

## Phase 9 — Subscriptions and managed resources

### Objective

Support sockets, timers, sensors, and lifecycle-bound streams.

### Steps

1. Define Subscription ID and key.
2. Add Program subscription provider.
3. Implement identity/key diffing.
4. Start/cancel Flow collection.
5. Add subscription event sources to history.
6. Add timer and fake websocket examples.
7. Verify resource cleanup with `awaitClose`.
8. Integrate travel-mode cancellation.
9. Add restart and defect tests.

### Exit criteria

- Unrelated Model changes do not restart subscriptions.
- Key changes restart exactly once.
- Disposal and travel close resources.
- Subscription Messages are causally identified.

## Phase 10 — feature composition

### Objective

Scale from one program to multiple independently testable features.

### Steps

1. Define Feature contract.
2. Define child Message and Command mapping.
3. Implement OutMessages.
4. Implement Model get/set lens contract.
5. Add composition helpers with explicit names.
6. Add nested Story scopes.
7. Add DevTools feature paths.
8. Build Auth + Todo parent example.
9. Test command and OutMessage ordering.

### Exit criteria

- Parent does not depend on child-internal Messages.
- No child Command is dropped or duplicated.
- DevTools can filter by feature path.
- Story traces retain parent/child context.

## Phase 11 — shared Scene scenarios

### Objective

Run equivalent user journeys through native UIs.

### Steps

1. Finalize minimal YAML/JSON scenario schema.
2. Define stable semantic IDs.
3. Implement FoldKit adapter.
4. Implement Compose adapter.
5. Implement XCTest generator/adapter.
6. Add fixture/reset mechanism.
7. Add artifact collection on failure.
8. Run three critical Todo journeys in CI.

### Exit criteria

- One scenario definition runs on all platforms.
- Failures include screenshot/tree/trace artifacts where available.
- Adapter-specific behavior is documented rather than hidden.

## Phase 12 — MCP and AI tooling

### Objective

Give agents structured runtime and project access.

### Steps

1. Implement read-only MCP tools.
2. Add schema discovery.
3. Add explicit development-only mutation mode.
4. Implement dispatch validation.
5. Implement travel/resume/branch tools.
6. Implement Story catalog and execution.
7. Create CLI scaffolding.
8. Create `doctor`.
9. Create canonical Codex/agent skill.
10. Test an agent feature task from a clean context.
11. Measure success rate and common deviations.

### Exit criteria

- Read-only mode cannot mutate runtime.
- Mutating tools are disabled by default.
- Agent can discover valid Messages without reading source.
- A clean-context agent completes the benchmark feature and all checks.

## Phase 13 — hardening and release

### Steps

1. Threat-model DevTools/MCP and history exports.
2. Run performance and memory benchmarks.
3. Test app background/foreground and process restoration.
4. Test cancellation against real SDK-shaped fakes.
5. Add API and protocol compatibility tests.
6. Verify Gradle configuration cache.
7. Produce sample XCFramework and npm adapter artifacts.
8. Write migration and troubleshooting guides.
9. Run two external pilot applications.
10. Resolve all blocking decisions.
11. Tag `0.1.0` only after acceptance matrix passes.

## Explicitly deferred

- Arbitrary TypeScript translation
- Fold IR authoring language
- Compiler purity enforcement
- Shared UI renderer
- Production remote DevTools service
- Persisted active continuations

The staged example gallery proceeds alongside phases after Todo. It must not
delay runtime exit criteria. See
[Example application strategy](17-example-applications.md).
