"use client";

import MatchDayList from './MatchDayList';

type Player = { id: string; name: string };
type Medal = 'GOLD' | 'SILVER' | 'BRONZE' | 'NONE';
type MatchResult = { id: string; medal: Medal; playerId: string; player: Player };
export type Match = {
  id: string;
  date: string;
  /** Ordine dentro la giornata — vedi `src/lib/match-order.ts`. */
  createdAt: string | null;
  playerCount: number;
  results: MatchResult[];
};

const MEDAL_EMOJI: Record<Medal, string> = {
  GOLD: '🥇',
  SILVER: '🥈',
  BRONZE: '🥉',
  NONE: '',
};

/**
 * Cronologia K.O. — il corpo della singola partita (podio + "Anche:").
 * La testata (giornata, numero della partita, azioni) è di `MatchDayList`,
 * condivisa con gli altri tre sport.
 */
export default function MatchHistory({
  matches,
  isAdmin = false,
  onReordered,
}: {
  matches: Match[];
  isAdmin?: boolean;
  onReordered?: () => void;
}) {
  if (matches.length === 0) {
    return <p className="muted">Nessuna partita registrata.</p>;
  }

  return (
    <MatchDayList
      matches={matches}
      isAdmin={isAdmin}
      sport="ko"
      onReordered={onReordered}
      render={(m) => {
        const podium = m.results
          .filter((r) => r.medal !== 'NONE')
          .sort((a, b) => {
            const order: Record<Medal, number> = { GOLD: 0, SILVER: 1, BRONZE: 2, NONE: 3 };
            return order[a.medal] - order[b.medal];
          });
        const others = m.results.filter((r) => r.medal === 'NONE');
        return {
          meta: `${m.playerCount} giocatori`,
          editHref: `/ko/match/${m.id}/edit`,
          body: (
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
          ),
        };
      }}
    />
  );
}
