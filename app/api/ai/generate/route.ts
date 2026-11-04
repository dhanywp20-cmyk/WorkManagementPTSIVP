import { NextRequest, NextResponse } from 'next/server';
import { bacaRahasia } from '@/lib/rahasia-server';
import { pastikanMasuk } from '@/lib/penjaga-admin';
import { ambilPengaturanAI, ambilPengaturanPenilai } from '@/lib/ai-pengaturan';

const MAX_BODY_BYTES = 4_000_000;

function errJson(message: string, status: number) {
  return NextResponse.json({ error: { message } }, { status });
}

export async function POST(request: NextRequest) {
  const jaga = await pastikanMasuk(request);
  if (!jaga.ok) return errJson(jaga.alasan, jaga.status);
  try {
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

    const b = body as Record<string, unknown>;
    if (!b || typeof b !== 'object' || !Array.isArray(b.contents)) {
      return errJson('Format permintaan tidak valid.', 400);
    }
    const penilai = b.profil === 'penilai';
    const [tokenKhusus, tokenUmum, setelan] = await Promise.all([
      penilai ? bacaRahasia('ai.gemini_token_koreksi') : Promise.resolve(null),
      bacaRahasia('ai.gemini_token'),
      penilai ? ambilPengaturanPenilai() : ambilPengaturanAI(),
    ]);
    const token = tokenKhusus || tokenUmum;

    if (!token) {
      return errJson(
        penilai
          ? 'Penilai AI belum aktif. Admin dapat mengisi Token AI Koreksi di Admin Panel → Integrations.'
          : 'Pembuat soal AI belum aktif. Admin dapat mengisi Token AI di Admin Panel → Integrations.',
        503,
      );
    }

    const modelPermintaan = typeof b.model === 'string' && /^[A-Za-z0-9._-]{1,80}$/.test(b.model.trim())
      ? b.model.trim() : '';
    const model = modelPermintaan || setelan.model;

    const payload: Record<string, unknown> = { contents: b.contents };
    if (b.generationConfig)  payload.generationConfig  = b.generationConfig;
    if (b.systemInstruction) payload.systemInstruction = b.systemInstruction;
    if (b.safetySettings)    payload.safetySettings     = b.safetySettings;

    const gc = (payload.generationConfig ?? {}) as Record<string, unknown>;
    if (gc.temperature === undefined) {
      payload.generationConfig = { ...gc, temperature: setelan.suhu };
    }

    if (setelan.arahan.trim()) {
      const si = payload.systemInstruction as { parts?: { text?: string }[] } | undefined;
      const arahan = { text: `\n\nARAHAN TAMBAHAN DARI ADMIN:\n${setelan.arahan.trim()}` };
      payload.systemInstruction = si?.parts
        ? { ...si, parts: [...si.parts, arahan] }
        : { parts: [arahan] };
    }

    const panggil = async (m: string) => {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': token },
        body: JSON.stringify(payload),
      });
      return { res: r, data: await r.json() };
    };
    let { res, data } = await panggil(model);
    const pesanGalat = () => String((Array.isArray(data) ? data[0] : data)?.error?.message ?? '');
    const bawaGambar = /"(inlineData|inline_data|fileData|file_data)"/.test(JSON.stringify(b.contents ?? ''));
    const tolakGambar = () => !res.ok && res.status === 400 && bawaGambar && /modality|image input/i.test(pesanGalat());
    if (tolakGambar() && setelan.model && setelan.model !== model) {
      console.warn('[api/ai/generate] model tanpa dukungan gambar, dicoba ulang dengan model bawaan', model, '->', setelan.model);
      ({ res, data } = await panggil(setelan.model));
    }
    if (tolakGambar()) {
      return errJson(
        `Model "${model}" tidak bisa membaca gambar. Pilih model lain ${penilai ? 'di bilah "Penilai AI"' : 'di Admin Panel → Integrations'} ` +
        `(model "flash" umumnya mendukung gambar), atau kirim tanpa gambar.`,
        400,
      );
    }
    if (!res.ok) {
      console.error('[api/ai/generate] Gemini error', res.status, model, JSON.stringify(data));
      const normalized = Array.isArray(data) ? data[0] : data;
      if (normalized?.error?.message) {
        if (res.status === 429) {
          return errJson(
            penilai
              ? `Jatah harian model "${model}" habis. Jatah dihitung per model, jadi pilih model lain di daftar "Penilai AI" di atas — jatahnya masih utuh. Model ringan (flash-lite) biasanya paling longgar. Bisa juga nilai manual: saran AI memang tidak pernah jadi nilai akhir.`
              : `Jatah harian model "${model}" habis. Jatah dihitung per model — pilih model lain di Admin Panel → Integrations, jatahnya terpisah. Model ringan (flash-lite) biasanya paling longgar.`,
            429,
          );
        }
        if (res.status === 404) {
          return errJson(
            `Model "${model}" tidak ada pada token ini (bukan soal jatah habis). ` +
            `Pilih dari daftar model ${penilai ? 'di bilah "Penilai AI"' : 'di Admin Panel → Integrations'} — ` +
            `daftarnya dibaca langsung dari Google, jadi isinya pasti tersedia.`,
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
