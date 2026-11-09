"""Builds the marker pages (site/index.html home page and site/mark.html) from one place.

The brand name lives in BRAND below: change it here and re-run `python3 tools/build_marker_pages.py`
to rename the home page and marker. (Other pages still say Unizy until the full rename.)
"""
import json
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent.parent
SITE = ROOT / "site"

BRAND = "Unizy"
DOMAIN = "unizy.uk"
MARK = BRAND[:1]
TAGLINE = "The mark scheme your uni never gave you."

cfg = re.search(r"<script>window.UNIZY_CONFIG=(\{.*?\});", (SITE / "pricing.html").read_text()) or re.search(r"<script>window.UNIZY_CONFIG=(\{\"supabaseUrl.*?\}\});", (SITE / "faq.html").read_text())
CONFIG = cfg.group(1)


def head(title, desc, path, extra_css=""):
    return f"""<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>{title}</title><meta name="description" content="{desc}"><meta property="og:title" content="{title}"><meta property="og:description" content="{desc}"><meta property="og:type" content="website"><link rel="canonical" href="https://{DOMAIN}{path}"><meta property="og:url" content="https://{DOMAIN}{path}"><meta property="og:image" content="https://{DOMAIN}/assets/og.png"><meta name="twitter:card" content="summary_large_image"><meta name="theme-color" content="#17302A"><link rel="icon" href="/assets/favicon.svg" type="image/svg+xml"><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400..700&family=Fraunces:opsz,wght@9..144,500..700&family=DM+Mono:wght@400;500&display=swap"><link rel="stylesheet" href="/assets/home.css?v=16"><link rel="stylesheet" href="/assets/site.css?v=2"><link rel="stylesheet" href="/assets/mark.css?v=2">{extra_css}</head><body class="sx">
<a class="skip" href="#main">Skip to content</a>"""


def header(current):
    links = [("/", "Home"), ("/mark", "Find your module"), ("/#how", "How it works"), ("/pricing", "Pricing"), ("/faq", "FAQ")]
    nav = "".join(f'<a href="{h}"{" aria-current=\"page\"" if h == current else ""}>{t}</a>' for h, t in links)
    return f"""<header class="sx-top"><div class="sx-bar">
<a class="sx-brand" href="/" aria-label="{BRAND} home"><span class="sx-mark">{MARK}</span><span class="sx-word">{BRAND}</span></a>
<nav class="sx-nav" id="sx-nav" aria-label="Main">{nav}</nav>
<div class="sx-act"><a class="sx-login" href="/login?next=/dashboard" data-auth="login">Log in</a><a class="sx-cta" href="/signup" data-auth="app" data-ev="nav_signup">Sign up free</a><button class="sx-menu" type="button" aria-expanded="false" aria-controls="sx-nav"><span></span><span></span><span class="sr">Menu</span></button></div>
</div></header>"""


def footer():
    return f"""<footer class="sx-foot"><div class="sx-foot-in">
<div class="sx-foot-brand"><a class="sx-brand" href="/"><span class="sx-mark">{MARK}</span><span class="sx-word">{BRAND}</span></a><p>{TAGLINE} Exam practice and marking for UCL students.</p></div>
<nav class="sx-foot-col" aria-label="Product"><span>Product</span><a href="/mark">Find your module</a><a href="/#how">How it works</a><a href="/pricing">Pricing</a><a href="/dashboard">Dashboard</a></nav>
<nav class="sx-foot-col" aria-label="About"><span>About</span><a href="/trust">Trust &amp; safety</a><a href="/reviews">Reviews</a><a href="/faq">FAQ</a></nav>
<nav class="sx-foot-col" aria-label="Legal"><span>Legal</span><a href="/privacy.html">Privacy</a><a href="/terms.html">Terms</a><a href="mailto:hello@{DOMAIN}">Contact</a></nav>
</div>
<div class="sx-foot-fine"><span>{BRAND} is an independent revision tool for UCL students. It is not affiliated with or endorsed by UCL. Marks are practice estimates, not official marks. Practice questions are written for revision and are not taken from UCL exam papers.</span><span>© 2026 {BRAND}</span></div>
</footer>"""


