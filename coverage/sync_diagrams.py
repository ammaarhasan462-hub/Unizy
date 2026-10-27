"""Copy coverage/diagrams.js (medical diagrams, ECG strips, topic content hash) into the app and the reviewer page.
Run after editing coverage/diagrams.js: python3 coverage/sync_diagrams.py"""
import os, re
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
src = open(os.path.join(root, 'coverage', 'diagrams.js')).read()
lib = src.replace('const DIAG = (() => {', 'const UZDIAG = (() => {').replace("if (typeof module !== 'undefined') module.exports = DIAG;", '').strip() + '\n'
app = os.path.join(root, 'site', 'app.html')
s = open(app).read()
s = re.sub(r'(// UZDIAG:BEGIN[^\n]*\n).*?(// UZDIAG:END)', lambda m: m.group(1) + lib + m.group(2), s, count=1, flags=re.S)
open(app, 'w').write(s)
open(os.path.join(root, 'site', 'assets', 'diagrams.js'), 'w').write('/* Generated from coverage/diagrams.js by coverage/sync_diagrams.py. */\n' + lib + 'window.UZDIAG = UZDIAG;\n')
print('synced', len(lib), 'bytes')
