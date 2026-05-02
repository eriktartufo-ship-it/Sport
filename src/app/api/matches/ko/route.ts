import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminSession } from '@/lib/auth';

export async function POST(request: Request) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
  }
  try {
    const data = await request.json();
    const { results } = data; 
    // results expected: Array of { playerId: string, medal: "GOLD" | "SILVER" | "BRONZE" | "NONE" }
    
    if (!results || results.length < 3) {
      return NextResponse.json({ error: 'Una partita di K.O. richiede almeno 3 giocatori' }, { status: 400 });
    }

    // Assicuriamoci che esista lo sport "K.O."
    let sport = await prisma.sport.findUnique({ where: { name: 'K.O.' } });
    if (!sport) {
      sport = await prisma.sport.create({ data: { name: 'K.O.' } });
    }

    // Crea il match
    const match = await prisma.match.create({
      data: {
        sportId: sport.id,
        playerCount: results.length,
        results: {
          create: results.map((r: any) => ({
            playerId: r.playerId,
            medal: r.medal,
          }))
        }
      },
      include: {
        results: true
      }
    });

    return NextResponse.json(match);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Errore nel salvataggio della partita' }, { status: 500 });
  }
}
