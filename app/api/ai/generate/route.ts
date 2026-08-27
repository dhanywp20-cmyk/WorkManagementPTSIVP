/**
 * Proksi pembuat soal AI.
 *
 * Token, nama model, arahan topik, dan suhu TIDAK lagi terpaku di berkas ini -
 * semuanya dibaca saat permintaan datang, dari tabel yang diatur Admin Panel.
 * Lihat lib/ai-pengaturan.ts untuk alasan tiap-tiapnya.
 *
 * Tokennya sengaja tetap di sisi server. Ia tidak boleh pernah sampai ke
 * peramban: kunci Google AI Studio yang bocor bisa dipakai siapa pun sampai
 * kuotanya habis, dan tagihannya tetap atas nama pemilik kunci.
 */
import { NextRequest, NextResponse } from 'next/server';
import { bacaRahasia } from '@/lib/rahasia-server';
import { ambilPengaturanAI } from '@/lib/ai-pengaturan';

const MAX_BODY_BYTES = 4_000_000;

function errJson(message: string, status: number) {
  return NextResponse.json({ error: { message } }, { status });
}

export async function POST(request: NextRequest) {
  try {
    const [token, setelan] = await Promise.all([
      bacaRahasia('ai.gemini_token'),
      ambilPengaturanAI(),
    ]);

    if (!token) {
      return errJson(
        'Pembuat soal AI belum aktif. Admin dapat mengisi Token AI di Admin Panel → Integrations.',
        503,
      );
    }

    // Batasi ukuran body - endpoint sudah butuh session (middleware), tapi cegah
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

    // Hanya teruskan field yang memang dipakai Gemini - bukan passthrough mentah.
    const b = body as Record<string, unknown>;
    if (!b || typeof b !== 'object' || !Array.isArray(b.contents)) {
      return errJson('Format permintaan tidak valid.', 400);
    }
    const payload: Record<string, unknown> = { contents: b.contents };
    if (b.generationConfig)  payload.generationConfig  = b.generationConfig;
    if (b.systemInstruction) payload.systemInstruction = b.systemInstruction;
    if (b.safetySettings)    payload.safetySettings     = b.safetySettings;

    // Suhu dari pengaturan, KECUALI bila pemanggil sudah menentukan sendiri -
    // sebagian alur (mis. merapikan teks) memang butuh suhu tetap.
    const gc = (payload.generationConfig ?? {}) as Record<string, unknown>;
    if (gc.temperature === undefined) {
      payload.generationConfig = { ...gc, temperature: setelan.suhu };
    }

    /*
      Arahan topik DITAMBAHKAN di belakang instruksi aplikasi, bukan
      menggantinya. Aturan bentuk keluaran - JSON, jumlah opsi, bahasa - tetap
      dipegang aplikasi, sehingga arahan yang keliru tidak bisa membuat
      jawabannya gagal diurai dan seluruh pembuat soal berhenti.
    */
    if (setelan.arahan.trim()) {
      const si = payload.systemInstruction as { parts?: { text?: string }[] } | undefined;
      const arahan = { text: `\n\nARAHAN TAMBAHAN DARI ADMIN:\n${setelan.arahan.trim()}` };
      payload.systemInstruction = si?.parts
        ? { ...si, parts: [...si.parts, arahan] }
        : { parts: [arahan] };
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${setelan.model}:generateContent`;
    const res = await fetch(url, {
      method: 'POST',
      // Token dikirim lewat header, bukan query string. Alamat lengkap berikut
      // query-nya ikut tercatat di log perantara; header tidak.
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': token },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      // Log detail asli ke server log (nggak keliatan user, tapi kebaca di Vercel logs)
      // supaya gampang di-debug kalau Gemini balikin error yang shape-nya nggak terduga.
      console.error('[api/ai/generate] Gemini error', res.status, setelan.model, JSON.stringify(data));
      // generativelanguage.googleapis.com KADANG membungkus error dalam array
      // ([{error:{...}}], bukan {error:{...}}). Klien hanya membaca
      // data.error.message, jadi bentuknya diratakan di sini supaya alasan
      // yang dikirim Gemini tidak berubah jadi pesan generik.
      const normalized = Array.isArray(data) ? data[0] : data;
      if (normalized?.error?.message) {
        // Model yang salah ketik / sudah dihentikan adalah kekeliruan
        // pengaturan, bukan kegagalan AI - sebutkan supaya jelas ke mana
        // harus dibetulkan.
        if (res.status === 404) {
          return errJson(
            `Model "${setelan.model}" tidak ditemukan. Betulkan di Admin Panel → Integrations → Pembuat Soal AI.`,
            404,
          );
        }
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
