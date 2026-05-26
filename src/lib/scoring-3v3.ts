/**
 * Scoring 3vs3 — funzioni pure separate dal layer Prisma per testabilità.
 *
 * Concetti chiave:
 *  - Match3v3 = { teamA: [p1,p2,p3], teamB: [p4,p5,p6], teamAScore, teamBScore }
 *  - "Squadra" come identità = set ORDINATO degli id dei 3 player (chiave
 *    canonical = `${id1}|${id2}|${id3}` con sort lex). Due match con
 *    stessi 3 player danno la stessa chiave teamKey.
 *  - Vincitore sempre definito (no pareggio per validation Zod).
 *  - playerScore = 1 per vittoria, 0 per sconfitta (semplice win-rate).
 */

export type Side = 'A' | 'B';

export type Match3v3Lite = {
  id: string;
  date: string | Date;
  teamAScore: number;
  teamBScore: number;
  results: { playerId: string; teamSide: Side; player?: { name: string } }[];
};

export type TeamRanking = {
  teamKey: string; // "p1|p2|p3" sort lex
  playerIds: string[]; // sortati lex
  playerNames: string[]; // stesso ordine di playerIds
  played: number;
  wins: number;
  losses: number;
  winRate: number; // 0..1
  pointsScoredTotal: number; // somma punti FATTI dalla squadra
  pointsConcededTotal: number; // somma punti SUBITI
  pointDiffAvg: number; // (scored - conceded) / played, signed
};

export type Teammate = {
  playerId: string;
  name: string;
  matchesTogether: number;
  winsTogether: number;
  winRateTogether: number;
};

export type PlayerRanking3v3 = {
  id: string;
  name: string;
  played: number;
  wins: number;
  losses: number;
  winRate: number; // 0..1
  pointsScoredAvg: number; // punti FATTI dalla squadra di cui faceva parte, mediati per match
  pointsScoredTotal: number;
  marginAvg: number; // (own team score - opponent score) mediato, signed: positivo = domina
  marginAvgOnWins: number; // come sopra ma solo nelle vittorie (0 se nessuna)
  marginAvgOnLosses: number; // come sopra ma solo nelle sconfitte (0 se nessuna)
  bestTeammate: Teammate | null; // compagno con win-rate maggiore (min 2 partite insieme)
  worstTeammate: Teammate | null; // compagno con win-rate minore (min 2 partite insieme)
};

/**
 * Builda la chiave canonica di una squadra: ids sortati alfanumerici,
 * separati da `|`. Idempotente, deterministica.
 */
export function teamKey(playerIds: string[]): string {
  return [...playerIds].sort().join('|');
}

function getSide(match: Match3v3Lite, side: Side): string[] {
  return match.results.filter((r) => r.teamSide === side).map((r) => r.playerId);
}

function winnerSide(match: Match3v3Lite): Side {
  return match.teamAScore > match.teamBScore ? 'A' : 'B';
}

/**
 * Classifica per combinazione di 3 player (set esatto).
 * Ordina per wins DESC, poi winRate DESC, poi played DESC.
 */
export function computeTeamRankings(matches: Match3v3Lite[]): TeamRanking[] {
  type Acc = {
    playerIds: string[];
    playerNames: string[];
    played: number;
    wins: number;
    pointsScored: number;
    pointsConceded: number;
  };
  const buckets = new Map<string, Acc>();

  for (const m of matches) {
    const w = winnerSide(m);
    const sides: Side[] = ['A', 'B'];
    for (const side of sides) {
      const ids = getSide(m, side);
      if (ids.length !== 3) continue; // skip corrupted
      const key = teamKey(ids);
      const sortedIds = [...ids].sort();
      const namesByPid = new Map(
        m.results.filter((r) => r.teamSide === side).map((r) => [r.playerId, r.player?.name ?? ''])
      );
      const names = sortedIds.map((pid) => namesByPid.get(pid) ?? '');

      const own = side === 'A' ? m.teamAScore : m.teamBScore;
      const opp = side === 'A' ? m.teamBScore : m.teamAScore;
      const won = side === w;

      const cur = buckets.get(key) ?? {
        playerIds: sortedIds,
        playerNames: names,
        played: 0,
        wins: 0,
        pointsScored: 0,
        pointsConceded: 0,
      };
      cur.played++;
      if (won) cur.wins++;
      cur.pointsScored += own;
      cur.pointsConceded += opp;
      // aggiorna nomi (in caso di rename successivi: usiamo l'ultimo visto)
      cur.playerNames = names;
      buckets.set(key, cur);
    }
  }

  const rows: TeamRanking[] = Array.from(buckets.entries()).map(([key, a]) => ({
    teamKey: key,
    playerIds: a.playerIds,
    playerNames: a.playerNames,
    played: a.played,
    wins: a.wins,
    losses: a.played - a.wins,
    winRate: a.played === 0 ? 0 : a.wins / a.played,
    pointsScoredTotal: a.pointsScored,
    pointsConcededTotal: a.pointsConceded,
    pointDiffAvg: a.played === 0 ? 0 : (a.pointsScored - a.pointsConceded) / a.played,
  }));

  rows.sort((x, y) => {
    if (y.wins !== x.wins) return y.wins - x.wins;
    if (y.winRate !== x.winRate) return y.winRate - x.winRate;
    return y.played - x.played;
  });
  return rows;
}