def scripts(*names):
    return f'<script>window.UNIZY_CONFIG={CONFIG};window.SITE_BRAND={json.dumps({"name": BRAND})};</script><script src="/assets/site.js?v=2"></script>' + "".join(f'<script src="/assets/{n}"></script>' for n in names)


MARK_PAGE = head(f"Find your UCL module · practice questions and marking · {BRAND}",
                 "Every UCL module. Practise an exam-style question, get it marked against your department's grade descriptors, and see what a First looks like.",
                 "/mark") + header("/mark") + """
<main id="main" class="mk-wrap"><div id="mk"><noscript>Turn on JavaScript to search UCL modules and get answers marked.</noscript></div></main>
""" + footer() + scripts("mark.js?v=2") + "</body></html>\n"

HOME = f"""<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>{BRAND} · {TAGLINE}</title><meta name="description" content="At A-level you had mark schemes. At UCL you don't. Write an answer to an exam question in your module and get it marked against your department's own grading criteria, with the changes that would move you up a class."><meta property="og:title" content="{BRAND} · {TAGLINE}"><meta property="og:description" content="Exam practice and marking for every UCL module."><meta property="og:type" content="website"><link rel="canonical" href="https://{DOMAIN}/"><meta property="og:url" content="https://{DOMAIN}/"><meta property="og:image" content="https://{DOMAIN}/assets/og.png"><meta name="twitter:card" content="summary_large_image"><meta name="theme-color" content="#06060b"><link rel="icon" href="/assets/favicon.svg" type="image/svg+xml"><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap"><link rel="stylesheet" href="/assets/landing.css?v=2"></head>
<body class="lp">
<a class="skip" href="#main">Skip to content</a>
<div class="bg" aria-hidden="true"><div class="grid"></div><div class="glow g1"></div><div class="glow g2"></div><div class="glow g3"></div></div>

<header class="nav"><div class="wrap nav-in">
<a class="brand" href="/" aria-label="{BRAND} home"><span class="brand-mark">{MARK}</span>{BRAND}</a>
<nav class="nav-links" id="nav-links" aria-label="Main"><a href="#how">How it works</a><a href="#features">Features</a><a href="/mark">Find your module</a><a href="#pricing">Pricing</a><a href="#faq">FAQ</a></nav>
<div class="nav-act"><a class="nav-login" href="/login?next=/dashboard" data-auth="login">Log in</a><a class="btn btn-glow sm" href="/signup" data-auth="app" data-ev="lp_nav_signup">Sign up free</a><button class="nav-menu" type="button" aria-label="Menu" aria-expanded="false" aria-controls="nav-links"><span></span><span></span></button></div>
</div></header>

<main id="main">
<section class="hero"><div class="wrap hero-in">
<div>
<span class="pill fade"><b>New</b> Every UCL module, marked like your department marks</span>
<h1><span data-split="0.1">The mark scheme</span><br><span data-split="0.35">your uni</span> <span class="grad" data-split="0.5">never gave you.</span></h1>
<p class="lead fade d1">Write an answer to any exam question in your module. {BRAND} marks it against <strong>your department’s own grading criteria</strong>, tells you your class, and shows you exactly what would move you up one.</p>
<div class="ctas fade d2"><a class="btn btn-glow lg" href="/signup" data-ev="lp_hero_signup">Get my first answer marked, free</a><a class="btn btn-ghost lg" href="#how">See how it works</a></div>
<div class="trust fade d3"><span><i></i>All 6,682 UCL modules</span><span><i></i>Free 7-day Pro trial</span><span><i></i>No card needed</span></div>
</div>
<div class="scene fade d2" aria-label="Interactive 3D preview of the {BRAND} dashboard. Drag to rotate." role="img">
<div class="halo"></div>
<div class="stage">
<div class="face ui">
<div class="ui-side"><div class="ui-logo"><i></i>{BRAND}</div><div class="ui-nav on">Home</div><div class="ui-nav">Practice &amp; marking</div><div class="ui-nav">Tutor</div><div class="ui-nav">Marked answers</div><div class="ui-mods">My modules</div><div class="ui-mod">ECON0013</div><div class="ui-mod">HIST0003</div><div class="ui-mod">POLS0006</div></div>
<div class="ui-main"><div class="ui-h">Hi Sam</div><div class="ui-stats"><div class="ui-stat"><b>14</b><span>answers marked</span></div><div class="ui-stat"><b>2:1</b><span>average class</span></div><div class="ui-stat"><b>71</b><span>best mark</span></div></div>
<div class="ui-cards"><div class="ui-card"><code>ECON0013</code><p>Microeconomics</p><div class="ui-bar"><i style="width:72%"></i></div></div><div class="ui-card"><code>HIST0003</code><p>Approaching History</p><div class="ui-bar"><i style="width:48%"></i></div></div><div class="ui-card"><code>POLS0006</code><p>Introduction to Politics</p><div class="ui-bar"><i style="width:60%"></i></div></div><div class="ui-card"><code>ECON0002</code><p>Economics</p><div class="ui-bar"><i style="width:35%"></i></div></div></div></div>
</div>
<div class="face back"><div><b>{BRAND}</b><span>Marked like your department marks.</span></div></div>
<div class="fc fc-verdict" data-z="150" data-x="-200"><span class="cls">2:1</span><div><small>ECON0013 · predicted</small><b>62–66</b></div></div>
<div class="fc fc-changes" data-z="110" data-x="220"><small>3 changes to move up a class</small><ol><li>Derive MR = P(1 + 1/ε) first</li><li>Add the labelled diagram</li><li>End with the intuition</li></ol></div>
<div class="fc fc-tutor" data-z="190" data-x="-200"><div class="who"><i></i>Professor UCL</div><p>Start with the definition, then show why MR &lt; P for a monopolist…</p></div>
<div class="fc fc-chart" data-z="70" data-x="200"><small>Your marks</small><svg viewBox="0 0 200 56" aria-hidden="true"><defs><linearGradient id="lg1" x1="0" x2="1"><stop offset="0" stop-color="#8B5CF6"/><stop offset="1" stop-color="#22D3EE"/></linearGradient></defs><polyline points="4,44 40,40 76,34 112,30 148,20 196,8" fill="none" stroke="url(#lg1)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><circle cx="196" cy="8" r="4" fill="#22D3EE"/></svg></div>
<div class="fc fc-mod" data-z="-90" data-x="20"><small>Module hub</small><code>HIST0003</code> Approaching History</div>
</div>
<p class="scene-hint"><svg viewBox="0 0 24 24"><path d="M7 12h10M7 12l3-3M7 12l3 3M17 12l-3-3M17 12l-3 3"/></svg>Drag to rotate · <button type="button" id="spin" style="all:unset;cursor:pointer;color:#C4B5FD">spin 360°</button></p>
</div>
</div></section>

<section class="strip"><div class="wrap strip-in">
<div><b data-count="6682">6,682</b><span>UCL modules, from the official catalogue</span></div>
<div><b data-count="81">81</b><span>UCL departments covered</span></div>
<div><b data-count="10">10</b><span>sets of marking criteria (UCL-wide + 9 departments)</span></div>
<div><b data-count="3">3</b><span>concrete changes on every marked answer</span></div>
</div></section>

<section class="sec"><div class="wrap">
<span class="kick rv">The gap</span>
<p class="big-quote" style="margin-top:20px">At A-level you had past papers and mark schemes. At UCL you get the papers, and nothing to check your answers against. So you revise blind, and find out what a First looks like after the exam.</p>
</div></section>

<section class="sec" id="how"><div class="wrap">
<span class="kick rv">How it works</span>
<h2 class="h2 rv d1">Three steps. About ten minutes.</h2>
<div class="story">
<div class="story-vis" aria-hidden="true">
<div class="sv"><h4>Your course: Economics BSc · Year 2</h4><div class="row hl"><span><code>ECON0013</code> Microeconomics</span><span class="tick">✓</span></div><div class="row"><span><code>ECON0019</code> Quantitative Economics</span><span class="tick">✓</span></div><div class="row"><span><code>HIST0003</code> Approaching History</span><span class="tick">✓</span></div><div class="row"><span><code>POLS0006</code> Introduction to Politics</span><span>+</span></div></div>
<div class="sv"><span class="timer">⏱ 38:12 left</span><p class="q">“Explain why a profit-maximising monopolist always produces on the elastic part of the demand curve.”</p><div class="ans" id="typeans" data-text="A monopolist maximises profit where MR = MC. Since MR = P(1 + 1/ε) and MC is positive, MR must be positive, so 1 + 1/ε &gt; 0, which means |ε| &gt; 1. Demand is therefore elastic at the chosen output. Intuitively, on the inelastic part, cutting output would raise revenue and lower costs, so…"></div></div>
<div class="sv"><div class="verdict"><span class="cls">2:1</span><div><b>62–66</b><span>predicted mark range · UCL Economics criteria</span></div></div><div class="crit"><em>2:1</em><span>Knowledge and understanding</span><em>2:2</em><span>Analysis: result stated, not derived</span><em class="f">First</em><span>Structure and communication</span></div><div class="row hl"><span>1. Derive MR = P(1 + 1/ε) before using it</span></div><div class="row"><span>2. Add the labelled diagram</span></div><div class="row"><span>3. Finish with the intuition</span></div></div>
</div>
<div class="story-steps">
<div class="step"><span class="n">01</span><h3>Pick your course and modules</h3><p>Sign up, verify your email, choose your course and year. Your modules sit in your dashboard sidebar, and any of UCL’s 6,682 modules can be added.</p></div>
<div class="step"><span class="n">02</span><h3>Answer an exam-style question</h3><p>Choose one of our questions written in your module’s style, or paste one from your own past paper. Turn on the 45-minute timer for exam conditions.</p></div>
<div class="step"><span class="n">03</span><h3>See your class and how to go up one</h3><p>Marked against UCL’s grade bands and your department’s published criteria: feedback on each criterion, the 3 changes that would move you up a class, and a First-class answer to compare.</p></div>
</div>
</div>
</div></section>

<section class="sec" id="features"><div class="wrap">
<span class="kick rv">Inside your dashboard</span>
<h2 class="h2 rv d1">Everything you need to go up a class.</h2>
<p class="sub rv d2">One place for practice, feedback, your tutor and every answer you’ve had marked.</p>
<div class="feat">
<div class="feat-tabs" role="tablist" aria-label="Features">
<button class="ftab" role="tab" aria-selected="true" aria-controls="fp0" id="ft0"><b>Marking</b><span>Your class, criterion by criterion</span><i class="prog"></i></button>
<button class="ftab" role="tab" aria-selected="false" aria-controls="fp1" id="ft1" tabindex="-1"><b>Your tutor</b><span>Professor UCL, for every module</span><i class="prog"></i></button>
<button class="ftab" role="tab" aria-selected="false" aria-controls="fp2" id="ft2" tabindex="-1"><b>Marked answers</b><span>Every answer, and your marks over time</span><i class="prog"></i></button>
<button class="ftab" role="tab" aria-selected="false" aria-controls="fp3" id="ft3" tabindex="-1"><b>Your modules</b><span>Picked once, kept in your sidebar</span><i class="prog"></i></button>
</div>
<div class="feat-view">
<div class="fpanel on" role="tabpanel" id="fp0" aria-labelledby="ft0" data-panel="marking"><h4>Marked against your department’s criteria</h4><div class="sv on" style="position:relative;inset:auto;flex:1;opacity:1;transform:none"><div class="verdict"><span class="cls">2:1</span><div><b>64–68</b><span>HIST0003 · UCL grade bands, Year 1</span></div></div><div class="crit"><em>2:1</em><span>Argument: answers the question directly</span><em class="f">First</em><span>Evidence: well-chosen, integrated</span><em>2:2</em><span>Historiography: debate mentioned, not engaged</span></div><div class="row hl"><span>Engage two historians’ positions and say which is more convincing, and why.</span></div></div></div>
<div class="fpanel" role="tabpanel" id="fp1" aria-labelledby="ft1" data-panel="tutor" hidden><h4>Ask about anything in your module</h4><div class="chat" id="chatdemo" data-msgs='[{{"r":"me","t":"I keep confusing the substitution and income effects. Can you explain?"}},{{"r":"tu","t":"Sure. When a price rises, two things happen: the good is now relatively dearer (substitution effect) and you are effectively poorer (income effect). The Slutsky equation splits the total change into those two parts."}},{{"r":"me","t":"How would that earn marks in the exam?"}},{{"r":"tu","t":"Show the decomposition on a diagram, label the compensated budget line, then sign each effect for a normal good. That is what moves an answer from 2:2 to 2:1."}}]'></div></div>
<div class="fpanel" role="tabpanel" id="fp2" aria-labelledby="ft2" data-panel="history" hidden><h4>Watch your marks climb</h4><div class="bigchart"><svg viewBox="0 0 600 150" aria-hidden="true"><defs><linearGradient id="lg2" x1="0" x2="1"><stop offset="0" stop-color="#8B5CF6"/><stop offset="1" stop-color="#22D3EE"/></linearGradient><linearGradient id="lg3" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="rgba(139,92,246,.35)"/><stop offset="1" stop-color="rgba(139,92,246,0)"/></linearGradient></defs><line x1="0" x2="600" y1="40" y2="40" stroke="rgba(168,85,247,.5)" stroke-dasharray="4 5"/><text x="4" y="34" fill="#C4B5FD" font-size="11" font-family="monospace">First</text><polygon points="10,120 110,112 210,98 310,90 410,70 510,52 590,36 590,150 10,150" fill="url(#lg3)"/><polyline points="10,120 110,112 210,98 310,90 410,70 510,52 590,36" fill="none" stroke="url(#lg2)" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/></svg></div><div class="hist"><div><em class="f">First</em><span>ECON0013 · Monopoly and elasticity</span><code>70–74</code></div><div><em>2:1</em><span>HIST0003 · Sources and interpretation</span><code>62–66</code></div><div><em class="l">2:2</em><span>POLS0006 · What is the state?</span><code>55–59</code></div></div></div>
<div class="fpanel" role="tabpanel" id="fp3" aria-labelledby="ft3" data-panel="modules" hidden><h4>Your modules, one click away</h4><div class="dash-mini"><div><code>ECON0013</code><p>Microeconomics</p><span class="ui-bar" style="display:block"><i style="width:72%;display:block;height:5px"></i></span></div><div><code>HIST0003</code><p>Approaching History</p><span class="ui-bar" style="display:block"><i style="width:48%;display:block;height:5px"></i></span></div><div><code>POLS0006</code><p>Introduction to Politics</p><span class="ui-bar" style="display:block"><i style="width:60%;display:block;height:5px"></i></span></div><div><code>+ Add</code><p>Any UCL module</p><span style="color:var(--mute);font-size:13px">Search 6,682 modules</span></div></div></div>
</div>
</div>
</div></section>

<section class="sec"><div class="wrap">
<span class="kick rv">Built to be trusted</span>
<h2 class="h2 rv d1">Not a chatbot. A marker.</h2>
<div class="cards3">
<div class="spot rv"><div class="ic"><svg viewBox="0 0 24 24"><path d="M4 19V5h16v14z"/><path d="M8 9h8M8 13h5"/></svg></div><h3>Your department’s criteria</h3><p>Every answer is marked against UCL’s grade bands for your year and, where your department publishes them, its own grade descriptors.</p></div>
<div class="spot rv d1"><div class="ic"><svg viewBox="0 0 24 24"><path d="M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7z"/><path d="M9 12l2 2 4-4"/></svg></div><h3>Practice, not coursework</h3><p>{BRAND} is for exam practice. It refuses to mark work you’re going to submit, and it never writes work for you to hand in.</p></div>
<div class="spot rv d2"><div class="ic"><svg viewBox="0 0 24 24"><path d="M3 12h4l3-8 4 16 3-8h4"/></svg></div><h3>Honest ranges</h3><p>You always get a mark range, not a fake-precise number, and you can tell us your real mark so we keep checking the marker’s accuracy.</p></div>
</div>
</div></section>

<section class="sec"><div class="wrap">
<span class="kick rv">Students</span>
<h2 class="h2 rv d1">Real reviews only.</h2>
<div class="revs" id="revs"><div class="rev first rv"><h3>Be one of the first to review {BRAND}.</h3><p>We only show reviews from real, signed-in students. No made-up testimonials, ever.</p><a class="btn btn-ghost sm" href="/reviews">See reviews</a></div></div>
</div></section>

<section class="sec" id="pricing"><div class="wrap">
<span class="kick rv">Pricing</span>
<h2 class="h2 rv d1">Start free.</h2>
<div class="prices">
<div class="price rv"><h3>Free</h3><div class="amt">£0</div><ul><li>7 days of Pro free when you sign up</li><li>Then 1 answer marked every week</li><li>Every practice question, every module</li><li>Your marked answers saved</li></ul><a class="btn btn-ghost" href="/signup" data-ev="lp_price_free">Start free</a></div>
<div class="price pro rv d1"><h3>Pro</h3><div class="amt">£5.99<small> / month</small></div><ul><li>Up to 30 answers marked a day</li><li>Your tutor for every module</li><li>Rewrite and resubmit as often as you like</li><li>Or £39 a year, or £12 for an exam-season pass</li></ul><a class="btn btn-glow" href="/pricing" data-ev="lp_price_pro">See Pro</a></div>
</div>
</div></section>

<section class="sec" id="faq"><div class="wrap">
<span class="kick rv">Questions</span>
<h2 class="h2 rv d1">Good to know.</h2>
<div class="faq">
<details><summary>Is this cheating?</summary><p>No. {BRAND} is for exam practice and revision. It refuses to mark coursework you’re going to submit, and it never writes work for you to hand in.</p></details>
<details><summary>Does it have my exact past papers?</summary><p>We don’t host university exam papers. Paste a question from your own past paper and we’ll mark your answer to it, or use one of our exam-style questions written from the module’s official description.</p></details>
<details><summary>How accurate is the marking?</summary><p>It’s a practice estimate, so you always see a mark range rather than a single number. We test the marker against real marked answers, module by module, and you can tell us your real mark to help keep it accurate.</p></details>
<details><summary>Which modules?</summary><p>All 6,682 modules in UCL’s public module catalogue. Practice questions are written the first time someone opens a module, then saved for everyone.</p></details>
<details><summary>Is {BRAND} part of UCL?</summary><p>No. {BRAND} is an independent revision tool built by a UCL student. It isn’t affiliated with or endorsed by UCL.</p></details>
</div>
</div></section>

<section class="final"><div class="wrap"><div class="box rv">
<h2>Find out what your<br><span class="grad">answer would get.</span></h2>
<p>Free to start. No card needed.</p>
<a class="btn btn-glow lg" href="/signup" data-ev="lp_final_signup">Get my first answer marked, free</a>
</div></div></section>
</main>

<footer class="foot"><div class="wrap">
<div class="foot-in"><a class="brand" href="/"><span class="brand-mark">{MARK}</span>{BRAND}</a><nav aria-label="Footer"><a href="/mark">Find your module</a><a href="/pricing">Pricing</a><a href="/reviews">Reviews</a><a href="/faq">FAQ</a><a href="/trust">Trust &amp; safety</a><a href="/privacy.html">Privacy</a><a href="/terms.html">Terms</a><a href="mailto:hello@{DOMAIN}">Contact</a></nav></div>
<p class="fine">{BRAND} is an independent revision tool for UCL students. It is not affiliated with or endorsed by UCL. Marks are practice estimates, not official marks. Practice questions are written for revision and are not taken from UCL exam papers. The dashboard shown above is an illustration. © 2026 {BRAND}</p>
</div></footer>
<script>window.UNIZY_CONFIG={CONFIG};</script><script src="/assets/landing.js?v=1"></script>
</body></html>
"""

