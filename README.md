# Mój budżet — aplikacja mobilna 1.0.0

React Native + TypeScript + Expo SDK 58 + Expo Router + Expo SQLite + lokalne powiadomienia.

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
- Kopie zapasowe w formacie 3 zawierają zakupy. Można też przywrócić format 2 (zawiera tylko dawne sumy). Przywrócenie zastępuje cały budżet.

## Zgodność z Expo Go

Projekt jest zgodny z Expo Go dla SDK 58. Po aktualizacji zakończ stary serwer Metro (Ctrl+C), uruchom `npm start -- --clear --go` i ponownie zeskanuj nowy kod QR w Expo Go. Przeładowanie aplikacji podłączonej do starego serwera może nadal pokazywać SDK 54.

Zaktualizowano również wygenerowany projekt iOS, zachowując jego dotychczasowy identyfikator `pl.mojbudzet.dev` i zespół podpisujący w konfiguracji Expo. Uruchamianie w Expo Go nie wymaga CocoaPods; własna kompilacja iOS wymaga ponownego zainstalowania podów i narzędzi obsługiwanych przez SDK 58.
