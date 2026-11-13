#!/usr/bin/env python3
"""Building heights from Environment Agency LiDAR, for the buildings whose OSM height is only guessed.

Runs in GitHub Actions (.github/workflows/fetch-city-lidar.yml): needs numpy, tifffile, imagecodecs and pyproj, and
network access to environment.data.gov.uk. For each site it fetches the 1 m LiDAR composite DSM and DTM over the site's
download box, takes DSM - DTM (height above ground), and writes the median under every building footprint to
tools/city/raw/<site>.lidar.json.gz, keyed "<element id>/<outer ring>" exactly as bake_city.py walks the raw data.
bake_city.py uses those heights for footprints with no height or levels tag, so a local rebake needs only Pillow.

Data: Environment Agency LiDAR Composite DSM and DTM (1 m), Open Government Licence v3.0.
Contains public sector information licensed under the Open Government Licence v3.0.
"""
import gzip, io, json, math, os, re, sys, time, urllib.parse, urllib.request, zipfile

import numpy as np
import tifffile
from PIL import Image, ImageDraw, ImageFilter
from pyproj import Transformer

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bake_city as bc  # noqa: E402

RAW = bc.RAW
# the same download boxes as .github/workflows/fetch-city-pbf.yml (min lon, min lat, max lon, max lat)
BOX = {'ucl': (-0.1610, 51.5075, -0.1068, 51.5417), 'imperial': (-0.2043, 51.4811, -0.1493, 51.5153),
       'qmul': (-0.0676, 51.5069, -0.0128, 51.5410), 'lse': (-0.1440, 51.4973, -0.0891, 51.5314)}
TO_BNG = Transformer.from_crs('EPSG:4326', 'EPSG:27700', always_xy=True)
UA = {'User-Agent': 'unizy-city-bake/1.0 (+https://unizy.uk)'}
LOG = []


def log(*a):
    s = ' '.join(str(x) for x in a)
    print(s, flush=True)
    LOG.append(s)


def get(url, data=None, headers=None, tries=4, timeout=180):
    h = dict(UA, **(headers or {}))
    for i in range(tries):
        try:
            req = urllib.request.Request(url, data=data, headers=h)
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return r.read()
        except Exception as e:  # noqa: BLE001
            log('  get failed', i + 1, url[:200], repr(e)[:200])
            time.sleep(3 + 4 * i)
    return None


def jget(url, **k):
    b = get(url, **k)
    try:
        return json.loads(b) if b else None
    except Exception:  # noqa: BLE001
        log('  not json', url[:160], (b or b'')[:200])
        return None


# ------------------------------------------------------------------ source 1: ArcGIS ImageServer on environment.data.gov.uk
IMG = 'https://environment.data.gov.uk/image/rest/services'


def find_image_services():
    """{'dsm': url, 'dtm': url} from the ArcGIS services directory, preferring the newest 1 m composite."""
    found = []
    root = jget(IMG + '?f=json') or {}
    folders = root.get('folders', []) or []
    log('image folders', folders)
    for fo in (['SURVEY'] + [f for f in folders if f != 'SURVEY']):
        d = jget(f'{IMG}/{fo}?f=json') or {}
        for s in d.get('services', []):
            if s.get('type') == 'ImageServer':
                found.append(s['name'])
    log('image services', len(found))
    for n in found:
        if re.search(r'lidar|dsm|dtm|nlp', n, re.I):
            log('  ', n)

    def pick(kind):
        c = [n for n in found if re.search(kind, n, re.I) and re.search(r'lidar|nlp|composite', n, re.I) and re.search(r'1m|_1_?m|1M', n)]
        c = [n for n in c if not re.search(r'hillshade|shaded|tint|aspect|slope|index|coverage|metadata|footprint|vom|vegetation|intensity', n, re.I)]
        if kind == 'dsm':
            c = [n for n in c if not re.search(r'first', n, re.I)] or c  # last return sees through trees better

        def score(n):
            y = [int(v) for v in re.findall(r'20\d\d', n)]
            return (('composite' in n.lower()) * 1, max(y) if y else 0, 'elevation' in n.lower())
        c.sort(key=score, reverse=True)
        return f'{IMG}/{c[0]}/ImageServer' if c else None
    return {'dsm': pick('dsm'), 'dtm': pick('dtm')}


