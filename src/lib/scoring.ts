/**
 * Logica di scoring/trend/daysPlayed pura, isolata da Prisma per essere
 * testabile senza DB. Il route /api/stats/ko fa la query e poi delega
 * a computePlayerStats().
 */

export type Medal = 'GOLD' | 'SILVER' | 'BRONZE' | 'NONE';

export type Trend = 'up' | 'down' | 'stable' | 'unknown';

export type ScoringResult = {
  matchId: string;
  playerId: string;
  medal: Medal;
  player: { name: string };
  match: { date: Date };
};

export type PlayerStat = {
  id: string;
  name: string;
  matchesPlayed: number;
  daysPlayed: number;
  gold: number;
  silver: number;
  bronze: number;
  score: number;
  podiumPercentage: number;
  recentAvg: number | null;
  baselineAvg: number | null;
  trend: Trend;
};

export type ScoringOptions = {
  recentWindow?: number;
  trendThreshold?: number;
  trendMinMatches?: number;
};

export const SCORE_BY_MEDAL: Record<Medal, number> = {
  GOLD: 10,
  SILVER: 5,
  BRONZE: 2,
  NONE: 0,
};

/** Rank della medaglia per il confronto H2H: più basso = meglio. */
export const MEDAL_RANK: Record<Medal, number> = {
  GOLD: 0,
  SILVER: 1,
  BRONZE: 2,
  NONE: 3,
};

export type H2HMatch = {
  matchId: string;
  date: Date;
  p1Medal: Medal;
  p2Medal: Medal;
  winner: 'p1' | 'p2' | 'tie';
};

export type HeadToHeadResult = {
  p1: { id: string; name: string };
  p2: { id: string; name: string };
  totalMatches: number;
  p1Wins: number;
  p2Wins: number;
  ties: number;
  matches: H2HMatch[];
};

/**
 * Confronto diretto tra due player: filtra le sole partite dove entrambi
 * hanno giocato e calcola chi è finito sopra all'altro nel podio.
 * Vince chi ha la medaglia con rank più basso (GOLD=0 < SILVER=1 < BRONZE=2 < NONE=3).
 * Pareggio se entrambi hanno la stessa medaglia (caso comune: entrambi NONE).
 *
 * Ritorna null se p1Id === p2Id o se uno dei due non ha mai giocato.
 * `matches` è ordinato per data desc (più recenti prima).
 */
export function computeHeadToHead(
  p1Id: string,
  p2Id: string,
  results: ScoringResult[],
): HeadToHeadResult | null {
  if (p1Id === p2Id) return null;

  type MatchEntry = { matchId: string; date: Date; p1?: ScoringResult; p2?: ScoringResult };
  const byMatch: Record<string, MatchEntry> = {};
  let p1Info: { id: string; name: string } | null = null;
  let p2Info: { id: string; name: string } | null = null;

  for (const r of results) {
    if (r.playerId !== p1Id && r.playerId !== p2Id) continue;
    if (r.playerId === p1Id && !p1Info) p1Info = { id: p1Id, name: r.player.name };
    if (r.playerId === p2Id && !p2Info) p2Info = { id: p2Id, name: r.player.name };

    if (!byMatch[r.matchId]) {
      byMatch[r.matchId] = { matchId: r.matchId, date: r.match.date };
    }
    if (r.playerId === p1Id) byMatch[r.matchId].p1 = r;
    else byMatch[r.matchId].p2 = r;
  }

  if (!p1Info || !p2Info) return null;

  const shared = Object.values(byMatch).filter((e) => e.p1 && e.p2);
  shared.sort((a, b) => b.date.getTime() - a.date.getTime());

  let p1Wins = 0;
  let p2Wins = 0;
  let ties = 0;
  const matches: H2HMatch[] = shared.map((e) => {
    const m1 = e.p1!.medal;
    const m2 = e.p2!.medal;
    let winner: 'p1' | 'p2' | 'tie';
    if (MEDAL_RANK[m1] < MEDAL_RANK[m2]) { winner = 'p1'; p1Wins++; }
    else if (MEDAL_RANK[m1] > MEDAL_RANK[m2]) { winner = 'p2'; p2Wins++; }
    else { winner = 'tie'; ties++; }
    return { matchId: e.matchId, date: e.date, p1Medal: m1, p2Medal: m2, winner };
  });

  return {
    p1: p1Info,
    p2: p2Info,
    totalMatches: matches.length,
    p1Wins,
    p2Wins,
    ties,
    matches,
  };
}

