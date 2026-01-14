<#
PowerShell deploy script for DSN service to Azure App Service.
Usage example (interactive):
  ./scripts/deploy-azure.ps1 -AppName my-dsn-app -Domain dsn.com

This script will:
- Ensure Azure CLI is available and you're logged in
- Create resource group, app service plan, and web app
- Set app settings (you can pass SESSION_SECRET or it will generate one)
- Zip the app and deploy via `az webapp deployment source config-zip`
- Print instructions for adding custom domain DNS records and enabling SSL

Note: You must have the Azure CLI installed and be able to `az login` interactively.
#>
param(
  [Parameter(Mandatory=$true)] [string] $AppName,
  [string] $ResourceGroup = 'dsn-rg',
  [string] $PlanName = 'dsn-plan',
  [string] $Location = 'westeurope',
  [string] $Sku = 'B1',
  [string] $Domain = '',
  [string] $SessionSecret = ''
)

function AbortIfNoAz() {
  if (-not (Get-Command az -ErrorAction SilentlyContinue)) {
    Write-Error "Azure CLI 'az' not found. Install Azure CLI first: https://learn.microsoft.com/cli/azure/install-azure-cli"
    exit 1
  }
}

function EnsureLoggedIn() {
  try {
    az account show > $null 2>&1
  } catch {
    Write-Host "Not logged in to Azure. Opening browser to login..." -ForegroundColor Yellow
    az login | Out-Null
  }
}

function CreateResources() {
  Write-Host "Creating resource group '$ResourceGroup' in $Location..." -ForegroundColor Cyan
  az group create --name $ResourceGroup --location $Location | Out-Null

  Write-Host "Creating App Service plan '$PlanName' (sku $Sku)..." -ForegroundColor Cyan
  az appservice plan create --name $PlanName --resource-group $ResourceGroup --sku $Sku --is-linux | Out-Null

  Write-Host "Creating Web App '$AppName' (Node 18)..." -ForegroundColor Cyan
  az webapp create --resource-group $ResourceGroup --plan $PlanName --name $AppName --runtime 'NODE|18-lts' | Out-Null
}

function ConfigureAppSettings() {
  if (-not $SessionSecret) { $SessionSecret = [guid]::NewGuid().ToString() }
  Write-Host "Setting app settings (SESSION_SECRET). You can add BING_API_KEY and TWILIO_* manually in portal or here using az webapp config appsettings set" -ForegroundColor Cyan
  az webapp config appsettings set --resource-group $ResourceGroup --name $AppName --settings "SESSION_SECRET=$SessionSecret" | Out-Null
}

function ZipAndDeploy() {
  $zip = Join-Path -Path (Get-Location) -ChildPath 'deploy.zip'
  if (Test-Path $zip) { Remove-Item $zip -Force }
  Write-Host "Creating deploy.zip (excluding node_modules, .git, data)..." -ForegroundColor Cyan
  $include = Get-ChildItem -Path . -File -Recurse | Where-Object { $_.FullName -notmatch '\\node_modules\\' -and $_.FullName -notmatch '\\.git\\' -and $_.FullName -notmatch '\\data\\' }
  # Build a temp folder to ensure consistent zip
  $tmp = Join-Path $env:TEMP "dsn-deploy-$(Get-Random)"
  if (Test-Path $tmp) { Remove-Item $tmp -Recurse -Force }
  New-Item -ItemType Directory -Path $tmp | Out-Null
  foreach ($f in $include) {
    $dest = Join-Path $tmp ($f.FullName.Substring((Get-Location).Path.Length).TrimStart('\','/'))
    New-Item -ItemType Directory -Force -Path (Split-Path $dest) | Out-Null
    Copy-Item $f.FullName -Destination $dest -Force
  }
  Compress-Archive -Path (Join-Path $tmp '*') -DestinationPath $zip -Force
  Remove-Item $tmp -Recurse -Force

  Write-Host "Deploying $zip to $AppName..." -ForegroundColor Cyan
  az webapp deploy --resource-group $ResourceGroup --name $AppName --src-path $zip | Out-Null
  Write-Host "Deployment finished." -ForegroundColor Green
}

function PrintNextSteps() {
  $url = "https://$AppName.azurewebsites.net"
  Write-Host "Your app should be reachable at: $url" -ForegroundColor Green
  if ($Domain) {
    Write-Host "Custom domain requested: $Domain" -ForegroundColor Cyan
    Write-Host "To map domain you must create a DNS record at your registrar:" -ForegroundColor Yellow
    Write-Host "  - For root domain (example dsn.com): add A records pointing to the IP addresses used by App Service (see Azure docs)" -ForegroundColor Yellow
    Write-Host "  - For subdomain (www): add a CNAME pointing to $AppName.azurewebsites.net" -ForegroundColor Yellow
    Write-Host "After adding DNS record, run these commands to add hostname and request verification:" -ForegroundColor Cyan
    Write-Host "  az webapp config hostname add --resource-group $ResourceGroup --webapp-name $AppName --hostname $Domain" -ForegroundColor Magenta
    Write-Host "Then verify and enable TLS via the Azure Portal (TLS/SSL settings > Private certificates or App Service Managed Certificate)." -ForegroundColor Yellow
  }
  Write-Host "If you prefer automated CI deploy, upload the publish profile to GitHub Secrets 'AZURE_WEBAPP_PUBLISH_PROFILE' and set 'AZURE_WEBAPP_NAME' and the existing GitHub Actions workflow will deploy on push to main." -ForegroundColor Cyan
}

# MAIN
AbortIfNoAz
EnsureLoggedIn
CreateResources
ConfigureAppSettings
ZipAndDeploy
PrintNextSteps
