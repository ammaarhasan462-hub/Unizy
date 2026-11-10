#!/usr/bin/env python3
"""Bake the raw OpenStreetMap downloads (tools/city/raw/*.json.gz) into the compact city files the intro loads
(site/assets/city/<site>.json).

Frame: metres, +x = "north" along the campus axis, +z = "east", y up, matching ucl.js / imperial.js:
  ucl       origin at the Portico, Gower Street turned onto the +x axis and centred at z = 115
  imperial  origin at the Queen's Tower, true north = +x

Coordinates are written as integer decimetres. Map data (c) OpenStreetMap contributors, ODbL.
"""
import gzip, json, math, os, re, sys, zlib

HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(HERE, 'raw')
OUT = os.path.join(HERE, '..', '..', 'site', 'assets', 'city')
os.makedirs(OUT, exist_ok=True)
R_EARTH = 6378137.0
DETAIL = 1500.0  # matches MAP_HALF in web/components/intro/shaders.js

# per site: download centre (also the fallback origin), the named building the origin sits on, and the rectangles
# (x0, x1, z0, z1 in the site frame) left clear for the hand-built campus model
SITES = {
    'ucl': {'centre': (51.5246, -0.1339)},  # frame from Gower Street and the Wilkins Building, see bake()
    'imperial': {'centre': (51.49825, -0.17676), 'anchor': ["Queen's Tower"], 'keep_out': [(-26, 210, -183, 199)]},
    # Queen Mary (Mile End) and LSE (Aldwych): origins on the Queens' Building and the Old Building. Add keep_out
    # rectangles once their hand-built campus models exist.
    'qmul': {'centre': (51.52395, -0.04018), 'anchor': ["Queens' Building", 'Queens Building'], 'keep_out': []},
    'lse': {'centre': (51.51432, -0.11655), 'anchor': ['Old Building'], 'keep_out': []},
}


def load(name):
    """Overpass JSON (fetch_city.py) or osmium GeoJSON-seq (fetch-city-pbf.yml), as Overpass-style elements."""
    p = os.path.join(RAW, f'{name}.json.gz')
    if os.path.exists(p):
        with gzip.open(p) as f:
            return json.load(f)['elements']
    p = os.path.join(RAW, f'{name}.geojsonseq.gz')
    if not os.path.exists(p):
        raise FileNotFoundError(p)
    els = []
    g = lambda ring: [{'lat': c[1], 'lon': c[0]} for c in ring]
    with gzip.open(p, 'rt') as f:
        for line in f:
            line = line.strip().lstrip('\x1e')
            if not line:
                continue
            ft = json.loads(line)
            t = {k: v for k, v in ft.get('properties', {}).items() if not k.startswith('@')}
            pid = ft.get('properties', {}).get('@id') or ft.get('id')
            src = ft.get('properties', {}).get('@type', 'way')
            geo = ft.get('geometry') or {}
            typ, co = geo.get('type'), geo.get('coordinates')
            eid = int(re.sub(r'\D', '', str(pid)) or 0) + (0 if src == 'way' else 10 ** 12)
            if typ == 'LineString' and co and co[0] == co[-1] and any(k in t for k in ('building', 'building:part', 'landuse', 'leisure', 'natural', 'amenity', 'water')) and 'highway' not in t and 'barrier' not in t:
                continue  # the polygon export of the same closed way carries it
            if typ == 'Point':
                els.append({'type': 'node', 'id': eid, 'lat': co[1], 'lon': co[0], 'tags': t})
            elif typ == 'LineString':
                els.append({'type': 'way', 'id': eid, 'geometry': g(co), 'tags': t})
            elif typ in ('Polygon', 'MultiPolygon'):
                polys = [co] if typ == 'Polygon' else co
                if src == 'way' and len(polys) == 1 and len(polys[0]) == 1:
                    els.append({'type': 'way', 'id': eid, 'geometry': g(polys[0][0]), 'tags': t})
                else:
                    mem = []
                    for poly in polys:
                        mem.append({'type': 'way', 'role': 'outer', 'geometry': g(poly[0])})
                        mem += [{'type': 'way', 'role': 'inner', 'geometry': g(h)} for h in poly[1:]]
                    els.append({'type': 'relation', 'id': eid, 'members': mem, 'tags': t})
    return els


