/**
 * Scoring Machiavelli — funzioni pure separate dal layer Prisma per testabilità.
 *
 * Concetti chiave:
 *  - MatchMachiavelli = { date, results: [{ playerId, isWinner }] }
 *  - Nessun punteggio: vince chi finisce le carte per primo (1 winner per match,
 *    garantito dalla validation Zod).
 *  - Classifica per persona: wins DESC > winRate DESC > played DESC.
 *  - Streak = vittorie consecutive contando SOLO le partite a cui il player
 *    ha partecipato, in ordine cronologico. currentStreak parte dall'ultima
 *    partita giocata e si ferma alla prima sconfitta.
 */

export type MatchMachiavelliLite = {
  id: string;
  date: string | Date;
  results: { playerId: string; isWinner: boolean; player?: { name: string } }[];
};

export type PlayerRankingMachiavelli = {
  id: string;
  name: string;
  played: number;
  wins: number;
  losses: number;
  winRate: number; // 0..1
  currentStreak: number; // vittorie consecutive in corso (0 se ultima = sconfitta)
  bestStreak: number; // miglior serie di vittorie consecutive di sempre
  lastWinDate: string | null; // ISO della vittoria più recente (null se mai vinto)
};

/**
 * Classifica per persona sul totale dei match passati.
 * I match vengono ordinati per data ASC internamente: l'ordine dell'array
 * in input non conta.
 */
export function computePlayerRankingsMachiavelli(
  matches: MatchMachiavelliLite[]
): PlayerRankingMachiavelli[] {
  type Acc = {
    name: string;
    played: number;
    wins: number;
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
          currentStreak: 0,
          bestStreak: 0,
          lastWinDate: null,
        };
        buckets.set(r.playerId, acc);
      } else if (r.player?.name) {
        acc.name = r.player.name;
      }
      acc.played++;
      if (r.isWinner) {
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
    losses: a.played - a.wins,
    winRate: a.played === 0 ? 0 : a.wins / a.played,
    currentStreak: a.currentStreak,
    bestStreak: a.bestStreak,
    lastWinDate: a.lastWinDate,
  }));

  rows.sort((x, y) => {
    if (y.wins !== x.wins) return y.wins - x.wins;
    if (y.winRate !== x.winRate) return y.winRate - x.winRate;
    return y.played - x.played;
  });
  return rows;
}
