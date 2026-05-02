import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getAdminSession } from '@/lib/auth';

export async function GET() {
  const session = await getAdminSession();
  return NextResponse.json({ authenticated: !!session });
}

export async function POST() {
  const cookieStore = await cookies();
  cookieStore.delete('auth_token');
  return NextResponse.json({ success: true });
}