def num(v):
    if v is None:
        return None
    m = re.match(r'^\s*(-?\d+(?:\.\d+)?)\s*(m|ft|\')?', str(v).replace(',', '.'))
    if not m:
        return None
    x = float(m.group(1))
    if m.group(2) in ('ft', "'"):
        x *= 0.3048
    return x


def h32(s):
    return zlib.crc32(str(s).encode()) / 4294967296.0


class Frame:
    def __init__(self, lat0, lon0, rot=0.0, dx=0.0, dz=0.0):
        self.lat0, self.lon0, self.rot, self.dx, self.dz = lat0, lon0, rot, dx, dz
        self.kx = math.cos(math.radians(lat0)) * math.pi / 180 * R_EARTH
        self.ky = math.pi / 180 * R_EARTH

    def enu(self, lat, lon):
        return ((lon - self.lon0) * self.kx, (lat - self.lat0) * self.ky)

    def __call__(self, lat, lon):
        e, n = self.enu(lat, lon)
        c, s = math.cos(self.rot), math.sin(self.rot)
        # axis d = (sin rot, cos rot) in (E, N) becomes +x; its clockwise normal becomes +z
        x = e * s + n * c
        z = e * c - n * s
        return (x - self.dx, z - self.dz)


def ring_pts(geom, fr):
    return [fr(p['lat'], p['lon']) for p in geom if p]


def area(r):
    a = 0.0
    for i in range(len(r)):
        x0, z0 = r[i]
        x1, z1 = r[(i + 1) % len(r)]
        a += x0 * z1 - x1 * z0
    return a / 2


def centroid(r):
    xs = [p[0] for p in r]
    zs = [p[1] for p in r]
    return (sum(xs) / len(xs), sum(zs) / len(zs))


def dp(pts, eps):
    if len(pts) < 3:
        return pts
    (x0, z0), (x1, z1) = pts[0], pts[-1]
    dx, dz = x1 - x0, z1 - z0
    L = math.hypot(dx, dz) or 1e-9
    best, bi = 0.0, 0
    for i in range(1, len(pts) - 1):
        d = abs((pts[i][0] - x0) * dz - (pts[i][1] - z0) * dx) / L
        if d > best:
            best, bi = d, i
    if best > eps:
        return dp(pts[:bi + 1], eps)[:-1] + dp(pts[bi:], eps)
    return [pts[0], pts[-1]]


def clean_ring(r, eps=0.25):
    if len(r) > 1 and r[0] == r[-1]:
        r = r[:-1]
    if len(r) < 3:
        return None
    # simplify as a closed ring: split at the farthest point from the first
    far = max(range(len(r)), key=lambda i: (r[i][0] - r[0][0]) ** 2 + (r[i][1] - r[0][1]) ** 2)
    a = dp(r[:far + 1], eps)
    b = dp(r[far:] + [r[0]], eps)
    out = a[:-1] + b[:-1]
    if len(out) < 3 or abs(area(out)) < 4:
        return None
    return out


def q(v):
    return int(round(v * 10))


def flat(r):
    o = []
    for x, z in r:
        o += [q(x), q(z)]
    return o


def pip(x, z, r):
    ins = False
    j = len(r) - 1
    for i in range(len(r)):
        xi, zi = r[i]
        xj, zj = r[j]
        if (zi > z) != (zj > z) and x < (xj - xi) * (z - zi) / (zj - zi + 1e-12) + xi:
            ins = not ins
        j = i
    return ins


