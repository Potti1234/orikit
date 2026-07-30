# 15. Research references

Primary sources used for the architecture and current toolchain assumptions:

## Kotlin Multiplatform and Native

- [Kotlin/Native overview](https://kotlinlang.org/docs/native-overview.html)
- [Kotlin/Native library format](https://kotlinlang.org/docs/native-libraries.html)
- [KMP project structure](https://kotlinlang.org/docs/multiplatform/multiplatform-discover-project.html)
- [KMP hierarchical source sets](https://kotlinlang.org/docs/multiplatform/multiplatform-hierarchy.html)
- [Sharing code across platforms](https://kotlinlang.org/docs/multiplatform/multiplatform-share-on-platforms.html)
- [Expect and actual example](https://kotlinlang.org/docs/multiplatform/multiplatform-create-first-app.html)
- [KMP common and platform tests](https://kotlinlang.org/docs/multiplatform/multiplatform-run-tests.html)
- [Kotlin/Native compilation-time guidance](https://kotlinlang.org/docs/native-improving-compilation-time.html)
- [Kotlin/Native target tiers and Apple deployment floors](https://kotlinlang.org/docs/native-target-support.html)
- [KMP and Compose platform stability](https://kotlinlang.org/docs/multiplatform/supported-platforms.html)

## Web and JavaScript

- [Kotlin web targets overview](https://kotlinlang.org/docs/web-overview.html)
- [Using Kotlin from JavaScript](https://kotlinlang.org/docs/js-to-kotlin-interop.html)
- [Kotlin/Wasm overview](https://kotlinlang.org/docs/wasm-overview.html)

## iOS integration

- [iOS integration methods](https://kotlinlang.org/docs/multiplatform/multiplatform-ios-integration-overview.html)
- [Direct Xcode integration](https://kotlinlang.org/docs/multiplatform/multiplatform-direct-integration.html)
- [Building native frameworks and XCFrameworks](https://kotlinlang.org/docs/multiplatform/multiplatform-build-native-binaries.html)
- [Swift export and current Alpha limitations](https://kotlinlang.org/docs/native-swift-export.html)

## Runtime and code generation

- [StateFlow API and concurrency behavior](https://kotlinlang.org/api/kotlinx.coroutines/kotlinx-coroutines-core/kotlinx.coroutines.flow/-state-flow/)
- [Kotlin Symbol Processing overview](https://kotlinlang.org/docs/ksp-overview.html)
- [Custom Kotlin compiler plugins](https://kotlinlang.org/docs/custom-compiler-plugins.html)
- [TypeScript Compiler API](https://github.com/microsoft/TypeScript/wiki/Using-the-Compiler-API)

## FoldKit and comparison architectures

- [FoldKit repository and architecture](https://github.com/foldkit/foldkit)
- [FoldKit architecture documentation](https://foldkit.dev/core/architecture)
- [FoldKit embedding](https://foldkit.dev/core/embedding)
- [React Native Fabric](https://reactnative.dev/architecture/fabric-renderer)
- [React Native render pipeline](https://reactnative.dev/architecture/render-pipeline)
- [React Native new architecture and JSI](https://reactnative.dev/architecture/landing-page)
- [Flutter architecture](https://docs.flutter.dev/resources/architectural-overview)
- [Capacitor native runtime](https://capacitorjs.com/docs)

## Platform minimums

- [Jetpack Compose setup and API 21 floor](https://developer.android.com/develop/ui/compose/setup)
- [Current AndroidX default minimum SDK policy](https://developer.android.com/jetpack/androidx/versions)
- [Compose Multiplatform compatibility and platform minimums](https://kotlinlang.org/docs/multiplatform/compose-compatibility-and-versioning.html)

## Development hosts and CI

- [Kotlin Multiplatform environment setup](https://kotlinlang.org/docs/multiplatform-mobile-setup.html)
- [Android Studio installation and system requirements](https://developer.android.com/studio/install)
- [GitHub-hosted runner reference](https://docs.github.com/en/actions/reference/runners/github-hosted-runners)
- [GitHub Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions)
- [GitHub self-hosted runner reference](https://docs.github.com/en/actions/reference/runners/self-hosted-runners)
- [Amazon EC2 Mac instances](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/ec2-mac-instances.html)
- [Apple Xcode and Apple SDKs Agreement](https://www.apple.com/legal/sla/docs/xcode.pdf)
- [OneClick macOS Simple KVM repository](https://github.com/notAperson535/OneClick-macOS-Simple-KVM)
- [OneClick macOS Simple KVM Windows instructions](https://oneclick-macos-simple-kvm.notaperson535.is-a.dev/docs/windows-install/)

## Original article

- [Kotlin/Native compilation under the hood](https://medium.com/@natig.haciyef/kotlin-native-kotlin-multiplatform-compilation-under-the-hood-dd40ec523ecf)

The Medium article is useful background, but toolchain flags and universal
packaging recommendations should be verified against the current official
Kotlin documentation before implementation.
