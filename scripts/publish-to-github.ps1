param(
  [Parameter(Mandatory=$true)] [string] $RepoFullName, # e.g. youruser/dsn.com
  [string] $Visibility = 'public',
  [string] $Domain = 'disckarol.pl'
)

if (-not (Get-Command gh -ErrorAction SilentlyContinue)) { Write-Error "GitHub CLI 'gh' not found. Install from https://cli.github.com/"; exit 1 }

Write-Host "Ensuring public/CNAME contains domain $Domain" -ForegroundColor Cyan
$cnPath = Join-Path -Path (Get-Location) -ChildPath 'public\CNAME'
if (-not (Test-Path $cnPath)) {
  New-Item -ItemType File -Path $cnPath -Force -Value $Domain | Out-Null
  git add $cnPath
  git commit -m "Add CNAME for $Domain" -a || Write-Host "No changes to commit"
  Write-Host "Added public/CNAME with $Domain" -ForegroundColor Green
} else {
  $current = Get-Content $cnPath -Raw
  if ($current.Trim() -ne $Domain) {
    Set-Content -Path $cnPath -Value $Domain
    git add $cnPath
    git commit -m "Update CNAME to $Domain" -a || Write-Host "No changes to commit"
    Write-Host "Updated public/CNAME to $Domain" -ForegroundColor Green
  } else {
    Write-Host "public/CNAME already set to $Domain" -ForegroundColor Yellow
  }
}

Write-Host "Creating repo $RepoFullName (if not exists)..." -ForegroundColor Cyan
$parts = $RepoFullName.Split('/')
$owner = $parts[0]
$name = $parts[1]
# create repository (ignore if exists)
try { gh repo create $RepoFullName --$Visibility --source=. --remote=origin --push --enable-pages } catch { Write-Host "Repo may already exist or creation failed; continue..." }

Write-Host "Pushing current code to origin/main..." -ForegroundColor Cyan
git add .
git commit -m "Prepare for GitHub Pages" -a || Write-Host "No changes to commit"
git push origin main

Write-Host "Triggering GitHub Pages deploy via workflow (push to main)." -ForegroundColor Green
Write-Host "Visit https://github.com/$RepoFullName/settings/pages to confirm Pages settings and custom domain ($Domain).
GH Pages will use the public/CNAME value once DNS is configured." -ForegroundColor Yellow
