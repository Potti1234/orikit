

# ADR-0010: Investigate a FoldKit NativeScript host renderer

## Status

Proposed for a bounded local Phase 6 experiment on 2026-07-31. Not accepted as
the production renderer, not approved for publication, and not verified on
iOS.

## Context and evidence

The completed Todo vertical slice shares real FoldKit Model, Message, Update,
and Command definitions but uses separate views. Web renders through
`foldkit/html`. NativeScript currently uses XML plus an application-specific
imperative patch function.

Research in
[document 22](../nativescript/23-nativescript-renderer-adapter-study.md) shows
that NativeScript-Vue, Angular, React, Svelte, and Solid all translate a small
logical host interface into real NativeScript controls. The mature adapters
also require a logical node tree, element metadata, special property
relationships, invisible nodes, and dedicated list handling.

FoldKit's Snabbdom patch initializer already accepts a replaceable host
`DOMAPI` and owns tested keyed VNode reconciliation. Reusing a narrow
host-neutral part may eliminate the most error-prone independent differ while
keeping NativeScript-specific creation, properties, events, focus, lists,
navigation, and lifecycle in OriKit.

This is separate from ADR-0009. Its portable-kernel experiment explicitly
excluded Snabbdom and native rendering so it could prove the browser-free
program boundary first.

## Proposed decision

Run the bounded experiment specified by
[document 23](../nativescript/24-foldkit-nativescript-renderer-plan.md) and
verified by
[document 24](../nativescript/25-native-renderer-verification-plan.md).

The experiment may:

- expose a narrow experimental FoldKit host-renderer boundary locally;
- build a NativeScript wrapper tree, registry, property and event modules;
- migrate Counter and then Todo behind a reversible entry point;
- compare correctness, performance, code size, and maintenance with the
  existing manual renderer.

It must not:

- add Vue, Angular, React, Svelte, Solid, or another state framework;
- translate arbitrary FoldKit HTML into native controls;
- introduce a renderer-neutral web/native UI AST;
- weaken the pure update, serialization, replay, or capability boundaries;
- remove the working Todo renderer before all cutover gates pass;
- commit, push, publish, contact upstream, or claim official support without
  explicit user authorization;
- report iOS as passed without macOS/Xcode evidence.

## Consequences

Potential benefits:

- Reuse FoldKit's tested keyed reconciliation and lifecycle hooks.
- Reduce application-specific native patch code.
- Give FoldKit applications a familiar typed native view experience.
- Keep web and native presentation independently idiomatic.
- Make other hosts such as terminal UI technically possible through the same
  narrow host boundary later.
- Produce a small potentially upstreamable separation useful beyond
  NativeScript.

Costs and risks:

- FoldKit's VNode and patcher types currently assume DOM nodes.
- Default FoldKit attributes, styles, properties, and events are browser
  modules and cannot be used unchanged.
- NativeScript does not expose one simple DOM-like child tree.
- Text input, lists, navigation, property children, and modals require special
  adapters even with a shared differ.
- A local FoldKit fork creates upstream synchronization work.
- Android success still does not prove iOS JavaScriptCore/UIKit behavior.

## Alternatives

Continue the manual renderer pattern:

- Lowest framework risk and remains the fallback.
- Repeats property/event/identity mechanics in each feature unless a smaller
  OriKit-only renderer is extracted.

Build a completely independent OriKit VNode differ:

- Avoids FoldKit renderer coupling.
- Duplicates keyed reconciliation and lifecycle behavior already tested in
  FoldKit.

Use NativeScript-Vue or another adapter directly:

- Rejected because it adds another rendering/state framework and violates D2.

Render the existing FoldKit HTML view on native:

- Rejected for the experiment. HTML tag, event, accessibility, input, list,
  navigation, and layout semantics do not map reliably to idiomatic native UI.

Introduce a portable semantic UI AST now:

- Deferred to the separate Phase 9 decision. This experiment keeps separate
  web and native view functions.

## Verification

The ADR can become accepted only when all applicable gates in documents 23 and
24 pass, including:

- browser-free host import;
- unchanged FoldKit web regressions;
- fake-host reconciliation contracts;
- physical Android Counter and Todo proof;
- controlled text and virtualized list correctness;
- listener/disposal cleanup;
- effect-free time travel;
- performance budgets;
- meaningful reuse by a second fixture;
- documented source provenance and maintenance delta.

iOS must remain `NOT_RUN` until the macOS/Xcode slice executes.

## Reversal conditions and cost

Reject or reverse if the patcher needs browser globals, a broad DOM emulator,
invasive FoldKit changes, application-specific exceptions for ordinary views,
or regressions in input/list/replay correctness.

Before acceptance, reversal removes the experimental package wiring and
restores the existing Todo entry point. Model, Message, Command, Story,
runtime, history, trace, web view, and portable-kernel work remain unchanged.




