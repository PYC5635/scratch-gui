$ErrorActionPreference='Continue'
$gui='D:\PineEditor\gui'
# ?? npm ??????
$deadline=(Get-Date).AddMinutes(120)
while(-not (Test-Path (Join-Path $gui 'npm-done.txt'))){ if((Get-Date)-gt $deadline){'TIMEOUT'|Out-File (Join-Path $gui 'build-result.txt') -Encoding ascii; exit 2}; Start-Sleep -Seconds 20 }
'READY' | Out-File (Join-Path $gui 'build-progress.txt') -Encoding ascii
Set-Location $gui
$env:Path='C:\Program Files\Git\bin;C:\Program Files\Git\cmd;'+$env:Path
$env:NODE_ENV='production'
try { & node node_modules\webpack\bin\webpack.js --bail --colors 2>&1 | Out-File (Join-Path $gui 'build-output.log') -Encoding ascii; $c=$LASTEXITCODE } catch { $c=-1; $_ | Out-File (Join-Path $gui 'build-output.log') -Append -Encoding ascii }
'EXIT='+$c | Out-File (Join-Path $gui 'build-result.txt') -Encoding ascii
