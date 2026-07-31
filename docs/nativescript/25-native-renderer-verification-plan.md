

# 24. Native renderer verification and evidence plan

**Status:** proposed companion to [document 23](24-foldkit-nativescript-renderer-plan.md).
It defines what an implementation agent must prove; it does not report those
checks as completed.

## 24.1 Evidence vocabulary

Every row must use one of the project-wide statuses:

- `PASS`: named command and observable evidence met the criterion.
- `FAIL`: the check ran and did not meet the criterion.
- `PARTIAL`: the exact supported and unsupported subset is recorded.
- `NOT_RUN`: the check was not executed and the reason is stated.
- `BLOCKED`: a concrete external dependency prevents execution.

A successful build is not proof of view identity, list virtualization,
accessibility, focus, event cleanup, or effect-free replay.

## 24.2 Test layers

```text
pure builder and VNode fixtures
              |
              v
fake-host reconciliation contracts
              |
              v
NativeScript wrapper integration tests
              |
              v
Android/iOS build and runtime tests
              |
              v
physical-device hierarchy, accessibility, and interaction proof
```

Most defects should fail on Windows before an Android build starts. Device
tests are reserved for native behavior that a fake host cannot establish.

## 24.3 Required fixtures

### Counter

Proves the smallest complete path:

- create Label and Button;
- Button tap dispatches one typed Message;
- Model update changes Label text;
- unrelated properties are not rewritten;
- historical Model changes Label without executing effects;
- dispose detaches the Button listener.

### Tree operations

Proves host mechanics without application behavior:

- append first/last child;
- insert before an anchor;
- move keyed child left and right;
- remove first/middle/last child;
- replace when type changes with the same key;
- retain when type and key match;
- reject duplicate sibling keys;
- update text and comment anchors;
- reject an already-owned child inserted into another parent;
- destroy nested custom elements exactly once.

### Controlled form

Proves:

- text changes dispatch serializable strings;
- equal value patch writes nothing;
- necessary controlled write retains a valid selection;
- unrelated updates retain focus and keyboard state;
- renderer-originated writes do not loop into duplicate Messages;
- removed field listeners cannot dispatch;
- switch/checkbox value metadata can be added without hard-coding TextField
  semantics into the generic property module.

### Todo

Proves:

- load, ready, empty, and failure surfaces;
- add, edit, toggle, delete, retry, and save feedback;
- virtualized keyed rows;
- row reuse and stale-handler prevention;
- focus and scroll preservation;
- accessibility meaning;
- time travel across list/editor/load states.

### Custom/property-child fixture

Proves:

- one ActionBar-style property child;
- one custom element registration;
- update and dispose hooks;
- invalid multiple property children fail clearly;
- platform-specific property selection is explicit.

Do not use navigation or a plugin merely to make this fixture complicated.

## 24.4 Fake-host contract matrix

| Contract | Assertion |
|---|---|
| Create | Correct host node type and registry factory called once |
| Insert | Logical and visual order match expected order |
| Move | Host/native identity preserved for matching type and key |
| Replace | Previous node destroyed and new identity created |
| Remove | Links cleared, listener removed, dispose called once |
| Text | Supported parent receives current text; invalid parent fails |
| Comment | Participates in logical order without visual child |
| Property | Previous value diffed; removal restores unset state |
| Event add | Exactly one native listener attached |
| Event update | Stable listener retained; current conversion replaced |
| Event remove | Exact listener detached |
| Late event | No Message dispatch after removal/disposal |
| Duplicate key | Development diagnostic names key and parent path |
| Failure | Diagnostic names operation, node path, element, and property/event |

Run this matrix with no DOM global and no NativeScript import. Repeat the
important tree contracts against fake NativeScript classes before device work.

## 24.5 Serialization boundary checks

Add a recursive development assertion over:

- Model;
- Message;
- Flags;
- recorded Command descriptions;
- history and exported trace;
- DevTools payloads;
- pure native view fixtures, if serialized for tests.

It must reject or demonstrate absence of:

- NativeScript views;
- Android and iOS native objects;
- host wrapper nodes;
- VNodes with attached host elements;
- functions and callbacks;
- promises, Effects, Fibers, AbortControllers, and mutable SDK handles.

Live VNodes and event converters are ephemeral renderer values and do not need
to be JSON serializable. They must never enter runtime records.

