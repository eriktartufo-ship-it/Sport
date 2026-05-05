"use client";

import { useEffect, useRef, useState } from 'react';

export type SlideTab<TId extends string> = {
  id: TId;
  label: string;
  short?: string;
  icon?: string;
};

type Props<TId extends string> = {
  tabs: SlideTab<TId>[];
  active: TId;
  onChange: (id: TId) => void;
};

export default function SlideTabs<TId extends string>({ tabs, active, onChange }: Props<TId>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const [pill, setPill] = useState({ left: 0, width: 0, opacity: 0 });

  useEffect(() => {
    const idx = tabs.findIndex((t) => t.id === active);

    const update = () => {
      const el = refs.current[idx];
      if (el) {
        setPill({ left: el.offsetLeft, width: el.clientWidth, opacity: 1 });
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
      {tabs.map((tab, i) => (
        <button
          key={tab.id}
          ref={(el) => { refs.current[i] = el; }}
          role="tab"
          aria-selected={active === tab.id}
          className={`slide-tab ${active === tab.id ? 'active' : ''}`}
          onClick={() => onChange(tab.id)}
        >
          {tab.icon && <span className="slide-tab-icon" aria-hidden="true">{tab.icon}</span>}
          <span className="slide-tab-label">{tab.label}</span>
          {tab.short && <span className="slide-tab-short">{tab.short}</span>}
        </button>
      ))}
    </div>
  );
}
