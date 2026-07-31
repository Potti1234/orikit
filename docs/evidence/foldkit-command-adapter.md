
# FoldKit portable Command adapter, second slice

Date: 2026-07-31

> Historical note: this document records the first safe reconstruction-based
> adapter. The normal execution path was subsequently simplified to execute
> the original live Command while recording the same JSON metadata. See the
> [live-Command runtime evidence](foldkit-live-command-runtime.md).

## Outcome

The metadata-adapter option passes its Windows, web-build, Android-build, and
physical-Android gates. OriKit can now define Model, Message, Update, and
Command with real `foldkit/portable` APIs while retaining the existing
production runtime's serializable history, completion contracts, structural
cancellation, and stale-completion quarantine.

This result authorizes the bounded Todo compatibility proof in Slice E. It
does not accept ADR-0004 for production, replace FoldKit's browser runtime,
claim iOS support, or authorize a general renderer.

## Chosen boundary

The adapter deliberately separates a live FoldKit Command from its recorded
description:

```text
typed FoldKit Message
        |
        v
pure FoldKit update -> [Model, live FoldKit Commands]
        |
        v
adapter projects immediately to JSON { _tag, name, args?, key? }
        |
        +--------------------> history / Story / replay / diagnostics
        |                       (never contains or executes Effect)
        v
live interpreter reconstructs registered FoldKit Command
        |
        v
Effect fiber -> typed completion Message -> production runtime
```

The executable Effect is never placed in Model, Message, history, Story trace,
or replay data. The production runtime remains renderer-neutral and knows only
the serializable description. A registry outside `update` reconstructs the
live Command by name and JSON args.

## Implementation

### New adapter package

`packages/foldkit-runtime-adapter` provides:

- `FoldKitCommandDescription`, a Schema-validated JSON representation;
- `defineFoldKitProgramAdapter`, which projects real FoldKit Update results to
  the existing portable Program contract;
- a reviewed Command registry with allowed completion Message tags;
- a live interpreter that reconstructs the Command and runs its Effect fiber;
- `createFoldKitProductionRuntime`, which retains the existing runtime.

The interpreter connects the runtime abort signal to Effect fiber
interruption. Dispose and branch replacement therefore run Effect finalizers,
cancel the active command, and prevent a completion from changing stale state.

### Counter integration

`packages/foldkit-portable-spike` now uses this complete path:

1. `RequestedPortableIncrement` is dispatched.
2. The real FoldKit `updatePortableCounter` returns
   `VerifyPortableCommand()`.
3. History records `{ _tag: "VerifyPortableCommand", name:
   "VerifyPortableCommand" }` only.
4. The adapter reconstructs the real Command and executes its Effect.
5. `IncrementedPortableCounter` re-enters the runtime.
6. NativeScript observes the production runtime Model and patches a native
   Android label.

The former mobile-only helper that manually ran `command.effect` and manually
dispatched its result was removed from the proof path.

## Focused behavioral proof

The adapter tests cover five contracts:

1. Live execution records only JSON Command metadata and dispatches the typed
   completion Message.
2. Story resolution and replay produce the correct Model without running the
   Command Effect.
3. Runtime disposal interrupts the Effect fiber and executes its finalizer.
4. Branch replacement cancels the fiber and quarantines its rejected stale
   completion.
5. A completion Message outside the registered contract crashes with an
   inspectable `CommandContractError`.

The Story test deliberately resolves the recorded Command description. It
executes `update` during the original run and replay, but the execution counter
remains zero. This proves replay does not acquire resources or execute a
regenerated Effect.

FoldKit's own Story internals are still coupled to renderer test modules and
are not part of `foldkit/portable`. This is an upstream extraction opportunity,
not a blocker for the Todo proof, because the renderer-neutral OriKit Story
engine consumes the real FoldKit program through the adapter.

## Verification results

| Command | Result | Detail |
|---|---|---|
| `pnpm --filter @orikit/foldkit-runtime-adapter typecheck` | PASS | Strict TypeScript |
| `pnpm --filter @orikit/foldkit-runtime-adapter test` | PASS | 5 tests passed |
| `pnpm verify:portable` | PASS | 9 projects; 63 tests passed in total |
| `pnpm verify:web` | PASS | Vite production build, 437 modules |
| `pnpm verify:android` | PASS | NativeScript/Gradle debug APK built |
| `pnpm verify:android:foldkit-portable:device` | PASS | Installed and exercised on connected phone |

The browser build still emits the previously recorded warning that Effect's
testing `TestSchema` module references externalized `node:assert`. The build
passes, and the Android bundle does not import Node. Import narrowing remains a
size/cleanliness task for later; no shim was added.

## Physical Android evidence

The verifier rebuilt and installed the APK, navigated from Todo to the kernel
screen, waited for the adapted FoldKit Command, inspected UIAutomator output,
and tapped the native Button.

```json
{
  "status": "passed",
  "commandName": "VerifyPortableCommand",
  "commandWasDeferred": true,
  "initialCount": 1,
  "countAfterNativeTap": 2,
  "nativeButton": "android.widget.Button",
  "nativeLabel": "android.widget.TextView",
  "webViewPresent": false
}
```

Generated local evidence is under `artifacts/foldkit-portable/`.

## Gate assessment

| Gate | Result |
|---|---|
| Pure synchronous update | PASS |
| Real FoldKit Message/Update/Command definitions | PASS |
| JSON-only history and diagnostics | PASS |
| Story and replay execute no Commands | PASS |
| Typed completion contract | PASS |
| Dispose interrupts Effect and runs finalizer | PASS |
| Stale branch cannot mutate live Model | PASS |
| Portable import boundary | PASS |
| Web production compilation | PASS |
| Physical Android native UI | PASS |
| Todo definition migration | NOT_RUN |
| iOS simulator/device | NOT_RUN |

## Todo migration decision

Slice E was subsequently completed. See
[FoldKit Todo migration evidence](foldkit-todo-migration.md). The implemented
scope followed this definition-first plan:

1. Add a real FoldKit Message union for the existing Todo messages.
2. Convert `initTodo` and `updateTodo` to return real FoldKit Commands.
3. Register `LoadTodos` and `SaveTodos` with JSON args and typed completions in
   the adapter.
4. Keep the current OriKit production runtime for native lifecycle,
   cancellation, diagnostics, and history.
5. Keep the existing FoldKit HTML web view and NativeScript native view.
6. Run every existing Todo Story and canonical fixture unchanged in meaning.
7. Compare code removed against adapter/registry code added.
8. Run web, Android build, Todo device, and portable-kernel device verification.

Stop the migration if it requires native objects in portable data, duplicated
Message definitions per host, DOM shims, or weaker replay/cancellation.

## Remaining risks and open work

- FoldKit is pre-1.0, so the adapter must pin and test the supported version.
- The reconstruction boilerplate described above was removed by the subsequent
  live-Command runtime rewrite. The registry still declares allowed completion
  tags and validates Command names.
- The browser bundle warning and bundle-size impact need release-build
  measurement before adoption.
- Portable upstream FoldKit Story remains unextracted.
- iOS JavaScriptCore, NativeScript iOS, Xcode build, simulator, and physical
  iPhone tests remain `NOT_RUN`.
- No commit, push, publication, issue, or pull request was created.

## ADR status

ADR-0004 remains **Proposed**. The Command/history/replay gate is open, so the
next work is the bounded Todo compatibility proof. Acceptance still requires
that proof to remove meaningful duplication and later requires macOS/iOS
evidence before a cross-platform support claim.


