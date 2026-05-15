"use client";

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

export type SlideTab<TId extends string> = {
  id: TId;
  label: string;
  short?: string;
  icon?: string;
  /** Se presente, il "tab" è in realtà un link a quella route e NON
   *  partecipa allo stato attivo (no pill highlight, no onChange). */
  href?: string;
  /** Variant visivo: 'cta' lo evidenzia come call-to-action separata. */
  variant?: 'default' | 'cta';
};

type Props<TId extends string> = {
  tabs: SlideTab<TId>[];
  active: TId;
  onChange: (id: TId) => void;
};

export default function SlideTabs<TId extends string>({ tabs, active, onChange }: Props<TId>) {
  const refs = useRef<(HTMLElement | null)[]>([]);
  const [pill, setPill] = useState({ left: 0, width: 0, opacity: 0 });

  useEffect(() => {
    // Il pill highlight segue il tab con id=active, anche se è un href-tab.
    // Cosi' il nav funziona uniformemente sia con tab di stato (button)
    // sia con tab di navigazione (Link) — comportamento atteso a livello UX.
    const idx = tabs.findIndex((t) => t.id === active);

    const update = () => {
      const el = refs.current[idx];
      if (el && idx >= 0) {
        setPill({ left: el.offsetLeft, width: el.clientWidth, opacity: 1 });
      } else {
        setPill((p) => ({ ...p, opacity: 0 }));
      }
    };

    const t = setTimeout(update, 10);
    window.addEventListener('resize', update);
    return () => {
      clearTimeout(t);
      window.removeEventListener('resize', update);
    };
  }, [active, tabs]);

  return (
    <div className="slide-tabs" role="tablist">
      <div
        className="slide-tabs-highlight"
        style={{ left: pill.left, width: pill.width, opacity: pill.opacity }}
      />
      {tabs.map((tab, i) => {
        const className = [
          'slide-tab',
          active === tab.id ? 'active' : '',
          tab.variant === 'cta' ? 'slide-tab-cta' : '',
        ].filter(Boolean).join(' ');

        const inner = (
          <>
            {tab.icon && <span className="slide-tab-icon" aria-hidden="true">{tab.icon}</span>}
            <span className="slide-tab-label">{tab.label}</span>
            {tab.short && <span className="slide-tab-short">{tab.short}</span>}
          </>
        );

        if (tab.href) {
          return (
            <Link
              key={tab.id}
              ref={(el) => { refs.current[i] = el as HTMLElement | null; }}
              href={tab.href}
              role="tab"
              className={className}
            >
              {inner}
            </Link>
          );
        }

        return (
          <button
            key={tab.id}
            ref={(el) => { refs.current[i] = el as HTMLElement | null; }}
            role="tab"
            aria-selected={active === tab.id}
            className={className}
            onClick={() => onChange(tab.id)}
          >
            {inner}
          </button>
        );
      })}
    </div>
  );
}
