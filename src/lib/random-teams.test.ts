import { describe, it, expect } from 'vitest';
import { makeRandomTeams, maxTeams, shuffle, teamLetter, teamSizes, teamsProblem } from './random-teams';

// generatore deterministico (mulberry32) per test ripetibili
const seeded = (seed: number) => () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const names = (n: number) => Array.from({ length: n }, (_, i) => `p${i + 1}`);

describe('vincoli', () => {
  it('servono almeno 4 giocatori', () => {
    expect(teamsProblem(3, 2)).toMatch(/almeno 4 giocatori: ne manca 1/);
    expect(teamsProblem(2, 2)).toMatch(/mancano 2/);
    expect(teamsProblem(4, 2)).toBeNull();
  });

  it('ogni squadra ha almeno 2 giocatori ⇒ al massimo n/2 squadre', () => {
    expect(maxTeams(4)).toBe(2);
    expect(maxTeams(5)).toBe(2);
    expect(maxTeams(6)).toBe(3);
    expect(maxTeams(9)).toBe(4);
    expect(teamsProblem(6, 3)).toBeNull();
    expect(teamsProblem(5, 3)).toMatch(/al massimo 2 squadre/);
    expect(teamsProblem(6, 1)).toMatch(/almeno 2 squadre/);
  });

  it('makeRandomTeams rifiuta i casi fuori regola', () => {
    expect(() => makeRandomTeams(names(3), 2)).toThrow();
    expect(() => makeRandomTeams(names(5), 3)).toThrow();
  });
});

describe('taglie bilanciate', () => {
  it('differiscono al massimo di 1', () => {
    expect(teamSizes(4, 2)).toEqual([2, 2]);
    expect(teamSizes(5, 2)).toEqual([3, 2]);
    expect(teamSizes(6, 2)).toEqual([3, 3]);
    expect(teamSizes(6, 3)).toEqual([2, 2, 2]);
    expect(teamSizes(9, 4)).toEqual([3, 2, 2, 2]);
  });

  it('ogni giocatore finisce in UNA squadra, nessuno perso o doppio', () => {
    for (let n = 4; n <= 12; n++) {
      for (let t = 2; t <= maxTeams(n); t++) {
        const { teams, dealOrder } = makeRandomTeams(names(n), t, seeded(n * 100 + t));
        const all = teams.flat();
        expect(all.length).toBe(n);
        expect(new Set(all)).toEqual(new Set(names(n)));
        expect(teams.map((x) => x.length)).toEqual(teamSizes(n, t));
        expect(new Set(dealOrder)).toEqual(new Set(names(n)));
      }
    }
  });
});

describe('casualità', () => {
  it('shuffle non tocca l’array originale', () => {
    const input = names(6);
    shuffle(input, seeded(1));
    expect(input).toEqual(names(6));
  });

  it('con lo stesso seme è ripetibile, con semi diversi cambia', () => {
    const a = makeRandomTeams(names(6), 2, seeded(42)).teams;
    const b = makeRandomTeams(names(6), 2, seeded(42)).teams;
    const c = makeRandomTeams(names(6), 2, seeded(7)).teams;
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
  });

  it('ogni giocatore capita in ogni squadra con frequenza simile', () => {
    // 4 giocatori, 2 squadre: p1 deve finire nella A circa la metà delle volte
    const rand = seeded(2026);
    const runs = 4000;
    let inA = 0;
    let withP2 = 0;
    for (let i = 0; i < runs; i++) {
      const { teams } = makeRandomTeams(names(4), 2, rand);
      if (teams[0].includes('p1')) inA++;
      const mine = teams.find((t) => t.includes('p1'))!;
      if (mine.includes('p2')) withP2++;
    }
    expect(inA / runs).toBeGreaterThan(0.45);
    expect(inA / runs).toBeLessThan(0.55);
    // compagno: 3 possibili, ciascuno ~1/3
    expect(withP2 / runs).toBeGreaterThan(0.29);
    expect(withP2 / runs).toBeLessThan(0.38);
  });
});

describe('teamLetter', () => {
  it('A, B, C…', () => {
    expect([0, 1, 2, 3].map(teamLetter)).toEqual(['A', 'B', 'C', 'D']);
  });
});
