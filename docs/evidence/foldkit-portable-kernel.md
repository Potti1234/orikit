
# FoldKit portable-kernel experiment, first slice

Date: 2026-07-31

## Outcome

The first slice is successful but by itself does not justify replacing the
OriKit Program or runtime. The subsequent Command-adapter slice has also
passed and is documented in
[FoldKit Command-adapter evidence](foldkit-command-adapter.md).

A local FoldKit clone now has a mechanically enforced `foldkit/portable`
entry point. Real FoldKit Message, Update, and Command APIs from that entry
point run in a shared package consumed by the web build and by NativeScript
Android. On the physical Android device, a real FoldKit Command remained
deferred until the host ran its Effect, dispatched a typed FoldKit Message,
and updated native Android controls. The hierarchy contained an
`android.widget.Button` and `android.widget.TextView`, and no WebView.

The experiment has not proven portable FoldKit Story support, serializable
Command history, replay, cancellation integration, a Todo migration, or iOS.
ADR-0004 therefore remains proposed.

## Local repository state

FoldKit was cloned as a sibling repository:

```text
C:\Users\lpottner\Documents\MaasProjects\foldkit-portable-kernel
```

Source state:

- Origin: `https://github.com/foldkit/foldkit.git`
- Branch: `main`
- Upstream commit: `c826cdbc033cffd49442cd7248806742cc871d39`
- Package version: `foldkit@0.137.0`
- License: MIT
- Local status: modified and untracked experiment files only
- Commits created: none
- Pushes, publications, and pull requests: none

The packed local consumer artifact is:

```text
artifacts/foldkit-local/foldkit-0.137.0.tgz
```

It is ignored local build output. OriKit currently has no `.git`
directory in this workspace, so no OriKit commit was possible or made.

## Plan and decision record

The complete implementation plan was written before FoldKit source changes:

- [FoldKit portable-kernel plan](../nativescript/21-foldkit-portable-kernel-plan.md)
- [ADR-0004](../adr/0009-foldkit-portable-kernel-spike.md)

The plan deliberately keeps the current production runtime and Todo Program
as the fallback until Command, replay, Story, and lifecycle gates pass.

## FoldKit source audit

### Portable today

The first boundary exports these existing implementations without copying
them:

- AsyncData
- Command and Interruptible Command definitions
- FieldValidation
- ManagedResource definitions
- Message/schema helpers
- Schema helpers
- Struct helpers
- Subscription core definitions
- Update helpers

The generated dependency walk reaches 26 transitive source files.

### Conditional or not yet portable

- `subscription/public.ts` also exports animation-frame and DOM-event helpers.
  The portable entry therefore exports only subscription core today.
- `submodel/public.ts` imports HTML submodel support and is excluded.
- Story currently reaches test internals that depend on Mount definitions. It
  needs a separate refactor before it can be claimed as portable.
- FoldKit Command values contain executable Effects. Their `name` and `args`
  are useful portable metadata, but the complete value must not enter
  OriKit history or replay data.
- DevTools schemas may be split later, while overlays and browser bridges must
  remain web-specific.

### Web-specific today

FoldKit Runtime imports `@effect/platform-browser`, HTML, VDOM, navigation,
mounting, browser listeners, and HMR scroll handling. HTML, DOM, Snabbdom,
Canvas, CustomElement, Mount, navigation, renderer, and current Runtime remain
outside the portable boundary.

## Changes in the local FoldKit clone

The clone contains these uncommitted changes:

```text
packages/foldkit/package.json
packages/foldkit/scripts/check-portable-boundary.mjs
packages/foldkit/src/portable/public.ts
packages/foldkit/src/portable/portable.test.ts
packages/foldkit/tsconfig.portable.json
```

They provide:

1. A new `foldkit/portable` export.
2. An optional package-wide `@effect/platform-browser` peer.
3. A recursive import/export graph check that rejects browser platform and
   renderer directories.
4. A no-DOM TypeScript configuration using only `ES2022` libraries.
5. Tests for pure Update composition and deferred Command construction.

