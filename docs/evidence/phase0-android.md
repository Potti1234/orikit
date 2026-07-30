# Phase 0 Android evidence

## Status

Recorded on 2026-07-29.

Phase 0's workstation, build, installation, launch, and native-control checks
pass on the connected Android device. Repository publication, a clean-checkout
CI run, and an actual Git commit remain outside this evidence because the
folder is not yet a Git repository.

## Environment

| Component | Observed |
|---|---|
| Host | Windows 11 x64 |
| Node | 26.4.0 |
| npm | 11.18.0 |
| pnpm | 11.17.0 |
| NativeScript CLI | 9.0.6 |
| NativeScript Android runtime | 9.0.5 |
| NativeScript Core | 9.0.20 |
| JDK | Android Studio JBR 21.0.10 |
| Device | Samsung SM-G781B |
| Device Android | Android 13, API 33 |
| Device ABI | arm64-v8a |
| Application ID | `dev.orikit.spike` |
| Installed minimum SDK | 24 |
| Installed target SDK | 35 |

The private ADB serial is deliberately omitted.

## Commands and results

```text
PASS: adb devices -l
      One authorized physical device reported as device.

PASS: pnpm install --frozen-lockfile
      Lockfile was current; two workspace projects were recognized.

PASS: pnpm lint
      Biome checked 13 authored files with no errors.

PASS: pnpm verify:portable
      Strict TypeScript check passed.

PASS: pnpm run doctor:android
      NativeScript reported no Android configuration issues.

PASS: pnpm verify:android
      Webpack and Gradle produced app-debug.apk.

PASS: adb install -r <app-debug.apk>
      Streamed installation returned Success.

PASS: adb shell am start -W
      Cold launch returned Status: ok in 1,022 ms.
```

The first build downloaded Gradle and missing Android 35 components. NativeScript
reported 118.701 seconds for the Gradle build portion.

## APK

```text
Size:    102,163,351 bytes
SHA-256: bcf731bd453f6936a3fc122ca2f0b7fd81546c31ef388dc2d635e55ea868b155
```

This hash identifies this local debug build only. Rebuilding can legitimately
produce a different debug APK.

## Native UI proof

The launched activity was:

```text
dev.orikit.spike/com.tns.NativeScriptActivity
```

The UI Automator hierarchy contained:

```text
android.view.View
android.view.ViewGroup
android.widget.FrameLayout
android.widget.LinearLayout
android.widget.TextView
```

It contained the visible `Home` label and contained no `WebView` class. This is
evidence that the stock screen uses Android controls rather than a browser
wrapper.

Local, ignored evidence is generated under `artifacts/phase0/`:

```text
android-logcat.txt
android-view-tree.xml
screenshot.png
```

The screenshot was visually inspected and shows the NativeScript `Home`
ActionBar on the physical device.

## Tooling finding

NativeScript initially considered npm its package manager and launched webpack
with `--preserve-symlinks`. That broke pnpm dependency resolution and produced
misleading Vue/Ajv errors in a vanilla application.

The accepted fix was:

```powershell
ns package-manager set pnpm
```

The workspace also records:

```yaml
shamefullyHoist: true
```

No Vue dependency or UI framework was added.

## Remaining Phase 0 work

- Initialize the public repository when its remote/organization is chosen.
- Add and execute clean-checkout CI.
- Pin the final experimental `minSdkVersion`; the generated stock app currently
  resolves to API 24.
- Begin Phase 1 only under the feasibility-spike gates.

