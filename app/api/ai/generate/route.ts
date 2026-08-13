import { NextRequest, NextResponse } from 'next/server';

const GEMINI_KEY = process.env.GEMINI_API_KEY ?? '';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`;

const MAX_BODY_BYTES = 4_000_000;

function errJson(message: string, status: number) {
  return NextResponse.json({ error: { message } }, { status });
}

export async function POST(request: NextRequest) {
  try {
    if (!GEMINI_KEY) {
      return errJson('AI service tidak tersedia (GEMINI_API_KEY belum diset di server).', 503);
    }

    // Batasi ukuran body — endpoint sudah butuh session (middleware), tapi cegah
    // penyalahgunaan sebagai proxy gratis dengan payload besar.
    const raw = await request.text();
    if (raw.length > MAX_BODY_BYTES) {
      return errJson(
        `File terlalu besar (${(raw.length / 1_000_000).toFixed(1)} MB setelah encoding, maks ${(MAX_BODY_BYTES / 1_000_000).toFixed(1)} MB). Coba PDF yang lebih kecil.`,
        413
      );
    }

    let body: unknown;
    try { body = JSON.parse(raw); } catch {
      return errJson('Body permintaan tidak valid.', 400);
    }

    // Hanya teruskan field yang memang dipakai Gemini — bukan passthrough mentah.
    const b = body as Record<string, unknown>;
    if (!b || typeof b !== 'object' || !Array.isArray(b.contents)) {
      return errJson('Format permintaan tidak valid.', 400);
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
    if (!res.ok) {
      // Log detail asli ke server log (nggak keliatan user, tapi kebaca di Vercel logs)
      // supaya gampang di-debug kalau Gemini balikin error yang shape-nya nggak terduga.
      console.error('[api/ai/generate] Gemini error', res.status, JSON.stringify(data));
      // generativelanguage.googleapis.com KADANG membungkus error dalam array
      // ([{error:{...}}], bukan {error:{...}}) — klien (generateWithGemini di
      // shared.tsx) hanya membaca data.error.message, jadi bentuk array ini
      // sebelumnya selalu jatuh ke pesan generik "Gemini API error" walau
      // Gemini sebenarnya sudah mengirim alasan yang jelas. Diratakan di sini
      // supaya klien SELALU dapat data.error.message yang sebenarnya.
      const normalized = Array.isArray(data) ? data[0] : data;
      if (normalized?.error?.message) {
        return NextResponse.json(normalized, { status: res.status });
      }
      return errJson(
        `Gemini API error (HTTP ${res.status}). ${typeof data === 'object' ? JSON.stringify(data).slice(0, 300) : String(data)}`,
        res.status,
      );
    }
    return NextResponse.json(data, { status: res.status });
  } catch (e) {
    console.error('[api/ai/generate] proxy exception', e);
    return errJson('Gagal menghubungi AI service: ' + (e instanceof Error ? e.message : String(e)), 500);
  }
}
