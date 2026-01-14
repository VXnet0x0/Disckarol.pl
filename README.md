# DSN — local demo

Krótki demo serwis 'DSN' (lokalny):
- Node.js + Express backend
- Agreguje wyniki z Wikipedia (MediaWiki API) i Bing (jeśli ustawisz `BING_API_KEY`)
- Prosty system logowania (register/login) oparty na `express-session` i `bcrypt`

🔧 Uruchomienie lokalnie:

1. Zainstaluj zależności:

   npm install

2. Skopiuj .env.example do .env i ustaw wartości (głównie SESSION_SECRET, opcjonalnie BING_API_KEY)

   copy .env.example .env

3. Uruchom serwer dev:

   npm run dev

4. Otwórz w przeglądarce: http://localhost:3000

Aby używać `dsn.com` lokalnie (tylko test):
- Dodaj do pliku `C:\Windows\System32\drivers\etc\hosts` linię:

  127.0.0.1 dsn.com

- Następnie otwórz http://dsn.com:3000 (pamiętaj, port jest nadal 3000) — lub skonfiguruj reverse proxy aby działać na porcie 80.

⚠️ Uwaga: To demo używa prostego pliku `data/users.json` do przechowywania kont. To NIE jest bezpieczne do użycia w produkcji. Dla produkcji użyj bazy danych, HTTPS, store sesji, rate limiting, CSRF protection itd.

API:
- POST /api/auth/register { username, password }
- POST /api/auth/login { username, password }
- POST /api/auth/logout
- GET /api/me
- GET /api/search?q=...&region=en
- GET /api/informations — lista informacji
- POST /api/informations { title, content } — dodawanie (wymaga logowania)
- POST /api/informations/:id/like — dodać "serduszko" (wymaga logowania)
- POST /api/subscribe { phone } — subskrypcja (wymaga logowania)
- POST /api/sms/send { message } — wyślij SMS do subskrybentów (wymaga logowania, działa mock jeżeli brak zmiennych TWILIO)

Udostępnianie pod dsn.com (lokalnie):
- Edytuj `C:\Windows\System32\drivers\etc\hosts` i dodaj `127.0.0.1 dsn.com`.
- Otwórz http://dsn.com:3000

Aby udostępnić publicznie pod dsn.com:
1. Kup domenę u rejestratora i ustaw rekord A (np. na IP serwera) lub CNAME.
2. Skonfiguruj serwer (np. VPS z Nginx) jako reverse proxy, aby kierować ruch z portu 80/443 do aplikacji (np. port 3000).
3. Użyj Let's Encrypt (Certbot) lub innego CA do uzyskania certyfikatów SSL.
4. Alternatywy: hostuj aplikację na platformie (Render, Vercel, Azure App Service) i ustaw rekordy DNS oraz (jeżeli platforma wymaga) dodaj konfigurację domeny w panelu.

SMS (produkcja):
- Zarejestruj konto Twilio (lub innego dostawcy SMS), ustaw `TWILIO_SID`, `TWILIO_TOKEN`, `TWILIO_FROM` w .env, wtedy API `/api/sms/send` wyśle faktyczne SMS-y; w przeciwnym razie serwis wykona mock (zaloguje wiadomość na serwerze).

---

## Publikacja strony pod domeną disckarol.pl

Masz trzy główne opcje hostingu:

### Opcja 1: GitHub Pages (statyczne strony)
**Uwaga:** GitHub Pages obsługuje tylko statyczne pliki HTML/CSS/JS. Backend (Node.js) nie będzie działał.

1. Utwórz repozytorium na GitHub (np. `youruser/disckarol-site`)
2. Uruchom skrypt PowerShell:
   ```powershell
   cd dsn-service
   .\scripts\publish-to-github.ps1 -RepoFullName "youruser/disckarol-site" -Domain "disckarol.pl"
   ```
3. W ustawieniach repo GitHub -> Settings -> Pages:
   - Source: Deploy from branch `main`
   - Custom domain: `disckarol.pl`
4. U rejestratora domeny dodaj rekordy DNS:
   - Dla domeny głównej: 4 rekordy A wskazujące na IP GitHub Pages:
     - 185.199.108.153
     - 185.199.109.153
     - 185.199.110.153
     - 185.199.111.153
   - Dla www: CNAME wskazujący na `youruser.github.io`
5. GitHub automatycznie wygeneruje certyfikat SSL

### Opcja 2: Microsoft Azure App Service (pełna aplikacja Node.js)

Zalecane dla pełnej funkcjonalności backendu.

**Metoda A - Skrypt PowerShell (szybki deploy):**
```powershell
cd dsn-service
.\scripts\deploy-azure.ps1 -AppName "disckarol-app" -Domain "disckarol.pl"
```

