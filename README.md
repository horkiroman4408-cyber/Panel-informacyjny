# INCYDENTY · Panel informacyjny działu

Panel na odprawę i na halę. Na jednym telewizorze zespół może sprawdzić przydział do procesu i godzinę przerwy, a na drugim zobaczyć wyniki, karty pracowników i komunikaty na bieżącą zmianę.

**Wersja 1.1.63** · **Aplikacja PWA** · **Import z Excela** · **Tryb TV**

## Pierwszy pokaz

1. Otwórz **Wyniki i normy → Wyniki procesów → Wczytaj Excel** i wybierz plik `.xlsx` z arkuszem `RAPORT`.
2. W oknie **Okres wyników** podaj daty, których dotyczą dane. Możesz też wybrać **Pomiń** i uzupełnić je później.
3. Otwórz jeden proces. Sprawdź jego normę, wynik w sztukach na godzinę i liczbę osób, które osiągnęły normę.
4. Kliknij **Tryb TV → Jeden stały ekran**, wybierz wyniki i naciśnij **Uruchom pokaz**. Klawisz `Esc` kończy pokaz.

> **Przykład z pliku wzorcowego.** Norma procesu AUDYT wynosi 120 szt./h. Osoba z wynikiem 102 szt./h realizuje 85% normy, a osoba z wynikiem 130 szt./h osiąga 108,3%. Licznik „osiąga normę” pokazuje **1 / 2**.

## Co można pokazać zespołowi

| Widok | Co zobaczysz na ekranie |
| --- | --- |
| **Harmonogram pracy** | Przydziały pracowników, nieobecności i przerwy. Wybierz zmianę oraz czas pracy 8H, 10H lub 12H. Ikona oka określa, które osoby i zespoły pojawią się na TV. |
| **Wyniki procesów** | Norma procesu, wynik każdej osoby w szt./h i procent realizacji. Możesz pokazać wszystkie procesy razem albo przejść do jednego z nich. |
| **Karty pracowników** | Procesy jednej osoby, przepracowane godziny i KPI za wybrany okres. Na TV wszystkie procesy pracownika są widoczne na jednej karcie. |
| **Tablica informacyjna** | Ogłoszenia i instrukcje ze zdjęciami. Wybierz jedną z siedmiu makiet, wpisz treść bezpośrednio na slajdzie, zapisz podstronę i dodaj ją do pokazu. |

## Jaki plik Excel wczytać?

Panel przyjmuje pliki `.xlsx` do **10 MB każdy**. Wybierz plik w zakładce odpowiadającej jego zawartości.

| Dane | Arkusz | Oczekiwany układ |
| --- | --- | --- |
| **Wyniki procesów** | `RAPORT` | Nazwa procesu w A, norma w C, np. `NORMA: 120 szt./h`. Pod nagłówkiem umieść login, liczbę sztuk, godziny i wynik w szt./h. Każdy proces ma osobną sekcję. |
| **Karta pracownika** | `Export` | Kolumny `PROCESS`, `Pieces`, `Time`, `KPI %`. Pod tabelą zachowaj filtr `Login TH` z jednym loginem i `Date` z zakresem dat. Jeden plik opisuje jedną osobę za jeden okres. |
| **Grafik na jutro** | `STAN` lub `Arkusz1` | Data i oznaczenie zmiany w nagłówku lub nazwie pliku. Pod każdą grupą umieść login, a bezpośrednio po prawej proces lub status. |
| **Przerwy** | `Sheet2` we wzorze | W A umieść sekcje `I ZMIANA` i `II ZMIANA` oraz wiersze `8H`, `10H`, `12H`. Przedziały godzin wpisz w B, D i F, np. `08:00 - 08:15`. |

W kartach pracowników można wczytać **do 25 plików jednocześnie**. Aby poprawić kartę, wczytaj plik ponownie z tym samym loginem i identycznym zakresem dat. Przy innym okresie powstanie osobna karta.

## Jak czytać KPI

- **Realizacja normy procesu** = wynik w szt./h ÷ norma × 100%.
- **KPI za okres** to średnia ważona czasem pracy. Proces wykonywany przez osiem godzin ma większy wpływ na wynik niż proces wykonywany przez godzinę.
- **Procesy w normie** pokazują, w ilu procesach pracownik osiągnął co najmniej 100%.
- W kolumnie `KPI %` wpisz w Excelu `95%` albo wartość liczbową `0,95`.

## Dwa telewizory, dwa widoki

Ustaw w systemie rozszerzony pulpit. Otwórz panel w dwóch oknach tego samego profilu przeglądarki i przenieś po jednym oknie na każdy telewizor. Po wczytaniu danych odśwież drugie okno przed uruchomieniem pokazu.

| Telewizor | Przykładowe ustawienie |
| --- | --- |
| **TV 1 · Przydział** | **Jeden stały ekran → Harmonogram pracy**. Zespół może w każdej chwili sprawdzić swój proces i przerwę. |
| **TV 2 · Wyniki i komunikaty** | **Automatyczny pokaz**. Zaznacz wyniki, karty i wybrane ogłoszenia. Strzałkami ustaw kolejność, a przy każdym ekranie wybierz czas wyświetlania. |

Dostępne czasy to **10, 15, 20, 30 i 60 sekund**. Czas dotyczy całego ekranu: przy trzech stronach wewnętrznych i ustawieniu 30 sekund każda strona będzie widoczna przez około 10 sekund.

## Gdzie są zapisane dane?

Panel odczytuje pliki Excel w przeglądarce. Raporty i ustawienia pozostają w profilu danego stanowiska, a slajdy ze zdjęciami są zapisywane lokalnie w IndexedDB. Na innym komputerze trzeba ponownie wczytać pliki źródłowe. Wyczyszczenie danych witryny może usunąć zapisane raporty i slajdy.

Przed pracą offline otwórz aplikację online i sprawdź status PWA w **Informacje → Aplikacja**.

---

**Autor projektu · [Roman Horki](https://github.com/horkiroman4408-cyber)**
