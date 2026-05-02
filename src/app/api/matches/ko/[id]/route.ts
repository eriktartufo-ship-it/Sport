import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminSession } from '@/lib/auth';

const VALID_MEDALS = new Set(['GOLD', 'SILVER', 'BRONZE', 'NONE']);

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const match = await prisma.match.findUnique({
      where: { id },
      include: {
        results: {
          include: { player: true },
        },
      },
    });
    if (!match) {
      return NextResponse.json({ error: 'Partita non trovata' }, { status: 404 });
    }
    return NextResponse.json(match);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Errore nel caricamento della partita' }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
  }
  try {
    const { id } = await params;
    const body = await request.json();
    const { results, date } = body as { results: Array<{ playerId: string; medal: string }>; date?: string };

    if (!Array.isArray(results) || results.length < 3) {
      return NextResponse.json({ error: 'Una partita di K.O. richiede almeno 3 giocatori' }, { status: 400 });
    }

    for (const r of results) {
      if (!r.playerId || typeof r.playerId !== 'string') {
        return NextResponse.json({ error: 'playerId mancante o non valido' }, { status: 400 });
      }
      if (!VALID_MEDALS.has(r.medal)) {
        return NextResponse.json({ error: `Medaglia non valida: ${r.medal}` }, { status: 400 });
      }
    }

    let matchDate: Date | undefined;
    if (date !== undefined && date !== null && date !== '') {
      const parsed = new Date(date);
      if (Number.isNaN(parsed.getTime())) {
        return NextResponse.json({ error: 'Data non valida' }, { status: 400 });
      }
      matchDate = parsed;
    }

    const updated = await prisma.match.update({
      where: { id },
      data: {
        ...(matchDate ? { date: matchDate } : {}),
        playerCount: results.length,
        results: {
          deleteMany: {},
          create: results.map((r) => ({ playerId: r.playerId, medal: r.medal })),
        },
      },
      include: {
        results: { include: { player: true } },
      },
    });

    return NextResponse.json(updated);
  } catch (error: unknown) {
    const code = (error as { code?: string }).code;
    if (code === 'P2025') {
      return NextResponse.json({ error: 'Partita non trovata' }, { status: 404 });
    }
    console.error(error);
    return NextResponse.json({ error: 'Errore nella modifica della partita' }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
  }
  try {
    const { id } = await params;
    await prisma.match.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const code = (error as { code?: string }).code;
    if (code === 'P2025') {
      return NextResponse.json({ error: 'Partita non trovata' }, { status: 404 });
    }
    console.error(error);
    return NextResponse.json({ error: 'Errore nella cancellazione della partita' }, { status: 500 });
  }
}
