

# 23. FoldKit-to-NativeScript host renderer plan

**Status:** implemented through the reversible Android Todo cutover on
2026-07-31, with the direct Snabbdom reuse hypothesis rejected. Remaining
platform and stress gates are tracked in the evidence record. Start only after reading
[ADR-0010](../adr/0010-foldkit-nativescript-host-renderer-spike.md) and the
active repository handoff.

## 23.1 Objective

Replace Todo's application-specific XML and imperative patch function with a
small reusable renderer that:

- accepts a pure native view function;
- uses FoldKit VNodes and keyed reconciliation where practical;
- creates real NativeScript Android and iOS controls;
- converts native events directly into typed Messages;
- preserves focus, selection, scroll, list identity, and native lifecycle;
- renders historical Models without running Commands or acquiring resources;
- remains independent from Vue, Angular, React, Svelte, and Solid.

The experiment should answer whether FoldKit's existing renderer kernel can be
made host-neutral enough to support NativeScript without turning FoldKit into
a native framework or OriKit into a DOM emulator.

## 23.2 Why this is a new experiment

[Document 20](21-foldkit-portable-kernel-plan.md) intentionally excluded
Snabbdom, HTML, and renderer work. That boundary kept the portable-kernel
experiment small and has already produced useful evidence. This document is a
separate follow-up after the Todo decision gate.

It is compatible with accepted decisions because:

- D2 remains intact: the application uses vanilla NativeScript and FoldKit,
  not another UI framework.
- D4 remains intact: web and native retain separate view functions.
- The optional shared view AST from Phase 9 is not introduced.
- The existing runtime and live/recorded Command split remain unchanged.
- iOS remains unverified until macOS/Xcode evidence exists.

## 23.3 Starting point

The pre-experiment native Todo path was:

```text
Todo Model
    -> describeTodoNativeView(model)
    -> todo-page.ts render(page, description)
    -> NativeScript XML controls
```

It already proves:

- Messages are the only domain mutations;
- controlled text is not rewritten when equal;
- Todo rows carry stable IDs;
- `ObservableArray` updates preserve useful row identity;
- `ListView` is virtualized;
- native handles stay outside Model/history.

The limitation is that every feature would need custom imperative patching and
event wiring. The experiment moves those generic mechanics into a renderer
while preserving specialized native behavior.

## 23.4 Target data flow

```text
NativeScript tap/text/list/native callback
                 |
                 v
       typed event conversion
                 |
                 v
        dispatch(Message)
                 |
                 v
  OriKit/FoldKit production runtime
                 |
                 v
      update(Model, Message)
                 |
                 +----> live Commands scheduled after commit
                 |
                 v
          committed Model
                 |
                 v
      viewNative(Model, builder)
                 |
                 v
       FoldKit-compatible VNode
                 |
                 v
   keyed patch + NativeScript host API
                 |
                 v
       real native control hierarchy
```

The renderer receives only the visible Model and `dispatch`. It does not own
the live Model, call `update`, run Commands, start Subscriptions, or retain a
domain cache.

## 23.5 Proposed package boundaries

Names remain provisional until implementation evidence exists.

### FoldKit sibling repository

Expose the narrowest renderer-kernel boundary needed by another host:

```text
foldkit/experimental/host-renderer
|- VNode and VNodeData types
|- patch initializer
|- module hook types
|- host operation contract
`- no default browser modules or browser globals on import
```

Preferred long-term shape:

```ts
type HostOperations<Node, Element extends Node, Text extends Node, Comment extends Node> = {
  createElement: (name: string, data?: unknown) => Element
  createText: (text: string) => Text
  createComment: (text: string) => Comment
  insertBefore: (parent: Node, child: Node, anchor: Node | null) => void
  appendChild: (parent: Node, child: Node) => void
  removeChild: (parent: Node, child: Node) => void
  parentNode: (node: Node) => Node | null
  nextSibling: (node: Node) => Node | null
  setText: (node: Node, text: string) => void
}
```

The exact generic signature is not pre-decided. The gate is that the exported
host boundary can be imported in Node and NativeScript without evaluating DOM
or browser modules. Existing `foldkit/html` behavior must remain compatible.

### OriKit repository

Create only after the boundary proof passes:

```text
packages/renderer-nativescript/
|- src/nodes.ts
|- src/host-operations.ts
|- src/registry.ts
|- src/metadata.ts
|- src/modules/properties.ts
|- src/modules/events.ts
|- src/modules/classes.ts
|- src/modules/styles.ts
|- src/elements/core.ts
|- src/elements/text-field.ts
|- src/elements/list-view.ts
|- src/elements/navigation.ts       later slice
|- src/builder.ts
|- src/mount.ts
|- src/diagnostics.ts
`- src/testing/                     pure fake-host contracts
```

