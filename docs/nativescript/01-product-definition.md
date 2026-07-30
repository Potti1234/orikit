# 1. Product definition

## 1.1 Problem

Foldkit makes application behavior predictable through a restricted loop:

```text
event -> Message -> update -> Model + Commands -> runtime
```

The architecture provides an unusually strong development and AI workflow:

- State has one authoritative location.
- Transitions are ordinary deterministic functions.
- Effects have explicit names and completion Messages.
- Tests read as stories.
- DevTools can inspect every transition.
- AI agents can inspect the same runtime through MCP.

The current Foldkit implementation targets browser applications. OriKit
tests whether those architectural properties can be retained for Android and
iOS while using actual platform controls and native SDKs.

## 1.2 Product promise

> Write application behavior once in TypeScript using a Foldkit-compatible Elm
> architecture. Render it with Foldkit on the web and real native controls
> through NativeScript on Android and iOS. Use Kotlin or Swift only where a
> platform-specific implementation is valuable. Test and inspect the same
> logical transitions everywhere.

## 1.3 Goals

OriKit must:

1. Use one immutable logical Model for each Program.
2. Represent logical events as schema-validated Messages.
3. Make update synchronous, deterministic, and exhaustive.
4. Return named Command values rather than execute effects inside update.
5. Serialize all dispatch through one runtime queue.
6. Run the same portable Program on the web, Android, and iOS.
7. Render actual Android and iOS controls without a WebView.
8. Allow platform-specific TypeScript implementations.
9. Allow narrow Kotlin/Java and Swift/Objective-C escape hatches.
10. Run most behavior tests on Windows without a device.
11. Provide renderer-neutral Story and view-tree tests.
12. Record Messages, Models, Commands, and resource changes.
13. Support inspection, replay, resume, and deliberate branching.
14. Expose runtime schemas and history to AI through MCP.
15. Keep one canonical repository structure for humans and agents.
16. Detect semantic differences between web, Android, and iOS with shared
    fixtures.

## 1.4 Native definition

For this experiment, native means:

- Normal UI does not run inside a WebView.
- NativeScript controls create or wrap Android `View` and iOS `UIView`
  instances.
- The underlying native control remains accessible when platform-specific
  behavior is necessary.
- Android code may call Java/Kotlin APIs and iOS code may call
  Objective-C/Swift APIs.
- Platform navigation, accessibility, permissions, lifecycle, and system
  conventions are tested on their real platform.

Native does not mean:

- Every line is Kotlin or Swift.
- One shared view definition will automatically look perfectly idiomatic on
  both platforms.
- Logical time travel reverses effects in external systems.
- A generic shared control is always preferable to a platform-specific view.

## 1.5 Non-goals for the first experiment

The first experiment will not:

- Run the current Foldkit DOM runtime unchanged on NativeScript.
- Compile TypeScript into Kotlin or Swift.
- Implement Kotlin Multiplatform.
- Support arbitrary DOM packages on mobile.
- Copy every Foldkit UI component before the Todo slice works.
- Guarantee identical pixels across web, Android, and iOS.
- Implement server-side rendering.
- Replace Xcode, Android Studio, Maestro, XCTest, or platform profilers.
- Put native controllers, views, sockets, database handles, or callbacks in
  Model or Message values.
- Publish npm packages before the spike and API gates pass.
- Claim affiliation or compatibility certification from Foldkit or
  NativeScript.

## 1.6 Users

Primary users:

- Teams that like Foldkit's correctness and test model.
- AI-assisted teams that want predictable application structure.
- TypeScript teams that need real Android and iOS controls.
- Product teams that want shared behavior with platform escape hatches.

Secondary users:

- Existing Foldkit teams willing to add a native view layer.
- NativeScript teams that want a strict Elm runtime.
- Open-source researchers comparing renderer-independent UI architectures.

## 1.7 Initial support policy

The experiment targets:

- Current stable evergreen browsers.
- Android devices from approximately the last six years.
- An explicit minimum Android API selected and proven by the feasibility
  spike; API 26 is the provisional floor, with API 29 as the mandatory
  representative older-device test.
- iOS 15 or later where dependencies permit.
- Windows 11 for portable, web, and Android development.
- A real macOS host for every iOS build and test claim.

`minSdkVersion`, `compileSdkVersion`, `targetSdkVersion`, and
`IPHONEOS_DEPLOYMENT_TARGET` must be explicit. A plugin that raises a minimum
must be treated as a product decision, not a routine dependency update.

## 1.8 Success measures

The feasibility experiment succeeds when:

- One Counter Program executes on Node, web, and an Android device.
- The Android screen contains real native controls.
- Model and Message schemas work inside the NativeScript runtime.
- A native event dispatches a Message through the same pure update function.
- A Story test runs without a device.
- History can display a historical Model on the Android screen.
- One Kotlin API is called from TypeScript through a typed boundary.
- The result trace is canonical and equal between Node, web, and Android.

The first framework milestone succeeds when:

- Todo shares all logical state and transitions.
- Web uses a Foldkit view and Android/iOS use native controls.
- Critical user flows have Story, view-tree, and device tests.
- Navigation, focus, text input, list identity, and scroll position survive
  ordinary updates.
- Remote DevTools and MCP can inspect a connected app.
- The same replay fixture produces identical logical Models everywhere.

## 1.9 Project identity and licensing

OriKit is an independent MIT-licensed project inspired by public Foldkit
and NativeScript work. Reused MIT or Apache-licensed code must retain its
required notices. Public names, package descriptions, and documentation must
not imply official endorsement.