const DEFAULTS: Required<ScoringOptions> = {
  recentWindow: 5,
  trendThreshold: 0.1,
  trendMinMatches: 4,
};

/**
 * Aggrega i MatchResult per player e calcola:
 * - matchesPlayed, daysPlayed (giornate UTC distinte)
 * - gold/silver/bronze counter
 * - score (somma punti per medaglia)
 * - podiumPercentage (% di partite a podio)
 * - recentAvg / baselineAvg / trend (up/down/stable/unknown)
 *
 * Ritorna l'array ordinato per score desc, parità su podiumPercentage desc.
 */
export function computePlayerStats(
  results: ScoringResult[],
  options: ScoringOptions = {},
): PlayerStat[] {
  const opts = { ...DEFAULTS, ...options };

  const statsMap: Record<string, PlayerStat> = {};
  const perPlayerTimeline: Record<string, Array<{ date: Date; score: number }>> = {};
  const perPlayerDays: Record<string, Set<string>> = {};

  for (const res of results) {
    const pid = res.playerId;
    if (!statsMap[pid]) {
      statsMap[pid] = {
        id: pid,
        name: res.player.name,
        matchesPlayed: 0,
        daysPlayed: 0,
        gold: 0,
        silver: 0,
        bronze: 0,
        score: 0,
        podiumPercentage: 0,
        recentAvg: null,
        baselineAvg: null,
        trend: 'unknown',
      };
    }
    const matchScore = SCORE_BY_MEDAL[res.medal] ?? 0;
    statsMap[pid].matchesPlayed++;
    statsMap[pid].score += matchScore;
    if (res.medal === 'GOLD') statsMap[pid].gold++;
    else if (res.medal === 'SILVER') statsMap[pid].silver++;
    else if (res.medal === 'BRONZE') statsMap[pid].bronze++;

    if (!perPlayerTimeline[pid]) perPlayerTimeline[pid] = [];
    perPlayerTimeline[pid].push({ date: res.match.date, score: matchScore });

    if (!perPlayerDays[pid]) perPlayerDays[pid] = new Set();
    perPlayerDays[pid].add(res.match.date.toISOString().slice(0, 10));
  }

  for (const pid of Object.keys(statsMap)) {
    const stat = statsMap[pid];
    const podiums = stat.gold + stat.silver + stat.bronze;
    stat.podiumPercentage = stat.matchesPlayed > 0
      ? Math.round((podiums / stat.matchesPlayed) * 100)
      : 0;
    stat.daysPlayed = perPlayerDays[pid]?.size ?? 0;

    const timeline = perPlayerTimeline[pid] ?? [];
    timeline.sort((a, b) => a.date.getTime() - b.date.getTime());
    if (timeline.length >= opts.trendMinMatches) {
      const recentSlice = timeline.slice(-opts.recentWindow);
      const baselineSlice = timeline.slice(0, Math.max(0, timeline.length - recentSlice.length));
      const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

      const recent = avg(recentSlice.map((t) => t.score));
      stat.recentAvg = Math.round(recent * 100) / 100;

      if (baselineSlice.length > 0) {
        const baseline = avg(baselineSlice.map((t) => t.score));
        stat.baselineAvg = Math.round(baseline * 100) / 100;
        if (baseline === 0) {
          stat.trend = recent > 0 ? 'up' : 'stable';
        } else {
          const delta = (recent - baseline) / baseline;
          if (delta > opts.trendThreshold) stat.trend = 'up';
          else if (delta < -opts.trendThreshold) stat.trend = 'down';
          else stat.trend = 'stable';
        }
      } else {
        stat.trend = 'stable';
      }
    }
  }

  const statsArray = Object.values(statsMap);
  statsArray.sort((a, b) => b.score - a.score || b.podiumPercentage - a.podiumPercentage);
  return statsArray;
}
