import { describe, it, expect } from 'vitest';
import {
  computePadelTeamRankings,
  computePadelPlayerRankings,
  parseSets,
  teamKey,
  type MatchPadelLite,
} from './scoring-padel';
import { isValidPadelSet } from './schemas';

// helper: partita 2v2 con set espressi come [gamesA, gamesB]
const mk = (
  id: string,
  date: string,
  teamA: string[],
  teamB: string[],
  sets: [number, number][]
): MatchPadelLite => ({
  id,
  date,
  sets: sets.map(([a, b]) => ({ a, b })),
  results: [
    ...teamA.map((playerId) => ({ playerId, teamSide: 'A' as const, player: { name: playerId.toUpperCase() } })),
    ...teamB.map((playerId) => ({ playerId, teamSide: 'B' as const, player: { name: playerId.toUpperCase() } })),
  ],
});

describe('isValidPadelSet', () => {
  it('accetta i set standard 6-x (x<=4)', () => {
    expect(isValidPadelSet(6, 0)).toBe(true);
    expect(isValidPadelSet(6, 4)).toBe(true);
    expect(isValidPadelSet(4, 6)).toBe(true);
  });
  it('rifiuta 6-5 (non concluso) e 6-6 (pari)', () => {
    expect(isValidPadelSet(6, 5)).toBe(false);
    expect(isValidPadelSet(6, 6)).toBe(false);
  });
  it('accetta i vantaggi con scarto esatto 2 (7-5, 8-6, 10-8)', () => {
    expect(isValidPadelSet(7, 5)).toBe(true);
    expect(isValidPadelSet(8, 6)).toBe(true);
    expect(isValidPadelSet(10, 8)).toBe(true);
  });
  it('rifiuta 7-6 (niente tie-break) e scarti > 2 oltre il 6', () => {
    expect(isValidPadelSet(7, 6)).toBe(false);
    expect(isValidPadelSet(8, 5)).toBe(false);
  });
});

describe('parseSets', () => {
  it('deserializza un JSON valido', () => {
    expect(parseSets('[[6,4],[3,6],[6,2]]')).toEqual([
      { a: 6, b: 4 },
      { a: 3, b: 6 },
      { a: 6, b: 2 },
    ]);
  });
  it('ritorna [] su JSON invalido', () => {
    expect(parseSets('non-json')).toEqual([]);
    expect(parseSets('{}')).toEqual([]);
  });
});

describe('teamKey', () => {
  it('è indipendente dall’ordine', () => {
    expect(teamKey(['b', 'a'])).toBe(teamKey(['a', 'b']));
  });
});

describe('computePadelTeamRankings', () => {
  it('vince la coppia con più set; aggrega set e game', () => {
    const matches = [
      // A (a,b) batte B (c,d): 6-4, 6-3 → A 2 set, B 0
      mk('m1', '2026-07-01', ['a', 'b'], ['c', 'd'], [[6, 4], [6, 3]]),
      // A (a,b) perde: 4-6, 6-7 → wait 6-7 invalido; usa 5-7
      mk('m2', '2026-07-02', ['a', 'b'], ['c', 'd'], [[4, 6], [5, 7]]),
    ];
    const teams = computePadelTeamRankings(matches);
    const ab = teams.find((t) => t.teamKey === teamKey(['a', 'b']))!;
    expect(ab.played).toBe(2);
    expect(ab.wins).toBe(1);
    expect(ab.losses).toBe(1);
    // set A: m1 vinti 2, m2 vinti 0 → setsWon 2; game A: 6+6 +4+5 = 21
    expect(ab.setsWon).toBe(2);
    expect(ab.gamesWon).toBe(6 + 6 + 4 + 5);
    const cd = teams.find((t) => t.teamKey === teamKey(['c', 'd']))!;
    expect(cd.wins).toBe(1);
    expect(cd.setsWon).toBe(2); // m2: 6+7
  });

  it('coppia con set esatto: {a,b} ≠ {a,c}', () => {
    const matches = [
      mk('m1', '2026-07-01', ['a', 'b'], ['c', 'd'], [[6, 0], [6, 0]]),
      mk('m2', '2026-07-02', ['a', 'c'], ['b', 'd'], [[6, 0], [6, 0]]),
    ];
    const teams = computePadelTeamRankings(matches);
    expect(teams.some((t) => t.teamKey === teamKey(['a', 'b']))).toBe(true);
    expect(teams.some((t) => t.teamKey === teamKey(['a', 'c']))).toBe(true);
  });
});

describe('computePadelPlayerRankings', () => {
  it('conta wins/losses/winRate e streak per persona', () => {
    const matches = [
      mk('m1', '2026-07-01', ['a', 'b'], ['c', 'd'], [[6, 4], [6, 3]]), // a,b vincono
      mk('m2', '2026-07-02', ['a', 'b'], ['c', 'd'], [[6, 2], [6, 1]]), // a,b vincono
      mk('m3', '2026-07-03', ['a', 'c'], ['b', 'd'], [[3, 6], [4, 6]]), // b,d vincono → a perde
    ];
    const rows = computePadelPlayerRankings(matches);
    const a = rows.find((r) => r.id === 'a')!;
    expect(a.played).toBe(3);
    expect(a.wins).toBe(2);
    expect(a.losses).toBe(1);
    expect(a.currentStreak).toBe(0); // ultima persa
    expect(a.bestStreak).toBe(2);
    const b = rows.find((r) => r.id === 'b')!;
    expect(b.wins).toBe(3); // m1,m2 con a; m3 con d
    expect(b.currentStreak).toBe(3);
  });

  it('best/worst teammate richiede min 2 partite insieme', () => {
    const matches = [
      mk('m1', '2026-07-01', ['a', 'b'], ['c', 'd'], [[6, 0], [6, 0]]), // a+b vincono
      mk('m2', '2026-07-02', ['a', 'b'], ['c', 'd'], [[6, 0], [6, 0]]), // a+b vincono
      mk('m3', '2026-07-03', ['a', 'e'], ['c', 'd'], [[0, 6], [0, 6]]), // a+e perdono (1 sola volta)
    ];
    const a = computePadelPlayerRankings(matches).find((r) => r.id === 'a')!;
    // b: 2 partite insieme, 100% → best; e: 1 sola → sotto soglia, ignorato
    expect(a.bestTeammate?.playerId).toBe('b');
    expect(a.bestTeammate?.matchesTogether).toBe(2);
    expect(a.worstTeammate).toBeNull(); // solo 1 compagno qualificato
  });

  it('ordina per wins DESC poi winRate DESC', () => {
    const matches = [
      mk('m1', '2026-07-01', ['a', 'b'], ['c', 'd'], [[6, 0], [6, 0]]),
      mk('m2', '2026-07-02', ['a', 'b'], ['c', 'd'], [[6, 0], [6, 0]]),
    ];
    const rows = computePadelPlayerRankings(matches);
    // a e b: 2 wins; c e d: 0 → a/b davanti
    expect(rows[0].wins).toBe(2);
    expect(rows[rows.length - 1].wins).toBe(0);
  });
});
