"""Validate Unizy module packs. Usage: python3 validate.py <id> [<id> ...] | --all"""
import json, os, re, sys, glob

BASE = '/tmp/claude-0/-home-claude/6faa0a17-cb58-57d6-a184-d928761af053/scratchpad/coverage'
WL = {e['id']: e for e in json.load(open(BASE + '/worklist.json'))}

SECK = {'core', 'mechanism', 'features', 'investigations', 'management', 'clinical', 'misconceptions'}
CARDK = {'recall', 'mechanism', 'why', 'distinguish', 'interpret', 'apply'}
LETTER = re.compile(r'\b[Oo]ptions? [A-D]\b|(?:^|\s)\([A-D]\)|\b[A-D] (?:is|are) (?:wrong|incorrect|right|correct|the answer)\b')


def _mcq(q, where, errs, nopt=None):
    o = q.get('options')
    if not isinstance(o, list) or len(o) < 3 or len(set(map(str, o))) != len(o):
        errs.append(where + ' options'); return
    if not isinstance(q.get('answer'), int) or not 0 <= q['answer'] < len(o):
        errs.append(where + ' answer index')
    if not q.get('why') or LETTER.search(str(q.get('why', ''))):
        errs.append(where + ' why missing or names options by letter')


def check_med(d, errs, warns):
    n = len(d['topics'])
    srcn = len(d.get('sources', []))
    if not re.match(r'^\d{4}-\d{2}-\d{2}$', str(d.get('reviewed', ''))):
        errs.append('med2: reviewed date YYYY-MM-DD required')
    for i, nt in enumerate(d['notes']):
        w = 'notes[%d]' % i
        if not nt.get('overview') or len(str(nt['overview']).split()) > 70:
            errs.append(w + ' overview missing or over 70 words')
        ob = nt.get('objectives')
        if not isinstance(ob, list) or not 3 <= len(ob) <= 6:
            errs.append(w + ' needs 3-6 objectives')
        secs = nt.get('sections')
        if not isinstance(secs, list) or not secs:
            errs.append(w + ' sections missing'); continue
        ks = [x.get('k') for x in secs]
        for req in ('core', 'mechanism', 'clinical', 'misconceptions'):
            if req not in ks:
                errs.append(w + ' missing section ' + req)
        for j, sx in enumerate(secs):
            ww = w + '.sections[%d]' % j
            if sx.get('k') not in SECK:
                errs.append(ww + ' bad k')
            if not sx.get('h') or not sx.get('body'):
                errs.append(ww + ' needs h and body')
            if sx.get('kind') not in ('principle', 'guidance'):
                errs.append(ww + ' kind must be principle or guidance')
            if sx.get('kind') == 'guidance' and not re.match(r'^\d{4}-\d{2}$', str(sx.get('asOf', ''))):
                errs.append(ww + ' guidance needs asOf YYYY-MM')
            src = sx.get('src')
            if not isinstance(src, list) or not src or not all(isinstance(k, int) and 0 <= k < srcn for k in src):
                errs.append(ww + ' src must list valid source indices')
    for i, c in enumerate(d['cards']):
        if c.get('kind') not in CARDK:
            errs.append('cards[%d] kind' % i)
        if c.get('sec') not in SECK:
            errs.append('cards[%d] sec' % i)
        if not c.get('ex'):
            errs.append('cards[%d] ex (explanation if wrong) missing' % i)
        if 'q' in c and not (isinstance(c['q'], int) and 0 <= c['q'] < len(d['questions'])):
            errs.append('cards[%d] q index' % i)
    per = {}
    for c in d['cards']:
        if isinstance(c.get('t'), int):
            per.setdefault(c['t'], []).append(c.get('kind'))
    for t, ks in per.items():
        if ks.count('recall') > 2:
            warns.append('topic %d has %d recall cards (aim for at most 2)' % (t, ks.count('recall')))
    stages = {}
    for i, q in enumerate(d['questions']):
        w = 'questions[%d]' % i
        if q.get('sec') not in SECK:
            errs.append(w + ' sec')
        if not q.get('concept'):
            errs.append(w + ' concept')
        if q.get('type') != 'mcq':
            continue
        if q.get('stage') not in ('retrieve', 'apply'):
            errs.append(w + ' stage')
        stages.setdefault(q.get('t'), []).append(q.get('stage'))
        ow = q.get('optWhy')
        if not isinstance(ow, list) or len(ow) != len(q.get('options') or []) or not all(ow):
            errs.append(w + ' optWhy needs one entry per option')
        elif any(LETTER.search(str(x)) for x in ow):
            errs.append(w + ' optWhy names options by letter')
        if not q.get('clue'):
            errs.append(w + ' clue')
        fu = q.get('followUp')
        if not isinstance(fu, dict):
            errs.append(w + ' followUp missing')
        else:
            _mcq(fu, w + '.followUp', errs)
    for t in range(n):
        st = stages.get(t, [])
        if st.count('retrieve') < 1 or st.count('apply') < 2:
            errs.append('topic %d needs >=1 retrieve and >=2 apply MCQs' % t)
    for i, cs in enumerate(d.get('cases', [])):
        if not cs.get('title') or not isinstance(cs.get('steps'), list) or len(cs['steps']) < 3:
            errs.append('cases[%d] needs title and 3+ steps' % i); continue
        for j, st in enumerate(cs['steps']):
            if not st.get('text'):
                errs.append('cases[%d].steps[%d] text' % (i, j))
            if st.get('ask'):
                _mcq(st['ask'], 'cases[%d].steps[%d].ask' % (i, j), errs)
    for i, o in enumerate(d.get('osce', [])):
        if not o.get('title') or not isinstance(o.get('steps'), list) or len(o['steps']) < 5:
            errs.append('osce[%d] needs title and 5+ steps' % i)
    for i, it in enumerate(d.get('interpret', [])):
        w = 'interpret[%d]' % i
        if it.get('kind') not in ('bloods', 'ecg', 'abg'):
            errs.append(w + ' kind'); continue
        if it['kind'] == 'ecg':
            e = it.get('ecg') or {}
            if e.get('rhythm') not in ('sinus', 'af', 'flutter', 'chb', 'first_degree') or not isinstance(e.get('rate'), (int, float)):
                errs.append(w + ' ecg rhythm/rate')
        elif not isinstance(it.get('rows'), list) or not it['rows'] or not all(isinstance(r, list) and len(r) == 4 for r in it['rows']):
            errs.append(w + ' rows must be [name, value, unit, range]')
        _mcq(it, w, errs)
        ow = it.get('optWhy')
        if not isinstance(ow, list) or len(ow) != len(it.get('options') or []):
            errs.append(w + ' optWhy')
    HEART = {'ra', 'rv', 'la', 'lv', 'tricuspid', 'mitral', 'pulmonary', 'aortic', 'septum', 'svc', 'ivc', 'aorta', 'pa', 'pv'}
    for i, lb in enumerate(d.get('labels', [])):
        if lb.get('diagram') != 'heart' or not lb.get('items') or not set(lb['items']) <= HEART:
            errs.append('labels[%d] diagram must be heart with known items' % i)


