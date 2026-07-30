# 2. Architecture

## 2.1 System boundary

```text
                             portable TypeScript
┌─────────────────────────────────────────────────────────────────┐
│ Schema  Model  Message  update  Command  Subscription  Story   │
│ dispatch runtime  history  replay  DevTools protocol           │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                ┌───────────────┴────────────────┐
                │                                │
┌───────────────▼──────────────┐   ┌─────────────▼───────────────┐
│ Web application              │   │ NativeScript application    │
│ Foldkit HTML view/runtime    │   │ native view renderer        │
│ browser capabilities         │   │ Android/iOS capabilities    │
└──────────────────────────────┘   └─────────────┬───────────────┘
                                                │
                                  ┌─────────────┴─────────────┐
                                  │                           │
                            Android native                iOS native
                            Kotlin/Java                    Swift/Obj-C
```

The portable program owns logical behavior. Renderers own presentation.
Capability interpreters own effects and platform handles.

## 2.2 Proposed monorepo

```text
orikit/
├── apps/
│   ├── web/                         Foldkit application
│   ├── mobile/                      NativeScript application
│   └── inspector/                   browser DevTools and MCP relay
├── packages/
│   ├── core/                        Program contracts and schemas
│   ├── runtime/                     dispatch and effect supervision
│   ├── story/                       pure transition test DSL
│   ├── view/                        optional portable view AST
│   ├── renderer-web/                optional view AST to Foldkit/HTML
│   ├── renderer-nativescript/       native control reconciler
│   ├── native-scene/                pure view-tree test DSL
│   ├── devtools-protocol/           transport-independent protocol
│   ├── devtools-runtime/            history, snapshots, replay
│   └── testkit/                     clocks, IDs, capabilities, fixtures
├── examples/
│   ├── counter/
│   ├── todos/
│   ├── forms/
│   └── native-capability/
├── tools/
│   ├── doctor/
│   ├── verify/
│   └── mcp/
├── docs/
├── package.json
├── pnpm-workspace.yaml
└── nx.json                         only if Nx is accepted by ADR
```

The feasibility spike may start with fewer packages. A package boundary is
created only when it has a demonstrated dependency or distribution purpose.

## 2.3 Dependency direction

```text
platform application
       ↓
renderer / capability interpreter
       ↓
runtime
       ↓
portable core

story → portable core + application program
devtools runtime → core schemas + runtime observation
inspector → devtools protocol
```

Forbidden dependencies:

- `core` must not import `@nativescript/core`, DOM types,
  `@effect/platform-browser`, Node APIs, Kotlin, or Swift.
- A Program must not import Android or iOS SDK objects.
- The portable runtime must not create native views.
- A renderer must not execute domain effects.
- A capability interpreter must not call update directly.
- DevTools must observe and control the runtime through an interface.
- Web and native views must not maintain a second copy of logical state.

## 2.4 Core data flow

```text
native/browser event
        │
        ▼
  dispatch(Message)
        │
        ▼
 serialized event queue
        │
        ▼
 update(oldModel, Message)
        │
        ▼
 Transition(newModel, Commands)
        │
        ├── record history
        ├── publish Model
        ├── reconcile renderer
        └── schedule Commands
```

Command completion:

```text
Command interpreter
       │
       ▼
completion Message
       │
       └── dispatch queue
```

Every dispatched Message receives a monotonically increasing sequence number.
Every scheduled Command receives a command ID and causal sequence.

## 2.5 Ownership

The portable runtime owns:

- Current live Model.
- Dispatch queue.
- Message sequence.
- Active command and subscription metadata.
- Runtime phase.
- History and snapshots.
- Visible Model selection during time travel.
- Runtime event publication.

The renderer owns:

- Native view instances.
- Key-to-view identity.
- Applying properties and child order.
- Event listener attachment.
- Focus, selection, and scroll preservation.
- Renderer-local measurement and animation state.

The platform application owns:

- Android Activity and iOS application/window lifecycle.
- Signing, manifests, entitlements, permissions, and resources.
- Construction of platform capability implementations.
- Native navigation host when platform-owned navigation is selected.
- Crash collection and release configuration.

The logical Model owns:

- Product route or destination state.
- Form values that affect behavior.
- Loading, failure, and success states.
- Domain data.
- Permission intent and interpreted result.
- Whether a logical native surface should be presented.

The Model must not own:

- `android.view.View`, `Activity`, `Context`, or `Intent`.
- `UIView`, `UIViewController`, `UIApplication`, or delegates.
- File descriptors, database connections, cameras, sockets, or callbacks.
- Focus handles or animation objects.

## 2.6 Portable versus platform files

Recommended feature shape:

```text
features/todos/
├── model.ts
├── message.ts
├── command.ts
├── update.ts
├── program.ts
├── story.test.ts
├── view.web.ts
├── view.native.ts
├── capabilities.ts
├── capabilities.android.ts
└── capabilities.ios.ts
```

Use `.android.ts` and `.ios.ts` only when behavior truly differs. Do not use
platform suffixes to hide accidental coupling that belongs behind a portable
capability.

## 2.7 View strategy decision gate

Phase 1 uses separate view functions:

```text
shared Model/Message/update
       ├── Foldkit HTML view
       └── NativeScript native view
```

After Todo, measure:

- Duplicated view behavior.
- Accessibility duplication.
- Platform divergence.
- Renderer maintenance.
- AI performance with both patterns.

Only then decide whether to create a portable view AST:

```text
portable view
    ├── web renderer
    └── native renderer
```

The portable AST must not be accepted merely to maximize line-count reuse.

## 2.8 Determinism

Given equivalent decoded Model and Message values, `update` must produce
equivalent Model and Command descriptions.

`update` must not read:

- Time.
- Randomness.
- Locale or timezone.
- Environment variables.
- Files, databases, network, sensors, or permissions.
- Global mutable variables.
- Browser or native singleton state.

Those values enter through Flags or completion Messages.

## 2.9 Initialization

```ts
type Init<Flags, Model, Command> = (
  flags: Flags,
) => Transition<Model, Command>
```

Flags are schema-validated, immutable values constructed by each target from:

- Launch arguments.
- Restored serializable state.
- Deep links.
- Development fixtures.
- Environment configuration that is safe to expose to the application.

Initialization may request Commands but may not execute them.

## 2.10 Navigation

Product destinations must be serializable:

```ts
type Route =
  | { readonly _tag: "TodoList" }
  | { readonly _tag: "TodoDetails"; readonly id: string }
```

Each target maps Route to its navigation mechanism. Native callbacks dispatch
Messages. Time travel reconciles navigation from the selected logical Route.

Two acceptable native strategies:

1. Renderer-owned navigation using NativeScript `Frame` and `Page`.
2. Platform-owned navigation behind a typed adapter.

The spike starts with renderer-owned navigation. Platform-owned navigation
requires an ADR because it increases replay and lifecycle complexity.

## 2.11 Versioning

Every Program with DevTools support declares:

```ts
type ProgramIdentity = {
  readonly name: string
  readonly schemaVersion: number
  readonly buildVersion: string
}
```

History and transport payloads include this identity. Incompatible histories
must be rejected unless an explicit migration exists.
