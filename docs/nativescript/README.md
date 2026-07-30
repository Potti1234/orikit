# NativeScript-first implementation documentation

For the current implementation state and exact continuation commands, read the
[complete handoff](../../HANDOFF.md) first.

## Status

This directory is the authoritative OriKit implementation plan.

Decision:

> Validate a browser-independent Foldkit-compatible TypeScript runtime on
> NativeScript before investing in a Kotlin Multiplatform runtime or a
> TypeScript-to-Kotlin compiler.

The plan preserves the qualities that motivated OriKit:

- One immutable Model.
- Typed Messages.
- A pure, exhaustive update function.
- Explicit Commands and Subscriptions.
- Story-style deterministic tests.
- Inspectable history and time travel.
- AI-readable conventions and MCP inspection.
- Real native Android and iOS controls.
- Explicit Kotlin and Swift escape hatches.

## Precise product claim

OriKit is not a port of arbitrary browser applications to NativeScript.
The current Foldkit runtime renders HTML through a browser-oriented virtual
DOM and uses browser services. OriKit instead provides:

1. A small portable TypeScript program contract.
2. Foldkit-compatible conventions and behavior.
3. A web adapter that can use Foldkit.
4. A NativeScript renderer for native controls.
5. Platform-specific capabilities and native source integration.
6. A shared test and DevTools protocol.

Application logic can be shared. Views can be either:

- Separate Foldkit web and NativeScript native views, or
- Written against a deliberately small renderer-neutral view language after
  the separate-view vertical slice proves that this is worthwhile.

The second option is a decision gate, not a Phase 0 assumption.

## Document map

| Document | Purpose |
|---|---|
| [01](01-product-definition.md) | Product promise, goals, non-goals, support policy |
| [02](02-architecture.md) | System boundaries, modules, data flow, ownership |
| [03](03-portable-core-api.md) | Normative TypeScript contracts |
| [04](04-native-renderer.md) | Native control tree, reconciliation, navigation |
| [05](05-runtime-effects.md) | Dispatch, Commands, Subscriptions, resources |
| [06](06-platform-integration.md) | NativeScript, Kotlin, Swift, platform files |
| [07](07-testing.md) | Story, NativeScene, renderer, device, and E2E testing |
| [08](08-devtools-time-travel.md) | History, replay, inspector, and MCP |
| [09](09-ai-workflow.md) | Repository conventions and agent feedback loop |
| [10](10-implementation-roadmap.md) | Ordered phases and exit criteria |
| [11](11-verification.md) | Acceptance matrix, commands, performance budgets |
| [12](12-risks-decisions.md) | Accepted decisions, open decisions, failure modes |
| [13](13-agent-runbook.md) | Exact instructions for implementation agents |
| [14](14-windows-android-setup.md) | Installation and USB-device setup |
| [15](15-ios-setup.md) | Mac, Xcode, signing, simulator, and device checks |
| [16](16-foldkit-parity-examples.md) | Capability matrix and example sequence |
| [17](17-feasibility-spike.md) | First bounded implementation experiment |
| [18](18-references.md) | Primary research sources |
| [19](19-phase2-portable-api.md) | Implemented Phase 2 Program, Story, trace, and replay API |
| [Phase 3 evidence](../evidence/phase3-todo-vertical-slice.md) | Implemented Todo web/Android slice and device results |
| [Phase 4 evidence](../evidence/phase4-production-runtime.md) | Production dispatch and Command supervision evidence |

## Normative language

- **Must** is an implementation requirement.
- **Should** is the default unless an ADR records evidence for another choice.
- **May** is optional.
- **Spike-only** code may be intentionally temporary but must be clearly
  isolated.

When documents conflict, use this precedence:

1. Accepted ADR
2. Product definition
3. Architecture and core API
4. Active roadmap phase
5. Other NativeScript documents
6. Older KMP documents
7. `save.txt`

## Current implementation status

The Windows/Android baseline, bounded Phase 1 feasibility spike, Phase 2
portable Program/Story contract, and Phase 3 Todo web/Android vertical slice
are complete. See [Phase 3 evidence](../evidence/phase3-todo-vertical-slice.md).

Phase 3 validates separate idiomatic views and differential native list
updates. It does not authorize a general renderer, portable view AST, or iOS
support claim.

The Phase 4 portable production runtime is implemented and host-verified. Its
final Android device rerun is pending USB reauthorization. See
[Phase 4 evidence](../evidence/phase4-production-runtime.md) and
[ADR-0003](../adr/0003-production-runtime-mvp.md).
