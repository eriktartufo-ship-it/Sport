import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
  computeTeamRankings,
  computePlayerRankings3v3,
  type Match3v3Lite,
  type Side,
} from '@/lib/scoring-3v3';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const seasonParam = url.searchParams.get('season');

    const sport = await prisma.sport.findUnique({ where: { name: '3v3' } });
    if (!sport) return NextResponse.json({ teams: [], players: [] });

    const where: { sportId: string; date?: { gte: Date; lt: Date } } = { sportId: sport.id };
    if (seasonParam && /^\d{4}$/.test(seasonParam)) {
      const year = parseInt(seasonParam, 10);
      where.date = {
        gte: new Date(Date.UTC(year, 0, 1)),
        lt: new Date(Date.UTC(year + 1, 0, 1)),
      };
    }

    const matches = await prisma.match3v3.findMany({
      where,
      orderBy: { date: 'asc' },
      include: {
        results: { include: { player: true } },
      },
    });

    const lite: Match3v3Lite[] = matches.map((m) => ({
      id: m.id,
      date: m.date,
      teamAScore: m.teamAScore,
      teamBScore: m.teamBScore,
      results: m.results.map((r) => ({
        playerId: r.playerId,
        teamSide: r.teamSide as Side,
        player: { name: r.player.name },
      })),
    }));

    return NextResponse.json({
      teams: computeTeamRankings(lite),
      players: computePlayerRankings3v3(lite),
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Errore nel caricamento delle statistiche' }, { status: 500 });
  }
}
