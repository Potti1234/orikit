# Foldkit portable NativeScript renderer evidence

Date: 2026-07-31

## Outcome

OriKit now has a reusable host-neutral reconciler connected to real
NativeScript controls. The portable Foldkit program/runtime remains the shared
non-web boundary; the native view is a separate pure description. Counter and
Todo both use the same renderer. Todo is the default route. After the unlocked
device gate passed, the duplicate XML/manual Todo renderer was removed.

Direct reuse of Foldkit's Snabbdom patch initializer was rejected. Its VNode,
DOM API, module hooks, default document access, and node operations are typed
around browser DOM objects. Extracting a clean generic host would be broader
than the local renderer and would raise the fork maintenance cost identified in
the plan's pause conditions.

## Implemented

- Explicit NativeScript element registry with reviewed properties and child
  operations.
- Real Page/Stack/Grid/Scroll/Label/Button/TextField/Switch/activity/image/list
  mappings without a WebView or UI framework.
- Keyed reconciliation, stable event invokers, actionable property errors, and
  idempotent listener/custom-adapter disposal.
- Controlled Android TextField focus and selection capture/restoration.
- Specialized virtualized ListView adapter with keyed ObservableArray updates
  and recycled row rebinding.
- Custom motion summary adapter outside Model and history.
- Renderer inspection accounting and 100 mount/dispose-cycle retention test.
- Visible-model subscription for replay/time-travel rendering; Commands and
  resources remain owned solely by the application runtime.

## Verification

| Check | Result |
| --- | --- |
| Renderer TypeScript | PASSED |
| Renderer tests | PASSED: 10 |
| Mobile TypeScript | PASSED |
| Mobile tests | PASSED: 6 |
| Android webpack/Gradle build | PASSED |
| Physical Android install/start, Samsung SM-G781B | PASSED |
| On-device renderer marker | PASSED: 9 real mounted nodes, 2 event invokers |
| Canonical Todo fingerprint | PASSED: `be8b55ce7256bbfcb9b7f50bb71488bb0ca9ff7779eac9941e51d440997250c2` |
| Native hierarchy and interaction flow | PASSED on unlocked physical device |
| Add, toggle, edit, delete | PASSED |
| Controlled typing focus and stale recycled rows | PASSED |
| TalkBack and 1,000-row stress | NOT RUN |
| iOS/Xcode/UIKit/VoiceOver | NOT RUN |

The device hierarchy reported Android `ListView`, `EditText`, and `Button`
classes with no `WebView`. The automated flow verified add, toggle, edit, and
delete behavior, stable input focus, no stale recycled row after deletion, the
running production runtime, and byte-identical canonical trace output.

## Remaining gates

Complete the remaining scroll-retention, time-travel interaction, and 1,000-row
performance flows. Repeat the platform suite on macOS/Xcode before claiming
iOS support.
