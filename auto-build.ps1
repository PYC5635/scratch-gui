$ErrorActionPreference = 'Continue'
$gui = 'D:\PineEditor\gui'
$marker = Join-Path $gui 'npm-done.txt'
$bin = Join-Path $gui 'node_modules\.bin'

# 等待 npm install 彻底完成（出现完成标记 且 webpack.cmd 就绪）
$deadline = (Get-Date).AddMinutes(180)
while (-not (Test-Path $marker) -or -not (Test-Path (Join-Path $bin 'webpack.cmd'))) {
    if ((Get-Date) -gt $deadline) { 'TIMEOUT waiting for install' | Out-File (Join-Path $gui 'build-result.txt') -Encoding ascii; exit 2 }
    Start-Sleep -Seconds 20
}

'INSTALL_READY' | Out-File (Join-Path $gui 'build-progress.txt') -Encoding ascii

# 构建
Set-Location $gui
$env:Path = 'C:\Program Files\Git\bin;C:\Program Files\Git\cmd;' + $env:Path
$env:NODE_ENV = 'production'
try {
    & (Join-Path $gui 'node_modules\.bin\webpack.cmd') --bail --colors 2>&1 | Out-File (Join-Path $gui 'build-output.log') -Encoding ascii
    $code = $LASTEXITCODE
} catch {
    $code = -1
    $_ | Out-File -FilePath (Join-Path $gui 'build-output.log') -Append -Encoding ascii
}
'EXIT=' + $code | Out-File (Join-Path $gui 'build-result.txt') -Encoding ascii