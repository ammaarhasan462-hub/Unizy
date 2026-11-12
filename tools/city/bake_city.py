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
            els = json.load(f)['elements']
        # the Overpass snapshot has no shop nodes: take those from the monthly extract
        if os.path.exists(os.path.join(RAW, f'{name}.geojsonseq.gz')):
            have = {(round(e['lat'], 6), round(e['lon'], 6)) for e in els if e['type'] == 'node'}
            for e in load_seq(name):
                if e['type'] == 'node' and shop_kind(e['tags']) is not None and (round(e['lat'], 6), round(e['lon'], 6)) not in have:
                    els.append(e)
        return els
    return load_seq(name)


def load_seq(name):
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


# ------------------------------------------------------------------ facade eras (ERA in web/components/intro/city.js)
# 0 as classified, 1 Georgian and Regency terraces (stock brick or stucco over a rusticated stucco ground floor, black
# railings, six-over-six sashes), 2 Victorian (red or stock brick with stone dressings and bay windows), 3 inter-war and
# Edwardian Portland stone, 4 post-war concrete (ribbon windows, board-marked spandrels)
ARCH_ERA = [(('georgian', 'regency', 'palladian', 'classicism', 'neoclassicism', 'neoclassical', 'greek_revival', 'italianate'), 1),
            (('victorian', 'gothic', 'neo-gothic', 'gothic revival', 'gothic_revival', 'queen_anne', 'arts_and_crafts', 'tudor', 'romanesque', 'byzantine', 'flemish'), 2),
            (('edwardian', 'baroque', 'art_deco', 'art deco', 'beaux-arts', 'beaux_arts', 'stripped_classicism', 'neo-baroque', 'interwar'), 3),
            (('brutalism', 'brutalist', 'modernism', 'modern', 'international', 'post-war', 'postwar', 'streamline_moderne'), 4)]

