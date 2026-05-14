import { describe, it, expect } from 'vitest';
import {
  computePlayerStats,
  computeHeadToHead,
  SCORE_BY_MEDAL,
  MEDAL_RANK,
  type ScoringResult,
} from './scoring';

let __matchSeq = 0;
const r = (
  playerId: string,
  playerName: string,
  medal: ScoringResult['medal'],
  dateIso: string,
  matchId?: string,
): ScoringResult => ({
  matchId: matchId ?? `m-${++__matchSeq}`,
  playerId,
  medal,
  player: { name: playerName },
  match: { date: new Date(dateIso) },
});

describe('computePlayerStats — base scoring', () => {
  it('ritorna [] su input vuoto', () => {
    expect(computePlayerStats([])).toEqual([]);
  });

  it('1 player con 1 GOLD → score=10, gold=1, podio=100%, daysPlayed=1', () => {
    const stats = computePlayerStats([r('p1', 'Mario', 'GOLD', '2026-05-01')]);
    expect(stats).toHaveLength(1);
    expect(stats[0]).toMatchObject({
      id: 'p1',
      name: 'Mario',
      matchesPlayed: 1,
      daysPlayed: 1,
      gold: 1,
      silver: 0,
      bronze: 0,
      score: 10,
      podiumPercentage: 100,
      trend: 'unknown',
    });
  });

  it('scoring 10/5/2/0 per GOLD/SILVER/BRONZE/NONE', () => {
    expect(SCORE_BY_MEDAL).toEqual({ GOLD: 10, SILVER: 5, BRONZE: 2, NONE: 0 });
  });

  it('player con tutte le medaglie → score 10+5+2 = 17, podio 100%', () => {
    const stats = computePlayerStats([
      r('p1', 'Mario', 'GOLD', '2026-05-01'),
      r('p1', 'Mario', 'SILVER', '2026-05-02'),
      r('p1', 'Mario', 'BRONZE', '2026-05-03'),
    ]);
    expect(stats[0]).toMatchObject({
      score: 17,
      gold: 1,
      silver: 1,
      bronze: 1,
      podiumPercentage: 100,
      matchesPlayed: 3,
    });
  });

  it('NONE non aggiunge punti ma conta matchesPlayed', () => {
    const stats = computePlayerStats([
      r('p1', 'Mario', 'GOLD', '2026-05-01'),
      r('p1', 'Mario', 'NONE', '2026-05-02'),
      r('p1', 'Mario', 'NONE', '2026-05-03'),
    ]);
    expect(stats[0]).toMatchObject({
      score: 10,
      matchesPlayed: 3,
      podiumPercentage: 33, // 1 podio su 3
    });
  });
});

describe('computePlayerStats — daysPlayed (giornate UTC distinte)', () => {
  it('3 match in 1 solo giorno → daysPlayed=1, matchesPlayed=3', () => {
    const stats = computePlayerStats([
      r('p1', 'Mario', 'GOLD', '2026-05-01T10:00:00Z'),
      r('p1', 'Mario', 'NONE', '2026-05-01T15:00:00Z'),
      r('p1', 'Mario', 'SILVER', '2026-05-01T20:00:00Z'),
    ]);
    expect(stats[0].daysPlayed).toBe(1);
    expect(stats[0].matchesPlayed).toBe(3);
  });

  it('1 match al giorno per 5 giorni → daysPlayed=5', () => {
    const stats = computePlayerStats([
      r('p1', 'X', 'GOLD', '2026-05-01'),
      r('p1', 'X', 'NONE', '2026-05-02'),
      r('p1', 'X', 'NONE', '2026-05-03'),
      r('p1', 'X', 'NONE', '2026-05-04'),
      r('p1', 'X', 'NONE', '2026-05-05'),
    ]);
    expect(stats[0].daysPlayed).toBe(5);
  });
});