The package still contains web files in its tarball. This slice proves an
evaluation and dependency boundary, not yet a physically smaller package.

## OriKit integration

The shared proof is now its own browser-independent workspace package:

```text
packages/foldkit-portable-spike/
```

It owns the same real FoldKit definitions used by both hosts:

- `PortableCounterModel`
- `IncrementedPortableCounter` and `ResetPortableCounter`
- exhaustive `updatePortableCounter`
- `VerifyPortableCommand`
- a deterministic portable fixture
- the explicit host-side Command executor used by the experiment

The web build evaluates the deterministic fixture. The Android app imports
the same package and exposes the proof from the normal Todo screen through the
native `Kernel` action. The proof screen remains NativeScript XML and native
controls. It does not render FoldKit HTML.

The device verifier is:

```text
pnpm verify:android:foldkit-portable:device
```

It clean-installs the app, starts on Todo, navigates to the kernel proof,
checks the log marker, scrolls to the native controls, taps the native button,
and saves hierarchy/report artifacts under `artifacts/foldkit-portable/`.

## Command finding

FoldKit's current Command constructor meets one crucial invariant:
construction did not execute its Effect. The Android evidence was:

```json
{
  "commandName": "VerifyPortableCommand",
  "commandWasDeferred": true,
  "initialCount": 1,
  "countAfterNativeTap": 2
}
```

This does not make the whole Command object serializable. The safe provisional
architecture is:

```text
update returns portable intent
        |
        v
history records serializable identity/name/args only
        |
        v
live host resolves and executes an Effect
        |
        v
typed Message re-enters the runtime
```

Replay must continue to skip execution. Before adoption, an adapter must prove
completion contracts, cancellation, branch/session quarantine, Effect service
requirements, and serialization of the recorded projection.

## Verification results

### FoldKit clone

| Command | Result | Detail |
|---|---|---|
| `pnpm install --frozen-lockfile --ignore-scripts` | PASS | Dependencies installed without lifecycle scripts |
| `pnpm install --frozen-lockfile` | FAIL | Existing root `prepare` command uses POSIX `test`, which Windows cannot parse |
| `pnpm --filter foldkit exec tsc -b tsconfig.build.json` | PASS | Direct build bypasses the Windows-incompatible wildcard clean step |
| `pnpm --filter foldkit check:portable` | PASS | 26 transitive source files, no DOM library |
| `pnpm --filter foldkit test` | PASS | 71 files passed, 1 skipped; 1,681 tests passed, 1 skipped |

The normal package build script is not a clean Windows signal because its
`rimraf dist *.tsbuildinfo` wildcard is rejected on this host. Direct TypeScript
build passed.

### Independent package consumer

An isolated npm consumer outside both workspaces installed the packed FoldKit
artifact with Effect but without `@effect/platform-browser`. Importing
`foldkit/portable`, constructing/running the proof Command, and decoding its
Message passed. The result was:

```json
{
  "command": "ReadValue",
  "message": { "_tag": "CompletedReadValue", "value": 42 },
  "isPlatformBrowserInstalled": false
}
```

This is stronger dependency evidence than the OriKit pnpm workspace,
because that workspace already contains the browser peer for its existing web
application.

### OriKit

| Command | Result | Detail |
|---|---|---|
| `pnpm verify:portable` | PASS | Typechecks and tests all portable, shared, web, and mobile packages |
| `pnpm verify:web` | PASS | Vite production build, including shared portable fixture |
| `pnpm verify:android` | PASS | NativeScript/Gradle debug APK built |
| `pnpm verify:android:foldkit-portable:device` | PASS | Physical Android native hierarchy and interaction passed |
| Android bundle signature scan | PASS | No platform-browser, BrowserRuntime, BrowserHttpClient, BrowserSocket, or BrowserKeyValueStore signatures |
| `pnpm verify:docs` | PASS | 52 Markdown files and internal links verified |

The final physical-device report is:

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

### Packaging and size observations