# streets whose terraces or blocks share one period (the area round each campus); everything else is inferred from its
# mapped neighbours on the same street, then from the building's type
STREET_ERA = {
    # Bloomsbury, Fitzrovia, Marylebone, Islington (UCL); Holborn, Covent Garden, Clerkenwell (LSE)
    1: ['Gower Street', 'Bedford Square', 'Gordon Square', 'Tavistock Square', 'Woburn Square', 'Torrington Square', 'Russell Square', 'Bloomsbury Square',
        'Great Russell Street', 'Montague Street', 'Bedford Place', 'Bedford Way', 'Store Street', 'Taviton Street', 'Doughty Street', 'John Street', 'Mecklenburgh Square',
        'Marchmont Street', 'Cartwright Gardens', 'Argyle Square', 'Argyle Street', 'Fitzroy Square', 'Fitzroy Street', 'Charlotte Street', 'Gloucester Place', 'Portland Place',
        'Great Ormond Street', "Lamb's Conduit Street", 'Bedford Row', 'Red Lion Square', 'Guilford Street', 'Queen Square', 'Coram Street', 'Herbrand Street',
        'Liverpool Road', 'Cloudesley Road', 'Cloudesley Square', 'Richmond Avenue', 'Barnsbury Road', 'Barnsbury Square', 'Thornhill Square', 'Gibson Square', 'Milner Square',
        'Lonsdale Square', 'Duncan Terrace', 'Colebrooke Row', 'Canonbury Square', 'Amwell Street', 'Myddelton Square', 'Lloyd Baker Street', 'Percy Circus', 'Claremont Square',
        'Wharton Street', 'Great Percy Street', 'Sekforde Street', 'Albert Street', 'Mornington Crescent', 'Delancey Street', 'Gloucester Avenue', 'Regent\'s Park Road',
        'Chalcot Square', 'Montagu Square', 'Bryanston Square', 'Dorset Square', 'Wimpole Street', 'Upper Wimpole Street', 'Devonshire Place', 'Mansfield Street',
        "Lincoln's Inn Fields", 'New Square', 'Old Square', 'Great James Street', 'Rugby Street', 'Bedford Street', 'Henrietta Street', 'Maiden Lane',
        'Trinity Church Square', 'Merrick Square', 'Kennington Road',
        # South Kensington, Knightsbridge, Belgravia, Bayswater (Imperial): Italianate stucco, the same dress
        "Queen's Gate", "Queen's Gate Gardens", "Queen's Gate Terrace", "Queen's Gate Place", 'Onslow Gardens', 'Onslow Square', 'Cromwell Road', 'Thurloe Square',
        'Pelham Crescent', 'Pelham Place', 'Egerton Crescent', 'Egerton Gardens', 'Ennismore Gardens', "Prince's Gate", "Princes Gate", 'Rutland Gate', 'Cornwall Gardens',
        'Elvaston Place', 'Gloucester Road', 'Stanhope Gardens', 'Harrington Road', 'Sumner Place', 'Elm Park Gardens', 'Redcliffe Gardens', 'Redcliffe Square',
        'The Boltons', 'Bolton Gardens', 'Eaton Place', 'Eaton Square', 'Belgrave Square', 'Chester Square', 'Wilton Crescent', 'Lowndes Square', 'Sussex Gardens',
        'Norfolk Square', 'Talbot Square', 'Leinster Square', 'Kensington Park Gardens', 'Ladbroke Square', 'Ladbroke Grove', 'Pembridge Square', 'Kensington Square',
        'Edwardes Square', 'Earls Court Square', 'Courtfield Gardens', 'Collingham Place', 'Stanhope Terrace', 'Gloucester Square', 'Hyde Park Gardens',
        # East End: the few Georgian squares
        'Tredegar Square', 'Stepney Green', 'Arbour Square', 'Wellington Row', 'Fournier Street', 'Elder Street', 'Wilkes Street', 'Princelet Street'],
    2: ['Torrington Place', 'Chenies Street', 'Huntley Street', 'Harley Street', 'Great Portland Street', 'New Cavendish Street', 'Hemingford Road', 'Caledonian Road',
        'Camden High Street', 'Parkway', 'Ripplevale Grove', 'Chapel Market', 'Judd Street', 'Grafton Way', 'Warren Street', 'Cleveland Street', 'Goodge Street',
        'Wardour Street', 'Berwick Street', 'Great Titchfield Street', "Gray's Inn Road", 'St. John Street', 'Goswell Road', 'Farringdon Road', 'Theobalds Road',
        'Fleet Street', 'Borough High Street', 'Charing Cross Road', 'Shaftesbury Avenue', 'Long Acre', 'Endell Street', 'Drury Lane',
        'Harrington Gardens', 'Collingham Gardens', 'Cadogan Square', 'Cadogan Gardens', 'Pont Street', 'Hans Road', 'Hans Place', 'Sloane Street', 'Basil Street',
        'Kensington Gore', 'Earl\'s Court Road', 'Old Brompton Road', 'Fulham Road', "King's Road", 'North End Road', 'Lillie Road', 'Seagrave Road', 'Sedlescombe Road',
        'Halford Road', 'Westbourne Grove', 'Portobello Road', 'Kensington Church Street', 'Draycott Place', 'Oakley Street', 'Old Church Street', 'Sydney Street',
        'Mile End Road', 'Bancroft Road', 'Antill Road', 'Ropery Street', 'Rhondda Grove', 'Coborn Street', 'Coborn Road', 'Grove Road', 'Roman Road', 'Old Ford Road',
        'Victoria Park Road', 'Lauriston Road', 'Commercial Road', 'Whitechapel Road', 'Senrab Street', 'Aston Street', 'Salmon Lane', 'Southborough Road', 'Gore Road',
        'Mare Street', 'Cambridge Heath Road', "King Edward's Road", 'Bow Road', 'Medway Road', 'Ellesmere Road', 'Mostyn Grove', 'Malmesbury Road', 'Lichfield Road',
        'Alloway Road', 'Kenilworth Road', 'Selwyn Road', 'Rounton Road', 'Ainsley Street', 'Mossford Street', 'Hamlets Way', 'Eric Street', 'Lockhart Street'],
    3: ['Kingsway', 'Aldwych', 'Southampton Row', 'Malet Street', 'Keppel Street', 'Euston Square', 'Woburn Place', 'Upper Woburn Place', 'Regent Street',
        'Piccadilly', 'Oxford Street', 'Holborn', 'High Holborn', 'Strand', 'Bush House', 'Houghton Street', 'Great Queen Street', 'Exhibition Road', 'Imperial College Road',
        'Prince Consort Road', 'Kensington High Street', 'Brompton Road', 'Knightsbridge', 'Moorgate', 'London Wall', 'Queen Victoria Street', 'Cheapside',
        'New Bond Street', 'Oxford Circus', 'Baker Street', 'Euston Road', 'Tottenham Court Road', 'Bloomsbury Street', 'Southwark Street', 'Stamford Street'],
    4: ['Brunswick Square', 'Hunter Street', 'Portugal Street', 'Clare Market', 'Sheffield Street', 'Kean Street', 'Carr Street', 'Ben Jonson Road', 'Clemence Street',
        'Auden Place', 'Lofting Road', 'Ocean Estate', 'Stepney Way', 'Burdett Road', 'White Horse Road', 'Cable Street', 'Exmouth Street', 'Ernest Street',
        'Hampstead Road', 'Robert Street', 'Varndell Street', 'Stanhope Street', 'Golden Lane', 'Silk Street', 'Barbican', 'Fann Street'],
}
STREET_ERA = {s: e for e, ss in STREET_ERA.items() for s in ss}
# what the plain residential stock looks like where nothing else says (by site): era, then the share of whole streets in
# stucco (era 1) or red brick (era 2)
SITE_DRESS = {'ucl': {'house': 1, 'stucco': 0.18, 'red': 0.4}, 'lse': {'house': 1, 'stucco': 0.15, 'red': 0.45},
              'imperial': {'house': 1, 'stucco': 0.88, 'red': 0.65}, 'qmul': {'house': 2, 'stucco': 0.08, 'red': 0.22}}


