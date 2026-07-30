# 5. Platform integration

## 5.1 Shared sample

The first vertical slice is a Todo application because it exercises:

- Text input and validation
- Lists and stable identity
- Loading, error, and retry
- Persistence
- One interruptible command
- Navigation to details
- Background/foreground behavior
- Story tests and native UI tests

Avoid using only a counter as the architecture proof.

After the vertical slice, build a gallery of focused examples. The complete
catalog and the policy for adapting FoldKit examples are in
[Example application strategy](17-example-applications.md).

## 5.2 Android

### Bootstrap

Create the runtime in an Android `ViewModel` or application-scoped container:

```kotlin
class TodoViewModel(
    savedStateHandle: SavedStateHandle,
    dependencies: AndroidDependencies,
) : ViewModel() {
    private val handle = startTodoProgram(
        flags = flagsFrom(savedStateHandle),
        commandHandler = AndroidTodoCommandHandler(dependencies),
        scope = viewModelScope,
    )

    val model = handle.models

    fun dispatch(message: TodoMessage) =
        handle.dispatch(message)
}
```

Decide runtime scope per product:

- Feature-scoped runtime for isolated screens.
- Navigation-graph scope for multi-screen workflows.
- Application scope for global session state.

Do not create a new runtime on every recomposition.

### Compose binding

- Collect Model with lifecycle-aware APIs.
- Dispatch Messages from callbacks.
- Keep animation/focus/measurement state local when it has no domain meaning.
- Use stable accessibility/test identifiers defined in a shared semantic ID
  registry.
- Map shared Route state to Navigation Compose.

### Android command implementations

Initial ports:

- Ktor or platform HTTP client
- Room/DataStore for persistence
- Android Keystore for secrets
- WorkManager adapter for durable background work
- Activity Result APIs for permission/user-mediated commands

Commands requiring user interaction may need a platform coordinator rather
than a background handler. Model this explicitly; do not hold an Activity in
common state.

### Android process death

Persist only an approved restorable Model projection:

```kotlin
interface ModelRestorer<Model, Snapshot> {
    fun snapshot(model: Model): Snapshot
    fun restore(snapshot: Snapshot): Model
}
```

Do not serialize credentials, sockets, native handles, or command jobs.
Restored programs reconcile subscriptions and may issue recovery Commands.

## 5.3 iOS

### Integration choice

Use direct local framework integration for development. The KMP build becomes
an Xcode build phase. Produce an umbrella framework if shared modules are
later split.

Do not require experimental Swift export for the MVP. Maintain a stable
Swift-friendly facade compatible with the established framework export.
Evaluate Swift export behind a build flag because it currently offers more
idiomatic enums, async functions, and Flow-to-AsyncSequence mapping.

### Swift facade

Avoid exporting the generic runtime directly. Export a feature-specific
controller:

```kotlin
class TodoController(
    flags: TodoFlags,
    dependencies: IosTodoDependencies,
) {
    val currentModel: TodoModel

    fun dispatch(message: TodoMessage)

    fun watchModel(
        observer: (TodoModel) -> Unit,
    ): Cancellable

    fun dispose()
}
```

Generate this facade where possible.

Swift wraps it:

```swift
@MainActor
final class TodoViewModel: ObservableObject {
    @Published private(set) var model: TodoViewData

    private let controller: TodoController
    private var observation: Cancellable?

    init(controller: TodoController) {
        self.controller = controller
        self.model = TodoViewData(controller.currentModel)
        self.observation = controller.watchModel { [weak self] model in
            Task { @MainActor in
                self?.model = TodoViewData(model)
            }
        }
    }

    func dispatch(_ message: TodoMessage) {
        controller.dispatch(message: message)
    }
}
```

The Swift view may map exported domain objects into Swift view data if the
generated API is awkward. Keep this mapping presentation-only.

### SwiftUI binding

- Own the wrapper with `@StateObject`.
- Dispatch Messages from actions.
- Use native `NavigationStack`, sheets, alerts, controls, Dynamic Type, and
  accessibility.
- Map shared Route state to a Swift navigation path without storing SwiftUI
  objects in the shared Model.
- Dispose the controller at its real owner boundary, not on every child view
  disappearance.

### Apple command implementations

Choose per capability:

- Implement straightforward Foundation/Core APIs in `iosMain`.
- Delegate SDK-heavy or pure-Swift integrations to Swift ports.
- Return domain-friendly values across the boundary.
- Never export arbitrary third-party native SDK types into common code.

## 5.4 Web and FoldKit

Two integration stages are planned.

### Stage A: shared reducer facade

Compile the shared program to Kotlin/JS. Export a deliberately flat facade:

```text
createTodoProgram(flagsJson)
dispatch(messageJson)
currentModelJson()
subscribeModel(callback)
dispose()
```

Use JSON initially to avoid exposing difficult Kotlin collection/class shapes.
Keep the JSON boundary behind a TypeScript adapter.

