# Historia zmian · INCYDENTY

Numer wersji jest zapisany w `version.json`. Wydanie przygotowuje `python tools/release.py X.Y.Z` (opis w nagłówku skryptu). Ta sama historia jest w aplikacji: **Informacje → Historia**.

Wersje, których tu nie ma, nie miały wpisu w historii aplikacji.

## 1.1.66 · 2026-11-25 · Jedno menu „Nowa podstrona”

W Tablicy informacyjnej trzy przyciski tworzenia podstron (Dodaj PDF, Konstruktor, Nowa podstrona) zastąpiono jednym menu „Nowa podstrona”: Scena TV, Ogłoszenie z szablonu i Dokument PDF. Edytory i zapisane podstrony działają bez zmian.

## 1.1.65 · 2026-11-25 · Porządek w numerach wersji

Numer wersji w oknie Informacje i w statusie PWA jest odczytywany z jednego pliku, version.json, więc zawsze zgadza się z zainstalowaną wersją. Uproszczono nazwę pamięci podręcznej offline oraz skrypt wydań. Bez zmian w danych, KPI, Excel i TV.

## 1.1.64 · 2026-11-24 · STOCK CONTROL, PDF i Tryb TV

Dodano STOCK CONTROL z importem 3 eksportów Excel, filtrami marek i ekranami TV. W Tablica informacyjna dodano PDF jako zapisane podstrony, podgląd TV, dopasowanie i kadrowanie. Rozszerzono formatowanie tekstu. Uspójniono przejścia TV, nawigację i układ ekranów oraz poprawiono wyświetlanie źródeł i wskaźników.

## 1.1.63 · Poprawka formatowania i markera

Poprawiono wklejanie tekstu oraz formatowanie zaznaczonych słów: rozmiar, kolor liter i marker. Dodano przycisk usuwania markera tylko z zaznaczonego tekstu.

## 1.1.61 · Kompaktowa pływająca belka

Panel formatowania pojawia się dopiero po kliknięciu tekstu, tuż nad edytowanym blokiem. Przyciski i odstępy zostały zmniejszone, a Dodaj blok tekstu przeniesiono nad makietę.

## 1.1.60 · Jeden edytor w makiecie

Wyłącznie jedna jasna belka formatowania nad slajdem: kolor i podświetlenie zaznaczonego tekstu, rozmiar, styl, listy, wyrównanie oraz tło wybranego bloku (także przezroczyste). Dodawanie i usuwanie bloków pozostaje w makiecie. Usunięto dolne zduplikowane panele.

## 1.1.59 · Edytor tekstu na slajdzie

Bezpośrednia edycja tekstu w makiecie i jasny pasek formatowania: pogrubienie, kursywa, podkreślenie, przekreślenie oraz listy. Usunięto pole Treść bloku i Położenie dodatkowe; formatowanie zaznaczonych słów jest zapisywane z podstroną.

## 1.1.58 · Automatyczne ukrywanie kursora TV

Kursor znika po 3 sekundach bezczynności i wraca przy ruchu myszy na każdym ekranie TV. Ustawienia paska sterowania pozostają niezależne.

## 1.1.57 · Kursor we wszystkich ekranach TV

Naprawiono konflikt z wcześniejszym trybem TV, który ukrywał kursor w Harmonogram pracy i Tablica informacyjna. Teraz sterowanie wskaźnikiem jest jednolite na wszystkich ekranach.

## 1.1.56 · Poprawka powrotu z TV i kursora

Po zakończeniu TV zamykany jest ostatni slajd informacyjny, a widoczny pozostaje tylko poprzedni dział. Ujednolicono widoczność kursora na wszystkich ekranach TV.

## 1.1.55 · Klasyczny wygląd i nowa typografia

Przywrócono klasyczny układ, kolory i karty aplikacji. Zachowano bardziej wyraziste nagłówki i typografię inspirowaną projektem v1.1.54. Bez zmian w danych, Excel i TV.

## 1.1.54 · Próba nowego wyglądu

Wariant wizualny z nową kompozycją i turkusowym akcentem. Wycofano zmiany układu w v1.1.55.

## 1.1.53 · Źródła danych i aktualne informacje

Jedna zwarta belka źródeł Excel nad harmonogramem. Zaktualizowano opis modułów, przechowywania danych i trybu TV w oknie O aplikacji.

## 1.1.0 · Karty pracowników (dawny PATCH.txt)

Wyniki i normy → Karty pracowników → Wczytaj pliki Excel. Maksymalnie 25 plików w jednej partii. Login TH i daty pochodzą z filtrów w plikach Export. Ten sam pracownik i okres aktualizują kartę. Wyniki procesów i karty mają osobne dane. TV: 1, 2 lub 4 karty, zmiana co 10–60 sekund. Dane pracowników nie są dołączone do repozytorium.
