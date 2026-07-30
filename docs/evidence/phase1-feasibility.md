# Phase 1 NativeScript feasibility evidence

## Outcome

Recorded on 2026-07-29.

The bounded Android feasibility spike passes the shared correctness, Effect,
native-control, platform API, Kotlin, history, and trace-equivalence gates.
NativeScript is accepted provisionally for Phase 2 portable-contract work.

The decision is deliberately conditional. The developer-debugging workflow is
partial, the spike renderer misses the native-patch performance target, and
Android UI Automator disagrees with direct native introspection about disabled
button semantics. See
[ADR-0001](../adr/0001-nativescript-feasibility.md).

## Implemented slice

```text
apps/
├── mobile-spike/  vanilla NativeScript TypeScript and Kotlin
└── web-spike/     minimal Vite/DOM renderer
packages/
├── spike-core/    Schema Model/Message, pure update, serialized runtime
└── spike-trace/   canonical JSON, SHA-256, shared fixture
tools/
└── feasibility/   Node evidence, Android device flow, trace comparison
```

The portable packages import neither NativeScript nor DOM APIs. UI handlers
dispatch typed Messages. Android/Kotlin results become typed completion
Messages. History contains only portable data. Traveling changes the visible
Model without changing the live head or executing Commands.

## Compatibility vector

Node, Chromium, and Android each passed:

1. Schema encode/decode.
2. Invalid Schema decode rejection.
3. Tagged union payloads.
4. Exhaustive Match update.
5. Synchronous Effect.
6. Promise Effect.
7. TestClock sleep/adjust.
8. Scope acquire/release.
9. Fiber interruption/finalizer.
10. Stream collection.

## Canonical equivalence

All three target files are byte-identical:

```text
Targets: Node, Chromium, Android
Bytes: 1,056
Events: 5
Final fingerprint:
8c4acd9930342f5bfab7be7a4246065664779a475ceafbc83ced461db0918cb7
```

Fixture:

```text
Incremented
Incremented
Decremented
Reset
Incremented
```

## Physical Android flow

Device:

```text
Samsung SM-G781B
Android 13 / API 33
arm64-v8a
```

The automated flow:

1. Builds and clean-installs the debug APK.
2. Waits for 10/10 Android Effect checks.
3. Confirms Android `Button` and `TextView` controls and no WebView.
4. Taps Increment twice and observes count 2.
5. Selects history event 4 and observes historical 1 / live 2.
6. Attempts an Increment while traveling and confirms no state changes.
7. Resumes and observes live count 2.
8. Captures the Kotlin greeting and direct Android device/API result.
9. Writes sanitized logcat, hierarchy, screenshot, memory, and trace evidence.

Kotlin returned:

```text
Hello from Kotlin SM-G781B
```

The TypeScript boundary is hand-reviewed and contains no `any`.

## Runtime tests

Portable tests prove:

- nested dispatch is queued after the current transition;
- 10,000 queued Messages are not lost;
- historical visible state stays separate while the live head advances;
- invalid Messages fail at the boundary;
- disposal rejects later work;
- observers cannot mutate nested Model data;
- canonical key ordering and SHA-256 are stable.

Test result:

```text
4 test files passed
12 tests passed
```

## Performance and size

Debug measurements on the named device/host:

| Measurement | Result |
|---|---:|
| Node pure update p95, 20,000 samples | 0.0028 ms |
| Android render p50 / p95, 8 samples | 22.292 / 53.625 ms |
| Time-travel selection and render | 35.973 ms |
| Cold launch | 1,883 ms |
| Debug process total PSS | 177,901 KB |
| Debug APK | 104,193,314 bytes |
| Clean build | 48.285 s |
| Warm verification build | 16.753 s |
| Install | 4.428 s |
| Incremental Kotlin build | 31.593 s |

The 53.625 ms p95 fails the 8 ms small native-patch investigation target.
This renderer recreates all history buttons on every update and is
intentionally not a general renderer. Input-to-render remains below the
separate 100 ms investigation threshold, and cached time travel remains below
50 ms. Phase 3 must use differential/keyed native updates.

## Commands and results

