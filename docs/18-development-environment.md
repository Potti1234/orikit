# 18. Development environment and self-verification

## 18.1 Decision

Start OriKit on Windows with web, JVM/common, and Android development.
Keep the iOS target in the repository from Phase 0, but build and test it on a
real macOS host through GitHub Actions.

This creates two feedback loops:

1. A fast local Windows loop for most framework work.
2. A mandatory Apple lane for Kotlin/Native Apple binaries, Swift interop,
   SwiftUI, XCTest, and the iOS Simulator.

An agent must never report iOS as verified based only on Windows checks.

## 18.2 What can be verified where

| Work | Windows local | Linux CI | macOS CI or Mac | Human/device |
|---|---:|---:|---:|---:|
| Pure update and Story tests on JVM | yes | yes | optional | no |
| Kotlin/JS and FoldKit adapter tests | yes | yes | optional | no |
| Browser unit and Scene tests | yes | yes | Safari only on Mac | visual review |
| Android compile, lint, and unit tests | yes | yes | optional | no |
| Android emulator UI tests | yes | yes | optional | native-feel review |
| Apple Kotlin/Native compilation | no | no | yes | no |
| XCFramework export and Swift import | no | no | yes | no |
| SwiftUI compile and XCTest | no | no | yes | no |
| iOS Simulator UI tests | no | no | yes | native-feel review |
| App Store signing/archive | no | no | yes | release review |

Playwright WebKit on Windows is useful web-engine coverage, but it is not a
substitute for Safari running on macOS.

## 18.3 Windows workstation baseline

Recommended:

- Current 64-bit Windows 11
- Hardware virtualization enabled in UEFI/BIOS
- 32 GB RAM
- At least 100 GB free SSD space for IDEs, Gradle caches, Node packages, and
  several Android Virtual Devices
- A current x64 CPU with Intel VT-x or AMD-V
- Optional physical Android device with USB debugging

Android Studio's published minimum for Studio plus an emulator is 16 GB RAM;
32 GB is recommended. Each extra AVD can consume several additional gigabytes.

### Audit of the current machine on 2026-07-24

Detected:

- Windows 11 Pro, x64
- Intel Core Ultra 7 258V
- 31.5 GB usable RAM
- Git installed
- Node installed
- WSL 2 installed; its default distribution is currently `docker-desktop`

Not detected on `PATH`:

- Java
- Android Studio and Android SDK
- `adb` and Android Emulator
- Corepack and pnpm
- GitHub CLI

Windows management information reported firmware virtualization and
second-level address translation as unavailable. Confirm in Task Manager under
**Performance > CPU > Virtualization**. If it says Disabled, enable Intel
Virtualization Technology/VT-x in UEFI before creating an Android emulator.
The physical-device path can be used temporarily, but CI and the minimum-API
matrix still require emulators.

## 18.4 Install order on Windows

### Step 1 — enable virtualization

1. Open Task Manager and check the CPU Virtualization field.
2. If disabled, enter the machine's UEFI settings.
3. Enable Intel Virtualization Technology/VT-x.
4. Reboot.
5. Confirm Task Manager now reports **Enabled**.

Do not change unrelated UEFI security settings.

### Step 2 — install Android Studio

Install the current stable Android Studio release and let its Setup Wizard
install:

- The bundled JetBrains Runtime used as the JDK
- Android SDK Platform
- Android SDK Platform-Tools
- Android SDK Build-Tools
- Android Emulator
- Android SDK Command-line Tools

Install the Kotlin Multiplatform IDE plugin. Phase 0 must pin Kotlin, Gradle,
AGP, and Java compatibility in the repository; developers should not rely on
an arbitrary system Gradle installation.

Set `ANDROID_HOME` to the SDK directory if Android Studio has not done so.
Add these SDK directories to the user `PATH`:

```text
%ANDROID_HOME%\platform-tools
%ANDROID_HOME%\emulator
%ANDROID_HOME%\cmdline-tools\latest\bin
```

Use the repository's `gradlew.bat`. Do not install global Gradle.

### Step 3 — create the Android device matrix

Create three AVDs after Phase 0 chooses the current compile/target SDK:

| AVD | Purpose |
|---|---|
| API 23 phone | Enforces the accepted Android 6.0 minimum |
| API 29 phone | Representative older behavior and platform changes |
| Current stable API phone | Current platform behavior |

Use x86_64 system images on this Intel Windows host. Keep one small physical
Android device in the manual test matrix if available. The implementation
agent must prove installation on API 23, not merely compile with `minSdk = 23`.

### Step 4 — pin the web toolchain

Keep the existing Node installation only if it matches the LTS version selected
in Phase 0. Commit one version declaration such as `.node-version` and pin the
package manager through the root `package.json` `packageManager` field.

Enable Corepack or install the pinned pnpm release. The lockfile is mandatory.
Do not accept an unpinned globally installed package manager as reproducible
evidence.