def rings_of(el, fr):
    """[(outer, [inners])] for a way or multipolygon relation"""
    if el['type'] == 'way':
        g = el.get('geometry')
        return [(ring_pts(g, fr), [])] if g else []
    outers, inners = [], []
    # stitch member ways into rings
    for role in ('outer', 'inner'):
        segs = [ring_pts(m['geometry'], fr) for m in el.get('members', []) if m.get('type') == 'way' and m.get('role', 'outer') in ((role,) if role == 'inner' else ('outer', '')) and m.get('geometry')]
        rings = []
        while segs:
            cur = segs.pop(0)
            changed = True
            while cur[0] != cur[-1] and changed:
                changed = False
                for i, s in enumerate(segs):
                    if s[0] == cur[-1]:
                        cur += s[1:]
                    elif s[-1] == cur[-1]:
                        cur += s[::-1][1:]
                    elif s[-1] == cur[0]:
                        cur = s + cur[1:]
                    elif s[0] == cur[0]:
                        cur = s[::-1] + cur[1:]
                    else:
                        continue
                    segs.pop(i)
                    changed = True
                    break
            rings.append(cur)
        (outers if role == 'outer' else inners).extend(rings)
    res = []
    for o in outers:
        hs = [i for i in inners if len(i) > 2 and pip(*i[0], o)]
        res.append((o, hs))
    return res


COL = {'white': '#eeeae2', 'grey': '#8d8d8a', 'gray': '#8d8d8a', 'red': '#8e4a3a', 'brown': '#7b5a44', 'yellow': '#c9b07a', 'beige': '#d3c4a3',
       'black': '#2d2e30', 'cream': '#e6dcc3', 'silver': '#a9aeb2', 'blue': '#6d7f92', 'green': '#5d7462', 'tan': '#c4a77f', 'orange': '#b46e3e',
       'darkgrey': '#5c5d5f', 'lightgrey': '#b9b8b3', 'pink': '#c99a8f'}


def colour(v):
    if not v:
        return None
    v = v.strip().lower().replace(' ', '')
    if re.match(r'^#[0-9a-f]{6}$', v):
        return v
    if re.match(r'^#[0-9a-f]{3}$', v):
        return '#' + ''.join(c * 2 for c in v[1:])
    return COL.get(v)


# facade styles (index into STYLES in web/components/intro/city.js)
STY = {'stock': 0, 'stucco': 1, 'stone': 2, 'glass': 3, 'redbrick': 4, 'concrete': 5, 'church': 6, 'shed': 7}


def classify(t, hgt, a, site, seed):
    b = t.get('building', t.get('building:part', 'yes'))
    mat = (t.get('building:material') or t.get('building:facade:material') or t.get('facade:material') or '').lower()
    am = t.get('amenity', '')
    if b in ('church', 'cathedral', 'chapel') or am == 'place_of_worship':
        return 'church'
    if b in ('shed', 'garage', 'garages', 'hut', 'kiosk', 'roof', 'carport', 'service', 'container', 'cabin', 'greenhouse', 'toilets', 'bunker') or (a < 30 and hgt < 6):
        return 'shed'
    if 'glass' in mat:
        return 'glass'
    if 'concrete' in mat:
        return 'concrete'
    if 'stone' in mat:
        return 'stone'
    if 'plaster' in mat or 'stucco' in mat or 'render' in mat:
        return 'stucco'
    if 'brick' in mat:
        return 'redbrick' if (site == 'imperial' or seed < 0.3) else 'stock'
    big = a > 1800 or hgt > 30
    if b in ('office', 'commercial', 'retail', 'hotel', 'hospital', 'university', 'college', 'school', 'public', 'civic', 'government', 'train_station', 'transportation', 'industrial', 'warehouse'):
        if hgt > 34 or seed < 0.35:
            return 'glass'
        if b in ('university', 'college', 'public', 'civic', 'government', 'hospital', 'train_station') and seed < 0.7:
            return 'stone' if site == 'ucl' or seed < 0.55 else 'redbrick'
        return 'concrete' if seed < 0.85 else 'stone'
    if b in ('terrace', 'house', 'semidetached_house', 'detached'):
        if site == 'imperial':
            return 'stucco' if seed < 0.62 else 'redbrick'
        return 'stock' if seed < 0.8 else 'stucco'
    if b in ('apartments', 'residential', 'dormitory', 'flats'):
        if hgt > 32:
            return 'concrete' if seed < 0.6 else 'glass'
        if site == 'imperial':
            return 'redbrick' if seed < 0.5 else ('stucco' if seed < 0.85 else 'stock')
        return 'stock' if seed < 0.55 else ('redbrick' if seed < 0.75 else 'concrete')
    # building=yes: infer from size
    if big:
        return 'glass' if seed < 0.3 else ('stone' if seed < 0.6 else 'concrete')
    if site == 'imperial':
        return 'stucco' if seed < 0.45 else ('redbrick' if seed < 0.8 else 'stock')
    return 'stock' if seed < 0.62 else ('stucco' if seed < 0.78 else ('stone' if seed < 0.9 else 'redbrick'))


