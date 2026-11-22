#!/usr/bin/env python3
"""Google-friendly module pages for every finished practice pack.

Students search for their module code ("ECON0002 practice questions"), but every /modules/CODE URL used to serve
the same mark.html with a generic title, and the sitemap listed no modules. This script reads the public pack data
(the same rows the marker reads with the publishable key) and writes:

  site/m/<CODE>.html   mark.html with that module's own title, description, canonical URL and readable content
                       (the marker script replaces the content with the live page as soon as it loads)
  site/_redirects      one exact rule per pack ("/modules/CODE  /m/CODE  200"), kept between the BEGIN/END markers,
                       ahead of the catch-all "/modules/*  /mark  200"
  site/mark.html       a crawlable list of every full pack inside #mk, between the seo markers
  site/sitemap.xml     the main pages plus /mark and every pack page

Run by .github/workflows/module-pages.yml (daily and on change). Standard library only. Output is deterministic,
so a run with no new packs commits nothing.
"""
import html
import json
import os
import re
import sys
import urllib.parse
import urllib.request

SB_URL = 'https://aayelwhshiboqyjdhnst.supabase.co'
SB_KEY = 'sb_publishable_eJrU8D7FBn0o8vs0cgfPmw_0ZJzmqVE'  # public, read-only (row level security)
SITE = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'site')
ORIGIN = 'https://unizy.uk'

UNI = {
    'ucl': ('UCL', 'UCL'),
    'imperial': ('Imperial', 'Imperial College London'),
    'qmul': ('Queen Mary', 'Queen Mary University of London'),
    'lse': ('LSE', 'LSE'),
    'kcl': ('King’s', 'King’s College London'),
}
UNI_ORDER = ['ucl', 'imperial', 'lse', 'qmul', 'kcl']
MAIN_PAGES = ['/', '/how-it-works', '/mark', '/play', '/universities', '/research', '/trust', '/pricing', '/reviews',
              '/faq', '/signup', '/privacy', '/terms']
CODE_RE = re.compile(r'^[A-Z0-9]{4,12}$')


def get(path, params):
    rows, start, page = [], 0, 1000
    while True:
        url = SB_URL + '/rest/v1/' + path + '?' + urllib.parse.urlencode(params)
        req = urllib.request.Request(url, headers={'apikey': SB_KEY, 'Range-Unit': 'items',
                                                   'Range': '%d-%d' % (start, start + page - 1)})
        with urllib.request.urlopen(req, timeout=60) as r:
            chunk = json.load(r)
        rows += chunk
        if len(chunk) < page:
            return rows
        start += page


def in_list(codes):
    return 'in.(' + ','.join(codes) + ')'


def clip(text, n):
    text = re.sub(r'\s+', ' ', (text or '')).strip()
    if len(text) <= n:
        return text
    cut = text[:n].rsplit(' ', 1)[0].rstrip(',;:.')
    return cut + '…'


def plain(text):
    # questions can hold light markdown or LaTeX; keep it readable as plain text
    text = re.sub(r'\$+([^$]*)\$+', r'\1', text or '')
    text = re.sub(r'[*_`#>]+', '', text)
    return text


def e(text):
    return html.escape(text or '', quote=True)


