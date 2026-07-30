# 19. Phase 2 portable API guide

## 19.1 Status and scope

This is the implemented API guide for Phase 2. The code remains experimental
and private to the workspace.

Implemented packages:

```text
@orikit/spike-core   Program, codecs, transitions, tagged values, contracts
@orikit/story        Story DSL, diffs, traces, replay, examples
@orikit/spike-trace  canonical JSON and portable SHA-256
```

The `spike-*` package names are intentionally retained until release-oriented
package naming is authorized. The exported contracts are public within the
workspace; no package has been published.

None of these packages owns a renderer or executes native work. The existing
Phase 1 queue remains spike-only and is not the Phase 4 production runtime.

## 19.2 Define a Program

Each boundary has an Effect Schema. `init` and `update` return data
synchronously:

```ts
const todoProgram = defineProgram({
  identity: {
    name: "todo",
    schemaVersion: 1,
    buildVersion: "0.0.0-phase2",
  },
  Flags: TodoFlags,
  Model: TodoModel,
  Message: TodoMessage,
  Command: TodoCommand,
  commandContract: defineCommandContract<TodoCommand, TodoMessage>({
    LoadTodos: ["TodosLoaded", "TodosLoadFailed"],
    SaveTodos: ["TodosSaved", "TodosSaveFailed"],
  }),
  init: () => transition(initialTodoModel(), loadTodos()),
  update: updateTodo,
})
```

Use `tagged` for frozen serializable descriptions and `transition` to preserve
Command order:

```ts
const loadTodos = () => tagged("LoadTodos")
const saveTodos = (todos: ReadonlyArray<Todo>) =>
  tagged("SaveTodos", { todos })

return transition(nextModel, saveTodos(nextModel.todos))
```

`tagged` does not replace a Schema. `Program.Command` and
`Program.Message` remain the runtime validation boundaries.

## 19.3 Write a Story

A Story starts from Flags, exercising `init`, or from a Model snapshot:

```ts
const result = runStory(todoProgram, [
  Story.flags({}),
  Story.expectCommand(loadTodos()),
  Story.resolve(loadTodos(), todosLoaded([])),
  Story.message(draftChanged("Write native UI")),
  Story.message(addRequested("todo-2")),
  Story.expectCommand(
    saveTodos([
      { id: "todo-2", title: "Write native UI", completed: false },
    ]),
  ),
  Story.resolve(
    saveTodos([
      { id: "todo-2", title: "Write native UI", completed: false },
    ]),
    todosSaved(),
  ),
  Story.expectModelPartial({
    draft: "",
    saveState: { _tag: "Idle" },
  }),
])
```

Step semantics:

| Step | Meaning |
|---|---|
| `Story.flags(value)` | Decode Flags, call `init`, validate Model and Commands |
| `Story.model(value)` | Decode a starting snapshot without calling `init` |
| `Story.message(value)` | Decode a Message and apply one pure transition |
| `Story.expectModel(value)` | Compare the complete encoded Model |
| `Story.expectModelPartial(value)` | Compare only the supplied nested fields |
| `Story.expectCommand(value)` | Compare the first pending Command without consuming it |
| `Story.resolve(command, message)` | Validate, consume, and complete the first pending Command |

No Story step invokes a real interpreter. An emitted Command remains pending
until the Story resolves it explicitly. A completion Message that is not in
the Program's contract fails before `update`.

Exact and partial failures show deterministic structural paths:

```text
Story step 2: model did not match:
$.loadState.reason changed: expected "online", actual "offline"
```

## 19.4 Trace and replay

`runStory` returns:

```ts
type StoryResult<Model, Command> = {
  finalModel: Model
  pendingCommands: ReadonlyArray<Command>
  trace: StoryTrace
}
```

The trace records:

- Program name, schema version, and build version.
- Encoded Flags or the starting Model snapshot.
- Initial Model, fingerprint, and Commands.
- Each ordered Message.
- Whether the Message was ordinary input or a Command resolution.
- The resolved Command when applicable.
- The resulting encoded Model, emitted Commands, and Model fingerprint.

Objects are serialized with sorted keys and fingerprinted with portable
SHA-256. Running the same Story twice must produce byte-identical canonical
JSON.

Replay is deliberately small:

```ts
const replayed = replayStory(todoProgram, result.trace)
```

It decodes the origin, every Message, every stored Model, and every Command
through the Program schemas. It calls only `init` and `update`, compares the
first divergent structural path, and has no interpreter parameter. Therefore
replay cannot perform storage, HTTP, timers, Android APIs, Kotlin, or Swift.

## 19.5 How this supports time travel

Phase 2 provides the portable data contract, not the runtime inspector UI.
Phase 7 can use the stored snapshots as follows:

```text
live head continues to receive Messages
              |
              +--> bounded encoded history
                            |
select sequence --------> decode Model --> render historical Model
resume -----------------> render current live head
```

Selecting a historical sequence must:

1. Decode the stored Model with the matching schema version.
2. Change only the visible renderer Model.
3. Never run the Commands recorded at that sequence.
4. Never acquire a subscription or native resource.
5. Keep the live head separate until Resume.

The current trace is intentionally complete rather than storage-efficient.
Phase 7 must add history bounds, snapshots/deltas, redaction, and protocol
versioning before remote inspection.

## 19.6 Examples and verification

Portable examples are exported from `@orikit/story/examples`:

- Counter increments with no Commands.
- Todo load success.
- Todo add and save completion.
- Todo load failure and explicit retry.

Run:

```text
pnpm verify:portable
```

This checks forbidden platform imports, typechecks all workspaces, and runs
core, trace, and Story tests on Windows without a device.

## 19.7 Known limitations and open decisions

- Pending Commands are structurally ordered but do not yet have command,
  session, or branch IDs. Phase 4 owns those.
- The trace format has `formatVersion: 1`, but migration policy is not yet
  implemented.
- Full snapshots are suitable for correctness fixtures, not unbounded
  production history.
- Redaction and remote transport are Phase 7 work.
- Story currently provides structural expectations rather than arbitrary
  callback assertions.
- The Todo fixture proves portable behavior only. Web and Android views,
  focus, list identity, and renderer performance remain Phase 3.
- iOS execution remains not run until macOS/Xcode evidence exists.

