# Mój budżet — Android, iPhone i PWA

React Native + TypeScript + Expo SDK 58 + Expo Router + Expo SQLite. Aplikacja mobilna z lokalnymi przypomnieniami oraz instalowalna wersja PWA do przeglądarki.

## Uruchomienie i sprawdzenie

Wymagane Node.js 22.13+ (obsługiwana linia LTS) i npm. Rozpakuj projekt i wykonaj:

```bash
npm install
npx expo-doctor
npm run typecheck
npx expo start
```

## Android — APK do instalacji

Zaloguj się do Expo i połącz projekt z kontem (przy pierwszym uruchomieniu kreator poprosi o utworzenie projektu EAS):

```bash
npx eas-cli@latest login
npm run build:android:apk
```

Profil `preview` generuje **APK**, a nie AAB. Po zakończeniu kompilacji pobierz APK z linku EAS i zainstaluj na Androidzie. Może być wymagane zezwolenie na instalację z tego źródła.

## iPhone — instalacja na własnym urządzeniu

Opcja A: Mac + Xcode, iPhone podłączony i podpisywanie skonfigurowane w Xcode:

```bash
npx expo prebuild --platform ios
npx expo run:ios --device
```

Opcja B: EAS Build, profil `preview` (wymaga odpowiedniego podpisania iOS, zwykle płatnego Apple Developer Program oraz zarejestrowania urządzenia):

```bash
npx eas-cli@latest login
npx eas-cli@latest device:create
npm run build:ios:device
```

Build iOS `preview` jest przeznaczony na fizyczne urządzenia i nie jest instalowany jak zwykły APK. TestFlight/App Store wymagają osobnego procesu dystrybucji.

## Symulator iOS

```bash
npm run build:ios:simulator
```

Wynik z profilu `simulator` jest przeznaczony wyłącznie dla symulatora, nie na fizyczny iPhone.

## Publikacja w sklepach

```bash
npm run build:production
```

Profil `production` generuje Android App Bundle (AAB) i podpisany build iOS po skonfigurowaniu kont i certyfikatów. Publikacja wymaga osobnego przesłania do sklepów. Przed publikacją upewnij się, że identyfikatory pakietu `pl.mojbudzet.mobile` są wolne i należą do Ciebie.

## Zakres wersji 1.0

- Budżet miesięczny: wypłata, plan i wykonanie, rezerwa, oszczędności, wydatki niezaplanowane.
- Codzienne: plan miesięczny, wykonanie sumowane z pojedynczych zakupów według ich dat.
- Firmowe: plan miesięczny lub tygodniowy, wykonanie sumowane z zakupów.
- Jeden konfigurator: gotowe pastylki Jedzenie, Rachunki, Chemia, Czynsz, Raty oraz własne nazwy.
- Na pierwszym uruchomieniu Jedzenie i Rachunki są dodane jako codzienne z planem 0 zł.
- Dane w lokalnym SQLite, bez serwera. Kopia zapasowa do pliku JSON i przywracanie w Ustawieniach.
- Lokalna opcja niedzielnego przypomnienia o wydatkach.

## Ważne

- Nie ma migracji z IndexedDB poprzedniej PWA do SQLite.
- Regularnie zapisuj kopię zapasową poza telefonem. Usunięcie aplikacji może spowodować utratę lokalnych danych.
- `expo-file-system`, `expo-sharing` i `expo-document-picker` obsługują kopie zapasowe. `expo-secure-store` nie jest obecnie wykorzystywany.
- W paczce jest **projekt gotowy do próby kompilacji**, nie skompilowany APK/IPA.
- Nie zweryfikowano kompilacji natywnej ani instalacji na fizycznych urządzeniach w tym środowisku.

## Poprawki budżetu i danych

- Każdy miesiąc ma własny plan kategorii. Konfigurator zmienia plan bieżącego miesiąca i szablon nowych miesięcy; ekran Budżet pozwala edytować plan wskazanego miesiąca i kopiować poprzedni.
- Archiwizacja zachowuje plany i wykonanie w dotychczasowych miesiącach.
- Kwoty są przechowywane w całkowitych groszach. Przy podziale tygodnia na miesiące nadmiarowe grosze przypadają kolejnym dniom od poniedziałku.
- Pierwsze uruchomienie nowej wersji zachowuje istniejące kwoty i tworzy plany dla miesięcy zapisanych w bazie. Stary kod nie przechowywał wcześniejszych wersji planu, więc nie można odtworzyć zmian dokonanych przed tą aktualizacją.
- Kopia JSON zawiera dane budżetu, w tym archiwalne kategorie, ale nie ustawienia systemowych powiadomień. Plik nie jest zaszyfrowany. Import jest walidowany i wykonywany w transakcji. Przed importem lokalna kopia umożliwia cofnięcie ostatniego przywrócenia.
- Po dodaniu `expo-document-picker` trzeba ponownie zbudować własną aplikację natywną (`npm run ios` / `npm run android`); samo przeładowanie Metro nie dołączy nowego modułu.