DASH_PAGE = head(f"Dashboard · {BRAND}", "Your Unizy dashboard.", "/dashboard") + f"""
<div id="root"><div class="db setup" id="db">
<aside class="db-side">
<div class="db-bar"><a class="sx-brand db-brand" href="/" aria-label="{BRAND} home"><span class="sx-mark">{MARK}</span><span class="sx-word">{BRAND}</span></a><button class="db-menu" id="db-menu" type="button" aria-label="Menu"><span></span><span></span></button></div>
<div class="db-sidein">
<nav class="db-nav" aria-label="Dashboard">""" + "".join(f'<a href="{p}" data-tab="{i}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="{d}"/></svg>{l}</a>' for i, l, p, d in [
    ("home", "Home", "/dashboard", "M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"),
    ("practice", "Practice &amp; marking", "/dashboard/practice", "M4 20h4L19 9l-4-4L4 16zM14 6l4 4"),
    ("tutor", "Tutor", "/dashboard/tutor", "M4 5h16v11H8l-4 4z"),
    ("history", "Marked answers", "/dashboard/history", "M5 4h14v16H5zM8 9h8M8 13h8M8 17h5"),
    ("account", "Account", "/dashboard/account", "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm-8 9a8 8 0 0 1 16 0")]) + """</nav>
<div class="db-mods-head"><span>My modules</span><a href="/dashboard/practice">+ Add</a></div>
<ul class="db-mods" id="db-mods"></ul>
</div>
</aside>
<main class="db-main" id="main">
<div class="db-setupbox" id="db-setup"><div class="db-setup-in"><p class="mk-busy"><span class="spin"></span>Loading your dashboard…</p></div></div>
<section class="db-tab" data-tab="home" id="db-home" hidden></section>
<section class="db-tab" data-tab="practice" hidden><div id="mk" data-base="/dashboard/practice" data-modbase="/dashboard/practice/"></div></section>
<section class="db-tab" data-tab="tutor" id="db-tutor" hidden></section>
<section class="db-tab" data-tab="history" id="db-history" hidden></section>
<section class="db-tab" data-tab="account" id="db-account" hidden></section>
</main>
</div></div>
""" + f'<script>window.UNIZY_CONFIG={CONFIG};window.SITE_BRAND={json.dumps({"name": BRAND})};</script><script src="/assets/welcome.js"></script><script src="/assets/dashboard.js?v=1"></script><script src="/assets/mark.js?v=2"></script></body></html>\n'

if __name__ == "__main__":
    (SITE / "dashboard.html").write_text(DASH_PAGE)
    (SITE / "mark.html").write_text(MARK_PAGE)
    # site/index.html is now the Next.js landing page (web/), built by .github/workflows/build-landing.yml.
    # HOME below is the earlier plain-HTML version, kept for reference: python3 tools/build_marker_pages.py --classic-home
    import sys
    if "--classic-home" in sys.argv:
        (SITE / "index.html").write_text(HOME)
    print("wrote site/mark.html and site/dashboard.html for", BRAND)
