# 10. Step-by-step implementation roadmap

## 10.1 Rules

Implement phases in order. A phase is complete only when its exit criteria
have evidence.

Every phase includes:

- Focused source.
- Tests.
- A running example or fixture.
- Documentation updates.
- Exact verification commands.
- An ADR for material deviations.

Do not begin a later framework abstraction to avoid finishing an earlier
vertical slice.

## Phase 0 — workstation and repository baseline

### Objective

Create a reproducible TypeScript/NativeScript monorepo and prove the connected
Android device can receive a stock NativeScript application.

### Steps

1. Complete [Windows setup](14-windows-android-setup.md).
2. Pin Node in `.node-version` or equivalent.
3. Pin pnpm in root `package.json`.
4. Install NativeScript CLI as a dev dependency where possible; avoid relying
   only on an unpinned global.
5. Create a pnpm workspace.
6. Decide whether the spike needs Nx; default is no.
7. Create a vanilla NativeScript TypeScript app.
8. Configure NativeScript 9 ESM and Vite only if the template combination is
   stable.
9. Add strict TypeScript configuration.
10. Add formatting, linting, and Vitest.
11. Add `doctor` and stable verification scripts.
12. Run `ns doctor android`.
13. Confirm `adb devices -l` shows the phone as `device`.
14. Run the stock app on the phone.
15. Capture a screenshot and logcat.
16. Add CI portable and Android-build jobs.

### Exit criteria

- Lockfile and tool versions are committed.
- `pnpm doctor` passes Windows-applicable requirements.
- Stock NativeScript app installs and starts on the connected phone.
- The application is not a WebView wrapper.
- Portable typecheck/test commands pass.
- Android debug build can be reproduced from a clean checkout.

## Phase 1 — bounded feasibility spike

### Objective

Answer the go/no-go questions in
[17-feasibility-spike.md](17-feasibility-spike.md).

### Steps

1. Create a portable Counter Model and Message Schema.
2. Run Schema encode/decode on Node.
3. Run the same Schema code inside NativeScript Android.
4. Implement pure update with exhaustive Match.
5. Build the smallest serialized dispatch loop.
6. Render native Label and Button controls.
7. Dispatch Button tap into update.
8. Record Models and Messages.
9. Select a historical Model and re-render it.
10. Call one direct Android API from TypeScript.
11. Add one Kotlin wrapper and generated TypeScript declaration.
12. Write canonical trace output.
13. Compare Node, web, and Android traces.
14. Measure update/render and memory basics.
15. Record every incompatibility.

### Exit criteria

- All mandatory go/no-go gates pass.
- No root Foldkit import or browser service is required on mobile.
- Real Android controls are verified.
- Effect/Schema compatibility result is explicit.
- The implementation scope for Todo is estimable.
- An ADR accepts NativeScript or falls back to KMP.

## Phase 2 — portable Program and Story

### Objective

Stabilize the smallest portable API before building a general renderer.

### Steps

1. Add `ProgramIdentity`.
2. Add Program schemas and init/update.
3. Add serializable Command constructors.
4. Add command completion contracts.
5. Add dispatcher and application handle.
6. Implement Story.
7. Implement command expectation and resolution.
8. Implement readable Model/Command diffs.
9. Add Counter and Todo Stories.
10. Add canonical serialization/fingerprints.

### Exit criteria

- Core imports no DOM, Node, or NativeScript APIs.
- Stories run on Windows without a device.
- Invalid Messages and Commands fail at boundaries.
- Transition traces are deterministic.
- Public API is documented from examples.

## Phase 3 — Todo web and native vertical slice

**Status: completed on web and physical Android on 2026-07-30.** See
[Phase 3 evidence](../evidence/phase3-todo-vertical-slice.md). iOS is not part
of this phase's completion claim and remains unverified.

### Objective

Prove shared behavior with separate idiomatic views.

### Steps

1. Implement Todo Model, Messages, Commands, update, and init.
2. Add load/add/edit/toggle/delete/failure/retry Stories.
3. Implement a normal Foldkit web view.
4. Implement a NativeScript native view description.
5. Implement enough native reconciliation for the screen.
6. Add text input and virtualized list.
7. Add in-memory storage interpreter.
8. Add web Scene tests.
9. Add NativeScene tests.
10. Install and exercise Android on the physical device.
11. Capture duplication and pain points.

### Exit criteria

- One update implementation serves web and Android.
- Text focus is stable.
- List row identity/recycling is correct.
- Web and Android traces match.
- Both views pass semantic user-flow tests.
- No portable view AST has been introduced without a decision.

## Phase 4 — production runtime MVP

### Objective

Implement reliable dispatch and effect supervision.

### Steps

1. Replace spike queue with tested runtime.
2. Add session, branch, sequence, and command IDs.
3. Schedule Commands after commit.
4. Add cancellation and stale callback quarantine.
5. Add status and crash policy.
6. Add lifecycle reporting.
7. Add bounded runtime events.
8. Stress dispatch and nested callback behavior.
9. Add runtime performance measurements.

### Exit criteria

- 10,000 dispatch stress vector loses no Messages.
- Nested dispatch remains ordered.
- Dispose cancels work and listeners.
- Late callback cannot mutate a wrong session/branch.
- Runtime defects produce inspectable crash state.

## Phase 5 — Android capability slice

### Objective

Prove direct native access and Kotlin escape hatches in a real feature.

### Candidate capability

Location is preferred because it covers permissions, lifecycle, streaming, and
native callbacks. Camera is acceptable if location cannot be tested reliably.

### Steps

