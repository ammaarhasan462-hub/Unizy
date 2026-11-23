// Inline scripts that run in <head> before first paint (kept out of client components so the server layout can read
// them as plain strings).
//
// Signed-in students who open unizy.uk fresh (typed, bookmarked, from a link elsewhere) go straight to their dashboard.
// Clicking Home from inside Unizy, reloading, going back, or ?home=1 still shows the homepage.
//
// html.lite = the simple homepage (the phone layout, no moving backgrounds or idle animation), for slower machines:
// 4 or fewer CPU threads, 4 GB of memory or less, data saver, or reduced motion. The homepage can also switch itself
// to it if scrolling turns out slow (components/Boot.jsx, stored as unizy:lite = auto). The footer's "Simple version"
// switch stores 1 or 0, and 0 means never.
//
// The 3D intro plays once per device: the first time someone opens unizy.uk on a laptop or desktop that isn't in the
// simple version. After that the homepage opens straight away, and "Replay intro" plays it again on demand
// (components/Intro.jsx). Also skipped for signed-in students, on phones, with reduced motion, without WebGL 2, and
// when clicking Home from another Unizy page. ?intro=1 forces it, ?intro=0 skips it.
// html.can-intro marks a screen that can play it, which is what shows the Replay intro buttons.
export const INTRO_SEEN = 'unizy:intro-seen';
export const LITE = 'unizy:lite';
export const INTRO_BOOT = `(function(){try{var d=document.documentElement,q=location.search,n=navigator,ls=null;
try{ls=window.localStorage}catch(e){}
var authed=false;try{var s=JSON.parse(ls.getItem('unizy.session')||'null');authed=!!(s&&s.access_token)}catch(e){}
var nav='';try{nav=performance.getEntriesByType('navigation')[0].type}catch(e){}
var same=false;try{same=!!document.referrer&&new URL(document.referrer).host===location.host}catch(e){}
if(authed&&nav==='navigate'&&!same&&location.pathname==='/'&&!location.hash&&!/[?&](home|code|intro)=/.test(q)){d.style.display='none';location.replace('/dashboard');return}
var inside=same&&nav==='navigate';
var force=/[?&]intro=1/.test(q),off=/[?&]intro=0/.test(q);
var mark=function(){try{ls&&ls.setItem('${INTRO_SEEN}','1')}catch(e){}};
var seen=true;try{seen=!ls||!!ls.getItem('${INTRO_SEEN}')}catch(e){}
var rm=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
var phone=window.matchMedia&&(matchMedia('(max-width: 767px)').matches||(matchMedia('(pointer: coarse)').matches&&Math.min(screen.width,screen.height)<600));
var gl=!!window.WebGL2RenderingContext;
var low=(n.deviceMemory&&n.deviceMemory<=4)||(n.hardwareConcurrency&&n.hardwareConcurrency<=4)||(n.connection&&n.connection.saveData);
var pick=null;try{pick=ls&&ls.getItem('${LITE}')}catch(e){}
var lite=pick==='1'||pick==='auto'||(pick!=='0'&&!!(low||rm));
if(lite)d.classList.add('lite');
if(!phone&&gl)d.classList.add('can-intro');
if(force||(!off&&!seen&&!authed&&!inside&&!lite&&!phone&&gl&&!n.webdriver)){d.classList.add('intro');
setTimeout(function(){if(!d.classList.contains('intro-live')){d.classList.remove('intro');mark()}},9000)}}catch(e){}})();`;

// the university picked in the intro or the homepage tabs (see components/story/unis.js), so the colours are right
export const UNI_BOOT = `(function(){try{var u=localStorage.getItem('unizy:uni');document.documentElement.setAttribute('data-uni',/^(ucl|imperial|qmul|lse|kcl)$/.test(u)?u:'all')}catch(e){}})();`;