def load():
    packs = get('module_packs', {'select': 'code,questions,finished_at', 'status': 'eq.done', 'order': 'code.asc'})
    packs = [p for p in packs if CODE_RE.match(p['code'] or '')]
    codes = [p['code'] for p in packs]
    mods, topics, qs = {}, {}, {}
    for i in range(0, len(codes), 40):
        part = codes[i:i + 40]
        for m in get('ucl_modules', {'select': 'code,title,uni,department,level,credits,ects,summary,exam_format', 'code': in_list(part)}):
            mods[m['code']] = m
        for t in get('module_topics', {'select': 'code,position,title', 'code': in_list(part), 'order': 'code.asc,position.asc'}):
            topics.setdefault(t['code'], []).append(t['title'])
        for q in get('module_questions', {'select': 'code,tier,kind,question,position', 'code': in_list(part), 'order': 'code.asc,position.asc'}):
            qs.setdefault(q['code'], []).append(q)
    out = []
    for p in packs:
        m = mods.get(p['code'])
        if not m or not m.get('title'):
            continue
        q = qs.get(p['code'], [])
        med = m.get('exam_format') == 'sba'
        if med:
            q = [x for x in q if x.get('kind') == 'sba']  # medicine is multiple choice only
            if not q:
                continue
        tiers = {'foundation': 0, 'exam': 0, 'first': 0}
        for x in q:
            if x.get('tier') in tiers:
                tiers[x['tier']] += 1
        sample = next((x for x in q if x.get('tier') == 'exam' and 60 <= len(x.get('question') or '') <= 900), None) \
            or next((x for x in q if x.get('kind') != 'recall'), None)
        out.append({'code': p['code'], 'title': m['title'].strip(), 'uni': m.get('uni') or 'ucl',
                    'dept': (m.get('department') or '').strip(), 'level': m.get('level'),
                    'summary': m.get('summary') or '', 'topics': topics.get(p['code'], []),
                    'n': len(q) or p.get('questions') or 0, 'tiers': tiers, 'med': med,
                    'sample': plain(sample['question']) if sample else '',
                    'day': (p.get('finished_at') or '')[:10]})
    return out


def med_body(m, short, full, code, title, try_url):
    t = m['tiers']
    mix = '%d single best answer questions' % (t['exam'] + t['first'])
    if t['first']:
        mix = '%d single best answer questions, including %d harder data and application questions' % (t['exam'] + t['first'], t['first'])
    h = ['<article class="mk-seo">',
         '<p class="mk-seo-k">%s · %s%s</p>' % (e(short), e(code), (' · ' + e(m['dept'])) if m['dept'] else ''),
         '<h1>%s %s: single best answer practice questions</h1>' % (e(code), e(title)),
         '<p>Practise for %s %s at %s with %s, written from the module’s published description in the style of UK medical school exams. '
         'Pick an answer and see straight away whether you were right, with an explanation of why.</p>' % (e(code), e(title), e(full), e(mix)),
         '<p><a class="btn primary" href="%s">Try one free, no sign-up</a> <a href="/signup">Create a free account</a></p>' % e(try_url)]
    if m['sample']:
        h += ['<h2>Example %s question</h2>' % e(code), '<blockquote>%s</blockquote>' % e(clip(m['sample'], 420))]
    if m['topics']:
        h.append('<h2>Topics covered</h2><ol>' + ''.join('<li>%s</li>' % e(x) for x in m['topics'][:20]) + '</ol>')
    if m['summary']:
        h += ['<h2>About the module</h2>', '<p>%s</p>' % e(clip(m['summary'], 600))]
    h.append('<p class="mk-fine">Unizy is an independent revision tool and is not affiliated with or endorsed by %s. '
             'Practice questions are not taken from any university’s exam papers.</p></article>' % e(full))
    return '\n'.join(h)


def module_body(m):
    short, full = UNI.get(m['uni'], UNI['ucl'])
    code, title = m['code'], m['title']
    try_url = '/modules/%s?q=start' % code
    t = m['tiers']
    if m.get('med'):
        return med_body(m, short, full, code, title, try_url)
    parts = []
    if t['foundation']:
        parts.append('%d quick-recall questions' % t['foundation'])
    if t['exam']:
        parts.append('%d exam-style questions' % t['exam'])
    if t['first']:
        parts.append('%d first-class stretch questions' % t['first'])
    mix = ', '.join(parts[:-1]) + (' and ' if len(parts) > 1 else '') + parts[-1] if parts else '%d practice questions' % m['n']
    h = ['<article class="mk-seo">',
         '<p class="mk-seo-k">%s · %s%s</p>' % (e(short), e(code), (' · ' + e(m['dept'])) if m['dept'] else ''),
         '<h1>%s %s: exam practice questions, marked</h1>' % (e(code), e(title)),
         '<p>Practise for %s %s at %s with %s, written from the module’s published description. '
         'Write an answer and get it marked against %s grade bands in about 30 seconds, with the exact sentences '
         'that lost marks and three changes to reach the next class.</p>' % (e(code), e(title), e(full), e(mix), e(UNI.get(m['uni'], UNI['ucl'])[0] + '’s')),
         '<p><a class="btn primary" href="%s">Try one free, no sign-up</a> <a href="/signup">Create a free account</a></p>' % e(try_url)]
    if m['sample']:
        h += ['<h2>Example %s question</h2>' % e(code), '<blockquote>%s</blockquote>' % e(clip(m['sample'], 420))]
    if m['topics']:
        h.append('<h2>Topics covered</h2><ol>' + ''.join('<li>%s</li>' % e(x) for x in m['topics'][:20]) + '</ol>')
    if m['summary']:
        h += ['<h2>About the module</h2>', '<p>%s</p>' % e(clip(m['summary'], 600))]
    h.append('<p class="mk-fine">Unizy is an independent revision tool and is not affiliated with or endorsed by %s. '
             'Marks are practice estimates, not official marks.</p></article>' % e(full))
    return '\n'.join(h)


