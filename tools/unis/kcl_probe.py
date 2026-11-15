"""Discovery probe for King's module pages (writes raw HTML samples to tools/unis/out/probe/)."""
import os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from kcl_modules import get, sitemaps, OUT
P = os.path.join(OUT, 'probe'); os.makedirs(P, exist_ok=True)
urls = sitemaps()
sm = [u for u in urls if '/study/modules/' in u]
open(os.path.join(P, 'study-modules-urls.txt'), 'w').write('\n'.join(sm))
for i, u in enumerate(['https://www.kcl.ac.uk/abroad/module-options/browse.aspx', 'https://www.kcl.ac.uk/abroad/module-options/search.aspx',
                       'https://www.kcl.ac.uk/abroad/module-options/module.aspx'] + sm[:3]):
    h = get(u) or ''
    open(os.path.join(P, f'p{i}.html'), 'w').write(h)
    print(u, len(h), len(re.findall(r'href="([^"]+)"', h)))