Do not move application Model, Message, Command, runtime, or capability code
into this package.

## 23.6 Native view API

The first public API should be explicit and native rather than HTML-shaped:

```ts
type NativeView<Model, Message> = (
  model: Model,
  n: NativeBuilder<Message>,
) => NativeNode<Message>
```

Example target experience:

```ts
export const viewTodoNative = (
  model: TodoModel,
  n: NativeBuilder<TodoMessage>,
): NativeNode<TodoMessage> =>
  n.page({}, [
    n.actionBar({ title: 'Today' }),
    n.grid({ rows: ['auto', 'auto', '*'] }, [
      n.label({
        row: 0,
        text: `${model.todos.length} reminders`,
        accessibilityRole: 'header',
      }),
      n.textField({
        row: 1,
        text: model.draft,
        hint: 'New reminder',
        onTextChange: draftChanged,
        onReturnPress: addRequested(),
      }),
      n.list({
        row: 2,
        items: model.todos,
        key: (todo) => todo.id,
        rowView: (todo) =>
          n.grid({ key: todo.id, columns: ['auto', '*', 'auto'] }, [
            n.button({
              text: todo.completed ? 'Ã¢Å“â€œ' : 'Ã¢â€”â€¹',
              accessibilityLabel: `Toggle ${todo.title}`,
              onTap: toggleRequested(todo.id),
            }),
            n.label({ text: todo.title }),
            n.button({
              text: 'Delete',
              onTap: deleteRequested(todo.id),
            }),
          ]),
      }),
    ]),
  ])
```

API rules:

- Builder calls are pure descriptions and create no native objects.
- Event attributes contain a Message or a pure event-to-Message function.
- Event functions may extract serializable values but must not return native
  event or view objects.
- Keys are explicit and unique among siblings.
- NativeScript classes are not part of application view types.
- Unsupported properties fail with a node path in development.
- Platform-specific values use typed properties or explicit escape nodes, not
  untyped dictionaries in the stable API.

## 23.7 Logical host nodes

Every reconciled node needs a wrapper independent from the NativeScript visual
tree:

```ts
type HostNodeKind = 'element' | 'text' | 'comment' | 'property'

type HostNode = {
  readonly kind: HostNodeKind
  parentNode: HostElement | null
  previousSibling: HostNode | null
  nextSibling: HostNode | null
}
```

`HostElement` additionally owns:

- normalized element name;
- optional real NativeScript instance;
- first/last logical child;
- registry metadata;
- active native event invokers;
- renderer-local property snapshots;
- disposal state and diagnostic path.

Rules:

1. Logical relationships are authoritative for reconciliation.
2. NativeScript `View.parent` is only the projected visual relationship.
3. Comment nodes can serve as stable conditional/fragment anchors without
   becoming native views.
4. Text nodes update a compatible parent's text representation or fail when
   used where text children are not supported.
5. A removed node clears sibling links, native listeners, renderer state, and
   custom disposal hooks exactly once.

## 23.8 Element registry and metadata

Avoid a central switch that knows every NativeScript plugin. Use a registry:

```ts
type ElementRegistration<View> = Readonly<{
  create: () => View
  childPolicy: ChildPolicy
  properties: PropertySchema<View>
  events: EventSchema<View>
  text?: TextBinding<View>
  dispose?: (view: View) => void
}>
```

