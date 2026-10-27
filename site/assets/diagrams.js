/* Generated from coverage/diagrams.js by coverage/sync_diagrams.py. */
// Unizy medical diagrams and ECG strips. Pure functions returning SVG data URIs.
// Pasted into app.html's Component class as static methods (keep in sync with the copy there).
const UZDIAG = (() => {
  const uri = (svg) => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  const F = 'font-family="Inter,Arial,sans-serif"';
  const mark = (p, i) => '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="13" fill="#141414" stroke="#FFFFFF" stroke-width="2"/><text x="' + p[0] + '" y="' + (p[1] + 5) + '" text-anchor="middle" ' + F + ' font-size="14" font-weight="700" fill="#FFFFFF">' + (i + 1) + '</text>';
  const marks = (P, items) => (items || []).map((k, i) => (P[k] ? mark(P[k], i) : '')).join('');
  const foot = (y, lines) => lines.map((t, i) => '<text x="8" y="' + (y + i * 17) + '" ' + F + ' font-size="12" fill="#3F3F3B">' + t + '</text>').join('');
  const wrap = (w, h, body) => '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + w + ' ' + h + '" width="' + w + '" height="' + h + '"><rect width="100%" height="100%" fill="#FFFFFF"/>' + body + '</svg>';

  // ---- heart (unchanged from the original schematic) ----
  const HEART_P = { svc: [125, 40], ivc: [125, 330], ra: [100, 125], rv: [120, 245], la: [295, 115], lv: [280, 250], septum: [200, 255], tricuspid: [110, 178], mitral: [290, 172], pulmonary: [180, 182], aortic: [220, 182], pa: [180, 70], aorta: [220, 40], pv: [360, 120] };
  const heartBase = () =>
    '<rect x="110" y="10" width="30" height="80" rx="8" fill="#C9D9F2" stroke="#3B5B8C"/>' +
    '<rect x="110" y="292" width="30" height="62" rx="8" fill="#C9D9F2" stroke="#3B5B8C"/>' +
    '<rect x="168" y="20" width="26" height="160" rx="8" fill="#C9D9F2" stroke="#3B5B8C"/>' +
    '<path d="M206 180 L206 40 Q206 12 236 12 L262 12" fill="none" stroke="#A33A3A" stroke-width="26" stroke-linecap="round"/>' +
    '<rect x="335" y="100" width="55" height="40" rx="8" fill="#F2C9C9" stroke="#A33A3A"/>' +
    '<rect x="55" y="85" width="105" height="85" rx="22" fill="#C9D9F2" stroke="#3B5B8C" stroke-width="2"/>' +
    '<path d="M55 190 L193 190 L193 300 Q130 330 70 260 Z" fill="#C9D9F2" stroke="#3B5B8C" stroke-width="2"/>' +
    '<rect x="240" y="80" width="100" height="80" rx="22" fill="#F2C9C9" stroke="#A33A3A" stroke-width="2"/>' +
    '<path d="M207 190 L345 190 Q350 260 300 320 Q240 340 207 300 Z" fill="#F2C9C9" stroke="#A33A3A" stroke-width="2"/>' +
    '<rect x="193" y="190" width="14" height="115" fill="#D8C6C6" stroke="#6B4E4E"/>';
  const heart = (items) => uri(wrap(400, 392, heartBase() +
    '<line x1="72" y1="178" x2="150" y2="178" stroke="#141414" stroke-width="4" stroke-dasharray="10 6"/>' +
    '<line x1="252" y1="172" x2="330" y2="172" stroke="#141414" stroke-width="4" stroke-dasharray="10 6"/>' +
    '<line x1="168" y1="182" x2="194" y2="182" stroke="#141414" stroke-width="4"/>' +
    '<line x1="207" y1="182" x2="233" y2="182" stroke="#141414" stroke-width="4"/>' + marks(HEART_P, items) +
    foot(368, ['Schematic, not to scale · viewer’s left = patient’s right', 'Blue = deoxygenated blood, red = oxygenated blood'])));

  // ---- cardiac conduction system ----
  const COND_P = { san: [150, 96], avn: [196, 176], his: [212, 204], lbb: [250, 250], rbb: [168, 258], purkinje: [300, 318] };
  const conduction = (items) => uri(wrap(400, 392,
    '<g opacity="0.55">' + heartBase() + '</g>' +
    '<path d="M132 92 C160 120 180 150 198 178" fill="none" stroke="#C77C00" stroke-width="3" stroke-dasharray="4 4"/>' +
    '<path d="M140 96 C190 104 250 110 290 108" fill="none" stroke="#C77C00" stroke-width="3" stroke-dasharray="4 4"/>' +
    '<ellipse cx="128" cy="90" rx="14" ry="9" fill="#F2A900" stroke="#7A4E00" stroke-width="2"/>' +
    '<ellipse cx="198" cy="180" rx="12" ry="8" fill="#F2A900" stroke="#7A4E00" stroke-width="2"/>' +
    '<path d="M200 186 L200 222" stroke="#E08700" stroke-width="7" stroke-linecap="round"/>' +
    '<path d="M200 222 C204 260 222 290 250 306 C276 318 300 312 318 290 C330 270 336 240 332 210" fill="none" stroke="#E08700" stroke-width="5" stroke-linecap="round"/>' +
    '<path d="M200 222 C196 255 176 285 140 298 C108 306 86 286 76 258" fill="none" stroke="#E08700" stroke-width="5" stroke-linecap="round"/>' +
    '<path d="M250 306 l10 -18 M276 314 l6 -20 M300 310 l-2 -22 M318 290 l-14 -10 M330 254 l-16 -2 M140 298 l-2 -20 M108 302 l8 -18 M86 282 l16 -8" stroke="#E08700" stroke-width="2.5" stroke-linecap="round"/>' +
    marks(COND_P, items) +
    foot(368, ['Schematic, not to scale · viewer’s left = patient’s right', 'Orange = specialised conducting tissue'])));

  // ---- lungs and airways (anterior view) ----
  const LUNG_P = { trachea: [200, 40], carina: [200, 112], rmb: [160, 140], lmb: [250, 140], rul: [95, 115], rml: [128, 236], rll: [74, 300], lul: [300, 150], lll: [334, 292], hfissure: [140, 184], ofissure: [100, 262], diaphragm: [200, 362], pleura: [18, 210] };
  const lungs = (items) => uri(wrap(400, 430,
    // pleura (parietal outline)
    '<path d="M170 70 C110 62 40 120 32 230 C26 300 40 340 70 352 C110 336 160 330 182 336 Z" fill="none" stroke="#7E8FB3" stroke-width="2" stroke-dasharray="6 5"/>' +
    '<path d="M230 70 C290 62 360 120 368 230 C374 300 360 340 330 352 C290 336 240 330 218 336 Z" fill="none" stroke="#7E8FB3" stroke-width="2" stroke-dasharray="6 5"/>' +
    // right lung (viewer's left): three lobes
    '<path d="M168 80 C115 74 52 126 46 230 C42 290 52 322 74 336 C110 322 150 318 172 322 L172 150 Z" fill="#F4D3D3" stroke="#A35A5A" stroke-width="2"/>' +
    '<path d="M54 178 C90 178 130 178 172 182" fill="none" stroke="#8A3F3F" stroke-width="2.5"/>' +
    '<path d="M52 182 C80 232 110 290 140 326" fill="none" stroke="#8A3F3F" stroke-width="2.5"/>' +
    // left lung (viewer's right): two lobes with cardiac notch
    '<path d="M232 80 C285 74 348 126 354 230 C358 290 348 322 326 336 C296 324 268 320 252 322 C262 300 264 268 246 250 C236 240 232 220 232 200 Z" fill="#F4D3D3" stroke="#A35A5A" stroke-width="2"/>' +
    '<path d="M350 168 C322 228 292 288 262 326" fill="none" stroke="#8A3F3F" stroke-width="2.5"/>' +
    // trachea and bronchi
    '<rect x="188" y="12" width="24" height="96" rx="8" fill="#E8E2CF" stroke="#7A6E4D" stroke-width="2"/>' +
    '<path d="M196 104 L150 160 L136 152 L188 98 Z" fill="#E8E2CF" stroke="#7A6E4D" stroke-width="2"/>' +
    '<path d="M204 104 L274 148 L266 160 L196 112 Z" fill="#E8E2CF" stroke="#7A6E4D" stroke-width="2"/>' +
    '<path d="M150 160 l-18 22 M150 160 l-6 28 M266 160 l18 20 M266 160 l6 28" stroke="#7A6E4D" stroke-width="3" stroke-linecap="round"/>' +
    '<path d="M18 352 C80 300 160 330 200 340 C240 330 320 300 382 352" fill="none" stroke="#5A6B3F" stroke-width="5"/>' +
    marks(LUNG_P, items) +
    foot(392, ['Schematic anterior view, not to scale · viewer’s left = patient’s right', 'Dashed line = pleura; thick lines in the lungs = fissures'])));

  // ---- nephron ----
  const NEPH_P = { afferent: [62, 50], efferent: [96, 20], glomerulus: [164, 90], bowman: [128, 108], pct: [214, 150], dloop: [252, 272], aloop: [292, 236], dct: [296, 22], cd: [362, 250], jga: [196, 70] };
  const nephron = (items) => uri(wrap(420, 432,
    '<rect x="0" y="0" width="420" height="196" fill="#FBF6EC"/><rect x="0" y="196" width="420" height="200" fill="#F1ECF7"/>' +
    '<text x="12" y="186" ' + F + ' font-size="12" font-weight="700" fill="#6B5A35">CORTEX</text><text x="12" y="214" ' + F + ' font-size="12" font-weight="700" fill="#5A4A7A">MEDULLA</text>' +
    '<circle cx="164" cy="86" r="38" fill="#EAF1FB" stroke="#3B5B8C" stroke-width="3"/>' +
    '<path d="M140 86 C144 66 160 62 166 76 C174 62 190 70 186 86 C196 96 184 112 170 104 C166 118 150 116 152 102 C138 104 134 92 140 86 Z" fill="#E07A7A" stroke="#9A2C2C" stroke-width="2"/>' +
    '<path d="M164 124 C164 152 200 154 206 134 C212 112 240 114 238 142 C236 170 212 170 222 186 C230 198 252 196 252 214 L252 342" fill="none" stroke="#3B5B8C" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<path d="M252 340 C252 374 292 374 292 340" fill="none" stroke="#3B5B8C" stroke-width="7" stroke-linecap="round"/>' +
    '<path d="M292 342 L292 80 C292 58 270 52 190 54" fill="none" stroke="#2E6E9E" stroke-width="11" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<path d="M190 52 C204 28 236 12 274 14 C314 16 334 32 340 60 C352 70 362 78 362 104 L362 392" fill="none" stroke="#2E6E9E" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<path d="M8 40 L150 58" stroke="#B23A3A" stroke-width="9" stroke-linecap="round"/>' +
    '<path d="M156 50 L70 6" stroke="#B23A3A" stroke-width="6" stroke-linecap="round"/>' +
    '<ellipse cx="180" cy="56" rx="16" ry="11" fill="none" stroke="#C77C00" stroke-width="3" stroke-dasharray="4 3"/>' +
    marks(NEPH_P, items) +
    foot(410, ['Schematic, not to scale', 'Red = arterioles, blue = tubule; orange ring = juxtaglomerular area'])));

  // ---- brain, lateral view of the left hemisphere ----
  const BRAIN_P = { frontal: [92, 112], parietal: [262, 92], temporal: [190, 236], occipital: [352, 178], cerebellum: [312, 268], brainstem: [236, 318], central: [212, 50], lateral: [140, 186], precentral: [168, 92], postcentral: [234, 132], broca: [84, 198], wernicke: [270, 206] };
  const brain = (items) => {
    const outline = 'M40 170 C30 100 90 40 180 36 C270 32 360 70 384 150 C396 196 380 226 352 236 C330 244 300 240 280 248 C250 262 220 268 190 262 C150 256 120 248 98 232 C70 216 46 206 40 170 Z';
    return uri(wrap(420, 400,
      '<defs><clipPath id="bc"><path d="' + outline + '"/></clipPath></defs>' +
      '<g clip-path="url(#bc)">' +
      '<rect x="0" y="0" width="420" height="400" fill="#D7E6F7"/>' +
      '<path d="M222 20 C214 70 196 120 178 170 L0 200 L0 0 Z" fill="#CFE3C4"/>' +
      '<path d="M222 20 C214 70 196 120 178 170 L250 196 C300 180 330 160 350 120 L350 0 Z" fill="#F6E2B3"/>' +
      '<path d="M350 120 C330 160 300 180 250 196 L300 260 L420 260 L420 100 Z" fill="#E7D2F0"/>' +
      '<path d="M178 170 L250 196 L300 260 L0 260 L0 200 Z" fill="#F7D2CF"/>' +
      '<path d="M222 20 C214 70 196 120 178 170" fill="none" stroke="#2F2F2F" stroke-width="3"/>' +
      '<path d="M205 16 C196 70 178 120 160 166" fill="none" stroke="#6C8F5B" stroke-width="2" stroke-dasharray="3 3"/>' +
      '<path d="M240 24 C232 76 214 126 196 172" fill="none" stroke="#B08A35" stroke-width="2" stroke-dasharray="3 3"/>' +
      '<path d="M60 200 C110 186 170 178 236 196 C262 202 284 214 300 226" fill="none" stroke="#2F2F2F" stroke-width="3"/>' +
      '<path d="M66 204 C80 190 104 186 120 196" fill="#B9D7A8" stroke="#4E7A3C" stroke-width="1.5" opacity="0.9"/>' +
      '<ellipse cx="268" cy="214" rx="24" ry="12" fill="#E9B7B2" stroke="#9A4A43" stroke-width="1.5"/>' +
      '</g>' +
      '<path d="' + outline + '" fill="none" stroke="#3F3F3B" stroke-width="2.5"/>' +
      '<path d="M268 244 C290 236 340 236 360 256 C376 274 360 300 330 304 C300 308 276 296 266 278 Z" fill="#E9DCC8" stroke="#6E5A3A" stroke-width="2"/>' +
      '<path d="M272 250 C300 248 340 252 356 266 M270 264 C300 262 340 270 352 282" fill="none" stroke="#6E5A3A" stroke-width="1"/>' +
      '<path d="M214 258 L222 352 L250 352 L258 270 Z" fill="#E4D9D0" stroke="#6E5A3A" stroke-width="2"/>' +
      marks(BRAIN_P, items) +
      foot(372, ['Left hemisphere, side view · front of the head on the left', 'Thick lines = sulci; dashed = gyri either side of the central sulcus'])));
  };

  // ---- gastrointestinal tract (anterior view) ----
  const GI_P = { oesophagus: [212, 30], stomach: [262, 120], duodenum: [178, 168], jejunum: [244, 210], ileum: [168, 262], caecum: [98, 300], appendix: [86, 340], ascending: [74, 232], transverse: [150, 180], descending: [334, 250], sigmoid: [282, 320], rectum: [204, 366], liver: [100, 84], gallbladder: [142, 140], pancreas: [214, 154], spleen: [342, 110] };
  const gi = (items) => uri(wrap(420, 440,
    '<path d="M30 60 C60 30 180 30 230 62 C240 92 210 120 170 130 C120 140 70 136 40 120 C24 104 22 80 30 60 Z" fill="#D9B48F" stroke="#7A5232" stroke-width="2"/>' +
    '<ellipse cx="146" cy="134" rx="13" ry="18" fill="#9CC48A" stroke="#4E7A3C" stroke-width="2"/>' +
    '<ellipse cx="346" cy="104" rx="30" ry="38" fill="#B86A8F" stroke="#6E2E4C" stroke-width="2"/>' +
    '<path d="M206 10 L218 10 L222 70 L210 72 Z" fill="#F0C9B5" stroke="#8A5440" stroke-width="2"/>' +
    '<path d="M214 66 C250 52 312 66 316 110 C320 150 280 168 236 160 C210 156 196 140 198 120 C210 118 222 104 214 66 Z" fill="#F0C9B5" stroke="#8A5440" stroke-width="2"/>' +
    '<path d="M168 150 C220 150 260 150 284 140" fill="none" stroke="#E2B04A" stroke-width="14" stroke-linecap="round"/>' +
    '<path d="M200 128 C176 128 164 140 164 158 C164 178 180 186 206 182" fill="none" stroke="#E6A88E" stroke-width="13" stroke-linecap="round"/>' +
    '<path d="M74 312 L70 196 C70 182 80 178 96 180 L320 180 C336 180 344 190 344 204 L344 286 C344 300 336 304 324 306" fill="none" stroke="#C99A6B" stroke-width="22" stroke-linejoin="round"/>' +
    '<path d="M324 306 C300 312 296 336 268 336 C244 336 230 318 214 330 C204 338 204 348 204 356" fill="none" stroke="#C99A6B" stroke-width="18" stroke-linecap="round"/>' +
    '<rect x="192" y="352" width="24" height="40" rx="8" fill="#C99A6B" stroke="#7A5232" stroke-width="2"/>' +
    '<ellipse cx="92" cy="306" rx="26" ry="20" fill="#C99A6B" stroke="#7A5232" stroke-width="2"/>' +
    '<path d="M84 322 C82 336 80 346 86 356" fill="none" stroke="#C99A6B" stroke-width="7" stroke-linecap="round"/>' +
    '<path d="M206 184 C240 196 290 200 300 222 C306 244 250 236 230 250 C210 262 270 270 276 286 C280 302 230 296 200 300 C170 304 150 290 160 276 C170 260 210 266 214 250 C218 236 150 248 132 236 C118 226 130 210 150 212 C170 214 186 206 206 184" fill="none" stroke="#E7A99A" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<path d="M160 276 C140 290 118 300 110 302" fill="none" stroke="#E7A99A" stroke-width="10" stroke-linecap="round"/>' +
    marks(GI_P, items) +
    foot(414, ['Schematic anterior view, not to scale · viewer’s left = patient’s right', 'Small bowel loops are simplified; the pancreas lies behind the stomach'])));

  const DIAGRAMS = { heart, conduction, lungs, nephron, brain, gi };
  const NAMES = {
    heart: { ra: 'right atrium', rv: 'right ventricle', la: 'left atrium', lv: 'left ventricle', tricuspid: 'tricuspid valve', mitral: 'mitral valve', pulmonary: 'pulmonary valve', aortic: 'aortic valve', septum: 'interventricular septum', svc: 'superior vena cava', ivc: 'inferior vena cava', aorta: 'aorta', pa: 'pulmonary trunk', pv: 'pulmonary veins' },
    conduction: { san: 'sinoatrial (SA) node', avn: 'atrioventricular (AV) node', his: 'bundle of His', lbb: 'left bundle branch', rbb: 'right bundle branch', purkinje: 'Purkinje fibres' },
    lungs: { trachea: 'trachea', carina: 'carina', rmb: 'right main bronchus', lmb: 'left main bronchus', rul: 'right upper lobe', rml: 'right middle lobe', rll: 'right lower lobe', lul: 'left upper lobe', lll: 'left lower lobe', hfissure: 'horizontal fissure', ofissure: 'right oblique fissure', diaphragm: 'diaphragm', pleura: 'parietal pleura' },
    nephron: { afferent: 'afferent arteriole', efferent: 'efferent arteriole', glomerulus: 'glomerulus', bowman: 'Bowman’s capsule', pct: 'proximal convoluted tubule', dloop: 'descending limb of the loop of Henle', aloop: 'thick ascending limb of the loop of Henle', dct: 'distal convoluted tubule', cd: 'collecting duct', jga: 'juxtaglomerular apparatus' },
    brain: { frontal: 'frontal lobe', parietal: 'parietal lobe', temporal: 'temporal lobe', occipital: 'occipital lobe', cerebellum: 'cerebellum', brainstem: 'brainstem', central: 'central sulcus', lateral: 'lateral sulcus', precentral: 'precentral gyrus (primary motor cortex)', postcentral: 'postcentral gyrus (primary somatosensory cortex)', broca: 'Broca’s area', wernicke: 'Wernicke’s area' },
    gi: { oesophagus: 'oesophagus', stomach: 'stomach', duodenum: 'duodenum', jejunum: 'jejunum', ileum: 'ileum', caecum: 'caecum', appendix: 'appendix', ascending: 'ascending colon', transverse: 'transverse colon', descending: 'descending colon', sigmoid: 'sigmoid colon', rectum: 'rectum', liver: 'liver', gallbladder: 'gallbladder', pancreas: 'pancreas', spleen: 'spleen' }
  };
  const ALT = { heart: 'Schematic four-chamber heart with numbered structures', conduction: 'Schematic heart showing the conduction system with numbered structures', lungs: 'Schematic front view of the lungs and airways with numbered structures', nephron: 'Schematic nephron spanning cortex and medulla with numbered structures', brain: 'Schematic side view of the left cerebral hemisphere with numbered structures', gi: 'Schematic front view of the digestive tract with numbered structures' };

  // ---- ECG: illustrative lead II strip drawn from numbers (25 mm/s, 10 mm/mV, 4 px per mm) ----
  // e: { rhythm, rate, pr, qrs, qt, st, tw, ratio, atrialRate }; cal: [t1, t2] caliper times in seconds (optional)
  const ecg = (e, cal) => {
    e = e || {};
    const W = 720, H = 170, PXS = 100, MV = 40, base = 105, dur = W / PXS;
    let seed = 11; const rnd = () => { seed = (Math.imul(seed, 1103515245) + 12345) >>> 0; return (seed % 100000) / 100000; };
    const rh = e.rhythm || 'sinus';
    const rate = Math.max(20, Math.min(300, +e.rate || 75)), rr = 60 / rate;
    let pr = +e.pr || 0.16; const qrs = Math.max(0.06, +e.qrs || (rh === 'vt' ? 0.16 : 0.08)), qt = +e.qt || Math.min(0.44, Math.max(0.26, 0.4 * Math.sqrt(rr)));
    const st = Math.max(-0.4, Math.min(0.5, +e.st || 0)), tw = e.tw || 'normal';
    const wide = qrs >= 0.12;
    const ps = [], beats = [];
    if (rh === 'af') { let t = 0.5; while (t < dur) { beats.push(t); t += rr * (0.6 + 0.8 * rnd()); } }
    else if (rh === 'flutter') { const n = Math.max(2, Math.round(300 / rate)); for (let k = 0, t = 0.42; t < dur; k++, t += 0.2) { if (k % n === 1) beats.push(t + 0.06); } }
    else if (rh === 'chb') { const ar = 60 / Math.max(40, +e.atrialRate || +e.atrial || 80); for (let t = 0.45; t < dur; t += ar) ps.push(t); for (let t = 0.85; t < dur; t += rr) beats.push(t); }
    else if (rh === 'mobitz1') {
      // rate = atrial (P-wave) rate; PR lengthens over a 4:3 cycle then one P wave is not conducted
      const pp = 60 / Math.max(40, +e.atrialRate || rate); let k = 0;
      for (let t = 0.45; t < dur; t += pp, k++) { ps.push(t); const c = k % 4; if (c < 3) beats.push(t + pr + [0, 0.1, 0.16][c]); }
    } else if (rh === 'mobitz2') {
      const pp = 60 / Math.max(40, +e.atrialRate || rate); const ratio = Math.max(2, Math.min(4, Math.round(+e.ratio || 2))); let k = 0;
      for (let t = 0.45; t < dur; t += pp, k++) { ps.push(t); if (k % ratio !== ratio - 1) beats.push(t + pr); }
    } else if (rh === 'svt' || rh === 'vt') { for (let t = 0.5; t < dur; t += rr) beats.push(t); }
    else { for (let t = 0.45; t < dur; t += rr) { ps.push(t); beats.push(t + pr); } }
    const g = (x, mu, sg, a) => a * Math.exp(-((x - mu) * (x - mu)) / (2 * sg * sg));
    const tA = tw === 'peaked' ? 0.75 : tw === 'inverted' ? -0.28 : 0.3, tS = tw === 'peaked' ? 0.032 : 0.05;
    const v = (t) => {
      if (t < 0.38) return 0;
      let y = 0;
      ps.forEach((p) => { y += g(t, p + 0.045, 0.022, 0.15); });
      beats.forEach((b) => {
        if (rh === 'vt') { y += g(t, b + qrs * 0.45, qrs * 0.28, 1.1) + g(t, b + qrs + 0.08, 0.07, -0.55); return; }
        y += wide ? g(t, b + qrs * 0.42, qrs * 0.2, 1.0) + g(t, b + qrs * 0.82, qrs * 0.13, -0.35) + g(t, b + qt - 0.12, 0.06, -0.25)
          : g(t, b + qrs * 0.15, qrs * 0.1, -0.1) + g(t, b + qrs * 0.45, qrs * 0.13, 1.2) + g(t, b + qrs * 0.8, qrs * 0.11, -0.25) + g(t, b + qt - 0.11, tS, tA);
        if (st) { const s0 = b + qrs, s1 = b + qt - 0.11; if (t > s0 - 0.01 && t < s1) { const ramp = Math.min(1, (t - s0 + 0.01) / 0.02) * Math.min(1, (s1 - t) / 0.06); y += st * Math.max(0, ramp); } }
      });
      if (rh === 'af') y += 0.045 * Math.sin(2 * Math.PI * 6.3 * t + 2.5 * Math.sin(1.1 * t)) + 0.03 * Math.sin(2 * Math.PI * 8.9 * t + 1);
      if (rh === 'flutter') { const f = ((t - 0.42) / 0.2) % 1; y += f < 0.8 ? 0.08 - 0.3 * (f / 0.8) : -0.22 + 0.3 * ((f - 0.8) / 0.2); }
      return y;
    };
    let grid = '';
    for (let x = 0; x <= W; x += 4) grid += '<line x1="' + x + '" y1="0" x2="' + x + '" y2="' + H + '" stroke="' + (x % 20 ? '#F7D4D4' : '#E9A8A8') + '" stroke-width="' + (x % 20 ? 0.5 : 1) + '"/>';
    for (let y = 0; y <= H; y += 4) grid += '<line x1="0" y1="' + y + '" x2="' + W + '" y2="' + y + '" stroke="' + (y % 20 ? '#F7D4D4' : '#E9A8A8') + '" stroke-width="' + (y % 20 ? 0.5 : 1) + '"/>';
    let d = '';
    for (let x = 0; x <= W; x++) { const yy = base - v(x / PXS) * MV; d += (x ? 'L' : 'M') + x + ' ' + yy.toFixed(1); }
    let calSvg = '';
    const cs = (cal || []).filter((t) => Number.isFinite(t));
    cs.forEach((t) => { const x = (t * PXS).toFixed(1); calSvg += '<line x1="' + x + '" y1="0" x2="' + x + '" y2="' + H + '" stroke="#1D4ED8" stroke-width="2"/>'; });
    if (cs.length === 2) { const a = Math.min(cs[0], cs[1]) * PXS, b = Math.max(cs[0], cs[1]) * PXS; calSvg += '<rect x="' + a.toFixed(1) + '" y="0" width="' + (b - a).toFixed(1) + '" height="' + H + '" fill="#1D4ED8" opacity="0.08"/><line x1="' + a.toFixed(1) + '" y1="14" x2="' + b.toFixed(1) + '" y2="14" stroke="#1D4ED8" stroke-width="2"/>'; }
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + (H + 18) + '" width="' + W + '" height="' + (H + 18) + '"><rect width="100%" height="100%" fill="#FFF8F8"/>' + grid +
      '<path d="M4 ' + base + 'L8 ' + base + 'L8 ' + (base - MV) + 'L28 ' + (base - MV) + 'L28 ' + base + 'L32 ' + base + '" fill="none" stroke="#141414" stroke-width="1.5"/>' +
      '<path d="' + d + '" fill="none" stroke="#141414" stroke-width="1.6" stroke-linejoin="round"/>' + calSvg +
      '<text x="6" y="' + (H + 14) + '" ' + F + ' font-size="11" fill="#3F3F3B">Lead II · 25 mm/s · 10 mm/mV · small square 0.04 s · drawn illustration, not a real recording</text></svg>';
    return uri(svg);
  };

  // ---- content fingerprint: a clinician's sign-off covers exactly this topic content; any edit changes the hash ----
  const canon = (v) => Array.isArray(v) ? '[' + v.map(canon).join(',') + ']' : v && typeof v === 'object' ? '{' + Object.keys(v).sort().map((k) => JSON.stringify(k) + ':' + canon(v[k])).join(',') + '}' : JSON.stringify(v === undefined ? null : v);
  const topicContent = (pack, t) => {
    const of = (k) => (pack && Array.isArray(pack[k]) ? pack[k] : []).filter((x) => x && +x.t === +t);
    return { topic: (pack && pack.topics || [])[t] || '', notes: of('notes'), cards: of('cards'), questions: of('questions'), interpret: of('interpret'), cases: of('cases'), osce: of('osce'), labels: of('labels') };
  };
  const hash = (pack, t) => {
    const str = canon(topicContent(pack, t)); let a = 2166136261, b = 5381;
    for (let i = 0; i < str.length; i++) { const c = str.charCodeAt(i); a = Math.imul(a ^ c, 16777619) >>> 0; b = (Math.imul(b, 33) ^ c) >>> 0; }
    return ('0000000' + a.toString(16)).slice(-8) + ('0000000' + b.toString(16)).slice(-8);
  };

  return { DIAGRAMS, NAMES, ALT, ecg, hash, topicContent, svg: (name, items) => (DIAGRAMS[name] || heart)(items) };
})();
window.UZDIAG = UZDIAG;