The FoldKit application:

- Owns the DOM view.
- Translates UI events into shared Messages.
- Mirrors the shared Model in a validated Effect Schema representation.
- Executes web-specific capabilities through the runtime adapter.

### Stage B: generated typed facade

Generate:

- TypeScript declarations
- Effect Schemas for exported DTOs
- Message constructors
- Model decoder
- Command manifest

Replace raw JSON calls without changing the public FoldKit feature code.

### Avoid dual updates

There must be one authoritative reducer. The FoldKit web `update` function
should delegate shared behavior rather than independently reproduce it.

Possible adapter shape:

```typescript
const update = (model: WebModel, message: Message) => {
  const transition = shared.reduce(model.shared, message.shared)

  return [
    {
      ...model,
      shared: decodeSharedModel(transition.model),
    },
    transition.commands.map(toFoldKitCommand),
  ] as const
}
```

Web-only behavior may remain in the web Model, but ownership must be explicit.

## 5.5 Native presentation contract

Each feature publishes a platform-neutral presentation contract:

- Model fields that UI may display
- Messages that UI may dispatch
- Stable semantic identifiers
- Route mapping
- Accessibility labels requiring domain values

It does not publish a shared layout tree.

## 5.6 Platform parity

Parity means equivalent behavior, not pixel identity.

Required parity:

- Same domain transitions
- Same validation rules
- Same command intent
- Same error categories
- Same analytics facts
- Same accessibility meaning

Allowed differences:

- Navigation presentation
- Component choice
- Typography and spacing
- Gesture conventions
- Permission presentation
- Platform-specific enhancements

## 5.7 Build and host constraints

- Apple binaries and iOS simulator/device tests require a macOS/Xcode worker.
- Windows/Linux contributors can build common, JVM, JS, and Android targets.
- CI must separate fast portable checks from macOS checks.
- Pin compatible Kotlin, AGP, Gradle, coroutines, serialization, and Xcode
  versions in one version catalog.

## 5.8 Supported OS versions

### Why a minimum is necessary

KMP compilation support is only one constraint. The usable minimum is the
highest minimum imposed by:

- The native UI framework.
- AndroidX or Apple APIs.
- Networking, persistence, and other dependencies.
- Kotlin/Native's current Apple deployment targets.
- The versions actually exercised in CI.

An application can sometimes configure a lower deployment target, but that
does not make every dependency or code path work there. OriKit therefore
publishes tested support floors instead of claiming every historical version.

### Android policy

Set:

```text
minSdk = 23
```

API 23 is Android 6.0 and is much older than the requested six-year device
window. Jetpack Compose itself supports API 21+, but current AndroidX releases
use API 23 as their default minimum and individual libraries may require
higher versions. API 23 gives broad reach without locking the experiment to
legacy API 21/22 dependency versions.

Keep these concepts separate:

- `minSdk`: oldest Android version on which the app runs.
- `targetSdk`: behavior/security contract required by current Play policy.
- `compileSdk`: SDK used to compile; normally current.

The latter two can be upgraded without dropping API 23 if dependencies remain
compatible.

Test at least:

- API 23 emulator for minimum-version behavior.
- API 29 device/emulator representing roughly the requested old-device class.
- One current stable API.

### iOS policy

Set:

```text
iOS deployment target = 15.0
```

Current Kotlin/Native defaults to iOS 15 for its supported device and
simulator targets. It documents an override for lower Apple deployment
targets, but using that override means taking on extra compatibility testing.
SwiftUI began earlier, but the highest dependency/toolchain floor governs.

The experiment should start on the default, well-tested KMP floor. Reconsider
iOS 14 only after the vertical slice passes and there is a concrete user need.

Test:

- Oldest available iOS 15 simulator/runtime in the CI Xcode toolchain.
- One current iOS simulator.
- At least one physical device before releases.

### Browser policy

Use Kotlin/JS, not Wasm, for the FoldKit adapter. Kotlin/JS is currently the
stable KMP web target and does not require WasmGC.

Initial browser support:

- Latest two stable major versions of Chrome/Chromium.
- Latest two stable major versions of Firefox.
- Latest two major Safari versions supported by the CI macOS environment.
- Current Android Chrome and iOS Safari.

No Internet Explorer or frozen legacy-browser guarantee. The exact matrix
must be pinned at each release because browsers and FoldKit evolve.

### Additional KMP targets

Classify targets as:

1. **Supported:** CI, tests, examples, documented compatibility.
2. **Experimental:** compiles and may have smoke tests, no compatibility
   promise.
3. **Unverified:** KMP may support it, OriKit makes no claim.

Initial supported targets are Android/JVM, iOS arm64 device and Apple-silicon
simulator, and browser JS. Desktop JVM is a useful test host and can become a
supported application target later. watchOS, tvOS, Linux Native, Windows
Native, and Wasm are unverified until intentionally added.
