"use client";

import Link from 'next/link';

type Player = { id: string; name: string };
type Medal = 'GOLD' | 'SILVER' | 'BRONZE' | 'NONE';
type MatchResult = { id: string; medal: Medal; playerId: string; player: Player };
export type Match = {
  id: string;
  date: string;
  playerCount: number;
  results: MatchResult[];
};

const MEDAL_EMOJI: Record<Medal, string> = {
  GOLD: '🥇',
  SILVER: '🥈',
  BRONZE: '🥉',
  NONE: '',
};

const formatDate = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

export default function MatchHistory({
  matches,
  isAdmin = false,
}: {
  matches: Match[];
  isAdmin?: boolean;
}) {
  if (matches.length === 0) {
    return <p style={{ color: 'rgba(255,255,255,0.6)' }}>Nessuna partita registrata.</p>;
  }

  return (
    <div>
      {matches.map((m) => {
        const podium = m.results
          .filter((r) => r.medal !== 'NONE')
          .sort((a, b) => {
            const order: Record<Medal, number> = { GOLD: 0, SILVER: 1, BRONZE: 2, NONE: 3 };
            return order[a.medal] - order[b.medal];
          });
        const others = m.results.filter((r) => r.medal === 'NONE');
        return (
          <div key={m.id} className="match-row">
            <div className="match-row-head">
              <span className="match-row-date">{formatDate(m.date)}</span>
              <span className="match-row-count">{m.playerCount} giocatori</span>
              {isAdmin && (
                <Link href={`/ko/match/${m.id}/edit`} className="match-row-edit" title="Modifica partita">
                  ✏️
                </Link>
              )}
            </div>
            <div className="match-row-players">
              <div className="match-row-podium">
                {podium.map((r) => (
                  <span key={r.id} className="match-row-podium-item">
                    {MEDAL_EMOJI[r.medal]} {r.player.name}
                  </span>
                ))}
              </div>
              {others.length > 0 && (
                <div className="match-row-others">
                  <span className="match-row-others-label">Anche:</span>
                  {others.map((r) => (
                    <span key={r.id} className="match-row-others-item">{r.player.name}</span>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
