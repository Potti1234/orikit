# OriKit agent instructions

## Authority

The authoritative implementation plan is `docs/nativescript/`. The older
Kotlin Multiplatform plan in the root of `docs/` is fallback research only.

Before changing implementation code, read:

1. `README.md`
2. `docs/nativescript/README.md`
3. `docs/nativescript/01-product-definition.md`
4. `docs/nativescript/02-architecture.md`
5. `docs/nativescript/12-risks-decisions.md`
6. `docs/nativescript/13-agent-runbook.md`
7. The document for the active phase

## Architectural invariants

- `update` is synchronous, deterministic, and free of effects.
- Model, Message, Command descriptions, history, and replay data contain no
  native objects, DOM nodes, callbacks, promises, or mutable SDK handles.
- Every external result re-enters the application as a typed Message.
- UI event handlers dispatch Messages and never mutate the Model.
- NativeScript is a renderer and platform runtime, not the owner of domain
  state.
- Web and native targets must pass the same canonical transition fixtures.
- Replay never executes Commands or acquires resources.
- Platform-specific behavior lives behind typed capabilities or explicit
  `.android.ts` and `.ios.ts` files.
- Native Kotlin and Swift APIs must have a narrow, generated or hand-reviewed
  TypeScript boundary.
- Do not introduce React, Vue, Angular, or another state framework into the
  feasibility spike. Use vanilla NativeScript TypeScript.
- Do not begin a TypeScript-to-Kotlin compiler or KMP implementation without a
  new accepted ADR.

## Verification discipline

- Run the fastest portable tests on Windows while editing.
- Run Android builds and device tests when Android behavior changes.
- Do not report iOS as verified without evidence from macOS and Xcode.
- Report commands and results as passed, failed, not run, or blocked.
- A successful build is not proof of native behavior; inspect the native view
  class or accessibility tree where required.
- Preserve `save.txt`, the MIT license, and the independent-project disclaimer.

## Scope control

Implement phases in `docs/nativescript/10-implementation-roadmap.md` in order.
The feasibility spike has explicit go/no-go gates. Do not build a general
renderer, package ecosystem, or compiler before those gates pass.