1. Define portable capability and Messages.
2. Implement deterministic fake.
3. Implement direct NativeScript Android API path where practical.
4. Implement a narrow Kotlin wrapper for one necessary operation.
5. Generate strong TypeScript declarations.
6. Add permission state machine.
7. Add cancellation/quarantine tests.
8. Test background/foreground transitions.
9. Test on the physical phone.

### Exit criteria

- Native objects remain outside Model/history.
- Expected failures are typed.
- Denial and permanent denial are represented.
- Late callbacks are quarantined.
- Native boundary has no stable `any`.

## Phase 6 — renderer hardening

### Objective

Turn the Todo renderer into a small reliable framework component.

### Steps

1. Finalize NativeNode types.
2. Implement keyed child reconciliation.
3. Implement property diffing.
4. Implement event lifecycle.
5. Preserve focus, selection, and scroll.
6. Integrate virtualized List.
7. Add custom element adapter.
8. Add accessibility validation.
9. Add renderer benchmarks.
10. Add crash diagnostics.

### Exit criteria

- Renderer contract suite passes.
- Unrelated updates do not recreate stateful controls.
- Removed controls/listeners are disposed.
- Accessibility tree is correct.
- Renderer stays inside performance budgets.

## Phase 7 — DevTools history and remote inspector

### Objective

Make Android runtime behavior inspectable from the Windows machine.

### Steps

1. Implement canonical event records.
2. Add snapshots and bounded history.
3. Add redaction.
4. Define transport protocol.
5. Add debug WebSocket transport.
6. Build browser inspector.
7. Display Message, Model, diff, Commands, and resources.
8. Add travel and resume.
9. Export/import history.
10. Add security and pairing checks.

### Exit criteria

- Connected Android app appears in inspector.
- Historical selection re-renders native UI.
- Live status is unambiguous.
- Redacted fixtures never leave the device.
- Release build has no active inspector endpoint.

## Phase 8 — Subscriptions and managed resources

### Objective

Support ongoing native/browser resources with model-driven lifecycle.

### Steps

1. Implement Subscription ID/key diffing.
2. Add timer fixture.
3. Add WebSocket fixture.
4. Add one Android sensor/location stream.
5. Implement managed resource acquisition/release.
6. Record lifecycle changes.
7. Integrate disposal and time travel.
8. Add defect/restart tests.

### Exit criteria

- Unrelated Model changes do not restart resources.
- Key changes restart once.
- Dispose releases everything.
- Emitted Messages have causal source metadata.

## Phase 9 — view-sharing decision

### Objective

Choose between separate views and a portable view AST using evidence.

### Evidence

- Todo duplication.
- Native divergence.
- Foldkit HTML capabilities.
- Native accessibility requirements.
- Renderer complexity.
- AI benchmark results.

### Options

1. Continue separate `view.web.ts` and `view.native.ts`.
2. Introduce a small portable semantic UI core with platform escape nodes.
3. Share only feature view-model projections, not view descriptions.

### Exit criteria

- Accepted ADR.
- Migration example.
- Explicit non-goals.
- No accidental claim that arbitrary Foldkit HTML is portable.

## Phase 10 — iOS bring-up

### Objective

Run the same Program and native renderer on iOS.

### Steps

1. Complete [iOS setup](15-ios-setup.md).
2. Build NativeScript iOS app on real macOS.
3. Run Counter on simulator.
4. Run Todo on simulator.
5. Verify JavaScriptCore/Effect vectors.
6. Add Swift wrapper and typings.
7. Add iOS renderer adapters and styling.
8. Run accessibility and disposal tests.
9. Run on physical iPhone.
10. Compare canonical traces.

### Exit criteria

- iOS uses real native controls.
- Trace matches Node/web/Android.
- Swift wrapper is strongly typed.
- Repeated mount/dispose shows no retained controller/root.
- Physical-device smoke test passes.

## Phase 11 — feature composition

### Objective

Scale the architecture beyond one Program.

### Steps

1. Add Submodel contract.
2. Add explicit Message and Command mapping.
3. Add OutMessages.
4. Add nested Story support.
5. Add feature paths to DevTools.
6. Build Auth + Todo composition.

### Exit criteria

- Child internals do not leak into parent.
- No Command is dropped or duplicated.
- Story and DevTools traces retain feature context.

## Phase 12 — MCP and agent tooling

### Objective

Give agents safe structured access.

### Steps

1. Add read-only MCP tools.
2. Add schemas and Story catalog.
3. Add explicit development mutation mode.
4. Validate dispatch.
5. Add travel/resume tools.
6. Add `doctor` and scaffold commands.
7. Run AI benchmark tasks from clean context.

### Exit criteria

- Read-only mode cannot mutate.
- Mutation is disabled by default.
- Sensitive fields are redacted.
- Agent completes canonical task with tests and no architecture violations.

## Phase 13 — example parity and release candidate

### Objective

Prove breadth and prepare an honest public release.

### Steps

1. Port examples in [16](16-foldkit-parity-examples.md).
2. Publish compatibility matrix.
3. Complete performance and accessibility reviews.
4. Complete licenses/notices.
5. Stabilize package API.
6. Add migration and contribution guides.
7. Perform security review of inspector/MCP.
8. Create release only with explicit authorization.

### Exit criteria

- Counter, Todo, Forms, HTTP, Auth, navigation, and one native capability pass.
- Support matrix distinguishes exact, adapted, deferred, and browser-only.
- CI covers web, Android, and iOS.
- Public disclaimer and MIT license are present.
- Known limitations are visible.