**Metoda B - GitHub Actions (CI/CD):**
1. W Azure Portal utwórz Web App (Linux, Node 18)
2. Pobierz Publish Profile
3. W GitHub repo ustaw secrets:
   - `AZURE_WEBAPP_PUBLISH_PROFILE` - zawartość pliku publish profile
   - `AZURE_WEBAPP_NAME` - nazwa aplikacji (np. `disckarol-app`)
4. Push na branch `main` uruchomi automatyczny deploy

**Mapowanie domeny disckarol.pl:**
1. W Azure Portal -> Web App -> Custom domains -> Add custom domain
2. U rejestratora dodaj rekordy DNS:
   - A record: IP z Azure Portal
   - TXT record: do weryfikacji
3. Włącz SSL: TLS/SSL settings -> App Service Managed Certificate (bezpłatny)

### Opcja 3: Google Cloud Run (pełna aplikacja Node.js)

**Metoda A - Skrypt PowerShell:**
```powershell
cd dsn-service
.\scripts\deploy-gcloud.ps1 -ProjectId "your-gcp-project" -ServiceName "disckarol" -Domain "disckarol.pl"
```

**Metoda B - GitHub Actions (CI/CD):**
1. W Google Cloud Console utwórz projekt
2. Utwórz Service Account z rolami: Cloud Run Admin, Storage Admin
3. Pobierz klucz JSON
4. W GitHub repo ustaw secrets:
   - `GCP_PROJECT_ID` - ID projektu
   - `GCP_SA_KEY` - zawartość klucza JSON
5. Push na branch `main` uruchomi automatyczny deploy

**Mapowanie domeny disckarol.pl:**
1. Cloud Console -> Cloud Run -> Manage Custom Domains -> Add Mapping
2. Wybierz serwis i wpisz domenę `disckarol.pl`
3. Google poda rekordy DNS do dodania u rejestratora:
   - A i AAAA records dla domeny głównej
   - CNAME `ghs.googlehosted.com` dla www
4. SSL zostanie automatycznie skonfigurowany

---

## Deploy na Microsoft Azure (szczegółowy przewodnik)

Opcja A — GitHub Actions (zalecane):
1. Zrób push na branch `main` w repo (to uruchomi workflow `azure-webapp-deploy.yml`).
2. W Azure stwórz Web App (Linux) lub App Service:
   - Możesz użyć Azure Portal lub Azure CLI:
     - az group create --name dsn-rg --location westeurope
     - az appservice plan create --name dsn-plan --resource-group dsn-rg --sku B1 --is-linux
     - az webapp create --resource-group dsn-rg --plan dsn-plan --name <APP_NAME> --runtime "NODE|18-lts"
3. Pobierz Publish Profile w Azure Portal (Web App -> Get publish profile) i w GitHub repo ustaw secret `AZURE_WEBAPP_PUBLISH_PROFILE` z zawartością pliku publish profile oraz `AZURE_WEBAPP_NAME` = `<APP_NAME>`.
4. Workflow wykona deploy przy pushu na `main`.

Opcja B — Docker (alternatywnie):
- Możesz zbudować image lokalnie i wypchnąć do Azure Container Registry / Docker Hub, a następnie stworzyć Web App for Containers i wskazać obraz.
- W repo znajduje się `Dockerfile` i `.dockerignore` gotowe do użycia.

