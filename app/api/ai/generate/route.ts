import { NextRequest, NextResponse } from 'next/server';

const GEMINI_KEY = process.env.GEMINI_API_KEY ?? '';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`;

const MAX_BODY_BYTES = 100_000; // ~100 KB — cukup untuk prompt panjang, cegah abuse

export async function POST(request: NextRequest) {
  try {
    if (!GEMINI_KEY) {
      return NextResponse.json({ error: 'AI service tidak tersedia.' }, { status: 503 });
    }

    // Batasi ukuran body — endpoint sudah butuh session (middleware), tapi cegah
    // penyalahgunaan sebagai proxy gratis dengan payload besar.
    const raw = await request.text();
    if (raw.length > MAX_BODY_BYTES) {
      return NextResponse.json({ error: 'Permintaan terlalu besar.' }, { status: 413 });
    }

    let body: unknown;
    try { body = JSON.parse(raw); } catch {
      return NextResponse.json({ error: 'Body permintaan tidak valid.' }, { status: 400 });
    }

    // Hanya teruskan field yang memang dipakai Gemini — bukan passthrough mentah.
    const b = body as Record<string, unknown>;
    if (!b || typeof b !== 'object' || !Array.isArray(b.contents)) {
      return NextResponse.json({ error: 'Format permintaan tidak valid.' }, { status: 400 });
    }
    const payload: Record<string, unknown> = { contents: b.contents };
    if (b.generationConfig)  payload.generationConfig  = b.generationConfig;
    if (b.systemInstruction) payload.systemInstruction = b.systemInstruction;
    if (b.safetySettings)    payload.safetySettings     = b.safetySettings;

    const res = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: 'Gagal menghubungi AI service.' }, { status: 500 });
  }
}
