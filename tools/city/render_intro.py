"""Render intro frames from the built site/ with headless Chrome (swiftshader).
Usage: [UNI=imperial] [SHOTS=dir] [PROGS=1] python3 tools/city/render_intro.py desktop|mobile 0.25,0.36,0.56  -> /tmp/shots/in-*.png
Also prints the lag numbers for each frame (compare before and after; software rendering is slow, so only the change counts):
  intro starts (s: the clouds, right after the pick), engine up (s: the city built and shown), shader programs, city vertices (a far LOD copy that shares its near mesh's vertices counts once), and per frame: ms between frames, draw calls and triangles per frame."""
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
SHOTS=os.environ.get("SHOTS","/tmp/shots")
os.makedirs(SHOTS, exist_ok=True)
S=SHOTS+"/in-"+("" if UNI=="ucl" else UNI[:3]+"-")
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
    print("intro starts after %.1fs"%(time.time()-t))
    # the city streams in behind the clouds: 'engine up' is when it is built and shown (state.worldReady)
    pg.wait_for_function("window.__smgIntro.state.worldReady !== false", timeout=240000)
    print("engine up after %.1fs"%(time.time()-t))
    # lag probe: count draw calls and triangles over every render() call in a frame, and time the frames
    pg.evaluate("""(() => { const r = window.__smgIntro.debug.renderer, o = r.render.bind(r); window.__lag = { calls: 0, tris: 0 };
      r.render = (s, c) => { o(s, c); window.__lag.calls += r.info.render.calls; window.__lag.tris += r.info.render.triangles; }; })()""")
    print("lag programs %d, vertices %d (city %d)" % tuple(pg.evaluate("""(() => { const r = window.__smgIntro.debug.renderer; let v = 0, cv = 0;
      window.__smgIntro.debug.scene.traverse((o) => { if (o.isMesh && o.geometry && o.geometry.attributes.position && !o.userData.lodCopy) { const n = o.geometry.attributes.position.count * (o.isInstancedMesh ? o.count : 1); v += n;
        const k = o.material && o.material.userData && o.material.userData.key; if (k && String(k).startsWith('city')) cv += n; } });
      return [r.info.programs.length, v, cv]; })()""")))
    print("docks %s" % pg.evaluate("(() => { let n = null; window.__smgIntro.debug.scene.traverse((o) => { if (o.userData && o.userData.docks != null) n = o.userData.docks; }); return n; })()"))
    LAG = """() => new Promise((res) => { const ts = []; let calls = 0, tris = 0, n = 0;
      const f = (t) => { ts.push(t); if (n > 0) { calls += window.__lag.calls; tris += window.__lag.tris; } window.__lag.calls = 0; window.__lag.tris = 0; n++;
        if (n < 6) requestAnimationFrame(f); else { const d = ts.slice(1).map((x, i) => x - ts[i]).sort((a, b) => a - b);
          res([d[Math.floor(d.length / 2)], calls / (n - 1), tris / (n - 1)]); } };
      window.__lag.calls = 0; window.__lag.tris = 0; requestAnimationFrame(f); })"""
    pg.wait_for_timeout(3000)
    for v in ps:
        if v.startswith("f"):
            pg.evaluate(f"window.__smgIntro.jump(0); window.__smgIntro.state.forceFlash={int(v[1:])}")
            pg.wait_for_timeout(int(__import__("os").environ.get("WAITMS","2600")))
            pg.screenshot(path=S+name+f"-flash{v[1:]}.png"); pg.evaluate("window.__smgIntro.state.forceFlash=null"); continue
        fv=float(v)
        pg.evaluate(f"window.__smgIntro.jump({fv})"); pg.wait_for_timeout(int(__import__("os").environ.get("WAITMS","2600")))
        pg.screenshot(path=S+name+f"-{int(fv*1000):04d}.png")
        ms, calls, tris = pg.evaluate(LAG)
        print("lag at %s: %.0f ms a frame, %d draw calls, %.2fM triangles" % (v, ms, calls, tris / 1e6), flush=True)
    # optional close-ups from fixed cameras (CAMS="x,y,z,lx,ly,lz;..." in the intro's metres, lit as at CAMP, default 0.47)
    for i, cam in enumerate([c for c in os.environ.get("CAMS", "").split(";") if c.strip()]):
        x, y, z, lx, ly, lz = [float(v) for v in cam.split(",")]
        pg.evaluate(f"window.__smgIntro.jump({float(os.environ.get('CAMP', '0.47'))})")
        pg.evaluate("""([x, y, z, lx, ly, lz]) => { const r = window.__smgIntro.debug.renderer, o = r.render;
          r.render = (s, c) => { if (c.isPerspectiveCamera && !c.__ov && !window.__camC) { window.__camC = c; const u = c.updateMatrixWorld.bind(c); c.__ov = true;
            c.updateMatrixWorld = (f) => { const v = window.__camO; if (v && c === window.__camC) { c.position.set(v[0], v[1], v[2]); c.up.set(0, 1, 0); c.lookAt(v[3], v[4], v[5]); } u(f); }; }
            o(s, c); };
          window.__camO = [x, y, z, lx, ly, lz]; }""", [x, y, z, lx, ly, lz])
        pg.wait_for_timeout(int(os.environ.get("WAITMS", "2600")) + 1500)
        pg.screenshot(path=S + name + f"-cam{i}.png")
    # programs again at the end: textures and furniture load in the background, so the start-up count varies run to run
    print("lag programs at end %d" % pg.evaluate("window.__smgIntro.debug.renderer.info.programs.length"))
    # PROGS=1: the programs by shader type, and the haze-patched ones by their cache key's custom part
    if os.environ.get("PROGS"):
        for n, c in pg.evaluate("""(() => { const m = new Map(); window.__smgIntro.debug.renderer.info.programs.forEach((p) => {
          const k = p.cacheKey || '', a = k.match(/atmo[^,]*/); const n = p.name + (a ? ' ' + a[0] : '');
          m.set(n, (m.get(n) || 0) + 1); }); return [...m.entries()].sort((a, b) => b[1] - a[1]); })()"""):
            print("  program %3d  %s" % (c, n))
    print("classes", pg.evaluate("document.documentElement.className"))
    if len(sys.argv)>3:
        pg.click("[data-testid=intro-skip]"); pg.wait_for_timeout(1500)
        print("after skip", pg.evaluate("document.documentElement.className"), pg.evaluate("!!document.getElementById('intro-root')"))
        pg.screenshot(path=S+name+"-after.png")
    b.close()
print("errors", errs[:8])
