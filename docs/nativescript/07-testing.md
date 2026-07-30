# 7. Testing strategy

## 7.1 Principles

The testing strategy preserves Foldkit's strongest property: most behavior is
tested as deterministic data transitions without a device, network, clock, or
native SDK.

Use the lowest test level that proves the requirement.

```text
Story tests
    ↓
pure view-tree tests
    ↓
renderer contract tests
    ↓
NativeScript integration tests
    ↓
Maestro/device flows
    ↓
manual native-feel and accessibility review
```

## 7.2 Story tests

Story drives update and resolves Commands explicitly:

```ts
Story.story(
  program,
  Story.with(model),
  Story.message(ClickedLoad()),
  Story.model(model => {
    expect(model.loading._tag).toBe("Loading")
  }),
  Story.command(LoadTodos()),
  Story.resolve(
    LoadTodos,
    CompletedLoadTodos({ todos }),
  ),
  Story.model(model => {
    expect(model.todos).toEqual(todos)
  }),
)
```

Story must:

- Never run a real interpreter.
- Preserve Message and Command order.
- Validate schemas.
- Show Model and Command diffs on failure.
- Support exact and partial assertions.
- Produce a portable transition trace.
- Run in Node on Windows.

## 7.3 Determinism tests

For every canonical fixture:

1. Decode initial Model.
2. Decode ordered Messages.
3. Run update.
4. Encode each resulting Model and Command list canonically.
5. Compare fingerprints.
6. Repeat on Node, browser, Android, and iOS.

Any difference is a framework defect or an explicitly versioned encoding
change.

## 7.4 Pure view-tree tests

Current Foldkit Scene tests inspect HTML. OriKit needs `NativeScene` for
the native view description:

```ts
NativeScene.scene(
  { update, view },
  NativeScene.with(model),
  NativeScene.type(
    NativeScene.label("New todo"),
    "Buy milk",
  ),
  NativeScene.press(
    NativeScene.role("button", { name: "Add" }),
  ),
  NativeScene.expect(
    NativeScene.text("Buy milk"),
  ).toExist(),
)
```

Locators:

- Role/control kind.
- Accessible name.
- Label.
- Placeholder only when no better semantic locator exists.
- Text.
- Stable identifier as a last resort.

These tests run without creating native controls. They prove view semantics and
Message wiring.

## 7.5 Renderer contract tests

Renderer tests create fake or real NativeScript view adapters and verify:

- Create/update/remove order.
- Keyed identity.
- Listener replacement.
- Property equality suppression.
- Focus and selection preservation.
- Scroll preservation.
- List recycling.
- Custom element disposal.
- Crash diagnostics.

Some tests can use adapter fakes on Node. Tests requiring actual NativeScript
classes run on an emulator/device.

## 7.6 Capability contract tests

Every capability has:

- A deterministic fake.
- Android implementation tests.
- iOS implementation tests.
- Contract vectors shared by implementations.

Example storage contract:

```text
save -> load returns same value
delete -> load returns absent
cancelled save -> no completion dispatch
expected native failure -> typed failure Message
```

## 7.7 Runtime tests

Required:

- FIFO dispatch.
- Nested dispatch is queued.
- Concurrent native callbacks lose no Messages.
- Commit precedes Command scheduling.
- Command order is stable.
- Invalid completion is rejected.
- Cancellation is idempotent.
- Late callbacks are quarantined.
- Disposal rejects new work.
- Subscription key changes restart exactly once.
- Resource acquisition/release is balanced.
- Crash state preserves diagnostic history.

Stress vectors should dispatch at least 10,000 simple Messages.

## 7.8 Time-travel tests

Verify:

- Historical reconstruction never runs Commands.
- Fingerprints match every recorded event.
- User interaction is blocked while paused.
- Live work follows the selected Foldkit-compatible policy.
- Resume restores the exact live head.
- Branch assigns a new branch ID.
- Old-branch callbacks are quarantined.
- Navigation reconciles to the selected Model.
- External side effects are clearly not reversed.

## 7.9 Android tests

Local physical-device loop:

- Build debug application.
- Install through `ns run android` or `adb install`.
- Run NativeScript tests.
- Run a smoke Maestro flow.
- Capture logcat.
- Inspect native view/accessibility tree.

CI matrix:

- Provisional minimum API.
- API 29 representative older device.
- Current stable API.

At least one real physical device remains in manual release testing.

## 7.10 iOS tests

On macOS:

- NativeScript unit/integration tests.
- iOS simulator smoke flow.
- Swift native wrapper compilation.
- Accessibility tree.
- Repeated mount/dispose leak test.
- Physical iPhone test for device-sensitive capabilities.

Do not substitute a browser WebKit test for an iOS application test.

## 7.11 E2E scope

Use Maestro or another accepted native E2E tool for a small set of critical
flows:

- Launch and restore.
- Add/edit/delete Todo.
- Failure and retry.
- Navigation and native back.
- Permission flow.
- Time-travel inspector attachment in debug builds.

E2E should not duplicate every Story edge case.

## 7.12 Accessibility verification

Automated:

- Every interactive element has a name.
- Roles and states are correct.
- No duplicate identifiers in one screen.
- Logical focus order.

Manual/device:

- TalkBack.
- VoiceOver.
- Dynamic font size.
- Reduced motion.
- High contrast.
- Keyboard/external input where applicable.

## 7.13 Visual testing

Screenshots are useful for regression detection, but platform versions and
font rendering create noise.

Maintain:

- A small set of stable screen fixtures.
- Separate Android and iOS baselines.
- Documented OS/device configuration.
- Semantic tests as the primary correctness evidence.

## 7.14 Test file naming

```text
feature.story.test.ts
feature.native-scene.test.ts
renderer.contract.test.ts
capability.android.test.ts
capability.ios.test.ts
feature.maestro.yaml
```

Tests live near the behavior they prove unless they are cross-package
conformance fixtures.

## 7.15 Failure artifacts

Device/CI failures upload:

- Test report.
- Runtime event trace.
- Canonical final Model.
- Commands.
- Screenshot.
- Accessibility/view tree.
- Android logcat or iOS simulator log.
- Toolchain and device versions.

An agent should be able to diagnose a deterministic failure from artifacts
without rerunning it interactively.