Install the browser binaries used by the repository's Playwright configuration.
At minimum, run Chromium, Firefox, and WebKit in CI. Run a real Safari lane on
macOS for release-level web compatibility.

### Step 5 — install GitHub CLI

Install `gh`, authenticate it to the repository, and verify:

```powershell
gh auth status
```

The agent uses GitHub Actions as its macOS build machine. Repository access
should be no broader than needed to push a branch and read workflow results.
Publishing packages, creating releases, and changing repository secrets remain
separate permissions.

## 18.5 Environment doctor

Phase 0 must add a read-only `doctor` command and a PowerShell entry point. Its
contract is:

```powershell
.\tools\doctor.ps1
```

It reports, without modifying the machine:

- OS and architecture
- Java and selected Gradle toolchain
- Node and pnpm versions
- `ANDROID_HOME`
- `adb` and emulator availability
- Configured AVDs and their API levels
- Hardware acceleration status
- Git and GitHub authentication status
- Whether this host can run Apple checks
- Differences from versions pinned in the repository

Each line is `PASS`, `WARN`, `FAIL`, or `NOT_APPLICABLE`. The command exits
non-zero only for missing requirements applicable to the current host. It must
never label Apple checks `PASS` on Windows.

Until that command exists, use:

```powershell
git --version
java -version
node --version
pnpm --version
adb version
emulator -list-avds
gh auth status
```

## 18.6 Stable verification command contract

Phase 0 must expose stable root commands so agents do not have to guess Gradle
task names. The implementation may compose lower-level tasks, but these names
are the public development interface:

```powershell
.\gradlew.bat verifyPortable
.\gradlew.bat verifyWeb
.\gradlew.bat verifyAndroid
.\gradlew.bat verifyAndroidConnected
.\gradlew.bat verifyGenerated
.\gradlew.bat verifyDocs
.\tools\verify-windows.ps1
```

Required behavior:

- `verifyPortable`: common/JVM/JS core, Story, codec, and replay tests.
- `verifyWeb`: Kotlin/JS export, TypeScript checks, FoldKit tests, and browser
  tests.
- `verifyAndroid`: compile, unit tests, lint, and debug APK.
- `verifyAndroidConnected`: UI/runtime tests on the selected attached AVD.
- `verifyGenerated`: fail on stale generated manifests, schemas, or adapters.
- `verifyDocs`: links and code examples.
- `verify-windows.ps1`: doctor followed by all non-Apple checks, with an
  optional device-matrix mode.

The equivalent macOS contract is:

```bash
./gradlew verifyApple
./tools/verify-macos.sh
```

`verifyApple` includes all Kotlin/Native Apple tests, XCFramework generation,
Swift import smoke tests, SwiftUI compilation, and XCTest. The shell wrapper
also records Xcode, macOS, simulator, and Swift versions.

These commands are part of the developer API. If internal module names change,
the root aliases remain stable.

## 18.7 CI topology

Create these required workflows in Phase 0:

### Fast lane

- Host: Ubuntu
- Trigger: every pull request and branch push
- Runs portable, web headless, formatting, lint, generated-file, and docs
  checks
- Target: under 10 minutes after caches are warm

### Windows lane

- Host: `windows-latest`
- Trigger: every pull request
- Runs the same Windows command used locally
- Detects path separators, PowerShell behavior, and Windows toolchain issues

### Android emulator lane

- Host: Linux with hardware acceleration
- Trigger: pull requests affecting runtime, Android, or examples
- API 23 is required on every relevant pull request
- API 29 and current API may run nightly until the suite is fast enough
- Upload APK, test XML, logcat, screenshots, and semantic tree on failure

### Apple lane

- Host: a pinned standard GitHub-hosted macOS image, not an unqualified
  moving image for release branches
- Trigger: every pull request affecting common, Native, iOS, serialization,
  code generation, or Gradle configuration
- Runs `verifyApple`, builds the iOS Todo app, and boots a pinned simulator
- Uploads XCTest results, simulator logs, screenshots, XCFramework, and the
  shared conformance output
- A scheduled lane may test the newest Xcode/macOS image without blocking
  ordinary work until compatibility is accepted

### Cross-platform conformance lane

Each backend writes a canonical JSON result for the same fixtures:

- Initial Model
- Ordered Messages
- Model fingerprint after each transition
- Ordered Commands
- Replay result

A final job downloads and byte-compares the JVM, JS/web, Android, and iOS
artifacts. This is the strongest automated evidence that OriKit behaves
like one architecture across platforms.

## 18.8 Agent verification protocol

For every implementation change, the agent:

1. Runs `doctor`.
2. Runs the smallest focused tests while editing.
3. Runs `verify-windows.ps1` before handoff.
4. Pushes the branch or pull request only when the user has authorized that
   repository workflow.
