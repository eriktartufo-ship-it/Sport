/**
 * Scoring Padel — funzioni pure separate dal layer Prisma per testabilità.
 *
 * Modello:
 *  - MatchPadel = 2 squadre (A, B) da 2 giocatori + lista di set [gamesA, gamesB].
 *  - Vincitore della partita = la squadra che ha vinto più SET.
 *  - Un set lo vince chi ha più game in quel set (no pareggio: la validation Zod
 *    garantisce set validi e partita con un vincitore).
 *  - "Squadra" come identità = coppia ORDINATA degli id (chiave canonica), come 3v3.
 */

export type Side = 'A' | 'B';
export type PadelSet = { a: number; b: number };

export type MatchPadelLite = {
  id: string;
  date: string | Date;
  sets: PadelSet[];
  results: { playerId: string; teamSide: Side; player?: { name: string } }[];
};

export type PadelTeamRanking = {
  teamKey: string;
  playerIds: string[];
  playerNames: string[];
  played: number;
  wins: number;
  losses: number;
  winRate: number;
  setsWon: number;
  setsLost: number;
  gamesWon: number;
  gamesLost: number;
  gameDiff: number; // gamesWon - gamesLost
};

export type Teammate = {
  playerId: string;
  name: string;
  matchesTogether: number;
  winsTogether: number;
  winRateTogether: number;
};

export type PadelPlayerRanking = {
  id: string;
  name: string;
  played: number;
  wins: number;
  losses: number;
  winRate: number;
  setsWon: number;
  setsLost: number;
  gamesWon: number;
  gamesLost: number;
  gameDiff: number;
  currentStreak: number;
  bestStreak: number;
  bestTeammate: Teammate | null;
  worstTeammate: Teammate | null;
};

/** Deserializza in sicurezza il campo setsJson di una MatchPadel. */
export function parseSets(setsJson: string): PadelSet[] {
  try {
    const raw = JSON.parse(setsJson);
    if (!Array.isArray(raw)) return [];
    return raw
      .filter((s) => Array.isArray(s) && s.length === 2)
      .map((s: [number, number]) => ({ a: Number(s[0]), b: Number(s[1]) }));
  } catch {
    return [];
  }
}

export function teamKey(playerIds: string[]): string {
  return [...playerIds].sort().join('|');
}

function getSide(match: MatchPadelLite, side: Side): string[] {
  return match.results.filter((r) => r.teamSide === side).map((r) => r.playerId);
}

/** Aggregati di una partita: chi ha vinto, set e game per lato. */
function tally(match: MatchPadelLite) {
  let setsA = 0;
  let setsB = 0;
  let gamesA = 0;
  let gamesB = 0;
  for (const s of match.sets) {
    gamesA += s.a;
    gamesB += s.b;
    if (s.a > s.b) setsA++;
    else if (s.b > s.a) setsB++;
  }
  const winner: Side = setsA >= setsB ? 'A' : 'B';
  return { setsA, setsB, gamesA, gamesB, winner };
}

/** Classifica per coppia (set esatto di 2 giocatori). */
export function computePadelTeamRankings(matches: MatchPadelLite[]): PadelTeamRanking[] {
  type Acc = {
    playerIds: string[];
    playerNames: string[];
    played: number;
    wins: number;
    setsWon: number;
    setsLost: number;
    gamesWon: number;
    gamesLost: number;
  };
  const buckets = new Map<string, Acc>();

  for (const m of matches) {
    const t = tally(m);
    const sides: Side[] = ['A', 'B'];
    for (const side of sides) {
      const ids = getSide(m, side);
      if (ids.length !== 2) continue;
      const key = teamKey(ids);
      const sortedIds = [...ids].sort();
      const namesByPid = new Map(
        m.results.filter((r) => r.teamSide === side).map((r) => [r.playerId, r.player?.name ?? ''])
      );
      const names = sortedIds.map((pid) => namesByPid.get(pid) ?? '');

      const setsWon = side === 'A' ? t.setsA : t.setsB;
      const setsLost = side === 'A' ? t.setsB : t.setsA;
      const gamesWon = side === 'A' ? t.gamesA : t.gamesB;
      const gamesLost = side === 'A' ? t.gamesB : t.gamesA;
      const won = side === t.winner;

      const cur = buckets.get(key) ?? {
        playerIds: sortedIds,
        playerNames: names,
        played: 0,
        wins: 0,
        setsWon: 0,
        setsLost: 0,
        gamesWon: 0,
        gamesLost: 0,
      };
      cur.played++;
      if (won) cur.wins++;
      cur.setsWon += setsWon;
      cur.setsLost += setsLost;
      cur.gamesWon += gamesWon;
      cur.gamesLost += gamesLost;
      cur.playerNames = names;
      buckets.set(key, cur);
    }
  }

  const rows: PadelTeamRanking[] = Array.from(buckets.entries()).map(([key, a]) => ({
    teamKey: key,
    playerIds: a.playerIds,
    playerNames: a.playerNames,
    played: a.played,
    wins: a.wins,
    losses: a.played - a.wins,
    winRate: a.played === 0 ? 0 : a.wins / a.played,
    setsWon: a.setsWon,
    setsLost: a.setsLost,
    gamesWon: a.gamesWon,
    gamesLost: a.gamesLost,
    gameDiff: a.gamesWon - a.gamesLost,
  }));

  rows.sort((x, y) => {
    if (y.wins !== x.wins) return y.wins - x.wins;
    if (y.winRate !== x.winRate) return y.winRate - x.winRate;
    if (y.gameDiff !== x.gameDiff) return y.gameDiff - x.gameDiff;
    return y.played - x.played;
  });
  return rows;
}

