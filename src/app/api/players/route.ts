import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminSession } from '@/lib/auth';

export async function GET() {
  try {
    const players = await prisma.player.findMany({
      orderBy: { name: 'asc' }
    });
    return NextResponse.json(players);
  } catch (error) {
    return NextResponse.json({ error: 'Errore nel recupero dei giocatori' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
  }
  try {
    const { name } = await request.json();
    if (!name || name.trim() === '') {
      return NextResponse.json({ error: 'Il nome è obbligatorio' }, { status: 400 });
    }
    
    const player = await prisma.player.create({
      data: { name: name.trim() }
    });
    return NextResponse.json(player);
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'Un giocatore con questo nome esiste già' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Errore nella creazione del giocatore' }, { status: 500 });
  }
}
