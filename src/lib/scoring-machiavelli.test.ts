import { describe, it, expect } from 'vitest';
import {
  computePlayerRankingsMachiavelli,
  type MatchMachiavelliLite,
} from './scoring-machiavelli';

const mk = (
  id: string,
  date: string,
  entries: [string, boolean][]
): MatchMachiavelliLite => ({
  id,
  date,
  results: entries.map(([playerId, isWinner]) => ({
    playerId,
    isWinner,
    player: { name: playerId.toUpperCase() },
  })),
});

describe('computePlayerRankingsMachiavelli', () => {
  it('ritorna array vuoto senza match', () => {
    expect(computePlayerRankingsMachiavelli([])).toEqual([]);
  });

  it('conta played/wins/losses/winRate per persona', () => {
    const matches = [
      mk('m1', '2026-07-01', [['erik', true], ['anna', false]]),
      mk('m2', '2026-07-02', [['erik', false], ['anna', true]]),
      mk('m3', '2026-07-03', [['erik', true], ['anna', false], ['mamma', false]]),
    ];
    const rows = computePlayerRankingsMachiavelli(matches);
    const erik = rows.find((r) => r.id === 'erik')!;
    expect(erik.played).toBe(3);
    expect(erik.wins).toBe(2);
    expect(erik.losses).toBe(1);
    expect(erik.winRate).toBeCloseTo(2 / 3);
    const mamma = rows.find((r) => r.id === 'mamma')!;
    expect(mamma.played).toBe(1);
    expect(mamma.wins).toBe(0);
  });

  it('ordina per wins DESC poi winRate DESC poi played DESC', () => {
    const matches = [
      mk('m1', '2026-07-01', [['a', true], ['b', false]]),
      mk('m2', '2026-07-02', [['a', true], ['b', false]]),
      mk('m3', '2026-07-03', [['b', true], ['c', false]]),
      // c: 1 win su 2 (winRate 0.5) vs b: 1 win su 3 → c prima di b
      mk('m4', '2026-07-04', [['c', true], ['a', false]]),
    ];
    const rows = computePlayerRankingsMachiavelli(matches);
    expect(rows.map((r) => r.id)).toEqual(['a', 'c', 'b']);
  });

  it('currentStreak si azzera alla sconfitta, bestStreak resta', () => {
    const matches = [
      mk('m1', '2026-07-01', [['a', true], ['b', false]]),
      mk('m2', '2026-07-02', [['a', true], ['b', false]]),
      mk('m3', '2026-07-03', [['a', false], ['b', true]]),
      mk('m4', '2026-07-04', [['a', true], ['b', false]]),
    ];
    const a = computePlayerRankingsMachiavelli(matches).find((r) => r.id === 'a')!;
    expect(a.bestStreak).toBe(2);
    expect(a.currentStreak).toBe(1);
  });

  it('lo streak conta solo le partite giocate dal player', () => {
    const matches = [
      mk('m1', '2026-07-01', [['a', true], ['b', false]]),
      // a non gioca m2: lo streak non si interrompe
      mk('m2', '2026-07-02', [['b', true], ['c', false]]),
      mk('m3', '2026-07-03', [['a', true], ['b', false]]),
    ];
    const a = computePlayerRankingsMachiavelli(matches).find((r) => r.id === 'a')!;
    expect(a.currentStreak).toBe(2);
    expect(a.bestStreak).toBe(2);
  });

  it('è indipendente dall’ordine dell’array in input (sort per data interno)', () => {
    const matches = [
      mk('m3', '2026-07-03', [['a', false], ['b', true]]),
      mk('m1', '2026-07-01', [['a', true], ['b', false]]),
      mk('m2', '2026-07-02', [['a', true], ['b', false]]),
    ];
    const a = computePlayerRankingsMachiavelli(matches).find((r) => r.id === 'a')!;
    expect(a.currentStreak).toBe(0);
    expect(a.bestStreak).toBe(2);
  });

  it('lastWinDate = data della vittoria più recente, null se mai vinto', () => {
    const matches = [
      mk('m1', '2026-07-01', [['a', true], ['b', false]]),
      mk('m2', '2026-07-02', [['a', true], ['b', false]]),
      mk('m3', '2026-07-03', [['a', false], ['b', true]]),
      mk('m4', '2026-07-04', [['b', false], ['c', true]]),
    ];
    const rows = computePlayerRankingsMachiavelli(matches);
    const a = rows.find((r) => r.id === 'a')!;
    expect(a.lastWinDate).toBe(new Date('2026-07-02').toISOString());
    const mai = rows.find((r) => r.id === 'b')!;
    expect(mai.lastWinDate).toBe(new Date('2026-07-03').toISOString());
  });

  it('usa il nome più recente visto (rename)', () => {
    const matches: MatchMachiavelliLite[] = [
      {
        id: 'm1',
        date: '2026-07-01',
        results: [
          { playerId: 'a', isWinner: true, player: { name: 'Vecchio' } },
          { playerId: 'b', isWinner: false, player: { name: 'B' } },
        ],
      },
      {
        id: 'm2',
        date: '2026-07-02',
        results: [
          { playerId: 'a', isWinner: false, player: { name: 'Nuovo' } },
          { playerId: 'b', isWinner: true, player: { name: 'B' } },
        ],
      },
    ];
    const a = computePlayerRankingsMachiavelli(matches).find((r) => r.id === 'a')!;
    expect(a.name).toBe('Nuovo');
  });
});
