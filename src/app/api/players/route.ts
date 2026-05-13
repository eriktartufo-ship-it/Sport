import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminSession } from '@/lib/auth';
import { PlayerCreateSchema, parseBody } from '@/lib/schemas';

export async function GET() {
  try {
    const players = await prisma.player.findMany({
      orderBy: { name: 'asc' }
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
  try {
    const body = await request.json().catch(() => ({}));
    const parsed = parseBody(PlayerCreateSchema, body);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const player = await prisma.player.create({
      data: { name: parsed.data.name }
    });
    return NextResponse.json(player);
  } catch (error: unknown) {
    const code = (error as { code?: string }).code;
    if (code === 'P2002') {
      return NextResponse.json({ error: 'Un giocatore con questo nome esiste già' }, { status: 400 });
    }
    console.error(error);
    return NextResponse.json({ error: 'Errore nella creazione del giocatore' }, { status: 500 });
  }
}
