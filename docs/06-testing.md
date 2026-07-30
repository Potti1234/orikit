# 6. Testing strategy

## 6.1 Test pyramid

```text
                   native end-to-end
              platform UI/Scene adapters
          command and subscription integration
                 shared Story tests
              pure update unit/property tests
```

Most behavior belongs in fast shared tests.

## 6.2 Pure update tests

Use direct tests for focused invariants:

```kotlin
@Test
fun addingBlankTodoKeepsModelAndEmitsNoCommands() {
    val result = update(
        model = model(draft = "   "),
        message = ClickedAddTodo,
    )

    assertEquals(model(draft = "   "), result.model)
    assertTrue(result.commands.isEmpty())
}
```

Run on JVM during normal development and all supported backends in CI.

## 6.3 Story DSL

Required first-version operations:

```kotlin
story(program)
    .with(flags)
    .expectInitialModel { ... }
    .send(message)
    .expectModel { ... }
    .expectCommand(command)
    .expectCommandsExactly(commandA, commandB)
    .resolve(command, with = completionMessage)
    .cancel(command)
    .expectNoCommands()
    .expectOutMessage(outMessage)
    .snapshot("after-load")
```

Story is a deterministic interpreter, not the production runtime:

- It invokes `init` and `update`.
- It captures Commands without running them.
- `resolve` supplies the resulting Message explicitly.
- It reports unmatched/ambiguous commands.
- It renders readable transition diffs on failure.

### Story trace

Every Story produces an optional trace:

```text
0 init
  Model: Loading
  Command: LoadTodos

1 resolve LoadTodos -> CompletedLoadTodos(2 items)
  Model: Loaded(2 items)
  Commands: none
```

This trace is valuable to humans and AI.

## 6.4 Command-handler tests

Test handlers separately with fake ports:

```kotlin
@Test
fun loadMapsTimeoutToTypedFailure() = runTest {
    val handler = handler(api = FakeTodoApi.timeout())

    val message = handler.handle(LoadTodos)

    assertEquals(FailedLoadTodos(LoadProblem.Timeout), message)
}
```

Test:

- Success mapping
- Expected failures
- Cancellation
- Defect reporting
- Correct port arguments
- Thread/main-actor requirements where applicable

## 6.5 Runtime contract tests

Create a reusable contract suite for every target:

- Concurrent dispatch is serialized.
- Sequence numbers are monotonic.
- Commands start after model commit.
- Completion dispatch re-enters the queue.
- `KeepLatest` cancellation is correct.
- Subscription key changes restart once.
- Disposal cancels work and rejects new dispatch.
- Crash state is stable.
- Slow Model observers cannot lose DevTools events.
- Time travel does not execute Commands.

Run the suite on JVM, JS, iOS simulator, and Android instrumentation where
threading behavior differs.

## 6.6 Property tests

Useful properties:

- Replaying the same Message sequence from the same initial Model returns the
  same final Model.
- Encode/decode round trips preserve Model, Message, and Command.
- Model fingerprints are stable for canonical encoding.
- A route builds and parses symmetrically.
- Feature composition maps child transitions without dropping Commands.
- Rewind plus replay to the same cursor yields the same Model.

Generate only valid domain values unless testing decoder rejection.

## 6.7 Golden tests

Golden files are appropriate for:

- Generated TypeScript declarations
- Generated Effect Schemas
- Program manifests
- Swift facade source
- Story failure output
- DevTools protocol JSON
- Fold IR in the future

Golden updates require review. Do not automatically overwrite them in CI.

## 6.8 Scene scenarios

Define a language-neutral scenario format:

```yaml
name: add a todo
given:
  fixture: empty-todos
steps:
  - see:
      id: todo.draft
  - type:
      id: todo.draft
      text: Buy milk
  - tap:
      id: todo.add
  - see:
      text: Buy milk
```

Adapters:

- Web: FoldKit Scene or browser test.
- Android: Compose semantics test.
- iOS: XCTest/XCUITest using accessibility identifiers.

Start with `see`, `tap`, `type`, `select`, `back`, and `waitFor`. Avoid a large
cross-platform UI testing language.

Scene parity tests verify critical journeys, not every visual detail.

## 6.9 Accessibility tests

Each platform verifies:

- Stable semantic IDs
- Accessible names and roles
- Dynamic text sizing
- Keyboard/focus navigation where relevant
- Error announcements
- Touch target sizing

The common contract verifies that required domain labels are present. Native
tests verify actual platform exposure.

## 6.10 Time-travel tests

Required cases:

1. Snapshot and replay produce equal Models.
2. Historical Commands are displayed but never executed.
3. Live command completions are quarantined while traveling.
4. Returning to live mode restores the captured live head.
5. Branch mode creates a new branch identifier.
6. Schema mismatch refuses unsafe replay.
7. Redaction prevents secrets in exported history.
8. History truncation preserves a valid base snapshot.

## 6.11 Cross-backend conformance

For canonical fixtures, record:

- Initial Model JSON
- Message sequence JSON
- Expected final Model JSON
- Expected Command JSON

Execute the same vectors on JVM, JS, and Kotlin/Native. Compare canonical
encoded output byte-for-byte where numeric semantics allow it.

## 6.12 CI lanes

Fast lane on every change:

- Formatting
- Static architecture rules
- JVM common tests
- JS tests
- Codegen goldens
- Example web build

Native lane:

- Android unit and Compose tests
- iOS simulator common/runtime tests
- Swift compile test
- XCTest critical scenarios

Release lane:

- Full target matrix
- Binary/API compatibility
- Performance benchmarks
- Example app smoke tests
- Documentation link check

