# 13. Implementation-agent runbook

## 13.1 Mission

Implement OriKit phase by phase as specified in this documentation.
Optimize for understandable correctness and verified cross-platform behavior,
not maximum framework surface.

## 13.2 Required reading

Before changing code, read:

1. `README.md`
2. `docs/01-product-definition.md`
3. `docs/02-architecture.md`
4. The document for the active phase
5. `docs/11-decisions-and-questions.md`
6. `docs/12-risks.md`
7. `docs/18-development-environment.md`

When implementation begins, also read the closest `AGENTS.md`.

## 13.3 Authority

An agent may:

- Implement the current approved phase.
- Add tests and documentation required by that phase.
- Make small reversible choices inside documented boundaries.
- Add an ADR for a choice supported by evidence.

An agent must stop and request input before:

- Changing a proposed product decision that has been accepted.
- Adding a shared UI abstraction.
- Requiring experimental Swift export.
- Adding a Kotlin compiler plugin.
- Beginning the TypeScript compiler.
- Publishing packages.
- Enabling production remote DevTools.
- Changing the accepted MIT license or implying FoldKit affiliation.

## 13.4 Phase workflow

For each phase:

1. Quote the phase objective in the working plan.
2. Inspect the repository and current decisions.
3. List exact modules/files to add or modify.
4. Identify target-specific work requiring macOS.
5. Implement the smallest complete vertical behavior.
6. Add focused tests before expanding APIs.
7. Run fast checks.
8. Run affected target checks.
9. Compare against phase exit criteria.
10. Update docs and ADRs.
11. Report verified results and remaining gaps.
12. Do not mark the phase complete with skipped mandatory criteria.

## 13.5 Coding rules

- `update` is synchronous and deterministic.
- All effects are Command or Subscription interpretations.
- All shared state is immutable.
- Use exhaustive `when` without `else` for Message unions.
- Expected failures are typed Messages.
- Platform objects never enter common Model/Message/Command.
- Dispatch always re-enters the runtime queue.
- UI never mutates shared Model.
- DevTools never derive history from StateFlow.
- Replay never executes Commands.
- Generated files are not hand-edited.

## 13.6 API-change template

Before expanding public core API, answer in the change:

```text
Observed use case:
Why existing API cannot express it:
Smallest proposed API:
Swift export effect:
Serialization/DevTools effect:
Story interpretation:
Alternatives rejected:
Reversal cost:
```

## 13.7 Verification discipline

Prefer focused commands during iteration. Before phase handoff run:

```text
format/lint
JVM common tests
JS common tests
affected Android tests/build
iOS simulator tests/build on macOS
generated-file freshness
documentation link check
```

Record commands and results in the final handoff. If a target cannot be run,
state exactly why and do not imply it passed.

On Windows, use the stable verification commands from
`docs/18-development-environment.md`, then obtain Apple evidence from the
required macOS workflow. Do not treat common compilation, an Apple source-set
IDE check, or Android success as an iOS pass.

## 13.8 Handling uncertainty

Use this order:

1. Existing decision/ADR
2. Normative API document
3. Canonical example
4. Official platform documentation
5. Small experiment with recorded result
6. User decision

Do not solve uncertainty by introducing a general abstraction.

## 13.9 Commit/change sizing

Keep changes reviewable:

- One runtime invariant per change when possible.
- Tests in the same change as behavior.
- Generated output separate only when size requires it.
- Dependency upgrades isolated.
- No unrelated formatting of native project files.

## 13.10 Required implementation artifacts

Every phase should leave:

- Source
- Tests
- A running example or fixture
- Relevant benchmark if performance-sensitive
- Documentation
- ADR for meaningful decisions
- Updated verification matrix

## 13.11 Suggested first agent prompt

```text
Implement Phase 0 from docs/09-implementation-roadmap.md.
Read all required documents in docs/13-agent-runbook.md first.
Do not begin Phase 1. Preserve save.txt. Use current compatible stable
toolchain versions, record them in the version catalog, and verify JVM, JS,
and Android locally. Add the required macOS CI lane and iterate until its
Kotlin/Native, Swift import, and iOS simulator smoke checks pass. Implement the
doctor and stable command contract from docs/18-development-environment.md.
Add an ADR for any material deviation. Report each exit criterion as passed,
failed, or not run with evidence.
```

## 13.12 Phase handoff template

```markdown
## Outcome

## Exit criteria

| Criterion | Status | Evidence |
|---|---|---|

## Files/modules changed

## Verification run

## Decisions/ADRs

## Known limitations

## Exact next phase
```