/** Classifica per persona (con best/worst compagno, min 2 partite insieme). */
export function computePadelPlayerRankings(matches: MatchPadelLite[]): PadelPlayerRanking[] {
  type Acc = {
    name: string;
    played: number;
    wins: number;
    setsWon: number;
    setsLost: number;
    gamesWon: number;
    gamesLost: number;
    currentStreak: number;
    bestStreak: number;
    matesAgg: Map<string, { name: string; together: number; wins: number }>;
  };
  const buckets = new Map<string, Acc>();
  const sorted = [...matches].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  const getOrInit = (pid: string, name: string): Acc => {
    let a = buckets.get(pid);
    if (!a) {
      a = {
        name,
        played: 0,
        wins: 0,
        setsWon: 0,
        setsLost: 0,
        gamesWon: 0,
        gamesLost: 0,
        currentStreak: 0,
        bestStreak: 0,
        matesAgg: new Map(),
      };
      buckets.set(pid, a);
    } else if (name) {
      a.name = name;
    }
    return a;
  };

  for (const m of sorted) {
    const t = tally(m);
    const sides: Side[] = ['A', 'B'];
    for (const side of sides) {
      const sideResults = m.results.filter((r) => r.teamSide === side);
      if (sideResults.length !== 2) continue;

      const setsWon = side === 'A' ? t.setsA : t.setsB;
      const setsLost = side === 'A' ? t.setsB : t.setsA;
      const gamesWon = side === 'A' ? t.gamesA : t.gamesB;
      const gamesLost = side === 'A' ? t.gamesB : t.gamesA;
      const won = side === t.winner;

      for (const r of sideResults) {
        const acc = getOrInit(r.playerId, r.player?.name ?? '');
        acc.played++;
        acc.setsWon += setsWon;
        acc.setsLost += setsLost;
        acc.gamesWon += gamesWon;
        acc.gamesLost += gamesLost;
        if (won) {
          acc.wins++;
          acc.currentStreak++;
          if (acc.currentStreak > acc.bestStreak) acc.bestStreak = acc.currentStreak;
        } else {
          acc.currentStreak = 0;
        }
        // compagno di coppia (l'altro dello stesso lato)
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

  const rows: PadelPlayerRanking[] = Array.from(buckets.entries()).map(([id, a]) => {
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
    if (best && worst && best.playerId === worst.playerId) worst = null;

    return {
      id,
      name: a.name,
      played: a.played,
      wins: a.wins,
      losses: a.played - a.wins,
      winRate: a.played === 0 ? 0 : a.wins / a.played,
      setsWon: a.setsWon,
      setsLost: a.setsLost,
      gamesWon: a.gamesWon,
      gamesLost: a.gamesLost,
      gameDiff: a.gamesWon - a.gamesLost,
      currentStreak: a.currentStreak,
      bestStreak: a.bestStreak,
      bestTeammate: best,
      worstTeammate: worst,
    };
  });

  rows.sort((x, y) => {
    if (y.wins !== x.wins) return y.wins - x.wins;
    if (y.winRate !== x.winRate) return y.winRate - x.winRate;
    if (y.gameDiff !== x.gameDiff) return y.gameDiff - x.gameDiff;
    return y.played - x.played;
  });
  return rows;
}