Testy: `npm test` (Node.js 22.13+ z modułem `node:sqlite`), kontrola typów: `npm run typecheck`. Testy używają SQLite w pamięci i nie otwierają bazy telefonu. Powiadomienia, wybór pliku i udostępnianie wymagają sprawdzenia na urządzeniu.

## Dodawanie zakupów i historia kategorii

- Środkowy przycisk ＋ w dolnym menu otwiera panel dodawania wydatku bez zmiany aktualnej zakładki. Wpisz kwotę, wybierz kategorię i datę (domyślnie dzisiaj); opis jest opcjonalny.
- Każdy zakup jest osobnym wpisem w SQLite. Kolejne wpisy zwiększają sumę; nie edytuje się zbiorczej kwoty. Przycisk zapisu blokuje wielokrotne kliknięcia, a identyfikator operacji chroni przed podwójnym zapisem przy ponowieniu.
- W zakładce Wydatki dotknięcie kategorii otwiera dolny panel z datami zakupów, kwotami, opisami i czasem dodania. Z panelu można dodać kolejny zakup lub usunąć błędny wpis po potwierdzeniu.
- Nowe zakupy trafiają w całości do miesiąca daty zakupu. Dotychczasowe sumy tygodniowe zachowują poprzedni sposób podziału między miesiące; są widoczne w historii jako wcześniejsze kwoty zbiorcze bez wymyślonych dat zakupów.
- Kopie zapasowe w formacie 4 zawierają zakupy, cele i wpłaty. Można też przywrócić formaty 2 i 3. Przywrócenie zastępuje cały budżet, w tym cele.

## Zgodność z Expo Go

Projekt jest zgodny z Expo Go dla SDK 58. Po aktualizacji zakończ stary serwer Metro (Ctrl+C), uruchom `npm start -- --clear --go` i ponownie zeskanuj nowy kod QR w Expo Go. Przeładowanie aplikacji podłączonej do starego serwera może nadal pokazywać SDK 54.

Zaktualizowano również wygenerowany projekt iOS, zachowując jego dotychczasowy identyfikator `pl.mojbudzet.dev` i zespół podpisujący w konfiguracji Expo. Uruchamianie w Expo Go nie wymaga CocoaPods; własna kompilacja iOS wymaga ponownego zainstalowania podów i narzędzi obsługiwanych przez SDK 58.

## PWA w przeglądarce i Netlify

```bash
npm ci
npm run build:web
npm run preview:web
```

Podgląd gotowej wersji PWA działa pod `http://127.0.0.1:4173`. Do tworzenia interfejsu można też użyć `npm run web`; tryb deweloperski nie rejestruje service workera offline.

W Netlify wybierz **Add new project → Import an existing project → GitHub → kwasilewska01/budget_app** i gałąź `main`. Repozytorium zawiera `netlify.toml`, więc ustawienia są gotowe: komenda `npm run build:web`, katalog publikacji `dist`, Node 22.14. Netlify uruchomi nowe wdrożenie po kolejnych pushach.

Plik konfiguracyjny ustawia także przekierowania dla adresów takich jak `/wydatki` i nagłówki wymagane przez SQLite w przeglądarce. Nie zastępuj go samą publikacją HTML bez tych nagłówków. Przy ręcznym przeciąganiu folderu `dist` do Netlify konfiguracja repozytorium nie jest automatycznie odczytywana — korzystaj z importu GitHub.

Po pierwszym otwarciu online aplikacja zapisuje wszystkie swoje pliki, w tym silnik bazy danych, do pracy offline. Można potem przeglądać budżet, dodawać i usuwać zakupy oraz otwierać zakładki bez internetu. Aktualizacja czeka na potwierdzenie przyciskiem „Zapisz zmiany i odśwież”; nie wymusza samoczynnego przeładowania podczas wpisywania wydatku.

Instalacja PWA:

- iPhone: Safari → Udostępnij → Do ekranu początkowego.
- Android: Chrome → Zainstaluj aplikację / Dodaj do ekranu głównego.
- Komputer: ikona instalacji w pasku adresu lub opcja w menu przeglądarki.

W Ustawieniach jest przycisk instalacji, jeśli przeglądarka go udostępnia. Ikony i nazwa są takie same jak w aplikacji mobilnej.

