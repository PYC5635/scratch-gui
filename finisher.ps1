$ErrorActionPreference = 'Continue'
$gui = 'D:\PineEditor\gui'
$nc  = Join-Path $env:LOCALAPPDATA 'npm-cache'

# 1) 等待 npm install 完成
$deadline = (Get-Date).AddMinutes(240)
while (-not (Test-Path (Join-Path $gui 'npm-done.txt')) -or -not (Test-Path (Join-Path $gui 'node_modules\.bin\webpack.cmd'))) {
    if ((Get-Date) -gt $deadline) { 'TIMEOUT_WAIT_INSTALL' | Out-File (Join-Path $gui 'build-result.txt') -Encoding ascii; exit 3 }
    Start-Sleep -Seconds 20
}

# 2) 安装完成 -> 清空 C 盘 npm 缓存（迁移前保险：改用 npm-cache 默认路径清一次）
2>&1 | ForEach-Object { }  # no-op
try { & npm cache clean --force 2>&1 | Out-Null } catch {}
# 直接删除 C 盘 npm 缓存目录内容腾空间（失败可忽略，JIT 保护）
try {
    $orphans = Get-ChildItem $nc -Recurse -Force -ErrorAction SilentlyContinue
    foreach ($f in $orphans) {
        try { Remove-Item -LiteralPath $f.FullName -Recurse -Force -ErrorAction SilentlyContinue } catch {}
    }
} catch {}

'CLEANED_C_CACHE' | Out-File (Join-Path $gui 'c-cache-cleaned.txt') -Encoding ascii

# 3) 执行 webpack 生产构建
Set-Location $gui
$env:Path = 'C:\Program Files\Git\bin;C:\Program Files\Git\cmd;' + $env:Path
$env:NODE_ENV = 'production'
try {
    & node node_modules\webpack\bin\webpack.js --bail --colors 2>&1 | Out-File (Join-Path $gui 'build-output.log') -Encoding ascii
    $code = $LASTEXITCODE
} catch {
    $code = -1
    $_ | Out-File -FilePath (Join-Path $gui 'build-output.log') -Append -Encoding ascii
}
'EXIT=' + $code | Out-File (Join-Path $gui 'build-result.txt') -Encoding ascii