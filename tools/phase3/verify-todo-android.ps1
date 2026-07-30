$ErrorActionPreference = 'Stop'

$workspace = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$artifacts = Join-Path $workspace 'artifacts\phase3'
$androidSdk = if ($env:ANDROID_HOME) {
  $env:ANDROID_HOME
} else {
  Join-Path $env:LOCALAPPDATA 'Android\Sdk'
}
$javaHome = if ($env:JAVA_HOME) {
  $env:JAVA_HOME
} else {
  'C:\Program Files\Android\Android Studio\jbr'
}
$adb = Join-Path $androidSdk 'platform-tools\adb.exe'
$apk = Join-Path $workspace 'apps\mobile-spike\platforms\android\app\build\outputs\apk\debug\app-debug.apk'
$applicationId = 'dev.orikit.spike'
$activity = "$applicationId/com.tns.NativeScriptActivity"

if (-not (Test-Path -LiteralPath $adb)) {
  throw "adb not found at $adb"
}
if (-not (Test-Path -LiteralPath (Join-Path $javaHome 'bin\javac.exe'))) {
  throw "JDK not found at $javaHome"
}

New-Item -ItemType Directory -Force -Path $artifacts | Out-Null
$env:ANDROID_HOME = $androidSdk
$env:ANDROID_SDK_ROOT = $androidSdk
$env:JAVA_HOME = $javaHome
$env:Path = "$javaHome\bin;$androidSdk\platform-tools;$env:Path"

function Invoke-Adb {
  param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Arguments)
  & $adb @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "adb failed: $($Arguments -join ' ')"
  }
}

function Get-Hierarchy {
  param([string]$Name)
  $devicePath = "/sdcard/$Name.xml"
  $localPath = Join-Path $artifacts "$Name.xml"
  Invoke-Adb shell uiautomator dump $devicePath | Out-Null
  Invoke-Adb pull $devicePath $localPath | Out-Null
  return Get-Content -LiteralPath $localPath -Raw
}

