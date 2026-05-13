import { describe, it, expect } from 'vitest';
import {
  computePlayerStats,
  SCORE_BY_MEDAL,
  type ScoringResult,
} from './scoring';

const r = (
  playerId: string,
  playerName: string,
  medal: ScoringResult['medal'],
  dateIso: string,
): ScoringResult => ({
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
