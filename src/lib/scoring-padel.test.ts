import { describe, it, expect } from 'vitest';
import {
  computePadelTeamRankings,
  computePadelPlayerRankings,
  parseSets,
  rankAttack,
  rankDefense,
  teamKey,
  type MatchPadelLite,
} from './scoring-padel';
import { isValidPadelSet, MatchPadelUpsertSchema } from './schemas';

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
  it('accetta 7-5 (dal 5-5) e 7-6 (vantaggi sul 6-6), in entrambi i versi', () => {
    expect(isValidPadelSet(7, 5)).toBe(true);
    expect(isValidPadelSet(7, 6)).toBe(true);
    expect(isValidPadelSet(6, 7)).toBe(true);
  });
  it('rifiuta tutto oltre il 7: i vantaggi valgono un solo game (8-6, 10-8, 8-7)', () => {
    expect(isValidPadelSet(8, 6)).toBe(false);
    expect(isValidPadelSet(10, 8)).toBe(false);
    expect(isValidPadelSet(8, 7)).toBe(false);
    expect(isValidPadelSet(7, 4)).toBe(false);
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
  it('conta wins/losses e streak per persona', () => {
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

  it('ordina per differenza set, indipendentemente dal compagno', () => {
    const matches = [
      mk('m1', '2026-07-01', ['a', 'b'], ['c', 'd'], [[6, 0], [6, 0]]), // a,b +2
      mk('m2', '2026-07-02', ['a', 'c'], ['b', 'd'], [[6, 0], [0, 6], [6, 0]]), // a,c +1 · b,d -1
    ];
    const rows = computePadelPlayerRankings(matches);
    const diff = Object.fromEntries(rows.map((r) => [r.id, r.setDiff]));
    expect(diff).toEqual({ a: 3, b: 1, c: -1, d: -3 });
    expect(rows.map((r) => r.id)).toEqual(['a', 'b', 'c', 'd']);
    expect(rows[0].setsWon).toBe(4);
    expect(rows[0].setsLost).toBe(1);
  });

  it('la differenza set conta più delle vittorie', () => {
    // x: 1 vittoria 2-1 e 1 sconfitta 0-2 = 1 vittoria, -1 · y: 2 pareggi 1-1 = 0 vittorie, 0
    const rows = computePadelPlayerRankings([
      mk('m1', '2026-07-01', ['x', 'p'], ['q', 'r'], [[6, 0], [0, 6], [6, 0]]),
      mk('m2', '2026-07-02', ['x', 'p'], ['q', 'r'], [[0, 6], [0, 6]]),
      mk('m3', '2026-07-03', ['y', 's'], ['t', 'u'], [[6, 0], [0, 6]]),
      mk('m4', '2026-07-04', ['y', 's'], ['t', 'u'], [[6, 0], [0, 6]]),
    ]);
    const pos = (id: string) => rows.findIndex((r) => r.id === id);
    expect(rows[pos('x')].wins).toBe(1);
    expect(rows[pos('x')].setDiff).toBe(-1);
    expect(rows[pos('y')].wins).toBe(0);
    expect(rows[pos('y')].setDiff).toBe(0);
    expect(pos('y')).toBeLessThan(pos('x'));
  });

  it('a pari differenza set sta davanti chi ha vinto più set (anche con meno game)', () => {
    const rows = computePadelPlayerRankings([
      mk('m1', '2026-07-01', ['a', 'b'], ['c', 'd'], [[6, 4], [4, 6], [6, 4]]), // a,b 2-1 (+1), game +4
      mk('m2', '2026-07-02', ['e', 'f'], ['g', 'h'], [[6, 0]]), // e,f 1-0 (+1), game +6
    ]);
    const pos = (id: string) => rows.findIndex((r) => r.id === id);
    expect(rows[pos('a')].setDiff).toBe(1);
    expect(rows[pos('e')].setDiff).toBe(1);
    expect(rows[pos('e')].gameDiff).toBeGreaterThan(rows[pos('a')].gameDiff);
    expect(pos('a')).toBeLessThan(pos('e'));
  });
});

describe('classifica coppie a punti (regola 2026-10-01)', () => {
  it('vittoria 3 · pareggio 1 · sconfitta 0', () => {
    const rows = computePadelTeamRankings([
      mk('m1', '2026-09-01', ['a', 'b'], ['c', 'd'], [[6, 0], [6, 0]]), // a+b V
      mk('m2', '2026-09-02', ['a', 'b'], ['c', 'd'], [[6, 0], [0, 6]]), // pareggio
      mk('m3', '2026-09-03', ['a', 'b'], ['c', 'd'], [[0, 6], [0, 6]]), // a+b S
    ]);
    const ab = rows.find((r) => r.teamKey === teamKey(['a', 'b']))!;
    expect([ab.wins, ab.draws, ab.losses]).toEqual([1, 1, 1]);
    expect(ab.points).toBe(4); // 3 + 1 + 0
    expect(ab.setsWon).toBe(3);
    expect(ab.setsLost).toBe(3);
    expect(ab.setDiff).toBe(0);
  });

  it('a pari punti vince la differenza set migliore', () => {
    // a+b e e+f: entrambe 1 vittoria = 3 punti; a+b 2-0, e+f 2-1
    const rows = computePadelTeamRankings([
      mk('m1', '2026-09-01', ['e', 'f'], ['g', 'h'], [[6, 0], [0, 6], [6, 0]]),
      mk('m2', '2026-09-02', ['a', 'b'], ['c', 'd'], [[6, 0], [6, 0]]),
    ]);
    const pos = (ids: string[]) => rows.findIndex((r) => r.teamKey === teamKey(ids));
    expect(rows[pos(['a', 'b'])].points).toBe(3);
    expect(rows[pos(['e', 'f'])].points).toBe(3);
    expect(rows[pos(['a', 'b'])].setDiff).toBe(2);
    expect(rows[pos(['e', 'f'])].setDiff).toBe(1);
    expect(pos(['a', 'b'])).toBeLessThan(pos(['e', 'f']));
  });

  it('a pari punti e differenza, decidono i set vinti (non i game)', () => {
    // a+b 2-1 (+1, game +4) e e+f 1-0 (+1, game +6): stessi punti e stessa differenza
    const rows = computePadelTeamRankings([
      mk('m1', '2026-09-01', ['e', 'f'], ['g', 'h'], [[6, 0]]),
      mk('m2', '2026-09-02', ['a', 'b'], ['c', 'd'], [[6, 4], [4, 6], [6, 4]]),
    ]);
    const pos = (ids: string[]) => rows.findIndex((r) => r.teamKey === teamKey(ids));
    expect(pos(['a', 'b'])).toBeLessThan(pos(['e', 'f']));
  });

  it('più punti batte una differenza set migliore', () => {
    // a+b: 2 vittorie di misura = 6 punti, +2 · e+f: 1 vittoria netta + 1 pareggio = 4 punti, +3
    const rows = computePadelTeamRankings([
      mk('m1', '2026-09-01', ['a', 'b'], ['c', 'd'], [[6, 0], [0, 6], [6, 0]]),
      mk('m2', '2026-09-02', ['a', 'b'], ['c', 'd'], [[6, 0], [0, 6], [6, 0]]),
      mk('m3', '2026-09-03', ['e', 'f'], ['g', 'h'], [[6, 0], [6, 0], [6, 0]]),
      mk('m4', '2026-09-04', ['e', 'f'], ['g', 'h'], [[6, 0], [0, 6]]),
    ]);
    const pos = (ids: string[]) => rows.findIndex((r) => r.teamKey === teamKey(ids));
    expect(rows[pos(['a', 'b'])].points).toBe(6);
    expect(rows[pos(['e', 'f'])].points).toBe(4);
    expect(rows[pos(['e', 'f'])].setDiff).toBeGreaterThan(rows[pos(['a', 'b'])].setDiff);
    expect(pos(['a', 'b'])).toBeLessThan(pos(['e', 'f']));
  });
});

describe('attaccanti e difensori', () => {
  const row = (id: string, setsWon: number, setsLost: number, played: number) => ({ id, setsWon, setsLost, played });

  it('attaccanti: più set vinti; a parità chi ha giocato meno', () => {
    const out = rankAttack([row('a', 3, 1, 2), row('b', 5, 4, 4), row('c', 3, 0, 3), row('d', 5, 2, 3)]);
    expect(out.map((r) => r.id)).toEqual(['d', 'b', 'a', 'c']);
  });

  it('difensori: meno set persi; a parità chi ha giocato di più', () => {
    const out = rankDefense([row('a', 3, 1, 2), row('b', 5, 4, 4), row('c', 3, 1, 3), row('d', 0, 0, 1)]);
    expect(out.map((r) => r.id)).toEqual(['d', 'c', 'a', 'b']);
  });

  it('non modificano l\'array in ingresso', () => {
    const input = [row('a', 1, 1, 1), row('b', 2, 0, 1)];
    rankAttack(input);
    rankDefense(input);
    expect(input.map((r) => r.id)).toEqual(['a', 'b']);
  });

  it('funzionano sulle classifiche vere (coppie e persone)', () => {
    const matches = [
      mk('m1', '2026-09-01', ['a', 'b'], ['c', 'd'], [[6, 0], [6, 0]]),
      mk('m2', '2026-09-02', ['a', 'c'], ['b', 'd'], [[6, 0], [0, 6], [6, 0]]),
    ];
    const persons = computePadelPlayerRankings(matches);
    expect(rankAttack(persons)[0].id).toBe('a'); // 4 set vinti
    expect(rankDefense(persons)[0].id).toBe('a'); // 1 set perso
    expect(rankDefense(persons).at(-1)!.id).toBe('d'); // 4 set persi
    const teams = computePadelTeamRankings(matches);
    expect(rankAttack(teams)[0].teamKey).toBe(teamKey(['a', 'b']));
  });
});

// Partita vera del 2026-09-30: c'era tempo per 4 set, finita 2-2.
// Erik+Kekko (A) vs Dildo+Luke (B): 6-2 3-6 3-6 6-1.
describe('pareggio (regola 2026-09-30)', () => {
  const pari = mk('p30', '2026-09-30', ['erik', 'kekko'], ['dildo', 'luke'], [[6, 2], [3, 6], [3, 6], [6, 1]]);

  it('la partita vera del 30/09 e un pareggio, non una vittoria di A', () => {
    // controllo positivo: la vecchia regola (setsA >= setsB) dava 1 vittoria a Erik+Kekko
    const teams = computePadelTeamRankings([pari]);
    for (const t of teams) {
      expect(t.played).toBe(1);
      expect(t.wins).toBe(0);
      expect(t.draws).toBe(1);
      expect(t.losses).toBe(0);
      expect(t.points).toBe(1);
      expect(t.setsWon).toBe(2);
      expect(t.setsLost).toBe(2);
    }
    const ek = teams.find((t) => t.teamKey === teamKey(['erik', 'kekko']))!;
    expect(ek.gamesWon).toBe(18);
    expect(ek.gamesLost).toBe(15);
  });

  it('per persona: il pareggio interrompe la serie', () => {
    const vinta = mk('v29', '2026-09-29', ['erik', 'kekko'], ['dildo', 'luke'], [[6, 0], [6, 0]]);
    const rows = computePadelPlayerRankings([vinta, pari]);
    const erik = rows.find((r) => r.id === 'erik')!;
    expect(erik.played).toBe(2);
    expect(erik.wins).toBe(1);
    expect(erik.draws).toBe(1);
    expect(erik.losses).toBe(0);
    expect(erik.setDiff).toBe(2); // 2-0 nella vinta, 2-2 nel pareggio
    expect(erik.bestStreak).toBe(1);
    expect(erik.currentStreak).toBe(0);
    const luke = rows.find((r) => r.id === 'luke')!;
    expect(luke.losses).toBe(1);
    expect(luke.draws).toBe(1);
    expect(luke.setDiff).toBe(-2);
  });

  it('a pari vittorie, chi ha pareggiato sta davanti a chi ha perso (1 punto in più)', () => {
    const rows = computePadelTeamRankings([
      mk('m1', '2026-09-01', ['a', 'b'], ['c', 'd'], [[6, 0], [6, 0]]), // a+b vincono
      mk('m2', '2026-09-02', ['e', 'f'], ['g', 'h'], [[6, 0], [6, 0]]), // e+f vincono
      mk('m3', '2026-09-03', ['a', 'b'], ['g', 'h'], [[6, 0], [0, 6]]), // a+b pareggiano 1-1
      mk('m4', '2026-09-04', ['e', 'f'], ['c', 'd'], [[0, 6], [0, 6]]), // e+f perdono
    ]);
    const pos = (ids: string[]) => rows.findIndex((r) => r.teamKey === teamKey(ids));
    // a+b: 1V 1P = 4 punti · e+f: 1V 1S = 3 punti → stessa quantita di vittorie, a+b davanti
    expect(rows[pos(['a', 'b'])].points).toBe(4);
    expect(rows[pos(['e', 'f'])].points).toBe(3);
    expect(pos(['a', 'b'])).toBeLessThan(pos(['e', 'f']));
  });

  it('il server accetta il pareggio (2-2 e 1-1)', () => {
    const body = (sets: { a: number; b: number }[]) => ({ date: '2026-09-30', teamA: ['e', 'k'], teamB: ['d', 'l'], sets });
    expect(MatchPadelUpsertSchema.safeParse(body([{ a: 6, b: 2 }, { a: 3, b: 6 }, { a: 3, b: 6 }, { a: 6, b: 1 }])).success).toBe(true);
    expect(MatchPadelUpsertSchema.safeParse(body([{ a: 6, b: 2 }, { a: 3, b: 6 }])).success).toBe(true);
    // i set fuori regola restano rifiutati
    expect(MatchPadelUpsertSchema.safeParse(body([{ a: 6, b: 2 }, { a: 10, b: 8 }])).success).toBe(false);
  });
});
