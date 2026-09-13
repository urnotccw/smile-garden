$ErrorActionPreference = 'Stop'
$projectDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$url = 'http://localhost:4173'
$running = $false
try {
    $health = Invoke-RestMethod -Uri ($url + '/health') -TimeoutSec 2
    $running = $health.app -eq 'smile-garden'
} catch { }
if (-not $running) {
    $nodeCommand = (Get-Command node -ErrorAction Stop).Source
    Start-Process -FilePath $nodeCommand -ArgumentList @('server.mjs') -WorkingDirectory $projectDir -WindowStyle Hidden
    for ($attempt = 0; $attempt -lt 20; $attempt++) {
        Start-Sleep -Milliseconds 250
        try {
            $health = Invoke-RestMethod -Uri ($url + '/health') -TimeoutSec 1
            if ($health.app -eq 'smile-garden') { $running = $true; break }
        } catch { }
    }
}
if (-not $running) { throw '启动失败：4173 端口可能被占用。请在项目目录运行 node server.mjs 查看原因。' }
Start-Process $url
Write-Host '微笑花园已打开。点击“开启摄像头”并允许浏览器权限。'