def year_of(t):
    for k in ('start_date', 'year_of_construction', 'construction_date', 'building:start_date'):
        v = (t.get(k) or '').strip().lower()
        m = re.search(r'(1[5-9]\d\d|20[0-2]\d)', v)
        if m:
            return int(m.group(1))
        m = re.search(r'c(1[5-9]|20)\b', v.replace(' ', ''))
        if m:
            return int(m.group(1)) * 100 - 50
    return None


def own_era(t, hgt, a, style):
    """the period a building's own tags give it, or None"""
    y = year_of(t)
    big = a > 900 or hgt > 22
    if y:
        if y < 1840:
            return 1
        if y < 1900:
            return 2
        if y < 1940:
            return 3 if (big or style in ('stone',)) else 2
        if y < 1985:
            return 4
        return 0
    ar = (t.get('building:architecture') or '').lower()
    for keys, e in ARCH_ERA:
        if any(k in ar for k in keys):
            return e
    if t.get('heritage') or t.get('listed_status') or t.get('HE_ref'):
        return {'stock': 1, 'stucco': 1, 'redbrick': 2, 'stone': 3}.get(style)
    return None


def street_of(t):
    s = (t.get('addr:street') or '').strip()
    return s.replace('St ', 'St. ') if s.startswith('St ') else s


