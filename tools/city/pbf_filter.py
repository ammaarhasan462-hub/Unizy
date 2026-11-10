#!/usr/bin/env python3
"""Keep only London's tall buildings (>= 45 m or >= 14 storeys) and the Thames from a GeoJSON-seq export."""
import gzip, json, re, sys


def num(v):
    m = re.match(r'^\s*(\d+(?:\.\d+)?)', str(v or ''))
    return float(m.group(1)) if m else 0.0


src, dst = sys.argv[1], sys.argv[2]
n = 0
with open(src) as f, gzip.open(dst, 'wt') as o:
    for line in f:
        line = line.strip().lstrip('\x1e')
        if not line:
            continue
        ft = json.loads(line)
        t = ft.get('properties', {})
        keep = (t.get('waterway') == 'river' and t.get('name') == 'River Thames') or t.get('water') == 'river'
        if ('building' in t or 'building:part' in t) and (num(t.get('height')) >= 45 or num(t.get('building:levels')) >= 14 or t.get('name') in ('BT Tower', 'The Shard', '30 St Mary Axe')):
            keep = True
        if keep:
            o.write(json.dumps(ft, separators=(',', ':')) + '\n')
            n += 1
print('kept', n)
