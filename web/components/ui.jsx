'use client';
import { motion, useMotionValue, useSpring } from 'framer-motion';

const EASE = [0.16, 1, 0.3, 1];

export function Reveal({ children, delay = 0, y = 28, className = '', as = 'div' }) {
  const M = motion[as] || motion.div;
  return (
    <M
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.9, ease: EASE, delay }}
    >
      {children}
    </M>
  );
}

export function Magnetic({ children, strength = 0.22, className = '' }) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 220, damping: 16, mass: 0.4 });
  const sy = useSpring(y, { stiffness: 220, damping: 16, mass: 0.4 });
  return (
    <motion.div
      className={`inline-block ${className}`}
      style={{ x: sx, y: sy }}
      onPointerMove={(e) => {
        if (e.pointerType !== 'mouse') return;
        const r = e.currentTarget.getBoundingClientRect();
        x.set((e.clientX - r.left - r.width / 2) * strength);
        y.set((e.clientY - r.top - r.height / 2) * strength * 1.4);
      }}
      onPointerLeave={() => {
        x.set(0);
        y.set(0);
      }}
    >
      {children}
    </motion.div>
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
