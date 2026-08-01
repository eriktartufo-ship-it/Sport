import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminSession } from '@/lib/auth';
import { MatchReorderSchema, parseBody } from '@/lib/schemas';
import { dayKey } from '@/lib/match-order';

/**
 * POST /api/matches/reorder — scambia l'ordine di gioco di due partite della
 * STESSA giornata (in tutti gli sport).
 *
 * Serve perché `date` è solo il giorno: l'ordine dentro la giornata è quello di
 * registrazione (`createdAt`), e se una sera si registrano le partite in ordine
 * diverso da come sono state giocate, la serie di vittorie esce sbagliata senza
 * che nessuno possa accorgersene o rimediare. Con la cronologia che numera le
 * partite (1ª · 2ª) l'errore si VEDE, e qui si corregge.
 *
 * Scambia i due valori di `createdAt`: le altre partite della giornata restano
 * dove sono. Deve restare l'UNICA scrittura su `createdAt` oltre alla creazione
 * — il backfill di avvio è filtrato su `IS NULL` apposta per non poter tornare
 * sopra a una correzione fatta a mano.
 */
export async function POST(request: Request) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
  }
  try {
    const body = await request.json().catch(() => ({}));
    const parsed = parseBody(MatchReorderSchema, body);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const { sport, first, second } = parsed.data;

    const load = (id: string) => {
      const select = { id: true, date: true, createdAt: true };
      switch (sport) {
        case 'ko':
          return prisma.match.findUnique({ where: { id }, select });
        case '3v3':
          return prisma.match3v3.findUnique({ where: { id }, select });
        case 'machiavelli':
          return prisma.matchMachiavelli.findUnique({ where: { id }, select });
        case 'padel':
          return prisma.matchPadel.findUnique({ where: { id }, select });
      }
    };
    const save = (id: string, createdAt: Date) => {
      const data = { createdAt };
      switch (sport) {
        case 'ko':
          return prisma.match.update({ where: { id }, data });
        case '3v3':
          return prisma.match3v3.update({ where: { id }, data });
        case 'machiavelli':
          return prisma.matchMachiavelli.update({ where: { id }, data });
        case 'padel':
          return prisma.matchPadel.update({ where: { id }, data });
      }
    };

    const [a, b] = await Promise.all([load(first), load(second)]);
    if (!a || !b) {
      return NextResponse.json({ error: 'Partita non trovata' }, { status: 404 });
    }
    if (dayKey(a.date) !== dayKey(b.date)) {
      return NextResponse.json(
        { error: 'Si possono riordinare solo partite della stessa giornata' },
        { status: 400 }
      );
    }

    // Le due chiavi d'ordine attuali, riassegnate: la minore a `first`.
    // Se coincidono (o mancano entrambe, DB non ancora riempito) se ne creano
    // due distinte a partire dalla giornata: l'importante è l'ordine relativo.
    const keyOf = (m: { date: Date; createdAt: Date | null }) => m.createdAt ?? m.date;
    let lo = keyOf(a);
    let hi = keyOf(b);
    if (lo.getTime() > hi.getTime()) [lo, hi] = [hi, lo];
    if (lo.getTime() === hi.getTime()) hi = new Date(lo.getTime() + 1000);

    await prisma.$transaction([save(first, lo), save(second, hi)]);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Errore nel riordino delle partite" }, { status: 500 });
  }
}
