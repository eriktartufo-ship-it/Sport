import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminSession } from '@/lib/auth';
import { MatchMachiavelliUpsertSchema, parseBody } from '@/lib/schemas';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const match = await prisma.matchMachiavelli.findUnique({
      where: { id },
      include: {
        results: { include: { player: true }, orderBy: { position: 'asc' } },
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
    const body = await request.json().catch(() => ({}));
    const parsed = parseBody(MatchMachiavelliUpsertSchema, body);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const { orderedPlayerIds, date } = parsed.data;

    let matchDate: Date | undefined;
    if (date !== undefined && date !== null && date !== '') {
      const parsedDate = new Date(date);
      if (Number.isNaN(parsedDate.getTime())) {
        return NextResponse.json({ error: 'Data non valida' }, { status: 400 });
      }
      matchDate = parsedDate;
    }

    const updated = await prisma.matchMachiavelli.update({
      where: { id },
      data: {
        ...(matchDate ? { date: matchDate } : {}),
        results: {
          deleteMany: {},
          create: orderedPlayerIds.map((pid, i) => ({ playerId: pid, position: i + 1 })),
        },
      },
      include: {
        results: { include: { player: true }, orderBy: { position: 'asc' } },
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
    await prisma.matchMachiavelli.delete({ where: { id } });
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
