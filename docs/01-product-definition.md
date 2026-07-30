# 1. Product definition

## 1.1 Problem

FoldKit produces predictable applications because it restricts application
behavior to a visible loop:

```text
event -> Message -> update -> Model + Commands -> runtime
```

That structure also makes AI-generated work easier to inspect, test, and
correct. The goal is to preserve those properties while allowing platform
teams to build genuinely platform-specific interfaces and integrations.

Kotlin Multiplatform provides the compilation and source-set mechanism. It
does not itself provide FoldKit's application architecture, Story tests,
DevTools, or conventions. OriKit supplies that missing layer.

OriKit is an independent, MIT-licensed experiment inspired by FoldKit. It
is not affiliated with or endorsed by FoldKit. Public documentation must
consistently preserve that distinction.

## 1.2 Goals

OriKit must:

1. Put one immutable Model at the center of each program or feature.
2. Represent every application event as a typed Message.
3. Require a synchronous, deterministic update function.
4. Represent side effects as typed Command values returned by update.
5. Serialize dispatch through a single-writer runtime.
6. Compile shared logic for JVM/Android, Kotlin/Native/iOS, and Kotlin/JS.
7. Let Android use Compose and platform APIs directly.
8. Let iOS use SwiftUI and Apple APIs directly.
9. Let the web application remain an idiomatic FoldKit application.
10. Provide FoldKit-like Story tests without real effects, clocks, or devices.
11. Provide a common event history, inspection protocol, and time travel.
12. Expose schemas and runtime state to AI through DevTools and MCP.
13. Give agents one canonical file layout and one canonical pattern.
14. Fail early on unhandled Messages and invalid contracts.

## 1.3 Native definition

For this project, "native" means:

- Android UI is authored in Kotlin using Jetpack Compose and can directly use
  Android views, activities, services, permissions, and SDKs.
- iOS UI is authored in Swift using SwiftUI and can directly use UIKit,
  Foundation, Keychain, Core Location, notifications, and Apple SDKs.
- Shared Kotlin is compiled to the platform's normal KMP output rather than
  executing inside an embedded JavaScript engine.
- Platform UI is not generated from one lowest-common-denominator widget tree.

Native does not mean every line is platform-specific. The purpose is to share
behavior while preserving platform presentation.

## 1.4 Non-goals for version 1

Version 1 will not:

- Compile arbitrary TypeScript or arbitrary Effect programs to Kotlin.
- Share the UI implementation across web, Android, and iOS.
- Replace Compose, SwiftUI, XCTest, or Android UI testing.
- Guarantee mathematical purity for arbitrary Kotlin functions.
- Persist active coroutine continuations across app restarts.
- Replay external reality such as payments or network writes.
- support server-side rendering.
- provide a visual UI designer.
- expose a public compiler-plugin API.

## 1.5 Users

Primary users:

- Product teams that value FoldKit's architecture and tests.
- Teams with native Android and iOS presentation requirements.
- AI-assisted development teams that want constrained, inspectable code.

Secondary users:

- Existing KMP teams that want an Elm runtime.
- Existing FoldKit teams willing to author shared logic in Kotlin.

## 1.6 Experience target

A feature should be recognizable without documentation:

```text
features/todos/
├── TodoModel.kt
├── TodoMessage.kt
├── TodoCommand.kt
├── TodoUpdate.kt
├── TodoFeature.kt
└── TodoStoryTest.kt
```

An agent should be able to:

1. Inspect the feature manifest.
2. Add a Message.
3. Receive an exhaustive `when` error.
4. Implement the transition.
5. Add or update a Story.
6. Run common tests quickly.
7. Inspect the event history in a running target.
8. Add separate native views only when presentation changes.

## 1.7 Success measures

The first production candidate succeeds when:

- At least 80% of non-presentation feature behavior is shared.
- All common Stories run on JVM, JS, and an iOS simulator target.
- Android and iOS use native navigation and accessibility semantics.
- Time travel produces identical logical Models on all targets.
- Every recorded event is schema-versioned and inspectable.
- A new canonical feature can be generated and tested in under five minutes.
- An AI agent can implement a small feature using repository instructions
  without introducing effects inside update.
- Debug dispatch-to-model publication stays below the budget in
  [verification](10-verification.md).

## 1.8 Initial support policy

Actively supported in the first experiment:

- Android API 23 and later.
- iOS 15 and later on 64-bit devices and Apple-silicon simulators.
- Modern evergreen browsers through Kotlin/JS and FoldKit.

The shared kernel may compile for additional KMP targets, but compilation
without CI and example coverage is not a support guarantee. See
[platform integration](05-platform-integration.md) for rationale.
