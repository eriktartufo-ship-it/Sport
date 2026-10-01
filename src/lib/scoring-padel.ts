/**
 * Scoring Padel — funzioni pure separate dal layer Prisma per testabilità.
 *
 * Modello:
 *  - MatchPadel = 2 squadre (A, B) da 2 giocatori + lista di set [gamesA, gamesB].
 *  - Vincitore della partita = la squadra che ha vinto più SET.
 *  - Un set lo vince chi ha più game in quel set (un set pari non esiste: la
 *    validation Zod garantisce set validi).
 *  - A parità di set (1-1, 2-2: si gioca finché c'è tempo) la partita è PAREGGIO
 *    (regola di Erik, 2026-09-30). Il pareggio interrompe la serie di vittorie.
 *  - "Squadra" come identità = coppia ORDINATA degli id (chiave canonica), come 3v3.
 *
 * Classifiche (regola di Erik, 2026-10-01 — sostituisce la Win%):
 *  - COPPIE: punti come nel calcio, vittoria 3 · pareggio 1 · sconfitta 0.
 *    A pari punti decide la differenza set (vinti − persi), poi i set vinti.
 *  - PERSONE (correzione di Erik, stesso giorno): contano i GAME, non i set — un 6-3
 *    vale 6 game vinti e 3 persi. Ordine: differenza game, poi game vinti.
 *  - ATTACCANTI = più vinti · DIFENSORI = meno persi. Le coppie li contano in SET,
 *    le persone in GAME: `rankAttack`/`rankDefense` non sanno l'unità, la sceglie chi chiama.
 */

export const POINTS_WIN = 3;
export const POINTS_DRAW = 1;
export const POINTS_LOSS = 0;

import { compareChrono } from './match-order';

export type Side = 'A' | 'B';
export type PadelSet = { a: number; b: number };

export type MatchPadelLite = {
  id: string;
  date: string | Date;
  /** Spareggio a parità di giornata: senza, lo streak dipende dall'ordine del DB. */
  createdAt?: string | Date | null;
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
  draws: number;
  /** vittorie×3 + pareggi×1 */
  points: number;
  setsWon: number;
  setsLost: number;
  setDiff: number; // setsWon - setsLost
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
  draws: number;
  setsWon: number;
  setsLost: number;
  setDiff: number; // setsWon - setsLost
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

/** Win% con il pareggio a mezza vittoria (resta solo per il compagno migliore/peggiore). */
function winRateOf(wins: number, draws: number, played: number): number {
  return played === 0 ? 0 : (wins + draws / 2) / played;
}

/** Aggregati di una partita: chi ha vinto (null = pareggio), set e game per lato. */
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
  // prima era `setsA >= setsB ? 'A' : 'B'`: a parità di set vinceva sempre A
  const winner: Side | null = setsA > setsB ? 'A' : setsB > setsA ? 'B' : null;
  return { setsA, setsB, gamesA, gamesB, winner };
}

