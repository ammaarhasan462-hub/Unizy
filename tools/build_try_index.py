"""Builds site/data/try-index.json: the module packs shown in the home page's "Find your module" box.
Run from the repo root after adding or changing packs in site/data/library: python3 tools/build_try_index.py"""
import glob, json, os

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'site', 'data')
rows = []
for f in sorted(glob.glob(os.path.join(ROOT, 'library', 'M-*.json'))):
    d = json.load(open(f, encoding='utf-8'))
    m = d.get('module') or {}
    mcq = [q for q in d.get('questions', []) if q.get('type') == 'mcq' and isinstance(q.get('options'), list) and isinstance(q.get('answer'), int)]
    if len(d.get('cards', [])) < 4 or len(mcq) < 2:
        continue
    rows.append({'id': d['id'], 'u': m.get('uni'), 'c': m.get('code', ''), 'n': m.get('name') or d.get('title'), 'k': len(d['cards']), 'q': len(mcq)})
rows.sort(key=lambda r: (r['u'] or '', r['n'] or ''))
with open(os.path.join(ROOT, 'try-index.json'), 'w', encoding='utf-8') as out:
    json.dump(rows, out, ensure_ascii=False, separators=(',', ':'))
print(len(rows), 'module packs')
