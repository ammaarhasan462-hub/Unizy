"""Render intro frames from the built site/ with headless Chrome (swiftshader).
Usage: [UNI=imperial] python3 tools/city/render_intro.py desktop|mobile 0.25,0.36,0.56  -> /tmp/shots/in-*.png"""
import http.server, socketserver, threading, sys, time, os
from playwright.sync_api import sync_playwright
SITE=os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "site")
class H(http.server.SimpleHTTPRequestHandler):
    def __init__(s,*a,**k): super().__init__(*a,directory=SITE,**k)
    def log_message(s,*a): pass
srv=socketserver.ThreadingTCPServer(("127.0.0.1",0),H); B=f"http://127.0.0.1:{srv.server_address[1]}"
threading.Thread(target=srv.serve_forever,daemon=True).start()
errs=[]
def route(r):
    u=r.request.url
    if u.startswith(B): return r.continue_()
    if "public_reviews" in u: return r.fulfill(json={"count":0})
    return r.fulfill(status=204, body="")
import os
UNI=os.environ.get("UNI","ucl")
os.makedirs("/tmp/shots", exist_ok=True)
S="/tmp/shots/in-"+("" if UNI=="ucl" else UNI[:3]+"-")
vp = {"width":1280,"height":800} if (len(sys.argv)<2 or sys.argv[1]!="mobile") else {"width":390,"height":844}
name = "m" if vp["width"]<500 else "d"
ps=[x for x in (sys.argv[2].split(",") if len(sys.argv)>2 else "0,0.14,0.25,0.36,0.47,0.56,0.64,0.73,0.82,0.95".split(","))]
with sync_playwright() as p:
    b=p.chromium.launch(executable_path="/usr/bin/google-chrome",args=["--no-sandbox","--use-angle=swiftshader","--enable-unsafe-swiftshader","--ignore-gpu-blocklist"])
    c=b.new_context(viewport=vp, device_scale_factor=1); c.route("**/*",route); pg=c.new_page(); pg.set_default_timeout(240000)
    pg.on("pageerror",lambda e: errs.append(f"pageerror: {e}"))
    pg.on("console",lambda m: errs.append(f"console {m.type}: {m.text[:600]}") if m.type=="error" or ("THREE" in m.text) else None)
    t=time.time(); pg.goto(B+"/?intro=1"); 
    pg.wait_for_function("window.__smgIntro && window.__smgIntro.state", timeout=60000)
    pg.wait_for_timeout(2500); pg.screenshot(path=S+name+"-picker.png")
    pg.evaluate(f"window.__smgIntroPick && window.__smgIntroPick('{UNI}')"); pg.wait_for_timeout(1200)
    pg.wait_for_function("window.__smgIntro && window.__smgIntro.state && window.__smgIntro.state.beginAt != null", timeout=240000)
    print("engine up after %.1fs"%(time.time()-t))
    pg.wait_for_timeout(3000)
    for v in ps:
        if v.startswith("f"):
            pg.evaluate(f"window.__smgIntro.jump(0); window.__smgIntro.state.forceFlash={int(v[1:])}")
            pg.wait_for_timeout(int(__import__("os").environ.get("WAITMS","2600")))
            pg.screenshot(path=S+name+f"-flash{v[1:]}.png"); pg.evaluate("window.__smgIntro.state.forceFlash=null"); continue
        fv=float(v)
        pg.evaluate(f"window.__smgIntro.jump({fv})"); pg.wait_for_timeout(int(__import__("os").environ.get("WAITMS","2600")))
        pg.screenshot(path=S+name+f"-{int(fv*1000):04d}.png")
    print("classes", pg.evaluate("document.documentElement.className"))
    if len(sys.argv)>3:
        pg.click("[data-testid=intro-skip]"); pg.wait_for_timeout(1500)
        print("after skip", pg.evaluate("document.documentElement.className"), pg.evaluate("!!document.getElementById('intro-root')"))
        pg.screenshot(path=S+name+"-after.png")
    b.close()
print("errors", errs[:8])
