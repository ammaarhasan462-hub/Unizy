"""Write site/data/med-index.json: the medical packs in med2 format, for the clinical review workspace (/review).
Run after adding or updating packs: python3 coverage/build_med_index.py [site_dir]"""
import json, os, sys, glob
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
site = sys.argv[1] if len(sys.argv) > 1 else os.path.join(root, 'site')
UNI = {'ucl': 'UCL', 'imperial': 'Imperial', 'lse': 'LSE', 'oxford': 'Oxford', 'cambridge': 'Cambridge', 'qmul': 'Queen Mary'}
packs = []
for f in sorted(glob.glob(os.path.join(site, 'data', 'library', '*.json'))):
    d = json.load(open(f))
    if d.get('format') != 'med2':
        continue
    mod = d.get('module') or {}
    where = (UNI.get(mod.get('uni'), '') + (' ' + mod['code'] if mod.get('code') else '')).strip() or 'Shared UK medical schools pack'
    packs.append({'id': d['id'], 'title': d.get('title'), 'where': where, 'kind': d.get('kind'), 'reviewed': d.get('reviewed'), 'topics': d.get('topics', [])})
packs.sort(key=lambda p: (p['where'] == 'Shared UK medical schools pack', p['where'], p['title']))
json.dump({'packs': packs}, open(os.path.join(site, 'data', 'med-index.json'), 'w'), ensure_ascii=False, indent=1)
print(len(packs), 'med2 packs indexed')
