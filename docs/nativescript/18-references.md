# 18. Research references

Primary sources checked for the NativeScript-first decision.

## Foldkit

- Foldkit overview and architecture:
  <https://foldkit.dev/>
- Foldkit repository and MIT license:
  <https://github.com/foldkit/foldkit>
- Foldkit testing:
  <https://foldkit.dev/testing>
- Foldkit DevTools:
  <https://foldkit.dev/core/devtools>
- Foldkit AI workflow:
  <https://foldkit.dev/ai/overview>
- Foldkit package metadata:
  <https://raw.githubusercontent.com/foldkit/foldkit/main/packages/foldkit/package.json>

Relevant observations:

- Foldkit 0.133.0 is pre-1.0.
- Its current runtime is browser-oriented.
- It uses Effect 4 beta.
- It exposes HTML, DOM, runtime, Story, Scene, and DevTools subpaths.
- Story semantics are a strong model for portable tests.

## NativeScript

- Introduction:
  <https://docs.nativescript.org/>
- Environment setup:
  <https://docs.nativescript.org/setup/>
- Windows setup:
  <https://docs.nativescript.org/setup/windows>
- Running projects and devices:
  <https://docs.nativescript.org/guide/running>
- Native code:
  <https://docs.nativescript.org/guide/adding-native-code>
- Kotlin/Java:
  <https://docs.nativescript.org/guide/native-code/android>
- Swift/Objective-C:
  <https://docs.nativescript.org/guide/native-code/ios>
- Native typings:
  <https://docs.nativescript.org/guide/native-code/generate-typings>
- UI components:
  <https://docs.nativescript.org/ui/>
- Custom native elements:
  <https://docs.nativescript.org/guide/create-custom-native-elements>
- Multithreading:
  <https://docs.nativescript.org/guide/multithreading>
- Testing:
  <https://docs.nativescript.org/guide/testing>
- Platform versions:
  <https://docs.nativescript.org/guide/platform-version-handling>
- Metadata:
  <https://docs.nativescript.org/guide/metadata>
- Code sharing:
  <https://docs.nativescript.org/guide/code-sharing>
- SwiftUI plugin:
  <https://docs.nativescript.org/plugins/swift-ui>
- Jetpack Compose plugin:
  <https://docs.nativescript.org/plugins/jetpack-compose>
- NativeScript 9 announcement:
  <https://blog.nativescript.org/nativescript-9-announcement/>
- Repository:
  <https://github.com/NativeScript/NativeScript>

Relevant observations:

- Windows supports Android but not local iOS builds.
- NativeScript UI maps to native Android/iOS controls.
- Native APIs are available from TypeScript through metadata.
- Kotlin/Java and Swift/Objective-C files can be included.
- NativeScript 9 supports native ESM and Vite.
- JavaScript normally runs on the UI thread; Workers are isolated.
- Plugins may raise platform minimum versions.

## Android

- Android Studio:
  <https://developer.android.com/studio>
- Run apps on hardware:
  <https://developer.android.com/studio/run/device>
- Android Debug Bridge:
  <https://developer.android.com/tools/adb>
- Platform versions:
  <https://developer.android.com/tools/releases/platforms>

## Apple

- Xcode:
  <https://developer.apple.com/xcode/>
- Xcode system requirements:
  <https://developer.apple.com/xcode/system-requirements>
- Program enrollment and personal-device testing:
  <https://developer.apple.com/help/account/membership/program-enrollment>

## Kotlin Multiplatform fallback

- KMP overview:
  <https://kotlinlang.org/docs/multiplatform.html>
- Platform-specific APIs:
  <https://kotlinlang.org/docs/multiplatform/multiplatform-connect-to-apis.html>
- Supported platform stability:
  <https://kotlinlang.org/docs/multiplatform/supported-platforms.html>

The older KMP-first design remains in the root `docs/` files as fallback
research. It is not the active roadmap.

## Version evidence

Registry versions in the Windows setup audit were read with:

```powershell
npm view nativescript version
npm view @nativescript/core version
npm view @nativescript/android version
npm view @nativescript/ios version
npm view pnpm version
npm view foldkit version
npm view foldkit peerDependencies --json
```

Re-run before implementation and pin the tested combination. Documentation of
a registry version is not proof that the latest versions interoperate.
