import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { computePlayerStats, type Medal } from '@/lib/scoring';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const seasonParam = url.searchParams.get('season');

    const sport = await prisma.sport.findUnique({ where: { name: 'K.O.' } });
    if (!sport) return NextResponse.json([]);

    const where: { match: { sportId: string; date?: { gte: Date; lt: Date } } } = {
      match: { sportId: sport.id },
    };

    if (seasonParam && /^\d{4}$/.test(seasonParam)) {
      const year = parseInt(seasonParam, 10);
      where.match.date = {
        gte: new Date(Date.UTC(year, 0, 1)),
        lt: new Date(Date.UTC(year + 1, 0, 1)),
      };
    }

    const results = await prisma.matchResult.findMany({
      where,
      include: { player: true, match: { select: { date: true } } },
    });

    const stats = computePlayerStats(
      results.map((r) => ({
        playerId: r.playerId,
        medal: r.medal as Medal,
        player: { name: r.player.name },
        match: { date: r.match.date },
      })),
    );

    return NextResponse.json(stats);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Errore nel caricamento delle statistiche' }, { status: 500 });
  }
}
