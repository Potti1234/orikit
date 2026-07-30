# 2. Architecture

## 2.1 System boundary

```text
                         commonMain
┌───────────────────────────────────────────────────────────┐
│ Model  Message  update  Command  Subscription  Story DSL │
│               OriKit Runtime Contracts               │
└─────────────────────────────┬─────────────────────────────┘
                              │ compiled per target
          ┌───────────────────┼───────────────────┐
          │                   │                   │
┌─────────▼────────┐ ┌────────▼─────────┐ ┌───────▼────────┐
│ Kotlin/JS facade│ │ Android runtime  │ │ iOS framework  │
│ FoldKit adapter │ │ Compose + Kotlin │ │ SwiftUI + Swift│
└──────────────────┘ └──────────────────┘ └────────────────┘
```

The shared module owns behavior. Each platform owns presentation and the
interpretation of capabilities.

## 2.2 Proposed repository structure

Start as a monorepo:

```text
orikit/
├── build-logic/                    convention plugins
├── gradle/
│   └── libs.versions.toml
├── packages/
│   ├── core/                       pure public contracts
│   ├── runtime/                    dispatch loop and command supervisor
│   ├── story/                      headless test DSL
│   ├── devtools-protocol/          serializable protocol
│   ├── devtools-runtime/           history, snapshots, replay
│   ├── codegen-annotations/        stable annotations
│   ├── codegen-ksp/                manifests and adapters
│   ├── web-export/                 Kotlin/JS-friendly facade
│   └── testkit/                    clocks, IDs, harnesses
├── tooling/
│   ├── cli/                        scaffolding and doctor
│   ├── mcp-server/                 runtime inspection
│   ├── devtools-web/               browser inspector
│   └── lint/                       Detekt rules
├── examples/
│   ├── counter/
│   └── todos/
│       ├── shared/
│       ├── web/
│       ├── androidApp/
│       └── iosApp/
├── docs/
└── settings.gradle.kts
```

Do not begin with one Gradle module per feature. Validate the API in a few
modules first. Split modules only when boundaries and build measurements
justify it.

## 2.3 Layering rules

Dependencies point inward:

```text
platform UI
    ↓
platform adapter
    ↓
runtime
    ↓
core contracts

feature program → core contracts
story → core contracts + feature program
devtools runtime → core contracts + protocol
```

Forbidden dependencies:

- `core` must not depend on coroutines, serialization, platform APIs, or UI.
- A feature update file must not depend on a platform source set.
- Native UI must not mutate a Model directly.
- Command handlers must not call update directly; they dispatch Messages.
- DevTools must observe the runtime through an interface, not own runtime
  state.
- Code generation must not be required to understand the core runtime.

## 2.4 Source sets

Initial shared targets:

```kotlin
kotlin {
    androidLibrary { /* pinned compatible configuration */ }
    jvm("desktopTestHost")
    js(IR) {
        browser()
        binaries.library()
        generateTypeScriptDefinitions()
    }
    iosArm64()
    iosSimulatorArm64()
}
```

Use `commonMain`, `commonTest`, `androidMain`, `jsMain`, and `iosMain`. Add
intermediate source sets only for demonstrated shared platform requirements.

Use a JVM target as the fastest local Story-test host. Still execute the
common tests on JS and iOS in CI to catch backend differences.

## 2.5 Core data flow

```text
UI / subscription / command completion
                 │
                 ▼
             dispatch(msg)
                 │
          runtime event queue
                 │
                 ▼
       update(oldModel, message)
                 │
                 ▼
      Next(newModel, commands)
         │               │
         │               └── schedule commands
         ▼
 publish model + record event
         │
         └── platform UI observes
```

Every dispatch receives a monotonically increasing sequence number. Runtime
processing is serialized even if callers dispatch from multiple threads.

## 2.6 Ownership

The runtime owns:

- Current logical Model.
- Dispatch queue and sequence numbers.
- Command jobs.
- Subscription jobs.
- Runtime phase (`running`, `traveling`, `crashed`, `disposed`).
- DevTools event publication.

The platform owns:

- App/window lifecycle.
- Native UI state that is purely presentational.
- Command dependencies such as HTTP clients and secure storage.
- Native navigation container.
- Platform permissions and SDK objects.

The shared Model owns:

- Navigation intent/state when it affects business behavior.
- User input that affects feature behavior.
- Loading/error/success states.
- Domain state and workflow progress.

Ephemeral UI state such as SwiftUI animation progress, focus rings, or
Compose measurement state should remain platform-local unless replaying it is
a product requirement.

## 2.7 Determinism contract

Given equivalent serialized Model and Message values, update must return an
equivalent serialized Next value.

Update must not read:

- Current time
- Random generators
- Files or databases
- Network state
- Locale or timezone
- Global mutable variables
- Platform singletons

Those values enter through Messages produced by Commands or initialization
flags.

## 2.8 Initialization

Initialization follows FoldKit:

```kotlin
fun init(flags: Flags): Next<Model, Command>
```

Flags are immutable and serializable. Platform bootstraps create flags from
launch arguments, restored state, deep links, or environment configuration.
Initialization may return Commands but must not perform effects itself.

## 2.9 Navigation

Recommended split:

- Shared Model stores a serializable `Route` or navigation intent.
- Each platform maps that state into its native navigation system.
- Platform navigation callbacks dispatch Messages.
- Restoration and deep links are parsed into shared Messages.

The shared Route should express product destinations, not platform controller
types. For example, `Route.TodoDetails(id)` is valid; `UIViewController` is
not.

## 2.10 Versioning

Every public serialized program declares:

```kotlin
data class ProgramIdentity(
    val name: String,
    val schemaVersion: UInt,
    val buildVersion: String,
)
```

History, snapshots, MCP messages, and persisted Models include this identity.
Replay refuses incompatible schemas unless a registered migration exists.

