#!/usr/bin/env python3
"""INCYDENTY: numer wydania i kontrola spójności. Python 3, bez zależności.

  python tools/release.py 1.1.66   podnosi wersję (version.json, sw.js, README.md)
  python tools/release.py --check  tylko sprawdza spójność, niczego nie zapisuje

Kolejność wydania:
  1. Dodaj wpis NA POCZĄTKU listy RELEASES w info-release.js (historia w oknie Informacje).
  2. Uruchom: python tools/release.py X.Y.Z
  3. Wgraj do repozytorium wszystkie zmienione pliki.

Źródłem prawdy jest version.json. Przeglądarka czyta go w pwa.js i w oknie Informacje,
więc w kodzie aplikacji nie ma już ręcznie wpisanych numerów wersji.
"""
from pathlib import Path
import datetime, json, re, sys

root = Path(__file__).resolve().parent.parent
VER = r'\d+\.\d+\.\d+'
SW_VERSION = re.compile(r"const VERSION = '(" + VER + r")';")
README_VERSION = re.compile(r"(\*\*Wersja · Версия\*\* — )(" + VER + r")")
RELEASES_FIRST = re.compile(r"const RELEASES=\[\s*\{v:'(" + VER + r")'")
SW_FILES = re.compile(r"const FILES = \[(.*?)\];", re.S)


def read(name):
    return (root / name).read_bytes().decode('utf-8')


def write(name, text):
    (root / name).write_bytes(text.encode('utf-8'))  # zachowuje końce linii


def find_once(regex, text, label):
    found = regex.findall(text)
    if len(found) != 1:
        raise SystemExit('BŁĄD: w %s znaleziono %d dopasowań (powinno być 1).' % (label, len(found)))
    return regex.search(text)


def as_tuple(version):
    return tuple(int(x) for x in version.split('.'))


def collect():
    """Zwraca (wersje, błędy, ostrzeżenia)."""
    errors, warnings, versions = [], [], {}
    versions['version.json'] = json.loads(read('version.json'))['version']
    versions['sw.js'] = find_once(SW_VERSION, read('sw.js'), 'sw.js').group(1)
    versions['README.md'] = find_once(README_VERSION, read('README.md'), 'README.md').group(2)
    versions['info-release.js (RELEASES[0])'] = find_once(RELEASES_FIRST, read('info-release.js'), 'info-release.js').group(1)
    if len(set(versions.values())) != 1:
        errors.append('Numery wersji się różnią: ' + ', '.join('%s=%s' % kv for kv in versions.items()))

    sw = read('sw.js')
    listed = re.findall(r"'([^']+)'", find_once(SW_FILES, sw, 'sw.js (FILES)').group(1))
    for name in listed:
        if name != './' and not (root / name).is_file():
            errors.append('sw.js wymienia plik, którego nie ma: ' + name + ' (instalacja offline by się nie udała)')
    for path in sorted(root.glob('*')):
        if path.suffix in ('.js', '.css') and path.name != 'sw.js' and path.name not in listed:
            warnings.append(path.name + ' leży w katalogu głównym, ale nie ma go w FILES w sw.js (nie trafi do pamięci offline)')
    return versions, errors, warnings


def report(errors, warnings):
    for w in warnings:
        print('UWAGA:', w)
    for e in errors:
        print('BŁĄD:', e)
    return not errors


def check():
    versions, errors, warnings = collect()
    for name, v in versions.items():
        print('  %-32s %s' % (name, v))
    if report(errors, warnings):
        print('OK: wersje i lista plików offline są spójne.')
        return 0
    return 1


def bump(new):
    if not re.fullmatch(VER, new):
        raise SystemExit('Użycie: python tools/release.py 1.1.66   (lub --check)')
    current = json.loads(read('version.json'))['version']
    if as_tuple(new) <= as_tuple(current):
        raise SystemExit('Podaj wersję wyższą niż %s.' % current)
    top = find_once(RELEASES_FIRST, read('info-release.js'), 'info-release.js').group(1)
    if top != new:
        raise SystemExit("Najpierw dodaj wpis v%s na POCZĄTKU listy RELEASES w info-release.js (teraz na górze jest v%s)." % (new, top))

    sw = read('sw.js')
    find_once(SW_VERSION, sw, 'sw.js')
    readme = read('README.md')
    find_once(README_VERSION, readme, 'README.md')

    # wszystkie wzorce znalezione dokładnie raz, dopiero teraz zapis
    write('sw.js', SW_VERSION.sub("const VERSION = '%s';" % new, sw, count=1))
    write('README.md', README_VERSION.sub(lambda m: m.group(1) + new, readme, count=1))
    write('version.json', json.dumps({'version': new, 'date': datetime.date.today().isoformat()}, indent=2) + '\n')
    print('Zmieniono: version.json, sw.js, README.md  (%s -> %s)' % (current, new))

    _, errors, warnings = collect()
    if not report(errors, warnings):
        raise SystemExit(1)
    print('Wydanie %s gotowe. Wgraj zmienione pliki: version.json, sw.js, README.md, info-release.js.' % new)
    return 0


if __name__ == '__main__':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass
    if len(sys.argv) != 2:
        raise SystemExit('Użycie: python tools/release.py 1.1.66   (lub --check)')
    sys.exit(check() if sys.argv[1] == '--check' else bump(sys.argv[1]))
