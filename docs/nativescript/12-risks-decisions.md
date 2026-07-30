# 12. Risks, decisions, and open questions

## 12.1 Accepted decisions

### D1 — NativeScript-first experiment

Use NativeScript before KMP/compiler work.

Reason:

- Same TypeScript language as Foldkit.
- Smaller initial engineering scope.
- Better AI feedback loop.
- Real native controls and direct native API access.
- Kotlin/Swift remain available at boundaries.

Reversal:

- Feasibility gate fails.
- iOS runtime incompatibility.
- Renderer cannot meet correctness/performance requirements.
- Dependency or platform support risk becomes unacceptable.

### D2 — Vanilla NativeScript

Do not add React, Vue, Angular, Svelte, or Solid initially. OriKit already
defines state and rendering semantics.

### D3 — Separate portable Command descriptions

Do not bind a browser Effect directly into the portable Command value.
Interpreters are platform wiring.

### D4 — Separate web/native views first

Do not begin with a shared UI AST. Measure Todo before deciding.

### D5 — Remote inspector first

Use one browser inspector and MCP relay rather than full native DevTools UIs.

### D6 — KMP remains fallback

Preserve the old KMP plan. Do not implement both paths simultaneously.

### D7 — Portable Promise/abort runtime

Use a small Promise-returning Command interpreter and runtime-owned structural
cancellation signal. Effect may be used behind this boundary. Keep Foldkit
Runtime on web and use the OriKit production runtime for NativeScript and
other non-Foldkit hosts. See
[ADR-0003](../adr/0003-production-runtime-mvp.md).

## 12.2 Blocking go/no-go questions

The feasibility spike must answer:

1. Do Effect Schema and Match run correctly in NativeScript Android?
2. Which Effect runtime primitives run correctly?
3. Does the same result hold on iOS JavaScriptCore?
4. Can a browser-free subset be imported without `@effect/platform-browser`?
5. Can the renderer preserve text/list identity reliably?
6. Is debugging bundled TypeScript on physical devices productive?
7. Are current NativeScript platform minimums compatible with product targets?

NativeScript is not fully accepted until Android and iOS gates pass. Android
may provisionally authorize the Todo phase while iOS remains a scheduled gate.

## 12.3 Major risks

### R1 — Foldkit browser coupling

Impact: high.

Foldkit runtime, HTML, Scene, navigation, and DevTools contain DOM/browser
assumptions.

Mitigation:

- Share program concepts and browser-independent source only.
- Avoid root Foldkit imports in mobile.
- Extract or independently implement a portable kernel.
- Keep a compatibility matrix.

### R2 — Effect 4 beta and runtime compatibility

Impact: high.

Mitigation:

- Pin exact versions.
- Test on both Android V8 and iOS JavaScriptCore.
- Keep portable API smaller than Effect platform services.
- Isolate polyfills.
- Do not build broad workarounds without an ADR.

### R3 — Native renderer correctness

Impact: high.

Focus, selection, list recycling, scroll, event listeners, and native view
lifecycle are easy to break.

Mitigation:

- Separate-view Todo before generic AST.
- Keyed reconciliation tests.
- Small element set.
- Use NativeScript list virtualization.
- Device and accessibility-tree tests.

### R4 — JavaScript on UI thread

Impact: medium/high for heavy workloads.

Mitigation:

- Pure update budgets.
- Avoid huge Model copies.
- Bounded history.
- Workers/native modules for heavy work.
- Profile release builds.

### R5 — Smaller plugin ecosystem

Impact: medium.

Mitigation:

- Prefer direct native APIs.
- Wrap only necessary capabilities.
- Review plugin health and version floors.
- Own critical integrations.

### R6 — Platform version drift

Impact: medium.

NativeScript, Xcode, Android Gradle, Kotlin, CocoaPods, and plugins evolve.

Mitigation:

- Lockfiles and pinned CI images.
- Dedicated dependency updates.
- Minimum/current OS matrix.
- Scheduled newest-toolchain lane.

### R7 — “Native” overclaim

Impact: product/reputation.

Mitigation:

- Define native precisely.
- Inspect native control hierarchy.
- Distinguish real controls from idiomatic platform design.
- Publish limitations.

### R8 — Time travel and external effects

Impact: correctness.

Mitigation:

- Commands never run in replay.
- Logical state only.
- Clear live versus historical UI.
- Session/branch IDs and callback quarantine.
- Explicit warnings for branching.

### R9 — DevTools security

Impact: high if shipped accidentally.

Mitigation:

- Debug-only default.
- Pairing and local binding.
- Read-only default.
- Redaction.
- Release binary verification.

### R10 — Upstream compatibility and naming

Impact: maintenance/legal clarity.

Mitigation:

- Pin upstream commits.
- Preserve licenses and notices.
- Do not imply official Foldkit compatibility certification.
- Consider upstream platform-neutral extraction only through normal
  contribution channels.

## 12.4 Open decisions after Todo

- iOS evidence may refine the accepted separate-web/shared-native view boundary.
- NativeScript `Frame` versus platform-owned navigation.
- Effect-based interpreter versus smaller Promise/Abort interface.
- Nx versus plain pnpm workspace.
- History policy while inspecting native operations.
- Which native E2E runner becomes required.
- Whether package names use `orikit`, `foldkit-native`, or another neutral
  identity.

## 12.5 Requested user decisions

No user input blocks Phase 0 or the Android feasibility spike.

Before public package publishing:

- Final project/package name.
- Public repository organization.
- Whether “compatible with Foldkit architecture” may appear in marketing copy.

Before iOS physical-device phase:

- Mac access method.
- iPhone model.
- Apple Developer membership timing.

Before first release:

- Supported Android and iOS minimums based on test evidence.
- Whether remote mutation tools ship at all.

## 12.6 ADR template

```markdown
# ADR-NNN: Title

## Status

## Context and evidence

## Decision

## Consequences

## Alternatives

## Verification

## Reversal conditions and cost
```

Store ADRs under `docs/adr/`.
