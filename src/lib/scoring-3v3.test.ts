import { describe, it, expect } from 'vitest';
import {
  teamKey,
  computeTeamRankings,
  computePlayerRankings3v3,
  type Match3v3Lite,
} from './scoring-3v3';

let __seq = 0;
const mk = (
  teamA: { id: string; name: string }[],
  teamB: { id: string; name: string }[],
  scoreA: number,
  scoreB: number,
  dateIso = '2026-05-01',
): Match3v3Lite => ({
  id: `m3-${++__seq}`,
  date: dateIso,
  teamAScore: scoreA,
  teamBScore: scoreB,
  results: [
    ...teamA.map((p) => ({ playerId: p.id, teamSide: 'A' as const, player: { name: p.name } })),
    ...teamB.map((p) => ({ playerId: p.id, teamSide: 'B' as const, player: { name: p.name } })),
  ],
});

const P = {
  alice: { id: 'p-alice', name: 'Alice' },
  bob: { id: 'p-bob', name: 'Bob' },
  carl: { id: 'p-carl', name: 'Carl' },
  dave: { id: 'p-dave', name: 'Dave' },
  eve: { id: 'p-eve', name: 'Eve' },
  frank: { id: 'p-frank', name: 'Frank' },
  greg: { id: 'p-greg', name: 'Greg' },
};

describe('teamKey', () => {
  it('è invariante rispetto all\'ordine degli id', () => {
    expect(teamKey(['c', 'a', 'b'])).toBe('a|b|c');
    expect(teamKey(['a', 'b', 'c'])).toBe('a|b|c');
  });

  it('mantiene id duplicati (input non sanitario) — caller deve garantire unicità', () => {
    expect(teamKey(['a', 'a', 'b'])).toBe('a|a|b');
  });
});

describe('computeTeamRankings', () => {
  it('input vuoto → []', () => {
    expect(computeTeamRankings([])).toEqual([]);
  });

  it('1 match → 2 squadre, 1 win 1 loss', () => {
    const r = computeTeamRankings([
      mk([P.alice, P.bob, P.carl], [P.dave, P.eve, P.frank], 21, 12),
    ]);
    expect(r).toHaveLength(2);
    const winners = r.find((t) => t.playerIds.includes('p-alice'))!;
    const losers = r.find((t) => t.playerIds.includes('p-dave'))!;
    expect(winners.wins).toBe(1);
    expect(winners.losses).toBe(0);
    expect(winners.winRate).toBe(1);
    expect(winners.pointsScoredTotal).toBe(21);
    expect(winners.pointsConcededTotal).toBe(12);
    expect(winners.pointDiffAvg).toBe(9);
    expect(losers.wins).toBe(0);
    expect(losers.losses).toBe(1);
    expect(losers.winRate).toBe(0);
  });

  it('stessa combinazione di player in due match diversi viene aggregata', () => {
    const r = computeTeamRankings([
      mk([P.alice, P.bob, P.carl], [P.dave, P.eve, P.frank], 21, 10),
      // rematch — stessa combinazione di player, exchange di side
      mk([P.dave, P.eve, P.frank], [P.alice, P.bob, P.carl], 15, 21),
    ]);
    // 2 squadre uniche, alice-bob-carl ha 2 wins
    const abc = r.find((t) => t.teamKey === 'p-alice|p-bob|p-carl')!;
    expect(abc.played).toBe(2);
    expect(abc.wins).toBe(2);
    expect(abc.pointsScoredTotal).toBe(42); // 21 + 21
    expect(abc.pointsConcededTotal).toBe(25); // 10 + 15
  });

  it('squadre diverse per 1 player → due chiavi separate', () => {
    const r = computeTeamRankings([
      mk([P.alice, P.bob, P.carl], [P.dave, P.eve, P.frank], 21, 10),
      mk([P.alice, P.bob, P.greg], [P.dave, P.eve, P.frank], 21, 18),
    ]);
    expect(r.length).toBe(3); // {abc}, {abg}, {def}
    const abc = r.find((t) => t.teamKey === 'p-alice|p-bob|p-carl')!;
    const abg = r.find((t) => t.teamKey === 'p-alice|p-bob|p-greg')!;
    expect(abc.played).toBe(1);
    expect(abg.played).toBe(1);
  });

  it('ordina per wins DESC, poi winRate DESC, poi played DESC', () => {
    const r = computeTeamRankings([
      mk([P.alice, P.bob, P.carl], [P.dave, P.eve, P.frank], 21, 10),
      mk([P.alice, P.bob, P.carl], [P.dave, P.eve, P.frank], 21, 12),
      mk([P.alice, P.bob, P.greg], [P.dave, P.eve, P.frank], 21, 8),
    ]);
    expect(r[0].teamKey).toBe('p-alice|p-bob|p-carl'); // 2 wins
    expect(r[1].teamKey).toBe('p-alice|p-bob|p-greg'); // 1 win
    expect(r[2].teamKey).toBe('p-dave|p-eve|p-frank'); // 0 wins
  });
});