Required child policies:

- `layout`: multiple ordered visual children;
- `content`: zero or one visual child assigned to `content`;
- `builder`: NativeScript `_addChildFromBuilder`-style relationship;
- `property`: child assigned to a named parent property;
- `detached`: logical node not attached to the ordinary visual parent;
- `none`: child nodes forbidden;
- `custom`: reviewed insert/remove functions.

The first registrations should be limited to:

- `Page`;
- `StackLayout`;
- `GridLayout`;
- `ScrollView`;
- `Label`;
- `Button`;
- `TextField`;
- `ActivityIndicator`;
- `Image` only if needed by the proof.

`ListView`, `ActionBar`, navigation, modals, and plugin controls are later
registrations with explicit contracts.

## 23.9 Property patching

The property module receives previous and next VNode data and applies only
actual changes.

Requirements:

1. Validate the property against the element registration.
2. Apply platform filters before touching the native view.
3. Preserve `false`, `0`, and empty string distinctly from absence.
4. Restore or unset removed properties using the documented NativeScript
   unset behavior rather than assigning arbitrary `undefined`.
5. Never reflect native objects back into VNode data or Model.
6. Include the element path, property, received value type, and platform in a
   development error.
7. Avoid reassigning a value when the logical and native values are already
   equal.

Property categories should remain separate:

- ordinary NativeScript properties;
- layout properties such as row/column;
- accessibility properties;
- CSS classes;
- style values;
- parent property placement;
- renderer-only metadata such as key and test identity.

## 23.10 Event patching

Use stable invokers inspired by NativeScript-Vue:

```ts
type EventInvoker<Message> = {
  current: NativeEventToMessage<Message>
  listener: (event: unknown) => void
}
```

On update:

- unchanged event: do nothing;
- changed handler: replace `current`, keep the native listener;
- newly added event: attach one listener;
- removed event: detach exactly that listener;
- removed node: detach every listener;
- event after disposal: ignore and record a development diagnostic;
- successful conversion: call `dispatch(message)` once.

The public event contract must use typed serializable projections:

```ts
onTap: Message
onTextChange: (text: string) => Message
onCheckedChange: (checked: boolean) => Message
onItemTap: (itemKey: string) => Message
```

Do not expose raw `EventData`, Android `View`, iOS `UIView`, callbacks, or
promises to Model or Message constructors.

## 23.11 Controlled text input

Text input is a dedicated adapter, not an ordinary string property.

Implementation requirements:

1. Read the live native text before writing.
2. Do not write when it already equals the next logical value.
3. Distinguish a user-originated change from a renderer-originated write.
4. Prevent renderer writes from dispatching duplicate input Messages.
5. Snapshot selection before a necessary controlled write.
6. Restore a valid selection after the write.
7. Preserve focus and keyboard visibility across unrelated patches.
8. Define and test composition/autocorrection behavior on both platforms.
9. Keep selection, focus handles, keyboard objects, and composition state
   renderer-local.

The existing Todo input behavior is the regression baseline.

## 23.12 Styling and accessibility

The initial renderer should use NativeScript classes and documented style
properties. It must not recreate CSS selectors or a browser cascade.

Support first:

- class name/class list replacement;
- a reviewed subset of inline style properties;
- existing application CSS files;
- accessibility label, hint, role/state where NativeScript exposes them;
- stable automation/test identifier.

Platform files may refine appearance:

```text
app.css
app.android.css
app.ios.css
```

Equivalent meaning is required across targets; identical pixels are not.

## 23.13 Virtualized ListView

Do not send `ListView` through ordinary child reconciliation.

The list adapter owns renderer-local structures for:

- item key to logical row description;
- realized cell root to item key;
- recycled cell rebinding;
- stable event lookup;
- `ObservableArray` or accepted collection adapter;
- refresh decisions;
- scroll position and selection state.

List rules:

