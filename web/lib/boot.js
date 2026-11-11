// Inline scripts that run in <head> before first paint (kept out of client components so the server layout can
// read them as plain strings).
export const INTRO_BOOT = `(function(){try{var d=document.documentElement,q=location.search;
var force=/[?&]intro=1/.test(q),off=/[?&]intro=0/.test(q);
var inside=false;try{var r=document.referrer;inside=!!r&&new URL(r).host===location.host&&performance.getEntriesByType('navigation')[0].type==='navigate'}catch(e){}
var rm=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
if(force||(!off&&!inside&&!rm&&window.WebGL2RenderingContext&&!navigator.webdriver)){d.classList.add('intro');
setTimeout(function(){if(!d.classList.contains('intro-live'))d.classList.remove('intro')},9000)}}catch(e){}})();`;

// the university picked in the intro or the homepage tabs (see components/story/unis.js), so the colours are right
export const UNI_BOOT = `(function(){try{var u=localStorage.getItem('unizy:uni');document.documentElement.setAttribute('data-uni',/^(ucl|imperial|qmul|lse)$/.test(u)?u:'all')}catch(e){}})();`;