def hub_list(mods):
    h = ['<!--seo:start--><section class="mk-seo"><h1>Modules with full practice packs</h1>',
         '<p>Exam-style practice questions with marking against your university’s grade bands. Pick your module to try a question free.</p>']
    for u in UNI_ORDER:
        ms = sorted((m for m in mods if m['uni'] == u), key=lambda m: m['code'])
        if not ms:
            continue
        h.append('<h2>%s</h2><ul>' % e(UNI[u][1]))
        h += ['<li><a href="/modules/%s">%s %s</a></li>' % (m['code'], e(m['code']), e(m['title'])) for m in ms]
        h.append('</ul>')
    h.append('</section><!--seo:end-->')
    return ''.join(h)


SEO_CSS = ('<style>.mk-seo{max-width:760px;margin:0 auto;padding:40px 20px 64px;line-height:1.6}'
           '.mk-seo h1{font-family:Fraunces,serif;font-size:clamp(28px,5vw,40px);line-height:1.15;margin:.2em 0 .5em}'
           '.mk-seo h2{font-size:20px;margin:1.6em 0 .4em}.mk-seo-k{font-family:"DM Mono",monospace;font-size:13px;opacity:.7}'
           '.mk-seo blockquote{margin:0;padding:14px 18px;border-left:3px solid currentColor;opacity:.9}'
           '.mk-seo .btn{margin-right:12px}</style>')


def meta_swap(page, title, desc, url):
    page = re.sub(r'<title>.*?</title>', '<title>%s</title>' % e(title), page, count=1)
    page = re.sub(r'(<meta name="description" content=")[^"]*', lambda x: x.group(1) + e(desc), page, count=1)
    page = re.sub(r'(<meta property="og:title" content=")[^"]*', lambda x: x.group(1) + e(title), page, count=1)
    page = re.sub(r'(<meta property="og:description" content=")[^"]*', lambda x: x.group(1) + e(desc), page, count=1)
    page = re.sub(r'(<link rel="canonical" href=")[^"]*', lambda x: x.group(1) + url, page, count=1)
    page = re.sub(r'(<meta property="og:url" content=")[^"]*', lambda x: x.group(1) + url, page, count=1)
    return page


def pending_tail(lines):
    return ''.join(l + '\n' for l in lines)


