# ADR-0001: Provisional NativeScript feasibility decision

## Status

Accepted provisionally for Phase 2 portable-contract work on 2026-07-29.

This ADR does not authorize Todo, a general renderer, public packages, or a
claim of verified iOS support.

## Context

OriKit needs Foldkit-style Elm correctness while rendering real native
Android and iOS controls. Phase 1 tested whether vanilla NativeScript
TypeScript can host the browser-independent state machine, Effect primitives,
history, direct platform APIs, and narrow Kotlin interop.

The experiment used:

- Node 26.4.0 and pnpm 11.17.0 on Windows 11 x64.
- TypeScript 5.9.3.
- Effect 4.0.0-beta.102.
- NativeScript CLI 9.0.6, Core 9.0.20, and Android runtime 9.0.5.
- Kotlin 2.2.20.
- A physical Samsung SM-G781B running Android 13 / API 33.
- Android `minSdkVersion` 24 and `targetSdkVersion` 35.

The detailed evidence is in
[Phase 1 Android evidence](../evidence/phase1-feasibility.md). Local,
machine-readable captures are generated under `artifacts/feasibility/`.

## Gate results

| Gate | Status | Finding |
|---|---|---|
| A — Effect primitives | Pass | Node, Chromium, and Android each passed 10/10 Schema, Match, Effect, TestClock, scope, interruption, and Stream checks. |
| B — native controls | Pass | The physical-device hierarchy contains Android `Button`, `TextView`, and layouts, accessible names, and no WebView. |
| C — serialized runtime | Pass | FIFO and nested dispatch tests pass; 10,000 queued Messages are retained; invalid input is rejected; observer mutation is blocked. |
| D — history/travel | Pass with accessibility caveat | Historical 1 renders while live remains 2; taps are blocked while inspecting; Resume restores live 2. Native Android introspection reports disabled controls, but UI Automator serializes `enabled="true"`. |
| E — direct native API | Pass | Android model and SDK are read in an `.android.ts` adapter and re-enter as a typed Message. |
| F — Kotlin wrapper | Pass | A Kotlin class compiles, is called through a reviewed declaration without `any`, and returns through a typed Message. |
| G — web equivalence | Pass | Node, Chromium, and Android canonical traces are byte-identical: 1,056 bytes and five events. |
| H — developer loop | Partial | Clean and incremental builds pass, but CLI debug attach produced no endpoint before timeout and raw logcat stacks point to bundled JavaScript rather than TypeScript source. |

## Performance observations

These are debug-spike measurements, not product guarantees:

| Measurement | Result | Interpretation |
|---|---:|---|
| Pure update p95, Node, 20,000 samples | 0.0028 ms | Passes the 1 ms investigation target. |
| Android render p95, 8 samples | 53.625 ms | Misses the 8 ms native-patch target. |
| Cached time-travel selection and render | 35.973 ms | Passes the 50 ms investigation target. |
| Android cold launch | 1,883 ms | Recorded baseline. |
| Debug APK | 104,193,314 bytes | Large debug baseline; release size was not measured. |
| Debug process total PSS | 177,901 KB | Single short-session baseline only. |
| Clean Android build | 48.285 s | Includes webpack, Gradle clean, and rebuild. |
| Warm Android build/install verification | 16.753 s build, 4.428 s install | Measured by the device script. |
| Incremental Kotlin build | 31.593 s | Includes webpack and Gradle. |

The spike intentionally rebuilds every history button during every render.
That implementation explains much of the patch cost and must not become the
production renderer. Phase 3 needs keyed/differential rendering or another
equally small native update strategy before performance can pass.

## Decision

Continue with NativeScript as the provisional native host for Phase 2 only.

Phase 2 may stabilize the portable Program, Story, schema, trace, and replay
contracts because those parts are already independently verified on Node,
web, and Android. NativeScript remains a renderer and capability runtime; it
does not own domain state.

Do not start Todo or a reusable renderer until a short follow-up closes or
explicitly accepts these items:

1. Obtain a usable source-level Android debugging workflow or document a
   reliable alternative.
2. Resolve the UI Automator disabled-state discrepancy and test with TalkBack.
3. Design the Phase 3 vertical slice so it does not rebuild the history/control
   subtree for a simple count update.
4. Run the same compatibility vector on macOS/iOS, including a Swift wrapper,
   before any cross-platform support claim.

