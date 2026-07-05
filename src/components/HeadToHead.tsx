"use client";

import { useEffect, useMemo, useState } from 'react';

type Player = { id: string; name: string };
type Medal = 'GOLD' | 'SILVER' | 'BRONZE' | 'NONE';

type H2HMatch = {
  matchId: string;
  date: string;
  p1Medal: Medal;
  p2Medal: Medal;
  winner: 'p1' | 'p2' | 'tie';
};

type H2HResult = {
  p1: { id: string; name: string };
  p2: { id: string; name: string };
  totalMatches: number;
  p1Wins: number;
  p2Wins: number;
  ties: number;
  matches: H2HMatch[];
};

const MEDAL_EMOJI: Record<Medal, string> = {
  GOLD: '🥇',
  SILVER: '🥈',
  BRONZE: '🥉',
  NONE: '—',
};

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });

export default function HeadToHead({ players }: { players: Player[] }) {
  const [p1Id, setP1Id] = useState<string>('');
  const [p2Id, setP2Id] = useState<string>('');
  const [data, setData] = useState<H2HResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // "Mai giocato insieme" NON è un errore: stato vuoto informativo (muted).
  const [emptyMsg, setEmptyMsg] = useState<string | null>(null);

  // Default: primi due player diversi
  useEffect(() => {
    if (players.length >= 2 && !p1Id && !p2Id) {
      setP1Id(players[0].id);
      setP2Id(players[1].id);
    }
  }, [players, p1Id, p2Id]);

  const canCompare = useMemo(
    () => p1Id && p2Id && p1Id !== p2Id,
    [p1Id, p2Id],
  );

  useEffect(() => {
    if (!canCompare) {
      setData(null);
      return;
    }
    const ctrl = new AbortController();
    setLoading(true);
    setError(null);
    setEmptyMsg(null);
    fetch(`/api/stats/h2h?p1=${encodeURIComponent(p1Id)}&p2=${encodeURIComponent(p2Id)}`, {
      signal: ctrl.signal,
      cache: 'no-store',
    })
      .then(async (r) => {
        if (!r.ok) {
          const e = await r.json().catch(() => ({}));
          const err = new Error(e.error || `Errore ${r.status}`) as Error & { status?: number };
          err.status = r.status;
          throw err;
        }
        return r.json();
      })
      .then((d: H2HResult) => setData(d))
      .catch((e: Error & { status?: number }) => {
        if (e.name === 'AbortError') return;
        // 404 = "mai giocato insieme": stato vuoto, non errore rosso.
        if (e.status === 404) setEmptyMsg('Questi due giocatori non hanno mai giocato insieme.');
        else setError(e.message);
      })
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, [p1Id, p2Id, canCompare]);

  if (players.length < 2) {
    return (
      <div className="card">
        <p className="muted">Servono almeno 2 giocatori per il confronto.</p>
      </div>
    );
  }

  return (
    <div className="card h2h-card">
      <h2 className="card-title">Confronto diretto</h2>

      <div className="h2h-selectors">
        <select
          className="input h2h-select"
          value={p1Id}
          onChange={(e) => setP1Id(e.target.value)}
          aria-label="Giocatore 1"
        >
          {players.map((p) => (
            <option key={p.id} value={p.id} disabled={p.id === p2Id}>{p.name}</option>
          ))}
        </select>

        <span className="h2h-vs">VS</span>

        <select
          className="input h2h-select"
          value={p2Id}
          onChange={(e) => setP2Id(e.target.value)}
          aria-label="Giocatore 2"
        >
          {players.map((p) => (
            <option key={p.id} value={p.id} disabled={p.id === p1Id}>{p.name}</option>
          ))}
        </select>
      </div>

      {loading && <p className="muted" style={{ marginTop: '1rem' }}>Caricamento...</p>}
      {error && <p style={{ color: 'var(--danger)', marginTop: '1rem' }}>{error}</p>}
      {emptyMsg && <p className="muted h2h-empty">{emptyMsg}</p>}

      {data && data.totalMatches === 0 && (
        <p className="muted" style={{ marginTop: '1rem' }}>
          {data.p1.name} e {data.p2.name} non hanno mai giocato insieme.
        </p>
      )}

      {data && data.totalMatches > 0 && (
        <>
          <div className="h2h-score">
            <div className="h2h-side">
              <div className="h2h-name">{data.p1.name}</div>
              <div className={`h2h-wins ${data.p1Wins > data.p2Wins ? 'leading' : ''}`}>
                {data.p1Wins}
              </div>
            </div>
            <div className="h2h-divider">
              <div className="h2h-total">{data.totalMatches} partite</div>
              {data.ties > 0 && <div className="h2h-ties">{data.ties} pareggi</div>}
            </div>
            <div className="h2h-side">
              <div className="h2h-name">{data.p2.name}</div>
              <div className={`h2h-wins ${data.p2Wins > data.p1Wins ? 'leading' : ''}`}>
                {data.p2Wins}
              </div>
            </div>
          </div>

          <h3 className="h2h-history-title">Cronologia diretta</h3>
          <div className="h2h-history">
            {data.matches.map((m) => (
              <div
                key={m.matchId}
                className={`h2h-row h2h-row-${m.winner}`}
              >
                <span className="h2h-row-date">{formatDate(m.date)}</span>
                <div className="h2h-row-medals">
                  <span className="h2h-medal-cell">{MEDAL_EMOJI[m.p1Medal]}</span>
                  <span className="h2h-row-sep">vs</span>
                  <span className="h2h-medal-cell">{MEDAL_EMOJI[m.p2Medal]}</span>
                </div>
                <span className="h2h-row-winner">
                  {m.winner === 'p1' && `→ ${data.p1.name}`}
                  {m.winner === 'p2' && `→ ${data.p2.name}`}
                  {m.winner === 'tie' && '— pari'}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