def height_of(t, a, site, seed):
    h = num(t.get('height')) or num(t.get('building:height'))
    lv = num(t.get('building:levels'))
    rl = num(t.get('roof:levels')) or 0
    minh = num(t.get('min_height')) or (num(t.get('building:min_level')) or 0) * 3.3
    src = 'h'
    if not h:
        if lv:
            h = lv * 3.3 + rl * 2.4 + 0.8
            src = 'lv'
        else:
            b = t.get('building', t.get('building:part', 'yes'))
            base = {'terrace': 15, 'house': 12, 'semidetached_house': 10, 'detached': 10, 'apartments': 18, 'residential': 17, 'university': 21,
                    'college': 18, 'school': 13, 'office': 24, 'commercial': 20, 'retail': 12, 'hotel': 24, 'hospital': 26, 'church': 18,
                    'shed': 3, 'garage': 3.2, 'garages': 3.2, 'hut': 3, 'kiosk': 3, 'roof': 5, 'industrial': 9, 'warehouse': 10, 'train_station': 16,
                    'public': 18, 'civic': 16, 'dormitory': 20}.get(b, None)
            if base is None:
                base = 6 if a < 40 else 11 if a < 120 else 15 if a < 700 else 19
            h = base * (0.85 + 0.3 * seed)
            src = 'guess'
    return max(h, minh + 2.5), minh, src


