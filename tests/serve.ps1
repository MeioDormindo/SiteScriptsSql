param([int]$Port=8765)
$app=Split-Path $PSScriptRoot -Parent
$test=Join-Path $PSScriptRoot 'test'
$base=Join-Path $PSScriptRoot 'base'
$types=@{'.html'='text/html; charset=utf-8';'.js'='text/javascript; charset=utf-8';'.mjs'='text/javascript; charset=utf-8';'.css'='text/css; charset=utf-8';'.json'='application/json; charset=utf-8';'.svg'='image/svg+xml';'.png'='image/png'}
$l=New-Object System.Net.HttpListener
$l.Prefixes.Add("http://localhost:$Port/")
$l.Start()
Write-Output "listening on $Port"
while($l.IsListening){
  $ctx=$l.GetContext()
  try{
    $p=[Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath)
    if($p -eq '/__stop'){ $ctx.Response.Close(); $l.Stop(); break }
    if($p -eq '/__result'){
      $r=New-Object IO.StreamReader($ctx.Request.InputStream,[Text.Encoding]::UTF8)
      [IO.File]::WriteAllText((Join-Path $PSScriptRoot 'result.txt'),$r.ReadToEnd(),(New-Object Text.UTF8Encoding($false)))
      $ctx.Response.StatusCode=204; $ctx.Response.Close(); continue
    }
    if($p.StartsWith('/app/')){$f=Join-Path $app ($p.Substring(5) -replace '/','\')}
    elseif($p.StartsWith('/base/')){$f=Join-Path $base ($p.Substring(6) -replace '/','\')}
    elseif($p.StartsWith('/test/')){$f=Join-Path $test ($p.Substring(6) -replace '/','\')}
    else{$f=$null}
    if($f -and (Test-Path $f -PathType Leaf)){
      $bytes=[IO.File]::ReadAllBytes($f)
      $ext=[IO.Path]::GetExtension($f).ToLower()
      $ctx.Response.ContentType= if($types[$ext]){$types[$ext]}else{'application/octet-stream'}
      $ctx.Response.Headers.Add('Cache-Control','no-store')
      $ctx.Response.OutputStream.Write($bytes,0,$bytes.Length)
    } else { $ctx.Response.StatusCode=404 }
  } catch { $ctx.Response.StatusCode=500 }
  $ctx.Response.Close()
}
