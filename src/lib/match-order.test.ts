import { describe, it, expect } from 'vitest';
import { compareChrono, dayKey, groupByDay, matchOrder, matchResultOrder } from './match-order';
import { computePlayerRankingsMachiavelli, type MatchMachiavelliLite } from './scoring-machiavelli';
import { computePadelPlayerRankings, type MatchPadelLite } from './scoring-padel';
import { computePlayerStats, type ScoringResult, type Medal } from './scoring';

/**
 * Regressione del difetto del 2026-08-01 (Machiavelli, prod).
 *
 * `date` è una giornata: due partite dello stesso giorno hanno data identica e
 * il loro ordine reciproco non era deciso da nessuno → lo decideva SQLite, e
 * bastava che lo restituisse "al contrario" perché la serie di vittorie
 * cambiasse numero. Questi test bloccano la classe di difetto su TUTTI gli
 * sport che contano serie: l'ordine deve dipendere SOLO da `createdAt`, mai
 * dall'ordine dell'array in ingresso.
 */

describe('compareChrono', () => {
  it('ordina per giornata prima che per spareggio', () => {
    const a = { id: 'a', date: '2026-07-26', createdAt: '2026-07-26T23:00:00Z' };
    const b = { id: 'b', date: '2026-08-01', createdAt: '2026-08-01T08:00:00Z' };
    expect(compareChrono(a, b)).toBeLessThan(0);
  });

  it('a parità di giornata usa createdAt', () => {
    const prima = { id: 'z', date: '2026-07-26', createdAt: '2026-07-26T18:00:00Z' };
    const dopo = { id: 'a', date: '2026-07-26', createdAt: '2026-07-26T21:00:00Z' };
    expect(compareChrono(prima, dopo)).toBeLessThan(0);
    // l'id non deve poter ribaltare createdAt (qui 'z' > 'a' ma viene prima)
    expect([dopo, prima].sort(compareChrono).map((m) => m.id)).toEqual(['z', 'a']);
  });

  it('senza createdAt resta deterministico (spareggio su id), mai casuale', () => {
    const a = { id: 'aaa', date: '2026-07-26' };
    const b = { id: 'bbb', date: '2026-07-26' };
    expect([b, a].sort(compareChrono).map((m) => m.id)).toEqual(['aaa', 'bbb']);
    expect([a, b].sort(compareChrono).map((m) => m.id)).toEqual(['aaa', 'bbb']);
  });

  it('una riga senza createdAt è più vecchia di una che ce l\'ha', () => {
    const vecchia = { id: 'zzz', date: '2026-07-26' };
    const nuova = { id: 'aaa', date: '2026-07-26', createdAt: '2026-07-26T10:00:00Z' };
    expect([nuova, vecchia].sort(compareChrono).map((m) => m.id)).toEqual(['zzz', 'aaa']);
  });
});

describe('matchOrder / matchResultOrder', () => {
  it('mette createdAt come secondo criterio e id come terzo', () => {
    expect(matchOrder('desc')).toEqual([{ date: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }]);
    expect(matchResultOrder('asc')).toEqual([
      { match: { date: 'asc' } },
      { match: { createdAt: 'asc' } },
      { match: { id: 'asc' } },
    ]);
  });
});

describe('groupByDay', () => {
  const m = (id: string, date: string, createdAt: string) => ({ id, date, createdAt });

  it('giornate dalla più recente, partite della giornata in ordine di gioco', () => {
    const groups = groupByDay([
      m('b', '2026-07-26', '2026-07-26T21:00:00Z'),
      m('c', '2026-08-01', '2026-08-01T20:00:00Z'),
      m('a', '2026-07-26', '2026-07-26T18:00:00Z'),
      m('d', '2026-08-01', '2026-08-01T21:00:00Z'),
    ]);
    expect(groups.map((g) => g.key)).toEqual(['2026-08-01', '2026-07-26']);
    expect(groups[0].matches.map((x) => x.id)).toEqual(['c', 'd']);
    expect(groups[1].matches.map((x) => x.id)).toEqual(['a', 'b']);
  });

  it('non perde nessuna partita e non muta l\'array in ingresso', () => {
    const input = [
      m('a', '2026-07-26', '2026-07-26T18:00:00Z'),
      m('b', '2026-07-26', '2026-07-26T21:00:00Z'),
      m('c', '2026-08-01', '2026-08-01T20:00:00Z'),
    ];
    const copia = [...input];
    const groups = groupByDay(input);
    expect(groups.flatMap((g) => g.matches)).toHaveLength(3);
    expect(input).toEqual(copia);
  });

  it('raggruppa per giornata LOCALE, la stessa che si legge a schermo', () => {
    const d = new Date(2026, 7, 1, 0, 30); // 1 agosto 2026, 00:30 locale
    expect(dayKey(d)).toBe('2026-08-01');
  });
});

