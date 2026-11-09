// Canvas-drawn UI for the 3D hero: the dashboard screen, its back, and the floating cards.
// Drawn at high resolution so text stays crisp when the meshes rotate.

export function fonts() {
  const cs = getComputedStyle(document.documentElement);
  const v = (n, f) => (cs.getPropertyValue(n) || '').trim() || f;
  return {
    sans: v('--font-inter', "'Inter'") + ', system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
    display: v('--font-grotesk', "'Space Grotesk'") + ', system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
    mono: v('--font-jet', "'JetBrains Mono'") + ', ui-monospace, SFMono-Regular, Menlo, monospace',
  };
}

export function rr(ctx, x, y, w, h, r) {
  const k = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + k, y);
  ctx.arcTo(x + w, y, x + w, y + h, k);
  ctx.arcTo(x + w, y + h, x, y + h, k);
  ctx.arcTo(x, y + h, x, y, k);
  ctx.arcTo(x, y, x + w, y, k);
  ctx.closePath();
}

function grad(ctx, x0, y0, x1, y1, stops) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  stops.forEach(([o, c]) => g.addColorStop(o, c));
  return g;
}

const VIO_BLUE = [[0, '#3E6B5C'], [1, '#2B4F44']];
const VIO_CYAN = [[0, '#3E6B5C'], [0.6, '#5E8574'], [1, '#B8862F']];
const INK = '#17302A', MUTE = '#5D6D67', DIM = '#84918B', GREEN = '#3E6B5C', GOLD = '#B8862F', GOLD_D = '#8A5E1E';

function text(ctx, s, x, y, font, color, opts = {}) {
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = opts.align || 'left';
  ctx.textBaseline = opts.base || 'alphabetic';
  if ('letterSpacing' in ctx) ctx.letterSpacing = opts.ls || '0px';
  ctx.fillText(s, x, y);
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
}

function wrap(ctx, s, x, y, maxW, lh, font, color) {
  ctx.font = font;
  const words = s.split(' ');
  let line = '';
  let yy = y;
  for (const w of words) {
    const t = line ? line + ' ' + w : w;
    if (ctx.measureText(t).width > maxW && line) {
      text(ctx, line, x, yy, font, color);
      line = w;
      yy += lh;
    } else line = t;
  }
  if (line) text(ctx, line, x, yy, font, color);
}

function sparkline(ctx, pts, x, y, w, h, lw) {
  const xs = pts.map((p, i) => x + (i / (pts.length - 1)) * w);
  const ys = pts.map((p) => y + h - p * h);
  // area
  ctx.beginPath();
  ctx.moveTo(xs[0], y + h);
  xs.forEach((xx, i) => ctx.lineTo(xx, ys[i]));
  ctx.lineTo(xs[xs.length - 1], y + h);
  ctx.closePath();
  ctx.fillStyle = grad(ctx, 0, y, 0, y + h, [[0, 'rgba(62,107,92,.2)'], [1, 'rgba(62,107,92,0)']]);
  ctx.fill();
  // line
  ctx.beginPath();
  xs.forEach((xx, i) => (i ? ctx.lineTo(xx, ys[i]) : ctx.moveTo(xx, ys[i])));
  ctx.strokeStyle = grad(ctx, x, 0, x + w, 0, VIO_CYAN);
  ctx.lineWidth = lw;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(xs[xs.length - 1], ys[ys.length - 1], lw * 1.5, 0, Math.PI * 2);
  ctx.fillStyle = GOLD;
  ctx.shadowColor = 'rgba(184,134,47,.6)';
  ctx.shadowBlur = lw * 5;
  ctx.fill();
  ctx.shadowBlur = 0;
}