The measured debug outputs after integration were approximately:

- Android vendor JavaScript: 7.23 MiB
- Android application JavaScript: 261 KiB
- Debug APK: about 101 MiB

These are debug measurements, not release-size conclusions. The vendor bundle
is large enough that release minification, startup, cold/warm launch, and a
before/after dependency comparison are mandatory before adoption. The browser
build also reports an Effect testing-module `node:assert` externalization
warning, although the build succeeds. Import narrowing should be investigated.

## Verification matrix

| Verification | Windows/Node | Browser | Android build | Android device | iOS |
|---|---:|---:|---:|---:|---:|
| Candidate imports without DOM | PASS | PASS | PASS | PASS | NOT_RUN |
| Schema-defined Message/update fixture | PASS | PASS | PASS | PASS | NOT_RUN |
| Command construction is deferred | PASS | Build only | PASS | PASS | NOT_RUN |
| Browser dependency is optional | PASS | n/a | PASS | PASS | NOT_RUN |
| Story/replay executes no Commands | PARTIAL | Existing OriKit only | Existing OriKit only | Existing OriKit only | NOT_RUN |
| Serializable Command history adapter | PARTIAL | NOT_RUN | NOT_RUN | NOT_RUN | NOT_RUN |
| Cancellation and stale callback quarantine | Existing OriKit only | Existing OriKit only | Existing OriKit only | Existing OriKit only | NOT_RUN |
| Native control hierarchy | n/a | n/a | Insufficient alone | PASS | NOT_RUN |
| Shared Todo migration | NOT_RUN | NOT_RUN | NOT_RUN | NOT_RUN | NOT_RUN |

`PASS` for Browser here means the shared portable fixture is included in a
successful browser production build. Browser execution of the FoldKit Command
itself is not yet separately automated.

## Problems discovered

1. FoldKit's root install/build scripts assume a POSIX shell in two places.
2. A shared pnpm workspace can silently satisfy an optional browser peer, so an
   isolated consumer test is required.
3. The existing counter device verifier became stale when Todo became the
   default page. The new verifier navigates explicitly and checks its own
   marker.
4. UIAutomator dumps can fail transiently. The new verifier retries the dump.
5. Android action-bar text is uppercased and did not expose a content
   description on this device. The verifier supports text fallback while the
   XML retains an accessibility label.
6. A portable export prevents runtime browser imports but does not reduce the
   tarball by itself.
7. FoldKit Commands and OriKit's serializable Command descriptions are not
   interchangeable values.
8. Story and Submodel public barrels still cross renderer/test boundaries.

## Upstream-sized change slices

If this experiment continues toward an upstream proposal, keep the changes
small and independent:

1. Add an optional browser peer, `foldkit/portable`, the graph check, no-DOM
   typecheck, and focused tests.
2. Split Subscription core exports from browser animation/event helpers.
3. Refactor Story internals so portable Story does not import Mount/HTML test
   types.
4. Decide with upstream whether the export is sufficient or a physical core
   package is desirable.
5. Keep the NativeScript renderer, Android/iOS capabilities, and OriKit
   runtime adapter in this independent project.

No upstream contact should be made until the Command/history design and Todo
compatibility slice have clearer evidence.

## Next implementation slice (completed)

The following work was completed on 2026-07-31. Its detailed results and the
updated Todo gate are in
[FoldKit Command-adapter evidence](foldkit-command-adapter.md).

1. Define a serializable projection for real FoldKit Commands containing only
   identity, name, args, causal sequence, session, and branch.
2. Adapt the production runtime to execute a live Command Effect while recording
   only that projection.
3. Prove replay regenerates no effects and executes none.
4. Prove cancellation and late completion quarantine with a delayed FoldKit
   Command.
5. Extract portable Story internals and run a canonical counter Story.
6. Only after those pass, migrate the minimum Todo definitions and compare
   deleted versus added adapter code.
7. Run the equivalent matrix on iOS from macOS/Xcode before accepting ADR-0004.