def dress(recs, site, named_road):
    """facade era per building, and its style where the map gives no material. recs: [{'t', 'st', 'h', 'a', 'c'}];
    named_road(x, z): the nearest named street, or ''. Returns ([era], [style]) and fills a report."""
    cfg = SITE_DRESS[site]
    streets, own = [], []
    tally = {}
    for r in recs:
        s = street_of(r['t']) or named_road(*r['c'])
        streets.append(s)
        e = own_era(r['t'], r['h'], r['a'], r['st'])
        own.append(e)
        if e is not None and s:
            tally.setdefault(s, {}).setdefault(e, 0)
            tally[s][e] += 1
    eras, sts = [], []
    rep = {'own': 0, 'street': 0, 'neighbours': 0, 'type': 0}
    for r, s, e in zip(recs, streets, own):
        t, st, h, a = r['t'], r['st'], r['h'], r['a']
        b = t.get('building', t.get('building:part', 'yes'))
        mat = (t.get('building:material') or t.get('building:facade:material') or t.get('facade:material') or '').lower()
        lv = num(t.get('building:levels')) or h / 3.3
        if st in ('church', 'shed', 'glass') or (st == 'concrete' and h > 34):
            eras.append(0); sts.append(st)
            continue
        how = 'own'
        if e is None:
            how = 'street'
            e = STREET_ERA.get(s)
            if e is None and s in tally:
                how = 'neighbours'
                best = max(tally[s].items(), key=lambda kv: kv[1])
                e = best[0] if best[1] >= 2 else None
            # tall blocks of flats and big slab offices are post-war wherever they stand
            if b in ('apartments', 'residential', 'flats', 'dormitory') and lv >= 6.5 and not mat:
                how, e = 'type', 4
            if e is None:
                how = 'type'
                if b in ('terrace', 'house', 'semidetached_house', 'detached') or (b in ('yes', 'residential', 'apartments') and a < 400 and lv <= 5.5):
                    e = cfg['house']
                elif st == 'concrete':
                    e = 4
                elif st == 'stone' and a > 600:
                    e = 3
                else:
                    e = 0
            # a period street of terraces still has its big modern infill; a street of stone blocks its odd small house;
            # a post-war estate its low brick terraces
            if e in (1, 2) and (a > 2500 or lv > 7.5) and not mat:
                e = 4 if st in ('concrete', 'glass') or lv > 7.5 else 3
            elif e == 3 and a < 300 and lv <= 4.5:
                e = 2
            elif e == 4 and lv <= 3.5 and b in ('house', 'terrace', 'semidetached_house', 'detached'):
                e = 0
        rep[how] += 1
        # where the map says nothing about the walls, the period decides them, the same along the whole street
        if not mat and not t.get('building:colour') and e:
            sh = h32(site + (s or str(round(r['c'][0] / 60)) + str(round(r['c'][1] / 60))))
            if e == 1:
                st = 'stucco' if sh < cfg['stucco'] else 'stock'
            elif e == 2:
                st = 'redbrick' if sh < cfg['red'] else 'stock'
            elif e == 3:
                st = 'stone'
            elif e == 4:
                st = 'concrete'
        eras.append(e); sts.append(st)
    return eras, sts, rep


# shopfront kinds (SHOPK in web/components/intro/city.js): what the fascia, the window and the light behind it look like
FOOD = {'restaurant', 'cafe', 'fast_food', 'ice_cream', 'food_court'}
PUB = {'pub', 'bar', 'nightclub', 'biergarten'}
SERVICE = {'bank', 'pharmacy', 'bureau_de_change', 'post_office', 'cinema', 'theatre', 'dentist', 'doctors', 'veterinary', 'money_transfer',
           'betting', 'casino', 'clinic', 'library', 'arts_centre', 'internet_cafe', 'gambling'}


def shop_kind(t):
    """0 shop, 1 cafe or restaurant, 2 pub or bar, 3 bank, chemist and other services, 4 empty unit; None if not a shopfront"""
    am = t.get('amenity', '')
    sh = t.get('shop', '')
    if sh in ('vacant', 'disused') or t.get('disused:shop'):
        return 4
    if am in PUB:
        return 2
    if am in FOOD or sh in ('bakery', 'coffee', 'deli', 'pastry'):
        return 1
    if am in SERVICE:
        return 3
    if sh and sh not in ('no', 'none', 'mall', 'department_store', 'wholesale', 'storage_rental'):
        return 0
    return None


