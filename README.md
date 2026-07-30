# OriKit

OriKit is an independent experiment that explores a Foldkit-compatible
Elm architecture for web, Android, and iOS:

```text
event -> Message -> update(Model, Message) -> Model + Commands
```

The current recommended implementation is **TypeScript-first**:

- Foldkit remains the web implementation.
- A browser-independent TypeScript core owns Model, Message, update,
  Commands, Subscriptions, Story tests, history, and replay.
- NativeScript renders real Android and iOS controls.
- Android-specific behavior can use TypeScript platform APIs or Kotlin/Java.
- iOS-specific behavior can use TypeScript platform APIs or Swift/Objective-C.
- A remote web inspector and MCP bridge expose the same logical runtime to
  developers and AI agents.

This does **not** mean that the current Foldkit DOM runtime can run unchanged
inside NativeScript. OriKit must supply a portable runtime boundary and a
NativeScript renderer. See the
[NativeScript plan](docs/nativescript/README.md) for the complete specification.

OriKit is not affiliated with, endorsed by, or maintained by Foldkit,
NativeScript, JetBrains, Google, or Apple. Foldkit and NativeScript remain
their respective projects.

## Authoritative documentation

Read the NativeScript plan in this order:

1. [Documentation index](docs/nativescript/README.md)
2. [Product definition](docs/nativescript/01-product-definition.md)
3. [Architecture](docs/nativescript/02-architecture.md)
4. [Portable core API](docs/nativescript/03-portable-core-api.md)
5. [Native view and renderer](docs/nativescript/04-native-renderer.md)
6. [Runtime, Commands, and resources](docs/nativescript/05-runtime-effects.md)
7. [Platform integration](docs/nativescript/06-platform-integration.md)
8. [Testing](docs/nativescript/07-testing.md)
9. [DevTools, time travel, and MCP](docs/nativescript/08-devtools-time-travel.md)
10. [AI workflow](docs/nativescript/09-ai-workflow.md)
11. [Implementation roadmap](docs/nativescript/10-implementation-roadmap.md)
12. [Verification](docs/nativescript/11-verification.md)
13. [Risks and decisions](docs/nativescript/12-risks-decisions.md)
14. [Agent runbook](docs/nativescript/13-agent-runbook.md)
15. [Windows and Android setup](docs/nativescript/14-windows-android-setup.md)
16. [iOS setup and verification](docs/nativescript/15-ios-setup.md)
17. [Foldkit parity and examples](docs/nativescript/16-foldkit-parity-examples.md)
18. [Feasibility spike](docs/nativescript/17-feasibility-spike.md)
19. [Research references](docs/nativescript/18-references.md)
20. [Implemented Phase 2 API](docs/nativescript/19-phase2-portable-api.md)
21. [Phase 3 Todo evidence](docs/evidence/phase3-todo-vertical-slice.md)
22. [Phase 4 runtime evidence](docs/evidence/phase4-production-runtime.md)
23. [Phase 5 native location evidence](docs/evidence/phase5-native-location.md)
24. [Phase 6 renderer evidence](docs/evidence/phase6-renderer-hardening.md)

## Previous KMP plan

The original documents in [`docs/`](docs/) describe a Kotlin
Multiplatform-first implementation. They are retained as fallback and research
material. They are not the active implementation instructions unless an ADR
explicitly reverses the NativeScript-first decision.

## Current repository state

Phase 1 contains a bounded Counter spike with a shared pure update, serialized
history/runtime, a minimal web renderer, real Android controls, direct Android
API access, and typed Kotlin interop. Node, Chromium, and Android produce
byte-identical canonical traces. See the
[Phase 1 evidence](docs/evidence/phase1-feasibility.md) and
[ADR-0001](docs/adr/0001-nativescript-feasibility.md).

Phase 2 now adds the portable Program, Command completion contracts, structural
Story tests, canonical traces, and effect-free replay. See the
[API guide](docs/nativescript/19-phase2-portable-api.md),
[evidence](docs/evidence/phase2-portable-story.md), and
[ADR-0002](docs/adr/0002-phase2-portable-contract.md).

Phase 3 now promotes Todo into a web/Android vertical slice. One pure update
serves a normal Foldkit web application and a vanilla NativeScript application
with a real Android `EditText`, virtualized `ListView`, and native buttons.
Both views cover load, add, edit, toggle, delete, failure, and retry semantics.
See the [Phase 3 evidence](docs/evidence/phase3-todo-vertical-slice.md).

The Phase 3 application originally used a bounded spike scheduler and still
uses in-memory storage. Phase 4 replaces that history-observer scheduler with
a portable production runtime that owns dispatch ordering, command identity,
cancellation, stale-callback quarantine, lifecycle diagnostics, bounded
events, metrics, and inspectable crash state. See the
[Phase 4 evidence](docs/evidence/phase4-production-runtime.md).

Phase 4 is verified on a physical Samsung SM-G781B running Android 13. The
device verifier confirms native controls, the complete Todo interaction flow,
focus and row-recycling correctness, canonical trace parity, and a running
production runtime.

Phase 5 adds a portable location capability with explicit permission and
failure states, a deterministic fake, cancellable Android callbacks, and a
narrow typed Kotlin classifier for permanent permission denial. The native
screen and lifecycle behavior are verified on the same physical Samsung. See
the [Phase 5 evidence](docs/evidence/phase5-native-location.md) and
[ADR-0004](docs/adr/0004-android-location-capability.md).

Phase 6 extracts a native-only renderer contract with keyed reconciliation,
property and event lifecycles, native-state preservation, accessibility,
custom adapters, diagnostics, and benchmarks. Todo uses its virtualized-list
reconciliation and preserves Android text selection. See the
[Phase 6 evidence](docs/evidence/phase6-renderer-hardening.md) and
[ADR-0005](docs/adr/0005-native-renderer-contract.md).

Phase 7 adds bounded, redacted runtime history and a paired loopback inspector
for physical Android devices. Historical selection re-renders native UI while
the live runtime continues, and resume returns explicitly to the live head. See
the [Phase 7 evidence](docs/evidence/phase7-remote-devtools.md) and
[ADR-0006](docs/adr/0006-debug-devtools-transport.md).

iOS remains unverified until the macOS/Xcode phase runs.

## License

OriKit is licensed under the [MIT License](LICENSE).
