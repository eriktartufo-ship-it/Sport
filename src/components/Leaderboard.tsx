"use client";

import { useState, type ReactNode } from 'react';

export type LeaderboardRow = {
  id: string;
  /** Nome (giocatore o coppia). */
  name: string;
  /** 👑 o medaglia extra prima del nome (opz.). */
  crown?: boolean;
  /** Badge inline dopo il nome (trend, streak…). */
  badges?: ReactNode;
  /** Sottoriga muted con 1-2 fatti chiave. */
  sub?: ReactNode;
  /** Valore grande a destra. */
  primaryValue: string;
  /** Etichetta piccola sotto il valore. */
  primaryLabel: string;
  /** Tinta del valore: 'accent' | 'good' | undefined. */
  primaryTone?: 'accent' | 'good';
  /** Dettaglio espandibile al tap (pill/chips). Se assente la riga non è cliccabile. */
  details?: ReactNode;
};

type Props = {
  rows: LeaderboardRow[];
  /** KPI di sintesi in testa (opz.). */
  hero?: { value: string; label: string }[];
};

/**
 * Classifica in stile "rank-item" del design system RGV: una riga pulita per
 * entry (posizione · nome+sottoriga · metrica grande), podio colorato e
 * dettaglio completo espandibile. Rimpiazza la vecchia griglia di mini-box.
 */
export default function Leaderboard({ rows, hero }: Props) {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div>
      {hero && hero.length > 0 && (
        <div className="lb-hero">
          {hero.map((h, i) => (
            <div key={i} className="lb-hero-card">
              <div className="lb-hero-num">{h.value}</div>
              <div className="lb-hero-label">{h.label}</div>
            </div>
          ))}
        </div>
      )}

      <div className="leaderboard">
        {rows.map((r, idx) => {
          const rankClass = idx < 3 ? ` is-${idx + 1}` : '';
          const isOpen = openId === r.id;
          const clickable = !!r.details;

          const inner = (
            <>
              <span className={`lb-rank${rankClass}`}>{idx + 1}</span>
              <span className="lb-main">
                <span className="lb-name">
                  {r.crown && <span aria-hidden="true">👑</span>}
                  <span className="lb-name-text">{r.name}</span>
                  {r.badges}
                </span>
                {r.sub && <span className="lb-sub">{r.sub}</span>}
              </span>
              <span className="lb-primary">
                <span className={`lb-primary-value${r.primaryTone ? ` is-${r.primaryTone}` : ''}`}>
                  {r.primaryValue}
                  {clickable && <span className="lb-caret" aria-hidden="true">›</span>}
                </span>
                <span className="lb-primary-label">{r.primaryLabel}</span>
              </span>
            </>
          );

          return (
            <div key={r.id} className="lb-entry">
              {clickable ? (
                <button
                  type="button"
                  className={`lb-row ag-press${isOpen ? ' is-open' : ''}`}
                  onClick={() => setOpenId(isOpen ? null : r.id)}
                  aria-expanded={isOpen}
                >
                  {inner}
                </button>
              ) : (
                <div className="lb-row">{inner}</div>
              )}
              {clickable && isOpen && <div className="lb-details">{r.details}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Helper: una pill statistica per il dettaglio espandibile. */
export function LbStat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <span className="lb-stat">
      <span className="lb-stat-label">{label}</span>
      <span className="lb-stat-value">{value}</span>
    </span>
  );
}
