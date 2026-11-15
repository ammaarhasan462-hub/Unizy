"""King's College London modules from KCL's public module pages (the study-abroad module options, one page per module:
code, level, semester, credit value, department and description). Runs in GitHub Actions (fetch-kcl-modules.yml):
  python3 tools/unis/kcl_modules.py   -> tools/unis/out/kcl-modules.json and kcl.log
Discovery: robots.txt -> sitemaps -> every /abroad/module-options/<slug> page."""
import gzip, html, json, os, re, sys, time, urllib.request
from concurrent.futures import ThreadPoolExecutor

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out')
os.makedirs(OUT, exist_ok=True)
LOG = open(os.path.join(OUT, 'kcl.log'), 'w')
def log(*a):
    s = ' '.join(str(x) for x in a); print(s, flush=True); LOG.write(s + '\n'); LOG.flush()
UA = {'User-Agent': 'Mozilla/5.0 (compatible; unizy-module-index/1.0; +https://unizy.uk)'}

def get(url, tries=3):
    for i in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=40) as r:
                b = r.read()
                if url.endswith('.gz') or b[:2] == b'\x1f\x8b': b = gzip.decompress(b)
                return b.decode('utf-8', 'replace')
        except Exception as e:
            if i == tries - 1: log('fail', url, e); return None
            time.sleep(2 + 3 * i)

def sitemaps():
    seen, urls = set(), []
    rob = get('https://www.kcl.ac.uk/robots.txt') or ''
    todo = re.findall(r'(?im)^sitemap:\s*(\S+)', rob) or ['https://www.kcl.ac.uk/sitemap.xml']
    log('sitemaps from robots', todo)
    while todo:
        u = todo.pop()
        if u in seen: continue
        seen.add(u)
        x = get(u)
        if not x: continue
        locs = [html.unescape(l.strip()) for l in re.findall(r'<loc>(.*?)</loc>', x, re.S)]
        if '<sitemapindex' in x: todo += locs
        else: urls += locs
    log('sitemap files', len(seen), 'urls', len(urls))
    return urls

def text_lines(h):
    h = re.sub(r'(?is)<(script|style|noscript)[^>]*>.*?</\1>', ' ', h)
    h = re.sub(r'(?i)<br\s*/?>', '\n', h)
    h = re.sub(r'(?i)</(p|div|li|h[1-6]|dd|dt|tr|section|ul|ol)>', '\n', h)
    h = re.sub(r'(?i)<(h[1-6])[^>]*>', lambda m: '\n@@' + m.group(1).lower() + ' ', h)
    h = re.sub(r'<[^>]+>', ' ', h)
    out = []
    for l in html.unescape(h).split('\n'):
        l = re.sub(r'\s+', ' ', l).strip()
        if l: out.append(l)
    return out

def after(lines, label):
    for i, l in enumerate(lines):
        if re.sub(r'^@@h\d ', '', l).rstrip(':').strip().lower() == label:
            vals = []
            for m in lines[i + 1:i + 8]:
                if m.startswith('@@'): break
                vals.append(m)
            return vals
    return []

def section(lines, title, stop_any=True):
    for i, l in enumerate(lines):
        if l.startswith('@@h') and re.sub(r'^@@h\d ', '', l).strip().lower() == title:
            vals = []
            for m in lines[i + 1:]:
                if m.startswith('@@h1') or m.startswith('@@h2') or (stop_any and m.startswith('@@')): break
                vals.append(m)
            return vals
    return []

def dept_links(h):
    # "Department" block: its links' texts, in order (faculty, school, department)
    m = re.search(r'(?is)>\s*Department[s]?\s*:?\s*<.*?(<a .*?)(?:<h[1-6]|</section|</aside)', h)
    if not m: return []
    return [re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', '', t))).strip() for t in re.findall(r'(?is)<a [^>]*>(.*?)</a>', m.group(1))][:6]

def parse(url):
    h = get(url)
    if not h: return None
    L = text_lines(h)
    code = (after(L, 'module code') or [''])[0].strip().upper()
    if not re.match(r'^[0-9][A-Z0-9]{5,9}$', code): return {'url': url, 'bad': 'nocode'}
    t = re.search(r'(?is)<h1[^>]*>(.*?)</h1>', h)
    title = re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', '', t.group(1)))).strip() if t else ''
    lev = (after(L, 'level') or [''])[0]
    lev = int(re.search(r'\d', lev).group()) if re.search(r'\d', lev) else None
    cr = (after(L, 'credit value') or [''])[0]
    cr = float(re.search(r'\d+(\.\d+)?', cr).group()) if re.search(r'\d', cr) else None
    sem = ', '.join(x.lstrip('*• ').strip() for x in after(L, 'semester') if len(x) < 40)
    desc = ' '.join(section(L, 'module description'))
    assess = ' '.join(section(L, 'assessment details'))
    outc = ' '.join(section(L, 'learning outcomes'))
    deps = dept_links(h)
    return {'code': code, 'title': title, 'level': lev, 'credits': cr, 'term': sem or None, 'summary': desc[:1500] or None,
            'assessment': assess[:600] or None, 'outcomes': outc[:900] or None, 'depts': deps, 'url': url}

if __name__ == '__main__':
    urls = sitemaps()
    pats = {}
    for u in urls:
        m = re.match(r'https?://[^/]+/([^/?#]+(?:/[^/?#]+)?)', u)
        if m and 'module' in u.lower(): pats[m.group(1)] = pats.get(m.group(1), 0) + 1
    log('url prefixes containing "module":', sorted(pats.items(), key=lambda x: -x[1])[:40])
    mods = sorted({u.split('?')[0].rstrip('/') for u in urls if re.search(r'/abroad/module-options/[^/]+$', u.split('?')[0].rstrip('/'))
                   and not re.search(r'/(search|index\.aspx)$', u.split('?')[0].rstrip('/'))})
    lim = int(os.environ.get('LIMIT', '0') or 0)
    if lim: mods = mods[:lim]
    log('module pages', len(mods), mods[:5])
    with ThreadPoolExecutor(6) as ex: res = list(ex.map(parse, mods))
    ok = [r for r in res if r and not r.get('bad')]
    log('parsed', len(ok), 'nocode', sum(1 for r in res if r and r.get('bad')), 'failed', sum(1 for r in res if not r))
    by = {}
    for r in ok:
        if r['code'] not in by or len(r.get('summary') or '') > len(by[r['code']].get('summary') or ''): by[r['code']] = r
    out = sorted(by.values(), key=lambda r: r['code'])
    from collections import Counter
    log('unique codes', len(out), 'levels', Counter(r['level'] for r in out), 'credits', Counter(r['credits'] for r in out).most_common(6))
    log('dept samples', Counter(' | '.join(r['depts']) for r in out).most_common(25))
    for r in out[:3]: log(json.dumps(r)[:900])
    json.dump(out, open(os.path.join(OUT, 'kcl-modules.json'), 'w'))
