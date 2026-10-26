"""Validate Unizy module packs. Usage: python3 validate.py <id> [<id> ...] | --all"""
import json, os, re, sys, glob

BASE = '/tmp/claude-0/-home-claude/6faa0a17-cb58-57d6-a184-d928761af053/scratchpad/coverage'
WL = {e['id']: e for e in json.load(open(BASE + '/worklist.json'))}


def check(pid):
    errs, warns = [], []
    p = BASE + '/packs/' + pid + '.json'
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
