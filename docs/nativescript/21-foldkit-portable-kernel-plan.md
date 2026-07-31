

# 20. FoldKit portable-kernel experiment

## 20.1 Purpose

Determine whether OriKit can use an upstreamable, browser-independent
subset of the real FoldKit implementation for shared application programs
while retaining NativeScript renderers and native Android/iOS capabilities.

This is a bounded architecture experiment. It does not authorize a permanent
FoldKit fork, publication, a shared HTML-to-native renderer, or replacement of
the working OriKit runtime before the decision gates in this document pass.

The desired end state is:

```text
                     browser-independent FoldKit kernel
               Schema / Message / Update / Command / Story
                                  |
                    +-------------+-------------+
                    |                           |
                    v                           v
             FoldKit web host          OriKit native host
             HTML / DOM / web          NativeScript / Android / iOS
```

The experiment must preserve the existing invariants:

- `update` is synchronous, deterministic, and effect-free.
- Model, Message, portable Command descriptions, history, and replay data are
  serializable and contain no platform handles.
- Replay never executes Commands.
- Native events dispatch typed Messages.
- NativeScript remains the renderer and platform host.
- Web remains a normal FoldKit application.

## 20.2 Why this experiment is separate from the main roadmap

ADR-0003 selected separate runtimes because the published FoldKit runtime is
browser-oriented and OriKit needed structural cancellation, lifecycle
diagnostics, and stale-callback quarantine. The current implementation proves
the product architecture without requiring changes to upstream FoldKit.

The FoldKit repository now exposes narrow subpath modules, and several appear
portable. Before duplicating more FoldKit concepts, this experiment measures
whether those modules can become an official browser-independent boundary.

The experiment pauses before any production migration. Its result will update
ADR-0009 to `Accepted` or `Rejected`, with an explicit migration plan if
accepted.

## 20.3 Repository topology

Keep the upstream experiment outside the OriKit source tree so the clone
retains its own Git metadata and cannot accidentally become a nested repository:

