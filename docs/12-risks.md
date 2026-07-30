# 12. Risks and failure modes

## 12.1 Risk register

| Risk | Likelihood | Impact | Mitigation |
|---|---:|---:|---|
| Swift-facing API is awkward | High | High | Feature facades; early iOS slice |
| Build times become slow | Medium | High | Small modules, debug targets, measure |
| Web adapter duplicates state logic | Medium | High | One authoritative reducer |
| Kotlin update is not truly pure | Medium | High | module rules, lint, tests |
| Serialization breaks replay | Medium | High | schema versions and fixtures |
| Time travel triggers side effects | Medium | Critical | replay never executes Commands |
| Late callbacks corrupt branch | Medium | Critical | session/branch/command IDs |
| Secrets leak through DevTools | Medium | Critical | redaction before transport/storage |
| Generic API exports poorly to Swift | High | Medium | do not export generic runtime |
| KSP becomes too magical | Medium | Medium | generate metadata only |
| Kotlin compiler plugin churn | High | Medium | defer plugin |
| UI behavior drifts by platform | Medium | Medium | shared scenarios and parity contract |
| Framework scope becomes enormous | High | High | phase gates and explicit deferrals |
| FoldKit changes upstream | Medium | Medium | thin web adapter and conformance tests |
| Brand/name conflict | Unknown | High | resolve affiliation before publication |

## 12.2 Semantic replay divergence

Causes:

- update reads time/random/global state.
- Serialization defaults changed.
- Numeric behavior differs between JS and Native.
- Collection ordering is unstable.
- Old application version replays new history.

Detection:

- Compare Model and Command fingerprints at every event.
- Run conformance vectors on each backend.

Response:

- Stop at first divergence.
- Display expected and actual values.
- Show program/build/schema versions.
- Never continue with an untrusted reconstructed state.

## 12.3 Command duplication

A command may be started twice through restoration, branching, retry, or
platform lifecycle.

Mitigations:

- Runtime command IDs.
- Domain idempotency keys for external writes.
- Explicit restoration policy.
- Never persist active coroutine continuation.
- Branch warning for external writes.

Runtime IDs alone cannot make a server mutation idempotent.

## 12.4 Swift memory ownership

Potential cycles:

```text
Swift ViewModel -> Kotlin Controller -> observer closure -> Swift ViewModel
```

Mitigations:

- `[weak self]` in observer.
- Explicit `Cancellable`.
- Controller `dispose`.
- Automated deallocation test.
- Avoid storing arbitrary Swift closures indefinitely in shared state.

## 12.5 StateFlow conflation

A slow UI observer may skip intermediate Models. That is acceptable for UI,
which needs the latest state, but unacceptable for history.

Mitigation: record events directly in the serialized runtime loop before
publication; do not build history from Model observation.

## 12.6 Large Model cost

Full serialization after every Message may be expensive.

Mitigations in order:

1. Measure.
2. Disable full Model recording outside development.
3. Snapshot periodically.
4. Record diffs only for display while retaining replay Messages.
5. Move large immutable blobs behind content-addressed references.
6. Add binary internal encoding if justified.

Do not introduce incremental Model mutation to solve DevTools cost.

## 12.7 Native UI drift

Separate UI implementations can accidentally differ in validation timing or
available actions.

Mitigations:

- Behavior belongs in shared Model/update.
- Publish a presentation contract.
- Shared semantic IDs.
- Shared Scene scenarios for critical flows.
- Platform parity review.

Visual differences are expected; behavioral contradictions are not.

## 12.8 Platform lifecycle mismatch

Android recreation and iOS view lifecycle do not map cleanly to one common
event.

Mitigations:

- Runtime owned above transient views.
- Platform lifecycle adapter with explicit Messages.
- Restoration tests.
- No lifecycle callbacks hidden inside shared Models.

## 12.9 Overusing expect/actual

This can make tests harder and force platform implementation into compilation
rather than dependency injection.

Use `expect/actual` for low-level platform facts with one obvious
implementation. Use interfaces/ports for business capabilities and SDKs.

## 12.10 Generated-code drift

Mitigations:

- Deterministic generation.
- Golden tests.
- CI `generate && git diff --exit-code`.
- Generated header identifying tool version.
- Never hand-edit generated files.

## 12.11 Unsupported TypeScript expectations

Users may assume existing FoldKit applications can be compiled unchanged.

Mitigation:

- Product language clearly says shared program is Kotlin.
- TypeScript compiler remains separately labeled research.
- Web migration guide identifies which behavior moves to shared Kotlin.

## 12.12 Security

Threats:

- MCP allows arbitrary dispatch.
- Inspector binds beyond loopback.
- History includes tokens/PII.
- Imported history is malicious or huge.
- Debug features accidentally ship enabled.

Mitigations:

- Development-only defaults.
- Loopback bind.
- Read-only/mutating capability split.
- Schema validation and size limits.
- Redaction before leaving runtime.
- Release build tests asserting DevTools absence/disablement.
- Never deserialize arbitrary polymorphic classes outside registered schema.

## 12.13 Project failure signals

Pause and reassess if:

- Swift needs extensive handwritten wrappers for every Message.
- Shared Program API changes weekly after phase 4.
- FoldKit web adapter maintains a second reducer.
- Simple incremental iOS builds exceed the agreed feedback budget.
- DevTools serialization dominates normal updates.
- Agents repeatedly bypass the architecture despite canonical tooling.
- More effort goes into code generation than application behavior.