def seg_d(px, pz, a, b):
    dx, dz = b[0] - a[0], b[1] - a[1]
    L2 = dx * dx + dz * dz or 1e-9
    u = max(0.0, min(1.0, ((px - a[0]) * dx + (pz - a[1]) * dz) / L2))
    return math.hypot(px - a[0] - dx * u, pz - a[1] - dz * u)


def frontages(bring, road_segs):
    """street fronts: fr(k) -> [(edge, midpoint, normal, length)] for the walls of building k with a street in front.
    bring: [(out index, outer ring, min height, height, style, own tags)]; road_segs: [(class, width, [pts])]. Also returns
    the building grid (25 m cells)."""
    G = 25.0
    # roads a pedestrian can shop from: everything but footpaths
    rgrid = {}
    for cls, w, pts in road_segs:
        if cls > 4:
            continue
        for a, b in zip(pts, pts[1:]):
            for gx in range(int(min(a[0], b[0]) // G) - 1, int(max(a[0], b[0]) // G) + 2):
                for gz in range(int(min(a[1], b[1]) // G) - 1, int(max(a[1], b[1]) // G) + 2):
                    rgrid.setdefault((gx, gz), []).append((w, a, b))
    bgrid = {}
    for k, (_, o, _, _, _, _) in enumerate(bring):
        xs, zs = [p[0] for p in o], [p[1] for p in o]
        for gx in range(int(min(xs) // G), int(max(xs) // G) + 1):
            for gz in range(int(min(zs) // G), int(max(zs) // G) + 1):
                bgrid.setdefault((gx, gz), []).append(k)

    def inside_other(x, z, me):
        for k in bgrid.get((int(x // G), int(z // G)), ()):
            if k != me and pip(x, z, bring[k][1]):
                return True
        return False

    def frontage(k):
        """edges of building k with a street in front and no neighbour against them: [(edge, midpoint, normal, length)]"""
        _, o, minh, hgt, st, _ = bring[k]
        if minh > 0.6 or hgt < 4.5 or st in (STY['church'], STY['shed']):
            return []
        res = []
        for i in range(len(o)):
            (x0, z0), (x1, z1) = o[i], o[(i + 1) % len(o)]
            L = math.hypot(x1 - x0, z1 - z0)
            if L < 2.8:
                continue
            nx, nz = (z1 - z0) / L, -(x1 - x0) / L  # outward for an anticlockwise ring
            mx, mz = (x0 + x1) / 2, (z0 + z1) / 2
            if inside_other(mx + nx * 1.2, mz + nz * 1.2, k):
                continue  # party wall
            # a carriageway or pedestrian street within a pavement's width of the wall, on its outer side, with nothing built
            # in between (walk out from the wall: a kiosk, an arcade or the next block across a yard hides the street)
            ok = False
            s = 1.2
            while s <= 13.2 and not ok:
                px, pz = mx + nx * s, mz + nz * s
                if inside_other(px, pz, k):
                    break
                if s >= 2.4:
                    for w, a, b in rgrid.get((int(px // G), int(pz // G)), ()):
                        if seg_d(px, pz, a, b) < w / 2 + 2.5 and seg_d(mx, mz, a, b) > 1.0:
                            ok = True
                            break
                s += 1.2
            if ok:
                res.append((i, (mx, mz), (nx, nz), L))
        return res

    fr_cache = {}

    def fr(k):
        if k not in fr_cache:
            fr_cache[k] = frontage(k)
        return fr_cache[k]

    return fr, bgrid


def shopfronts(bring, fr, bgrid, points):
    """Ground-floor walls that face a street and carry a mapped shop, cafe, pub or bank.
    points: [(x, z, kind)] for mapped shop nodes and areas. Returns {(out index, edge index): kind}."""
    G = 25.0
    flag = {}
    # whole buildings mapped as a shop or pub: every street-facing wall
    for k, (bi, o, _, _, _, t) in enumerate(bring):
        kd = shop_kind(t)
        if kd is not None:
            for i, _, _, _ in fr(k):
                flag.setdefault((bi, i), kd)
    # shop nodes: the nearest street-facing wall of the building they sit in or beside
    for x, z, kd in points:
        best = None
        for gx in (int(x // G) - 1, int(x // G), int(x // G) + 1):
            for gz in (int(z // G) - 1, int(z // G), int(z // G) + 1):
                for k in bgrid.get((gx, gz), ()):
                    o = bring[k][1]
                    for i, _, _, _ in fr(k):
                        d = seg_d(x, z, o[i], o[(i + 1) % len(o)])
                        if d < 14 and (best is None or d < best[0]):
                            best = (d, k, i)
        if best:
            key = (bring[best[1]][0], best[2])
            # a cafe beats a vacant unit on the same wall; otherwise the first mapped use stays
            if key not in flag or flag[key] == 4:
                flag[key] = kd
    # parades: an unmapped street wall between two shopfronts on the same frontage is a shop too
    fl = []
    for k in range(len(bring)):
        for i, m, n, L in fr(k):
            if (bring[k][0], i) in flag:
                fl.append((m, n))
    fgrid = {}
    for m, n in fl:
        fgrid.setdefault((int(m[0] // G), int(m[1] // G)), []).append((m, n))
    added = 0
    for k in range(len(bring)):
        for i, m, n, L in fr(k):
            key = (bring[k][0], i)
            if key in flag:
                continue
            tx, tz = -n[1], n[0]  # along the wall
            lo = hi = False
            for gx in (int(m[0] // G) - 1, int(m[0] // G), int(m[0] // G) + 1):
                for gz in (int(m[1] // G) - 1, int(m[1] // G), int(m[1] // G) + 1):
                    for m2, n2 in fgrid.get((gx, gz), ()):
                        if n2[0] * n[0] + n2[1] * n[1] < 0.94:
                            continue
                        dx, dz = m2[0] - m[0], m2[1] - m[1]
                        along = dx * tx + dz * tz
                        if abs(dx * n[0] + dz * n[1]) > 2.5 or abs(along) > 22:
                            continue
                        lo = lo or along < -1
                        hi = hi or along > 1
            if lo and hi:
                flag[key] = 0
                added += 1
    return flag, added


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
        # names repeat across London ("Old Building"): take the match nearest the site centre, within 400 m
        qt = []
        for n in cfg['anchor']:
            for el in named.get(n, []):
                ps = el_pts(el, tmp.enu)
                if ps:
                    d = math.hypot(sum(p[0] for p in ps) / len(ps), sum(p[1] for p in ps) / len(ps))
                    if d < 400:
                        qt.append((d, el))
        qt = [el for _, el in sorted(qt, key=lambda t: t[0])]
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
    bring = []  # (out index, ring, min height, height, style, own tags) for the shopfronts
    stats = {'h': 0, 'lv': 0, 'guess': 0}
    style_n = {}
    drecs = []  # what dress() needs to pick each building's period
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
        drecs.append({'t': t, 'st': st, 'h': hgt, 'a': b['a'], 'c': b['c']})
        bring.append((len(out_b), b['o'], minh, hgt, STY[st], b['t']))
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
    road_segs, shop_pts, named_segs = [], [], []
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
        sk = shop_kind(t)
        if sk is not None and t.get('level', '0').strip() in ('0', '0;1', '0;-1', '') and t.get('location') != 'underground':
            ps = el_pts(el, fr)
            if ps:
                shop_pts.append((sum(p[0] for p in ps) / len(ps), sum(p[1] for p in ps) / len(ps), sk))
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
                road_segs.append((CLS.get(hw.replace('_link', ''), 2), w, seg))
                if t.get('name') and CLS.get(hw.replace('_link', ''), 2) <= 2:
                    named_segs.append((t['name'], seg))
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

    # ------------------------------------------------------------------ shopfronts on the ground floors
    # ------------------------------------------------------------------ facade periods, by the building's own tags, then its street
    NG = 40.0
    ngrid = {}
    for nm, seg in named_segs:
        for a, b in zip(seg, seg[1:]):
            for gx in range(int(min(a[0], b[0]) // NG), int(max(a[0], b[0]) // NG) + 1):
                for gz in range(int(min(a[1], b[1]) // NG), int(max(a[1], b[1]) // NG) + 1):
                    ngrid.setdefault((gx, gz), []).append((nm, a, b))

    def named_road(x, z):
        best = (30.0, '')
        for gx in (int(x // NG) - 1, int(x // NG), int(x // NG) + 1):
            for gz in (int(z // NG) - 1, int(z // NG), int(z // NG) + 1):
                for nm, a, b in ngrid.get((gx, gz), ()):
                    d = seg_d(x, z, a, b)
                    if d < best[0]:
                        best = (d, nm)
        return best[1]

    eras, dsts, era_how = dress(drecs, site, named_road)
    style_n = {}
    for k, (bi, o, minh, hgt, st, t) in enumerate(bring):
        out_b[bi][0] = STY[dsts[k]]
        bring[k] = (bi, o, minh, hgt, STY[dsts[k]], t)
        style_n[dsts[k]] = style_n.get(dsts[k], 0) + 1
    era_n = [eras.count(e) for e in range(5)]

    fr_of, bgrid = frontages(bring, road_segs)
    sfl, sf_fill = shopfronts(bring, fr_of, bgrid, shop_pts)
    # street fronts of the period terraces: front doors, area railings and (Victorian houses) bay windows, as
    # [building, wall, kind]: kind 0 doors and railings, 1 doors and canted bays, 2 doors only (shop or office below)
    ef = []
    ef_n = [0, 0, 0]
    for k, (bi, o, minh, hgt, st, t) in enumerate(bring):
        e = eras[k]
        if e not in (1, 2):
            continue
        b = t.get('building', t.get('building:part', 'yes'))
        lv = num(t.get('building:levels')) or hgt / 3.3
        house = b in ('terrace', 'house', 'semidetached_house', 'detached', 'residential', 'yes', 'apartments') and lv <= 5.5 and drecs[k]['a'] < 700
        for i, m, n, L in fr_of(k):
            if L < 4.5 or L > 90:
                continue
            kd = 2 if ((bi, i) in sfl or not house) else (1 if e == 2 and lv <= 4.5 and drecs[k]['a'] < 400 else 0)
            ef += [bi, i, kd]
            ef_n[kd] += 1
    sf = []
    for (bi, ei), kd in sorted(sfl.items()):
        sf += [bi, ei, kd]
    sf_n = [sum(1 for v in sfl.values() if v == k) for k in range(5)]

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
        'landmarks': landmarks, 'b': out_b, 'e': ''.join(str(e) for e in eras), 'ef': ef, 'r': roads, 'a': areas, 'rl': rails, 't': trees, 'sf': sf, 'sky': sky, 'river': river,
    }
    p = os.path.join(OUT, f'{site}.json')
    with open(p, 'w') as f:
        json.dump(data, f, separators=(',', ':'))
    rep = {'site': site, 'buildings': len(out_b), 'heights': stats, 'styles': style_n, 'roads': len(roads), 'areas': len(areas), 'rails': len(rails),
           'trees': len(trees) // 3, 'shop_points': len(shop_pts), 'shopfronts': sf_n, 'eras': era_n, 'era_by': era_how, 'fronts': ef_n, 'shopfront_fill': sf_fill, 'skyline': len(sky), 'landmarks': landmarks, 'bytes': os.path.getsize(p), **info}
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
