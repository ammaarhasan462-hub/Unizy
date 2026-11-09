"""Builds the marker pages (site/index.html home page and site/mark.html) from one place.

The brand name lives in BRAND below: change it here and re-run `python3 tools/build_marker_pages.py`
to rename the home page and marker. (Other pages still say Unizy until the full rename.)
"""
import json
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent.parent
SITE = ROOT / "site"

BRAND = "Unizy"          # placeholder until the new name is chosen
DOMAIN = "unizy.uk"
MARK = BRAND[:1].lower()
TAGLINE = "The mark scheme your uni never gave you."

cfg = re.search(r"<script>window.UNIZY_CONFIG=(\{.*?\});", (SITE / "pricing.html").read_text()) or re.search(r"<script>window.UNIZY_CONFIG=(\{\"supabaseUrl.*?\}\});", (SITE / "faq.html").read_text())
CONFIG = cfg.group(1)


def head(title, desc, path, extra_css=""):
    return f"""<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>{title}</title><meta name="description" content="{desc}"><meta property="og:title" content="{title}"><meta property="og:description" content="{desc}"><meta property="og:type" content="website"><link rel="canonical" href="https://{DOMAIN}{path}"><meta property="og:url" content="https://{DOMAIN}{path}"><meta property="og:image" content="https://{DOMAIN}/assets/og.png"><meta name="twitter:card" content="summary_large_image"><meta name="theme-color" content="#17302A"><link rel="icon" href="/assets/favicon.svg" type="image/svg+xml"><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400..700&family=Fraunces:opsz,wght@9..144,500..700&family=DM+Mono:wght@400;500&display=swap"><link rel="stylesheet" href="/assets/home.css?v=16"><link rel="stylesheet" href="/assets/site.css?v=2"><link rel="stylesheet" href="/assets/mark.css?v=1">{extra_css}</head><body class="sx">
<a class="skip" href="#main">Skip to content</a>"""


def header(current):
    links = [("/", "Home"), ("/mark", "Find your module"), ("/how-it-works", "How it works"), ("/pricing", "Pricing"), ("/faq", "FAQ")]
    nav = "".join(f'<a href="{h}"{" aria-current=\"page\"" if h == current else ""}>{t}</a>' for h, t in links)
    return f"""<header class="sx-top"><div class="sx-bar">
<a class="sx-brand" href="/" aria-label="{BRAND} home"><span class="sx-mark">{MARK}</span><span class="sx-word">{BRAND.lower()}</span></a>
<nav class="sx-nav" id="sx-nav" aria-label="Main">{nav}</nav>
<div class="sx-act"><a class="sx-login" href="/login?next=/mark" data-auth="login">Log in</a><a class="sx-cta" href="/mark" data-ev="nav_mark">Get marked free</a><button class="sx-menu" type="button" aria-expanded="false" aria-controls="sx-nav"><span></span><span></span><span class="sr">Menu</span></button></div>
</div></header>"""


def footer():
    return f"""<footer class="sx-foot"><div class="sx-foot-in">
<div class="sx-foot-brand"><a class="sx-brand" href="/"><span class="sx-mark">{MARK}</span><span class="sx-word">{BRAND.lower()}</span></a><p>{TAGLINE} Exam practice and marking for UCL students.</p></div>
<nav class="sx-foot-col" aria-label="Product"><span>Product</span><a href="/mark">Find your module</a><a href="/how-it-works">How it works</a><a href="/pricing">Pricing</a><a href="/app">Study tools</a></nav>
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
""" + footer() + scripts("mark.js?v=1") + "</body></html>\n"