/**
 * Classifica per persona.
 * Best teammate = compagno con winRate-insieme massimo (min 2 partite insieme).
 * Worst teammate = compagno con winRate-insieme minimo (min 2 partite insieme).
 * Ordinata per winRate DESC, played DESC.
 */
export function computePlayerRankings3v3(matches: Match3v3Lite[]): PlayerRanking3v3[] {
  type Acc = {
    name: string;
    played: number;
    wins: number;
    pointsScored: number; // somma own-team score
    marginSum: number; // somma (own - opp)
    marginSumWins: number;
    marginSumLosses: number;
    // mate aggregator: per ogni compagno {pid: {together, wins, name}}
    matesAgg: Map<string, { name: string; together: number; wins: number }>;
  };

  const buckets = new Map<string, Acc>();

  const getOrInit = (pid: string, name: string): Acc => {
    let a = buckets.get(pid);
    if (!a) {
      a = {
        name,
        played: 0,
        wins: 0,
        pointsScored: 0,
        marginSum: 0,
        marginSumWins: 0,
        marginSumLosses: 0,
        matesAgg: new Map(),
      };
      buckets.set(pid, a);
    } else if (name) {
      a.name = name;
    }
    return a;
  };

  for (const m of matches) {
    const w = winnerSide(m);
    const sides: Side[] = ['A', 'B'];
    for (const side of sides) {
      const sideResults = m.results.filter((r) => r.teamSide === side);
      if (sideResults.length !== 3) continue;

      const own = side === 'A' ? m.teamAScore : m.teamBScore;
      const opp = side === 'A' ? m.teamBScore : m.teamAScore;
      const margin = own - opp;
      const won = side === w;

      for (const r of sideResults) {
        const acc = getOrInit(r.playerId, r.player?.name ?? '');
        acc.played++;
        if (won) acc.wins++;
        acc.pointsScored += own;
        acc.marginSum += margin;
        if (won) acc.marginSumWins += margin;
        else acc.marginSumLosses += margin;

        // mate aggregation
        for (const other of sideResults) {
          if (other.playerId === r.playerId) continue;
          const cur = acc.matesAgg.get(other.playerId) ?? {
            name: other.player?.name ?? '',
            together: 0,
            wins: 0,
          };
          cur.together++;
          if (won) cur.wins++;
          if (other.player?.name) cur.name = other.player.name;
          acc.matesAgg.set(other.playerId, cur);
        }
      }
    }
  }

  const rows: PlayerRanking3v3[] = Array.from(buckets.entries()).map(([id, a]) => {
    const losses = a.played - a.wins;
    const winRate = a.played === 0 ? 0 : a.wins / a.played;

    let best: Teammate | null = null;
    let worst: Teammate | null = null;
    const MIN_TOGETHER = 2;
    for (const [mateId, mate] of a.matesAgg.entries()) {
      if (mate.together < MIN_TOGETHER) continue;
      const rate = mate.wins / mate.together;
      const cand: Teammate = {
        playerId: mateId,
        name: mate.name,
        matchesTogether: mate.together,
        winsTogether: mate.wins,
        winRateTogether: rate,
      };
      if (!best || rate > best.winRateTogether) best = cand;
      if (!worst || rate < worst.winRateTogether) worst = cand;
    }
    // se best == worst e c'è solo 1 mate qualificato, lascia best e azzera worst per non duplicare
    if (best && worst && best.playerId === worst.playerId) {
      worst = null;
    }

    return {
      id,
      name: a.name,
      played: a.played,
      wins: a.wins,
      losses,
      winRate,
      pointsScoredAvg: a.played === 0 ? 0 : a.pointsScored / a.played,
      pointsScoredTotal: a.pointsScored,
      marginAvg: a.played === 0 ? 0 : a.marginSum / a.played,
      marginAvgOnWins: a.wins === 0 ? 0 : a.marginSumWins / a.wins,
      marginAvgOnLosses: losses === 0 ? 0 : a.marginSumLosses / losses,
      bestTeammate: best,
      worstTeammate: worst,
    };
  });

  rows.sort((x, y) => {
    if (y.winRate !== x.winRate) return y.winRate - x.winRate;
    return y.played - x.played;
  });
  return rows;
}
