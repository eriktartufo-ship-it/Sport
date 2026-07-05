/**
 * Scoring Machiavelli — funzioni pure separate dal layer Prisma per testabilità.
 *
 * Concetti chiave:
 *  - MatchMachiavelli = { date, results: [{ playerId, position }] }
 *  - `position` è la posizione di arrivo (1 = vincitore, chi finisce le carte
 *    per primo; posizione più alta = chi resta con le carte in mano).
 *  - Punti di partita di un giocatore = position - 1 (il vincitore fa 0 punti).
 *  - In classifica generale VINCE CHI HA MENO PUNTI. Poiché non tutti giocano
 *    lo stesso numero di partite (madre/fratello a volte), il ranking primario
 *    è per MEDIA punti a partita (ascendente), non per totale.
 *  - Streak = vittorie consecutive (position === 1) contando SOLO le partite a
 *    cui il player ha partecipato, in ordine cronologico.
 */

export type MatchMachiavelliLite = {
  id: string;
  date: string | Date;
  results: { playerId: string; position: number; player?: { name: string } }[];
};

export type PlayerRankingMachiavelli = {
  id: string;
  name: string;
  played: number;
  wins: number; // partite chiuse per primo (position === 1)
  winRate: number; // 0..1
  points: number; // punti totali accumulati (somma di position - 1)
  pointsAvg: number; // media punti a partita — metrica di ranking (meno = meglio)
  currentStreak: number; // vittorie consecutive in corso
  bestStreak: number; // miglior serie di vittorie consecutive di sempre
  lastWinDate: string | null; // ISO della vittoria più recente (null se mai vinto)
};

/**
 * Classifica per persona sul totale dei match passati.
 * I match vengono ordinati per data ASC internamente (per gli streak):
 * l'ordine dell'array in input non conta.
 * Ordinamento finale: media punti ASC (meno punti = meglio), poi più partite
 * giocate (ranking più affidabile), poi più vittorie.
 */
export function computePlayerRankingsMachiavelli(
  matches: MatchMachiavelliLite[]
): PlayerRankingMachiavelli[] {
  type Acc = {
    name: string;
    played: number;
    wins: number;
    points: number;
    currentStreak: number;
    bestStreak: number;
    lastWinDate: string | null;
  };

  const buckets = new Map<string, Acc>();
  const sorted = [...matches].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  for (const m of sorted) {
    for (const r of m.results) {
      let acc = buckets.get(r.playerId);
      if (!acc) {
        acc = {
          name: r.player?.name ?? '',
          played: 0,
          wins: 0,
          points: 0,
          currentStreak: 0,
          bestStreak: 0,
          lastWinDate: null,
        };
        buckets.set(r.playerId, acc);
      } else if (r.player?.name) {
        acc.name = r.player.name;
      }
      acc.played++;
      acc.points += Math.max(0, r.position - 1);
      if (r.position === 1) {
        acc.wins++;
        acc.currentStreak++;
        if (acc.currentStreak > acc.bestStreak) acc.bestStreak = acc.currentStreak;
        acc.lastWinDate = new Date(m.date).toISOString();
      } else {
        acc.currentStreak = 0;
      }
    }
  }

  const rows: PlayerRankingMachiavelli[] = Array.from(buckets.entries()).map(([id, a]) => ({
    id,
    name: a.name,
    played: a.played,
    wins: a.wins,
    winRate: a.played === 0 ? 0 : a.wins / a.played,
    points: a.points,
    pointsAvg: a.played === 0 ? 0 : a.points / a.played,
    currentStreak: a.currentStreak,
    bestStreak: a.bestStreak,
    lastWinDate: a.lastWinDate,
  }));

  rows.sort((x, y) => {
    if (x.pointsAvg !== y.pointsAvg) return x.pointsAvg - y.pointsAvg; // meno punti = meglio
    if (y.played !== x.played) return y.played - x.played;
    return y.wins - x.wins;
  });
  return rows;
}
