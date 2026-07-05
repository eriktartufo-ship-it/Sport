import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminSession } from '@/lib/auth';
import { MatchPadelUpsertSchema, parseBody } from '@/lib/schemas';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const match = await prisma.matchPadel.findUnique({
      where: { id },
      include: { results: { include: { player: true } } },
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
    const body = await request.json().catch(() => ({}));
    const parsed = parseBody(MatchPadelUpsertSchema, body);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const { teamA, teamB, sets, date } = parsed.data;

    let matchDate: Date | undefined;
    if (date !== undefined && date !== null && date !== '') {
      const parsedDate = new Date(date);
      if (Number.isNaN(parsedDate.getTime())) {
        return NextResponse.json({ error: 'Data non valida' }, { status: 400 });
      }
      matchDate = parsedDate;
    }

    const updated = await prisma.matchPadel.update({
      where: { id },
      data: {
        ...(matchDate ? { date: matchDate } : {}),
        setsJson: JSON.stringify(sets.map((s) => [s.a, s.b])),
        results: {
          deleteMany: {},
          create: [
            ...teamA.map((pid) => ({ playerId: pid, teamSide: 'A' })),
            ...teamB.map((pid) => ({ playerId: pid, teamSide: 'B' })),
          ],
        },
      },
      include: { results: { include: { player: true } } },
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
    await prisma.matchPadel.delete({ where: { id } });
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
