import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminSession } from '@/lib/auth';
import { PlayerCreateSchema, parseBody } from '@/lib/schemas';

/**
 * GET /api/players
 *   Default: solo player attivi (deletedAt=null). Ordinati per nome.
 *   ?includeDeleted=1: include anche i soft-deleted (per il pannello
 *   admin in tab Player). I deleted vengono comunque in fondo (ordine
 *   secondario: createdAt desc).
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const includeDeleted = url.searchParams.get('includeDeleted') === '1';

    const players = await prisma.player.findMany({
      where: includeDeleted ? undefined : { deletedAt: null },
      orderBy: includeDeleted
        ? [{ deletedAt: 'asc' }, { name: 'asc' }] // attivi prima (null < date), poi cancellati
        : { name: 'asc' },
    });
    return NextResponse.json(players);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Errore nel recupero dei giocatori' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
  }

  // Leggiamo il body UNA SOLA volta (Request.json() può essere chiamato una sola volta)
  const body = await request.json().catch(() => ({}));
  const parsed = parseBody(PlayerCreateSchema, body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  try {
    const player = await prisma.player.create({
      data: { name: parsed.data.name }
    });
    return NextResponse.json(player);
  } catch (error: unknown) {
    const code = (error as { code?: string }).code;
    if (code === 'P2002') {
      // Può collidere anche con un soft-deleted (vincolo @unique su name resta).
      // Lookup mirato per dare un messaggio più utile (suggerire restore).
      const existing = await prisma.player.findUnique({ where: { name: parsed.data.name } });
      if (existing?.deletedAt) {
        return NextResponse.json({
          error: `Esiste già un giocatore "${existing.name}" cancellato. Ripristinalo dalla scheda Player (toggle "mostra cancellati") invece di crearne uno nuovo.`,
        }, { status: 400 });
      }
      return NextResponse.json({ error: 'Un giocatore con questo nome esiste già' }, { status: 400 });
    }
    console.error(error);
    return NextResponse.json({ error: 'Errore nella creazione del giocatore' }, { status: 500 });
  }
}
