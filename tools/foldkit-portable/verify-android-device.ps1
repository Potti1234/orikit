
$ErrorActionPreference = 'Stop'

$workspace = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$artifacts = Join-Path $workspace 'artifacts\foldkit-portable'
$androidSdk = if ($env:ANDROID_HOME) { $env:ANDROID_HOME } else { Join-Path $env:LOCALAPPDATA 'Android\Sdk' }
$adb = Join-Path $androidSdk 'platform-tools\adb.exe'
$apk = Join-Path $workspace 'apps\mobile-spike\platforms\android\app\build\outputs\apk\debug\app-debug.apk'
$applicationId = 'dev.orikit.spike'
$activity = "$applicationId/com.tns.NativeScriptActivity"

if (-not (Test-Path -LiteralPath $adb)) { throw "adb not found at $adb" }
New-Item -ItemType Directory -Force -Path $artifacts | Out-Null

function Invoke-Adb {
  param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Arguments)
  & $adb @Arguments
  if ($LASTEXITCODE -ne 0) { throw "adb failed: $($Arguments -join ' ')" }
}

function Wait-ForLogMarker {
  param([string]$Marker, [int]$Attempts = 60)
  for ($attempt = 0; $attempt -lt $Attempts; $attempt += 1) {
    $log = @(Invoke-Adb logcat '-d' '-v' raw)
    if ($log -match [regex]::Escape($Marker)) { return ($log -join "`n") }
    Start-Sleep -Milliseconds 500
  }
  throw "Android app did not emit $Marker"
}

function Get-Hierarchy {
  param([string]$Name)
  $devicePath = "/sdcard/$Name.xml"
  $localPath = Join-Path $artifacts "$Name.xml"
  $dumped = $false
  for ($attempt = 0; $attempt -lt 4; $attempt += 1) {
    & $adb shell uiautomator dump $devicePath | Out-Null
    if ($LASTEXITCODE -eq 0) {
      $dumped = $true
      break
    }
    Start-Sleep -Milliseconds 500
  }
  if (-not $dumped) { throw "Could not dump Android hierarchy to $devicePath" }
  Invoke-Adb pull $devicePath $localPath | Out-Null
  return Get-Content -LiteralPath $localPath -Raw
}

function Invoke-TapByDescription {
  param([string]$Hierarchy, [string]$Description)
  $escaped = [regex]::Escape($Description)
  $match = [regex]::Match(
    $Hierarchy,
    "(?i)<node[^>]*content-desc=`"[^`"]*$escaped[^`"]*`"[^>]*bounds=`"\[(\d+),(\d+)\]\[(\d+),(\d+)\]`""
  )
  if (-not $match.Success) {
    $match = [regex]::Match(
      $Hierarchy,
      "(?i)<node[^>]*text=`"[^`"]*$escaped[^`"]*`"[^>]*bounds=`"\[(\d+),(\d+)\]\[(\d+),(\d+)\]`""
    )
  }
  if (-not $match.Success) { throw "Could not find accessible control containing '$Description'" }
  $x = [math]::Floor(([int]$match.Groups[1].Value + [int]$match.Groups[3].Value) / 2)
  $y = [math]::Floor(([int]$match.Groups[2].Value + [int]$match.Groups[4].Value) / 2)
  Invoke-Adb shell input tap $x $y | Out-Null
  Start-Sleep -Milliseconds 400
}

Push-Location $workspace
try {
  & pnpm verify:android
  if ($LASTEXITCODE -ne 0) { throw 'pnpm verify:android failed' }

  & $adb uninstall $applicationId | Out-Null
  $installOutput = @(Invoke-Adb install $apk)
  if ($installOutput -notcontains 'Success') { throw 'APK installation did not report Success' }

  Invoke-Adb shell input keyevent KEYCODE_WAKEUP | Out-Null
  Invoke-Adb shell wm dismiss-keyguard | Out-Null
  Invoke-Adb logcat '-c' | Out-Null
  Invoke-Adb shell am force-stop $applicationId | Out-Null
  Invoke-Adb shell am start '-W' '-n' $activity | Out-Null
  Wait-ForLogMarker 'ORIKIT_TODO_READY:' | Out-Null

  $todo = Get-Hierarchy 'todo-with-kernel-route'
  Invoke-TapByDescription $todo 'Kernel'
  $portableLog = Wait-ForLogMarker 'FOLDKIT_PORTABLE_READY:'
  if ($portableLog -notmatch '"name":"VerifyPortableCommand","wasDeferred":true,"serializedEffect":false') {
    throw 'FoldKit Command did not prove deferred execution'
  }
  if ($portableLog -notmatch '"portableCount":1') { throw 'FoldKit Command did not dispatch its Message' }

  for ($attempt = 0; $attempt -lt 5; $attempt += 1) {
    Invoke-Adb shell input swipe 540 1900 540 550 350 | Out-Null
    Start-Sleep -Milliseconds 250
  }
  $before = Get-Hierarchy 'foldkit-portable-before'
  foreach ($required in @(
    'android.widget.Button',
    'android.widget.TextView',
    'Foldkit portable counter value 1',
    'Increment Foldkit portable counter'
  )) {
    if ($before -notmatch [regex]::Escape($required)) { throw "Missing native hierarchy evidence: $required" }
  }
  if ($before -match 'android\.webkit\.WebView') { throw 'Unexpected WebView in hierarchy' }

  Invoke-TapByDescription $before 'Increment Foldkit portable counter'
  $after = Get-Hierarchy 'foldkit-portable-after'
  if ($after -notmatch 'content-desc="Foldkit portable counter value 2') {
    throw 'Native FoldKit Message dispatch did not render counter value 2'
  }

  $report = [ordered]@{
    status = 'passed'
    commandName = 'VerifyPortableCommand'
    commandWasDeferred = $true
    initialCount = 1
    countAfterNativeTap = 2
    nativeButton = 'android.widget.Button'
    nativeLabel = 'android.widget.TextView'
    webViewPresent = $false
  }
  $report | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $artifacts 'android-report.json')
  $report | ConvertTo-Json
} finally {
  Pop-Location
}


