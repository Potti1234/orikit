# 10. Verification and acceptance

## 10.1 Definition of done

A feature is done only when:

- Model, Messages, Commands, and update are documented by code.
- Expected behavior has common Story coverage.
- Command handlers have focused tests.
- Affected platform UI tests pass.
- Serialization changes include migration/version consideration.
- DevTools output is useful and redacted.
- Generated artifacts are current.
- Relevant performance budgets have not regressed.

The host setup, stable command names, CI lanes, and agent evidence protocol are
defined in
[Development environment and self-verification](18-development-environment.md).
An unavailable local target is `Not run`, not an implicit pass; iOS evidence
must come from a macOS host running Apple tooling.

## 10.2 FoldKit experience equivalence

The framework is "FoldKit-like" only if all rows pass:

| Capability | Required evidence |
|---|---|
| One immutable Model | No direct platform mutation; architecture lint |
| Typed Messages | Serializable sealed union and schema |
| Exhaustive update | `when` without `else`; compile fixture |
| Explicit Commands | No effect execution in update |
| Deterministic transition | replay/property tests |
| Story testing | commands captured/resolved without effects |
| Submodels | child isolation and OutMessage tests |
| Subscriptions | model-keyed lifecycle tests |
| Managed resources | acquisition/release tests |
| DevTools | Model/Message/Command timeline |
| Time travel | common replay vector on every target |
| MCP | schema discovery and validated dispatch |
| Crash reporting | phase/model/message context |
| Slow warnings | measured runtime phases |

## 10.3 Native-experience acceptance

Android:

- Compose source owns UI hierarchy.
- Native Navigation Compose behavior.
- Back handling follows Android conventions.
- TalkBack labels/roles are correct.
- Dynamic color and font scale work.
- Platform permission APIs are used.
- No WebView for primary UI.

iOS:

- SwiftUI source owns UI hierarchy.
- `NavigationStack`, sheets, alerts, and controls are native.
- VoiceOver and Dynamic Type work.
- Standard swipe/back behavior works.
- Apple permission and lifecycle APIs are used.
- No embedded JS engine or web view for primary UI.

Conduct a short human review on physical devices. Automated checks cannot
fully establish native feel.

## 10.4 Correctness matrix

| Test | JVM | JS | Android | iOS simulator |
|---|---:|---:|---:|---:|
| Core API | required | required | compile | required |
| Story suite | required | required | optional duplicate | required |
| Runtime contracts | required | required | required | required |
| Codec vectors | required | required | required | required |
| Replay vectors | required | required | required | required |
| Command handlers | n/a/fakes | web | required | required |
| Native UI | n/a | web Scene | required | required |
| Accessibility | n/a | required | required | required |

## 10.5 Performance budgets

Initial budgets are hypotheses and must be measured on representative devices.

Debug, DevTools off:

- Median trivial dispatch/update/publish: under 1 ms.
- p95 trivial dispatch/update/publish: under 4 ms.
- No main-thread IO.
- Runtime idle CPU effectively zero without active subscriptions.

Debug, DevTools on:

- p95 added transition overhead: under 5 ms for a 100 KB encoded Model.
- History memory honors configured byte limit within 10%.
- Travel to any event in a 5,000-event session: under 250 ms using snapshots.

Startup:

- Shared runtime must not add more than 50 ms median warm startup to sample
  apps after initialization dependencies are already loaded.

These budgets must be replaced by measured baselines after phase 4.

## 10.6 Memory and lifecycle

Required tests:

- Create/dispose runtime 1,000 times without retained jobs.
- Open/close iOS feature repeatedly; controller deallocates.
- Recreate Android activity; only intended runtime instance survives.
- Travel/resume repeatedly; no growing subscription count.
- Bounded history never exceeds configured policy indefinitely.
- Large Models do not keep every full snapshot when compact mode is enabled.

## 10.7 Serialization compatibility

For each schema change:

1. Classify additive, compatible default, renamed, removed, or semantic.
2. Increment schema version when required.
3. Add old fixture.
4. Add migration or explicit rejection.
5. Test JS and Native decoding.
6. Verify redaction metadata.

Never silently reinterpret an old Message with new semantics.

## 10.8 Failure injection

Inject:

- Network timeout/offline/malformed response
- Storage unavailable/corrupt
- Permission denial and permanent denial
- Command cancellation
- Subscription disconnect/reconnect
- Runtime update defect
- Observer defect
- History storage full
- Late native completion
- Schema mismatch
- Replay divergence

Each must have an intentional visible result.

## 10.9 AI workflow benchmark

Maintain a benchmark prompt given to a clean agent:

> Add an archive action to Todos. It must ask for confirmation on iOS and
> Android, archive through a Command, update the FoldKit web UI, and include
> Story and native Scene coverage.

Measure:

- Files inspected
- Architecture violations
- Compiler iterations
- Tests added
- Total time
- Human corrections required
- Whether the agent used the manifest and DevTools

Acceptance for the first AI-tooling release:

- Three independent clean runs.
- At least two complete without architectural correction.
- All three produce understandable Story tests.
- No run puts effects inside update.

## 10.10 Release gates

`0.1.0` requires:

- Phases 0-8 complete.
- Todo example on all platforms.
- All blocking decisions resolved.
- No critical security findings.
- Replay vectors identical.
- Public API and protocol marked experimental.

`0.2.0` target:

- Subscriptions, composition, Scene scenarios, MCP.

`1.0.0` requires:

- Two external production pilots.
- Documented compatibility policy.
- Stable core API.
- Reliable upgrade/migration story.
- Measured performance on supported device matrix.