def image_fetch(svc, x0, y0, x1, y1):
    """Float32 array over [x0, x1] x [y0, y1] (British National Grid metres) at 1 m, row 0 = north."""
    w, h = int(round(x1 - x0)), int(round(y1 - y0))
    q = {'bbox': f'{x0},{y0},{x1},{y1}', 'bboxSR': 27700, 'imageSR': 27700, 'size': f'{w},{h}', 'format': 'tiff', 'pixelType': 'F32',
         'noData': -9999, 'interpolation': 'RSP_NearestNeighbor', 'f': 'image'}
    b = get(svc + '/exportImage?' + urllib.parse.urlencode(q), timeout=300)
    if not b or b[:2] not in (b'II', b'MM'):
        log('  exportImage gave no tiff', (b or b'')[:300])
        return None
    a = tifffile.imread(io.BytesIO(b)).astype(np.float32)
    if a.ndim == 3:
        a = a[..., 0] if a.shape[-1] < a.shape[0] else a[0]
    if a.shape != (h, w):
        log('  size mismatch', a.shape, (h, w))
        a = np.array(Image.fromarray(a).resize((w, h), Image.NEAREST))
    a[(a < -1000) | (a > 2000)] = np.nan
    return a


def image_raster(svcs, x0, y0, x1, y1):
    info = jget(svcs['dsm'] + '?f=json') or {}
    mw = min(int(info.get('maxImageWidth') or 4000), int(info.get('maxImageHeight') or 4000), 4000)
    step = max(500, min(2000, mw))
    W, H = int(x1 - x0), int(y1 - y0)
    out = {}
    for k in ('dsm', 'dtm'):
        A = np.full((H, W), np.nan, np.float32)
        for ty in range(0, H, step):
            for tx in range(0, W, step):
                w, h = min(step, W - tx), min(step, H - ty)
                a = image_fetch(svcs[k], x0 + tx, y1 - ty - h, x0 + tx + w, y1 - ty)
                if a is None:
                    return None
                A[ty:ty + h, tx:tx + w] = a
        out[k] = A
        log(f'  {k}: {np.isfinite(A).mean() * 100:.1f}% covered, median {np.nanmedian(A):.1f} m')
    return out


# ------------------------------------------------------------------ source 2: the survey download API (5 km GeoTIFF tiles)
SEARCH = 'https://environment.data.gov.uk/backend/catalog/api/tiles/collections/survey/search'


def survey_raster(x0, y0, x1, y1, lonlat):
    lo0, la0, lo1, la1 = lonlat
    geo = {'type': 'Polygon', 'coordinates': [[[lo0, la0], [lo1, la0], [lo1, la1], [lo0, la1], [lo0, la0]]]}
    r = jget(SEARCH, data=json.dumps(geo).encode(), headers={'Content-Type': 'application/geo+json', 'Accept': 'application/json'})
    if not r:
        return None
    res = r.get('results', r if isinstance(r, list) else [])
    log('  survey search results', len(res))
    by = {}
    for it in res:
        p = (it.get('product') or {}).get('id', '')
        y = str((it.get('year') or {}).get('id', ''))
        rs = str((it.get('resolution') or {}).get('id', ''))
        log('   ', p, y, rs, (it.get('tile') or {}).get('id', ''), it.get('uri', '')[:120])
        if rs.lower() not in ('1m', '1'):
            continue
        if 'composite' not in p.lower():
            continue
        k = 'dtm' if 'dtm' in p.lower() else ('dsm' if 'dsm' in p.lower() and 'first' not in p.lower() else None)
        if k:
            by.setdefault(k, {}).setdefault(y, []).append(it)
    if 'dsm' not in by or 'dtm' not in by:
        return None
    out = {}
    W, H = int(x1 - x0), int(y1 - y0)
    for k in ('dsm', 'dtm'):
        y = max(by[k])
        A = np.full((H, W), np.nan, np.float32)
        for it in by[k][y]:
            b = get(it['uri'], timeout=600)
            if not b:
                return None
            z = zipfile.ZipFile(io.BytesIO(b))
            for n in z.namelist():
                if not n.lower().endswith(('.tif', '.tiff')):
                    continue
                with z.open(n) as f:
                    tf = tifffile.TiffFile(io.BytesIO(f.read()))
                    pg = tf.pages[0]
                    a = pg.asarray().astype(np.float32)
                    sc = pg.tags['ModelPixelScaleTag'].value
                    tp = pg.tags['ModelTiepointTag'].value
                    ox, oy = tp[3] - tp[0] * sc[0], tp[4] + tp[1] * sc[1]
                    a[(a < -1000) | (a > 2000)] = np.nan
                    # paste into the site raster (both at 1 m on the national grid)
                    cx, cy = int(round(ox - x0)), int(round(y1 - oy))
                    sx0, sy0 = max(0, -cx), max(0, -cy)
                    dx0, dy0 = max(0, cx), max(0, cy)
                    w = min(a.shape[1] - sx0, W - dx0)
                    h = min(a.shape[0] - sy0, H - dy0)
                    if w > 0 and h > 0:
                        blk = a[sy0:sy0 + h, sx0:sx0 + w]
                        dst = A[dy0:dy0 + h, dx0:dx0 + w]
                        A[dy0:dy0 + h, dx0:dx0 + w] = np.where(np.isfinite(blk), blk, dst)
        out[k] = A
        log(f'  {k} {y}: {np.isfinite(A).mean() * 100:.1f}% covered')
    return out


