import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminSession } from '@/lib/auth';
import { PlayerUpdateSchema, parseBody } from '@/lib/schemas';

/**
 * DELETE /api/players/[id]
 *   Soft-delete: marca deletedAt = now(). Il player sparisce dalle
 *   liste attive (add/new-match) ma la sua storia resta nei
 *   MatchResult → classifica/cronologia/H2H continuano a vederlo.
 *   Idempotente: cancellare un già-cancellato è no-op.
 */
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
    await prisma.player.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
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

/**
 * PATCH /api/players/[id]
 *   Body { name } → rinomina.
 *   Body { restore: true } → ripristina un soft-deleted (deletedAt=null).
 *   I 2 casi sono mutuamente esclusivi (chi rinomina non fa restore e viceversa).
 */
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

    // Caso 1: ripristino di soft-delete
    if (body && body.restore === true) {
      const player = await prisma.player.update({
        where: { id },
        data: { deletedAt: null },
      });
      return NextResponse.json(player);
    }

    // Caso 2: rinomina (default)
    const parsed = parseBody(PlayerUpdateSchema, body);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const player = await prisma.player.update({
      where: { id },
      data: { name: parsed.data.name },
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
