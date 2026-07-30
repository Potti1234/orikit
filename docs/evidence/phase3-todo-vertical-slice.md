# Phase 3 Todo web and Android vertical slice

Date: 2026-07-30

## Outcome

Phase 3 passes on web and a physical Android device.

The same schema-defined `TodoModel`, typed `TodoMessage`, serializable
`TodoCommand`, `init`, and synchronous pure `updateTodo` serve:

- A normal Foldkit web application with an `HtmlBuilder` view and Foldkit
  `Command` adapters.
- A vanilla NativeScript application with a feature-specific native view
  description, real native controls, and keyed list reconciliation.

No portable view AST, React, Vue, Angular, KMP runtime, or compiler was added.

## Implemented behavior

The portable Todo Program supports:

- Initial load and explicit load retry.
- Add with deterministic Model-owned IDs.
- Inline edit and cancel.
- Toggle complete/incomplete.
- Delete.
- Optimistic save, save completion, failure, and explicit retry.
- An in-memory Command interpreter whose results re-enter as typed Messages.
- Canonical transition serialization and fingerprints.

Structural Stories cover load, add/save, edit, toggle/delete, load
failure/retry, and save failure/retry.

## Web evidence

The web target uses Foldkit `Runtime.makeApplication`, `Document`,
`HtmlBuilder`, Commands, and Scene. It is not a bespoke replacement runtime.
Four Foldkit Scene tests cover add, toggle/delete, edit, and load recovery.

A headed Chromium run exercised add, toggle, edit, and delete against the Vite
application. The resulting accessibility snapshot showed labeled textbox,
button, checkbox, list, status, and inline editor semantics. Browser console
result: zero errors and zero warnings.

The visual direction is calm, precise, and Apple-inspired without claiming
pixel identity: tinted neutral canvas, restrained blue actions, strong type
hierarchy, generous spacing, and native HTML controls. No bespoke imagery is
appropriate for this utility workflow.

Artifact:

- `output/playwright/todo-web.png`

## Android native evidence

Device:

- Samsung SM-G781B.
- Android API 33.
- USB device serial `RFCT80EYE0F`.

The repeatable device verifier:

1. Builds the NativeScript Android application.
2. Installs and cold-starts the APK.
3. Waits for the Todo readiness record.
4. Dumps the Android accessibility hierarchy.
5. Requires `android.widget.EditText`, `android.widget.ListView`, and
   `android.widget.Button`.
6. Rejects `android.webkit.WebView`.
7. Types a draft and confirms the native input remains focused.
8. Adds, toggles, edits, and deletes a Todo.
9. Confirms toggle semantics update after row reuse.
10. Confirms deleted data does not survive in a recycled row.
11. Reassembles the chunked Android trace and compares it byte-for-byte with
    the portable canonical trace.

Result:

```json
{
  "status": "pass",
  "nativeClasses": [
    "android.widget.EditText",
    "android.widget.ListView",
    "android.widget.Button"
  ],
  "webViewPresent": false,
  "flows": ["add", "toggle", "edit", "delete"],
  "focusStableWhileTyping": true,
  "staleRecycledRowAfterDelete": false,
  "canonicalTraceMatchesPortable": true
}
```

Artifacts:

- `artifacts/phase3/android-todo-report.json`
- `artifacts/phase3/android-todo-initial.xml`
- `artifacts/phase3/android-todo-initial.png`
- `artifacts/phase3/android-todo-final.png`
- Intermediate hierarchy dumps for draft, add, toggle, edit, and delete.

## Exit criteria

| Criterion | Status | Evidence |
|---|---|---|
| One update serves web and Android | Passed | Both adapters import `@orikit/todo`; there is one `updateTodo` |
| Text focus is stable | Passed | Physical device typed-draft hierarchy has `focused="true"` and the expected text |
| Row identity and recycling are correct | Passed | Keyed reconciliation tests plus physical toggle/delete hierarchy checks |
| Web and Android traces match | Passed | Both execute `runTodoFixture`; Android output equals the portable canonical trace byte-for-byte |
| Both views pass semantic flows | Passed | Four Foldkit Scene tests, four NativeScene/reconciliation tests, headed Chromium, and physical Android flows |
| No premature portable view AST | Passed | Web uses Foldkit HTML; Android uses a feature-specific Todo description and XML |

## Verification

Passed:

```text
pnpm --filter @orikit/web-spike typecheck
pnpm --filter @orikit/web-spike test
pnpm --filter @orikit/web-spike build
pnpm --filter @orikit/mobile-spike typecheck
pnpm --filter @orikit/mobile-spike test
pnpm verify:portable
pnpm verify:android:todo:device
```

Portable verification ran 45 tests across core, Todo, trace, Story, web Scene,
and native semantic/reconciliation suites. The Android build succeeded after
excluding `*.test.ts` files from NativeScript's application context.

Toolchain:

- Node 26.4.0.
- pnpm 11.17.0.
- NativeScript CLI 9.0.6.
- `@nativescript/core` 9.0.20.
- `@nativescript/android` 9.0.5.
- JDK 21.0.10 from Android Studio.

Not run:

- iOS build, simulator, VoiceOver, and physical iPhone. Windows cannot provide
  Xcode evidence, so no iOS claim is made.

## Duplication and pain points

The separate-view strategy worked, but the measured duplication is real:

- Web `Command` definitions and the NativeScript interpreter separately map
  the same portable Command descriptions to storage.
- Web HTML and NativeScript XML repeat layout and accessible copy.
- The native view description supplies typed row messages and render state,
  while XML still owns the concrete control tree. Tests are needed to prevent
  drift between them.
- NativeScript styling follows platform theme behavior; exact colors and
  control geometry diverge more than the web view. This is acceptable for
  native feel but requires Android and iOS visual review.
- NativeScript's default application context included colocated test files
  until an explicit webpack context exclusion was added.
- The bounded Todo application schedules Commands by observing the Phase 1
  history runtime. It preserves command-after-commit behavior, but lacks the
  cancellation, session, branch, and late-callback guarantees required from
  Phase 4.

The evidence does not justify a general view AST yet. Separate views plus a
small feature projection remain the lower-risk choice until the Phase 9
decision gate.

## Time travel boundary

Todo transitions and canonical history data are replay-safe: Models, Messages,
and Commands contain no native handles, DOM nodes, callbacks, or promises.
Replay remains effect-free because recorded Commands are descriptions only.

Phase 3 does not add a Todo debugger UI or remote inspector. The existing
bounded runtime records transitions, but production branch/session semantics,
resource quarantine, and the cross-platform inspector belong to Phases 4 and
7. This avoids presenting spike history behavior as the finished
multi-platform time-travel design.

## Next phase

Phase 4 replaces the bounded application adapter with the production runtime
MVP: command-after-commit scheduling, session/branch/sequence IDs,
cancellation, stale-callback quarantine, lifecycle reporting, crash state,
and dispatch stress tests.