```text
MaasProjects/
|- orikit/                 existing project; all changes remain uncommitted
`- foldkit-portable-kernel/    local clone of foldkit/foldkit; no commits/pushes
```

Record the exact upstream commit in the evidence document. Do not modify the
FoldKit clone until its `AGENTS.md`, contribution instructions, package
scripts, and license have been read.

No command in this experiment may:

- commit, push, publish, open a pull request, or create a release;
- rewrite or delete user work;
- change the OriKit or FoldKit license;
- claim that FoldKit officially supports NativeScript;
- claim iOS support without macOS/Xcode evidence.

## 20.4 Baseline observations to verify

At the upstream commit inspected on 2026-07-31:

- `foldkit/message` delegates to schema helpers and appears portable.
- `foldkit/command` imports Effect and internal command modules, not the DOM.
- `foldkit/runtime` directly imports `BrowserRuntime`, HTML, virtual DOM,
  navigation, browser listeners, mounting, and scroll/HMR support.
- `foldkit/subscription` mixes potentially portable definitions with browser
  facilities such as animation frames and DOM events.
- the published `foldkit` package declares `@effect/platform-browser` as a
  package-wide peer dependency.
- FoldKit Commands contain executable Effects, while OriKit Commands are
  serializable descriptions interpreted by a host.

All observations must be confirmed from the cloned source and import graphs.

## 20.5 Questions the spike must answer

1. Which real FoldKit modules evaluate in Node and NativeScript Android with no
   DOM globals and no `@effect/platform-browser` runtime dependency?
2. Can FoldKit publish those modules through a genuinely browser-independent
   package or export condition without breaking existing web consumers?
3. Can FoldKit Message, update helpers, Command metadata, and Story semantics
   satisfy OriKit's serialization and replay invariants?
4. Can executable FoldKit Command Effects remain outside `update` while using
   platform-neutral Effect services on Android?
5. Can the existing OriKit Promise/abort runtime execute or adapt the
   portable Command representation without losing cancellation, command
   identity, completion contracts, or stale-callback quarantine?
6. Does adopting the kernel reduce code and semantic duplication enough to
   justify upstream coupling?
7. What remains NativeScript-specific even after the extraction?
8. Can the proposed change be presented upstream as a small generally useful
   separation rather than a NativeScript-specific rewrite?

## 20.6 Non-goals

- Do not port FoldKit HTML, DOM, Snabbdom, Mount, Canvas, CustomElement, or web
  navigation to NativeScript.
- Do not translate arbitrary FoldKit HTML into native controls.
- Do not create a shared view AST.
- Do not replace the native renderer.
- Do not implement iOS on Windows.
- Do not publish an `@foldkit/*` package from this project.
- Do not maintain a long-lived fork unless upstream contribution is rejected
  and a later accepted ADR proves that vendoring is worth its cost.
- Do not migrate Todo merely to maximize reused lines.

## 20.7 Candidate boundary

Audit these modules in this order:

| Candidate | Expected disposition | Required proof |
|---|---|---|
| Message/schema helpers | Portable | Node and Android import/evaluation |
| Update helpers | Portable | Pure transition fixtures match |
| AsyncData/brand/struct/field validation | Likely portable | Import graph and focused tests |
| Command definition and mapping | Conditional | No browser import; metadata and replay contract |
| Story | Conditional | No DOM evaluation; canonical Todo story |
| Submodel/OutMessage | Conditional | No renderer dependency |
| DevTools protocol/schema summary | Split candidate | Protocol has no DOM; host/overlay stay web |
| Subscription core | Split candidate | Core lifecycle separate from DOM events/RAF |
| ManagedResource core | Conditional | No browser handles in portable values |
| Runtime | Web-specific today | Do not move wholesale; identify reusable scheduler only |
| Scene/HTML/DOM/render/navigation | Web-specific | Remain in web package |

The smallest plausible upstream package is provisionally called
`@foldkit/core` in this document. The name is illustrative and must not be
published or presented as decided without upstream agreement.

## 20.8 Planned FoldKit changes

Implement changes in small, independently testable slices.

### Slice A Ã¢â‚¬â€ dependency and import audit

1. Pin and record the upstream commit.
2. Generate an import matrix for every exported subpath.
3. Classify imports as portable, Node-only, browser-only, or test-only.
4. Add a static check that the candidate kernel does not import:
   - `@effect/platform-browser`;
   - HTML, DOM, render, navigation, mount, or Snabbdom modules;
   - browser globals or DOM types in its public declarations.
5. Run the unmodified FoldKit baseline build and focused tests.

### Slice B Ã¢â‚¬â€ establish a package boundary

Prefer a new workspace package over deleting code from `foldkit`:

```text
packages/
|- foldkit-core/       candidate portable source/package
`- foldkit/            existing compatible web package
```

If moving source would make the first experiment too invasive, create an
internal package boundary that re-exports existing portable modules, backed by
the static dependency check. Only move implementations after tests demonstrate
the boundary.

The existing `foldkit` package should re-export the portable APIs so current
imports keep working. The experiment must document any unavoidable breaking
change rather than hiding it.

### Slice C Ã¢â‚¬â€ Command compatibility

**Status: completed and refined on Windows and physical Android on
2026-07-31.** The initial metadata adapter safely reconstructed Commands. The
follow-up live-Command rewrite now executes the original Effect and records the
same serializable description, matching FoldKit's web runtime pattern without
weakening the production runtime. See
[Command-adapter evidence](../evidence/foldkit-command-adapter.md) and
[live-Command evidence](../evidence/foldkit-live-command-runtime.md).

Test two adapters without committing to either design:

1. **Metadata adapter:** retain OriKit serializable Command descriptions
   and map them to/from FoldKit Command names and args at host boundaries.
2. **Effect-service adapter:** construct FoldKit Commands whose Effects depend
   only on abstract services, then provide browser and NativeScript layers.

For each option verify:

- constructing a Command executes no effect;
- public history contains only serializable name/args/identity;
- replay calls `update` but never executes regenerated effects;
- Story can resolve a Command without platform work;
- cancellation prevents its completion Message from mutating a stale session;
- invalid terminal Messages are rejected;
- no native object enters Model, Message, args, history, or trace.

Do not remove the existing OriKit Command contract until one option meets
all gates and ADR-0009 is accepted.

### Slice D Ã¢â‚¬â€ Android NativeScript proof

**Status: completed on a physical Android device on 2026-07-31.** The native
host executed a reconstructed FoldKit Effect, received its typed Message, and
rendered the result through `android.widget.TextView`; no WebView was present.

Add a minimal mobile-only compatibility fixture before migrating Todo:

1. Import the candidate package through a local package reference.
2. Define a Counter Model and schema-defined Messages with real FoldKit APIs.
3. Execute the same pure update fixture on Node and Android.
4. Construct and inspect one FoldKit Command without executing browser code.
5. Execute one abstract-service Effect, if Slice C option 2 remains viable.
6. Dispatch the result Message through the existing OriKit runtime.
7. Render the result using the existing NativeScript Label/Button controls.
8. Emit a canonical trace and compare it byte-for-byte with Node.
9. Inspect the Android hierarchy and confirm there is no WebView.

The initial fixture must not replace the Todo screen. Todo migration is a
separate gate after the compatibility fixture passes.

### Slice E Ã¢â‚¬â€ Todo compatibility proof

**Status: completed on Windows, web, and a physical Android device on
2026-07-31.** Todo now uses real portable FoldKit Message and Command
definitions on both hosts, while retaining separate FoldKit HTML and
NativeScript views. See
[Todo migration evidence](../evidence/foldkit-todo-migration.md). iOS remains
`NOT_RUN`.

If Slice D passes:

1. Convert only the minimum Todo definitions needed to use candidate official
   FoldKit helpers.
2. Preserve the exact `updateTodo` behavior and canonical fixtures.
3. Keep separate FoldKit web and NativeScript native views.
4. Keep the existing OriKit runtime unless the Command experiment proves
   a replacement safe.
5. Run web Scene, portable Story, native semantic, trace, Android build, and
   physical-device tests.
6. Record the deleted adapters and any new adapters. A migration that merely
   moves duplication elsewhere does not pass.

## 20.9 OriKit integration mechanism

During development, use local package references only. Do not publish a test
package. Prefer a packed tarball produced by the FoldKit clone over directly
linking source if NativeScript's bundler handles it more like a real consumer.

Test both where useful:

```text
workspace/file reference -> fast development feedback
pnpm pack tarball         -> realistic package-consumer proof
```

Do not permanently add the sibling clone to `pnpm-workspace.yaml`. Record any
NativeScript/pnpm symlink problem explicitly.

## 20.10 Verification matrix

Every row must be reported as `PASS`, `FAIL`, `PARTIAL`, or `NOT_RUN`.

| Verification | Windows/Node | Browser | Android build | Android device | iOS |
|---|---:|---:|---:|---:|---:|
| Candidate package imports without DOM | required | required | required | required | later |
| Schema encode/decode | required | required | required | required | later |
| Pure update trace | required | required | required | required | later |
| Command construction is effect-free | required | required | required | required | later |
| Story/replay executes no Commands | required | required | build proof | required | later |
| Native control hierarchy | n/a | n/a | insufficient | required | later |
| Existing Todo regression suite | required | required | required | required | later |

Required OriKit commands after integration:

```text
pnpm verify:portable
pnpm verify:web
pnpm verify:android
pnpm verify:android:device
pnpm verify:android:todo:device
pnpm verify:docs
```

Add focused commands for the kernel compatibility fixture rather than hiding
it inside a broad suite.

Before device verification record, without publishing the device serial:

```text
node --version
pnpm --version
java -version
adb version
adb devices -l
ns --version
ns doctor android
```

## 20.11 Decision gates

Accept the portable-kernel direction only if:

1. The candidate package has a mechanically enforced browser-free import
   boundary.
2. Node, web, and physical Android produce equivalent logical traces.
3. No browser peer dependency is needed by the native consumer.
4. Replay remains effect-free.
5. Native lifecycle cancellation and stale-completion quarantine remain at
   least as strong as ADR-0003.
6. Existing FoldKit web usage remains compatible or has a small documented
   migration.
7. The Todo proof removes meaningful duplicated contracts or adapters.
8. The extraction can be explained as useful to FoldKit beyond NativeScript.
9. License and third-party notices are complete.

Reject or pause it if:

- the portable boundary requires DOM shims;
- the root browser package must execute on native;
- Command Effects make deterministic cross-platform inspection weaker;
- maintaining the extraction requires broad invasive runtime changes;
- Android works only through NativeScript-specific patches inside the core;
- the upstream API changes too quickly to maintain compatibility;
- iOS later fails on JavaScriptCore.

## 20.12 Upstream contribution strategy

Do not start with a large NativeScript PR. After local evidence exists:

1. Prepare a concise import/dependency report.
2. Explain non-browser use cases: deterministic tests, workers, CLI/Node hosts,
   alternative renderers, and NativeScript.
3. Open a discussion or focused issue with the FoldKit maintainers.
4. Propose the smallest backward-compatible package boundary.
5. Offer portable dependency checks and Node tests first.
6. Keep the NativeScript runtime in OriKit unless maintainers explicitly
   want it upstream.
7. Ask before using names that could imply official endorsement.

No issue, PR, or external message is authorized by this local experiment.

## 20.13 Evidence document

Create `docs/evidence/foldkit-portable-kernel.md` during implementation with:

- upstream repository URL and exact commit;
- FoldKit, Effect, NativeScript, Node, pnpm, JDK, Android SDK, and device API
  versions;
- files changed in both local repositories;
- baseline and post-change commands;
- import matrix and package graph;
- Node/browser/Android trace comparison;
- native hierarchy evidence;
- Command option results;
- regression results;
- failures and workarounds explicitly rejected;
- estimated upstream PR slices;
- recommended ADR-0009 status;
- iOS work explicitly marked `NOT_RUN`.

## 20.14 Reversal and cleanup

The experiment remains reversible because:

- the FoldKit clone is a sibling repository;
- OriKit uses local package references only;
- the existing Program, runtime, renderer, and fixtures remain present until
  the decision gate;
- no package is published;
- no commits or pushes are created.

If rejected, remove only the experiment-specific local dependency and fixture,
retain the evidence and ADR, and continue with the accepted OriKit roadmap.
Do not delete the sibling clone or experimental files without explicit user
authorization.




