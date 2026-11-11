"""Builds site/data/play/medium.json, the Unwind question bank (Nov 2026: 'a bit harder').

Every question comes from the fact-checked site/data/play/unwind.json. The very basic ones (capital of France,
largest planet...) and the most obscure ones are left out, so each question makes you think for a few seconds.
Run: python3 tools/build_unwind_bank.py
"""
import collections, json, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PICK = {
    'geo':    [1, 3, 4, 6, 7, 10, 11, 12, 13, 14, 15, 18, 19, 20, 21, 23, 24, 26, 27, 28, 29, 31, 33, 34, 35, 36, 37, 38, 39, 40],
    'hist':   [1, 3, 4, 6, 7, 8, 9, 10, 11, 12, 13, 14, 16, 17, 18, 19, 20, 22, 23, 25, 26, 27, 28, 30, 31, 32, 33, 35, 38, 40],
    'sci':    [1, 3, 4, 6, 9, 10, 11, 12, 13, 15, 16, 18, 19, 23, 26, 27, 28, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40],
    'nature': [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 13, 14, 16, 21, 22, 23, 24, 25, 27, 28, 29, 30, 32, 33, 34, 35, 36, 37, 38, 39],
    'food':   [3, 4, 5, 6, 7, 8, 9, 10, 12, 13, 14, 16, 17, 18, 20, 21, 22, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40],
    'sport':  [2, 3, 4, 5, 6, 11, 13, 14, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 32, 33, 34, 36, 37, 38, 39, 40],
    'arts':   [2, 4, 7, 8, 10, 11, 12, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 33, 34, 35, 36, 37, 38],
    'words':  [2, 3, 6, 7, 8, 10, 12, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 26, 27, 28, 29, 30, 32, 33, 34, 36, 37, 38, 39, 40],
    'space':  [4, 6, 10, 11, 12, 13, 16, 17, 18, 19, 20, 21, 22, 23, 24, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 38, 39],
    'uk':     [1, 2, 4, 5, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 33, 34, 36, 37, 38],
}
bank = {q['id']: q for q in json.load(open(os.path.join(ROOT, 'site/data/play/unwind.json')))}
out = [bank[f'{cat}-{n:03d}'] for cat, nums in PICK.items() for n in nums]
assert len({q['id'] for q in out}) == len(out)
for q in out: assert len(q['options']) == 4 and 0 <= q['answer'] < 4 and q.get('fact')
json.dump(out, open(os.path.join(ROOT, 'site/data/play/medium.json'), 'w'), ensure_ascii=False, indent=1)
print(len(out), 'questions', dict(collections.Counter(q['cat'] for q in out)))
