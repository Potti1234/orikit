# ADR-0008: share behavior and native semantics, not web view descriptions

Date: 2026-07-30  
Status: accepted

## Context and evidence

Todo has one portable Program but originally repeated derived counts, status
copy, validation flags, accessibility labels, and typed actions in its web and
native views. Its actual layouts are intentionally different: Foldkit web uses
HTML forms, labels, checkboxes, lists, live regions, and responsive document
structure, while mobile uses navigation bars, native text fields, buttons,
virtualized lists, and platform spacing.

The Phase 9 experiment extracted a pure `presentTodo` projection and consumed
it from both views. It then generated Android and iOS trees from one
`describeTodoNativeTree` function with platform profiles.

The evidence tool found:

- 19 shared native semantic nodes;
- identical node, key, event, accessibility, and custom-adapter structure;
- 13 explicit platform-specific property paths;
- one shared `MotionSummary` semantic adapter with proposed Kotlin/Swift host
  mappings; and
- a 6/6 machine-readable architecture/AI-readability rubric.

No renderer contract or implementation change was required.

## Decision

OriKit applications share one portable Program by default:

- Model and Message schemas;
- pure `update`;
- Commands and Subscriptions;
- domain validation and state machines;
- replay and Story fixtures; and
- pure feature presentation projections where semantics genuinely overlap.

Foldkit web and native mobile keep separate view descriptions. Arbitrary
Foldkit HTML is not portable to native and OriKit will not introduce a
renderer-neutral web/native AST.

Android and iOS should share a typed native semantic tree when their product
structure agrees. A platform profile supplies metrics, navigation conventions,
styling values, and adapter registrations. Explicit `.android.ts`, `.ios.ts`,
Kotlin, and Swift boundaries remain available when native behavior diverges.

Platform SDK mechanics belong behind typed capabilities. Platform-specific
Model fields or update branches are allowed only when product behavior—not
merely implementation—actually differs. Shared update remains the default.

## Consequences

- Domain behavior has one source of truth across web, Android, and iOS.
- Web remains free to use idiomatic Foldkit HTML and accessibility semantics.
- Android and iOS can share mobile hierarchy and typed events without requiring
  identical pixels or native classes.
- Presentation projections may share copy and actions but must not contain CSS
  classes, DOM nodes, NativeScript handles, callbacks, or platform SDK values.
- Native trees may use named custom nodes whose Android and iOS adapters expose
  the same semantic contract.
- iOS structural parity is proven on Windows; actual UIKit rendering remains
  unverified until Phase 10 runs on macOS/Xcode.
- The custom-view class names are contract candidates, not claims that the
  Kotlin and Swift view implementations already exist.

## Alternatives

1. Fully separate all views: rejected because Todo demonstrated avoidable
   duplication between Android and iOS and in cross-platform derived semantics.
2. One renderer-neutral web/native AST: rejected because it either leaks HTML
   into mobile or reduces Foldkit and native platforms to a weak common subset.
3. Share only view-model projections: retained as the minimum boundary, but the
   experiment supports additionally sharing native Android/iOS tree structure.

## Verification

`pnpm exec tsx tools/phase9/run-view-sharing-evidence.mts` enforces the chosen
boundary. Todo, Foldkit Scene, NativeScene, portable, web, Android build/device,
renderer, and documentation suites must remain green.

## Reversal conditions and cost

Reconsider shared native trees if Phase 10 shows pervasive UIKit/Android
structural divergence, poor accessibility, or adapter complexity. Reversal is
limited to native view modules because the portable Program and projection do
not depend on the native tree.
