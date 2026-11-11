'use client';
import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Logo } from './ui';
import UniTabs from './UniTabs';
import { hasSession, track } from '@/lib/site';

const LINKS = [
  ['How it works', '#how'],
  ['Features', '#features'],
  ['Find your module', '/mark'],
  ['Pricing', '#pricing'],
  ['FAQ', '#faq'],
];

export default function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [authed, setAuthed] = useState(false);
  useEffect(() => {
    setAuthed(hasSession());
    const on = () => setScrolled(window.scrollY > 12);
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);

  return (
    <motion.header
      initial={{ y: -40, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
      className="fixed inset-x-0 top-0 z-50"
    >
      <div className={`mx-auto mt-3 flex max-w-[1240px] items-center justify-between rounded-full px-4 py-2.5 transition-all duration-500 sm:px-5 ${scrolled || open ? 'glass mx-3 shadow-[0_10px_40px_-12px_rgba(0,0,0,.8)] sm:mx-6 xl:mx-auto' : 'border border-transparent'}`}>
        <Logo className={scrolled || open ? '' : 'text-paper!'} />
        <nav className="hidden items-center gap-1 lg:flex" aria-label="Main">
          {LINKS.map(([t, h]) => (
            <a key={h} href={h} className={`group relative rounded-full px-4 py-2 text-[14.5px] transition-colors ${scrolled ? 'text-mute hover:text-ink' : 'text-paper/75 hover:text-paper'}`}>
              {t}
              <span className="absolute inset-x-4 bottom-1 h-px origin-left scale-x-0 bg-linear-to-r from-vio to-cyan transition-transform duration-300 group-hover:scale-x-100" />
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          {!authed && (
            <a href="/login?next=/dashboard" className={`hidden rounded-full px-4 py-2 text-[14.5px] font-medium sm:inline-block ${scrolled ? 'text-ink/90 hover:text-ink' : 'text-paper/90 hover:text-paper'}`}>
              Log in
            </a>
          )}
          <a href={authed ? '/dashboard' : '/signup'} onClick={() => track('lp_nav_signup')} className="btn btn-glow px-5 py-2.5 text-[14.5px]">
            {authed ? 'Dashboard' : 'Sign up free'}
          </a>
          <button
            type="button"
            className="grid size-10 place-items-center rounded-full border border-ink/10 bg-white/70 lg:hidden"
            aria-label="Menu"
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
          >
            <span className="relative block h-3 w-4">
              <span className={`absolute left-0 top-0 h-[1.5px] w-4 bg-ink transition-transform duration-300 ${open ? 'translate-y-[5px] rotate-45' : ''}`} />
              <span className={`absolute bottom-0 left-0 h-[1.5px] w-4 bg-ink transition-transform duration-300 ${open ? '-translate-y-[5px] -rotate-45' : ''}`} />
            </span>
          </button>
        </div>
      </div>
      <UniTabs compact={scrolled} />
      <AnimatePresence>
        {open && (
          <motion.nav
            initial={{ opacity: 0, y: -12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.98 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="glass mx-3 mt-2 rounded-3xl p-3 sm:mx-6 lg:hidden"
            aria-label="Mobile"
          >
            {LINKS.map(([t, h], i) => (
              <motion.a
                key={h}
                href={h}
                onClick={() => setOpen(false)}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.04 * i }}
                className="block rounded-2xl px-4 py-3 text-[17px] text-ink/90 hover:bg-ink/5"
              >
                {t}
              </motion.a>
            ))}
            {!authed && (
              <a href="/login?next=/dashboard" className="block rounded-2xl px-4 py-3 text-[17px] text-ink/90 hover:bg-ink/5">
                Log in
              </a>
            )}
          </motion.nav>
        )}
      </AnimatePresence>
    </motion.header>
  );
}