def bake(site):
    els = load(site)
    # ------------------------------------------------------------------ anchors / frame
    tmp = Frame(*SITES[site]['centre'])
    named = {}
    for el in els:
        n = el.get('tags', {}).get('name')
        if n:
            named.setdefault(n, []).append(el)

    def el_pts(el, fr):
        if el['type'] == 'node':
            return [fr(el['lat'], el['lon'])]
        if el.get('geometry'):
            return ring_pts(el['geometry'], fr)
        if el.get('bounds'):
            b = el['bounds']
            return [fr((b['minlat'] + b['maxlat']) / 2, (b['minlon'] + b['maxlon']) / 2)]
        pts = []
        for m in el.get('members', []):
            if m.get('geometry'):
                pts += ring_pts(m['geometry'], fr)
        return pts

    info = {}
    if site == 'ucl':
        g = [p for el in named.get('Gower Street', []) if el['type'] == 'way' and 'highway' in el.get('tags', {}) for p in el_pts(el, tmp.enu)]
        # Gower Street runs NNW-SSE; principal axis by PCA
        mx = sum(p[0] for p in g) / len(g)
        my = sum(p[1] for p in g) / len(g)
        sxx = sum((p[0] - mx) ** 2 for p in g)
        syy = sum((p[1] - my) ** 2 for p in g)
        sxy = sum((p[0] - mx) * (p[1] - my) for p in g)
        ang = 0.5 * math.atan2(2 * sxy, sxx - syy)  # angle of the axis from +E
        de, dn = math.cos(ang), math.sin(ang)
        if dn < 0:
            de, dn = -de, -dn
        rot = math.atan2(de, dn)  # bearing of the axis from north (negative = west of north)
        wil = [el for k in ('Wilkins Building', 'UCL Wilkins Building') for el in named.get(k, []) if 'building' in el.get('tags', {})]
        fr0 = Frame(tmp.lat0, tmp.lon0, rot)
        gz = sum(fr0(p['lat'], p['lon'])[1] for el in named['Gower Street'] if el['type'] == 'way' and el.get('geometry') for p in el['geometry']) / max(1, sum(len(el.get('geometry', [])) for el in named['Gower Street'] if el['type'] == 'way'))
        if wil:
            wp = el_pts(wil[0], fr0)
            wx = (min(p[0] for p in wp) + max(p[0] for p in wp)) / 2
            wzmin = min(p[1] for p in wp)
            info['wilkins'] = {'x': [round(min(p[0] for p in wp), 1), round(max(p[0] for p in wp), 1)], 'z': [round(wzmin, 1), round(max(p[1] for p in wp), 1)]}
        else:
            wx = fr0(51.52467, -0.13395)[0]
        fr = Frame(tmp.lat0, tmp.lon0, rot, wx, gz - 115.0)
        info.update({'rot_deg': round(math.degrees(rot), 2), 'gower_z_raw': round(gz, 1), 'portico_x_raw': round(wx, 1)})
        # the hand-built Wilkins Building and Main Quad (ucl.js), and the low frontage across Gower Street
        keep_out = [(-22, 22, -66, 114), (-67, 67, -28, 114), (-95, 95, 114, 250)]
    else:
        # origin on the anchor building (Queen's Tower, Queens' Building, ...), true north = +x
        cfg = SITES[site]
        qt = [el for n in cfg['anchor'] for el in named.get(n, [])]
        pts = el_pts(qt[0], tmp.enu) if qt else []
        if pts:
            e = sum(p[0] for p in pts) / len(pts)
            n = sum(p[1] for p in pts) / len(pts)
            lat0 = tmp.lat0 + n / tmp.ky
            lon0 = tmp.lon0 + e / tmp.kx
        else:
            lat0, lon0 = cfg['centre']
        fr = Frame(lat0, lon0, 0.0)
        info['anchor'] = [cfg['anchor'][0], round(lat0, 6), round(lon0, 6), bool(pts)]
        keep_out = cfg['keep_out']
    for nm in ('Gower Street', 'Gordon Square', 'Russell Square', 'Senate House', 'British Museum', 'Euston Road', 'Tottenham Court Road',
               'Exhibition Road', "Queen's Gate", 'Prince Consort Road', 'Imperial College Road', 'Cromwell Road', 'Kensington Gore', 'Royal Albert Hall', 'Natural History Museum', 'Science Museum'):
        ps = [p for el in named.get(nm, []) for p in el_pts(el, fr)]
        if ps:
            info.setdefault('places', {})[nm] = {'x': [round(min(p[0] for p in ps)), round(max(p[0] for p in ps))], 'z': [round(min(p[1] for p in ps)), round(max(p[1] for p in ps))]}

    def kept_out(x, z, m=0):
        return any(a - m < x < b + m and c - m < z < d + m for a, b, c, d in keep_out)

    # ------------------------------------------------------------------ buildings
    parts, blds = [], []
    landmarks = {}
    for el in els:
        t = el.get('tags', {})
        isb = 'building' in t and t.get('building') not in ('no', 'construction', 'demolished')
        isp = 'building:part' in t and t.get('building:part') not in ('no',)
        if not (isb or isp) or t.get('location') == 'underground' or t.get('layer', '0').startswith('-'):
            continue
        nm = t.get('name', '')
        if nm in ('BT Tower', 'The Shard', '30 St Mary Axe', "Queen's Tower"):
            ps = el_pts(el, fr)
            if ps:
                landmarks[nm] = [round(sum(p[0] for p in ps) / len(ps), 1), round(sum(p[1] for p in ps) / len(ps), 1)]
            continue
        for outer, inners in rings_of(el, fr):
            o = clean_ring(outer)
            if not o:
                continue
            cx, cz = centroid(o)
            if max(abs(cx), abs(cz)) > DETAIL + 60 or kept_out(cx, cz):
                continue
            if area(o) < 0:
                o = o[::-1]
            hs = []
            for hr in inners:
                c = clean_ring(hr)
                if c:
                    hs.append(c[::-1] if area(c) > 0 else c)
            rec = {'t': t, 'o': o, 'h': hs, 'c': (cx, cz), 'a': abs(area(o)), 'id': el['id'], 'part': isp and not isb}
            (parts if rec['part'] else blds).append(rec)
    # outlines that have parts are drawn by their parts (Simple 3D Buildings)
    grid = {}
    for i, b in enumerate(blds):
        xs = [p[0] for p in b['o']]
        zs = [p[1] for p in b['o']]
        b['bb'] = (min(xs), max(xs), min(zs), max(zs))
        for gx in range(int(b['bb'][0] // 50), int(b['bb'][1] // 50) + 1):
            for gz in range(int(b['bb'][2] // 50), int(b['bb'][3] // 50) + 1):
                grid.setdefault((gx, gz), []).append(i)
    has_parts = set()
    for p in parts:
        cx, cz = p['c']
        for i in grid.get((int(cx // 50), int(cz // 50)), []):
            b = blds[i]
            if b['bb'][0] <= cx <= b['bb'][1] and b['bb'][2] <= cz <= b['bb'][3] and pip(cx, cz, b['o']):
                has_parts.add(i)
                p['parent'] = b['t']
                break
    out_b = []
    stats = {'h': 0, 'lv': 0, 'guess': 0}
    style_n = {}
    for i, b in enumerate(blds + parts):
        if i < len(blds) and i in has_parts:
            continue
        t = dict(b.get('parent', {}), **b['t']) if b['part'] else b['t']
        seed = h32(b['id'])
        hgt, minh, src = height_of(t, b['a'], site, seed)
        stats[src] += 1
        st = classify(t, hgt, b['a'], site, h32(str(b['id']) + 's'))
        style_n[st] = style_n.get(st, 0) + 1
        roof = (t.get('roof:shape') or '').lower()
        rs = {'gabled': 1, 'hipped': 2, 'pyramidal': 3, 'dome': 4, 'onion': 4, 'mansard': 2, 'skillion': 0, 'flat': 0}.get(roof, 0)
        rh = num(t.get('roof:height')) or 0
        if not rh and rs:
            rh = min(6, 0.35 * math.sqrt(b['a']))
        if rs and hgt - rh < minh + 2:
            rh = max(0, hgt - minh - 2)
        out_b.append([STY[st], round(hgt, 1), round(minh, 1), rs, round(rh, 1), colour(t.get('building:colour')) or '', colour(t.get('roof:colour')) or '',
                      flat(b['o'])] + ([flat(hr) for hr in b['h']] if b['h'] else []))

    # ------------------------------------------------------------------ streets
    W = {'motorway': 22, 'trunk': 20, 'primary': 17, 'secondary': 15, 'tertiary': 12, 'unclassified': 9, 'residential': 9, 'living_street': 7,
         'service': 5, 'pedestrian': 7, 'footway': 2.6, 'path': 2.2, 'cycleway': 2.4, 'steps': 2.5, 'bridleway': 2.5, 'track': 3}
    for k in list(W):
        if k in ('motorway', 'trunk', 'primary', 'secondary', 'tertiary'):
            W[k + '_link'] = W[k] * 0.7
    CLS = {'motorway': 0, 'trunk': 0, 'primary': 0, 'secondary': 1, 'tertiary': 1, 'unclassified': 2, 'residential': 2, 'living_street': 2,
           'service': 3, 'pedestrian': 4, 'footway': 5, 'path': 5, 'cycleway': 5, 'steps': 5, 'bridleway': 5, 'track': 5}
    roads, areas, rails, trees = [], [], [], []
    lim = DETAIL + 200

    def clip_line(pts):
        out, cur = [], []
        for p in pts:
            if max(abs(p[0]), abs(p[1])) <= lim:
                cur.append(p)
            else:
                if len(cur) > 1:
                    out.append(cur)
                cur = []
        if len(cur) > 1:
            out.append(cur)
        return out

    AREA = [('water', lambda t: t.get('natural') == 'water' or 'water' in t or t.get('amenity') == 'fountain'),
            ('park', lambda t: t.get('leisure') in ('park', 'garden', 'common') or t.get('landuse') in ('grass', 'recreation_ground', 'village_green', 'cemetery') or t.get('natural') == 'grassland'),
            ('pitch', lambda t: t.get('leisure') in ('pitch', 'playground')),
            ('wood', lambda t: t.get('natural') in ('wood', 'scrub')),
            ('parking', lambda t: t.get('amenity') == 'parking'),
            ('rail', lambda t: t.get('landuse') == 'railway'),
            ('plaza', lambda t: t.get('area') == 'yes' and t.get('highway') in ('pedestrian', 'footway', 'service') or 'area:highway' in t)]
    ACODE = {k: i for i, (k, _) in enumerate(AREA)}
    for el in els:
        t = el.get('tags', {})
        if 'building' in t or 'building:part' in t:
            continue
        if el['type'] == 'node':
            if t.get('natural') == 'tree':
                x, z = fr(el['lat'], el['lon'])
                if max(abs(x), abs(z)) < DETAIL and not kept_out(x, z, 2):
                    hh = num(t.get('height'))
                    trees += [q(x), q(z), int(round((hh or 0) * 10))]
            continue
        kind = None
        for k, f in AREA:
            if f(t):
                kind = k
                break
        closed = el['type'] == 'way' and el.get('geometry') and el['geometry'][0] == el['geometry'][-1]
        if kind and (el['type'] == 'relation' or closed):
            for outer, inners in rings_of(el, fr):
                o = clean_ring(outer, 0.4)
                if not o:
                    continue
                cx, cz = centroid(o)
                if max(abs(cx), abs(cz)) > DETAIL + 400:
                    continue
                areas.append([ACODE[kind], flat(o)] + [flat(c) for c in (clean_ring(h, 0.4) for h in inners) if c])
            continue
        if el['type'] != 'way' or not el.get('geometry'):
            continue
        hw = t.get('highway')
        if hw in W and t.get('tunnel') not in ('yes', 'building_passage') and t.get('layer', '0')[:1] != '-' and t.get('area') != 'yes':
            w = num(t.get('width')) or W[hw]
            if hw in ('primary', 'secondary', 'trunk') and t.get('oneway') == 'yes':
                w *= 0.65
            for seg in clip_line(ring_pts(el['geometry'], fr)):
                seg = dp(seg, 0.3)
                roads.append([CLS.get(hw.replace('_link', ''), 2), round(w, 1), 1 if t.get('bridge') == 'yes' else 0, flat(seg)])
        elif t.get('railway') in ('rail', 'subway', 'light_rail') and t.get('tunnel') != 'yes' and t.get('layer', '0')[:1] != '-':
            for seg in clip_line(ring_pts(el['geometry'], fr)):
                rails.append(flat(dp(seg, 0.5)))
        elif t.get('natural') == 'tree_row':
            pts = ring_pts(el['geometry'], fr)
            for a, b in zip(pts, pts[1:]):
                L = math.hypot(b[0] - a[0], b[1] - a[1])
                for s in range(int(L // 9) + 1):
                    u = s * 9 / max(L, 1e-6)
                    x, z = a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u
                    if max(abs(x), abs(z)) < DETAIL and not kept_out(x, z, 2):
                        trees += [q(x), q(z), 0]
        elif t.get('barrier') in ('hedge',) and False:
            pass

    # ------------------------------------------------------------------ skyline (tall buildings beyond the detail map)
    sky = []
    try:
        sk = load('skyline')
    except FileNotFoundError:
        sk = []
    river = []
    seen = set()
    for el in sk:
        t = el.get('tags', {})
        if t.get('waterway') == 'river' and el['type'] == 'way' and t.get('name') == 'River Thames':
            river.append(flat(dp(ring_pts(el['geometry'], fr), 4)))
            continue
        if 'building' not in t and 'building:part' not in t:
            continue
        nm = t.get('name', '')
        if nm in ('BT Tower', 'The Shard', '30 St Mary Axe'):
            ps = el_pts(el, fr)
            if ps and nm not in landmarks:
                landmarks[nm] = [round(sum(p[0] for p in ps) / len(ps), 1), round(sum(p[1] for p in ps) / len(ps), 1)]
            continue
        for outer, _ in rings_of(el, fr):
            o = clean_ring(outer, 1.0)
            if not o:
                continue
            cx, cz = centroid(o)
            if max(abs(cx), abs(cz)) < DETAIL + 40:
                continue
            key = (round(cx), round(cz))
            if key in seen:
                continue
            seen.add(key)
            hgt, minh, _ = height_of(t, abs(area(o)), site, h32(el['id']))
            if area(o) < 0:
                o = o[::-1]
            sky.append([round(hgt, 1), round(minh, 1), colour(t.get('building:colour')) or '', flat(o)])

    data = {
        'v': 1, 'site': site, 'attribution': '© OpenStreetMap contributors', 'licence': 'ODbL',
        'frame': {'lat0': fr.lat0, 'lon0': fr.lon0, 'rot': fr.rot, 'dx': fr.dx, 'dz': fr.dz},
        'landmarks': landmarks, 'b': out_b, 'r': roads, 'a': areas, 'rl': rails, 't': trees, 'sky': sky, 'river': river,
    }
    p = os.path.join(OUT, f'{site}.json')
    with open(p, 'w') as f:
        json.dump(data, f, separators=(',', ':'))
    rep = {'site': site, 'buildings': len(out_b), 'heights': stats, 'styles': style_n, 'roads': len(roads), 'areas': len(areas), 'rails': len(rails),
           'trees': len(trees) // 3, 'skyline': len(sky), 'landmarks': landmarks, 'bytes': os.path.getsize(p), **info}
    print(json.dumps(rep, indent=1))
    return rep


# CC0 Poly Haven textures used for each wall family and the roofs (size = metres the texture spans)
TEX = {'brick': ('red_brick', 1.4), 'plaster': ('painted_plaster_wall', 2.0), 'stone': ('sandstone_blocks_05', 3.0),
       'concrete': ('concrete_layers_02', 2.0), 'roof': ('roof_slates_03', 3.0)}


def textures():
    d = os.path.join(OUT, 'tex')
    os.makedirs(d, exist_ok=True)
    idx = {}
    for fam, (aid, size) in TEX.items():
        e = {'size': size, 'src': f'Poly Haven {aid} (CC0)'}
        for key in ('diff', 'nor'):
            fn = f'{aid}_{key}_1k.jpg'
            if os.path.exists(os.path.join(RAW, 'tex', fn)):
                from PIL import Image
                out = fn.replace('_1k.jpg', '_512.jpg')
                Image.open(os.path.join(RAW, 'tex', fn)).convert('RGB').resize((512, 512), Image.LANCZOS).save(os.path.join(d, out), quality=84, optimize=True, progressive=True)
                e[key] = out
        if 'diff' in e:
            idx[fam] = e
    with open(os.path.join(d, 'index.json'), 'w') as f:
        json.dump(idx, f, indent=1)
    print('textures', list(idx))


if __name__ == '__main__':
    for s in (sys.argv[1:] or [k for k in SITES if os.path.exists(os.path.join(RAW, f'{k}.geojsonseq.gz')) or os.path.exists(os.path.join(RAW, f'{k}.json.gz'))]):
        bake(s)
    textures()
