# 16. FoldKit capability parity

This matrix prevents "same architecture" from gradually meaning only a
reducer and a Store.

## 16.1 Parity levels

- **Equivalent:** same developer capability and semantics.
- **Adapted:** same architectural purpose with platform-specific mechanics.
- **Platform-owned:** intentionally delegated to native frameworks.
- **Deferred:** not required for the first release.

## 16.2 Capability matrix

| FoldKit capability | OriKit plan | Level | Target phase |
|---|---|---|---:|
| One Model | Immutable KMP Model | Equivalent | 1 |
| Messages | Serializable sealed unions | Equivalent | 1 |
| Pure update | Synchronous deterministic function | Equivalent | 1 |
| Commands | Serializable descriptions + handlers | Equivalent | 3 |
| Init and flags | Shared `init(flags)` | Equivalent | 1 |
| Story tests | Common deterministic interpreter | Equivalent | 2 |
| Scene tests | Shared scenario, native adapters | Adapted | 11 |
| Submodels | Feature composition + OutMessages | Equivalent | 10 |
| Subscriptions | Model-keyed Flow lifecycle | Equivalent | 9 |
| Managed resources | Scoped Flow/coroutine acquisition | Adapted | 9 |
| Routing | Shared Route state + native navigator | Adapted | 4/5 |
| Field validation | Shared value/rule/state library | Equivalent | 10 or separate |
| Async data | Shared sealed state and combinators | Equivalent | 4 |
| DevTools timeline | Shared event protocol | Equivalent | 7 |
| Time travel | Snapshot/replay/branch runtime | Equivalent | 8 |
| DevTools MCP | Cross-platform protocol server | Equivalent | 12 |
| Ports/embedding | Platform controller/handle | Adapted | 4/5 |
| Crash reporting | Shared crash context + native view | Adapted | 3/4 |
| Slow warnings | Runtime phase metrics | Equivalent | 3/7 |
| HMR/model preservation | Toolchain-dependent reload/restoration | Adapted/deferred | post-0.2 |
| Accessible UI primitives | Compose/SwiftUI/FoldKit UI | Platform-owned | 4/5 |
| Virtual DOM | FoldKit web only | Platform-owned | 5 |
| Mount/custom elements/canvas | Platform-specific integration points | Platform-owned | as needed |

## 16.3 Routing

Required shared pieces:

```kotlin
@Serializable
sealed interface Route {
    data object TodoList : Route
    data class TodoDetails(val id: TodoId) : Route
}
```

Required behavior:

- Parse deep links into typed routes/messages.
- Build web URLs from shared routes.
- Map routes to Compose navigation and SwiftUI navigation.
- Treat invalid routes consistently.
- Preserve native back behavior.
- Test route parse/build and shared navigation transitions.

Do not try to share native navigation-controller state.

## 16.4 Field validation

Provide common values:

```kotlin
sealed interface FieldState<out Value, out Problem> {
    data class Pristine<Value>(val value: Value) : FieldState<Value, Nothing>
    data class Valid<Value>(val value: Value) : FieldState<Value, Nothing>
    data class Invalid<Value, Problem>(
        val value: Value,
        val problems: List<Problem>,
    ) : FieldState<Value, Problem>
    data class Validating<Value>(val value: Value) : FieldState<Value, Nothing>
}
```

Rules:

- Synchronous validation runs in update.
- Async validation returns a Command.
- A completion Message includes the value/version it validated.
- Stale async results are ignored.
- Native views decide how and when to present errors, while shared state
  decides whether the value is valid.

## 16.5 Async data

Create a small common algebra rather than one-off booleans:

```text
NotAsked
Loading(previous?)
Success(value, freshness)
Failure(problem, previous?)
```

Do not force every product to use one UI presentation. This is shared state,
not a shared loading component.

## 16.6 Embedding

Web:

- Existing FoldKit `Runtime.embed` remains the host integration.
- Shared KMP program sits behind the FoldKit adapter.

Android:

- Expose a runtime/controller that can be owned by an Activity, Fragment,
  navigation graph, or host application.
- Optionally provide a Compose `OriKitHost` convenience wrapper.

iOS:

- Expose a feature controller and Swift observable wrapper.
- Host can place the SwiftUI view anywhere or wrap it in UIKit.

All embedding handles support:

- Initial flags
- Input Messages/ports
- Output facts
- Model observation
- Explicit disposal

## 16.7 HMR and state preservation

Exact FoldKit Vite HMR cannot be replicated uniformly:

- Web keeps FoldKit/Vite state-preserving HMR.
- Android can use normal Compose previews/live edit where supported.
- Kotlin/Compose hot reload support varies by target and toolchain.
- SwiftUI previews and Xcode injection/rebuild behavior differ.

OriKit can provide a portable development restoration mechanism:

1. Encode current debug Model.
2. Rebuild/restart target.
3. If Program identity and schema are compatible, restore the Model.
4. Reconcile subscriptions.
5. Do not restore active Commands.

This is slower than true HMR but preserves the important model continuity.
Treat platform hot-reload integration as an optimization, not a core runtime
guarantee.

## 16.8 Native UI components

OriKit will not create a cross-platform button/dialog/menu library.

- Web uses `@foldkit/ui`.
- Android uses Compose Material or product design-system components.
- iOS uses SwiftUI and the product's Apple design system.

The shared layer may define semantic roles and identifiers needed by tests,
but not colors, paddings, or widget implementations.

## 16.9 Parity acceptance

For each capability marked Equivalent or Adapted:

1. Provide one canonical example.
2. Provide one failure-mode example.
3. Add Story or runtime contract tests.
4. Demonstrate on all applicable targets.
5. Document intentional differences from FoldKit.

