<div align="center">

# INCYDENTY

**Panel informacyjny działu**  
Nowoczesna aplikacja PWA do prezentacji wyników, harmonogramu pracy, komunikatów TV i kontroli magazynu.

<p>
  <a href="https://horkiroman4408-cyber.github.io/Panel-informacyjny/"><img alt="Uruchom aplikację" src="https://img.shields.io/badge/Uruchom_aplikację-INCYDENTY-0a84ff?style=for-the-badge"></a>
  <a href="https://github.com/horkiroman4408-cyber/Panel-informacyjny"><img alt="Repozytorium" src="https://img.shields.io/badge/GitHub-Repozytorium-1f2937?style=for-the-badge"></a>
</p>

<p>
  <a href="#-szybki-start">Szybki start</a> •
  <a href="#-moduły">Moduły</a> •
  <a href="#-konstruktor-scena-tv">Konstruktor Scena TV</a> •
  <a href="#-wymagane-pliki">Wymagane pliki</a> •
  <a href="#-tryb-tv">Tryb TV</a> •
  <a href="README_RU.md">Русская версия</a>
</p>

</div>

---

## O projekcie

**INCYDENTY** to aplikacja typu **PWA (Progressive Web App)** przygotowana do pracy na komputerze i na telewizorach działowych.  
Łączy kilka obszarów w jednym miejscu:

- **Harmonogram pracy** – podział pracowników i podstrony działowe.
- **Wyniki i normy** – analiza procesów oraz karty pracowników.
- **Stock Control** – kontrola półek, jednostek, MP Stocking i RS1 na podstawie eksportów Excel / Power BI.
- **Tablica informacyjna** – komunikaty, zdjęcia, PDF-y, zapisane podstrony i własne slajdy.
- **Konstruktor Scena TV** – edytor kart/ogłoszeń w układzie telewizyjnym 16:9.
- **Tryb TV** – automatyczny pokaz pełnoekranowy z kolejnością i czasem slajdów.

Projekt jest rozwijany pod realną pracę działu i nastawiony na:

- szybkie ładowanie,
- czytelność na dużych ekranach,
- prosty import danych,
- lokalne przechowywanie ustawień i materiałów,
- możliwość pracy jak w aplikacji, a nie jak w zwykłej stronie.

---

## 🚀 Szybki start

### 1) Uruchom aplikację

