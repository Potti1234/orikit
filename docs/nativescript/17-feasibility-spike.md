# 17. NativeScript feasibility spike

## 17.1 Purpose

This is the first implementation task. It answers whether NativeScript is a
sound foundation before building Todo, a renderer framework, or public
packages.

Timebox recommendation: five focused working days for Android, followed by the
same compatibility vector on iOS as soon as macOS is available.

The timebox limits scope, not verification quality.

## 17.2 Non-goals

Do not implement:

- Todo.
- General navigation.
- Shared web/native UI AST.
- Production DevTools.
- Full Story API.
- Multiple native plugins.
- KMP.
- A compiler.
- React/Vue/Angular.

## 17.3 Repository shape

Minimum:

```text
apps/
├── web-spike/
└── mobile-spike/
packages/
├── spike-core/
└── spike-trace/
```

The core package must not import DOM or NativeScript.

## 17.4 Dependency experiment

Pin:

- NativeScript CLI/runtime versions.
- TypeScript.
- Vite integration if used.
- `effect@4.0.0-beta.102` to match current Foldkit 0.133.0.

Do not install the root `foldkit` package in mobile initially. It declares
browser peer dependencies. Reuse browser-independent source only after
proving each import.

## 17.5 Counter domain

```ts
const Model = Schema.Struct({
  count: Schema.Number,
})

const Incremented = message("Incremented")
const Decremented = message("Decremented")
const Reset = message("Reset")

const Message = Schema.Union([
  Incremented,
  Decremented,
  Reset,
])
```

Update:

```ts
const update = (model, message) =>
  Match.value(message).pipe(
    Match.tagsExhaustive({
      Incremented: () => [{ count: model.count + 1 }, []],
      Decremented: () => [{ count: model.count - 1 }, []],
      Reset: () => [{ count: 0 }, []],
    }),
  )
```

## 17.6 Gate A — portable Effect primitives

Run on Node and Android:

- Schema encode.
- Schema decode.
- Invalid decode.
- Tagged Union.
- Match exhaustive update.
- Effect sync.
- Effect async/Promise.
- Sleep/test clock behavior used by the planned runtime.
- Scope acquire/release.
- Fiber interruption or selected cancellation path.
- Stream used for one subscription.

Output a machine-readable matrix:

```json
{
  "runtime": "android",
  "checks": {
    "schema": "pass",
    "match": "pass",
    "scope": "pass",
    "stream": "pass",
    "interruption": "pass"
  }
}
```

Fail condition:

- Schema or Match cannot operate reliably.
- Fix requires pervasive runtime emulation.

Partial condition:

- Core works but a platform service does not. Isolate it and decide whether
  the portable interpreter can avoid it.

## 17.7 Gate B — native controls

Create:

- NativeScript `Page`.
- `StackLayout`.
- `Label`.
- Increment/Decrement/Reset `Button`s.

Verify:

- Underlying Android classes.
- Button events.
- Label update.
- No WebView root.
- Accessibility names.

Evidence:

- Screenshot.
- View/accessibility hierarchy.
- Source mapping.

## 17.8 Gate C — serialized runtime

Implement only:

- Queue.
- Current Model.
- Dispatch.
- Update.
- Observer.
- History array.

Tests:

- Increment sequence.
- Nested dispatch.
- 1,000 quick taps/messages.
- Invalid Message rejection at development boundary.
- Observer does not mutate Model.

## 17.9 Gate D — history and travel

Record every Message and Model.

UI:

- Display history sequences in a simple debug section.
- Selecting one changes visible count.
- Buttons are disabled while inspecting.
- Resume returns to live head.

No Commands are necessary for this gate.

## 17.10 Gate E — direct native API

Read a harmless Android value directly from TypeScript, such as:

- Device model.
- SDK version.
- Battery state if simple and permission-free.

Convert the result into a typed completion Message rather than mutate the
screen directly.

## 17.11 Gate F — Kotlin wrapper

Add one Kotlin class:

```kotlin
class NativeGreeting {
    fun value(): String = "Hello from Kotlin"
}
```

Requirements:

- Kotlin version explicitly configured.
- TypeScript declaration generated or hand-reviewed.
- No stable `any`.
- Called from platform interpreter.
- Result becomes Message.

The trivial wrapper proves build and interop mechanics; later capabilities
prove real value.

## 17.12 Gate G — web equivalence

Use the same core Model, Message, and update in a minimal web page or Foldkit
adapter.

Execute:

```text
Incremented
Incremented
Decremented
Reset
Incremented
```

Node, web, and Android write canonical trace files. Compare them byte-for-byte
after excluding target metadata.

## 17.13 Gate H — rebuild and developer loop

Verify:

- Clean install.
- Incremental TypeScript change.
- NativeScript sync/HMR path.
- Runtime error display and recovery.
- Breakpoint or useful source-mapped stack trace.
- Log capture.

Record measured durations:

- Cold clean build/install.
- Incremental logic change.
- Incremental native Kotlin change.

## 17.14 Android device procedure

After [setup](14-windows-android-setup.md):

```powershell
adb devices -l
ns doctor android
pnpm verify:portable
pnpm verify:android
pnpm verify:android:device
```

Device currently expected:

```text
Samsung Galaxy S20 FE
```

Record Android version/API at runtime rather than assuming from the model.

## 17.15 Required output

```text
artifacts/feasibility/
├── environment.json
├── effect-node.json
├── effect-android.json
├── trace-node.json
├── trace-web.json
├── trace-android.json
├── android-view-tree.txt
├── android-logcat.txt
├── screenshot.png
└── result.md
```

Do not commit private device serials, usernames, tokens, or broad logs
containing unrelated personal information.

## 17.16 Decision table

Accept NativeScript provisionally when:

- Gates A–H pass on Android.
- No browser runtime dependency enters mobile.
- Native controls and Kotlin interop are real.
- Performance is plausible.
- Failures are ordinary implementation work, not fundamental runtime gaps.

Reject or pause when:

- Schema/Match fail.
- iOS later produces a fundamental incompatible result.
- Native control reconciliation cannot preserve basic state.
- Tooling prevents useful source-level debugging.
- Required OS minimums violate the product policy.

## 17.17 ADR

End with:

```text
docs/adr/0001-nativescript-feasibility.md
```

It contains:

- Exact versions.
- Host/device.
- Each gate.
- Performance.
- Workarounds.
- Accepted limitations.
- Provisional accept/reject decision.
- Mandatory iOS follow-up.

## 17.18 Stop condition

After the ADR, stop. Do not begin Todo until the user or active task authorizes
Phase 2/3 based on the evidence.