# ------------------------------------------------------------------ footprints
def footprint_heights(site, nd, x0, y1):
    """Median height above ground (m) under each building footprint, from the nDSM nd (row 0 at y1, column 0 at x0)."""
    els = bc.load(site)
    fr = lambda lat, lon: TO_BNG.transform(lon, lat)  # noqa: E731
    H, W = nd.shape
    out, n_all = {}, 0
    for el in els:
        t = el.get('tags', {})
        isb = 'building' in t and t.get('building') not in ('no', 'construction', 'demolished')
        isp = 'building:part' in t and t.get('building:part') not in ('no',)
        if not (isb or isp) or t.get('location') == 'underground' or t.get('layer', '0').startswith('-'):
            continue
        for k, (outer, inners) in enumerate(bc.rings_of(el, fr)):
            if len(outer) < 3:
                continue
            n_all += 1
            xs = [p[0] - x0 for p in outer]
            ys = [y1 - p[1] for p in outer]
            c0, c1 = int(math.floor(min(xs))) - 1, int(math.ceil(max(xs))) + 1
            r0, r1 = int(math.floor(min(ys))) - 1, int(math.ceil(max(ys))) + 1
            if c0 < 0 or r0 < 0 or c1 > W or r1 > H or c1 - c0 > 1500 or r1 - r0 > 1500:
                continue
            m = Image.new('L', (c1 - c0, r1 - r0), 0)
            d = ImageDraw.Draw(m)
            # pixel centres: shift by half a pixel so a 1 m pixel counts when its centre is inside
            d.polygon([(x - c0 - 0.5, y - r0 - 0.5) for x, y in zip(xs, ys)], fill=255)
            for hr in inners:
                d.polygon([(p[0] - x0 - c0 - 0.5, y1 - p[1] - r0 - 0.5) for p in hr], fill=0)
            core = m.filter(ImageFilter.MinFilter(3))  # keep off the walls, where the beam mixes roof and street
            mk = np.array(core) > 0
            if mk.sum() < 6:
                mk = np.array(m) > 0
            v = nd[r0:r1, c0:c1][mk]
            v = v[np.isfinite(v)]
            if v.size < 4:
                continue
            out[f"{el['id']}/{k}"] = [round(float(np.median(v)), 1), round(float(np.percentile(v, 90)), 1), int(v.size)]
    return out, n_all


def main():
    sites = sys.argv[1:] or [s for s in BOX if os.path.exists(os.path.join(RAW, f'{s}.geojsonseq.gz')) or os.path.exists(os.path.join(RAW, f'{s}.json.gz'))]
    svcs = None
    try:
        svcs = find_image_services()
    except Exception as e:  # noqa: BLE001
        log('service discovery failed', repr(e))
    log('image services picked', svcs)
    ok = 0
    for site in sites:
        lo0, la0, lo1, la1 = BOX[site]
        cs = [TO_BNG.transform(lo, la) for lo in (lo0, lo1) for la in (la0, la1)]
        x0, y0 = math.floor(min(c[0] for c in cs)), math.floor(min(c[1] for c in cs))
        x1, y1 = math.ceil(max(c[0] for c in cs)), math.ceil(max(c[1] for c in cs))
        log(f'{site}: BNG box {x0},{y0} - {x1},{y1} ({x1 - x0} x {y1 - y0} m)')
        r, src = None, None
        if svcs and svcs.get('dsm') and svcs.get('dtm'):
            r, src = image_raster(svcs, x0, y0, x1, y1), 'image service ' + svcs['dsm'].split('/')[-2] + ' - ' + svcs['dtm'].split('/')[-2]
        if r is None:
            r, src = survey_raster(x0, y0, x1, y1, BOX[site]), 'survey tiles'
        if r is None:
            log(f'{site}: no LiDAR source worked')
            continue
        nd = r['dsm'] - r['dtm']
        hs, n_all = footprint_heights(site, nd, x0, y1)
        log(f'{site}: {len(hs)} of {n_all} footprints measured')
        p = os.path.join(RAW, f'{site}.lidar.json.gz')
        with gzip.open(p, 'wt') as f:
            json.dump({'v': 1, 'src': 'Environment Agency LiDAR Composite DSM - DTM, 1 m (' + src + '), Open Government Licence v3.0',
                       'when': time.strftime('%Y-%m-%d'), 'fields': 'median, p90 (m above ground), pixels', 'h': hs}, f, separators=(',', ':'))
        log(f'{site}: wrote {p} ({os.path.getsize(p)} bytes)')
        ok += 1
    with open(os.path.join(RAW, 'lidar.log'), 'w') as f:
        f.write('\n'.join(LOG) + '\n')
    sys.exit(0 if ok else 1)


if __name__ == '__main__':
    main()