describe('computePlayerStats — ordinamento', () => {
  it('ordina per score desc, parità su podio desc', () => {
    const stats = computePlayerStats([
      // p1: score 5, 1 partita, podio 100%
      r('p1', 'A', 'SILVER', '2026-05-01'),
      // p2: score 10, 2 partite, podio 50%
      r('p2', 'B', 'GOLD', '2026-05-01'),
      r('p2', 'B', 'NONE', '2026-05-02'),
      // p3: score 10, 1 partita, podio 100% (tie con p2 su score, ma podio meglio)
      r('p3', 'C', 'GOLD', '2026-05-03'),
    ]);
    expect(stats.map((s) => s.id)).toEqual(['p3', 'p2', 'p1']);
  });
});

describe('computePlayerStats — trend', () => {
  // helper: genera N risultati GOLD per un player (score 10 ciascuno)
  const gen = (id: string, n: number, dateStart: string, medal: ScoringResult['medal'] = 'GOLD') => {
    const start = new Date(dateStart);
    return Array.from({ length: n }, (_, i) => {
      const d = new Date(start);
      d.setUTCDate(d.getUTCDate() + i);
      return r(id, id, medal, d.toISOString());
    });
  };

  it('trend=unknown se matchesPlayed < trendMinMatches (default 4)', () => {
    const stats = computePlayerStats(gen('p1', 3, '2026-05-01'));
    expect(stats[0].trend).toBe('unknown');
    expect(stats[0].recentAvg).toBeNull();
    expect(stats[0].baselineAvg).toBeNull();
  });

  it('trend=up se recent > baseline * 1.1 (recente migliore)', () => {
    // Primi 3 NONE (score 0), poi 5 GOLD (score 10) → recent media 10, baseline media 0 → up
    const stats = computePlayerStats([
      ...gen('p1', 3, '2026-05-01', 'NONE'),
      ...gen('p1', 5, '2026-05-04', 'GOLD'),
    ]);
    expect(stats[0].trend).toBe('up');
    expect(stats[0].recentAvg).toBe(10);
    expect(stats[0].baselineAvg).toBe(0);
  });

  it('trend=down se recent < baseline * 0.9 (recente peggiore)', () => {
    // Primi 3 GOLD (score 10), poi 5 NONE (score 0) → recent 0, baseline 10 → down
    const stats = computePlayerStats([
      ...gen('p1', 3, '2026-05-01', 'GOLD'),
      ...gen('p1', 5, '2026-05-04', 'NONE'),
    ]);
    expect(stats[0].trend).toBe('down');
    expect(stats[0].recentAvg).toBe(0);
    expect(stats[0].baselineAvg).toBe(10);
  });

  it("trend=stable se delta entro ±10%", () => {
    // 8 GOLD tutti: recent 10, baseline 10 → stable
    const stats = computePlayerStats(gen('p1', 8, '2026-05-01', 'GOLD'));
    expect(stats[0].trend).toBe('stable');
  });

  it('recentWindow custom: window=2 prende solo gli ultimi 2', () => {
    // 4 match: 2 GOLD, 2 NONE alla fine.
    // Default window=5 → tutti i 4 considerati come "recent" (baseline vuoto → stable)
    // Custom window=2 → recent = ultimi 2 NONE → 0, baseline = primi 2 GOLD → 10 → down
    const results = [
      ...gen('p1', 2, '2026-05-01', 'GOLD'),
      ...gen('p1', 2, '2026-05-03', 'NONE'),
    ];
    const trendDefault = computePlayerStats(results)[0].trend;
    const trendW2 = computePlayerStats(results, { recentWindow: 2 })[0].trend;
    expect(trendDefault).toBe('stable'); // baseline vuoto fallback stable
    expect(trendW2).toBe('down');
  });
});

describe('computePlayerStats — più player nella stessa partita', () => {
  it('aggrega correttamente N player', () => {
    const stats = computePlayerStats([
      r('p1', 'Mario', 'GOLD', '2026-05-01'),
      r('p2', 'Luigi', 'SILVER', '2026-05-01'),
      r('p3', 'Peach', 'BRONZE', '2026-05-01'),
      r('p4', 'Toad', 'NONE', '2026-05-01'),
    ]);
    expect(stats).toHaveLength(4);
    expect(stats.find((s) => s.id === 'p1')?.score).toBe(10);
    expect(stats.find((s) => s.id === 'p2')?.score).toBe(5);
    expect(stats.find((s) => s.id === 'p3')?.score).toBe(2);
    expect(stats.find((s) => s.id === 'p4')?.score).toBe(0);
  });
});

