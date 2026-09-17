# Phase 10 iOS simulator evidence

Date: 2026-09-17

## Host

- macOS 26.5.2, Apple silicon.
- Xcode 26.6 (17F113), Swift 6.3.3.
- Node 26.4.0, pnpm 11.17.0, NativeScript CLI 9.0.6, `@nativescript/ios` 9.1.0,
  `@nativescript/core` 9.0.20.
- Simulator: iPhone 17, iOS 26.5.
- `ns doctor ios`: no errors (CLI/core update notices only).

Simulator results do not establish physical iPhone support.

## Automated

`pnpm verify:ios:simulator` boots the simulator, installs the debug build,
launches `dev.orikit.spike`, waits for `ORIKIT_TODO_READY`, reassembles the
emitted Todo trace, and compares it with `canonicalTodoTrace()`.

```json
{
  "status": "pass",
  "traceBytes": 5146,
  "nativeList": "ListView",
  "nativeTextInput": "TextField",
  "runtimeStatus": "Running",
  "runtimeMetrics": { "quarantinedMessages": 0, "observerDefects": 0, "droppedEvents": 0 },
  "managedResources": [{ "id": "ios.accelerometer", "status": "Active" }]
}
```

Artifacts: `artifacts/phase10/trace-ios.json`, `artifacts/phase10/evidence.json`,
`artifacts/phase10/todo-ios.png`.

## Interactive

Passed:

- Counter render, increment, decrement, reset.
- Time travel to a past event disables counter controls and records no new
  events; resume-live restores dispatch.
- Swift wrapper executes: `Swift: Hello from Swift iPhone`.
- Todo add, mid-string edit, toggle, delete.
- Devtools disconnected state renders.
- Real iOS location permission prompt, denial state, grant via Settings, and one
  CoreLocation fix.
- Native hierarchy is real UIKit: `UITableView` with `ListViewCell`,
  `UITextFieldImpl`, `UIButton`, `TNSLabel`.
- Accessibility labels present at runtime for composer, row actions, location
  entry, and motion status.
- Three Todo/location mount cycles re-acquire `ios.accelerometer` and report
  zero observer defects, dropped events, or quarantined messages.

Failed:

- `openApplicationSettings()` (`UIApplicationOpenSettingsURLString`) opens the
  Settings root instead of the application page on this simulator runtime.

Not verified:

- Real accelerometer samples; the simulator reports
  `ORIKIT_MOTION_UNAVAILABLE:ios`.
- Caret preservation when text is patched externally; no reachable trigger
  without the inspector relay.
- Physical iPhone install and launch.