// ---------------- dashboard screen (2048 × 1300) ----------------
export function drawDashboard(ctx, W, H, f) {
  ctx.clearRect(0, 0, W, H);
  rr(ctx, 0, 0, W, H, 54);
  ctx.fillStyle = grad(ctx, 0, 0, W, H, [[0, '#FFFFFF'], [0.55, '#FAFAF6'], [1, '#F4F4EF']]);
  ctx.fill();
  ctx.save();
  rr(ctx, 0, 0, W, H, 54);
  ctx.clip();
  // soft colour fields
  let g = ctx.createRadialGradient(W * 0.85, 0, 0, W * 0.85, 0, 900);
  g.addColorStop(0, 'rgba(184,134,47,.10)');
  g.addColorStop(1, 'rgba(184,134,47,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  g = ctx.createRadialGradient(W * 0.35, H, 0, W * 0.35, H, 800);
  g.addColorStop(0, 'rgba(62,107,92,.08)');
  g.addColorStop(1, 'rgba(62,107,92,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // sidebar
  ctx.fillStyle = 'rgba(236,237,230,.75)';
  ctx.fillRect(0, 0, 400, H);
  ctx.fillStyle = 'rgba(23,48,42,.08)';
  ctx.fillRect(400, 0, 2, H);
  rr(ctx, 46, 50, 60, 60, 16);
  ctx.fillStyle = grad(ctx, 46, 50, 106, 110, VIO_BLUE);
  ctx.fill();
  text(ctx, 'S', 76, 92, `700 34px ${f.display}`, '#fff', { align: 'center' });
  text(ctx, 'SaveMyGrade', 124, 92, `600 32px ${f.display}`, INK);
  const nav = ['Home', 'Practice & marking', 'Tutor', 'Marked answers', 'Account'];
  nav.forEach((n, i) => {
    const y = 190 + i * 76;
    if (i === 0) {
      rr(ctx, 30, y - 44, 340, 66, 18);
      ctx.fillStyle = 'rgba(62,107,92,.12)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(62,107,92,.35)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    text(ctx, n, 60, y, `500 27px ${f.sans}`, i === 0 ? INK : MUTE);
  });
  text(ctx, 'MY MODULES', 52, 640, `500 20px ${f.mono}`, DIM, { ls: '4px' });
  [['ECON0013', GREEN], ['HIST0003', GOLD], ['POLS0006', '#23362F'], ['LAWS0001', GOLD_D]].forEach(([c, col], i) => {
    const y = 702 + i * 62;
    ctx.beginPath();
    ctx.arc(62, y - 8, 7, 0, Math.PI * 2);
    ctx.fillStyle = col;
    ctx.fill();
    text(ctx, c, 86, y, `500 24px ${f.mono}`, INK);
  });
  rr(ctx, 30, H - 150, 340, 104, 22);
  ctx.fillStyle = 'rgba(241,221,169,.55)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(184,134,47,.4)';
  ctx.stroke();
  text(ctx, 'Pro trial', 60, H - 100, `600 26px ${f.display}`, INK);
  text(ctx, '6 days left', 60, H - 64, `400 22px ${f.sans}`, GOLD_D);

  // main
  const X = 470;
  text(ctx, 'Hi Sam', X, 130, `700 70px ${f.display}`, INK, { ls: '-2px' });
  text(ctx, 'Economics BSc · Year 2 · 3 answers marked this week', X, 182, `400 26px ${f.sans}`, MUTE);
  const stats = [['14', 'answers marked'], ['2:1', 'average class'], ['71', 'best mark']];
  stats.forEach(([v, l], i) => {
    const x = X + i * 500;
    rr(ctx, x, 226, 470, 168, 26);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    ctx.strokeStyle = 'rgba(23,48,42,.10)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.font = `700 70px ${f.display}`;
    ctx.fillStyle = i === 1 ? grad(ctx, x + 36, 0, x + 160, 0, [[0, GREEN], [1, GOLD]]) : INK;
    ctx.textAlign = 'left';
    ctx.fillText(v, x + 36, 316);
    text(ctx, l, x + 38, 360, `400 25px ${f.sans}`, MUTE);
  });
  const mods = [['ECON0013', 'Microeconomics', 0.72], ['HIST0003', 'Approaching History', 0.48], ['POLS0006', 'Introduction to Politics', 0.6], ['LAWS0001', 'Contract Law', 0.35]];
  mods.forEach(([c, t, p], i) => {
    const x = X + (i % 2) * 750;
    const y = 428 + Math.floor(i / 2) * 214;
    rr(ctx, x, y, 720, 188, 26);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    ctx.strokeStyle = 'rgba(23,48,42,.09)';
    ctx.stroke();
    text(ctx, c, x + 34, y + 52, `500 23px ${f.mono}`, GREEN);
    text(ctx, t, x + 34, y + 102, `600 34px ${f.display}`, INK);
    rr(ctx, x + 34, y + 140, 652, 12, 6);
    ctx.fillStyle = 'rgba(23,48,42,.07)';
    ctx.fill();
    rr(ctx, x + 34, y + 140, 652 * p, 12, 6);
    ctx.fillStyle = grad(ctx, x + 34, 0, x + 34 + 652 * p, 0, VIO_CYAN);
    ctx.fill();
  });
  // latest marked answer
  const y0 = 870;
  rr(ctx, X, y0, 1470, 370, 28);
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();
  ctx.strokeStyle = 'rgba(184,134,47,.4)';
  ctx.stroke();
  text(ctx, 'LATEST MARKED ANSWER', X + 40, y0 + 62, `500 20px ${f.mono}`, GOLD_D, { ls: '4px' });
  rr(ctx, X + 40, y0 + 96, 150, 150, 30);
  ctx.fillStyle = grad(ctx, X + 40, y0 + 96, X + 190, y0 + 246, VIO_BLUE);
  ctx.shadowColor = 'rgba(23,48,42,.35)';
  ctx.shadowBlur = 30;
  ctx.fill();
  ctx.shadowBlur = 0;
  text(ctx, '2:1', X + 115, y0 + 196, `700 58px ${f.display}`, '#fff', { align: 'center' });
  text(ctx, 'Monopoly and elasticity', X + 230, y0 + 142, `600 38px ${f.display}`, INK);
  text(ctx, 'ECON0013 · predicted 62–66 · UCL Economics criteria', X + 230, y0 + 190, `400 25px ${f.sans}`, MUTE);
  const chips = [['Knowledge 2:1', '#FFFFFF', GREEN], ['Analysis 2:2', '#4D3B14', '#E8DCC0'], ['Structure First', '#F1DDA9', INK]];
  let cx = X + 230;
  chips.forEach(([t, col, bg]) => {
    ctx.font = `500 22px ${f.mono}`;
    const w = ctx.measureText(t).width + 40;
    rr(ctx, cx, y0 + 222, w, 46, 23);
    ctx.fillStyle = bg;
    ctx.fill();
    text(ctx, t, cx + 20, y0 + 253, `500 22px ${f.mono}`, col);
    cx += w + 14;
  });
  text(ctx, 'Next: derive MR = P(1 + 1/ε) before using it', X + 40, y0 + 322, `500 26px ${f.sans}`, '#23362F');
  sparkline(ctx, [0.15, 0.22, 0.2, 0.38, 0.46, 0.6, 0.78], X + 1110, y0 + 110, 320, 150, 6);
  text(ctx, 'Your marks', X + 1110, y0 + 300, `400 22px ${f.sans}`, DIM);
  ctx.restore();
  // edge highlight
  rr(ctx, 1.5, 1.5, W - 3, H - 3, 53);
  ctx.strokeStyle = grad(ctx, 0, 0, W, H, [[0, 'rgba(23,48,42,.10)'], [0.5, 'rgba(23,48,42,.06)'], [1, 'rgba(184,134,47,.35)']]);
  ctx.lineWidth = 3;
  ctx.stroke();
}

export function drawBack(ctx, W, H, f) {
  ctx.clearRect(0, 0, W, H);
  rr(ctx, 0, 0, W, H, 54);
  ctx.fillStyle = grad(ctx, 0, 0, W, H, [[0, '#23362F'], [0.5, '#17302A'], [1, '#2B4F44']]);
  ctx.fill();
  rr(ctx, W / 2 - 90, H / 2 - 190, 180, 180, 44);
  ctx.fillStyle = grad(ctx, W / 2 - 90, H / 2 - 190, W / 2 + 90, H / 2 - 10, VIO_BLUE);
  ctx.shadowColor = 'rgba(184,134,47,.8)';
  ctx.shadowBlur = 70;
  ctx.fill();
  ctx.shadowBlur = 0;
  text(ctx, 'S', W / 2, H / 2 - 62, `700 110px ${f.display}`, '#fff', { align: 'center' });
  text(ctx, 'SaveMyGrade', W / 2, H / 2 + 110, `700 96px ${f.display}`, '#fff', { align: 'center', ls: '-2px' });
  text(ctx, 'Marked like your department marks.', W / 2, H / 2 + 180, `400 40px ${f.sans}`, '#F1DDA9', { align: 'center' });
}

// ---------------- floating cards ----------------
function cardBase(ctx, W, H, tint) {
  ctx.clearRect(0, 0, W, H);
  rr(ctx, 6, 6, W - 12, H - 12, 44);
  ctx.fillStyle = grad(ctx, 0, 0, W, H, [[0, 'rgba(255,255,255,.97)'], [1, 'rgba(250,250,246,.92)']]);
  ctx.fill();
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, W * 0.9);
  g.addColorStop(0, tint);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.save();
  rr(ctx, 6, 6, W - 12, H - 12, 44);
  ctx.clip();
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
  rr(ctx, 7, 7, W - 14, H - 14, 43);
  ctx.strokeStyle = grad(ctx, 0, 0, W, H, [[0, 'rgba(184,134,47,.55)'], [0.5, 'rgba(23,48,42,.10)'], [1, 'rgba(23,48,42,.18)']]);
  ctx.lineWidth = 3;
  ctx.stroke();
}

export const CARDS = [
  {
    key: 'verdict', w: 640, h: 250, width: 1.95, pos: [-2.85, 1.6, 0.95],
    draw(ctx, W, H, f) {
      cardBase(ctx, W, H, 'rgba(62,107,92,.12)');
      rr(ctx, 40, 45, 160, 160, 34);
      ctx.fillStyle = grad(ctx, 40, 45, 200, 205, VIO_BLUE);
      ctx.shadowColor = 'rgba(23,48,42,.35)';
      ctx.shadowBlur = 26;
      ctx.fill();
      ctx.shadowBlur = 0;
      text(ctx, '2:1', 120, 152, `700 64px ${f.display}`, '#fff', { align: 'center' });
      text(ctx, 'ECON0013 · PREDICTED', 236, 100, `500 24px ${f.mono}`, GOLD_D, { ls: '2px' });
      text(ctx, '62–66', 234, 182, `700 82px ${f.display}`, INK, { ls: '-2px' });
    },
  },
  {
    key: 'changes', w: 760, h: 340, width: 2.3, pos: [2.85, 1.0, 0.7],
    draw(ctx, W, H, f) {
      cardBase(ctx, W, H, 'rgba(184,134,47,.14)');
      text(ctx, '3 CHANGES TO MOVE UP A CLASS', 44, 76, `500 24px ${f.mono}`, GOLD_D, { ls: '2px' });
      ['Derive MR = P(1 + 1/ε) first', 'Add the labelled diagram', 'End with the intuition'].forEach((t, i) => {
        const y = 150 + i * 66;
        rr(ctx, 44, y - 34, 44, 44, 12);
        ctx.fillStyle = '#F1DDA9';
        ctx.fill();
        text(ctx, String(i + 1), 66, y - 3, `600 26px ${f.display}`, GOLD_D, { align: 'center' });
        text(ctx, t, 110, y, `500 32px ${f.sans}`, INK);
      });
    },
  },
  {
    key: 'tutor', w: 720, h: 290, width: 2.2, pos: [-2.6, -1.55, 1.35],
    draw(ctx, W, H, f) {
      cardBase(ctx, W, H, 'rgba(62,107,92,.12)');
      const g = ctx.createConicGradient ? ctx.createConicGradient(0, 70, 78, 0) : null;
      if (g) {
        g.addColorStop(0, GREEN);
        g.addColorStop(0.5, GOLD);
        g.addColorStop(1, GREEN);
      }
      ctx.beginPath();
      ctx.arc(70, 78, 26, 0, Math.PI * 2);
      ctx.fillStyle = g || GREEN;
      ctx.fill();
      text(ctx, 'Professor UCL', 112, 90, `600 34px ${f.display}`, INK);
      text(ctx, 'online', 352, 90, `400 22px ${f.sans}`, GREEN);
      wrap(ctx, 'Start with the definition, then show why MR < P for a monopolist. That’s the step markers look for.', 44, 162, W - 88, 46, `400 29px ${f.sans}`, '#34463F');
    },
  },
  {
    key: 'chart', w: 660, h: 310, width: 2.0, pos: [2.7, -1.5, 0.45],
    draw(ctx, W, H, f) {
      cardBase(ctx, W, H, 'rgba(62,107,92,.10)');
      text(ctx, 'YOUR MARKS', 44, 70, `500 24px ${f.mono}`, GOLD_D, { ls: '2px' });
      text(ctx, '+9', W - 44, 74, `700 40px ${f.display}`, GREEN, { align: 'right' });
      ctx.setLineDash([8, 10]);
      ctx.beginPath();
      ctx.moveTo(44, 120);
      ctx.lineTo(W - 44, 120);
      ctx.strokeStyle = 'rgba(184,134,47,.55)';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.setLineDash([]);
      text(ctx, 'First', 48, 112, `500 20px ${f.mono}`, GOLD_D);
      sparkline(ctx, [0.12, 0.2, 0.18, 0.36, 0.5, 0.62, 0.85], 44, 130, W - 88, 140, 7);
    },
  },
  {
    key: 'module', w: 640, h: 220, width: 1.8, pos: [0.55, 2.3, -0.7],
    draw(ctx, W, H, f) {
      cardBase(ctx, W, H, 'rgba(184,134,47,.12)');
      text(ctx, 'MODULE HUB', 44, 70, `500 24px ${f.mono}`, GOLD_D, { ls: '2px' });
      text(ctx, 'HIST0003', 44, 140, `500 34px ${f.mono}`, GREEN);
      text(ctx, 'Approaching History', 230, 140, `600 34px ${f.display}`, INK);
      rr(ctx, 44, 168, W - 88, 12, 6);
      ctx.fillStyle = 'rgba(23,48,42,.07)';
      ctx.fill();
      rr(ctx, 44, 168, (W - 88) * 0.48, 12, 6);
      ctx.fillStyle = grad(ctx, 44, 0, 44 + (W - 88) * 0.48, 0, VIO_CYAN);
      ctx.fill();
    },
  },
];

export function radialGlow(ctx, W, H) {
  ctx.clearRect(0, 0, W, H);
  const g = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W / 2);
  g.addColorStop(0, 'rgba(184,134,47,.32)');
  g.addColorStop(0.35, 'rgba(62,107,92,.16)');
  g.addColorStop(0.65, 'rgba(62,107,92,.06)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}