// --- Machiavelli: il caso reale che ha fatto scoprire il difetto ---------------
describe('serie di vittorie Machiavelli — ordine dentro la giornata', () => {
  // Storia vera (prod, 2026-08-01). Il 26/07 si gioca due volte: prima vince
  // Irene, poi Erik. L'ultima partita del 26/07 SPEZZA la serie di Irene,
  // quindi al 1° agosto (2 vittorie) la serie in corso è 2, non 3.
  const mc = (
    id: string,
    date: string,
    createdAt: string,
    ordine: string[]
  ): MatchMachiavelliLite => ({
    id,
    date,
    createdAt,
    results: ordine.map((playerId, i) => ({
      playerId,
      position: i + 1,
      player: { name: playerId },
    })),
  });

  const storia: MatchMachiavelliLite[] = [
    mc('a', '2026-07-25', '2026-07-25T20:00:00Z', ['irene', 'erik']),
    mc('b', '2026-07-25', '2026-07-25T21:00:00Z', ['irene', 'erik']),
    mc('c', '2026-07-26', '2026-07-26T20:00:00Z', ['irene', 'erik']), // 1ª del giorno
    mc('d', '2026-07-26', '2026-07-26T21:00:00Z', ['erik', 'irene']), // 2ª del giorno
    mc('e', '2026-08-01', '2026-08-01T20:00:00Z', ['irene', 'erik']),
    mc('f', '2026-08-01', '2026-08-01T21:00:00Z', ['irene', 'erik']),
  ];

  const irene = (ms: MatchMachiavelliLite[]) =>
    computePlayerRankingsMachiavelli(ms).find((r) => r.id === 'irene')!;

  it('conta 2 vittorie di fila: la sconfitta del 26/07 spezza la serie', () => {
    expect(irene(storia).currentStreak).toBe(2);
    // la serie migliore è quella spezzata: 25/07 ×2 + la 1ª del 26/07 = 3
    expect(irene(storia).bestStreak).toBe(3);
  });

  it('il risultato non cambia comunque arrivino le partite dal DB', () => {
    const atteso = irene(storia).currentStreak;
    expect(irene([...storia].reverse()).currentStreak).toBe(atteso);
    // ordine "peggiore": le due del 26/07 invertite nell'array in ingresso
    const scambiate = [storia[0], storia[1], storia[3], storia[2], storia[4], storia[5]];
    expect(irene(scambiate).currentStreak).toBe(atteso);
  });

  it('se il 26/07 la vittoria di Irene fosse stata l\'ULTIMA, la serie sarebbe 3', () => {
    // Controllo positivo: il test sopra non passa "per caso" — spostando lo
    // spareggio, e SOLO quello, il numero cambia davvero.
    const invertito = storia.map((m) =>
      m.id === 'c' ? { ...m, createdAt: '2026-07-26T21:30:00Z' }
      : m.id === 'd' ? { ...m, createdAt: '2026-07-26T20:30:00Z' }
      : m
    );
    expect(irene(invertito).currentStreak).toBe(3);
  });
});

// --- Padel: stesso difetto, stesso presidio -----------------------------------
describe('serie di vittorie Padel — ordine dentro la giornata', () => {
  const pd = (id: string, createdAt: string, vinceA: boolean): MatchPadelLite => ({
    id,
    date: '2026-07-26',
    createdAt,
    sets: vinceA ? [{ a: 6, b: 4 }, { a: 6, b: 3 }] : [{ a: 4, b: 6 }, { a: 3, b: 6 }],
    results: [
      { playerId: 'irene', teamSide: 'A', player: { name: 'irene' } },
      { playerId: 'luke', teamSide: 'A', player: { name: 'luke' } },
      { playerId: 'erik', teamSide: 'B', player: { name: 'erik' } },
      { playerId: 'anna', teamSide: 'B', player: { name: 'anna' } },
    ],
  });

  // Stessa giornata: vittoria, vittoria, sconfitta → serie in corso 0.
  const storia = [
    pd('p1', '2026-07-26T18:00:00Z', true),
    pd('p2', '2026-07-26T19:00:00Z', true),
    pd('p3', '2026-07-26T20:00:00Z', false),
  ];
  const irene = (ms: MatchPadelLite[]) =>
    computePadelPlayerRankings(ms).find((r) => r.id === 'irene')!;

  it('la sconfitta finale azzera la serie, in qualunque ordine arrivino', () => {
    expect(irene(storia).currentStreak).toBe(0);
    expect(irene(storia).bestStreak).toBe(2);
    expect(irene([...storia].reverse()).currentStreak).toBe(0);
    expect(irene([storia[2], storia[0], storia[1]]).currentStreak).toBe(0);
  });
});

// --- K.O.: stesso difetto, stesso presidio ------------------------------------
describe('serie di vittorie K.O. — ordine dentro la giornata', () => {
  const ko = (matchId: string, createdAt: string, medal: Medal): ScoringResult => ({
    matchId,
    playerId: 'irene',
    medal,
    player: { name: 'irene' },
    match: { date: new Date('2026-07-26T00:00:00Z'), createdAt: new Date(createdAt) },
  });

  const storia = [
    ko('k1', '2026-07-26T18:00:00Z', 'GOLD'),
    ko('k2', '2026-07-26T19:00:00Z', 'GOLD'),
    ko('k3', '2026-07-26T20:00:00Z', 'SILVER'),
  ];
  const irene = (rs: ScoringResult[]) => computePlayerStats(rs).find((r) => r.id === 'irene')!;

  it('la partita persa in fondo alla giornata azzera la serie', () => {
    expect(irene(storia).currentStreak).toBe(0);
    expect(irene(storia).bestStreak).toBe(2);
    expect(irene([...storia].reverse()).currentStreak).toBe(0);
    expect(irene([storia[2], storia[1], storia[0]]).bestStreak).toBe(2);
  });
});
