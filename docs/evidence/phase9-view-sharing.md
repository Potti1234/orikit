# Phase 9 view-sharing decision

Date: 2026-07-30

## Outcome

Phase 9 accepts a layered sharing boundary:

1. Model, Message, update, Commands, Subscriptions, and domain rules are shared.
2. Pure presentation projections are shared where semantics overlap.
3. Foldkit web and native mobile view descriptions remain separate.
4. Android and iOS share a native semantic tree by default, with explicit
   platform themes and custom adapters.

## Todo duplication evidence

Before the experiment, web and native independently derived open/completed
counts, add/edit validation, load/save presentation, row actions, and several
accessibility labels. `presentTodo` now owns those portable derivations and
typed actions. The Foldkit view and current production NativeScript adapter
both consume it.

Presentation-specific choices remain intentionally separate. Web uses a form,
checkboxes, labels, live regions, document metadata, and responsive sections.
Mobile uses native navigation, text fields, buttons, list rows, motion status,
and platform spacing.

## Android/iOS experiment

One `describeTodoNativeTree` function produced both candidate trees:

```json
{
  "sharedSemanticNodes": 19,
  "platformSpecificPropertyPathCount": 13,
  "customSemanticAdapters": ["MotionSummary"],
  "semanticParity": true
}
```

Differences were confined to navigation convention, spacing, minimum control
height, corner radius, platform identity, and custom adapter implementation.
Keys, events, accessibility, hierarchy, and semantic adapter names matched.

The Kotlin/Swift custom class names are proposed host mappings only. Phase 9
does not claim that either `MotionSummary` native view has been implemented or
that the Swift candidate has compiled.

The existing Phase 6 renderer expressed the experiment without modification,
which is strong evidence against adding a web/native common AST or expanding
the native renderer prematurely.

## AI-readability benchmark

`pnpm exec tsx tools/phase9/run-view-sharing-evidence.mts` checks six questions
that an implementation agent must answer from repository structure:

- Is there one portable Program?
- Is the projection platform-independent?
- Is Foldkit web explicitly separate?
- Do both platform families consume shared semantics?
- Do Android and iOS have semantic tree parity?
- Is the native escape hatch explicit?

The experiment scored 6/6. The result is deterministic JSON so future agents
and CI can detect boundary drift.

## Foldkit and accessibility evidence

The Foldkit Scene suite still passes labeled form, checkbox, edit, failure,
status, and command behavior. The native structural suite requires accessible
names on interactive nodes and verifies the same typed actions. Copy may differ
when platform conventions call for different phrasing; domain state does not.

## Verification

```text
pnpm verify:portable
pnpm verify:web
pnpm verify:inspector
pnpm evidence:renderer
pnpm verify:docs
pnpm exec tsx tools/phase9/run-view-sharing-evidence.mts
pnpm verify:android:todo:device
```

Windows proves the iOS candidate tree only structurally. No iOS build, UIKit
class, simulator, or physical-device claim is made in Phase 9.