## 24.6 Event verification

For each supported event:

1. Attach it and inspect the fake/native listener count.
2. Trigger it and assert one Message.
3. Patch to a new Message/converter without adding another native listener.
4. Trigger it and assert only the new result.
5. Remove it and assert listener count returns to zero.
6. Trigger a retained test callback and assert no dispatch after removal.
7. Dispose twice and assert no double detach/defect.

Device checks must cover at least:

- Button tap;
- TextField text change;
- TextField return key;
- one ListView row action;
- native back/dismiss only after navigation is implemented.

## 24.7 Identity verification

Tests must compare object identity, not only rendered values.

Required cases:

- keyed sibling insertion before a focused field;
- keyed reorder of three controls;
- unkeyed same-type patch at one position;
- same key with different element type causes replacement;
- row data update retains the expected realized cell/root policy;
- removal and re-add follows the documented identity policy;
- time travel and resume preserve or replace identity according to type/key,
  not according to the direction of travel.

On Android, record underlying class names and identity hashes for focused
fixtures where practical. Do not publish device serials.

## 24.8 Text input verification

Pure/fake tests:

- no write when strings are equal;
- cursor clamps when a controlled value becomes shorter;
- renderer write suppression resets after the patch;
- rapid user events maintain FIFO dispatch;
- field removal clears state maps.

Physical Android checks:

1. Focus Todo draft.
2. Type continuously while unrelated Model updates occur.
3. Verify keyboard stays open.
4. Place cursor in the middle and trigger an unrelated update.
5. Verify selection is unchanged.
6. Trigger a necessary controlled replacement and verify selection policy.
7. Use autocorrection/composition where the installed keyboard supports it.
8. Press return and verify one Add/Commit Message.
9. Travel to a historical state and resume, recording focus policy.

Repeat on iOS Simulator and a physical iPhone before iOS acceptance, including
autocorrection and marked-text/composition behavior.

## 24.9 List verification

Correctness cases:

- insert at start/middle/end;
- delete start/middle/end;
- reorder without index keys;
- update row title;
- toggle row state;
- move a row while another is visible;
- scroll away and back to force recycling;
- trigger an action after recycling and confirm the current item key;
- remove a row and prove its old callback cannot dispatch;
- travel between different list snapshots and resume;
- empty to populated and populated to empty transitions.

Native proof:

- inspect that the control is NativeScript `ListView` or the accepted native
  collection implementation;
- demonstrate that 1,000 logical rows do not create 1,000 simultaneous native
  row roots;
- record scroll position before and after unrelated updates;
- inspect accessible labels/state on recycled rows;
- verify TalkBack and later VoiceOver announce current row content.

## 24.10 Time-travel verification

Instrument the Command, Subscription, and managed-resource boundaries with
counters.

Required sequence:

1. Run a live Todo flow that produces recorded Commands.
2. Wait for the live runtime to settle.
3. Record command/resource counters.
4. Select at least five historical states repeatedly.
5. Assert Models and native views change as expected.
6. Assert all effect/resource counters remain unchanged.
7. Assert no completion Message is added during travel.
8. Resume and verify the latest live Model.
9. Branch once, if branching is part of the active runtime, and verify old
   completions remain quarantined.

The view may execute pure event-converter construction during replay. It may
not execute a native callback or effect.

## 24.11 Lifecycle and leak verification

Repeat mount/render/dispose at least 100 times in host tests and a practical
number of times on device.

Track:

- wrapper nodes;
- native views reachable from renderer maps;
- active event invokers;
- list cell bindings;
- custom adapters;
- animation/focus handles;
- runtime subscriptions.

After disposal:

- renderer-owned maps are empty;
- the runtime observer is removed;
- no retained callback can dispatch;
- custom disposal counts equal creation counts;
- dispose can be called again safely;
- remount creates one clean root.

Use platform profilers for release-level claims; JavaScript counters alone are
not proof that UIKit/Android objects were released.

## 24.12 Accessibility verification

Fake/semantic tests validate requested meaning:

- accessible label;
- role/control kind;
- checked/selected/disabled/expanded state;
- hint only where it adds meaning;
- stable test identity;
- logical order.

Physical Android evidence:

