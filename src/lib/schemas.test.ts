import { describe, it, expect } from 'vitest';
import {
  LoginSchema,
  PlayerCreateSchema,
  MatchUpsertSchema,
  MedalSchema,
  parseBody,
} from './schemas';

describe('LoginSchema', () => {
  it('accetta password non vuota', () => {
    const r = parseBody(LoginSchema, { password: 'pwd' });
    expect(r.ok).toBe(true);
  });

  it('rifiuta password vuota', () => {
    const r = parseBody(LoginSchema, { password: '' });
    expect(r.ok).toBe(false);
  });

  it('rifiuta password mancante', () => {
    const r = parseBody(LoginSchema, {});
    expect(r.ok).toBe(false);
  });
});

describe('PlayerCreateSchema', () => {
  it('accetta nome valido (trim applicato)', () => {
    const r = parseBody(PlayerCreateSchema, { name: '  Mario  ' });
    if (!r.ok) throw new Error('attesa ok');
    expect(r.data.name).toBe('Mario');
  });

  it('rifiuta nome vuoto / whitespace', () => {
    expect(parseBody(PlayerCreateSchema, { name: '' }).ok).toBe(false);
    expect(parseBody(PlayerCreateSchema, { name: '   ' }).ok).toBe(false);
  });

  it('rifiuta nome troppo lungo (>60 char)', () => {
    const long = 'x'.repeat(61);
    expect(parseBody(PlayerCreateSchema, { name: long }).ok).toBe(false);
  });
});

describe('MedalSchema', () => {
  it("accetta GOLD/SILVER/BRONZE/NONE", () => {
    for (const m of ['GOLD', 'SILVER', 'BRONZE', 'NONE']) {
      expect(MedalSchema.safeParse(m).success).toBe(true);
    }
  });

  it('rifiuta valori non-enum', () => {
    expect(MedalSchema.safeParse('PLATINUM').success).toBe(false);
    expect(MedalSchema.safeParse('gold').success).toBe(false); // case-sensitive
  });
});

describe('MatchUpsertSchema', () => {
  const validResults = [
    { playerId: 'p1', medal: 'GOLD' as const },
    { playerId: 'p2', medal: 'SILVER' as const },
    { playerId: 'p3', medal: 'BRONZE' as const },
  ];

  it('accetta 3 risultati validi', () => {
    expect(parseBody(MatchUpsertSchema, { results: validResults }).ok).toBe(true);
  });

  it('accetta date ISO opzionale', () => {
    expect(parseBody(MatchUpsertSchema, { results: validResults, date: '2026-05-01' }).ok).toBe(true);
    expect(parseBody(MatchUpsertSchema, { results: validResults, date: null }).ok).toBe(true);
  });

  it('rifiuta meno di 3 risultati', () => {
    const r = parseBody(MatchUpsertSchema, { results: validResults.slice(0, 2) });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toMatch(/almeno 3/);
  });

  it('rifiuta medaglia non valida', () => {
    const r = parseBody(MatchUpsertSchema, {
      results: [
        { playerId: 'p1', medal: 'PLATINUM' },
        { playerId: 'p2', medal: 'GOLD' },
        { playerId: 'p3', medal: 'NONE' },
      ],
    });
    expect(r.ok).toBe(false);
  });

  it('rifiuta playerId vuoto', () => {
    const r = parseBody(MatchUpsertSchema, {
      results: [
        { playerId: '', medal: 'GOLD' },
        { playerId: 'p2', medal: 'SILVER' },
        { playerId: 'p3', medal: 'NONE' },
      ],
    });
    expect(r.ok).toBe(false);
  });
});
