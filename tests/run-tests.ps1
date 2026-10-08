param([string]$Page='test.html',[int]$Seconds=150,[string]$Query='',[int]$Width=1400,[int]$Height=900,[switch]$ReducedMotion)
$sp=$PSScriptRoot
$edge='C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
$prof=Join-Path $sp 'edge-test'
$result=Join-Path $sp 'result.txt'
Get-CimInstance Win32_Process -Filter "Name='msedge.exe'" | Where-Object { $_.CommandLine -like '*edge-test*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
Remove-Item -Recurse -Force $prof -ErrorAction SilentlyContinue
Remove-Item $result -ErrorAction SilentlyContinue
$url="http://localhost:8765/test/$Page"; if($Query){$url+="?$Query"}
$args=@('--headless=new','--disable-gpu','--no-first-run',"--window-size=$Width,$Height","--user-data-dir=$prof")
if($ReducedMotion){$args+='--force-prefers-reduced-motion'}
$args+=$url
Start-Process -FilePath $edge -ArgumentList $args | Out-Null
$deadline=(Get-Date).AddSeconds($Seconds)
while((Get-Date) -lt $deadline){
  if((Test-Path $result) -and ((Get-Content $result -Raw -Encoding UTF8) -match '^RESULT')){break}
  Start-Sleep -Milliseconds 500
}
Get-CimInstance Win32_Process -Filter "Name='msedge.exe'" | Where-Object { $_.CommandLine -like '*edge-test*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
if(Test-Path $result){ Get-Content $result -Raw -Encoding UTF8 } else { 'NO RESULT' }
