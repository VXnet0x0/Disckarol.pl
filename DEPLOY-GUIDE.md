# Przewodnik publikacji strony pod domeną disckarol.pl

## Podsumowanie opcji hostingu

| Platforma | Typ | Backend Node.js | Koszt | Trudność |
|-----------|-----|-----------------|-------|----------|
| GitHub Pages | Statyczny | ❌ Nie | Bezpłatny | ⭐ Łatwy |
| Azure App Service | Dynamiczny | ✅ Tak | Od ~$13/mies (B1) | ⭐⭐ Średni |
| Google Cloud Run | Dynamiczny | ✅ Tak | Pay-per-use (~$0-5/mies) | ⭐⭐ Średni |

---

## 1. GitHub Pages (tylko statyczne pliki)

**Ograniczenie:** Nie obsługuje backendu Node.js - tylko HTML/CSS/JS.

### Kroki:

```powershell
# 1. Zainstaluj GitHub CLI (jeśli nie masz)
# https://cli.github.com/

# 2. Zaloguj się
gh auth login

# 3. Uruchom skrypt
cd dsn-service
.\scripts\publish-to-github.ps1 -RepoFullName "twoj-user/disckarol-site"
```

### Konfiguracja DNS u rejestratora:

| Typ | Nazwa | Wartość |
|-----|-------|---------|
| A | @ | 185.199.108.153 |
| A | @ | 185.199.109.153 |
| A | @ | 185.199.110.153 |
| A | @ | 185.199.111.153 |
| CNAME | www | twoj-user.github.io |

---

## 2. Microsoft Azure App Service

**Zalecane dla pełnej aplikacji z backendem.**

### Szybki deploy (PowerShell):

```powershell
# 1. Zainstaluj Azure CLI
# https://learn.microsoft.com/cli/azure/install-azure-cli

# 2. Zaloguj się
az login

# 3. Uruchom skrypt
cd dsn-service
.\scripts\deploy-azure.ps1 -AppName "disckarol-app" -Domain "disckarol.pl"
```

### Lub przez GitHub Actions:

1. Utwórz Web App w Azure Portal (Linux, Node 18)
2. Pobierz Publish Profile (Web App -> Get publish profile)
3. W GitHub repo -> Settings -> Secrets:
   - `AZURE_WEBAPP_PUBLISH_PROFILE` = zawartość pliku
   - `AZURE_WEBAPP_NAME` = `disckarol-app`
4. Push na `main` = automatyczny deploy

### Konfiguracja DNS:

1. Azure Portal -> Web App -> Custom domains
2. Kliknij "Add custom domain"
3. Wpisz `disckarol.pl`
4. Azure poda rekordy do dodania:

| Typ | Nazwa | Wartość |
|-----|-------|---------|
| A | @ | (IP z Azure) |
| TXT | @ | (kod weryfikacyjny) |
| CNAME | www | disckarol-app.azurewebsites.net |

5. Po weryfikacji włącz SSL: TLS/SSL settings -> Create App Service Managed Certificate

---

## 3. Google Cloud Run

**Elastyczne, pay-per-use, idealne dla zmiennego ruchu.**

### Szybki deploy (PowerShell):

```powershell
# 1. Zainstaluj Google Cloud SDK
# https://cloud.google.com/sdk/docs/install

# 2. Zaloguj się
gcloud auth login

# 3. Uruchom skrypt
cd dsn-service
.\scripts\deploy-gcloud.ps1 -ProjectId "twoj-projekt-gcp" -ServiceName "disckarol"
```

### Lub przez GitHub Actions:

1. Utwórz projekt w Google Cloud Console
2. Utwórz Service Account:
   - IAM & Admin -> Service Accounts -> Create
   - Dodaj role: Cloud Run Admin, Storage Admin
   - Utwórz klucz JSON
3. W GitHub repo -> Settings -> Secrets:
   - `GCP_PROJECT_ID` = ID projektu
   - `GCP_SA_KEY` = zawartość klucza JSON
4. Push na `main` = automatyczny deploy

### Konfiguracja DNS:

1. Cloud Console -> Cloud Run -> (twój serwis) -> Manage Custom Domains
2. Kliknij "Add Mapping"
3. Wybierz serwis i wpisz `disckarol.pl`
4. Google poda rekordy:

| Typ | Nazwa | Wartość |
|-----|-------|---------|
| A | @ | (IP od Google) |
| AAAA | @ | (IPv6 od Google) |
| CNAME | www | ghs.googlehosted.com |

---

## Konfiguracja zmiennych środowiskowych

Po wdrożeniu ustaw zmienne w panelu platformy lub przez CLI:

### Azure:
```bash
az webapp config appsettings set --resource-group dsn-rg --name disckarol-app --settings \
  "SESSION_SECRET=twoj-sekret" \
  "BING_API_KEY=twoj-klucz" \
  "PUBLIC_URL=https://disckarol.pl"
```

### Google Cloud Run:
```bash
gcloud run services update disckarol --region europe-west1 --set-env-vars \
  "SESSION_SECRET=twoj-sekret,BING_API_KEY=twoj-klucz,PUBLIC_URL=https://disckarol.pl"
```

---

## Weryfikacja

Po konfiguracji DNS (propagacja może trwać do 48h):

1. Sprawdź DNS: `nslookup disckarol.pl`
2. Otwórz https://disckarol.pl w przeglądarce
3. Sprawdź certyfikat SSL (kłódka w pasku adresu)

---

## Pliki w projekcie

- [`scripts/publish-to-github.ps1`](scripts/publish-to-github.ps1) - Deploy na GitHub Pages
- [`scripts/deploy-azure.ps1`](scripts/deploy-azure.ps1) - Deploy na Azure App Service
- [`scripts/deploy-gcloud.ps1`](scripts/deploy-gcloud.ps1) - Deploy na Google Cloud Run
- [`.github/workflows/azure-webapp-deploy.yml`](.github/workflows/azure-webapp-deploy.yml) - GitHub Actions dla Azure
- [`.github/workflows/deploy-gcloud.yml`](.github/workflows/deploy-gcloud.yml) - GitHub Actions dla Google Cloud
- [`public/CNAME`](public/CNAME) - Plik z domeną dla GitHub Pages (już ustawiony na `disckarol.pl`)
