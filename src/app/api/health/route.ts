import { NextResponse } from 'next/server';
import { DATA_MODE, TEAM_ID } from '@/lib/config';
import { adminConfigured } from '@/lib/server/admin';

export const dynamic = 'force-dynamic';

export function GET() {
  return NextResponse.json({
    ok: true,
    mode: DATA_MODE,
    team: TEAM_ID,
    ingest: Boolean(process.env.HITT_INGEST_KEY) && DATA_MODE === 'firebase' && adminConfigured(),
  });
}
