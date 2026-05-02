import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminSession } from '@/lib/auth';

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
    await prisma.player.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const code = (error as { code?: string }).code;
    if (code === 'P2025') {
      return NextResponse.json({ error: 'Giocatore non trovato' }, { status: 404 });
    }
    console.error(error);
    return NextResponse.json({ error: 'Errore nella cancellazione del giocatore' }, { status: 500 });
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
    const { name } = await request.json();

    if (!name || typeof name !== 'string' || name.trim() === '') {
      return NextResponse.json({ error: 'Il nome è obbligatorio' }, { status: 400 });
    }

    const player = await prisma.player.update({
      where: { id },
      data: { name: name.trim() },
    });
    return NextResponse.json(player);
  } catch (error: unknown) {
    const code = (error as { code?: string }).code;
    if (code === 'P2002') {
      return NextResponse.json({ error: 'Un giocatore con questo nome esiste già' }, { status: 400 });
    }
    if (code === 'P2025') {
      return NextResponse.json({ error: 'Giocatore non trovato' }, { status: 404 });
    }
    console.error(error);
    return NextResponse.json({ error: 'Errore nella modifica del giocatore' }, { status: 500 });
  }
}