**Link do aplikacji:**  
👉 **[https://horkiroman4408-cyber.github.io/Panel-informacyjny/](https://horkiroman4408-cyber.github.io/Panel-informacyjny/)**

Po wejściu na stronę możesz używać jej od razu w przeglądarce albo zainstalować jako aplikację.

### 2) Zainstaluj jako aplikację (PWA)

#### Microsoft Edge
1. Otwórz link do aplikacji.
2. Kliknij menu **⋯**.
3. Wybierz **Aplikacje** → **Zainstaluj tę witrynę jako aplikację**.
4. Potwierdź instalację.

#### Google Chrome
1. Otwórz link do aplikacji.
2. Kliknij ikonę instalacji w pasku adresu **lub** menu **⋮**.
3. Wybierz **Zainstaluj aplikację** / **Install app**.
4. Potwierdź.

### 3) Do czego najlepiej używać

- **Komputer / laptop** – edycja, import danych, tworzenie slajdów i ustawień.
- **Telewizor / duży ekran** – pełnoekranowy pokaz działowy w Trybie TV.

---

## 📸 Podgląd aplikacji

### Wyniki i normy – karty pracowników

![Wyniki i normy – karty pracowników](docs/images/wyniki-karty-pracownikow.png)

### STOCK CONTROL – widok TV

![Stock Control – widok TV](docs/images/stock-control-tv.png)

### Tablica informacyjna – scena TV

![Tablica informacyjna – scena TV](docs/images/tablica-informacyjna-tv.png)

### Konstruktor Scena TV

![Konstruktor Scena TV](docs/images/konstruktor-scena-tv.png)

### PDF i zapisane podstrony

![PDF i zapisane podstrony](docs/images/pdf-i-zapisane-podstrony.png)

---

## 🧩 Moduły

## Harmonogram pracy

Moduł do prezentacji zaplanowanej pracy i materiałów działowych.

Najważniejsze możliwości:
- podział na podstrony działowe,
- materiały widoczne na TV,
- zapisane podstrony i własne sceny,
- integracja z materiałami informacyjnymi.

## Wyniki i normy

Główna część do analizy pracy procesów i pracowników.

### Wyniki procesów
- import raportu Excel,
- przegląd procesów i norm,
- filtrowanie i sortowanie,
- wybór okresu raportu,
- pokaz TV z automatycznym przełączaniem kart.

### Karty pracowników
- zapis kart pracowników z danych Excel,
- filtrowanie po miesiącu i loginie,
- widok KPI oraz czasu pracy w procesach,
- prezentacja na ekranie TV.

## STOCK CONTROL

Moduł magazynowy oparty na **3 plikach Excel**:
- **ALL SHELVES**,
- **NO OF UNITS**,
- **RS1 STOCK**.

Pokazuje m.in.:
- liczbę wszystkich półek,
- półki z towarem i puste półki,
- % zapełnienia,
- MP STOCKING,
- **do zatowarowania**,
- tabele szczegółowe dla ALL SHELVES, NO OF UNITS oraz RS1 STOCK,
- tryb TV z różnymi widokami dla wszystkich marek, SINSAY i RTS.

## Tablica informacyjna

Miejsce do prezentacji komunikatów działowych.

Obsługuje:
- zwykłe podstrony tekstowe,
- zdjęcia,
- zapisane slajdy,
- podgląd i pokaz dokumentów PDF,
- własne sceny TV,
- kolejność i czas pokazu.

## Konstruktor Scena TV

Nowy edytor do przygotowywania **normalnych kart/ogłoszeń**, a nie sztywnych stron jak PDF.

Przeznaczenie:
- komunikaty dla pracowników,
- instrukcje,
- ogłoszenia działowe,
- plansze informacyjne,
- proste sceny 16:9 do TV.

### Dostępne elementy
- Nagłówek
- Tekst
- Krok numerowany
- TAK / NIE
- Tabela
- Zdjęcie
- Ważne / alert
- Lista
- Sekcja
- Układ: zdjęcie + tekst

### Edycja
- przeciąganie elementów,
- zmiana rozmiaru,
- edycja tekstu bezpośrednio w bloku,
- formatowanie tekstu (m.in. rozmiar, kolor, marker, tło),
- kopiowanie i usuwanie bloków,
- kolejność warstw,
- ustawienia w wygodnym popoverze zamiast stałego panelu.

---

## 🗂 Wymagane pliki

Poniżej przykładowy zakres plików używanych przez aplikację.

| Obszar | Typ pliku | Przeznaczenie |
|---|---|---|
| Wyniki procesów | Excel raport procesów | import wyników, norm i procesu |
| Karty pracowników | Excel / Export | zapis kart pracowników według loginu TH |
| Harmonogram pracy | Excel STAN | dane zespołów / plan / podstrony |
| Harmonogram pracy | Excel przerwy | dodatkowe informacje do widoku pracy |
| Stock Control | ALL SHELVES.xlsx | stan półek |
| Stock Control | NO OF UNITS.xlsx | jednostki i stocking |
| Stock Control | RS1 STOCK.xlsx | dane RS1 |
| Tablica informacyjna | PDF / zdjęcia | materiały do pokazu TV |

Jeżeli w repozytorium są dodane przykładowe pliki, warto trzymać je w osobnym folderze, np. `Dokumenty/przykładowe_pliki/`.

---

## 📺 Tryb TV

Tryb TV jest jedną z najważniejszych części aplikacji.

Umożliwia:
- przejście w pełny ekran,
- automatyczne odtwarzanie ekranów,
- ustawienie czasu przełączania,
- wybór kolejności ekranów,
- pokaz pojedynczego ekranu lub całej listy,
- wstrzymanie pokazu,
- przejście do następnego i poprzedniego slajdu,
- spójne animacje kart i podstron,
- osobny pokaz dla danych, PDF i scen TV.

Typowe zastosowania:
- TV przy stanowiskach pracy,
- ekran z wydajnością procesów,
- ekran z kartami pracowników,
- ekran z komunikatami i instrukcjami,
- ekran magazynowy STOCK CONTROL.

---

## 🧠 Dane, pamięć i praca offline

Aplikacja przechowuje dane **lokalnie w przeglądarce**.

To oznacza, że:
- importowane pliki nie są wysyłane na zewnętrzny serwer aplikacji,
- ustawienia TV zapamiętują się lokalnie,
- zapisane podstrony i materiały mogą być przechowywane w przeglądarce,
- działanie zależy od konkretnej przeglądarki i urządzenia,
- po czyszczeniu danych przeglądarki część zapisanych materiałów może zostać usunięta.

PWA pozwala też na bardziej „aplikacyjne” działanie niż zwykła karta w przeglądarce.

---

## 📘 Dokumentacja

W projekcie można utrzymywać dodatkowe materiały:

- instrukcję użytkownika PL,
- instrukcję użytkownika RU,
- przykładowe pliki Excel,
- wzory dokumentów,
- zrzuty ekranu,
- krótkie instrukcje dla współpracowników.

Jeśli chcesz, warto dodać do repozytorium strukturę np.:

```text
Dokumenty/
├── instrukcje/
├── przykladowe_pliki/
├── zrzuty_ekranu/
└── wzory/
```

---

## 📝 Najważniejsze elementy aktualnego zakresu projektu

Na podstawie ostatnich prac w aplikacji zakres obejmuje m.in.:

- rozbudowany **STOCK CONTROL**,
- **Tablicę informacyjną** z PDF i zapisanymi podstronami,
- **Konstruktor Scena TV** do tworzenia kart 16:9,
- poprawiony **Tryb TV** z lepszą nawigacją i animacjami,
- okno **Informacje** z historią i danymi o aplikacji,
- lepszą prezentację treści na telewizorach.

> Uwaga: wersję numeru wydania warto ustawić już bezpośrednio w repozytorium zgodnie z faktycznym stanem aplikacji.

---

## 👤 Autor

**Roman Horki**  
Projekt: **INCYDENTY / Panel informacyjny działu**

Jeżeli korzystasz z projektu w zespole, warto zostawić w README oraz w aplikacji:
- link do autora,
- link do repozytorium,
- informację o licencji,
- historię zmian.

---

## 🔗 Najważniejsze linki

- **Aplikacja:** [https://horkiroman4408-cyber.github.io/Panel-informacyjny/](https://horkiroman4408-cyber.github.io/Panel-informacyjny/)
- **Repozytorium:** [https://github.com/horkiroman4408-cyber/Panel-informacyjny](https://github.com/horkiroman4408-cyber/Panel-informacyjny)
- **Wersja rosyjska README:** [README_RU.md](README_RU.md)