def check(pid):
    errs, warns = [], []
    p = pid if pid.endswith('.json') else BASE + '/packs/' + pid + '.json'
    if pid.endswith('.json'):
        pid = os.path.basename(pid)[:-5]
    if not os.path.exists(p):
        return ['missing file'], []
    try:
        d = json.load(open(p))
    except Exception as e:
        return ['invalid JSON: ' + str(e)], []
    for k in ('id', 'title', 'kind', 'module', 'topicsSource', 'sources', 'about', 'topics', 'notes', 'cards', 'questions'):
        if k not in d:
            errs.append('missing key ' + k)
    if errs:
        return errs, warns
    if re.search(r'worklist', json.dumps(d), re.I):
        errs.append('pack text mentions our internal worklist; describe sources without it')
    if d['id'] != pid:
        errs.append('id mismatch')
    if pid in WL and d['module'].get('name') != WL[pid]['name']:
        warns.append('module name differs from worklist: %r vs %r' % (d['module'].get('name'), WL[pid]['name']))
    if d['kind'] not in ('content', 'guide'):
        errs.append('kind must be content or guide')
    if d['topicsSource'] not in ('official', 'description', 'researched'):
        errs.append('topicsSource must be official, researched or description')
    if not isinstance(d['sources'], list) or not d['sources'] or not all(isinstance(s, dict) and str(s.get('url', '')).startswith('http') for s in d['sources']):
        errs.append('sources must be a non-empty list of {title,url,used_for}')
    T = d['topics']
    if not isinstance(T, list) or not T or not all(isinstance(t, str) and t.strip() for t in T):
        errs.append('topics must be non-empty strings')
        return errs, warns
    n = len(T)
    content = d['kind'] == 'content'
    if content and not (4 <= n <= 14):
        warns.append('content pack has %d topics' % n)
    tl = lambda x: isinstance(x.get('t'), int) and 0 <= x['t'] < n
    noted = set()
    for i, nt in enumerate(d['notes']):
        if not tl(nt):
            errs.append('notes[%d] bad t' % i)
            continue
        noted.add(nt['t'])
        w = len(str(nt.get('body', '')).split())
        if not nt.get('h'):
            errs.append('notes[%d] no heading' % i)
        if content and w < 220:
            errs.append('notes[%d] too short (%d words)' % (i, w))
        if w > 1100:
            warns.append('notes[%d] long (%d words)' % (i, w))
        if re.search(r'\\(frac|sum|int|alpha|beta|theta|mathrm|begin)|\$\$', nt.get('body', '')):
            errs.append('notes[%d] contains LaTeX' % i)
    if content:
        miss = [t for t in range(n) if t not in noted]
        if miss:
            errs.append('topics without a note: %s' % miss)
    for i, c in enumerate(d['cards']):
        if not tl(c):
            errs.append('cards[%d] bad t' % i)
        if not c.get('f') or not c.get('b'):
            errs.append('cards[%d] empty side' % i)
        if len(str(c.get('b', ''))) > 420:
            warns.append('cards[%d] long back' % i)
    fronts = [str(c.get('f', '')).strip().lower() for c in d['cards']]
    if len(set(fronts)) < len(fronts):
        warns.append('duplicate card fronts')
    nm = ns = nl = 0
    for i, q in enumerate(d['questions']):
        if not tl(q):
            errs.append('questions[%d] bad t' % i)
        ty = q.get('type')
        if ty == 'mcq':
            nm += 1
            o = q.get('options')
            if not isinstance(o, list) or len(o) < 3 or len(set(map(str, o))) != len(o):
                errs.append('questions[%d] mcq options' % i)
            elif not isinstance(q.get('answer'), int) or not 0 <= q['answer'] < len(o):
                errs.append('questions[%d] mcq answer index' % i)
            if not q.get('why'):
                errs.append('questions[%d] mcq missing why' % i)
            elif re.search(r'\b[Oo]ptions? [A-D]\b|(?:^|\s)\([A-D]\)|\b[A-D] (?:is|are) (?:wrong|incorrect|right|correct|the answer)\b', q['why']):
                errs.append('questions[%d] why refers to options by letter (the app shuffles options: name them by content instead)' % i)
        elif ty in ('short', 'long'):
            ns += ty == 'short'
            nl += ty == 'long'
            if not isinstance(q.get('markScheme'), list) or len(q['markScheme']) < 2:
                errs.append('questions[%d] markScheme' % i)
            if not q.get('modelAnswer'):
                errs.append('questions[%d] modelAnswer' % i)
            if not isinstance(q.get('marks'), int) or q['marks'] < 2:
                errs.append('questions[%d] marks' % i)
        else:
            errs.append('questions[%d] bad type' % i)
        if not q.get('q'):
            errs.append('questions[%d] empty question' % i)
    if d.get('format') == 'med2':
        check_med(d, errs, warns)
    if content:
        if len(d['cards']) < 4 * n:
            errs.append('too few cards (%d for %d topics)' % (len(d['cards']), n))
        if nm < n:
            errs.append('too few mcqs (%d)' % nm)
        if ns < max(3, n // 2):
            errs.append('too few short questions (%d)' % ns)
        if nl < 2:
            errs.append('needs 2 long questions')
    else:
        if len(d['notes']) < 2:
            errs.append('guide needs 2+ notes')
    return errs, warns


if __name__ == '__main__':
    ids = sys.argv[1:]
    if ids == ['--all']:
        ids = sorted(os.path.basename(f)[:-5] for f in glob.glob(BASE + '/packs/*.json'))
    bad = 0
    for pid in ids:
        e, w = check(pid)
        if e:
            bad += 1
            print(pid, 'ERRORS:', '; '.join(e[:12]))
        else:
            print(pid, 'OK' + (' (warnings: ' + '; '.join(w[:6]) + ')' if w else ''))
    sys.exit(1 if bad else 0)
