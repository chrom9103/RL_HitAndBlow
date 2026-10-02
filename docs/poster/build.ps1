# poster.html から印刷用 PDF を作る(Chrome / Edge のヘッドレス印刷)。
#   powershell -ExecutionPolicy Bypass -File docs/poster/build.ps1
# フォントは Google Fonts から読み込むため、ネットワーク接続が必要です。
$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$browser = @(
  "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
  "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
  "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe"
) | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $browser) { throw 'Chrome または Edge が見つかりません' }

$url = 'file:///' + ((Join-Path $here 'poster.html') -replace '\\', '/')
$targets = @{ 'poster-shiroku.pdf' = ''; 'poster-a4.pdf' = '?a4' }
foreach ($name in $targets.Keys) {
  $out = Join-Path $here $name
  & $browser --headless=new --disable-gpu --no-pdf-header-footer --virtual-time-budget=20000 `
    "--print-to-pdf=$out" "$url$($targets[$name])" 2>$null | Out-Null
  Write-Host "wrote $out"
}
