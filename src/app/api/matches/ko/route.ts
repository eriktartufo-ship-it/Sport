import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminSession } from '@/lib/auth';
import { MatchUpsertSchema, parseBody } from '@/lib/schemas';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const seasonParam = url.searchParams.get('season');

    const sport = await prisma.sport.findUnique({ where: { name: 'K.O.' } });
    if (!sport) return NextResponse.json([]);

    const where: { sportId: string; date?: { gte: Date; lt: Date } } = { sportId: sport.id };

    if (seasonParam && /^\d{4}$/.test(seasonParam)) {
      const year = parseInt(seasonParam, 10);
      where.date = {
        gte: new Date(Date.UTC(year, 0, 1)),
        lt: new Date(Date.UTC(year + 1, 0, 1)),
      };
    }

    const matches = await prisma.match.findMany({
      where,
      orderBy: { date: 'desc' },
      take: 50,
      include: {
        results: {
          include: { player: true },
        },
      },
    });

    return NextResponse.json(matches);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Errore nel caricamento delle partite' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
  }
  try {
    const body = await request.json().catch(() => ({}));
    const parsed = parseBody(MatchUpsertSchema, body);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const { results, date } = parsed.data;

    let matchDate: Date | undefined;
    if (date !== undefined && date !== null && date !== '') {
      const parsedDate = new Date(date);
      if (Number.isNaN(parsedDate.getTime())) {
        return NextResponse.json({ error: 'Data non valida' }, { status: 400 });
      }
      matchDate = parsedDate;
    }

    let sport = await prisma.sport.findUnique({ where: { name: 'K.O.' } });
    if (!sport) {
      sport = await prisma.sport.create({ data: { name: 'K.O.' } });
    }

    const match = await prisma.match.create({
      data: {
        sportId: sport.id,
        playerCount: results.length,
        ...(matchDate ? { date: matchDate } : {}),
        results: {
          create: results.map((r) => ({
            playerId: r.playerId,
            medal: r.medal,
          })),
        },
      },
      include: { results: true },
    });

    return NextResponse.json(match);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Errore nel salvataggio della partita' }, { status: 500 });
  }
}
