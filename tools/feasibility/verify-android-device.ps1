$ErrorActionPreference = 'Stop'

$workspace = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$artifacts = Join-Path $workspace 'artifacts\feasibility'
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
  Start-Sleep -Milliseconds 300
}

function Get-Sha256 {
  param([string]$Path)
  $stream = [System.IO.File]::OpenRead($Path)
  try {
    $hash = [System.Security.Cryptography.SHA256]::Create().ComputeHash($stream)
    return ([System.BitConverter]::ToString($hash)).Replace('-', '').ToLowerInvariant()
  } finally {
    $stream.Dispose()
  }
}

Push-Location $workspace
try {
  $buildStarted = Get-Date
  & pnpm verify:android
  if ($LASTEXITCODE -ne 0) {
    throw 'pnpm verify:android failed'
  }
  $buildSeconds = ((Get-Date) - $buildStarted).TotalSeconds

  # A clean reinstall is deliberately scoped to the experimental application.
  & $adb uninstall $applicationId | Out-Null
  $installStarted = Get-Date
  $installOutput = @(Invoke-Adb install $apk)
  $installSeconds = ((Get-Date) - $installStarted).TotalSeconds
  if ($installOutput -notcontains 'Success') {
    throw "APK installation did not report Success: $($installOutput -join ' ')"
  }

  Invoke-Adb shell input keyevent KEYCODE_WAKEUP | Out-Null
  Invoke-Adb shell wm dismiss-keyguard | Out-Null
  Invoke-Adb logcat '-c' | Out-Null
  Invoke-Adb shell am force-stop $applicationId | Out-Null
  $launchOutput = @(Invoke-Adb shell am start '-W' '-n' $activity)

  $ready = $false
  for ($attempt = 0; $attempt -lt 30; $attempt += 1) {
    $rawLog = @(Invoke-Adb logcat '-d' '-v' raw)
    if ($rawLog -match 'ORIKIT_READY:') {
      $ready = $true
      break
    }
    Start-Sleep -Milliseconds 500
  }
  if (-not $ready) {
    throw 'Android app did not emit ORIKIT_READY within 15 seconds'
  }

  $initialHierarchy = Get-Hierarchy 'android-view-tree'
  foreach ($required in @(
    'android.widget.Button',
    'android.widget.TextView',
    'Increment counter',
    'Counter value 0'
  )) {
    if ($initialHierarchy -notmatch [regex]::Escape($required)) {
      throw "Missing native hierarchy evidence: $required"
    }
  }
  if ($initialHierarchy -match 'android\.webkit\.WebView') {
    throw 'Unexpected WebView in Android hierarchy'
  }

  Invoke-TapByDescription $initialHierarchy 'Increment counter'
  $afterOne = Get-Hierarchy 'android-after-one-increment'
  Invoke-TapByDescription $afterOne 'Increment counter'
  $afterTwo = Get-Hierarchy 'android-after-two-increments'
  if ($afterTwo -notmatch 'content-desc="Counter value 2') {
    throw 'Two native button taps did not render count 2'
  }

  Invoke-Adb shell input swipe 540 1900 540 700 500 | Out-Null
  Start-Sleep -Milliseconds 300
  $historyHierarchy = Get-Hierarchy 'android-history-visible'
  Invoke-TapByDescription $historyHierarchy 'Travel to history event 4'
  Invoke-Adb shell input swipe 540 700 540 1900 500 | Out-Null
  Start-Sleep -Milliseconds 300
  $pastHierarchy = Get-Hierarchy 'android-time-travel'
  if ($pastHierarchy -notmatch 'PAST[^"]*EVENT 4[^"]*LIVE 2') {
    throw 'Time travel did not preserve live count 2 while showing event 4'
  }
  if ($pastHierarchy -notmatch 'content-desc="Counter value 1') {
    throw 'Time travel did not render historical count 1'
  }
  $incrementNode = [regex]::Match(
    $pastHierarchy,
    '<node[^>]*content-desc="[^"]*Increment counter[^"]*"[^>]*>'
  ).Value
  $semanticDisabled = $incrementNode -match 'enabled="false"'
  Invoke-TapByDescription $pastHierarchy 'Increment counter'
  $pastAfterTap = Get-Hierarchy 'android-time-travel-after-blocked-tap'
  if (
    $pastAfterTap -notmatch 'PAST[^"]*EVENT 4[^"]*LIVE 2' -or
    $pastAfterTap -notmatch 'content-desc="Counter value 1'
  ) {
    throw 'A transition control changed state while inspecting history'
  }

  Invoke-TapByDescription $pastHierarchy 'Resume live state'
  $resumedHierarchy = Get-Hierarchy 'android-resumed'
  if ($resumedHierarchy -notmatch 'content-desc="LIVE"') {
    throw 'Resume did not return runtime to LIVE mode'
  }
  if ($resumedHierarchy -notmatch 'content-desc="Counter value 2') {
    throw 'Resume did not restore the live count 2'
  }

  $rawLog = @(Invoke-Adb logcat '-d' '-v' raw)
  $effectLine = $rawLog |
    Where-Object { $_ -match 'ORIKIT_EFFECT_ANDROID:' } |
    Select-Object -Last 1
  $readyLine = $rawLog |
    Where-Object { $_ -match 'ORIKIT_READY:' } |
    Select-Object -Last 1
  $traceLines = @($rawLog | Where-Object { $_ -match 'ORIKIT_TRACE_ANDROID:' })
  $buttonStateLines = @(
    $rawLog | Where-Object { $_ -match 'ORIKIT_BUTTON_DISABLED:' }
  )
  $renderMetricsLine = $rawLog |
    Where-Object { $_ -match 'ORIKIT_RENDER_METRICS:' } |
    Select-Object -Last 1
  $travelMetricsLine = $rawLog |
    Where-Object { $_ -match 'ORIKIT_TRAVEL_RENDER_MS:' } |
    Select-Object -Last 1

  $parts = @{}
  $partTotal = 0
  foreach ($line in $traceLines) {
    if ($line -match 'ORIKIT_TRACE_ANDROID:(\d+)/(\d+):(.*)$') {
      $parts[[int]$Matches[1]] = $Matches[3]
      $partTotal = [int]$Matches[2]
    }
  }
  if ($partTotal -eq 0 -or $parts.Count -ne $partTotal) {
    throw "Android trace incomplete: $($parts.Count)/$partTotal"
  }
  $trace = (1..$partTotal | ForEach-Object { $parts[$_] }) -join ''
  if ($effectLine -notmatch 'ORIKIT_EFFECT_ANDROID:(.*)$') {
    throw 'Missing Android Effect result'
  }
  $effectJson = $Matches[1]
  if ($readyLine -notmatch 'ORIKIT_READY:(.*)$') {
    throw 'Missing Android readiness result'
  }
  $readyJson = $Matches[1]
  if ($renderMetricsLine -notmatch 'ORIKIT_RENDER_METRICS:(.*)$') {
    throw 'Missing Android render metrics'
  }
  $renderMetrics = $Matches[1] | ConvertFrom-Json
  if ($travelMetricsLine -notmatch 'ORIKIT_TRAVEL_RENDER_MS:(.*)$') {
    throw 'Missing Android time-travel render metric'
  }
  $travelRenderMilliseconds = [double]$Matches[1]
  $nativeDisabled = $buttonStateLines -match '"enabled":false'

  [System.IO.File]::WriteAllText(
    (Join-Path $artifacts 'trace-android.json'),
    $trace,
    [System.Text.UTF8Encoding]::new($false)
  )
  [System.IO.File]::WriteAllText(
    (Join-Path $artifacts 'effect-android.json'),
    (($effectJson | ConvertFrom-Json | ConvertTo-Json -Depth 20) + "`n"),
    [System.Text.UTF8Encoding]::new($false)
  )
  @($effectLine) + $traceLines + $buttonStateLines + @(
    $travelMetricsLine,
    $renderMetricsLine,
    $readyLine
  ) |
    Set-Content -Encoding utf8 (Join-Path $artifacts 'android-logcat.txt')

  Invoke-Adb shell screencap '-p' /sdcard/orikit-phase1.png | Out-Null
  Invoke-Adb pull /sdcard/orikit-phase1.png (Join-Path $artifacts 'screenshot.png') |
    Out-Null
  $memoryInfo = @(Invoke-Adb shell dumpsys meminfo $applicationId)
  $memoryInfo |
    Set-Content -Encoding utf8 (Join-Path $artifacts 'android-meminfo.txt')
  $totalPssMatch = [regex]::Match(($memoryInfo -join "`n"), 'TOTAL PSS:\s+(\d+)')
  $totalPssKilobytes = if ($totalPssMatch.Success) {
    [int]$totalPssMatch.Groups[1].Value
  } else {
    $null
  }

  $environmentPath = Join-Path $artifacts 'environment.json'
  $environment = Get-Content -LiteralPath $environmentPath -Raw | ConvertFrom-Json
  $environment | Add-Member -Force -NotePropertyName android -NotePropertyValue @{
    model = (Invoke-Adb shell getprop ro.product.model).Trim()
    release = (Invoke-Adb shell getprop ro.build.version.release).Trim()
    sdk = [int](Invoke-Adb shell getprop ro.build.version.sdk).Trim()
    abi = (Invoke-Adb shell getprop ro.product.cpu.abi).Trim()
    buildSeconds = [math]::Round($buildSeconds, 3)
    installSeconds = [math]::Round($installSeconds, 3)
    launchTotalMilliseconds = [int](
      ($launchOutput | Where-Object { $_ -match '^TotalTime:' }) -replace 'TotalTime:\s*', ''
    )
    apkBytes = (Get-Item -LiteralPath $apk).Length
    apkSha256 = Get-Sha256 $apk
    renderSamples = $renderMetrics.samples
    renderP50Milliseconds = $renderMetrics.p50Milliseconds
    renderP95Milliseconds = $renderMetrics.p95Milliseconds
    renderMaxMilliseconds = $renderMetrics.maxMilliseconds
    timeTravelRenderMilliseconds = $travelRenderMilliseconds
    totalPssKilobytes = $totalPssKilobytes
  }
  $environment |
    ConvertTo-Json -Depth 20 |
    Set-Content -Encoding utf8 $environmentPath

  $readyResult = $readyJson | ConvertFrom-Json
  Write-Output (
    @{
      status = 'pass'
      effect = "$($readyResult.effectPassed)/$($readyResult.effectTotal)"
      sdk = $readyResult.sdk
      traceParts = $partTotal
      traceBytes = [System.Text.Encoding]::UTF8.GetByteCount($trace)
      timeTravel = 'past 1 / live 2 / resumed 2'
      semanticDisabled = $semanticDisabled
      nativeDisabled = [bool]$nativeDisabled
      renderP95Milliseconds = $renderMetrics.p95Milliseconds
    } | ConvertTo-Json -Compress
  )
} finally {
  Pop-Location
}
