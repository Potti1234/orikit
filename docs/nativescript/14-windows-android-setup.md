# 14. Windows and Android setup

## 14.1 Objective

Prepare this Windows laptop to:

- Run portable TypeScript and Foldkit tests.
- Build NativeScript Android applications.
- Install and debug them on the connected physical Android phone.
- Produce reproducible evidence for implementation agents.

Do not install Apple tooling or attempt macOS virtualization on this machine.

## 14.2 Current machine audit

Initial audit and setup verification performed on 2026-07-29:

| Requirement | Detected |
|---|---|
| Windows x64 | yes |
| Git | `C:\Program Files\Git\cmd\git.exe` |
| Node | `v26.4.0` |
| npm | `11.18.0` |
| Java/Javac | Android Studio JBR 21.0.10; configured |
| Android Studio | installed at `C:\Program Files\Android\Android Studio` |
| Android SDK | installed; API 29, 36, and 36.1 present |
| `ANDROID_HOME` | `C:\Users\<user>\AppData\Local\Android\Sdk` |
| `ANDROID_SDK_ROOT` | intentionally unset |
| `adb` | 1.0.41 / Platform Tools 37.0.0 |
| NativeScript CLI `ns` | 9.0.6 |
| pnpm | 11.17.0 |
| Corepack | not installed |

Connected USB device detected by Windows:

```text
SAMSUNG Mobile USB Composite Device
SAMSUNG Mobile USB Connectivity Device V2
S20 FE von Lukas
```

This means the cable and Samsung Windows driver/MTP path are working. After the
toolchain installation, `adb devices -l` still returned no devices. USB
debugging must be enabled and authorized on the phone before the physical-device
test can run.

Current npm registry versions observed on 2026-07-29:

```text
nativescript CLI          9.0.6
@nativescript/core        9.0.20
@nativescript/android     9.0.5
@nativescript/ios         9.0.3
pnpm                     11.17.0
foldkit                   0.133.0
effect required by Foldkit 4.0.0-beta.102
```

The implementation must pin tested versions rather than automatically combine
all latest package versions.

## 14.3 What is already sufficient

Node 26.4 satisfies NativeScript 9's Node requirement. Keep it for the
feasibility spike unless the generated project or a dependency proves
incompatible.

The Node installation initially included npm 12.0.0. NativeScript CLI 9.0.6
still invokes `npm view --dist-tags`; npm 12 rejects that option and caused
NativeScript's version check to receive an undefined version. npm was therefore
pinned globally to 11.18.0, which supports Node 26 and restores the NativeScript
CLI behavior. Keep npm on major version 11 until NativeScript removes that
dependency or a verified newer CLI supports npm 12.

Do not downgrade Node preemptively.

## 14.4 Install Android Studio

Preferred:

1. Download the current stable Android Studio from:
   <https://developer.android.com/studio>
2. Run the installer.
3. Select:
   - Android Studio
   - Android SDK
   - Android SDK Platform
   - Android SDK Platform-Tools
   - Android Virtual Device
4. Complete the Setup Wizard.

Optional Windows Package Manager:

```powershell
winget install --id Google.AndroidStudio --exact
```

Verify the package ID before accepting the installation if Winget shows a
different publisher or source.

## 14.5 Install Android SDK components

In Android Studio:

1. Open **More Actions > SDK Manager**.
2. Note **Android SDK Location**.
3. Under **SDK Platforms**, install:
   - The current stable Android platform.
   - Android API 29 for the representative older-device emulator.
   - The provisional minimum platform when Phase 0 fixes it.
4. Under **SDK Tools**, install:
   - Android SDK Build-Tools.
   - Android SDK Platform-Tools.
   - Android SDK Command-line Tools (latest).
   - Android Emulator.
   - Google USB Driver, although the Samsung driver is already present.

The connected phone is the fastest initial target; emulator setup may follow
after the physical smoke test.

## 14.6 Configure environment

The usual SDK path is:

```text
C:\Users\<user>\AppData\Local\Android\Sdk
```

Confirm the actual path in Android Studio before setting anything.

Set the user environment variable:

```text
ANDROID_HOME=<actual Android SDK path>
```

Add to user `PATH`:

```text
%ANDROID_HOME%\platform-tools
%ANDROID_HOME%\emulator
%ANDROID_HOME%\cmdline-tools\latest\bin
```

Close and reopen PowerShell, then verify:

```powershell
$env:ANDROID_HOME
adb version
sdkmanager --version
```

`ANDROID_SDK_ROOT` is deprecated by parts of the Android toolchain, but some
tools still inspect it. Do not set it to a different path. If a tool requires
it, set it equal to `ANDROID_HOME`.

## 14.7 Java

Android Studio includes a JetBrains Runtime. NativeScript/Gradle command-line
builds also need a discoverable compatible JDK.

First try the Android Studio bundled runtime and run:

```powershell
ns doctor android
```

If Java is not discovered:

1. Locate Android Studio's `jbr` directory.
2. Set user `JAVA_HOME` to that directory.
3. Add `%JAVA_HOME%\bin` to user `PATH`.
4. Open a new PowerShell.
5. Verify:

```powershell
java -version
javac -version
```

Do not install global Gradle. NativeScript and the Android project own their
Gradle wrapper/configuration.

If the generated NativeScript/AGP combination requires a different JDK, pin
that decision in the repository and update this document.

## 14.8 Install NativeScript CLI

NativeScript's official setup uses:

```powershell
npm install --global nativescript@9.0.6
```

Verify:

```powershell
ns --version
ns doctor android
```

