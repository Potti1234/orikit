

# ADR-0009: Investigate an upstreamable FoldKit portable kernel

## Status

Proposed for local experiment on 2026-07-31. Not yet accepted for production
migration.

The portable boundary, Command adapter, and bounded Todo migration passed on
Windows, web, and physical Android. Serializable Command history, effect-free
Story/replay, Effect-fiber cancellation, completion contracts, shared real
FoldKit Todo definitions, and native rendering are proven. The local
web/Android direction is supported; iOS and upstream-maintainer gates remain
open, so this ADR is not yet accepted for a cross-platform production claim.
See [the boundary evidence](../evidence/foldkit-portable-kernel.md),
[Command-adapter evidence](../evidence/foldkit-command-adapter.md), and
[Todo migration evidence](../evidence/foldkit-todo-migration.md). The later
[live-Command runtime rewrite](../evidence/foldkit-live-command-runtime.md)
also proves that native can execute the original FoldKit Effect while keeping
only its description in history, matching FoldKit's web runtime pattern.

## Context and evidence

OriKit currently implements a small portable Program, serializable Command
descriptions, Story/replay contracts, and a production native runtime while
using FoldKit's runtime and HTML view on the web. This has proven shared pure
Todo behavior on web and Android, but duplicates concepts that also exist in
FoldKit.

The current FoldKit repository exposes narrow subpath modules. Initial source
inspection indicates that Message and Command modules may be portable, while
the runtime directly depends on `@effect/platform-browser`, HTML, virtual DOM,
browser navigation, mounting, listeners, and HMR behavior. The published
package still declares the browser platform peer dependency for all consumers.

A permanent divergent fork would require continuous upstream merges. A
backward-compatible portable-core extraction could instead improve FoldKit and
allow OriKit to become an alternative native host.

## Proposed decision

Run the bounded experiment in
[21-foldkit-portable-kernel-plan.md](../nativescript/21-foldkit-portable-kernel-plan.md).

Use a local sibling clone of FoldKit. Establish and mechanically verify a
browser-independent package boundary, test candidate real FoldKit APIs under
NativeScript Android, and compare two Command adaptation strategies. Preserve
the existing OriKit runtime and contracts until all decision gates pass.

Do not commit, push, publish, contact upstream, or claim official FoldKit
NativeScript support during the experiment.

## Consequences

Potential benefits:

- Less independent reimplementation of FoldKit concepts.
- A clearer path for existing FoldKit programs to add native hosts.
- Shared improvements and tests could be proposed upstream.
- OriKit can focus on NativeScript rendering, platform lifecycle, and
  Kotlin/Swift capabilities.

Costs and risks:

- FoldKit is pre-1.0 and may change in minor releases.
- FoldKit Commands contain executable Effects, unlike OriKit's current
  recorded data-only descriptions. The live/recorded split now keeps both
  representations without reconstructing locally created Commands.
- A package split may be too invasive or unwanted upstream.
- Android success does not prove iOS JavaScriptCore compatibility.
- Local cross-repository package development complicates pnpm and NativeScript
  bundling.

## Alternatives

Continue the current adapter architecture:

- Remains the default unless this ADR becomes accepted.
- Lowest immediate risk, but retains conceptual duplication.

Maintain a permanent FoldKit fork:

- Rejected as the initial strategy because upstream merges and branding would
  become a continuing project responsibility.

Copy selected MIT-licensed sources into OriKit:

- Deferred. It creates provenance and synchronization work and should be used
  only if upstream extraction is rejected and measured benefits justify it.

Replace OriKit's runtime immediately with FoldKit Runtime:

- Rejected because the current FoldKit Runtime is explicitly browser-coupled
  and lacks Android/iOS lifecycle evidence.

## Verification

The ADR can become accepted only with the complete verification and evidence
matrix defined in document 20, including a physical Android device run. iOS
must remain `NOT_RUN` until tested on macOS with Xcode.

## Reversal conditions and cost

Until acceptance, reversal means removing only experiment-specific local
references and fixtures. The working OriKit Program, runtime, web adapter,
and native renderer remain the fallback.

After possible acceptance, reversal cost depends on how many official FoldKit
core contracts replace OriKit contracts and must be estimated before any
production migration.