Mapowanie domeny `dsn.com` (publiczne):
1. Kup domenę u rejestratora (np. GoDaddy, OVH, Namecheap).
2. Dodaj rekord A (dla domeny root) wskazujący na IP App Service (uzyskasz je z Azure Portal -> Custom domains). Alternatywnie użyj CNAME do domyślnej nazwy aplikacji (np. `yourapp.azurewebsites.net`) — CNAME działa dla subdomen.
3. W Azure Portal: Web App -> Custom domains -> Add custom domain; zweryfikuj poprzez dodanie rekordu TXT/CNAME w panelu u rejestratora.
4. Po dodaniu domeny skonfiguruj SSL: App Service Managed Certificate (bezpłatny) lub wgraj certyfikat (Let's Encrypt/Certbot lub inny CA). W Azure Portal znajdziesz opcję "TLS/SSL settings".

Nowe funkcje w serwisie:
- CRUD dla informacji: dodawanie, edycja (tylko autor), usuwanie (tylko autor).
- Lajki: użytkownicy mogą lajkować/odlajkować wpisy; serduszko pokazuje status.
- Subskrypcje: użytkownicy mogą dodać swój numer telefonu, autorzy wpisów mogą zobaczyć listę subskrybentów.
- Wysyłanie SMS: `/api/sms/send` wysyła wiadomość do wszystkich subskrybentów (Twilio lub mock jeśli brak poświadczeń).
- Wyszukiwanie z wielu serwisów: `/api/search?q=...&region=...&sources=wikipedia,bing,duck` — serwis agreguje wyniki z Wikipedia, MSN/Bing (jeśli `BING_API_KEY` ustawione) oraz DuckDuckGo (bez klucza). Na froncie możesz włączyć/wyłączyć źródła w polu wyboru.
- Bezpieczeństwo: podstawowa walidacja po stronie klienta i serwera; treść jest ucieczkowana przy renderowaniu, aby zapobiec prostemu XSS.
- DisckVirtual: prosty wirtualny dysk dla zalogowanych użytkowników (lokalne konto, Google, Microsoft, GitHub). Umożliwia przesyłanie plików i zarządzanie nimi; pliki przechowywane są w `data/uploads/<username>`. Aby włączyć logowanie Microsoft, ustaw `MS_CLIENT_ID` in `.env` and register the app in Azure (scope: `User.Read`).

OAuth / Social login setup:
- Google: set `GOOGLE_CLIENT_ID` in `.env` and add authorized origin for your site (e.g., `http://localhost:3000` and `https://disckarol.pl`).
- Microsoft: set `MS_CLIENT_ID` in `.env` and configure redirect URIs (e.g., `http://localhost:3000` or your public URL).
- GitHub: set `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` in `.env` and add `http://localhost:3000/auth/github/callback` (and production callback) as Authorization callback URL in your GitHub OAuth App settings.
- YouTube / DriveYT: set `YOUTUBE_API_KEY` in `.env` (YouTube Data API v3 key). DriveYT provides video search and a simple AI-assisted summary when logged-in (uses top YouTube results to compose a summary).
Uruchamianie bez `dsn.com` (domyślny URL na Azure):
- Po wdrożeniu na Azure Web App aplikacja będzie dostępna pod domyślną domeną `https://<APP_NAME>.azurewebsites.net` — nie musisz mapować `dsn.com`, jeśli chcesz korzystać z domyślnego hosta. Wystarczy, że stworzysz Web App i wykonasz deploy (GitHub Actions lub Docker), a następnie otworzysz `https://<APP_NAME>.azurewebsites.net`.

Automatyczny deploy z lokalnego komputera (skrypt PowerShell)
1. Upewnij się, że masz zainstalowany Azure CLI i jesteś zalogowany:
   - `az login`
2. Uruchom skrypt (przykład):
   - `.iles\scripts\deploy-azure.ps1 -AppName my-dsn-app -Domain dsn.com`
   - Skrypt utworzy Resource Group, App Service plan, Web App (Node 18), ustawi `SESSION_SECRET` i wypchnie archiwum ZIP aplikacji.
3. Po wdrożeniu:
   - Aplikacja będzie dostępna pod `https://my-dsn-app.azurewebsites.net`
   - Jeśli podałeś `-Domain dsn.com`, skrypt wypisze instrukcje DNS (dodaj rekordy A/CNAME u rejestratora), a następnie użyj `az webapp config hostname add` by przypisać hostname w Azure.
Public URL (wyświetlanie linku na stronie)
- Strony wyświetlają na górze link "Live site" automatycznie, gdy serwer zwróci publiczny URL. Ustaw PUBLIC_URL w ustawieniach aplikacji (Environment variables) w Azure lub lokalnie w `.env` aby zdefiniować: `PUBLIC_URL=https://my-dsn-app.azurewebsites.net`.
- Jeżeli zmienna nie jest ustawiona, aplikacja pokaże „No public URL configured” i link do lokalnego środowiska `http://localhost:3000`.
Uwaga: Nie wykonuję zmian w Twoich DNS ani nie mogę samodzielnie kupić domeny `dsn.com` — musisz dodać wymagane rekordy DNS u rejestratora i ewentualnie udzielić dostępu jeśli chcesz, żebym pomógł z konfiguracją marki/rekordów.

Dalsze ulepszenia (do rozważenia):
- Przechowywanie użytkowników i subskrybentów w bazie danych (SQLite/Postgres)
- HTTPS i dodatkowe zabezpieczenia (CSRF, rate limiting)
- Logowanie aktywności, paginacja listy informacji, caching wyników wyszukiwania

Test lokalny pod `dsn.com` (lokalnie):
- Dodaj linię `127.0.0.1 dsn.com` do `C:\Windows\System32\drivers\etc\hosts` i otwórz http://dsn.com:3000 (tylko lokalne przekierowanie).

Uwaga: nie mogę wdrożyć na Twoje konto Azure bez dostępu. Mogę poprowadzić Cię krok po kroku lub przygotować pliki (workflow + Dockerfile), które już dodałem do repo. Jeżeli chcesz, pomogę:
- wygenerować Publish Profile i skonfigurować GitHub Secrets (instrukcja)
- uruchomić deployment i zweryfikować custom domain oraz certyfikat SSL