For repository reproducibility, Phase 0 should also add the CLI version to
`devDependencies` and expose scripts through pnpm. The global CLI is useful for
initial environment diagnosis.

Do not ignore `ns doctor android` failures. Record the exact missing component.

## 14.9 Install pnpm

Corepack is not present in the current Node installation. Install the currently
selected package manager explicitly:

```powershell
npm install --global pnpm@11.17.0
pnpm --version
```

Phase 0 then commits:

```json
{
  "packageManager": "pnpm@11.17.0"
}
```

If the feasibility spike discovers incompatibility, change the pinned version
through an ADR and dedicated dependency change.

Configure NativeScript itself to use pnpm:

```powershell
ns package-manager set pnpm
ns package-manager get
```

NativeScript's webpack process changes its symlink behavior according to this
setting. Leaving it on npm while installing the project with pnpm can cause
misleading transitive dependency failures.

NativeScript's official pnpm guidance requires a hoisted dependency layout.
The root `pnpm-workspace.yaml` therefore records:

```yaml
shamefullyHoist: true
```

## 14.10 Prepare the Samsung S20 FE

On the phone:

1. Open **Settings > About phone > Software information**.
2. Tap **Build number** seven times.
3. Enter the device PIN if requested.
4. Open **Settings > Developer options**.
5. Enable **USB debugging**.
6. Keep the phone unlocked.
7. Reconnect the USB cable.
8. Choose **File transfer / Android Auto** rather than charge-only if Android
   asks for USB mode.
9. Accept **Allow USB debugging** for this computer.
10. Optionally select **Always allow from this computer** for this development
    laptop.

On Windows:

```powershell
adb kill-server
adb start-server
adb devices -l
```

Expected:

```text
<serial>    device product:... model:... transport_id:...
```

## 14.11 USB troubleshooting

### `unauthorized`

1. Unlock the phone.
2. Accept the RSA prompt.
3. If no prompt appears, open Developer options.
4. Select **Revoke USB debugging authorizations**.
5. Toggle USB debugging off/on.
6. Reconnect.
7. Run `adb kill-server` and `adb devices -l`.

### No device listed

1. Use a known data-capable cable.
2. Connect directly rather than through a dock/hub.
3. Change USB mode to file transfer.
4. Inspect Device Manager for Samsung/ADB devices.
5. Install/update Samsung's official USB driver if the ADB interface is
   missing.
6. Restart `adb`.

Windows currently sees the Samsung composite/MTP device, so begin with USB
debugging authorization rather than replacing the cable or driver.

### `offline`

1. Disconnect and reconnect.
2. Restart `adb`.
3. Revoke authorizations and pair again.
4. Restart the phone if necessary.

## 14.12 Create the initial NativeScript application

After the CLI passes:

```powershell
ns create orikit-spike --template @nativescript/template-blank-ts
Set-Location orikit-spike
ns run android --device <device-id>
```

The implementation agent may use the current official template name reported
by `ns create --help` if it changed. Record the exact template and version.

Expected behavior:

1. NativeScript prepares Android sources.
2. Gradle builds a debug APK.
3. `adb` installs it.
4. The app launches on the phone.
5. Source changes can be synchronized during development.

For this repository, the agent should generate the application into the
planned `apps/mobile` location rather than create an unrelated nested
repository.

## 14.13 First evidence to capture

```powershell
node --version
npm --version
pnpm --version
java -version
adb version
adb devices -l
ns --version
ns doctor android
```

Then:

```powershell
ns run android --device <device-id>
adb shell dumpsys package <application-id>
adb logcat -d
```

Capture:

- Device model.
- Android version/API.
- App ID/version.
- Screenshot.
- Native view/accessibility hierarchy if available.
- Build duration.
- Any warnings.

Do not include the device serial number in public documentation or logs.

## 14.14 Emulator matrix

After physical-device smoke test:

| Emulator | Purpose |
|---|---|
| Provisional minimum API | Enforce declared support floor |
| API 29 | Approximately six-year-old Android behavior |
| Current stable API | Current platform/store behavior |

Use an x86_64 image where supported on this Intel Windows host. Hardware
virtualization must be enabled. A physical phone does not replace minimum-API
CI.

## 14.15 Current setup checklist

- [x] Git installed.
- [x] Node 26.4 and compatible npm 11.18.0 installed.
- [x] Samsung S20 FE visible to Windows over USB.
- [x] Android Studio installed.
- [x] Android SDK Platform-Tools installed.
- [x] Android SDK Command-line Tools installed.
- [x] Android API 29 and stable API 36 installed.
- [x] Android SDK licenses accepted.
- [x] `ANDROID_HOME` configured.
- [x] Java/Javac discoverable.
- [x] `adb version` works.
- [x] Phone USB debugging enabled.
- [x] `adb devices -l` reports `device`.
- [x] NativeScript CLI 9.0.6 installed.
- [x] `ns doctor android` passes.
- [x] pnpm 11.17.0 installed globally.
- [x] pnpm 11.17.0 pinned in the workspace manifest.
- [x] Stock NativeScript app launches on phone.
- [ ] Counter feasibility spike launches on phone.

## 14.16 Uninstall/recovery

The setup should not modify the phone beyond developer authorization and test
applications. A test application can be removed from Android settings or:

```powershell
adb uninstall <application-id>
```

Revoking USB debugging authorizations removes this laptop's debugging trust.
Android Studio, SDKs, NativeScript, and pnpm should be uninstalled only through
their normal package/Windows uninstall mechanisms; do not delete broad cache
or home directories.
