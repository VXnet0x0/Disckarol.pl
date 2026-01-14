<#
PowerShell deploy script for DSN service to Google Cloud Run.
Usage example:
  ./scripts/deploy-gcloud.ps1 -ProjectId my-gcp-project -ServiceName dsn-service -Domain disckarol.pl

This script will:
- Ensure Google Cloud SDK (gcloud) is available and you're logged in
- Build and push Docker image to Google Container Registry (gcr.io)
- Deploy to Cloud Run
- Print instructions for mapping custom domain

Note: You must have the Google Cloud SDK installed and be able to `gcloud auth login` interactively.
#>
param(
  [Parameter(Mandatory=$true)] [string] $ProjectId,
  [string] $ServiceName = 'dsn-service',
  [string] $Region = 'europe-west1',
  [string] $Domain = 'disckarol.pl'
)

function AbortIfNoGcloud() {
  if (-not (Get-Command gcloud -ErrorAction SilentlyContinue)) {
    Write-Error "Google Cloud SDK 'gcloud' not found. Install from https://cloud.google.com/sdk/docs/install"
    exit 1
  }
}

function EnsureLoggedIn() {
  $account = gcloud config get-value account 2>$null
  if (-not $account -or $account -eq '(unset)') {
    Write-Host "Not logged in to Google Cloud. Opening browser to login..." -ForegroundColor Yellow
    gcloud auth login
  }
  Write-Host "Setting project to $ProjectId..." -ForegroundColor Cyan
  gcloud config set project $ProjectId
}

function EnableAPIs() {
  Write-Host "Enabling required APIs (Cloud Run, Container Registry)..." -ForegroundColor Cyan
  gcloud services enable run.googleapis.com containerregistry.googleapis.com cloudbuild.googleapis.com
}

function BuildAndPush() {
  $imageName = "gcr.io/$ProjectId/$ServiceName"
  Write-Host "Building Docker image and pushing to $imageName..." -ForegroundColor Cyan
  
  # Use Cloud Build to build and push (no local Docker required)
  gcloud builds submit --tag $imageName .
  
  return $imageName
}

function DeployToCloudRun($imageName) {
  Write-Host "Deploying to Cloud Run service '$ServiceName' in region '$Region'..." -ForegroundColor Cyan
  
  gcloud run deploy $ServiceName `
    --image $imageName `
    --region $Region `
    --platform managed `
    --allow-unauthenticated `
    --port 3000 `
    --set-env-vars "NODE_ENV=production"
  
  # Get the service URL
  $serviceUrl = gcloud run services describe $ServiceName --region $Region --format "value(status.url)"
  return $serviceUrl
}

function PrintNextSteps($serviceUrl) {
  Write-Host "`n========================================" -ForegroundColor Green
  Write-Host "Deployment complete!" -ForegroundColor Green
  Write-Host "========================================" -ForegroundColor Green
  Write-Host "Your app is available at: $serviceUrl" -ForegroundColor Cyan
  
  if ($Domain) {
    Write-Host "`nTo map custom domain '$Domain':" -ForegroundColor Yellow
    Write-Host "1. Go to Google Cloud Console -> Cloud Run -> $ServiceName -> Manage Custom Domains" -ForegroundColor White
    Write-Host "2. Click 'Add Mapping' and select '$ServiceName'" -ForegroundColor White
    Write-Host "3. Enter domain: $Domain" -ForegroundColor White
    Write-Host "4. Google will provide DNS records to add at your registrar:" -ForegroundColor White
    Write-Host "   - For root domain: Add A and AAAA records" -ForegroundColor White
    Write-Host "   - For www subdomain: Add CNAME pointing to ghs.googlehosted.com" -ForegroundColor White
    Write-Host "5. After DNS propagation, Google will automatically provision SSL certificate" -ForegroundColor White
    Write-Host "`nAlternatively, use gcloud command:" -ForegroundColor Cyan
    Write-Host "  gcloud beta run domain-mappings create --service $ServiceName --domain $Domain --region $Region" -ForegroundColor Magenta
  }
  
  Write-Host "`nTo set environment variables (SESSION_SECRET, API keys, etc.):" -ForegroundColor Yellow
  Write-Host "  gcloud run services update $ServiceName --region $Region --set-env-vars 'SESSION_SECRET=your-secret,BING_API_KEY=your-key'" -ForegroundColor Magenta
}

# MAIN
Push-Location $PSScriptRoot\..
try {
  AbortIfNoGcloud
  EnsureLoggedIn
  EnableAPIs
  $imageName = BuildAndPush
  $serviceUrl = DeployToCloudRun $imageName
  PrintNextSteps $serviceUrl
} finally {
  Pop-Location
}
