"""King's College London modules from KCL's public module pages (the study-abroad module options, one page per module:
code, level, semester, credit value, department and description). Runs in GitHub Actions (fetch-kcl-modules.yml):
  python3 tools/unis/kcl_modules.py   -> tools/unis/out/kcl-modules.json and kcl.log
Reads every page of the study-abroad module search (one card per module: code, level, semester, credit value,
faculty and department, assessment), then each module's own page for its description."""
import gzip, html, json, os, re, sys, time, urllib.request
from concurrent.futures import ThreadPoolExecutor

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out')
os.makedirs(OUT, exist_ok=True)
LOG = open(os.path.join(OUT, 'kcl.log'), 'w')
def log(*a):
    s = ' '.join(str(x) for x in a); print(s, flush=True); LOG.write(s + '\n'); LOG.flush()
UA = {'User-Agent': 'Mozilla/5.0 (compatible; unizy-module-index/1.0; +https://unizy.uk)'}

DELAY = float(os.environ.get('DELAY', '1.6'))  # seconds between requests: the site rate-limits (429) anything faster
_last = [0.0]
def get(url, tries=7):
    for i in range(tries):
        wait = _last[0] + DELAY - time.time()
        if wait > 0: time.sleep(wait)
        _last[0] = time.time()
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=40) as r:
                b = r.read()
                if url.endswith('.gz') or b[:2] == b'\x1f\x8b': b = gzip.decompress(b)
                return b.decode('utf-8', 'replace')
        except Exception as e:
            code = getattr(e, 'code', None)
            if i == tries - 1 or code in (404, 410): log('fail', url, e); return None
            ra = getattr(e, 'headers', None) and e.headers.get('Retry-After')
            time.sleep(int(ra) if ra and str(ra).isdigit() else (45 * (i + 1) if code == 429 else 4 + 4 * i))

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

def cards(h):
    """the modules on one page of the study-abroad module search: one card each"""
    out = []
    for c in h.split('<div class="card">')[1:]:
        t = re.search(r'title="Expand to see more details about ([^"]+)"', c)
        kv = dict((k.strip().rstrip(':').lower(), html.unescape(re.sub(r'<[^>]+>', '', v)).strip())
                  for k, v in re.findall(r'(?is)<h4>([^<]+)</h4>\s*<p>(.*?)</p>', c))
        code = kv.get('module code', '').upper()
        if not t or not re.match(r'^[0-9][A-Z0-9]{5,9}$', code):
            continue
        deps = [(html.unescape(ti), html.unescape(re.sub(r'<[^>]+>', '', tx)).strip()) for ti, tx in re.findall(r'(?is)<a href="[^"]*" title="([^"]+)">(.*?)</a>', c.split('Department:')[1].split('</ul>')[0])] if 'Department:' in c else []
        fac = next((x for ti, x in deps if ti.startswith('Faculty of')), None)
        dep = next((x for ti, x in deps if ti.startswith('Department of')), None) or next((x for ti, x in deps if not ti.startswith('Faculty of')), None) or fac
        ass = re.search(r'(?is)<h4>Assessment</h4>\s*<div>(.*?)</div>', c)
        link = re.search(r'href="(/abroad/module-options/[a-z0-9-]+)"[^>]*>Module details', c)
        lev = re.search(r'\d', kv.get('level', ''))
        cr = re.search(r'\d+(\.\d+)?', kv.get('credit value', ''))
        out.append({'code': code, 'title': html.unescape(t.group(1)).strip(), 'level': int(lev.group()) if lev else None,
                    'credits': float(cr.group()) if cr else None, 'term': kv.get('semester') or None, 'faculty': fac, 'department': dep,
                    'assessment': re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', ' ', ass.group(1)))).strip()[:600] if ass else None,
                    'url': 'https://www.kcl.ac.uk' + link.group(1) if link else None})
    return out


def describe(m):
    """the module's own page: its description"""
    if not m.get('url'):
        return m
    h = get(m['url'])
    if not h:
        return m
    L = text_lines(h)
    for k in ('module description', 'description', 'module overview', 'overview'):
        d = ' '.join(section(L, k))
        if len(d) > 60:
            m['summary'] = d[:1500]
            break
    o = ' '.join(section(L, 'learning outcomes'))
    if o:
        m['outcomes'] = o[:900]
    return m


if __name__ == '__main__':
    B = 'https://www.kcl.ac.uk/abroad/module-options/search.aspx'
    first = get(B) or ''
    last = max([int(x) for x in re.findall(r'search\.aspx\?page=(\d+)', first)] or [1])
    log('search pages', last)
    pages = [first] + [get(f'{B}?page={i}') or '' for i in range(2, last + 1)]
    mods = [m for h in pages for m in cards(h)]
    log('cards', len(mods), 'empty pages', sum(1 for h in pages if not cards(h)))
    by = {}
    for m in mods:
        by.setdefault(m['code'], m)
    mods = sorted(by.values(), key=lambda m: m['code'])
    lim = int(os.environ.get('LIMIT', '0') or 0)
    json.dump(mods, open(os.path.join(OUT, 'kcl-modules.json'), 'w'))  # the cards, in case the descriptions are cut short
    out = []
    for i, m in enumerate(mods[:lim] if lim else mods):
        out.append(describe(m))
        if i % 100 == 99:
            log('described', i + 1)
            json.dump(out + mods[i + 1:], open(os.path.join(OUT, 'kcl-modules.json'), 'w'))
    mods = out
    from collections import Counter
    log('unique codes', len(mods), 'with description', sum(1 for m in mods if m.get('summary')))
    log('levels', Counter(m['level'] for m in mods), 'credits', Counter(m['credits'] for m in mods).most_common(6))
    log('faculties', Counter(m['faculty'] for m in mods).most_common(12))
    log('departments', len(Counter(m['department'] for m in mods)), Counter(m['department'] for m in mods).most_common(60))
    for m in mods[:3]:
        log(json.dumps(m)[:900])
    json.dump(mods, open(os.path.join(OUT, 'kcl-modules.json'), 'w'))
