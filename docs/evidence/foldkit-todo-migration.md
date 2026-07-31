
# FoldKit Todo compatibility migration

Date: 2026-07-31

## Outcome

Slice E passes on Windows, the web production build, the Android build, and a
physical Android device. Todo now defines its shared Messages and Commands with
real `foldkit/portable` APIs. The same pure `updateTodo` serves FoldKit web and
the NativeScript Android host.

The platform views were intentionally not unified:

- web remains a normal FoldKit HTML application;
- Android remains a NativeScript application using real native controls;
- the production native runtime still owns history, cancellation, lifecycle,
  crash status, and stale-completion quarantine.

iOS remains `NOT_RUN`. No commit, push, publication, issue, pull request, or
upstream contact was made.

## Shared architecture after migration

```text
                       packages/todo
       Model + real FoldKit Message.m + pure updateTodo
        real LoadTodos / SaveTodos Command definitions
                  typed TodoStorage service
                            |
              +-------------+-------------+
              |                           |
              v                           v
        FoldKit web runtime        OriKit adapter/runtime
        provide web storage        JSON Command descriptions
        FoldKit HTML view          provide native storage
                                    NativeScript view
```

`updateTodo` is synchronous and only constructs Commands. Storage access begins
when a host runs the Command Effect. Both success and expected failure return as
typed Todo Messages.

## What changed

### Shared Todo package

- Fourteen Todo Message schemas now use real FoldKit `Message.m`.
- `LoadTodos` and `SaveTodos` are real FoldKit Command definitions.
- One typed Effect service, `TodoStorageService`, represents the capability.
- `initTodo` and `updateTodo` return real FoldKit Commands.
- `provideTodoStorage` supplies the capability for a FoldKit host.
- `createTodoProgramAdapter` supplies it to the original live Command scheduled
  by the native runtime.
- `todoProgram` remains the renderer-neutral serializable Program consumed by
  Story, trace, replay, and native runtime code.

### Web host

The former web duplication was removed:

- no second `LoadTodosCommand` implementation;
- no second `SaveTodosCommand` implementation;
- no `adaptCommand` switch;
- no transition mapper converting OriKit data Commands into FoldKit
  Commands.

The web host now calls the same `initTodo` and `updateTodo` and performs only
one host responsibility: providing its storage capability. The web application
was aligned to the same local FoldKit 0.137 artifact as the portable package;
mixing FoldKit 0.134 and 0.137 produced incompatible branded Command
definitions and was rejected.

### Native host

The NativeScript view and native reconciliation code did not change. The Todo
application now creates the production runtime through
`createTodoProgramAdapter(storage)`. History contains only:

```json
{
  "_tag": "SaveTodos",
  "name": "SaveTodos",
  "args": { "todos": [] }
}
```

It never contains an Effect, Promise, callback, storage object, DOM node, or
native handle.

## Duplication assessment

The migration passes the meaningful-duplication gate even though safety code
was added at the native boundary.

| Before | After |
|---|---|
| Custom tagged Todo Message definitions | Real FoldKit Message definitions |
| Data-only `LoadTodos`/`SaveTodos` schemas | Real shared FoldKit Commands |
| Separate web FoldKit Command implementations | Removed |
| Web `adaptCommand` switch | Removed |
| Web transition Command mapper | Removed |
| Native Promise interpreter switch | Original shared Command Effect plus recorded metadata |
| Host behavior duplicated | Hosts only provide `TodoStorage` and their view |

The adapter validates JSON metadata and declares allowed terminal Message
tags. The later live-Command rewrite removed executable Command
reconstruction; the original Effect now executes while only its description
enters history. See
[the runtime rewrite evidence](foldkit-live-command-runtime.md).

## Behavior and replay preservation

All existing Todo flows retain their Model semantics:

- load and load failure/retry;
- add with trimming and deterministic IDs;
- edit, commit, and cancel;
- toggle and delete;
- optimistic save and save failure/retry.