Follow-up on 2026-07-30:

- Item 1 is closed. With the app running, `ns debug android --start` reported
  a Chrome DevTools inspector URL on local port 40000. The ADB forward existed
  and the local TCP endpoint accepted a connection. The CLI process must stay
  running for an interactive session.
- Item 2 is closed for the bounded spike on 2026-07-30. With Samsung TalkBack
  bound as a spoken-feedback service, the app exposed labeled native controls,
  time travel preserved historical 1/live 2, all transition buttons became
  non-focusable, reverse focus navigation skipped them and selected `Resume
  live state`, and Resume restored live 2. Native introspection still reported
  `enabled=false`, `clickable=false`, and `focusable=false`. UI Automator
  continued to serialize `enabled=true`, but now also serialized
  `focusable=false`; the mismatch is therefore retained as a tooling caveat
  rather than evidence that the control remained operable.
- Item 3 is the Phase 3 implementation constraint: keep controls persistent
  and update only changed properties/keyed Todo rows. Do not promote the Phase
  1 history rebuild into a reusable renderer.
- Item 4 remains mandatory before an iOS or complete cross-platform claim; the
  roadmap deliberately schedules that execution on macOS in Phase 10.

## Consequences

- Shared Model, Message, pure update, history, and traces stay in portable
  TypeScript.
- Android and future iOS views remain separate native views during the next
  vertical slice.
- Kotlin and Swift boundaries stay narrow, typed, and platform-specific.
- No Foldkit root package is installed on mobile.
- Effect's type declarations currently require DOM library types during
  compilation even though the portable source imports no DOM API.
- Vite warns that Effect's testing module references `node:assert`; the actual
  Chromium vector still passes 10/10. Keep this in the compatibility test.
- Android logcat trace payloads must be chunked and reconstructed because long
  JavaScript console lines are truncated.
- The current history UI and runtime are spike code, not a public framework.

## Alternatives considered

- Kotlin Multiplatform remains the fallback if iOS, renderer behavior, or the
  developer workflow fails the follow-up.
- A TypeScript-to-Kotlin compiler remains rejected until a new ADR; the spike
  shows it is unnecessary for portable business logic.
- React Native and other state/UI frameworks remain outside scope because they
  would obscure the Elm runtime experiment and violate the vanilla
  NativeScript gate.
- Running Foldkit's DOM runtime unchanged on mobile remains infeasible because
  it is browser-oriented.

## Verification

Passed:

```text
pnpm lint
pnpm verify:portable
pnpm verify:web
pnpm verify:android:device
pnpm verify:traces
pnpm --filter @orikit/mobile-spike exec ns build android --clean --no-hmr
```

Browser behavior was exercised in Chromium with two increments, historical
selection, disabled transition controls, and Resume. It ended at live count 2
with no console errors.

Not run:

- iOS build, simulator, device, native controls, Effect vector, or Swift
  wrapper. A Mac and Xcode are still required.
- Firefox and WebKit browser vectors.
- TalkBack.
- Release APK size and release performance.
- Long-session memory and 1,000-item scrolling, which are not meaningful for
  this bounded Counter spike.

Blocked/partial:

- `ns debug android --start --no-watch` and a normal debug deployment did not
  produce a usable debugging endpoint before 45-second and 180-second
  timeouts.
- Android native calls report disabled buttons, while UI Automator reports
  them enabled. Functional blocked-tap behavior passes.

The debugger item above describes the original Phase 1 result. The 2026-07-30
follow-up now supplies a usable endpoint and supersedes that particular
partial result.

The UI Automator `enabled` mismatch also remains documented, but the
TalkBack-active follow-up showed that disabled transition controls are removed
from focus navigation and cannot intercept the path to Resume. This closes the
Phase 3 entry check, not the later production accessibility review.

## Reversal conditions and cost

Reconsider NativeScript and compare the KMP fallback if:

- the iOS Effect or native-control vector fundamentally fails;
- native reconciliation cannot meet basic focus, state, and performance
  requirements;
- source-level debugging remains unusable after a focused investigation;
- accessibility state cannot be made correct for production controls; or
- required Android/iOS minimum versions violate the product support policy.

Reversal cost is currently low because Phase 1 contains only a Counter spike,
portable fixtures, and narrow platform adapters.
