# 11. Verification and acceptance

## 11.1 Evidence vocabulary

- **Passed locally**: named command succeeded on named host.
- **Passed on device**: named command/flow succeeded on identified device and
  OS version.
- **Passed in CI**: workflow name and run ID succeeded.
- **Not run**: no evidence.
- **Blocked**: a concrete external condition prevents running it.
- **Failed**: command ran and did not meet the criterion.

“Should work” is not a status.

## 11.2 Stable command contract

Once Phase 0 exists:

```powershell
pnpm doctor
pnpm verify:portable
pnpm verify:web
pnpm verify:android
pnpm verify:android:device
pnpm verify:docs
pnpm verify:windows
```

On macOS:

```bash
pnpm verify:ios
pnpm verify:macos
```

Expected:

- `verify:portable`: typecheck, core, Story, codec, replay.
- `verify:web`: Foldkit, Scene, browser, web production build.
- `verify:android`: NativeScript prepare/build and Android unit checks.
- `verify:android:device`: connected-device runtime and UI smoke tests.
- `verify:docs`: internal links, examples, spelling rules where configured.
- `verify:windows`: doctor plus all Windows-applicable checks.
- `verify:ios`: NativeScript iOS build, simulator, Swift wrapper, trace.

## 11.3 Host matrix

| Check | Windows | Linux CI | macOS | Physical device |
|---|---:|---:|---:|---:|
| TypeScript typecheck | yes | yes | yes | no |
| Story/codec/replay | yes | yes | yes | no |
| Foldkit web | yes | yes | yes | browser review |
| Android build | yes | yes | yes | no |
| Android runtime | yes | yes | optional | Android |
| Native Android UI | emulator | emulator | optional | preferred |
| iOS build | no | no | yes | no |
| iOS simulator | no | no | yes | no |
| Native iOS UI | no | no | simulator | iPhone preferred |
| Swift wrapper | no | no | yes | optional |

## 11.4 Canonical trace

Each target emits:

```json
{
  "fixture": "counter-v1",
  "program": {
    "name": "counter",
    "schemaVersion": 1,
    "buildVersion": "..."
  },
  "initialModel": {},
  "events": [
    {
      "sequence": 1,
      "message": {},
      "modelFingerprint": "...",
      "commands": []
    }
  ],
  "finalModelFingerprint": "..."
}
```

Ignore only explicitly documented observation metadata. Semantic fields must
byte-match after canonicalization.

## 11.5 Feasibility gates

Mandatory:

- Effect Schema encode/decode on Android.
- Exhaustive update on Android.
- Native control event dispatch.
- Native controls confirmed, no WebView.
- Historical Model rendering.
- Direct Android API.
- Kotlin wrapper with TypeScript boundary.
- Node/web/Android trace equality.
- Clean rebuild and reinstall.

If Effect runtime itself partially fails, record which components fail and
whether a small portable interpreter avoids them. Broad polyfill work is not
an automatic pass.

## 11.6 Correctness budgets

The runtime must prove:

- No lost Messages in 10,000 dispatch stress test.
- Stable FIFO order for a single dispatch source.
- Explicit ordering across concurrent sources based on enqueue time.
- No Command scheduled before its Model commit.
- Exactly one accepted terminal completion per ordinary Command.
- No accepted callback after disposal or wrong branch.
- Canonical replay match at every event.

## 11.7 Performance budgets

Initial debug targets on a representative physical Android phone:

| Operation | Target |
|---|---:|
| Simple update p95 | under 1 ms |
| Counter view description p95 | under 1 ms |
| Todo update + view description p95 | under 4 ms |
| Native patch for small update p95 | under 8 ms |
| Input-to-visible response p95 | under 100 ms |
| Time-travel cached selection | under 50 ms |
| Debug history overhead | under 25% for Todo benchmark |

These are investigation thresholds, not public guarantees. Record device,
release/debug mode, sample size, and thermal state.

Also measure:

- Cold start.
- APK/IPA size.
- JavaScript heap.
- History bytes per event.
- 1,000-item list scrolling.
- Long-session memory behavior.

## 11.8 Native UI proof

For each platform:

- Inspect underlying control classes.
- Capture accessibility/view hierarchy.
- Prove text input uses native keyboard.
- Prove list virtualization/recycling.
- Prove native back/navigation behavior.
- Confirm no full-screen WebView owns the application UI.

Screenshots alone are insufficient.

## 11.9 Compatibility matrix

Android:

- Provisional min API.
- API 29.
- Current stable API.
- Physical Samsung S20 FE available during initial setup.

iOS:

- Deployment minimum simulator where current Xcode supports it.
- Current stable iOS simulator.
- Physical iPhone after acquisition.

Web:

- Chromium.
- Firefox.
- WebKit in Playwright.
- Real Safari before release-level claims.

## 11.10 Accessibility acceptance

- Semantic names/roles/states present.
- TalkBack critical flow passes.
- VoiceOver critical flow passes.
- Large text does not hide critical actions.
- Reduced motion is respected.
- Color is not the only state indicator.
- Touch targets follow platform guidance.

## 11.11 Security acceptance

- Release build has no enabled DevTools listener.
- Read-only MCP cannot mutate.
- Mutation mode requires explicit development action.
- Sensitive fixtures are absent from logs, history export, crash report, and
  MCP responses.
- Inspector does not bind publicly by default.
- Native plugins and npm dependencies have recorded licenses and review.

## 11.12 Documentation verification

Verify:

- All relative Markdown links resolve.
- Code fences declare a language where appropriate.
- No authoritative document points agents to the KMP roadmap.
- Product disclaimer is present.
- Support claims have a test matrix.
- Open decisions are not phrased as completed features.

## 11.13 Phase handoff table

```markdown
| Criterion | Status | Evidence |
|---|---|---|
| Portable tests | Passed locally | `pnpm verify:portable` |
| Android build | Passed locally | `pnpm verify:android` |
| Android device | Passed on device | model / OS / command |
| iOS | Not run | no macOS execution in this phase |
```
