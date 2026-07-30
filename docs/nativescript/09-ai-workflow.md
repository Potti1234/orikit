# 9. AI workflow

## 9.1 Objective

The repository should let an agent:

1. Locate the canonical feature structure.
2. Understand the Model and Message schemas.
3. Add a Message and receive an exhaustive update failure.
4. Implement the transition.
5. Add a Story.
6. Add or update web/native views.
7. Run portable tests quickly on Windows.
8. Install and inspect Android behavior when necessary.
9. Query a running runtime through MCP.
10. Produce evidence rather than assumptions.

## 9.2 Why TypeScript-first helps

The primary workflow uses:

- One application language.
- Effect Schema and tagged unions.
- One package manager and lockfile.
- Fast Node tests.
- Direct import of application code.
- No generated Kotlin source as an ordinary debugging layer.
- Native code only at narrow boundaries.

This reduces the number of artifacts an agent must keep semantically aligned.

## 9.3 Canonical feature structure

```text
features/todos/
├── model.ts
├── message.ts
├── command.ts
├── update.ts
├── program.ts
├── story.test.ts
├── view.web.ts
├── view.native.ts
├── view.native-scene.test.ts
├── capabilities.ts
├── capabilities.android.ts
└── capabilities.ios.ts
```

Every canonical example follows the same layout.

## 9.4 Agent context

Keep local, version-matched reference material:

- Foldkit source/docs/examples at a pinned commit or subtree.
- NativeScript API types and relevant examples.
- OriKit architecture and canonical examples.
- Accepted ADRs.

Do not copy unrelated framework repositories into active editor context.
Reference material must be clearly separated from owned implementation.

## 9.5 Stable commands

The repository must expose stable root commands:

```text
pnpm doctor
pnpm verify:portable
pnpm verify:web
pnpm verify:android
pnpm verify:android:device
pnpm verify:docs
pnpm verify:windows
pnpm verify:ios
```

Internal package names may change; these commands remain the developer API.

## 9.6 Doctor

`pnpm doctor` is read-only and reports:

- OS and architecture.
- Node, npm, and pnpm.
- NativeScript CLI.
- Java/JDK.
- Android SDK variables and paths.
- `adb`.
- Connected/authorized devices.
- Android Studio and SDK components where detectable.
- Whether the host can build iOS.
- Differences from repository-pinned versions.

Use `PASS`, `WARN`, `FAIL`, and `NOT_APPLICABLE`.

## 9.7 Change workflow

For a normal feature:

1. Read the nearest `AGENTS.md`.
2. Read the feature Program and Story tests.
3. Add or update schemas first.
4. Run typecheck and focused Story.
5. Implement update exhaustively.
6. Add Command interpreter contract tests.
7. Update web/native views.
8. Add view-tree tests.
9. Run portable verification.
10. Run affected platform verification.
11. Record exact evidence.

## 9.8 MCP workflow

With a debug app connected, an agent may:

- Read runtime identity and status.
- Inspect current Model.
- List recent Messages.
- Inspect a transition and diff.
- Query Message schemas.
- Run a Story fixture.

Mutation tools are disabled by default. When the user enables them, an agent
may dispatch schema-valid Messages or select history. Native arbitrary code
execution is never an MCP feature.

## 9.9 Code-generation policy

Permitted generation:

- Message/Command constructors from schemas.
- Canonical codec manifests.
- Native TypeScript declarations.
- Fixture catalogs.
- DevTools schema metadata.

Generated files:

- Have a clear header.
- Are reproducible.
- Are checked for freshness.
- Are not hand-edited.
- Do not contain domain logic that cannot be read in source.

Do not introduce a new language compiler in the NativeScript-first phases.

## 9.10 AI quality tests

Maintain benchmark tasks:

1. Add a Todo filter.
2. Add retry with a typed failure.
3. Extract a Submodel.
4. Add a platform capability.
5. Diagnose a replay divergence.
6. Add a native accessibility state.

Score:

- Type correctness.
- Architectural compliance.
- Tests added.
- Cross-platform correctness.
- Unnecessary changes.
- Time to verified result.

## 9.11 Guardrails

Lint or tests should detect:

- `Date.now`, randomness, network, storage, or native API access in update.
- Mutable Model fields.
- DOM imports in portable packages.
- NativeScript imports in core.
- Unvalidated remote dispatch.
- Commands executed during replay.
- `any` in stable native boundaries.
- Platform branching inside portable feature files.
- Missing Message cases.

## 9.12 Handoff format

```markdown
## Outcome

## Exit criteria

| Criterion | Status | Evidence |
|---|---|---|

## Files changed

## Commands run

## Device/host matrix

## Decisions and ADRs

## Known limitations

## Exact next task
```

Use “not run” rather than “should work.”
