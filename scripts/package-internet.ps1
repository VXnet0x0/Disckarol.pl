Param(
  [switch]$IncludeNodeModules
)

# Resolve repository root (script lives in scripts/)
$repoRoot = Resolve-Path -Path (Join-Path $PSScriptRoot '..')
$repoRoot = $repoRoot.Path
$workDir = Join-Path $repoRoot 'internet_pack_tmp'

if (Test-Path $workDir) { Remove-Item $workDir -Recurse -Force }
New-Item -Path $workDir -ItemType Directory | Out-Null

Write-Output "Copying files into temporary folder: $workDir"
$toCopy = @('public', 'server.js', 'package.json', 'README.md', 'Dockerfile', '.env.example')
foreach ($item in $toCopy) {
  $src = Join-Path $repoRoot $item
  if (Test-Path $src) {
    Write-Output " - Copying $item"
    Copy-Item -Path $src -Destination $workDir -Recurse -Force
  }
}

if ($IncludeNodeModules) {
  $nm = Join-Path $repoRoot 'node_modules'
  if (Test-Path $nm) {
    Write-Output "Including node_modules (this may make the archive large)..."
    Copy-Item -Path $nm -Destination $workDir -Recurse -Force
  } else { Write-Output "No node_modules folder found; skipping." }
}

$zipPath = Join-Path $repoRoot 'Internet.zip'
if (Test-Path $zipPath) { Remove-Item $zipPath -Force }

Write-Output "Creating zip: $zipPath"
# Compress all content of temp folder into Internet.zip
Compress-Archive -Path (Join-Path $workDir '*') -DestinationPath $zipPath -Force

# cleanup
Remove-Item $workDir -Recurse -Force
Write-Output "Done. Created: $zipPath"
Write-Output "Tip: run with -IncludeNodeModules if you want node_modules included (large file)."