- accessibility hierarchy includes every interactive control;
- TalkBack can complete add, toggle, edit, delete, and retry;
- recycled list rows announce current content;
- focus is not lost after an unrelated update;
- large text does not hide required actions;
- color is not the only completed/failure indicator.

iOS remains `NOT_RUN` until the equivalent VoiceOver evidence is produced on
macOS/iPhone.

## 24.13 Performance budgets

Use the existing investigation thresholds from [document 11](11-verification.md):

| Operation | Initial target |
|---|---:|
| Todo update plus view description p95 | under 4 ms |
| Native patch for a small update p95 | under 8 ms |
| Input to visible response p95 | under 100 ms |
| Cached time-travel selection | under 50 ms |
| Debug history overhead | under 25% for Todo benchmark |

Renderer-specific measurements:

- initial Counter mount;
- text-only patch;
- one property patch;
- one event-converter update;
- keyed insert/move/remove among 10, 100, and 1,000 fake-host siblings;
- Todo add/toggle/edit/delete patch;
- list scroll and cell recycling;
- repeated travel/resume;
- 100 mount/dispose cycles;
- cold start and bundle size change.

Record device, OS/API, NativeScript version, build mode, sample count, warmup,
thermal state where known, median, p95, and maximum. Debug numbers do not
substitute for a later release-profile run.

## 24.14 Required commands

The implementation should add focused scripts rather than hiding all renderer
work in broad commands. Candidate names:

```text
pnpm verify:renderer:host
pnpm verify:renderer:nativescript
pnpm evidence:renderer
pnpm verify:android:renderer:device
```

Existing commands remain mandatory when affected:

```text
pnpm verify:portable
pnpm verify:web
pnpm evidence:runtime
pnpm verify:android
pnpm verify:android:todo:device
pnpm verify:android:foldkit-portable:device
pnpm verify:android:device
pnpm verify:docs
```

On macOS when Slice J begins:

```text
pnpm verify:ios
```

Command names are proposals until package scripts are implemented. Documentation
verification must not claim they currently exist.

## 24.15 Platform matrix

| Verification | Windows/Node | Browser | Android build | Android device | iOS simulator/device |
|---|---:|---:|---:|---:|---:|
| Host entry imports without DOM | required | required | required | required | later required |
| Fake-host tree contracts | required | optional | build proof | n/a | later required |
| Existing FoldKit web regression | required | required | n/a | n/a | n/a |
| Real control creation | n/a | n/a | insufficient | required | later required |
| Keyed identity | fake host | n/a | insufficient | required | later required |
| Text focus/selection | fake policy | n/a | insufficient | required | later required |
| List virtualization/recycling | fake policy | n/a | insufficient | required | later required |
| Accessibility hierarchy | semantic | web separate | insufficient | required | later required |
| Effect-free time travel | required | required | build proof | required | later required |
| Disposal/leak checks | required | web separate | build proof | required | later required |
| Canonical trace | required | required | build proof | required | later required |

## 24.16 Evidence document template

Implementation must create `docs/evidence/foldkit-nativescript-renderer.md`
with this minimum structure:

```markdown
# FoldKit NativeScript renderer evidence

## Outcome

## Revisions and toolchain

## Baseline

## FoldKit changes

## OriKit changes

## Source provenance and licenses

## Host import boundary

## Contract tests

## Android build and device evidence

## Native hierarchy and accessibility evidence

## Text and list evidence

## Time-travel/effect counters

## Performance

## iOS status

## Failures and workarounds rejected

## Code/maintenance delta

## ADR-0010 recommendation

## Exact next step
```

Include exact commands and summarized outputs. Store bulky generated logs or
screenshots under `artifacts/` only when the repository policy permits them;
do not embed device identifiers or secrets.

## 24.17 Go/no-go report

The final report must answer:

1. Did reuse of FoldKit reconciliation reduce meaningful native renderer code?
2. Did it preserve or improve correctness over the manual Todo renderer?
3. What NativeScript-specific code remains unavoidable?
4. How much FoldKit source/API change is required?
5. Does a second fixture reuse the renderer without application exceptions?
6. Are performance and debugging acceptable on the available Android phone?
7. Is the host boundary independently useful enough to propose upstream?
8. What remains `NOT_RUN` on iOS?

Do not accept the direction merely because Counter renders. Controlled input,
virtualized Todo, cleanup, effect-free time travel, and code/maintenance delta
are mandatory decision evidence.




