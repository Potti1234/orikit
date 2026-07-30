# 4. Native view and renderer

## 4.1 Purpose

The NativeScript renderer turns a logical view description into real native
controls and keeps those controls synchronized with the visible Model.

The renderer must not own domain state or run Commands.

## 4.2 Initial strategy

The Counter and Todo vertical slices use a native-specific view function:

```ts
type NativeView<Message> = (
  model: Model,
) => NativeNode<Message>
```

This avoids prematurely creating one lowest-common-denominator web/native
language. The optional portable view AST is evaluated only after Todo.

## 4.3 Native node

Proposed minimal description:

```ts
type Key = string | number

type NativeNode<Message> =
  | TextNode
  | ElementNode<Message>

type ElementNode<Message> = Readonly<{
  kind: NativeElementKind
  key?: Key
  props: Readonly<Record<string, unknown>>
  events: Readonly<Record<string, Message | MessageFactory>>
  children: ReadonlyArray<NativeNode<Message>>
}>
```

Initial element kinds:

- `Page`
- `Stack`
- `Grid`
- `Scroll`
- `Text`
- `Button`
- `TextField`
- `Switch`
- `ActivityIndicator`
- `Image`
- `List`

Each kind maps to a documented NativeScript class. Unsupported properties
must fail in development rather than be silently ignored.

## 4.4 Reconciliation

The renderer must preserve native view identity when kind and key match.

Patch phases:

1. Compare old and new node kind/key.
2. Reuse or create the NativeScript view.
3. Diff properties.
4. Reconcile event listeners.
5. Reconcile keyed children.
6. Apply child insertions, moves, and removals.
7. Restore renderer-local state where required.
8. Dispose removed custom/native elements.

Never rebuild the whole screen after every Message beyond the earliest
Counter spike.

## 4.5 Identity and keys

Lists and stateful controls require stable keys:

```ts
ui.list({
  items: model.todos,
  key: todo => todo.id,
  row: todo => ui.text({ key: todo.id, value: todo.title }),
})
```

Index keys are forbidden when items can be inserted, removed, sorted, or
filtered.

The renderer verifies duplicate sibling keys in development.

## 4.6 Text input

Text fields are especially sensitive because the native control owns:

- Current focus.
- Selection range.
- Input method composition.
- Autocorrection state.
- Keyboard visibility.

Rules:

- Do not write the `text` property when the logical value is already equal.
- Preserve selection where a controlled update changes the value.
- Dispatch composition-safe change events.
- Do not put native selection handles in the Model.
- Scene tests verify logical behavior; device tests verify keyboard behavior.

## 4.7 Lists

Use NativeScript `ListView` or an accepted collection-view plugin for
virtualized data. The renderer must not eagerly instantiate all rows for a
large list.

Verify:

- Stable row identity.
- Recycling does not retain stale handlers.
- Accessibility content changes with recycled data.
- Scroll position survives unrelated Model updates.
- Time travel updates visible rows correctly.

## 4.8 Navigation

Initial mapping:

```text
Route TodoList        -> Page(list)
Route TodoDetails(id) -> Page(details)
```

Navigation reconciliation compares the logical route stack with the active
NativeScript `Frame` stack.

Requirements:

- Native back events dispatch a Message before logical state changes.
- Route state is authoritative.
- Deep links decode into typed Messages or initial Flags.
- Time travel may inspect historical navigation.
- Resume returns to the live route.
- A native transition animation is not replayed as an external fact.

## 4.9 Modals and transient presentation

Whether a dialog or sheet is open is logical state if it affects behavior:

```ts
type Editor =
  | { readonly _tag: "Closed" }
  | { readonly _tag: "Editing"; readonly todoId: string }
```

Animation progress, drag offset, focus rings, and measurement remain
renderer-local unless they are a product requirement.

## 4.10 Accessibility

Every interactive native node supports:

- Role/control kind.
- Accessible name.
- Hint when necessary.
- State such as checked, selected, disabled, or expanded.
- Stable test identifier.
- Logical focus order.

The view DSL should prefer labels and roles over test-only IDs. Device tests
must inspect the platform accessibility tree.

The web and native renderers need equivalent user meaning, not identical
implementation attributes.

## 4.11 Styling

NativeScript CSS may define shared tokens and ordinary layout, but the project
must allow platform adjustments:

```text
tokens.css
app.android.css
app.ios.css
```

Avoid recreating a browser CSS engine or assuming every CSS property has a
native equivalent. Complex platform conventions should use native controls or
platform code.

## 4.12 Custom controls

A custom element adapter defines:

```ts
type NativeElementAdapter<Node, View> = Readonly<{
  create: (node: Node) => View
  update: (view: View, previous: Node, next: Node) => void
  dispose: (view: View) => void
}>
```

Native handles remain inside the adapter. Events are converted into Messages.

SwiftUI and Compose integration is permitted for isolated surfaces after a
plain NativeScript control cannot meet the requirement. It is not the default
application renderer.

## 4.13 Renderer-local state

Permitted renderer-local state:

- Native view instances.
- Key maps.
- Focus and selection snapshots.
- Scroll offsets.
- Animation handles.
- Layout measurements.
- Gesture recognizers.

It must not contain a second mutable copy of domain data.

## 4.14 Failure handling

Development behavior:

- Unknown element kind: crash view with node path.
- Invalid property: diagnostic with expected type and platform.
- Duplicate key: diagnostic with sibling path.
- Native creation failure: crash report including adapter and OS version.
- Event mapping failure: reject before dispatch.

Release behavior is configured, but defects must remain observable through
crash reporting.

## 4.15 Renderer acceptance tests

Before Todo renderer completion:

- A keyed child is reused after sibling insertion.
- Removed listeners cannot dispatch.
- Text focus and selection survive unrelated updates.
- List rows do not show stale content after recycling.
- Scroll position survives unrelated updates.
- Native back navigation produces the correct Message.
- Historical Model renders without executing effects.
- All removed custom elements receive disposal.
- The Android accessibility tree identifies every interactive control.
- The same checks pass on iOS before iOS support is claimed.