/** Classifica per coppia (set esatto di 2 giocatori). */
export function computePadelTeamRankings(matches: MatchPadelLite[]): PadelTeamRanking[] {
  type Acc = {
    playerIds: string[];
    playerNames: string[];
    played: number;
    wins: number;
    draws: number;
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
        draws: 0,
        setsWon: 0,
        setsLost: 0,
        gamesWon: 0,
        gamesLost: 0,
      };
      cur.played++;
      if (won) cur.wins++;
      else if (t.winner === null) cur.draws++;
      cur.setsWon += setsWon;
      cur.setsLost += setsLost;
      cur.gamesWon += gamesWon;
      cur.gamesLost += gamesLost;
      cur.playerNames = names;
      buckets.set(key, cur);
    }
  }

  const rows: PadelTeamRanking[] = Array.from(buckets.entries()).map(([key, a]) => {
    const losses = a.played - a.wins - a.draws;
    return {
      teamKey: key,
      playerIds: a.playerIds,
      playerNames: a.playerNames,
      played: a.played,
      wins: a.wins,
      losses,
      draws: a.draws,
      points: a.wins * POINTS_WIN + a.draws * POINTS_DRAW + losses * POINTS_LOSS,
      setsWon: a.setsWon,
      setsLost: a.setsLost,
      setDiff: a.setsWon - a.setsLost,
      gamesWon: a.gamesWon,
      gamesLost: a.gamesLost,
      gameDiff: a.gamesWon - a.gamesLost,
    };
  });

  // punti → differenza set → set vinti → differenza game
  rows.sort((x, y) => {
    if (y.points !== x.points) return y.points - x.points;
    if (y.setDiff !== x.setDiff) return y.setDiff - x.setDiff;
    if (y.setsWon !== x.setsWon) return y.setsWon - x.setsWon;
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
    draws: number;
    setsWon: number;
    setsLost: number;
    gamesWon: number;
    gamesLost: number;
    currentStreak: number;
    bestStreak: number;
    matesAgg: Map<string, { name: string; together: number; wins: number; draws: number }>;
  };
  const buckets = new Map<string, Acc>();
  const sorted = [...matches].sort(compareChrono);

  const getOrInit = (pid: string, name: string): Acc => {
    let a = buckets.get(pid);
    if (!a) {
      a = {
        name,
        played: 0,
        wins: 0,
        draws: 0,
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
          // anche il pareggio interrompe la serie: la serie conta vittorie di fila
          if (t.winner === null) acc.draws++;
          acc.currentStreak = 0;
        }
        // compagno di coppia (l'altro dello stesso lato)
        for (const other of sideResults) {
          if (other.playerId === r.playerId) continue;
          const cur = acc.matesAgg.get(other.playerId) ?? {
            name: other.player?.name ?? '',
            together: 0,
            wins: 0,
            draws: 0,
          };
          cur.together++;
          if (won) cur.wins++;
          else if (t.winner === null) cur.draws++;
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
      const rate = winRateOf(mate.wins, mate.draws, mate.together);
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
      losses: a.played - a.wins - a.draws,
      draws: a.draws,
      setsWon: a.setsWon,
      setsLost: a.setsLost,
      setDiff: a.setsWon - a.setsLost,
      gamesWon: a.gamesWon,
      gamesLost: a.gamesLost,
      gameDiff: a.gamesWon - a.gamesLost,
      currentStreak: a.currentStreak,
      bestStreak: a.bestStreak,
      bestTeammate: best,
      worstTeammate: worst,
    };
  });

  // differenza game → game vinti → differenza set
  rows.sort((x, y) => {
    if (y.gameDiff !== x.gameDiff) return y.gameDiff - x.gameDiff;
    if (y.gamesWon !== x.gamesWon) return y.gamesWon - x.gamesWon;
    if (y.setDiff !== x.setDiff) return y.setDiff - x.setDiff;
    return y.played - x.played;
  });
  return rows;
}

/** Riga per attaccanti/difensori: vinti/persi nell'unità scelta da chi chiama (set o game). */
export type AttackDefenseLine = { won: number; lost: number; played: number };

/**
 * Migliori ATTACCANTI: più vinti. A parità, chi li ha vinti in meno partite
 * (più prolifico), poi chi ne ha persi meno.
 */
export function rankAttack<T extends AttackDefenseLine>(rows: readonly T[]): T[] {
  return [...rows].sort((x, y) => {
    if (y.won !== x.won) return y.won - x.won;
    if (x.played !== y.played) return x.played - y.played;
    return x.lost - y.lost;
  });
}

/**
 * Migliori DIFENSORI: meno persi. A parità, chi li ha persi in più partite
 * (ha tenuto più a lungo), poi chi ne ha vinti di più.
 * ⚠️ È un totale, non una media: chi ha giocato poco parte avvantaggiato.
 */
export function rankDefense<T extends AttackDefenseLine>(rows: readonly T[]): T[] {
  return [...rows].sort((x, y) => {
    if (x.lost !== y.lost) return x.lost - y.lost;
    if (y.played !== x.played) return y.played - x.played;
    return y.won - x.won;
  });
}
