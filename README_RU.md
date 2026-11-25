<div align="center">

# INCYDENTY

**Информационная панель отдела**  
PWA-приложение для показа результатов, рабочих экранов, информационных слайдов и складового контроля.

<p>
  <a href="https://horkiroman4408-cyber.github.io/Panel-informacyjny/"><img alt="Открыть приложение" src="https://img.shields.io/badge/Открыть_приложение-INCYDENTY-0a84ff?style=for-the-badge"></a>
  <a href="https://github.com/horkiroman4408-cyber/Panel-informacyjny"><img alt="Репозиторий" src="https://img.shields.io/badge/GitHub-Репозиторий-1f2937?style=for-the-badge"></a>
</p>

<p>
  <a href="README.md">Polska wersja</a>
</p>

</div>

---

## О проекте

**INCYDENTY** — это приложение формата **PWA**, созданное для работы на компьютере и на телевизорах отдела.

Оно объединяет в одном месте:
- **Harmonogram pracy** — рабочие экраны и подстраницы,
- **Wyniki i normy** — результаты процессов и карточки работников,
- **Stock Control** — контроль полок, единиц, MP Stocking и RS1,
- **Tablica informacyjna** — объявления, фото, PDF и сохранённые подстраницы,
- **Konstruktor Scena TV** — конструктор собственных TV-карточек 16:9,
- **Tryb TV** — полноэкранный автоматический показ.

---

## Быстрый старт

### Ссылка на приложение
👉 **[https://horkiroman4408-cyber.github.io/Panel-informacyjny/](https://horkiroman4408-cyber.github.io/Panel-informacyjny/)**

### Установка как приложения

**Microsoft Edge**
1. Открой ссылку приложения.
2. Нажми **⋯**.
3. Выбери **Aplikacje** → **Zainstaluj tę witrynę jako aplikację**.
4. Подтверди установку.

**Google Chrome**
1. Открой ссылку приложения.
2. Нажми иконку установки в адресной строке или меню **⋮**.
3. Выбери **Install app / Zainstaluj aplikację**.
4. Подтверди.

---

## Скриншоты

### Карточки работников
![Карточки работников](docs/images/wyniki-karty-pracownikow.png)

### Stock Control
![Stock Control](docs/images/stock-control-tv.png)

### Информационная табличка / TV-сцена
![TV-сцена](docs/images/tablica-informacyjna-tv.png)

### Конструктор TV-сцен
![Конструктор](docs/images/konstruktor-scena-tv.png)

---

## Основные модули

### Wyniki i normy
- импорт Excel-отчётов,
- просмотр процессов и норм,
- TV-показ,
- карточки работников по login TH.

### Stock Control
Работает на базе трёх Excel-файлов:
- **ALL SHELVES**,
- **NO OF UNITS**,
- **RS1 STOCK**.

Показывает:
- все полки,
- полки с товаром,
- пустые полки,
- процент заполнения,
- MP STOCKING,
- **do zatowarowania**,
- таблицы и TV-режим.

### Tablica informacyjna
- текстовые подстраницы,
- фото,
- PDF,
- сохранённые подстраницы,
- собственные TV-сцены,
- настройка порядка и времени показа.

### Konstruktor Scena TV
Конструктор отдельных карточек/слайдов 16:9.

Доступные элементы:
- заголовок,
- текст,
- нумерованный шаг,
- блок TAK / NIE,
- таблица,
- фото,
- важный / alert,
- список,
- секция,
- макет «фото + текст».

---

## TV-режим

Позволяет:
- включить полноэкранный режим,
- запускать автоматический показ,
- задавать время смены экранов,
- выбирать порядок слайдов,
- ставить показ на паузу,
- переключать вперёд и назад,
- показывать как данные, так и PDF и TV-сцены.

---

## Данные и хранение

Данные приложения хранятся **локально в браузере**.

Это значит:
- файлы не отправляются на внешний сервер приложения,
- настройки и часть материалов сохраняются локально,
- после очистки браузера часть данных может исчезнуть,
- поведение может отличаться в разных браузерах.

---

## Полезные ссылки

- **Приложение:** [https://horkiroman4408-cyber.github.io/Panel-informacyjny/](https://horkiroman4408-cyber.github.io/Panel-informacyjny/)
- **Репозиторий:** [https://github.com/horkiroman4408-cyber/Panel-informacyjny](https://github.com/horkiroman4408-cyber/Panel-informacyjny)
- **Польская версия README:** [README.md](README.md)

> Примечание: этот README собран по текущему состоянию проекта и последним изменениям в рабочей ветке. Номер версии лучше окончательно сверить уже в самом репозитории.