1. Keys must be stable and unique.
2. Index keys are rejected for mutable/reorderable collections.
3. A recycled cell receives current data and current event conversions.
4. Deleted row handlers cannot dispatch.
5. Unrelated Model changes do not reset scroll position.
6. Time travel refreshes visible rows without executing Commands.
7. The adapter does not eagerly instantiate every row.
8. A row has one native root unless a documented wrapper is inserted.

Keep `reconcileKeyedItems` and `applyKeyedItems` as the fallback until the new
adapter passes all current Todo list tests and device evidence.

## 23.14 Property children, navigation, and modals

These are post-Todo slices:

- `ActionBar` is normally a Page property relationship.
- `Frame` and `Page` map a serializable route stack to native navigation.
- Modal roots exist outside the main native child tree.
- Tabs, drawers, formatted strings, and plugin controls may use property or
  custom child policies.

Navigation remains Model-authoritative. Native back and dismissal callbacks
dispatch Messages before logical route state changes. Time travel reconciles
the historical route visually but does not replay transition animations or
native callbacks.

Do not generalize these relationships until one observed feature requires
each one.

## 23.15 Mount, update, and disposal

Proposed mount boundary:

```ts
type NativeMount<Model, Message> = Readonly<{
  render: (model: Model) => void
  root: () => View
  dispose: () => void
}>
```

Mount sequence:

1. Register the allowed element set.
2. Construct the host operations and patch modules.
3. Create an inert logical mount root.
4. Evaluate the native view with the initial visible Model.
5. Patch it into the mount root.
6. Return the real NativeScript root to `Application.run` or the owning Page.
7. Subscribe to visible-Model snapshots.

Disposal sequence:

1. Unsubscribe from runtime snapshots.
2. Patch or explicitly destroy the current VNode tree.
3. Detach all native event listeners.
4. Dispose specialized/custom adapters.
5. Release renderer-owned animation/focus/list references.
6. Sever wrapper parent/sibling/native references.
7. Mark the mount disposed so late events cannot dispatch.

Disposal must be idempotent.

## 23.16 Time travel and replay

The renderer consumes the runtime's visible Model selection:

```text
live head Model -----------+
                           +--> visible Model --> pure view --> native patch
historical replay Model ---+
```

Rules:

- Selecting history evaluates the pure view and patches controls.
- Replay may reconstruct Command descriptions for comparison but never
  schedules their Effects.
- No Subscription or managed resource is acquired for a historical Model.
- Native event dispatch is disabled or explicitly routed according to the
  existing historical-mode policy.
- Resume patches from the historical view to the current live head.
- Branch replaces the runtime branch first and then renders the new live head.
- Renderer-local focus/scroll policy during travel must be deterministic and
  documented, but these values do not enter history.

## 23.17 Diagnostics

Development diagnostics must include:

- program identity where available;
- logical node path and key;
- element name and underlying NativeScript class;
- operation (`create`, `insert`, `property`, `event`, `remove`, `dispose`);
- platform and OS version;
- expected and received property/event shape;
- original cause without serializing a native object into history.

Required defects:

- unknown element;
- duplicate sibling key;
- illegal child policy;
- multiple children in a single-content host;
- invalid property or event;
- text in an unsupported parent;
- insertion of an already-owned wrapper without removal;
- native creation or disposal failure;
- event fired after removal.

## 23.18 Implementation slices

Each slice is independently reversible. Do not continue after a failed gate by
adding a broad DOM shim.

### Slice A Ã¢â‚¬â€ baseline and API audit

1. Record dirty files and exact OriKit/FoldKit revisions.
2. Run FoldKit focused VNode/Snabbdom tests unchanged.
3. Run `pnpm verify:portable`, `pnpm verify:web`, and current Todo native tests.
4. Generate the import graph for the proposed host boundary.
5. Inventory DOM types, globals, modules, and assumptions in `snabbdom/init`.
6. Record all existing Todo renderer behaviors that must survive.
7. Create the evidence document before changing code.

Gate: the candidate patcher has a plausible narrow import boundary and the
baseline is green.

