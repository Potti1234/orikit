# 13. Implementation-agent runbook

## 13.1 Mission

Implement OriKit phase by phase as a NativeScript-first,
Foldkit-compatible TypeScript experiment. Optimize for verified correctness and
an excellent AI feedback loop, not maximum framework surface.

## 13.2 Required reading

Before implementation:

1. `README.md`
2. `AGENTS.md`
3. `docs/nativescript/README.md`
4. `docs/nativescript/01-product-definition.md`
5. `docs/nativescript/02-architecture.md`
6. `docs/nativescript/12-risks-decisions.md`
7. `docs/nativescript/14-windows-android-setup.md`
8. The active roadmap phase

For Phase 1, also read
`docs/nativescript/17-feasibility-spike.md`.

## 13.3 Authority

An agent may:

- Implement the active approved phase.
- Add required source, tests, scripts, and documentation.
- Make small reversible choices.
- Add an evidence-backed ADR.

An agent must stop before:

- Starting a KMP implementation or compiler.
- Adding another UI/state framework.
- Publishing packages, releases, or apps.
- Enabling production DevTools/MCP.
- Changing the license.
- Claiming iOS passed without macOS evidence.
- Accepting a failed feasibility gate through a broad workaround.
- Introducing a shared view AST before the Todo decision gate.

## 13.4 Phase workflow

1. Quote the phase objective in the working plan.
2. Inspect repository state and dirty files.
3. Run `doctor` or the manual pre-doctor checks.
4. List exact files/packages to change.
5. Identify device and macOS requirements.
6. Implement the smallest complete vertical behavior.
7. Add focused tests.
8. Run portable verification.
9. Run Android/device verification if applicable.
10. Compare every exit criterion.
11. Update docs/ADR.
12. Report exact evidence and next phase.

## 13.5 Coding rules

- Strict TypeScript.
- No stable `any` at platform boundaries.
- Model and Message are schema-defined immutable values.
- Update is synchronous and deterministic.
- Effects are interpreted outside update.
- All completions dispatch Messages.
- No DOM imports in portable packages.
- No NativeScript imports in core.
- Native handles never enter Model/history.
- Renderer state is presentation-only.
- Replay never executes effects.
- Generated files are not hand-edited.
- Dependencies are pinned; upgrades are isolated.

## 13.6 Feasibility honesty

The spike exists to invalidate the plan if necessary.

For every gate report:

```text
PASS: evidence and command
FAIL: observed error and minimal reproduction
PARTIAL: exact supported/unsupported subset
NOT_RUN: reason
```

Do not silently polyfill missing runtime behavior or replace a required
library without recording the result.

## 13.7 Native proof

When claiming native UI:

- Name the NativeScript class.
- Name or inspect the underlying Android/iOS class.
- Capture view/accessibility hierarchy where possible.
- Confirm the application is not a WebView.
- Test interaction on emulator or device.

## 13.8 Dependency review

Before adding a native plugin:

```text
Observed use case:
Why direct NativeScript/platform API is insufficient:
Plugin version and release date:
Android/iOS minimum:
Transitive native dependencies:
License:
Maintenance evidence:
Fallback if abandoned:
```

## 13.9 API expansion template

```text
Observed use case:
Why current API cannot express it:
Smallest proposed API:
Serialization/history effect:
Story interpretation:
Web mapping:
Android mapping:
iOS mapping:
AI readability:
Alternatives:
Reversal cost:
```

## 13.10 Verification

During editing, run focused commands. Before handoff:

```text
pnpm verify:portable
pnpm verify:web                  when affected
pnpm verify:android              when affected
pnpm verify:android:device       when native behavior affected
pnpm verify:docs
```

On macOS when affected:

```text
pnpm verify:ios
```

Record versions:

- Node/pnpm.
- NativeScript.
- JDK.
- Android SDK/device API.
- Xcode/iOS when applicable.

## 13.11 Git and user changes

- Preserve unrelated changes.
- Never reset or discard user work.
- Do not reformat the old KMP documentation merely because it is no longer
  authoritative.
- Do not push, publish, or create a release without authorization.

## 13.12 Suggested first implementation prompt

```text
Implement Phase 0 and Phase 1 only from
docs/nativescript/10-implementation-roadmap.md.

Read AGENTS.md and all required documents in
docs/nativescript/13-agent-runbook.md first. Prepare the repository as a
pinned vanilla NativeScript TypeScript workspace. Use the connected Android
phone as the first device target. Execute every gate in
docs/nativescript/17-feasibility-spike.md, add focused automated tests, and
write canonical Node/web/Android traces.

Do not add React, Vue, Angular, a shared UI AST, KMP, or a compiler. Do not
start Todo. Report each exit criterion as passed, failed, partial, or not run
with exact commands and device/tool versions. Add an ADR accepting or
rejecting the NativeScript direction based on the results.
```

## 13.13 Handoff template

```markdown
## Outcome

## Exit criteria

| Criterion | Status | Evidence |
|---|---|---|

## Toolchain and devices

## Files changed

## Commands run

## ADRs

## Known limitations

## Exact next phase
```
