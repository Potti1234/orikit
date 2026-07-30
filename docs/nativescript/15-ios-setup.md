# 15. iOS setup and verification

## 15.1 Constraint

NativeScript does not remove Apple's build-host requirement. iOS applications
with native code must be built using macOS and Xcode.

Windows can author and test portable code but cannot produce valid local iOS
evidence.

## 15.2 Recommended access order

1. Local/refurbished Apple-silicon Mac for interactive development.
2. Scaleway Apple-silicon Mac for bounded remote sessions.
3. GitHub-hosted macOS for clean CI.
4. Other real Apple-hardware hosting when needed.

Do not use an unofficial macOS VM on non-Apple hardware as project
verification.

## 15.3 Mac baseline

Recommended:

- Apple-silicon Mac.
- 16 GB RAM minimum.
- 512 GB storage preferred.
- Current macOS supported by the selected Xcode.
- Current stable Xcode plus any pinned older version needed for deployment
  testing.
- Node and pnpm matching repository pins.
- NativeScript CLI matching repository pin.
- CocoaPods only when dependencies require it.

Run:

```bash
xcodebuild -version
swift --version
node --version
pnpm --version
ns --version
ns doctor ios
```

## 15.4 Xcode

1. Install Xcode from the Mac App Store or Apple Developer downloads.
2. Launch it once and accept the license.
3. Install required simulator runtimes.
4. Select command-line tools in Xcode settings.
5. Verify:

```bash
xcode-select -p
xcrun simctl list devices
```

Pin Xcode in CI. A scheduled job may test the newest Xcode separately.

## 15.5 iOS deployment target

Provisional target:

```text
IPHONEOS_DEPLOYMENT_TARGET = 15.0
```

Every CocoaPod, Swift package, NativeScript plugin, and SwiftUI surface must be
checked for a higher minimum. NativeScript's SwiftUI plugin itself documents
iOS 13 as a minimum for its ordinary use and iOS 14 for embedding
NativeScriptView inside SwiftUI, but application dependencies may require
more.

The final target is evidence-based and recorded in an ADR.

## 15.6 Simulator

Run:

```bash
ns run ios --emulator
```

Record:

- Mac and Xcode version.
- Simulator model.
- Simulator iOS version.
- NativeScript versions.
- Canonical trace.

The iOS feasibility vector repeats Android tests for:

- Effect Schema.
- Match/update.
- Effect Scope/Stream/interruption used by runtime.
- Dispatch.
- Native controls.
- Time travel.
- Swift wrapper.

## 15.7 Physical iPhone

Connect by USB, open the generated Xcode workspace/project, select:

- Application target.
- Physical iPhone.
- Signing Team.

An ordinary Apple Account can install and test on a personal device through
Xcode. A paid Apple Developer Program membership is required later for
distribution/TestFlight and certain capabilities.

Enable Developer Mode on the iPhone when requested.

Run:

```bash
ns devices
ns run ios --device <device-id>
```

Do not publish the device identifier.

## 15.8 Swift wrapper

The iOS feasibility wrapper:

1. Lives in `App_Resources/iOS/src`.
2. Inherits from `NSObject`.
3. Uses `@objc`/`@objcMembers`.
4. Returns a simple deterministic value.
5. Has generated TypeScript declarations.
6. Is called from a Command interpreter or platform capability.

Then add an asynchronous callback case to verify cancellation/quarantine.

## 15.9 Signing

Development signing must not be embedded in portable source.

Keep:

- Bundle ID configurable.
- Team configuration local/CI secret.
- Provisioning out of Git.
- Release signing separate from debug verification.

Do not enroll or pay for the Apple Developer Program until distribution or a
restricted capability requires it.

## 15.10 Required iOS evidence

- Clean iOS build.
- Simulator launch.
- Native control hierarchy.
- Canonical trace matching Node/web/Android.
- Swift wrapper typecheck and execution.
- Accessibility tree.
- Repeated mount/dispose result.
- Physical iPhone launch before device support claim.
- Device-sensitive capability tests where relevant.

## 15.11 CI

Required macOS workflow:

1. Install pinned Node/pnpm.
2. Install dependencies from lockfile.
3. Run portable tests.
4. Run iOS feasibility vectors.
5. Build application.
6. Boot pinned simulator.
7. Run smoke/E2E.
8. Export canonical trace.
9. Upload test logs, simulator logs, screenshots, and trace.
10. Compare trace with other targets.

CI does not replace interactive Instruments, VoiceOver, camera, Bluetooth,
notifications, or physical-device review.

## 15.12 iOS checklist

- [ ] Apple-silicon Mac available.
- [ ] Xcode and command-line tools installed.
- [ ] Simulator runtime installed.
- [ ] Node/pnpm/NativeScript pins active.
- [ ] `ns doctor ios` passes.
- [ ] Counter builds and runs in simulator.
- [ ] Effect compatibility vectors pass.
- [ ] Todo builds and runs.
- [ ] Swift wrapper typings pass.
- [ ] Canonical trace matches.
- [ ] Accessibility reviewed.
- [ ] Physical iPhone installs and launches.
- [ ] CI reproduces the build.
