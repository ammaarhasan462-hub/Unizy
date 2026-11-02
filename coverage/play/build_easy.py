"""Merge the checked easy question files into site/data/play/easy.json (the word game's question pool)."""
import json, pathlib
here = pathlib.Path(__file__).parent
cats = ['geo', 'hist', 'sci', 'nature', 'food', 'sport', 'arts', 'words', 'space', 'uk']
out = []
for c in cats:
    for q in json.load(open(here / f'easy-{c}.json')):
        out.append({k: q[k] for k in ('id', 'cat', 'q', 'options', 'answer', 'fact')})
dest = here.parent.parent / 'site' / 'data' / 'play' / 'easy.json'
dest.write_text(json.dumps(out, ensure_ascii=False, separators=(',', ':')))
print(len(out), 'easy questions ->', dest, dest.stat().st_size // 1024, 'KB')
