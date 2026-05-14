import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { computeHeadToHead, type Medal } from '@/lib/scoring';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const p1Id = url.searchParams.get('p1');
    const p2Id = url.searchParams.get('p2');

    if (!p1Id || !p2Id) {
      return NextResponse.json({ error: 'Servono entrambi i player (?p1=&p2=)' }, { status: 400 });
    }
    if (p1Id === p2Id) {
      return NextResponse.json({ error: 'I due player devono essere diversi' }, { status: 400 });
    }

    const sport = await prisma.sport.findUnique({ where: { name: 'K.O.' } });
    if (!sport) {
      return NextResponse.json({ error: 'Sport K.O. non trovato' }, { status: 404 });
    }

    // Prendi tutti i MatchResult di uno dei due player, joinando match e player.
    // Filtriamo poi lato funzione pura per i match che contengono ENTRAMBI.
    const results = await prisma.matchResult.findMany({
      where: {
        playerId: { in: [p1Id, p2Id] },
        match: { sportId: sport.id },
      },
      include: { player: true, match: { select: { id: true, date: true } } },
    });

    const h2h = computeHeadToHead(
      p1Id,
      p2Id,
      results.map((r) => ({
        matchId: r.matchId,
        playerId: r.playerId,
        medal: r.medal as Medal,
        player: { name: r.player.name },
        match: { date: r.match.date },
      })),
    );

    if (!h2h) {
      return NextResponse.json({ error: 'Uno dei due player non ha mai giocato' }, { status: 404 });
    }

    return NextResponse.json(h2h);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Errore nel calcolo H2H' }, { status: 500 });
  }
}