### Slice B Ã¢â‚¬â€ fake-host FoldKit proof

1. Expose the smallest experimental host-renderer entry point locally.
2. Implement an in-memory fake host with no DOM and no NativeScript imports.
3. Render create, text, property, event metadata, insertion, move, and remove
   fixtures.
4. Verify keyed nodes keep host identity across reorder.
5. Verify destroy hooks run exactly once.
6. Verify the existing browser renderer suite remains green.
7. Add a static no-browser import check for the new entry point.

Gate: Node can import and use the patcher with no DOM global or browser package.

### Slice C Ã¢â‚¬â€ NativeScript wrapper tree

1. Create element, text, comment, and property wrapper classes.
2. Implement logical sibling maintenance.
3. Implement the initial element registry.
4. Add fake NativeScript view classes for fast Windows tests.
5. Implement layout/content/none child policies.
6. Add insertion, movement, removal, replacement, and idempotent-disposal tests.
7. Prove no wrapper/native handle appears in serialized view fixtures.

Gate: the wrapper contract suite passes entirely on Windows.

### Slice D Ã¢â‚¬â€ ordinary native controls

1. Register Page, layouts, Label, and Button.
2. Implement property validation and patching.
3. Implement stable event invokers and Message dispatch.
4. Mount a Counter using only the new native view builder.
5. Run Android build and physical-device Counter proof.
6. Inspect the native hierarchy and accessibility tree.
7. Compare the canonical logical trace with Node/web.

Gate: Counter works on a physical Android device with real controls and no
application-specific render function.

### Slice E Ã¢â‚¬â€ controlled TextField

1. Register TextField value/event metadata.
2. Implement equal-value suppression.
3. Add selection/focus preservation.
4. Add user-change versus renderer-write guards.
5. Test rapid typing and unrelated Model updates.
6. Test return-key dispatch.
7. Run TalkBack and physical keyboard/IME checks where available.

Gate: no lost/duplicate input Message and no focus regression against Todo.

### Slice F Ã¢â‚¬â€ ordinary Todo surface

1. Express header, composer, feedback, empty state, and editor with the builder.
2. Keep the current list adapter temporarily.
3. Run semantic native view tests.
4. Compare old and new view descriptions for required user meaning.
5. Run the physical Todo flow.

Gate: all non-list Todo behavior works before list abstraction begins.

### Slice G Ã¢â‚¬â€ virtualized ListView

1. Add the specialized list element/adapter.
2. Port existing keyed row reconciliation as the correctness baseline.
3. Test insert, delete, edit, toggle, reorder, and recycled cells.
4. Verify stale row handlers cannot dispatch.
5. Verify unrelated updates retain scroll.
6. Verify time travel refreshes visible rows only.
7. Exercise 1,000 rows and collect frame/render measurements.

Gate: list correctness, virtualization, accessibility, and performance budgets
pass on physical Android.

### Slice H Ã¢â‚¬â€ Todo cutover

1. Switch Todo to the new renderer behind an easy-to-remove entry point.
2. Retain the old XML/manual renderer until the physical Android cutover gate passes.
3. Run portable, web, Android build, device, trace, and documentation checks.
4. Record code removed, code added, and remaining application-specific view
   differences.
5. Remove the old path only with explicit scope authorization and green
   evidence; otherwise keep it as fallback.

Gate: the new renderer is measurably reusable and does not weaken Todo.

### Slice I Ã¢â‚¬â€ time travel and lifecycle

1. Mount the renderer through the visible-Model subscription.
2. Travel across states affecting text, editor, empty state, and rows.
3. Prove no Command, Subscription, or managed resource executes during replay.
4. Resume to the live head and verify view identity policy.
5. Dispose/remount repeatedly and inspect listener/root retention.
6. Test background/foreground notifications without renderer ownership drift.

Gate: effect-free replay and idempotent disposal pass.

### Slice J Ã¢â‚¬â€ iOS bring-up

This slice is `NOT_RUN` on Windows.

