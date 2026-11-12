param(
  [Parameter(Mandatory=$true)][ValidateSet('arm64','x64')][string]$Architecture,
  [Parameter(Mandatory=$true)][string]$InstallerPath
)
$ErrorActionPreference = 'Stop'

$installer = (Resolve-Path -LiteralPath $InstallerPath).Path
if (-not (Test-Path -LiteralPath $installer -PathType Leaf)) {
  throw "Installer not found: $InstallerPath"
}
$expectedName = "Companio-Setup-*-$Architecture.exe"
if (-not ([IO.Path]::GetFileName($installer) -like $expectedName)) {
  throw "The installer name does not match the requested architecture."
}

$watch = [Diagnostics.Stopwatch]::StartNew()
$process = Start-Process -FilePath $installer -ArgumentList '/S' -PassThru -WindowStyle Hidden
# Silent installation is intentionally bounded: it must not freeze CI.
if (-not $process.WaitForExit(240000)) {
  Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
  throw "Companio silent $Architecture installation exceeded 240 seconds."
}
$watch.Stop()
if ($process.ExitCode -ne 0) {
  throw "Companio silent $Architecture installation exited with code $($process.ExitCode)."
}

$installed = Join-Path $env:LOCALAPPDATA 'Programs\companio\Companio.exe'
if (-not (Test-Path -LiteralPath $installed -PathType Leaf)) {
  throw "Installer exited successfully, but Companio.exe is missing from $installed"
}
$sizeMiB = [math]::Round((Get-Item -LiteralPath $installer).Length / 1MB, 1)
$seconds = [math]::Round($watch.Elapsed.TotalSeconds, 1)
$peakMiB = [math]::Round($process.PeakWorkingSet64 / 1MB, 1)
$report = "Silent $Architecture install: $($seconds)s, setup peak working set $($peakMiB) MiB, installer $($sizeMiB) MiB."
Write-Output $report
if ($env:GITHUB_STEP_SUMMARY) {
  $report | Out-File -FilePath $env:GITHUB_STEP_SUMMARY -Append
  "This measures a clean GitHub runner, not real-user SmartScreen prompts, Defender scans or laptop thermal behavior." |
    Out-File -FilePath $env:GITHUB_STEP_SUMMARY -Append
}