The canonical fixture was deliberately versioned from `todo-v2` to `todo-v3`
because Command records now use the adapter's explicit `{ _tag, name, args }`
format and the Program schema version is 3. Model behavior and the final Model
fingerprint remain unchanged. Windows and physical Android produced the same
complete `todo-v3` trace byte-for-byte.

Story and replay operate on the serializable `todoProgram`. They reconstruct
transitions but do not provide `TodoStorageService`, so Command Effects cannot
execute or acquire storage during replay. The existing five Todo Stories and
replay tests pass.

## Verification

| Command | Result | Detail |
|---|---|---|
| `pnpm verify:portable` | PASS | Import boundary, all type checks, 65 tests after live-Command rewrite |
| `pnpm verify:web` | PASS | Vite production build, 413 modules |
| `pnpm evidence:runtime` | PASS | 10,000/10,000 Messages, Running status |
| `pnpm verify:android` | PASS | NativeScript/Gradle debug APK |
| `pnpm verify:android:todo:device` | PASS | All Todo flows and trace on physical device |
| `pnpm verify:android:foldkit-portable:device` | PASS | Counter compatibility route still passes |
| `pnpm verify:android:device` | PASS | Original counter, Effect, and time-travel gate after native Todo-to-Kernel navigation |

One first `pnpm verify:portable` run hit the unchanged runtime stress test's
five-second Vitest timeout under load. The isolated runtime suite passed in
3.83 seconds, and the complete portable gate then passed in 3.31 seconds for
that suite. No runtime code was changed for the timing fluctuation.

## Physical Android evidence

```json
{
  "status": "pass",
  "device": "authorized physical Android device",
  "nativeClasses": [
    "android.widget.EditText",
    "android.widget.ListView",
    "android.widget.Button"
  ],
  "webViewPresent": false,
  "flows": ["add", "toggle", "edit", "delete"],
  "focusStableWhileTyping": true,
  "staleRecycledRowAfterDelete": false,
  "canonicalTraceMatchesPortable": true,
  "productionRuntimeStatus": "Running"
}
```

The independent kernel route additionally passed with count `1 -> 2`, native
Button/TextView classes, and no WebView.

## Problems found and fixes

1. The web app originally depended on FoldKit 0.134 while the portable
   artifact is 0.137. Unique branded Command definition types cannot safely
   cross those package versions. The web host now uses the same pinned local
   artifact.
2. FoldKit 0.137 renamed the Scene origin helper from `with` to `given`; the
   four semantic web Scenes were migrated and pass.
3. `tsx -e` executes through a CommonJS resolver, but the experimental
   `foldkit/portable` export intentionally has `import` and `types` conditions
   only. The Android verifier now invokes an explicit `.mts` trace script.
4. The Todo device verifier applied `-notmatch` directly to an array of log
   lines, which returns nonmatching elements rather than one boolean. It now
   joins the log before checking the structured readiness marker.
5. The web build still reports the known Effect testing-module `node:assert`
   externalization warning. The build succeeds; no Node or DOM shim was added
   to portable/native code.
6. The original Android feasibility verifier assumed the counter was the
   startup view. Todo is now the intended startup view, so the verifier waits
   for Todo readiness and taps the native Kernel route before running its
   unchanged counter and time-travel assertions.

## Gate result and next decision

The portable-kernel experiment now passes the local Windows/web/Android Todo
gate and removes meaningful duplicated contracts. This supports continuing
the architecture experimentally.

ADR-0004 remains **Proposed**, because the project has not yet proven:

- NativeScript iOS and JavaScriptCore behavior on macOS/Xcode;
- a physical iPhone run;
- upstream maintainers' preferred package boundary;
- release bundle size and startup performance.

The next architecture work should either perform the iOS bring-up or prepare a
small upstream discussion package consisting only of the portable boundary,
dependency check, and evidence. No upstream contact is authorized by this
document.