5. Watches the required GitHub Actions jobs with `gh`.
6. Downloads failure artifacts and fixes failures.
7. Repeats until required lanes are green.
8. Reports exact commands, workflow run URL/ID, artifact names, and any
   intentionally unrun manual checks.

Status vocabulary:

- **Passed locally** — command executed successfully on the named host.
- **Passed in CI** — named workflow and run ID succeeded.
- **Not run** — no evidence was produced.
- **Blocked** — a concrete external requirement prevents execution.

“Should work,” compilation of only common code, or a green Android build is not
evidence that iOS passed.

## 18.9 What GitHub-hosted macOS can and cannot do

It can:

- Compile Kotlin/Native Apple targets
- Build and import an XCFramework
- Compile Swift and SwiftUI
- Run unit tests and iOS Simulator UI tests
- Produce screenshots, logs, and conformance artifacts
- Let an agent diagnose most deterministic Apple build failures

It cannot replace:

- Interactive SwiftUI iteration and simulator debugging
- Profiling with Instruments
- Testing camera, Bluetooth, notifications, background execution, and other
  device-sensitive behavior
- Human evaluation of animation, gestures, accessibility, and native feel
- Final checks on physical iPhones

Because OriKit is intended to be a public MIT project, standard
GitHub-hosted macOS runners are currently free for the public repository.
Private repositories receive an included quota and then incur usage charges.

## 18.10 When to obtain a Mac

Use GitHub-hosted macOS immediately. Buy or rent a real Apple-hardware Mac when
Phase 4 begins, or sooner if Swift facade ergonomics become the bottleneck.

Preferred order:

1. A used or refurbished Apple-silicon Mac mini owned by the project. It can
   run headlessly with SSH/Screen Sharing and later act as a self-hosted runner.
2. A hosted real Mac when short-term interactive access is needed.
3. AWS EC2 Mac only when its automation or AWS integration justifies the cost;
   it uses bare-metal Dedicated Hosts with a minimum 24-hour allocation.

A local Mac mini provides the best feedback loop for SwiftUI and usually costs
less over time than frequent bare-metal rental. Keep GitHub-hosted macOS as the
clean-room CI authority even after adding a local Mac.

## 18.11 Assessment of OneClick macOS Simple KVM

The project can technically attempt macOS under QEMU/KVM on Windows through
WSL 2. Its own Windows instructions require virtualization, nested KVM, at
least 8 GB RAM, and VNC. That is not the main problem.

Do not use it as OriKit's Apple verification environment:

- Apple's current Xcode and SDK agreement authorizes the Apple software on
  Apple-branded products and prohibits installing, using, or running it on a
  non-Apple-branded computer.
- The repository's MIT license covers its scripts; it does not grant a license
  to macOS, Xcode, or Apple SDKs.
- Nested virtualization, graphics, USB/iPhone forwarding, macOS updates, and
  simulator behavior add failure modes unrelated to OriKit.
- A green result would be hard for contributors to reproduce and would not be
  a trustworthy release gate.
- The current Windows audit does not report usable firmware virtualization,
  so even its prerequisite is not presently confirmed.

Therefore it is unsuitable for this project on the Windows laptop, even if it
can be made to boot. Use real Apple hardware locally or through a service.

## 18.12 Bootstrap sequence for OriKit

The first implementation agent should execute this order:

1. Prepare Windows using sections 18.3–18.5.
2. Create the public Git repository without changing the MIT license or
   independent-project disclaimer.
3. Implement Phase 0 Gradle structure and pin all toolchain versions.
4. Add `doctor`, stable verification aliases, and both host wrappers.
5. Make the JVM, JS/web, and Android smoke tests pass locally.
6. Add Linux, Windows, Android emulator, and macOS workflows.
7. Add an iOS Swift import smoke test and make the Apple lane pass.
8. Add canonical cross-platform smoke output and compare all backends.
9. Only then begin the Phase 1 core API.

Phase 0 is incomplete until the Apple lane is green. Lack of a local Mac is not
a reason to omit the iOS target; it only changes where it is verified.

## 18.13 Setup acceptance checklist

- [ ] UEFI virtualization is confirmed enabled.
- [ ] Android Studio and KMP plugin are installed.
- [ ] Repository-pinned Java, Node, and pnpm versions are active.
- [ ] `adb` sees an emulator or physical device.
- [ ] API 23, API 29, and current AVD definitions exist.
- [ ] GitHub CLI is authenticated to the intended repository.
- [ ] `doctor` passes all Windows-applicable requirements.
- [ ] Portable, web, and Android local verification passes.
- [ ] Public GitHub Actions repository has required branch checks.
- [ ] macOS CI imports the Kotlin framework from Swift.
- [ ] iOS Simulator smoke test passes.
- [ ] Cross-platform conformance artifacts match.
- [ ] No result implies Apple verification occurred on Windows.

