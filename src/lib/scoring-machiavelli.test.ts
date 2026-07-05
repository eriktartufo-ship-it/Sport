import { describe, it, expect } from 'vitest';
import {
  computePlayerRankingsMachiavelli,
  type MatchMachiavelliLite,
} from './scoring-machiavelli';

// entries: [playerId, position]. position 1 = vincitore.
const mk = (
  id: string,
  date: string,
  entries: [string, number][]
): MatchMachiavelliLite => ({
  id,
  date,
  results: entries.map(([playerId, position]) => ({
    playerId,
    position,
    player: { name: playerId.toUpperCase() },
  })),
});

describe('computePlayerRankingsMachiavelli', () => {
  it('ritorna array vuoto senza match', () => {
    expect(computePlayerRankingsMachiavelli([])).toEqual([]);
  });

  it('conta played/wins/winRate e punti = position-1 per persona', () => {
    const matches = [
      mk('m1', '2026-07-01', [['erik', 1], ['anna', 2]]),
      mk('m2', '2026-07-02', [['anna', 1], ['erik', 2]]),
      mk('m3', '2026-07-03', [['erik', 1], ['anna', 2], ['mamma', 3]]),
    ];
    const rows = computePlayerRankingsMachiavelli(matches);
    const erik = rows.find((r) => r.id === 'erik')!;
    expect(erik.played).toBe(3);
    expect(erik.wins).toBe(2);
    expect(erik.winRate).toBeCloseTo(2 / 3);
    // punti erik: 0 (1°) + 1 (2°) + 0 (1°) = 1
    expect(erik.points).toBe(1);
    expect(erik.pointsAvg).toBeCloseTo(1 / 3);
    const mamma = rows.find((r) => r.id === 'mamma')!;
    // mamma: 3° in 1 partita = 2 punti
    expect(mamma.points).toBe(2);
    expect(mamma.wins).toBe(0);
  });

  it('ordina per media punti ASC (meno = meglio), poi partite DESC', () => {
    const matches = [
      // a: sempre 1° → 0 punti totali
      mk('m1', '2026-07-01', [['a', 1], ['b', 2], ['c', 3]]),
      mk('m2', '2026-07-02', [['a', 1], ['c', 2], ['b', 3]]),
      // b vs c: b media 2.5, c media 2.5 → parità media, ma qui distinguiamo con m3
      mk('m3', '2026-07-03', [['b', 1], ['c', 2]]),
    ];
    const rows = computePlayerRankingsMachiavelli(matches);
    // a media 0 → primo; poi b (media (2+3+0)/3=1.67) prima di c (media (3+2+1)/3=2)
    expect(rows.map((r) => r.id)).toEqual(['a', 'b', 'c']);
  });

  it('la media pareggia → più partite giocate ranka più in alto', () => {
    const matches = [
      mk('m1', '2026-07-01', [['a', 2], ['b', 1]]), // a: 1pt
      mk('m2', '2026-07-02', [['a', 2], ['c', 1]]), // a: 1pt → media 1 su 2
      mk('m3', '2026-07-03', [['d', 2], ['e', 1]]), // d: 1pt → media 1 su 1
    ];
    const rows = computePlayerRankingsMachiavelli(matches);
    const a = rows.findIndex((r) => r.id === 'a');
    const d = rows.findIndex((r) => r.id === 'd');
    // a e d hanno media 1.0, ma a ha 2 partite vs d 1 → a prima
    expect(a).toBeLessThan(d);
  });

  it('currentStreak si azzera alla sconfitta, bestStreak resta', () => {
    const matches = [
      mk('m1', '2026-07-01', [['a', 1], ['b', 2]]),
      mk('m2', '2026-07-02', [['a', 1], ['b', 2]]),
      mk('m3', '2026-07-03', [['a', 2], ['b', 1]]),
      mk('m4', '2026-07-04', [['a', 1], ['b', 2]]),
    ];
    const a = computePlayerRankingsMachiavelli(matches).find((r) => r.id === 'a')!;
    expect(a.bestStreak).toBe(2);
    expect(a.currentStreak).toBe(1);
  });

  it('lo streak conta solo le partite giocate dal player', () => {
    const matches = [
      mk('m1', '2026-07-01', [['a', 1], ['b', 2]]),
      // a non gioca m2: lo streak non si interrompe
      mk('m2', '2026-07-02', [['b', 1], ['c', 2]]),
      mk('m3', '2026-07-03', [['a', 1], ['b', 2]]),
    ];
    const a = computePlayerRankingsMachiavelli(matches).find((r) => r.id === 'a')!;
    expect(a.currentStreak).toBe(2);
    expect(a.bestStreak).toBe(2);
  });

  it('è indipendente dall’ordine dell’array in input (sort per data interno)', () => {
    const matches = [
      mk('m3', '2026-07-03', [['a', 2], ['b', 1]]),
      mk('m1', '2026-07-01', [['a', 1], ['b', 2]]),
      mk('m2', '2026-07-02', [['a', 1], ['b', 2]]),
    ];
    const a = computePlayerRankingsMachiavelli(matches).find((r) => r.id === 'a')!;
    expect(a.currentStreak).toBe(0);
    expect(a.bestStreak).toBe(2);
  });

  it('lastWinDate = data della vittoria più recente, null se mai vinto', () => {
    const matches = [
      mk('m1', '2026-07-01', [['a', 1], ['b', 2]]),
      mk('m2', '2026-07-02', [['a', 1], ['b', 2]]),
      mk('m3', '2026-07-03', [['a', 2], ['b', 1]]),
      mk('m4', '2026-07-04', [['b', 2], ['c', 1]]),
    ];
    const rows = computePlayerRankingsMachiavelli(matches);
    const a = rows.find((r) => r.id === 'a')!;
    expect(a.lastWinDate).toBe(new Date('2026-07-02').toISOString());
    const b = rows.find((r) => r.id === 'b')!;
    expect(b.lastWinDate).toBe(new Date('2026-07-03').toISOString());
  });

  it('usa il nome più recente visto (rename)', () => {
    const matches: MatchMachiavelliLite[] = [
      {
        id: 'm1',
        date: '2026-07-01',
        results: [
          { playerId: 'a', position: 1, player: { name: 'Vecchio' } },
          { playerId: 'b', position: 2, player: { name: 'B' } },
        ],
      },
      {
        id: 'm2',
        date: '2026-07-02',
        results: [
          { playerId: 'a', position: 2, player: { name: 'Nuovo' } },
          { playerId: 'b', position: 1, player: { name: 'B' } },
        ],
      },
    ];
    const a = computePlayerRankingsMachiavelli(matches).find((r) => r.id === 'a')!;
    expect(a.name).toBe('Nuovo');
  });
});
