# 11. Decisions, open questions, and requested input

## 11.1 Proposed decisions

These are recommended defaults. Record accepted changes as ADRs during
implementation.

### D-001: Shared program language is Kotlin

**Status:** Proposed  
**Reason:** It directly uses KMP backends and avoids a semantic TypeScript
translator.  
**Consequence:** Existing FoldKit update code is not source-compatible.

### D-002: Presentation is not shared

**Status:** Proposed  
**Decision:** FoldKit web, Compose Android, SwiftUI iOS.  
**Reason:** Preserve platform-native interaction and direct API access.

### D-003: Commands are serializable values

**Status:** Proposed  
**Reason:** Story tests, DevTools, replay comparison, and AI inspection.

### D-004: Runtime is a single-writer coroutine event loop

**Status:** Proposed  
**Reason:** Deterministic ordering and cross-thread safety.

### D-005: One terminal Message per Command in v1

**Status:** Proposed  
**Reason:** Clear lifecycle. Streaming work belongs to Subscriptions.

### D-006: JSON first at tool and web boundaries

**Status:** Proposed  
**Reason:** Inspection, Effect Schema validation, MCP, and debugging.
Typed/binary optimization remains internal and later.

### D-007: Stable iOS facade does not require Swift export

**Status:** Proposed  
**Reason:** Swift export is Alpha. Evaluate it as an optional path.

### D-008: Time travel is inspect-only unless explicitly branched

**Status:** Proposed  
**Reason:** Prevent accidental external side effects and loss of live head.

### D-009: Active work is cancelled/quarantined during travel

**Status:** Proposed  
**Reason:** Native callbacks must not mutate historical state.

### D-010: KSP generates metadata, not behavior

**Status:** Proposed  
**Reason:** Keep generated magic small and maintainable.

### D-011: Purity begins with API/module/lint enforcement

**Status:** Proposed  
**Reason:** Kotlin compiler plugins are high-maintenance and should follow
proven need.

### D-012: TypeScript compiler is post-v1 research

**Status:** Proposed  
**Reason:** Runtime semantics and native ergonomics must be proven first.

### D-013: MIT license

**Status:** Accepted  
**Decision:** Publish the experiment under the MIT License.

### D-014: Independent project

**Status:** Accepted  
**Decision:** OriKit is inspired by FoldKit but has no affiliation or
endorsement. Public naming and documentation must not imply otherwise.

### D-015: Initial platform floors

**Status:** Accepted for the experiment  
**Decision:** Android API 23+, iOS 15+, and modern evergreen browsers through
Kotlin/JS. Revisit based on measured dependency compatibility and user need.

### D-016: First pilot and examples

**Status:** Accepted  
**Decision:** Start with Todos, then create a structured example gallery
covering FoldKit-equivalent capabilities.

## 11.2 Resolved user decisions

The following questions have been answered.

### Q-001: Open-source intent and license

**Answer:** Experimental first, planned open source under MIT.

### Q-002: Relationship to the FoldKit name/project

**Answer:** Independent and unaffiliated. Do not imply official status.

### Q-003: Minimum platform versions

**Answer:** Android must comfortably cover devices six years old. Adopt API 23
for even broader coverage. Adopt iOS 15 and evergreen browsers initially.

### Q-004: First real pilot feature

**Answer:** Todo application, followed by multiple focused examples and
eventual adaptation of the useful FoldKit example set.

## 11.3 Remaining important but non-blocking decisions

### Q-005: iOS dependency direction

Options:

1. Most command handlers in `iosMain`.
2. Most command handlers in Swift.
3. Per-capability mix (**recommended**).

Use Swift for pure-Swift SDKs and presentation coordinators; use `iosMain` for
simple Apple APIs and shared Ktor/storage implementations.

### Q-006: Runtime granularity

Options:

- One application-wide Model
- One runtime per feature
- Hierarchical features under one root

Recommendation: framework supports both, example starts with one root and
composed feature models. Very large apps may use multiple bounded runtimes.

### Q-007: Navigation ownership

Options:

- Fully shared Route state (**recommended default**)
- Platform-owned navigation with shared intent Messages
- Per-feature choice

### Q-008: Web authority

Options:

- Shared Kotlin reducer authoritative (**recommended**)
- FoldKit TypeScript reducer authoritative with duplicated native logic
- Fold IR authoritative in future

### Q-009: Production DevTools

Choose whether production builds:

- Omit DevTools entirely (**recommended default**)
- Include local read-only crash history
- Allow authenticated remote inspection

### Q-010: History persistence

Choose:

- Memory only for v1 (**recommended**)
- Debug persistence across restart
- User-exportable support bundles

### Q-011: Sensitive-data policy

Define whether fields are:

- Allow by default, annotate sensitive
- Redact by default, annotate safe (**safer, more work**)
- Disable Model recording in sensitive programs

Recommendation: annotate sensitive plus automatic rules for common names,
then offer program-wide recording disable.

### Q-012: Package namespace

Placeholder examples assume something like:

```text
dev.orikit
```

Select only after naming/affiliation is resolved.

## 11.4 Decisions to make after measurement

- Persistent collections versus standard `List`.
- Full Model per event versus periodic snapshots.
- JSON versus binary internal history storage.
- One framework module versus several feature modules.
- Swift export adoption.
- Web JSON facade versus direct exported Kotlin types.
- Remote desktop inspector versus only in-app inspectors.
- Compiler purity checker.

## 11.5 Decision process

For every nontrivial change:

1. State the observed problem.
2. List at least two options.
3. Record evidence/measurement.
4. Choose and describe consequences.
5. Define reversal cost.
6. Add an ADR in `docs/adr/`.

Do not turn speculative preferences into core abstractions.