Dane pozostają lokalne. W PWA SQLite pracuje w pamięci, a zatwierdzone dane są atomowo zapisywane w IndexedDB; dzięki temu zapis nie zależy od utrzymywania otwartego uchwytu pliku. Istniejąca baza plikowa jest automatycznie kopiowana przy pierwszym uruchomieniu nowej wersji i pozostaje zachowana. Aplikacje natywne nadal używają SQLite na dysku. Potrzebna jest aktualna przeglądarka z obsługą tego magazynu i bezpieczny adres HTTPS — localhost jest dozwolony do testów. Jednocześnie otwieraj budżet w jednej karcie/oknie; druga karta pokaże instrukcję, zamiast próbować równoczesnego zapisu. Zamknięcie strony nie usuwa zapisów. Tryb prywatny, wyczyszczenie danych witryny, usunięcie profilu przeglądarki lub automatyczne sprzątanie magazynu może je usunąć. Przycisk „Chroń lokalne dane” prosi przeglądarkę o trwały magazyn, ale nie zastępuje kopii zapasowej.

PWA i aplikacja mobilna nie synchronizują danych automatycznie. Przenieś budżet plikiem JSON przez **Ustawienia → Kopia zapasowa**. Import zastępuje cały budżet; można cofnąć ostatnie przywrócenie. Cotygodniowe powiadomienia przy zamkniętej aplikacji pozostają funkcją wersji natywnej — PWA ich nie planuje.

Testy PWA: `npm run test:web` po `npm run build:web`. Na Macu testy korzystają z zainstalowanego Google Chrome. Na pozostałych systemach zainstaluj przeglądarkę testową przez `npx playwright install chromium` lub wskaż ją przez `PLAYWRIGHT_EXECUTABLE_PATH`. Testy sprawdzają zapis zakupów po odświeżeniu, ponowne otwarcie offline, import/eksport i cofanie kopii, usuwanie wpisu, blokadę drugiej karty i układ na komputerze. Nie używają danych użytkownika.

## Wpisywanie kwot

Po wejściu w pole kwoty wartość zero znika, żeby można było od razu wpisać liczbę. Pozostawienie pustego pola przywraca zero. Niezerowe kwoty i tekstowe nazwy nie są czyszczone.

Zapis PWA jest potwierdzany dopiero po zakończeniu transakcji IndexedDB. Nieudany zapis wycofuje zmiany w pamięci, więc ponowienie nie dubluje zakupów. Dodatkowe testy przeglądarkowe zamykają uchwyty OPFS, symulują odmowę zapisu, sprawdzają migrację istniejącego budżetu i edycję zerowych kwot.

## Cele oszczędnościowe

W dolnym menu otwórz **Cele** i wybierz **Utwórz cel**. Podaj nazwę, np. „Nowy samochód”, oraz docelową kwotę, np. 40 000 zł. Można prowadzić kilka niezależnych celów.

- Każda wpłata ma własną kwotę, datę i opcjonalny opis. Kilka wpłat w tym samym miesiącu sumuje się.
- Postęp obejmuje wszystkie wpłaty, niezależnie od wybranego miesiąca. Ekran pokazuje zebrane środki, procent, kwotę pozostałą do celu i status osiągnięcia celu.
- Miesiąc na górze ekranu służy do sprawdzenia, ile odłożono w danym okresie. W historii wpłaty są grupowane według miesięcy.
- Wpłaty automatycznie zmniejszają saldo i prognozę budżetu miesiąca wskazanego datą. Pole **Oszczędności poza celami** jest przeznaczone wyłącznie na inne oszczędności — nie wpisuj tam ponownie wpłat na cele.
- Można edytować nazwę i kwotę celu. Archiwizacja ukrywa cel z aktywnej listy, zachowując wszystkie wpłaty i rozliczenia. Cel można przywrócić z archiwum.
- Błędną wpłatę można usunąć po potwierdzeniu; zebrana suma i budżet danego miesiąca przeliczają się automatycznie.
- Cele i wpłaty działają offline w PWA oraz są częścią lokalnych kopii JSON w formacie 4. Starsze kopie (2/3) nadal można przywrócić, ale nie zawierają celów. Przed przenoszeniem kopii w formacie 4 zaktualizuj aplikację docelową.

W konfiguratorze pole **Waluta** domyślnie ma wartość PLN. Można wpisać własne oznaczenie (do 20 znaków), używane w całym budżecie, wydatkach i celach. Zmiana nie przelicza kwot. Ustawienie jest zapisywane lokalnie oraz w kopii zapasowej.