describe('computeHeadToHead', () => {
  it('MEDAL_RANK: GOLD < SILVER < BRONZE < NONE', () => {
    expect(MEDAL_RANK).toEqual({ GOLD: 0, SILVER: 1, BRONZE: 2, NONE: 3 });
  });

  it('ritorna null se p1Id === p2Id', () => {
    expect(computeHeadToHead('p1', 'p1', [])).toBeNull();
  });

  it('ritorna null se uno dei due non ha mai giocato', () => {
    const results = [
      r('p1', 'Mario', 'GOLD', '2026-05-01', 'm1'),
    ];
    expect(computeHeadToHead('p1', 'p2', results)).toBeNull();
  });

  it('conta solo le partite in cui entrambi hanno giocato', () => {
    const results = [
      // m1: solo p1
      r('p1', 'Mario', 'GOLD', '2026-05-01', 'm1'),
      // m2: solo p2
      r('p2', 'Luigi', 'GOLD', '2026-05-02', 'm2'),
      // m3: entrambi (p1 vince, GOLD vs SILVER)
      r('p1', 'Mario', 'GOLD', '2026-05-03', 'm3'),
      r('p2', 'Luigi', 'SILVER', '2026-05-03', 'm3'),
    ];
    const h2h = computeHeadToHead('p1', 'p2', results);
    expect(h2h).not.toBeNull();
    expect(h2h!.totalMatches).toBe(1);
    expect(h2h!.p1Wins).toBe(1);
    expect(h2h!.p2Wins).toBe(0);
  });

  it("vince il rank più basso (GOLD batte SILVER batte BRONZE batte NONE)", () => {
    const results = [
      // m1: p1 GOLD vs p2 SILVER → p1 wins
      r('p1', 'Mario', 'GOLD', '2026-05-01', 'm1'),
      r('p2', 'Luigi', 'SILVER', '2026-05-01', 'm1'),
      // m2: p1 SILVER vs p2 BRONZE → p1 wins
      r('p1', 'Mario', 'SILVER', '2026-05-02', 'm2'),
      r('p2', 'Luigi', 'BRONZE', '2026-05-02', 'm2'),
      // m3: p1 NONE vs p2 GOLD → p2 wins
      r('p1', 'Mario', 'NONE', '2026-05-03', 'm3'),
      r('p2', 'Luigi', 'GOLD', '2026-05-03', 'm3'),
      // m4: entrambi NONE → tie
      r('p1', 'Mario', 'NONE', '2026-05-04', 'm4'),
      r('p2', 'Luigi', 'NONE', '2026-05-04', 'm4'),
    ];
    const h2h = computeHeadToHead('p1', 'p2', results)!;
    expect(h2h.totalMatches).toBe(4);
    expect(h2h.p1Wins).toBe(2);
    expect(h2h.p2Wins).toBe(1);
    expect(h2h.ties).toBe(1);
  });

  it('matches sono ordinati per data desc (più recenti prima)', () => {
    const results = [
      r('p1', 'A', 'GOLD', '2026-05-01', 'old'),
      r('p2', 'B', 'SILVER', '2026-05-01', 'old'),
      r('p1', 'A', 'SILVER', '2026-05-05', 'new'),
      r('p2', 'B', 'GOLD', '2026-05-05', 'new'),
    ];
    const h2h = computeHeadToHead('p1', 'p2', results)!;
    expect(h2h.matches[0].matchId).toBe('new');
    expect(h2h.matches[1].matchId).toBe('old');
  });

  it('popolato p1.name e p2.name dal primo result trovato', () => {
    const results = [
      r('p1', 'Mario', 'GOLD', '2026-05-01', 'm1'),
      r('p2', 'Luigi', 'SILVER', '2026-05-01', 'm1'),
    ];
    const h2h = computeHeadToHead('p1', 'p2', results)!;
    expect(h2h.p1).toEqual({ id: 'p1', name: 'Mario' });
    expect(h2h.p2).toEqual({ id: 'p2', name: 'Luigi' });
  });
});
