#!/usr/bin/env python3
"""Set a unique release number before publishing a patch. Python 3, no dependencies."""
from pathlib import Path
import datetime,json,re,sys
root=Path(__file__).resolve().parent.parent
if len(sys.argv)!=2 or not re.fullmatch(r'\d+\.\d+\.\d+',sys.argv[1]):
    raise SystemExit('Usage: python tools/release.py 1.0.1')
version=sys.argv[1]
current=json.loads((root/'version.json').read_text())['version']
if tuple(map(int,version.split('.'))) <= tuple(map(int,current.split('.'))):
    raise SystemExit('Use a version greater than '+current)
for filename in ['sw.js','pwa.js','index.html']:
    p=root/filename
    text=p.read_text(encoding='utf-8')
    if filename=='sw.js':
        text=re.sub(r"const VERSION = '[^']+';",f"const VERSION = '{version}';",text)
    else:
        text=text.replace('PWA '+current,'PWA '+version)
    p.write_text(text,encoding='utf-8')
(root/'version.json').write_text(json.dumps({'version':version,'date':datetime.date.today().isoformat()},indent=2)+'\n')
print('Release '+version+' ready. Upload all changed files, including sw.js, pwa.js, index.html and version.json.')
