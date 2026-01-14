# Instrukcja ręcznej publikacji strony disckarol.pl na GitHub Pages

**Autor:** Karol Kopeć © 2026 | 6ES

---

## Krok 1: Utwórz repozytorium na GitHub

1. Otwórz przeglądarkę i przejdź do: https://github.com/new
2. Zaloguj się na swoje konto GitHub (karolkopec)
3. Wypełnij formularz:
   - **Repository name:** `disckarol-site`
   - **Description:** `Strona disckarol.pl - Karol Kopeć 2026 6ES`
   - **Visibility:** Public ✓
   - **NIE zaznaczaj** "Add a README file"
4. Kliknij **"Create repository"**

---

## Krok 2: Prześlij pliki na GitHub

### Opcja A: Przez stronę GitHub (bez Git)

1. Na stronie nowego repozytorium kliknij **"uploading an existing file"**
2. Przeciągnij wszystkie pliki z folderu `dsn-service/public/`:
   - index.html
   - style.css
   - CNAME
   - 404.html
   - auth-modal.js
   - DisckVirtual.html
   - DriveYT.html
   - home.html
   - informations.html
   - login.html
   - menu.html
   - profile.html
   - register.html
   - service.html
3. W polu "Commit changes" wpisz: `Initial commit - disckarol.pl by Karol Kopeć 2026 6ES`
4. Kliknij **"Commit changes"**

### Opcja B: Przez Git (jeśli masz zainstalowany Git)

Otwórz terminal w folderze `dsn-service` i wykonaj:

```bash
# Skonfiguruj Git (jeśli jeszcze nie skonfigurowany)
git config --global user.name "karolkopec"
git config --global user.email "twoj-email@example.com"

# Dodaj zdalne repozytorium
git remote add origin https://github.com/karolkopec/disckarol-site.git

# Zmień nazwę brancha na main
git branch -M main

# Wypchnij kod na GitHub
git push -u origin main
```

Przy pierwszym push zostaniesz poproszony o dane logowania GitHub.

---

## Krok 3: Włącz GitHub Pages

1. Przejdź do: https://github.com/karolkopec/disckarol-site/settings/pages
2. W sekcji **"Source"**:
   - Wybierz: **GitHub Actions**
3. Kliknij **"Save"**

Alternatywnie (jeśli nie ma GitHub Actions):
- Source: **Deploy from a branch**
- Branch: **main** / **/ (root)**
- Kliknij **"Save"**

---

## Krok 4: Dodaj domenę niestandardową

1. Na tej samej stronie (Settings → Pages)
2. W sekcji **"Custom domain"**:
   - Wpisz: `disckarol.pl`
   - Kliknij **"Save"**
3. Zaznacz **"Enforce HTTPS"** (po weryfikacji DNS)

---

## Krok 5: Skonfiguruj DNS u rejestratora domeny

Zaloguj się do panelu rejestratora domeny disckarol.pl i dodaj następujące rekordy DNS:

### Dla domeny głównej (disckarol.pl):

| Typ | Nazwa/Host | Wartość/Target | TTL |
|-----|------------|----------------|-----|
| A | @ | 185.199.108.153 | 3600 |
| A | @ | 185.199.109.153 | 3600 |
| A | @ | 185.199.110.153 | 3600 |
| A | @ | 185.199.111.153 | 3600 |

### Dla subdomeny www:

| Typ | Nazwa/Host | Wartość/Target | TTL |
|-----|------------|----------------|-----|
| CNAME | www | karolkopec.github.io | 3600 |

**Uwaga:** Propagacja DNS może trwać od kilku minut do 48 godzin.

---

## Krok 6: Weryfikacja

1. Sprawdź status DNS:
   - Otwórz: https://www.whatsmydns.net/#A/disckarol.pl
   - Poczekaj aż wszystkie serwery pokażą IP GitHub

2. Po propagacji DNS:
   - Otwórz: https://disckarol.pl
   - Strona powinna się wyświetlić z certyfikatem SSL (kłódka)

3. Sprawdź status w GitHub:
   - https://github.com/karolkopec/disckarol-site/settings/pages
   - Powinno być: "Your site is live at https://disckarol.pl"

---

## Rozwiązywanie problemów

### Strona nie działa po dodaniu domeny:
- Sprawdź czy plik `CNAME` istnieje w repozytorium i zawiera `disckarol.pl`
- Poczekaj na propagację DNS (do 48h)

### Błąd certyfikatu SSL:
- Upewnij się, że DNS jest poprawnie skonfigurowany
- Odznacz i zaznacz ponownie "Enforce HTTPS" w ustawieniach Pages

### Strona pokazuje 404:
- Sprawdź czy plik `index.html` jest w głównym katalogu repozytorium
- Upewnij się, że GitHub Pages jest włączony

---

## Struktura plików w repozytorium

```
disckarol-site/
├── CNAME              ← Plik z domeną (disckarol.pl)
├── index.html         ← Strona główna
├── style.css          ← Style CSS
├── 404.html           ← Strona błędu 404
├── auth-modal.js      ← Skrypt logowania
├── DisckVirtual.html  ← Wirtualny dysk
├── DriveYT.html       ← YouTube Drive
├── home.html          ← Strona domowa
├── informations.html  ← Informacje
├── login.html         ← Logowanie
├── menu.html          ← Menu
├── profile.html       ← Profil
├── register.html      ← Rejestracja
└── service.html       ← Serwis
```

---

## Kontakt

Strona stworzona przez **Karol Kopeć** © 2026 | Klasa 6ES

URL: https://disckarol.pl
