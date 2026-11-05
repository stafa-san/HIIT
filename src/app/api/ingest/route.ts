import { NextResponse } from 'next/server';
import { DATA_MODE, TEAM_ID } from '@/lib/config';
import { adminConfigured, getAdminDb } from '@/lib/server/admin';
import { ingestReadings, normalizeReading } from '@/lib/server/ingest';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/ingest — for Wi-Fi sensors (ESP32, Nano 33 IoT, UNO R4 WiFi) or a
 * gateway script. USB sensors use the in-browser gateway instead.
 *
 *   curl -X POST https://<app>/api/ingest \
 *     -H "Authorization: Bearer $HITT_INGEST_KEY" -H "Content-Type: application/json" \
 *     -d '{"sensorId":"HT-0137","linearG":96.2,"rotationalRadS2":5400}'
 *
 * Body: one reading, an array of readings, or { "readings": [...] } (max 50).
 */
export async function POST(request: Request) {
  const key = process.env.HITT_INGEST_KEY;
  if (!key) {
    return NextResponse.json({ ok: false, error: 'Ingest is disabled: set HITT_INGEST_KEY on the server.' }, { status: 503 });
  }
  const auth = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? request.headers.get('x-hitt-key');
  if (auth !== key) {
    return NextResponse.json({ ok: false, error: 'Invalid or missing ingest key.' }, { status: 401 });
  }
  if (DATA_MODE !== 'firebase' || !adminConfigured()) {
    return NextResponse.json(
      {
        ok: false,
        error: 'Server ingest needs Firebase (NEXT_PUBLIC_FIREBASE_* and FIREBASE_SERVICE_ACCOUNT_KEY). In demo mode use the in-browser sensor gateway.',
      },
      { status: 501 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Body must be JSON.' }, { status: 400 });
  }
  const list = Array.isArray(body) ? body : Array.isArray((body as { readings?: unknown })?.readings) ? (body as { readings: unknown[] }).readings : [body];
  if (list.length === 0 || list.length > 50) {
    return NextResponse.json({ ok: false, error: 'Send between 1 and 50 readings.' }, { status: 400 });
  }

  try {
    const readings = list.map(normalizeReading);
    const results = await ingestReadings(getAdminDb(), TEAM_ID, readings);
    return NextResponse.json({ ok: true, results });
  } catch (error) {
    const message = (error as Error).message;
    const status = /missing|must be/i.test(message) ? 400 : 500;
    if (status === 500) console.error('[hitt] ingest failed', error);
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
