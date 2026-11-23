'use client';
// Small shared pieces of the landing page. The reveal-on-scroll and magnetic buttons are plain CSS transitions
// driven by one shared IntersectionObserver (no animation library), so the homepage ships less script and does no
// per-frame work for them.
import { createElement, useEffect, useRef } from 'react';

let io = null;
function observe(el) {
  if (!el) return () => {};
  if (typeof IntersectionObserver === 'undefined') { el.classList.add('rv-in'); return () => {}; }
  if (!io) {
    io = new IntersectionObserver((ents) => ents.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add('rv-in'); io.unobserve(e.target); }
    }), { rootMargin: '-80px' });
  }
  io.observe(el);
  return () => io && io.unobserve(el);
}

// fades and rises in the first time it scrolls into view (globals.css: .rv)
export function Reveal({ children, delay = 0, y = 28, className = '', as = 'div' }) {
  const ref = useRef(null);
  useEffect(() => observe(ref.current), []);
  return createElement(as, { ref, className: `rv ${className}`, style: { '--rv-y': `${y}px`, '--rv-d': `${delay}s` } }, children);
}

// follows the mouse a little, springing back when it leaves (globals.css: .magnetic)
export function Magnetic({ children, strength = 0.22, className = '' }) {
  return (
    <div
      className={`magnetic inline-block ${className}`}
      onPointerMove={(e) => {
        if (e.pointerType !== 'mouse') return;
        const el = e.currentTarget, r = el.getBoundingClientRect();
        const x = (e.clientX - r.left - r.width / 2) * strength, y = (e.clientY - r.top - r.height / 2) * strength * 1.4;
        el.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0)`;
      }}
      onPointerLeave={(e) => { e.currentTarget.style.transform = ''; }}
    >
      {children}
    </div>
  );
}

export function Kicker({ children }) {
  return <span className="kicker">{children}</span>;
}

// Card with a cursor-following spotlight and glowing border.
export function SpotCard({ children, className = '' }) {
  return (
    <div
      className={`spot ${className}`}
      onPointerMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        e.currentTarget.style.setProperty('--mx', `${e.clientX - r.left}px`);
        e.currentTarget.style.setProperty('--my', `${e.clientY - r.top}px`);
      }}
    >
      <span className="spot-border" aria-hidden="true" />
      {children}
    </div>
  );
}

export function ClassPill({ cls = '2:1', size = 64, className = '' }) {
  return (
    <span className={`cls-pill rounded-2xl ${className}`} style={{ width: size, height: size, fontSize: size * 0.36 }}>
      {cls}
    </span>
  );
}

export function Chip({ cls }) {
  const c = cls === 'First' ? 'chip-first' : cls === '2:1' ? 'chip-21' : 'chip-22';
  return <span className={`chip ${c}`}>{cls}</span>;
}

export function Logo({ className = '' }) {
  return (
    <a href="/" className={`flex items-center gap-2.5 font-display text-[19px] font-semibold tracking-tight text-ink ${className}`} aria-label="Unizy home">
      <span className="grid size-8 place-items-center rounded-[10px] bg-linear-to-br from-vio to-blue text-[15px] font-bold text-white shadow-[0_0_24px_-4px_rgba(62,107,92,0.41)]">U</span>
      Unizy
    </a>
  );
}
