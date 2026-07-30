# 8. Code generation and AI workflow

## 8.1 Principle

AI quality comes from reducing ambiguity and making correctness observable.
The tooling should expose the legal structure of the program rather than rely
on a long prompt.

## 8.2 Generated program manifest

For each program, generate:

```json
{
  "program": "todos",
  "schemaVersion": 1,
  "model": "com.example.todos.TodoModel",
  "messageTypes": [],
  "commandTypes": [],
  "commandResults": {},
  "features": [],
  "sensitivePaths": [],
  "semanticIds": []
}
```

Consumers:

- DevTools
- MCP server
- TypeScript adapter
- Swift facade generator
- CLI
- Documentation generator
- Architecture verification tests

## 8.3 KSP responsibilities

KSP may generate:

- Serializers/codec wiring
- Program manifest
- Message and Command registries
- Command/result contract table
- Sensitive-field metadata
- Stable semantic-ID catalog
- Flat Swift-friendly controller facades
- TypeScript declarations and adapter metadata
- Human-readable API documentation

KSP must not:

- Rewrite update bodies.
- Pretend to prove purity.
- Hide Message dispatch.
- Generate platform UI.
- become required for the first core runtime test.

KSP cannot inspect function statements or expressions, so purity linting needs
a separate static rule or compiler checker.

## 8.4 Lint rules

Initial Detekt/custom rules:

- Update functions must not be `suspend`.
- No mutable collection types in `@FoldModel`.
- No `var` properties in `@FoldModel`.
- No platform types in common Model/Message/Command.
- No direct clock/random/UUID access in `@FoldUpdate` files.
- No IO/network/storage packages in feature update modules.
- Every Command appears in the command-result manifest.
- Every UI semantic ID is declared centrally.
- No callbacks/functions in serializable Messages.
- No catch-all `else` in Message `when` expressions.

Some rules are heuristic. Report them clearly as architecture lint, not
language guarantees.

## 8.5 CLI

Commands:

```text
orikit init
orikit doctor
orikit create feature <name>
orikit create command <feature> <name>
orikit create message <feature> <name>
orikit create story <feature> <name>
orikit generate
orikit verify
orikit inspect
orikit export-history
```

`doctor` checks:

- Java and Gradle versions
- Kotlin/AGP compatibility
- Node/pnpm for web
- Android SDK
- macOS/Xcode for Apple targets
- Generated files current
- Required example builds

## 8.6 Canonical generated feature

`create feature todos` creates compiling placeholders:

```text
TodoModel.kt
TodoMessage.kt
TodoCommand.kt
TodoUpdate.kt
TodoProgram.kt
TodoStoryTest.kt
README.md
```

It must not generate hundreds of lines. The output is a teaching example.

## 8.7 Repository instructions for agents

Before implementation starts, add `AGENTS.md` containing:

- Architectural invariants
- File ownership rules
- Commands for focused verification
- Canonical example links
- Prohibited patterns
- Required Story updates
- Native UI boundaries
- Generated-file policy

Keep it short enough to be read every turn. Detailed rationale stays in these
docs.

## 8.8 AI task loop

Recommended agent loop:

```text
inspect feature manifest
       ↓
read canonical neighboring feature
       ↓
change Model/Message/Command/update
       ↓
compiler exposes exhaustive gaps
       ↓
write Story first or with implementation
       ↓
run focused common tests
       ↓
run architecture lint
       ↓
run affected platform compile/tests
       ↓
inspect runtime trace if behavior differs
```

## 8.9 AI-readable failures

Prefer:

```text
FN-CMD-002 SaveTodo has no declared completion Messages.
Add @CompletesWith(...) or update TodoProgramManifest.
```

Over:

```text
IllegalStateException at GeneratedRegistry.kt:184
```

Every custom diagnostic needs:

- Stable code
- Specific source location
- Explanation
- One recommended repair
- Link to canonical example

## 8.10 DevTools for AI

The agent should be able to retrieve:

- Current redacted Model
- Model schema
- Legal Message schemas
- Recent transitions
- Model diff for an event
- Outstanding Commands
- Active subscriptions
- Runtime status
- Story catalog and results

The agent may dispatch or time travel only when the development runtime has
mutating tools enabled.

## 8.11 Documentation tests

All Kotlin and TypeScript examples in public documentation should be:

- Compiled from samples, or
- Extracted from tested source files.

Avoid unverified hand-copied examples as the API evolves.

## 8.12 API stability

Use explicit opt-ins:

```kotlin
@RequiresOptIn
annotation class ExperimentalOriKitApi
```

Track:

- Kotlin source compatibility
- Binary compatibility for JVM
- Klib compatibility expectations
- Generated manifest schema
- DevTools wire protocol
- TypeScript adapter API
- Swift facade API

Do not promise stable compiler-plugin integration in version 1.

