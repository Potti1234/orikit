
# FoldKit live-Command runtime rewrite

Date: 2026-07-31

## Outcome

OriKit now matches FoldKit's web runtime at the Command execution boundary:
the original live FoldKit Command Effect produced by `update` executes locally,
while runtime history, Story, replay, traces, and snapshots contain only its
serializable description.

The former normal-path reconstruction step was removed. Todo and the portable
Counter no longer register `make(args)` factories that rebuild a Command from
JSON immediately before execution.

```text
                     one live FoldKit Command
                              |
                 +------------+------------+
                 |                         |
                 v                         v
        original Effect executes     { name, args, key }
        under runtime supervision    enters history/replay
```

The rewrite passed Windows, web, Android build, and physical Android device
gates. iOS remains `NOT_RUN`. No FoldKit sibling source change, commit, push,
publication, issue, pull request, or upstream contact was made for this slice.

## Why the rewrite was needed

The first adapter projected a live Command to JSON because the existing
production runtime used one Command representation for both recording and
execution. Its interpreter then used `registry.make(args)` to reconstruct an
equivalent Command.

Serialization was required for history, not for local execution. FoldKit's
web runtime already keeps the two concerns separate: it forks the original
Effect and records only Command name/args metadata. OriKit now follows the
same pattern without adopting FoldKit's browser runtime.

## Runtime API

`@orikit/runtime` adds two ephemeral types:

```ts
type ScheduledCommand<Description, Message> = Readonly<{
  description: Description
  execute: (context: CommandContext) => Promise<Message>
}>

type LiveRuntimeProgram<Flags, Model, Message, Description> = Readonly<{
  init: (flags: Flags) => readonly [Model, ReadonlyArray<ScheduledCommand<Description, Message>>]
  update: (model: Model, message: Message) =>
    readonly [Model, ReadonlyArray<ScheduledCommand<Description, Message>>]
}>
```

`description` passes through the existing schema decoder, completion contract,
event history, snapshots, metrics, cancellation identity, and diagnostics.
`execute` is held only by the active live scheduling path. It is never exposed
by `events()`, `snapshot()`, codecs, Story, traces, or replay.

The existing `interpret(description, context)` path remains available for
data-command Programs. This makes the change backward compatible and bounded.

## FoldKit adapter

`defineFoldKitProgramAdapter` now creates two projections from the same
definition:

1. `program`: serializable descriptions for Story, replay, codecs, and traces;
2. `liveProgram`: descriptions paired with execution of the original Effect.

The adapter still:

- rejects unregistered Command names before scheduling;
- validates args through `Schema.Json`;
- records only `{ _tag, name, args?, key? }`;
- interrupts the original Effect Fiber on runtime cancellation;
- relies on the production runtime to validate terminal Message contracts;
- never executes an Effect while projecting the serializable Program.

The registry now declares completion tags only. It no longer reconstructs
Commands.

## Todo integration

`createTodoProgramAdapter(storage)` now provides `TodoStorageService` to each
live Command as part of its host-specific `init`/`update` result:

```ts
init: () => provideTodoStorage(initTodo(), storage)
update: (model, message) =>
  provideTodoStorage(updateTodo(model, message), storage)
```

The resulting provided Effect is the one scheduled by the runtime. The
adapter does not decode `SaveTodos` args and call `SaveTodos(args)` a second
time.

The serializable `todoProgram` remains unchanged in shape. The canonical
fixture stays `todo-v3`, and its final Model fingerprint remains unchanged.

## Replay and time travel

Story and replay continue to call only `adapter.program.update`. That path
constructs lazy Commands so their descriptions can be compared, then discards
their Effects. It has no `ScheduledCommand.execute` channel.

Native time travel still reconstructs logical Models from serializable
Messages and Command descriptions. It does not repeat storage writes, API
calls, or other Commands. Resume returns to the live head.

## Focused proof

The runtime suite adds a test with both a live executor and a legacy
interpreter. It proves:

- the live executor runs once;
- the fallback interpreter runs zero times;
- events contain the Command description;
- events contain no `execute` function.

The adapter suite counts Command construction and Effect execution. For one
live dispatch it proves:

- one Command construction;
- one Effect execution;
- no reconstruction;
- JSON events contain no `effect` property.

Existing tests continue to prove effect-free repeated projection, Effect Fiber
interruption, stale-branch quarantine, and invalid terminal completion failure.
A sixth adapter test rejects unknown names and non-JSON args before execution.

## Verification

| Command | Result | Detail |
|---|---|---|
| `pnpm verify:portable` | PASS | All type checks and 65 tests |
| `pnpm verify:web` | PASS | FoldKit web build; 413 modules, 228.29 kB JS |
| `pnpm evidence:runtime` | PASS | 10,000 Messages; 35,296/s in this run |
| `pnpm verify:android` | PASS | Repeated as part of all device verifiers |
| `pnpm verify:android:todo:device` | PASS | Add/toggle/edit/delete and canonical trace |
| `pnpm verify:android:foldkit-portable:device` | PASS | Original FoldKit Effect completed; count 1 to 2 |
| `pnpm verify:android:device` | PASS | Effect vectors 10/10 and time travel |
| `pnpm verify:docs` | PASS | 56 Markdown files and local links |
| iOS build/simulator/device | NOT_RUN | Requires macOS and Xcode |

The first Todo device attempt typed `Device_test` but its ADB tap did not
activate the visible Add button. Captured before/after hierarchies were
identical and showed no runtime crash. An unchanged rerun passed every flow.
This is recorded as device-input flakiness, not hidden as a passing first run.

The web build retains the known Effect testing-module `node:assert`
externalization warning. No Node or DOM shim was added.

## Architectural result

OriKit now differs from FoldKit where the platform requires it, not at the
basic live Command lifecycle:

| Concern | FoldKit web | OriKit native |
|---|---|---|
| Execute local Command | Original Effect | Original Effect |
| Record Command | Name/args metadata | JSON description |
| Replay Effects | Never | Never |
| Renderer | HTML/DOM | NativeScript controls |
| Lifecycle/cancellation host | Browser runtime | OriKit production runtime |
| Stale native completion quarantine | Browser semantics | Session/branch/active checks |

The remaining custom native runtime is justified by native lifecycle,
renderer, diagnostic, and stale-callback requirements rather than by a
different Command execution model.