describe('computePlayerRankings3v3', () => {
  it('input vuoto → []', () => {
    expect(computePlayerRankings3v3([])).toEqual([]);
  });

  it('1 match → 6 player, 3 win + 3 loss', () => {
    const r = computePlayerRankings3v3([
      mk([P.alice, P.bob, P.carl], [P.dave, P.eve, P.frank], 21, 10),
    ]);
    expect(r).toHaveLength(6);
    const alice = r.find((p) => p.id === 'p-alice')!;
    const dave = r.find((p) => p.id === 'p-dave')!;
    expect(alice.wins).toBe(1);
    expect(alice.losses).toBe(0);
    expect(alice.winRate).toBe(1);
    expect(alice.pointsScoredAvg).toBe(21);
    expect(alice.marginAvg).toBe(11);
    expect(alice.marginAvgOnWins).toBe(11);
    expect(alice.marginAvgOnLosses).toBe(0);
    expect(dave.winRate).toBe(0);
    expect(dave.marginAvgOnLosses).toBe(-11);
  });

  it('best/worst teammate: min 2 partite insieme', () => {
    // Alice gioca 3 volte:
    //  - con Bob+Carl vs DEF → win 21-10
    //  - con Bob+Carl vs DEF → win 21-12
    //  - con Bob+Greg vs DEF → loss 18-21
    // Bob ha giocato 3 volte con Alice (2W+1L → 66.7%)
    // Carl ha giocato 2 volte con Alice (2W → 100%)
    // Greg ha giocato 1 volta con Alice (sotto soglia MIN_TOGETHER=2 → escluso)
    const r = computePlayerRankings3v3([
      mk([P.alice, P.bob, P.carl], [P.dave, P.eve, P.frank], 21, 10),
      mk([P.alice, P.bob, P.carl], [P.dave, P.eve, P.frank], 21, 12),
      mk([P.alice, P.bob, P.greg], [P.dave, P.eve, P.frank], 18, 21),
    ]);
    const alice = r.find((p) => p.id === 'p-alice')!;
    expect(alice.played).toBe(3);
    expect(alice.wins).toBe(2);
    expect(alice.bestTeammate?.playerId).toBe('p-carl'); // 100%
    expect(alice.bestTeammate?.winRateTogether).toBe(1);
    // worst teammate è Bob (66.7%, 2/3), Greg è escluso (1 partita sotto soglia)
    expect(alice.worstTeammate?.playerId).toBe('p-bob');
    expect(alice.worstTeammate?.winRateTogether).toBeCloseTo(2 / 3, 3);
  });

  it('compagni con stesso winRate → best definito, worst null (dedup)', () => {
    const r = computePlayerRankings3v3([
      mk([P.alice, P.bob, P.carl], [P.dave, P.eve, P.frank], 21, 10),
      mk([P.alice, P.bob, P.carl], [P.dave, P.eve, P.frank], 21, 15),
    ]);
    const alice = r.find((p) => p.id === 'p-alice')!;
    // Bob e Carl entrambi 2 partite con Alice, entrambi 100%. L'algoritmo
    // tiene il primo iterato come best E come worst (rate non strettamente >
    // né strettamente <), poi la guard finale azzera worst quando coincide
    // con best per evitare di mostrare lo stesso compagno due volte.
    expect(alice.bestTeammate).not.toBeNull();
    expect(alice.bestTeammate?.winRateTogether).toBe(1);
    expect(alice.worstTeammate).toBeNull();
  });

  it('ordina per winRate DESC, played DESC', () => {
    const r = computePlayerRankings3v3([
      mk([P.alice, P.bob, P.carl], [P.dave, P.eve, P.frank], 21, 10),
      mk([P.dave, P.eve, P.frank], [P.alice, P.bob, P.carl], 21, 15),
    ]);
    // alice/bob/carl: 1W 1L (50%); dave/eve/frank: 1W 1L (50%) → played uguale → ordine stabile
    expect(r[0].winRate).toBe(0.5);
    // 6 player tutti 50%
    expect(r.every((p) => p.winRate === 0.5)).toBe(true);
  });

  it('marginAvgOnWins e marginAvgOnLosses calcolati correttamente', () => {
    const r = computePlayerRankings3v3([
      // Alice win 21-5 → margin +16
      mk([P.alice, P.bob, P.carl], [P.dave, P.eve, P.frank], 21, 5),
      // Alice loss 12-21 → margin -9
      mk([P.alice, P.bob, P.carl], [P.dave, P.eve, P.frank], 12, 21),
    ]);
    const alice = r.find((p) => p.id === 'p-alice')!;
    expect(alice.wins).toBe(1);
    expect(alice.losses).toBe(1);
    expect(alice.marginAvgOnWins).toBe(16);
    expect(alice.marginAvgOnLosses).toBe(-9);
    expect(alice.marginAvg).toBe((16 - 9) / 2);
  });
});
