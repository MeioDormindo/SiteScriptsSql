# Gera as paginas de teste a partir do index.html atual (/app/) e do baseline (/base/), para nunca ficarem desatualizadas.
# Baseline opcional (comparacao do layout Classico): git archive --format=tar -o base.tar <commit> ; tar -xf base.tar -C tests\base
$sp=$PSScriptRoot
$test=Join-Path $sp 'test'
$utf8=New-Object Text.UTF8Encoding($false)
function Make([string]$index,[string]$prefix,[string]$out,[string]$suite,[string]$config){
  $c=[IO.File]::ReadAllText($index)
  $c=$c.Replace('src="js/',"src=""$prefix/js/").Replace('href="css/',"href=""$prefix/css/").Replace('src="img/',"src=""$prefix/img/")
  $c=[regex]::Replace($c,'<script src="https://cdn\.jsdelivr\.net/npm/@supabase[^>]*></script>','<script src="/test/mock-supabase.js"></script>')
  $c=[regex]::Replace($c,'<script src="[^"]*/js/cloud-config\.js[^"]*"></script>',"<script src=""/test/$config""></script>")
  $c=$c.Replace('<head>',"<head>`r`n<script src=""/test/stub-net.js""></script>")
  if($suite){$c=$c.Replace('</body>',"<script src=""/test/$suite""></script>`r`n</body>")}
  [IO.File]::WriteAllText((Join-Path $test $out),$c,$utf8)
}
$app=Join-Path (Split-Path $sp -Parent) 'index.html'
$base=Join-Path $sp 'base\index.html'
Make $app '/app' 'test.html' 'tests.js' 'cloud-config-test.js'
Make $app '/app' 'persist.html' 'persist-tests.js' 'cloud-config-off.js'
Make $app '/app' 'bench.html' 'bench.js' 'cloud-config-off.js'
Make $app '/app' 'app.html' '' 'cloud-config-test.js'
if(Test-Path $base){
  Make $base '/base' 'base.html' '' 'cloud-config-test.js'
  Make $base '/base' 'base-test.html' 'tests.js' 'cloud-config-test.js'
  Make $base '/base' 'base-bench.html' 'bench.js' 'cloud-config-off.js'
}
'pages generated'
