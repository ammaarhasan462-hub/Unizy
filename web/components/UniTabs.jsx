'use client';
// University tabs under the nav. Picking one switches the homepage to that university's colours, modules and
// figures; clicking the selected tab again goes back to all universities in Unizy's own colours.
// The choice is the same one made in the intro, and the dashboard picks it up after sign-up.
import { useEffect, useState } from 'react';
import { UNI_IDS, UNIS, getUni, setUni } from './story/unis';
import { track } from '@/lib/site';

const COL = { ucl: '#361A54', imperial: '#003E74', qmul: '#21376A', lse: '#C8102E' };

export default function UniTabs({ compact }) {
  const [uni, setU] = useState('');
  useEffect(() => {
    setU(getUni());
    const on = (e) => setU(e.detail || '');
    window.addEventListener('unizy:uni', on);
    return () => window.removeEventListener('unizy:uni', on);
  }, []);
  const choose = (id) => {
    const next = id === uni ? '' : id;
    setUni(next);
    track('lp_uni_' + (next || 'all'));
  };
  return (
    <div className={`mx-auto flex w-max max-w-[calc(100vw-24px)] items-center gap-1 overflow-x-auto rounded-full border border-white/40 bg-white/80 p-1 shadow-[0_8px_30px_-14px_rgba(0,0,0,.45)] backdrop-blur-md transition-all duration-500 [scrollbar-width:none] ${compact ? 'mt-1.5 scale-[.94]' : 'mt-2.5'}`} role="tablist" aria-label="Choose your university">
      <button type="button" role="tab" aria-selected={!uni} onClick={() => uni && choose(uni)} className={`shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-colors ${!uni ? 'bg-ink text-paper' : 'text-ink/70 hover:bg-ink/5 hover:text-ink'}`}>
        All unis
      </button>
      {UNI_IDS.map((id) => {
        const on = uni === id;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={on}
            title={on ? 'Showing ' + UNIS[id].name + '. Click again to show all universities' : UNIS[id].name}
            onClick={() => choose(id)}
            data-testid={'tab-' + id}
            className={`flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-colors ${on ? 'text-white' : 'text-ink/70 hover:bg-ink/5 hover:text-ink'}`}
            style={on ? { background: COL[id] } : undefined}
          >
            {!on && <i className="block size-2 rounded-full" style={{ background: COL[id] }} />}
            {UNIS[id].short}
            {on && <span aria-hidden="true" className="-mr-1 ml-0.5 text-[11px] opacity-70">✕</span>}
          </button>
        );
      })}
      <span className="shrink-0 cursor-default px-3 py-1.5 text-[13px] text-ink/35" title="King’s College London is coming soon">King’s · soon</span>
    </div>
  );
}