1. Repeat fake-host and package checks on macOS.
2. Build with the pinned NativeScript/Xcode toolchain.
3. Run Counter and Todo in iOS Simulator.
4. Inspect UIKit classes and VoiceOver accessibility.
5. Test TextField selection, keyboard, autocorrection, and composition.
6. Test ListView recycling and scroll.
7. Run on a physical iPhone through the accepted iOS workflow.
8. Compare canonical traces.

Gate: no cross-platform renderer claim until this slice passes.

### Slice K Ã¢â‚¬â€ upstream decision

1. Measure the FoldKit changes separately from the NativeScript adapter.
2. Identify whether the host boundary is generally useful to TUI, worker, test,
   or other renderer authors.
3. Prepare a small compatibility report and proposed API shape.
4. Decide whether to keep the boundary local, vendor it, or propose it upstream.
5. Do not open an issue, PR, publish a package, or contact maintainers without
   explicit user authorization.

Gate: ADR-0010 is accepted, rejected, or retained as experimental with a clear
maintenance cost.

## 23.19 Expected file changes

The implementation agent must refine this list after inspecting the current
GitHub branch; it must not overlay this older local snapshot wholesale.

Expected FoldKit sibling changes:

```text
packages/foldkit/src/snabbdom/       host-neutral type/boundary changes
packages/foldkit/src/...             narrow experimental export only
packages/foldkit/package.json        local export map if required
focused host-renderer tests
static portable import checks
```

Expected OriKit changes:

```text
packages/renderer-nativescript/      new bounded package or existing GitHub package
apps/mobile-spike/app/todo/          migration and fallback wiring
packages/todo/                       native view function only if it stays NS-free
tools/renderer/                      focused verification/evidence scripts
docs/evidence/                       renderer experiment results
docs/adr/0005-...                    status updates only after evidence
```

The GitHub repository is known to contain later packages and phases absent
from this local snapshot. The receiving agent must follow the transfer handoff
and merge selectively into the newer GitHub architecture.

## 23.20 Acceptance gates

The renderer direction passes only if:

1. The FoldKit host boundary imports no browser runtime in Node/NativeScript.
2. Existing FoldKit web behavior and tests remain compatible.
3. Counter and Todo use real NativeScript controls.
4. Keyed ordinary controls retain native identity.
5. Text input retains focus/selection and produces no duplicate Messages.
6. `ListView` remains virtualized and recycled rows never retain stale data or
   handlers.
7. Removed nodes detach listeners and dispose exactly once.
8. Replay/time travel execute no Commands or resources.
9. Model, Message, history, trace, and DevTools payloads contain no native
   objects, callbacks, promises, or VNodes.
10. Android device performance remains within document 11 budgets.
11. The new code removes application-specific renderer work for a second
    fixture, not only Todo.
12. Failures include actionable node paths and property/event names.
13. License/provenance records are complete.
14. iOS is reported honestly as `NOT_RUN` until macOS evidence exists.

## 23.21 Reject or pause conditions

Pause the direction if:

- importing the patcher requires DOM globals or browser platform services;
- browser compatibility requires broad invasive FoldKit changes;
- a complete DOM shim becomes necessary;
- HTML semantics must be guessed to obtain native controls;
- NativeScript child ownership cannot be expressed without application-level
  exceptions for ordinary controls;
- controlled input or recycled list correctness regresses;
- event payloads tempt native objects into Messages;
- the renderer owns domain state or effect execution;
- performance exceeds budgets after focused profiling;
- maintaining the FoldKit fork is larger than the renderer code it replaces.

## 23.22 Reversal

The XML/manual renderer was retained until Slice H and removed after the
physical Android interaction gate passed. Reversal now means:

1. restore the application entry point to the existing renderer;
2. remove only the experimental package reference and fixture wiring;
3. retain research, tests, evidence, and ADR outcome;
4. leave the FoldKit portable kernel and live Command work untouched;
5. do not delete the sibling FoldKit clone without explicit authorization.

The experiment must not require Model, Message, Command, Story, history, or
trace migrations, so reversal remains a renderer-only operation.


