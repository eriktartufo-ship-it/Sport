import { z } from 'zod';

/**
 * Schemi Zod centralizzati per validare i body delle API.
 * Usare `parseBody(SCHEMA, body)` nel route per ottenere either:
 *   - { ok: true, data: T }
 *   - { ok: false, error: string }  -> return 400 con l'errore.
 */

export const LoginSchema = z.object({
  password: z.string().min(1, 'password obbligatoria'),
});

export const PlayerCreateSchema = z.object({
  name: z.string().trim().min(1, 'nome obbligatorio').max(60, 'nome troppo lungo'),
});

export const PlayerUpdateSchema = PlayerCreateSchema;

export const MedalSchema = z.enum(['GOLD', 'SILVER', 'BRONZE', 'NONE']);

export const MatchResultEntrySchema = z.object({
  playerId: z.string().min(1, 'playerId mancante'),
  medal: MedalSchema,
});

/**
 * Body per POST /api/matches/ko e PATCH /api/matches/ko/[id].
 * - results: almeno 3 partecipanti per una partita K.O. valida
 * - date: ISO string opzionale (Prisma default now() se assente)
 */
export const MatchUpsertSchema = z.object({
  date: z.string().optional().nullable(),
  results: z
    .array(MatchResultEntrySchema)
    .min(3, 'Una partita di K.O. richiede almeno 3 giocatori'),
});

/**
 * Body per POST /api/matches/3v3 e PATCH /api/matches/3v3/[id].
 * Regole 3vs3 (basket FIBA 3x3):
 *   - 3 player per squadra (teamA + teamB)
 *   - 6 player tutti distinti
 *   - punteggi 0..21 interi
 *   - vincitore SEMPRE a 21 (max(A,B) == 21)
 *   - no pareggio (A != B)
 */
export const Match3v3UpsertSchema = z
  .object({
    date: z.string().optional().nullable(),
    teamA: z.array(z.string().min(1)).length(3, 'Squadra A deve avere esattamente 3 giocatori'),
    teamB: z.array(z.string().min(1)).length(3, 'Squadra B deve avere esattamente 3 giocatori'),
    teamAScore: z.number().int().min(0).max(21),
    teamBScore: z.number().int().min(0).max(21),
  })
  .refine((d) => d.teamAScore !== d.teamBScore, {
    message: 'Una squadra deve vincere — i punteggi non possono essere uguali',
    path: ['teamBScore'],
  })
  .refine((d) => Math.max(d.teamAScore, d.teamBScore) === 21, {
    message: 'Il vincitore deve arrivare a 21 punti',
    path: ['teamAScore'],
  })
  .refine(
    (d) => {
      const all = [...d.teamA, ...d.teamB];
      return new Set(all).size === all.length;
    },
    { message: 'Un giocatore non può essere in entrambe le squadre', path: ['teamB'] }
  );

export type ParseResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

/**
 * Wrapper attorno a `schema.safeParse` che produce un messaggio di errore
 * piatto e leggibile per l'API (es. "results.1.medal: Invalid enum value").
 */
export function parseBody<T>(schema: z.ZodSchema<T>, body: unknown): ParseResult<T> {
  const r = schema.safeParse(body);
  if (r.success) {
    return { ok: true, data: r.data };
  }
  const first = r.error.issues[0];
  const path = first.path.length > 0 ? `${first.path.join('.')}: ` : '';
  return { ok: false, error: `${path}${first.message}` };
}
