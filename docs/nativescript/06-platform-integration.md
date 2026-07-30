# 6. Platform integration

## 6.1 NativeScript flavor

Use vanilla NativeScript with TypeScript for the first implementation.

Do not add React, Vue, Angular, Solid, or Svelte during the feasibility spike.
They introduce a second state/rendering architecture and weaken the canonical
Elm structure.

NativeScript 9 with ESM and Vite is the preferred baseline if the spike proves
the dependency combination. Pin exact versions in the lockfile.

## 6.2 Application host

The mobile application:

1. Loads platform configuration.
2. Constructs capability interpreters.
3. Creates the portable runtime.
4. Creates the NativeScript renderer.
5. Connects runtime Model publication to rendering.
6. Connects native events to dispatch.
7. Reports lifecycle.
8. Disposes both runtime and renderer.

The bootstrap file contains wiring, not product update logic.

## 6.3 Direct native APIs from TypeScript

NativeScript exposes native APIs through generated metadata and TypeScript
types.

Preferred order:

1. `@nativescript/core` cross-platform API.
2. Direct platform API in `.android.ts` or `.ios.ts`.
3. Maintained plugin with acceptable version floor and license.
4. Small custom Kotlin/Swift wrapper.
5. Larger native module only after the boundary is stable.

Platform conditional code must be isolated:

```ts
// biometric.android.ts
export const biometric: BiometricCapability = ...

// biometric.ios.ts
export const biometric: BiometricCapability = ...
```

Avoid `if (__IOS__)` throughout feature update files.

## 6.4 Android Kotlin/Java

Native source location:

```text
apps/mobile/App_Resources/Android/src/main/java/
```

Kotlin requires `useKotlin=true` in the NativeScript Android Gradle
configuration. Pin the Kotlin version and verify compatibility with the
selected Android Gradle Plugin and NativeScript version.

Example boundary:

```kotlin
package dev.orikit.device

class DeviceName {
    fun read(): String = android.os.Build.MODEL
}
```

TypeScript:

```ts
const reader = new dev.orikit.device.DeviceName()
const value = reader.read()
```

Generate or hand-author declarations for every native API used by portable
TypeScript. `declare const dev: any` is permitted only in the first throwaway
proof and must not enter framework code.

## 6.5 iOS Swift/Objective-C

Native source location:

```text
apps/mobile/App_Resources/iOS/src/
```

Swift APIs exposed to NativeScript must be Objective-C visible:

```swift
@objcMembers
final class DeviceName: NSObject {
    func read() -> String {
        UIDevice.current.name
    }
}
```

Generate TypeScript types with the NativeScript typings command and commit
stable declarations where reproducibility requires it.

Swift-only types that cannot cross Objective-C interoperability should be
wrapped in a simple `NSObject` API using strings, numbers, data objects, arrays,
dictionaries, callbacks, or explicit wrapper classes.

## 6.6 SwiftUI and Jetpack Compose

NativeScript plugins can embed SwiftUI and Compose.

Use them only when:

- The platform UI cannot be expressed adequately with NativeScript controls.
- The surface has a clear data/event boundary.
- It has lifecycle and disposal tests.
- Its minimum OS impact is accepted.
- The additional native code improves the product, not merely its technology
  résumé.

Data entering a native view is a projection of Model. Events leaving it become
Messages.

Do not create a second native ViewModel that can diverge from the portable
Model.

## 6.7 Permissions

Permission state is handled as an explicit state machine:

```text
Unknown
  ├── request -> Requesting
  ├── result granted -> Granted
  └── result denied -> Denied
```

The Command interpreter performs platform calls. The result is a typed Message.
The Model stores logical permission state, not platform permission objects.

Tests cover:

- First request.
- Previously granted.
- Denied.
- Permanently denied/requires settings.
- Interrupted callback.
- App background during request.

## 6.8 Files, database, and secure storage

Portable interfaces define product operations, not generic native wrappers:

```ts
type CredentialCommand =
  | { readonly _tag: "SaveToken"; readonly token: string }
  | { readonly _tag: "LoadToken" }
  | { readonly _tag: "DeleteToken" }
```

Android may use encrypted storage/Keystore and iOS may use Keychain. Tokens
must be redacted before DevTools, logs, crash reports, or MCP.

Database handles remain in a managed resource. Queries are Commands.

## 6.9 Networking

Choose one portable networking capability after the spike:

- Effect platform service with NativeScript-compatible implementation.
- NativeScript HTTP API.
- Platform-native wrapper for special requirements.

Do not import `@effect/platform-browser` in mobile code.

HTTP behavior tests use a fake capability. Device tests cover TLS, offline
behavior, cancellation, and lifecycle.

## 6.10 Platform versions

Android configuration must explicitly pin:

- `minSdkVersion`
- `compileSdkVersion`
- `targetSdkVersion`
- build tools/AGP/JDK compatibility

iOS configuration must explicitly pin:

- `IPHONEOS_DEPLOYMENT_TARGET`
- Xcode version in CI
- simulator/device OS matrix

Every native plugin is reviewed for:

- Minimum OS.
- Transitive Gradle/CocoaPods dependencies.
- Architecture support.
- Maintenance activity.
- License.
- Release compatibility.

## 6.11 Web integration

The web application remains an idiomatic Foldkit application where possible.

Initial shared boundary:

- Model schemas.
- Message schemas.
- Pure update.
- Portable Command descriptions.
- Story tests.
- Canonical history/replay format.

Web-specific code:

- Foldkit HTML view.
- Browser URL integration.
- DOM mounts.
- Browser storage and network interpreters.
- Web accessibility Scene tests.
- Existing Foldkit DevTools adapter where compatible.

There must be one authoritative reducer. Do not wrap a portable reducer inside
another mutable web state store.

## 6.12 Build host requirements

Windows supports:

- Node and portable tests.
- Foldkit web development.
- NativeScript Android builds.
- Android emulators and physical devices.

macOS supports all of the above plus:

- NativeScript iOS builds.
- Xcode signing.
- iOS simulators.
- Physical iPhone deployment.
- Swift compilation and debugging.

No Windows result is evidence that iOS passed.