function Get-BoundsCenter {
  param(
    [string]$Hierarchy,
    [string]$Description
  )
  $escaped = [regex]::Escape($Description)
  $match = [regex]::Match(
    $Hierarchy,
    "<node[^>]*content-desc=`"[^`"]*$escaped[^`"]*`"[^>]*bounds=`"\[(\d+),(\d+)\]\[(\d+),(\d+)\]`""
  )
  if (-not $match.Success) {
    throw "Could not find accessible native control containing '$Description'"
  }
  return @(
    [math]::Floor(([int]$match.Groups[1].Value + [int]$match.Groups[3].Value) / 2),
    [math]::Floor(([int]$match.Groups[2].Value + [int]$match.Groups[4].Value) / 2)
  )
}

function Invoke-TapByDescription {
  param(
    [string]$Hierarchy,
    [string]$Description
  )
  $center = Get-BoundsCenter $Hierarchy $Description
  Invoke-Adb shell input tap $center[0] $center[1] | Out-Null
  Start-Sleep -Milliseconds 350
}

function Save-Screenshot {
  param([string]$Name)
  $devicePath = "/sdcard/$Name.png"
  Invoke-Adb shell screencap '-p' $devicePath | Out-Null
  Invoke-Adb pull $devicePath (Join-Path $artifacts "$Name.png") | Out-Null
}

function Wait-ApplicationFocus {
  for ($attempt = 0; $attempt -lt 10; $attempt += 1) {
    $windowState = @(Invoke-Adb shell dumpsys window) -join "`n"
    if ($windowState -match "mCurrentFocus=.*$([regex]::Escape($applicationId))") {
      return
    }
    Invoke-Adb shell input keyevent KEYCODE_BACK | Out-Null
    Invoke-Adb shell am start '-W' '-n' $activity | Out-Null
    Start-Sleep -Milliseconds 500
  }
  throw "Android application did not retain foreground focus"
}

Push-Location $workspace
try {
  & pnpm verify:android
  if ($LASTEXITCODE -ne 0) {
    throw 'pnpm verify:android failed'
  }

  $devices = @(Invoke-Adb devices)
  $authorizedDevices = @($devices | Where-Object { $_ -match '\s+device\s*$' })
  if ($authorizedDevices.Count -eq 0) {
    throw 'No authorized Android device is connected'
  }

  $installOutput = @(Invoke-Adb install '-r' $apk)
  if ($installOutput -notcontains 'Success') {
    throw "APK installation did not report Success: $($installOutput -join ' ')"
  }

  Invoke-Adb shell input keyevent KEYCODE_WAKEUP | Out-Null
  Invoke-Adb shell wm dismiss-keyguard | Out-Null
  Invoke-Adb logcat '-c' | Out-Null
  Invoke-Adb shell am force-stop $applicationId | Out-Null
  Invoke-Adb shell am start '-W' '-n' $activity | Out-Null

  $ready = $false
  for ($attempt = 0; $attempt -lt 30; $attempt += 1) {
    $rawLog = @(Invoke-Adb logcat '-d' '-v' raw)
    $rawLogText = $rawLog -join ''
    if ($rawLogText -match 'ORIKIT_TODO_READY:') {
      $ready = $true
      break
    }
    Start-Sleep -Milliseconds 500
  }
  if (-not $ready) {
    throw 'Android app did not emit ORIKIT_TODO_READY within 15 seconds'
  }
  if ($rawLogText -notmatch 'ORIKIT_TODO_READY:.*"runtimeStatus":"Running"') {
    throw 'Android Todo did not report the Phase 4 runtime as Running'
  }
  if ($rawLogText -notmatch 'ORIKIT_TODO_READY:.*"sessionId":"session-\d+".*"branchId":"branch-1"') {
    throw 'Android Todo did not report valid session and branch identity'
  }

  Wait-ApplicationFocus

  $initial = Get-Hierarchy 'android-todo-initial'
  foreach ($required in @(
    'android.widget.EditText',
    'android.widget.ListView',
    'android.widget.Button',
    'New task',
    'Mark complete: Try the shared Todo program',
    'Edit: Try the shared Todo program',
    'Delete: Try the shared Todo program'
  )) {
    if ($initial -notmatch [regex]::Escape($required)) {
      throw "Missing native hierarchy evidence: $required"
    }
  }
  if ($initial -match 'android\.webkit\.WebView') {
    throw 'Unexpected WebView in Android hierarchy'
  }
  Save-Screenshot 'android-todo-initial'

  Invoke-TapByDescription $initial 'New task'
  Invoke-Adb shell input text Device_test | Out-Null
  $typed = Get-Hierarchy 'android-todo-draft'
  if ($typed -notmatch 'text="Device_test"[^>]*focused="true"') {
    throw 'Native TextField did not retain focus and entered draft text'
  }

  Invoke-TapByDescription $typed 'Add task'
  $added = Get-Hierarchy 'android-todo-added'
  if ($added -notmatch 'Device_test') {
    throw 'Add did not render the new task'
  }

  Invoke-TapByDescription $added 'Mark complete: Device_test'
  $toggled = Get-Hierarchy 'android-todo-toggled'
  if ($toggled -notmatch 'Mark incomplete: Device_test') {
    throw 'Toggle did not update the recycled row semantics'
  }

  Invoke-TapByDescription $toggled 'Edit: Device_test'
  $editing = Get-Hierarchy 'android-todo-editing'
  if ($editing -notmatch 'Edit task title') {
    throw 'Edit did not expose the native inline editor'
  }
  Invoke-TapByDescription $editing 'Edit task title'
  Invoke-Adb shell input keyevent KEYCODE_MOVE_END | Out-Null
  Invoke-Adb shell input text _edited | Out-Null
  $editedDraft = Get-Hierarchy 'android-todo-edit-draft'
  Invoke-TapByDescription $editedDraft 'Save edited task'
  $edited = Get-Hierarchy 'android-todo-edited'
  if ($edited -notmatch 'Device_test_edited') {
    throw 'Edit did not render the changed title'
  }

  Invoke-TapByDescription $edited 'Delete: Device_test_edited'
  $deleted = Get-Hierarchy 'android-todo-deleted'
  if ($deleted -match 'Device_test_edited') {
    throw 'Delete left stale recycled-row content in the hierarchy'
  }
  Save-Screenshot 'android-todo-final'

  $rawLog = @(Invoke-Adb logcat '-d' '-v' raw)
  $parts = @{}
  $partCount = 0
  foreach ($line in $rawLog) {
    $match = [regex]::Match(
      $line,
      'ORIKIT_TODO_TRACE_ANDROID:(\d+)/(\d+):(.*)$'
    )
    if ($match.Success) {
      $parts[[int]$match.Groups[1].Value] = $match.Groups[3].Value
      $partCount = [int]$match.Groups[2].Value
    }
  }
  if ($parts.Count -ne $partCount -or $partCount -eq 0) {
    throw "Incomplete Android trace: received $($parts.Count) of $partCount parts"
  }
  $androidTrace = -join (1..$partCount | ForEach-Object { $parts[$_] })
  $expectedTrace = (
    & pnpm exec tsx -e "import { canonicalTodoTrace } from './packages/spike-trace/src/index.ts'; console.log(canonicalTodoTrace())"
  ) -join "`n"
  if ($LASTEXITCODE -ne 0 -or $androidTrace -ne $expectedTrace.Trim()) {
    throw 'Android canonical Todo trace differs from the portable trace'
  }

  $report = [ordered]@{
    status = 'pass'
    device = ($authorizedDevices | Select-Object -First 1)
    nativeClasses = @(
      'android.widget.EditText',
      'android.widget.ListView',
      'android.widget.Button'
    )
    webViewPresent = $false
    flows = @('add', 'toggle', 'edit', 'delete')
    focusStableWhileTyping = $true
    staleRecycledRowAfterDelete = $false
    canonicalTraceMatchesPortable = $true
    productionRuntimeStatus = 'Running'
  }
  $report | ConvertTo-Json -Depth 4 |
    Set-Content -LiteralPath (Join-Path $artifacts 'android-todo-report.json')
  $report | ConvertTo-Json -Depth 4
} finally {
  Pop-Location
}
