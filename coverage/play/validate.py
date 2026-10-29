"""Check an Unwind question file against SPEC.md's format rules."""
import json, sys, collections, re
CATS = {'geo', 'hist', 'sci', 'nature', 'food', 'sport', 'arts', 'words', 'space', 'uk'}
bad = 0
for path in sys.argv[1:]:
    try:
        data = json.load(open(path))
    except Exception as e:
        print(path, 'NOT VALID JSON:', e); bad += 1; continue
    if not isinstance(data, list):
        print(path, 'must be a list'); bad += 1; continue
    pos = collections.Counter(); diffs = collections.Counter(); seenq = set(); ids = set()
    for i, x in enumerate(data):
        where = f'{path}[{i}] {x.get("id") if isinstance(x, dict) else ""}'
        def err(m):
            global bad
            bad += 1; print(where, m)
        if not isinstance(x, dict): err('not an object'); continue
        for k in ('id', 'cat', 'q', 'options', 'answer', 'fact', 'diff'):
            if k not in x: err('missing ' + k)
        if x.get('cat') not in CATS: err('bad cat')
        if not re.fullmatch(r'[a-z]+-\d{3}', str(x.get('id', ''))): err('bad id')
        if x.get('id') in ids: err('duplicate id')
        ids.add(x.get('id'))
        q = str(x.get('q', ''))
        if len(q) > 140 or len(q) < 10: err(f'q length {len(q)}')
        if q.lower() in seenq: err('duplicate question')
        seenq.add(q.lower())
        o = x.get('options')
        if not isinstance(o, list) or len(o) != 4: err('need exactly 4 options')
        else:
            if len(set(s.strip().lower() for s in o)) != 4: err('duplicate options')
            for s in o:
                if not isinstance(s, str) or not s.strip() or len(s) > 60: err('bad option: ' + str(s)[:70])
                if re.search(r'all of the above|none of the above', str(s), re.I): err('no all/none of the above')
        a = x.get('answer')
        if not isinstance(a, int) or not 0 <= a <= 3: err('bad answer index')
        else: pos[a] += 1
        f = str(x.get('fact', ''))
        if len(f) > 170 or len(f) < 20: err(f'fact length {len(f)}')
        if x.get('diff') not in (1, 2, 3): err('bad diff')
        diffs[x.get('diff')] += 1
        if re.search(r'\b(AI|Claude|Anthropic)\b', q + ' ' + f + ' ' + ' '.join(map(str, o or []))): err('mentions AI/Claude')
    print(path, len(data), 'questions · answer positions', dict(sorted(pos.items())), '· difficulty', dict(sorted(diffs.items())))
print('OK' if not bad else f'{bad} problem(s)')
sys.exit(1 if bad else 0)
