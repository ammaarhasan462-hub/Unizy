#!/usr/bin/env python3
"""Keep only London's tall buildings (>= 45 m or >= 14 storeys), the Thames, the named bridges, the docks and basins, and the
piers and moorings from a GeoJSON-seq export."""
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
        # named bridge outlines: bake_city.py keeps the ones that cross the river
        if t.get('man_made') == 'bridge' and t.get('name') and ft.get('geometry', {}).get('type') in ('Polygon', 'MultiPolygon'):
            keep = True
        # the docks and basins beyond the detail maps (bake_city.py: outer_docks), as areas
        if ft.get('geometry', {}).get('type') in ('Polygon', 'MultiPolygon') and (
                t.get('water') in ('dock', 'harbour', 'marina') or t.get('waterway') == 'dock'
                or (t.get('leisure') == 'marina' and (t.get('natural') == 'water' or 'water' in t))
                or (t.get('water') == 'basin' and ('Basin' in t.get('name', '') or 'Dock' in t.get('name', '')))):
            keep = True
        # the river piers (Westminster, Embankment, Festival, Bankside, Tower...) and mapped moorings, for the boats
        if t.get('man_made') == 'pier' or 'mooring' in t:
            keep = True
        if ('building' in t or 'building:part' in t) and (num(t.get('height')) >= 45 or num(t.get('building:levels')) >= 14 or t.get('name') in ('BT Tower', 'The Shard', '30 St Mary Axe')):
            keep = True
        if keep:
            o.write(json.dumps(ft, separators=(',', ':')) + '\n')
            n += 1
print('kept', n)