def main():
    mods = load()
    if len(mods) < 10:
        sys.exit('only %d packs found: refusing to rewrite the site' % len(mods))
    path = os.path.join(SITE, 'mark.html')
    tpl = open(path, encoding='utf-8').read()
    if '<div id="mk">' not in tpl or '</div></main>' not in tpl:
        sys.exit('mark.html layout changed: update build_module_pages.py')

    # hub list inside /mark
    inner = re.search(r'<div id="mk">(.*?)</div></main>', tpl, re.S).group(1)
    inner = re.sub(r'<!--seo:start-->.*?<!--seo:end-->', '', inner, flags=re.S)
    hub = tpl.replace('<div id="mk">' + re.search(r'<div id="mk">(.*?)</div></main>', tpl, re.S).group(1) + '</div></main>',
                      '<div id="mk">' + hub_list(mods) + inner + '</div></main>', 1)
    if SEO_CSS not in hub:
        hub = hub.replace('</head>', SEO_CSS + '</head>', 1)
    open(path, 'w', encoding='utf-8').write(hub)

    # one page per pack
    out_dir = os.path.join(SITE, 'm')
    os.makedirs(out_dir, exist_ok=True)
    keep = set()
    for m in mods:
        short, full = UNI.get(m['uni'], UNI['ucl'])
        title = '%s %s practice questions, marked (%s) · Unizy' % (m['code'], m['title'], short)
        desc = clip('%d exam-style practice questions for %s %s at %s%s. Get your answer marked against %s’s grade bands in 30 seconds. First one free, no sign-up.'
                    % (m['n'], m['code'], m['title'], full, (', across %d topics' % len(m['topics'])) if m['topics'] else '', short), 300)
        if m.get('med'):
            title = '%s %s single best answer questions (%s) · Unizy' % (m['code'], m['title'], short)
            desc = clip('%d single best answer practice questions for %s %s at %s%s, with instant feedback and explanations. First one free, no sign-up.'
                        % (m['n'], m['code'], m['title'], full, (', across %d topics' % len(m['topics'])) if m['topics'] else ''), 300)
        url = ORIGIN + '/modules/' + m['code']
        page = meta_swap(tpl, title, desc, url)
        page = re.sub(r'<div id="mk">.*?</div></main>', lambda _: '<div id="mk">' + module_body(m) + '</div></main>', page, count=1, flags=re.S)
        if SEO_CSS not in page:
            page = page.replace('</head>', SEO_CSS + '</head>', 1)
        name = m['code'] + '.html'
        keep.add(name)
        open(os.path.join(out_dir, name), 'w', encoding='utf-8').write(page)
    for f in os.listdir(out_dir):
        if f.endswith('.html') and f not in keep:
            os.remove(os.path.join(out_dir, f))

    # Cloudflare Pages: fixed-path rules must come before wildcard/placeholder ones, or every rule after the first
    # wildcard counts towards the 100 dynamic-rule cap and the rest are silently dropped (this broke /qr once).
    # So the file is rebuilt as: module rules, other fixed rules, then wildcard rules, each keeping its comments.
    rpath = os.path.join(SITE, '_redirects')
    red = open(rpath, encoding='utf-8').read()
    red = re.sub(r'# BEGIN module pages.*?# END module pages\n', '', red, flags=re.S)
    static, dynamic, pending = [], [], []
    for line in red.splitlines():
        if not line.strip():
            continue
        if line.lstrip().startswith('#'):
            pending.append(line)
            continue
        src = line.split()[0]
        (dynamic if ('*' in src or ':' in src) else static).extend(pending + [line])
        pending = []
    if not any(l.split()[0] == '/modules/*' for l in dynamic if not l.startswith('#')):
        sys.exit('catch-all /modules/* rule not found in _redirects')
    block = ['# BEGIN module pages (tools/seo/build_module_pages.py): each full pack has its own page for search engines'] + \
            ['/modules/%s  /m/%s  200' % (m['code'], m['code']) for m in mods] + ['# END module pages']
    rules = [l for l in static + dynamic if not l.startswith('#')]
    n_dyn = sum(1 for l in dynamic if not l.startswith('#'))
    if len(mods) + len(rules) > 2000 or n_dyn > 100:
        sys.exit('too many _redirects rules for Cloudflare Pages')
    open(rpath, 'w', encoding='utf-8').write('\n'.join(block + static + dynamic) + '\n' + pending_tail(pending))

    # sitemap
    urls = ['  <url><loc>%s%s</loc></url>' % (ORIGIN, p) for p in MAIN_PAGES]
    urls += ['  <url><loc>%s/modules/%s</loc>%s</url>' % (ORIGIN, m['code'], ('<lastmod>%s</lastmod>' % m['day']) if m['day'] else '')
             for m in sorted(mods, key=lambda m: m['code'])]
    open(os.path.join(SITE, 'sitemap.xml'), 'w', encoding='utf-8').write(
        '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + '\n'.join(urls) + '\n</urlset>\n')
    print('wrote %d module pages' % len(mods))


if __name__ == '__main__':
    main()
