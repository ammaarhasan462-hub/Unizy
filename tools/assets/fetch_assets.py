#!/usr/bin/env python3
"""CC0 assets from Poly Haven for the intro interiors (runs in GitHub Actions, which has network access).

  python tools/assets/fetch_assets.py catalogue       -> tools/assets/catalogue/*.jpg contact sheets + catalogue.json
  python tools/assets/fetch_assets.py get <ids...>     -> tools/assets/raw/<id>/ (glTF 1k / 2k textures / 1k HDRI)

Everything on Poly Haven is CC0 (public domain): no attribution or fees.
"""
import io, json, os, sys, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
UA = {'User-Agent': 'unizy-intro-builder/1.0 (+https://unizy.uk)'}


def get(url, binary=False):
    data = urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=120).read()
    return data if binary else json.loads(data)


def catalogue():
    from PIL import Image, ImageDraw
    out = os.path.join(HERE, 'catalogue')
    os.makedirs(out, exist_ok=True)
    cat = {}
    for typ in ('models', 'hdris', 'textures'):
        assets = get(f'https://api.polyhaven.com/assets?type={typ}')
        cat[typ] = {k: {'name': v.get('name'), 'categories': v.get('categories', []), 'tags': v.get('tags', [])[:10], 'dims': v.get('dimensions'), 'downloads': v.get('download_count', 0)} for k, v in assets.items()}
    with open(os.path.join(out, 'catalogue.json'), 'w') as f:
        json.dump(cat, f, indent=0)
    # contact sheets: every model; indoor HDRIs; interior-ish textures
    def sheet(name, ids, cols=8, tw=200):
        rows = (len(ids) + cols - 1) // cols
        for part in range(0, rows, 6):
            sub = ids[part * cols:(part + 6) * cols]
            if not sub:
                break
            W = Image.new('RGB', (cols * tw, ((len(sub) + cols - 1) // cols) * (tw + 18)), '#222')
            d = ImageDraw.Draw(W)
            for i, aid in enumerate(sub):
                try:
                    im = Image.open(io.BytesIO(get(f'https://cdn.polyhaven.com/asset_img/thumbs/{aid}.png?width={tw}&height={tw}', True))).convert('RGB')
                    im.thumbnail((tw, tw))
                    W.paste(im, ((i % cols) * tw, (i // cols) * (tw + 18)))
                except Exception as e:  # noqa: BLE001
                    print('thumb fail', aid, e)
                d.text(((i % cols) * tw + 3, (i // cols) * (tw + 18) + tw + 2), aid[:30], fill='#fff')
            W.save(os.path.join(out, f'{name}-{part // 6 + 1}.jpg'), quality=80)
    models = sorted(cat['models'], key=lambda k: (cat['models'][k]['categories'][:1], k))
    sheet('models', models)
    hd = sorted([k for k, v in cat['hdris'].items() if 'indoor' in v['categories']], key=lambda k: -cat['hdris'][k]['downloads'])
    sheet('hdris-indoor', hd)
    want = ('wood', 'floor', 'plaster', 'marble', 'leather', 'fabric', 'carpet', 'paint', 'wall', 'parquet', 'tile')
    tx = sorted([k for k, v in cat['textures'].items() if any(w in k or any(w in c for c in v['categories']) for w in want)], key=lambda k: -cat['textures'][k]['downloads'])[:144]
    sheet('textures-interior', tx)
    print('models', len(models), 'indoor hdris', len(hd), 'interior textures', len(tx))


def fetch(ids):
    for aid in ids:
        files = get(f'https://api.polyhaven.com/files/{aid}')
        d = os.path.join(HERE, 'raw', aid)
        os.makedirs(d, exist_ok=True)
        if 'gltf' in files:
            res = '1k' if '1k' in files['gltf'] else sorted(files['gltf'])[0]
            g = files['gltf'][res]['gltf']
            with open(os.path.join(d, f'{aid}.gltf'), 'wb') as f:
                f.write(get(g['url'], True))
            for rel, inc in g.get('include', {}).items():
                p = os.path.join(d, rel)
                os.makedirs(os.path.dirname(p), exist_ok=True)
                with open(p, 'wb') as f:
                    f.write(get(inc['url'], True))
            print('model', aid, res)
        elif 'hdri' in files:
            u = files['hdri']['1k']['hdr']['url']
            with open(os.path.join(d, f'{aid}_1k.hdr'), 'wb') as f:
                f.write(get(u, True))
            print('hdri', aid)
        else:
            for mp, key in (('Diffuse', 'diff'), ('nor_gl', 'nor'), ('Rough', 'rough'), ('AO', 'ao')):
                if mp in files and '1k' in files[mp]:
                    with open(os.path.join(d, f'{aid}_{key}_1k.jpg'), 'wb') as f:
                        f.write(get(files[mp]['1k']['jpg']['url'], True))
            print('texture', aid)


if __name__ == '__main__':
    if sys.argv[1] == 'catalogue':
        catalogue()
    else:
        fetch(sys.argv[2:])
