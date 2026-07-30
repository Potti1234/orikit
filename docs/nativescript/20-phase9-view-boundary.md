# 20. Phase 9 view-sharing boundary

## Chosen structure

```text
packages/todo
├── program.ts          shared Model, Message, update, Commands
└── presentation.ts     shared pure semantic projection

apps/web-spike
└── todo-app.ts         Foldkit HTML view and browser Command adapters

apps/mobile-spike
└── app/todo
    ├── native-tree.ts  shared Android/iOS native semantic tree experiment
    ├── native-view.ts  current production NativeScript projection adapter
    ├── *.android.ts    Android host details
    └── *.ios.ts        future iOS host details
```

## Migration example

Before, each view derives behavior independently:

```ts
const open = model.todos.filter((todo) => !todo.completed).length
const canAdd = model.draft.trim().length > 0
const toggle = toggleRequested(todo.id)
```

Move genuinely shared derivation into a pure presentation function:

```ts
export const presentTodo = (model: TodoModel): TodoPresentation => ({
  openCount: model.todos.filter((todo) => !todo.completed).length,
  canAdd: model.draft.trim().length > 0,
  rows: model.todos.map((todo) => ({
    id: todo.id,
    title: todo.title,
    toggleMessage: toggleRequested(todo.id),
  })),
})
```

The web view keeps Foldkit HTML:

```ts
export const viewTodoWeb = (model, h) => {
  const view = presentTodo(model)
  return {
    title: `${view.openCount} open reminders · OriKit`,
    body: h.form([h.OnSubmit(view.addMessage)], [/* web layout */]),
  }
}
```

The mobile family shares a native tree:

```ts
export const viewTodoNative = (model, theme) => {
  const view = presentTodo(model)
  return nativeElement("Page", {
    props: { navigation: theme.navigation, padding: theme.pagePadding },
    children: [/* mobile layout using view */],
  })
}
```

Android and iOS profiles vary metrics and adapters, not the Program:

```ts
const android = viewTodoNative(model, androidTodoTheme)
const ios = viewTodoNative(model, iosTodoTheme)
```

## When update may differ

Do not split `update` because an API name, permission class, or native callback
differs. Put those mechanics behind capability interpreters that return shared
Messages.

A platform-specific Message/Model branch is justified only when the user-facing
state machine differs. Keep the shared cases in `updateShared` and make the
platform branch explicit and exhaustive. Never hide platform behavior in a
view event handler.

## Native custom elements

Use one semantic adapter name when Kotlin and Swift controls promise the same
properties, events, accessibility, and disposal behavior:

```text
MotionSummary
├── Android candidate: dev.orikit.device.MotionSummaryView (Kotlin)
└── iOS candidate: OriKitMotionSummaryView (Swift)
```

If those contracts diverge materially, use two explicit nodes instead of a
large bag of platform conditionals.

These are proposed host mappings. Phase 9 proves the shared semantic contract;
Phase 10 owns implementing and compiling the Swift adapter and may refine both
class names from device evidence.

## Non-goals

- Port arbitrary Foldkit HTML to NativeScript.
- Share CSS or responsive web layout with mobile.
- Guarantee pixel-identical Android and iOS screens.
- Put a `platform` switch throughout Model or update.
- Add DOM concepts to `NativeNode`.
- Claim UIKit behavior before Phase 10 device evidence.
- Force every Android/iOS screen to share structure when product UX differs.