HOME = head(f"{BRAND} · {TAGLINE}",
            "At A-level you had mark schemes. At UCL you don't. Write an answer to an exam question in your module and get it marked against your department's own grading criteria, with the changes that would move you up a class.",
            "/") + header("/") + f"""
<main id="main">
<section class="h2-hero"><div class="in">
<div class="h2-copy">
<span class="eyebrow">For UCL students · every module</span>
<h1>The mark scheme your uni <em>never gave you.</em></h1>
<p class="lead">Write an answer to any exam question in your module. {BRAND} marks it against your department’s own grading criteria, tells you your class, and shows you what a First looks like.</p>
<div class="ctas"><a class="btn primary big" href="/mark" data-ev="cta_mark_hero">Get my first answer marked, free</a><a class="btn ghost big" href="#how">How it works</a></div>
<p class="h2-under">Built for UCL students. Free to start, no card needed.</p>
</div>
<div class="h2-demo" aria-label="Example of a marked answer">
<span class="mk-topic">Example · ECON0013 Microeconomics</span>
<p class="q">“Explain why a profit-maximising monopolist produces where demand is elastic.”</p>
<div class="mk-verdict u2"><span class="mk-cls big u2">2:1</span><div><b>62–66</b><span>predicted mark range</span></div></div>
<p style="margin:14px 0 0;font-weight:700">3 changes to move up a class</p>
<ol><li>Derive MR = P(1 + 1/ε) before using it, rather than stating it.</li><li>Add the diagram and label where MR = MC sits on the demand curve.</li><li>Finish with the intuition: when demand is inelastic, cutting output raises revenue and lowers cost.</li></ol>
<p class="note">Illustration of the feedback layout, not a real student’s answer.</p>
</div>
</div></section>

<section class="h2-sec" id="how"><div class="in">
<span class="kicker">How it works</span><h2>Three steps. About ten minutes.</h2>
<p class="sub">At A-level you had past papers and mark schemes. At UCL you get the papers but nothing to check your answers against. {BRAND} fills that gap.</p>
<ol class="h2-steps">
<li><span class="n">01</span><h3>Pick your module</h3><p>Search all 6,682 modules in UCL’s catalogue by code, title or department.</p></li>
<li><span class="n">02</span><h3>Answer a question</h3><p>Choose one of our exam-style questions, or paste one from your own past paper. Set a 45-minute timer if you want exam conditions.</p></li>
<li><span class="n">03</span><h3>See your class</h3><p>Marked against your department’s criteria, with feedback on each criterion and the 3 changes that would move you up a class.</p></li>
</ol>
</div></section>

<section class="h2-sec alt"><div class="in">
<div class="h2-two">
<div><h3>Why not just use a chatbot?</h3><p>A chatbot doesn’t know how your department marks. {BRAND} does. Every answer is marked against UCL’s grade bands for your year and, where your department publishes them, its own grade descriptors.</p></div>
<div><h3>See what a First looks like</h3><p>Every marked answer comes with a First-class answer to the same question to compare against. Model answers written by students who got a First in the module are being added, with their name and mark shown.</p></div>
</div>
</div></section>

<section class="h2-sec" id="pricing"><div class="in">
<span class="kicker">Pricing</span><h2>Start free.</h2>
<div class="h2-price">
<div><h3>Free</h3><p class="p">£0</p><ul><li>7 days of Pro free when you sign up</li><li>Then 1 answer marked every week</li><li>Every practice question, every module</li><li>Your marked answers saved to your account</li></ul><a class="btn line" href="/mark">Start free</a></div>
<div class="dark"><h3>Pro</h3><p class="p">£5.99<span style="font-size:16px"> / month</span></p><ul><li>Up to 30 answers marked a day</li><li>Rewrite and resubmit as often as you like</li><li>All the study tools: notes, flashcards, topic tests</li><li>Or £39 a year, or £12 for an exam-season pass</li></ul><a class="btn primary" href="/pricing">See Pro</a></div>
</div>
</div></section>

<section class="h2-sec alt"><div class="in h2-faq">
<span class="kicker">Questions</span><h2>Good to know</h2>
<details><summary>Is this cheating?</summary><p>No. {BRAND} is for exam practice and revision. It refuses to mark coursework you’re going to submit, and it never writes work for you to hand in.</p></details>
<details><summary>Does it have my exact past papers?</summary><p>We don’t host university exam papers. Paste a question from your own past paper and we’ll mark your answer to it, or use one of our exam-style questions written from the module’s official description.</p></details>
<details><summary>How accurate is the marking?</summary><p>It’s a practice estimate, so you always see a mark range rather than a single number. We test the marker against real marked answers module by module, and you can tell us your real mark to help keep it accurate.</p></details>
<details><summary>Which modules?</summary><p>All 6,682 modules in UCL’s public module catalogue, undergraduate and master’s. Practice questions are written the first time someone opens a module, then saved for everyone.</p></details>
<details><summary>Is {BRAND} part of UCL?</summary><p>No. {BRAND} is an independent revision tool built by a UCL student. It isn’t affiliated with or endorsed by UCL.</p></details>
</div></section>

<section class="h2-cta"><div class="in"><h2>Find out what your answer would get.</h2><a class="btn primary big" href="/mark" data-ev="cta_mark_foot">Get my first answer marked, free</a></div></section>
</main>
""" + footer() + scripts() + "</body></html>\n"

if __name__ == "__main__":
    (SITE / "mark.html").write_text(MARK_PAGE)
    (SITE / "index.html").write_text(HOME)
    print("wrote site/mark.html and site/index.html for", BRAND)