```text
PASS: pnpm lint
PASS: pnpm verify:portable
PASS: pnpm verify:web
PASS: pnpm verify:android:device
PASS: pnpm verify:traces
PASS: pnpm --filter @orikit/mobile-spike exec ns build android --clean --no-hmr
```

Chromium was also exercised with Playwright CLI:

```text
PASS: Effect checks 10/10
PASS: two increments render 2
PASS: historical event renders 1 while live remains 2
PASS: transition buttons expose disabled semantics while traveling
PASS: Resume restores live 2
PASS: no browser console errors
```

## Findings and workarounds

- pnpm requires explicit NativeScript Android/iOS type packages in the mobile
  workspace because strict isolation prevents the aggregate types package from
  resolving undeclared siblings.
- Kotlin is explicitly enabled and pinned to 2.2.20.
- Android logcat truncates long console messages, so canonical traces are
  emitted in 600-character numbered chunks.
- NativeScript may apply queued control properties after a dynamic layout
  patch. The Android-only adapter reasserts the native state on the next task.
- Direct `android.widget.Button` introspection then reports
  `enabled=false`, `clickable=false`, and `focusable=false`; UI Automator still
  writes `enabled=true`. The blocked-tap behavior passes, but this discrepancy
  requires an accessibility follow-up.
- Vite externalizes Effect testing's `node:assert` reference. Chromium still
  executes and passes the complete 10-check vector.
- Effect's declarations require DOM library types in TypeScript configuration;
  portable source still imports and uses no DOM API.

## Partial and not-run items

| Item | Status | Reason |
|---|---|---|
| NativeScript source-level debug endpoint | Partial | Two CLI attempts timed out without an endpoint. |
| Raw TypeScript stack in logcat | Partial | Runtime error was visible, but locations were `bundle.mjs`; source maps exist for debugger tooling. |
| Disabled accessibility serialization | Partial | Native introspection and behavior pass; UI Automator disagrees. |
| iOS | Not run | Windows has no Xcode; macOS execution is mandatory. |
| TalkBack | Follow-up pass | The 2026-07-30 TalkBack-active check below closes Phase 3 entry; future screens still need review. |
| Firefox/WebKit | Not run | Chromium is the only browser executed in Phase 1. |
| Release performance/size | Not run | The spike uses a debug APK. |

## Local evidence

`pnpm evidence:node` and `pnpm verify:android:device` generate the ignored
files under `artifacts/feasibility/`, including:

```text
environment.json
effect-node.json
effect-web.json
effect-android.json
trace-node.json
trace-web.json
trace-android.json
android-view-tree.xml
android-time-travel.xml
android-resumed.xml
android-logcat.txt
android-meminfo.txt
screenshot.png
```

No private ADB serial is recorded.

## TalkBack-active follow-up

Recorded on 2026-07-30 on the same Android 13 physical device.

Samsung TalkBack was confirmed as the bound accessibility service with spoken,
haptic, and audible feedback plus touch exploration. While it was active:

1. OriKit exposed labeled native nodes for the current count, Increment,
   Decrement, Reset, history entries, and Resume.
2. Native focus activation dispatched through the normal Message/update path
   and changed the count from 0 to 2.
3. Selecting history event 4 rendered historical count 1 while retaining live
   count 2.
4. Native introspection reported all transition buttons as
   `enabled=false`, `clickable=false`, and `focusable=false`.
5. UI Automator still reported `enabled=true`, but reported
   `focusable=false`.
6. Reverse focus navigation from the first history entry skipped all three
   disabled transition buttons and landed on the labeled native
   `Resume live state` button.
7. Activating Resume restored `LIVE` and count 2.
8. TalkBack was disabled afterward. The enabled-services setting became null,
   `accessibility_enabled` became 0, and TalkBack was no longer bound.

This closes the bounded Phase 3 entry check. It does not replace subjective
screen-reader review of the future Todo screen.

Ignored local captures:

```text
talkback-live.xml
talkback-event4-focus.xml
talkback-travel.xml
talkback-skip-disabled.xml
talkback-resumed.xml
talkback-dumpsys.txt
```
