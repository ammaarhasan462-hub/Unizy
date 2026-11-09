// Shared bits for the landing page: public Supabase config (publishable key), analytics and session checks.
export const BRAND = 'SaveMyGrade';
export const SB_URL = 'https://aayelwhshiboqyjdhnst.supabase.co';
export const SB_KEY = 'sb_publishable_eJrU8D7FBn0o8vs0cgfPmw_0ZJzmqVE';

export function track(ev) {
  try {
    if (navigator.webdriver || localStorage.getItem('unizy:notrack') === '1') return;
    fetch(SB_URL + '/rest/v1/rpc/track_event', {
      method: 'POST',
      keepalive: true,
      headers: { apikey: SB_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_event: ev }),
    }).catch(() => {});
  } catch (e) {}
}

export function hasSession() {
  try {
    const s = JSON.parse(localStorage.getItem('unizy.session') || 'null');
    return !!(s && s.access_token);
  } catch (e) {
    return false;
  }
}

// Where visitors come from (anonymous daily totals: src_tiktok etc.). Short links (/tiktok, /ig, /wa, /qr …) add ?ref=.
// The first source is kept on this device for 30 days so the sign-up page can count join_<source>.
const ALIAS = {
  tt: 'tiktok', tiktok: 'tiktok', ig: 'instagram', insta: 'instagram', instagram: 'instagram', snap: 'snapchat', snapchat: 'snapchat',
  wa: 'whatsapp', whatsapp: 'whatsapp', yt: 'youtube', youtube: 'youtube', li: 'linkedin', linkedin: 'linkedin', reddit: 'reddit', x: 'x', twitter: 'x',
  fb: 'facebook', facebook: 'facebook', qr: 'poster', poster: 'poster', flyer: 'poster', friend: 'friend', invite: 'friend', soc: 'society', society: 'society',
  email: 'email', newsletter: 'email', google: 'google', bing: 'bing',
};

export function recordSource() {
  let s = '';
  try {
    const p = new URLSearchParams(location.search);
    const q = String(p.get('ref') || p.get('utm_source') || '').toLowerCase().replace(/[^a-z]/g, '');
    if (q) s = ALIAS[q] || 'other';
    if (!s) {
      const ua = navigator.userAgent || '';
      if (/musical_ly|bytedance|tiktok/i.test(ua)) s = 'tiktok';
      else if (/Instagram/.test(ua)) s = 'instagram';
      else if (/Snapchat/i.test(ua)) s = 'snapchat';
      else if (/FBAN|FBAV/.test(ua)) s = 'facebook';
      else if (/LinkedInApp/i.test(ua)) s = 'linkedin';
    }
    if (!s && document.referrer) {
      const h = new URL(document.referrer).hostname.replace(/^www\./, '');
      if (h !== location.hostname.replace(/^www\./, '')) {
        s = /tiktok/.test(h) ? 'tiktok' : /instagram/.test(h) ? 'instagram' : /snapchat/.test(h) ? 'snapchat' : /whatsapp/.test(h) ? 'whatsapp'
          : /(^|\.)google\./.test(h) ? 'google' : /bing\.com$/.test(h) ? 'bing' : /youtube|youtu\.be/.test(h) ? 'youtube' : /linkedin|lnkd\.in/.test(h) ? 'linkedin'
          : /reddit/.test(h) ? 'reddit' : /^(t\.co|x\.com|twitter\.com)$/.test(h) ? 'x' : /facebook|fb\.me/.test(h) ? 'facebook' : 'site';
      }
    }
    if (!s) return;
    let old = null;
    try { old = JSON.parse(localStorage.getItem('unizy-src') || 'null'); } catch (e) {}
    if (!old || Date.now() - old.at > 30 * 864e5) localStorage.setItem('unizy-src', JSON.stringify({ s, at: Date.now() }));
    if (!sessionStorage.getItem('unizy-src-sent')) { sessionStorage.setItem('unizy-src-sent', '1'); track('src_' + s); }
    if (p.get('ref') || p.get('utm_source')) history.replaceState(null, '', location.pathname + location.hash);
  } catch (e) {}
}

export async function fetchReviews() {
  try {
    const r = await fetch(SB_URL + '/rest/v1/rpc/public_reviews', {
      method: 'POST',
      headers: { apikey: SB_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_limit: 3, p_offset: 0, p_sort: 'newest' }),
    });
    if (!r.ok) return [];
    const d = await r.json();
    const list = d && (d.reviews || d.items || []);
    if (!d || !+d.count || !list || !list.length) return [];
    return list;
  } catch (e) {
    return [];
  }
}

export const MODULES = [
  ['ECON0013', 'Microeconomics'], ['HIST0003', 'Approaching History'], ['POLS0006', 'Introduction to Politics'],
  ['LAWS0001', 'Contract Law'], ['COMP0002', 'Principles of Programming'], ['STAT0002', 'Introduction to Probability and Statistics'],
  ['ANAT0001', 'Introduction to Anatomy and Development'], ['PHIL0001', 'Ancient Greek Philosophy'], ['ECON0019', 'Quantitative Economics and Econometrics'],
  ['ELEC0002', 'Introduction to Electronic Engineering'], ['ARCL0001', 'Introduction to Roman Archaeology'], ['BIOL0001', 'Quantitative Biology'],
  ['MEDC0001', 'Foundations in Human Physiology and Cellular Biology'], ['BENV0001', 'Energy and Carbon in the Context of Sustainability'],
];
