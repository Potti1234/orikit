# OriKit mobile spike

This is the vanilla TypeScript NativeScript application used for the bounded
feasibility spike and the Phase 3 Todo vertical slice. It intentionally
contains no React, Vue, Angular, or other state framework.

From the repository root:

```powershell
pnpm install --frozen-lockfile
pnpm verify:portable
pnpm verify:android
pnpm verify:android:todo:device
```

To install the generated debug APK on an authorized Android device:

```powershell
adb install -r apps/mobile-spike/platforms/android/app/build/outputs/apk/debug/app-debug.apk
adb shell am start -W -n dev.orikit.spike/com.tns.NativeScriptActivity
```

NativeScript must be configured to use pnpm:

```powershell
ns package-manager set pnpm
ns package-manager get
```

The pnpm workspace uses `shamefullyHoist: true` because NativeScript's
official pnpm guidance requires hoisting for a functioning application
dependency layout.

The default screen is the Todo slice. It renders a native `TextField`, a
virtualized native `ListView`, and native buttons. The device verifier builds,
installs, exercises add/toggle/edit/delete, checks focus and recycled-row
semantics, rejects a `WebView`, and compares the Android canonical trace with
the portable trace.
