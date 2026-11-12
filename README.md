# INCYDENTY

**Panel informacyjny działu · Информационная панель отдела**

## Polski

Aplikacja PWA do prezentowania danych działu na komputerze i telewizorze, w jasnym stylu Mr. Robot.

### Co zawiera

- **Wyniki i normy** — wyniki pracowników, normy procesów i procent ich realizacji. Dostępny jest też widok samych norm.
- **Przydział do procesów** — zakładka przygotowana do dalszej rozbudowy; import przydziału nie jest jeszcze dostępny.
- **Okres wyników** — daty od/do, opcjonalnie godziny; okres jest zapisywany z raportem. Obsługiwane procesy obejmują Audyt, Scalanie, Rozkładanie, NADWE i VAS.
- **Tryb TV** — wszystkie procesy razem lub osobno, wybór i kolejność ekranów, zmiana co 10–60 sekund albo stały ekran. Panel sterowania ukrywa się po 3 sekundach. Automatyczna, komfortowa lub kompaktowa gęstość dopasowuje liczbę wierszy do ekranu; listy procesów zmieniają strony niezależnie. Widok wszystkich procesów pokazuje login, wynik, procent i pasek realizacji. Widok jednego procesu zawiera także sztuki, czas i status normy.
- **PWA** — instalacja jako aplikacja, praca offline po pierwszym załadowaniu i powiadomienia o aktualizacjach.

### Jak działa

Przy pierwszym uruchomieniu aplikacja jest pusta. Użytkownik wczytuje Excel w formacie raportu Mr. Robot: arkusz `RAPORT`, sekcje procesów z normą oraz kolumny loginu, liczby sztuk, czasu i wyniku na godzinę.

Plik jest przetwarzany lokalnie. Ostatni raport i ustawienia TV są zapamiętywane w przeglądarce. Dane nie są wysyłane na serwer ani synchronizowane między urządzeniami.

## Русский

PWA-приложение для показа данных отдела на компьютере и телевизоре, в светлом стиле Mr. Robot.

### Что есть

- **Wyniki i normy** — результаты сотрудников, нормы процессов и процент выполнения. Есть отдельный показ только норм.
- **Przydział do procesów** — вкладка для дальнейшего развития; загрузка распределения пока не реализована.
- **Период результатов** — даты от/до и время по желанию; сохраняется вместе с отчётом. Поддерживаются Audyt, Scalanie, Rozkładanie, NADWE и VAS.
- **Режим TV** — все процессы вместе или отдельно, выбор и порядок экранов, переключение каждые 10–60 секунд либо постоянный экран. Управление скрывается через 3 секунды. Автоматическая, комфортная и компактная плотность подстраивают вместимость под экран; списки процессов листаются независимо. В общем обзоре видны логин, результат, процент и полоска выполнения. При показе одного процесса дополнительно видны количество штук, время и статус нормы.
- **PWA** — установка как приложения, офлайн-работа после первой загрузки и уведомления об обновлениях.

### Как работает

При первом запуске приложение пустое. Пользователь загружает Excel в формате отчёта Mr. Robot: лист `RAPORT`, блоки процессов с нормой и столбцы логина, количества, времени и результата в час.

Файл обрабатывается локально. Последний отчёт и настройки TV сохраняются в браузере. Данные не отправляются на сервер и не синхронизируются между устройствами.

## Pliki / Файлы

| Plik / Файл | Rola / Назначение |
| --- | --- |
| `index.html`, `style.css` | Interfejs i wygląd / Интерфейс и оформление |
| `app.js`, `data.js` | Logika i pusty stan początkowy / Логика и пустое начальное состояние |
| `pwa.js`, `sw.js` | Instalacja, aktualizacje i offline / Установка, обновления и офлайн |
| `manifest.webmanifest`, `icons/`, `fonts/` | Ustawienia PWA, ikony i czcionki / Настройки PWA, иконки и шрифты |
| `version.json`, `tools/release.py` | Wersja i przygotowanie aktualizacji / Версия и подготовка обновлений |
