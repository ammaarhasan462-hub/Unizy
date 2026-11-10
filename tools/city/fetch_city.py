#!/usr/bin/env python3
"""Fetch the free source data for the intro cities (runs in GitHub Actions, which has network access).

- OpenStreetMap (ODbL, (c) OpenStreetMap contributors) via the Overpass API: every building footprint with its
  height / levels / material tags, streets, squares and parks, water, rail and mapped street trees around UCL's
  Portico and Imperial's Queen's Tower, plus London's tall buildings for the skyline.
- CC0 photo-scanned PBR textures from Poly Haven (brick, roofing, road, concrete, plaster, grass).

Writes raw files into tools/city/raw/; tools/city/bake_city.py turns them into the compact assets the intro loads.
Stdlib only.
"""
import gzip, json, math, os, sys, time, urllib.parse, urllib.request

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'raw')
os.makedirs(os.path.join(OUT, 'tex'), exist_ok=True)
UA = {'User-Agent': 'unizy-intro-builder/1.0 (+https://unizy.uk)'}
MIRRORS = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
    'https://overpass.private.coffee/api/interpreter',
    'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
]
log_lines = []


def log(*a):
    s = ' '.join(str(x) for x in a)
    print(s, flush=True)
    log_lines.append(s)


def bbox(lat, lon, r):
    dl = r / 111320.0
    dn = r / (111320.0 * math.cos(math.radians(lat)))
    return f'{lat - dl:.5f},{lon - dn:.5f},{lat + dl:.5f},{lon + dn:.5f}'


def overpass(q, name):
    body = urllib.parse.urlencode({'data': q}).encode()
    wait = 10
    for attempt in range(10):
        url = MIRRORS[attempt % len(MIRRORS)]
        try:
            req = urllib.request.Request(url, data=body, headers=UA)
            with urllib.request.urlopen(req, timeout=300) as r:
                raw = r.read()
            j = json.loads(raw)
            n = len(j.get('elements', []))
            if n == 0 and 'remark' in j:
                raise RuntimeError(j['remark'][:200])
            log(f'{name}: {n} elements from {url} ({len(raw) / 1e6:.1f} MB)')
            with gzip.open(os.path.join(OUT, f'{name}.json.gz'), 'wb') as f:
                f.write(raw)
            return True
        except Exception as e:  # noqa: BLE001
            log(f'{name}: attempt {attempt + 1} via {url} failed: {str(e)[:160]}')
            time.sleep(wait)
            wait = min(wait * 2, 120)
    return False


def area_query(lat, lon, r):
    b = bbox(lat, lon, r)
    return f"""[out:json][timeout:240];
(
  way["building"]({b}); relation["building"]({b});
  way["building:part"]({b}); relation["building:part"]({b});
  way["highway"]({b});
  way["area:highway"]({b});
  way["leisure"~"^(park|garden|pitch|playground|common)$"]({b}); relation["leisure"~"^(park|garden)$"]({b});
  way["landuse"~"^(grass|recreation_ground|railway|cemetery|village_green)$"]({b});
  way["natural"~"^(water|wood|scrub|grassland|tree_row)$"]({b}); relation["natural"="water"]({b});
  way["water"]({b});
  way["amenity"~"^(parking|fountain)$"]({b});
  node["natural"="tree"]({b});
  way["railway"~"^(rail|subway|light_rail)$"]({b});
  way["barrier"~"^(fence|wall|hedge)$"]({b});
  nwr["man_made"~"^(tower|bridge)$"]({b});
);
out tags geom qt;"""


SITES = {
    # centre used only for the download box; bake_city.py finds the exact anchors (Portico / Queen's Tower) in the data
    'ucl': (51.5246, -0.1339, 1900),
    'imperial': (51.4982, -0.1768, 1900),
}

ok = True
only = sys.argv[1:]
for name, (lat, lon, r) in SITES.items():
    if only and name not in only:
        continue
    ok &= overpass(area_query(lat, lon, r), name)

if not only or 'skyline' in only:
    # London's tall buildings (for the horizon): Westminster, the City, Canary Wharf, Battersea, Vauxhall
    b = '51.4600,-0.2500,51.5650,0.0300'
    q = f"""[out:json][timeout:240];
(
  way["building"](if: number(t["height"]) >= 45 || number(t["building:levels"]) >= 14)({b});
  relation["building"](if: number(t["height"]) >= 45 || number(t["building:levels"]) >= 14)({b});
  way["building:part"](if: number(t["height"]) >= 45 || number(t["building:levels"]) >= 14)({b});
  relation["building:part"](if: number(t["height"]) >= 45)({b});
  way["waterway"="riverbank"]({b}); relation["water"="river"]({b}); way["water"="river"]({b});
  way["waterway"="river"]({b});
);
out tags geom qt;"""
    ok &= overpass(q, 'skyline')

# ------------------------------------------------------------------ CC0 textures (Poly Haven)
if not only or 'tex' in only:
    want = {'brick': 4, 'roofing': 2, 'road': 2, 'concrete': 2, 'plaster-concrete': 2, 'grass': 2, 'cobblestone': 1, 'stone': 2}
    picked = {}
    for cat, n in want.items():
        try:
            req = urllib.request.Request(f'https://api.polyhaven.com/assets?type=textures&categories={cat}', headers=UA)
            assets = json.loads(urllib.request.urlopen(req, timeout=60).read())
            top = sorted(assets.items(), key=lambda kv: -kv[1].get('download_count', 0))[:n]
            for aid, meta in top:
                req = urllib.request.Request(f'https://api.polyhaven.com/files/{aid}', headers=UA)
                files = json.loads(urllib.request.urlopen(req, timeout=60).read())
                got = {}
                for mp, key in (('Diffuse', 'diff'), ('nor_gl', 'nor'), ('Rough', 'rough'), ('AO', 'ao')):
                    try:
                        u = files[mp]['1k']['jpg']['url']
                    except KeyError:
                        continue
                    fn = f'{aid}_{key}_1k.jpg'
                    data = urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=120).read()
                    with open(os.path.join(OUT, 'tex', fn), 'wb') as f:
                        f.write(data)
                    got[key] = fn
                dims = meta.get('dimensions')
                picked[aid] = {'cat': cat, 'name': meta.get('name'), 'dims_mm': dims, 'files': got, 'tags': meta.get('tags', [])[:12]}
                log(f'tex {cat}: {aid} {meta.get("name")} dims={dims} maps={list(got)}')
        except Exception as e:  # noqa: BLE001
            log(f'tex {cat} failed: {str(e)[:160]}')
            ok = False
    with open(os.path.join(OUT, 'tex', 'index.json'), 'w') as f:
        json.dump(picked, f, indent=1)

with open(os.path.join(OUT, 'fetch.log'), 'w') as f:
    f.write('\n'.join(log_lines) + f'\nok: {ok}\n')
sys.exit(0)
