/**
 * /api/ai/model - daftar model yang BENAR-BENAR tersedia untuk kunci ini.
 *
 * Ada karena satu kekeliruan yang terulang: nama model ditebak, tidak
 * diperiksa. Nama yang salah tidak gagal saat disimpan - ia gagal nanti, saat
 * seseorang menekan "Nilai", dengan pesan 404 yang tidak menyebut nama mana
 * yang keliru. Daftar model juga berbeda antar kunci dan antar wilayah, dan
 * Google mengganti maupun menghentikannya tanpa pemberitahuan.
 *
 * Jadi daftarnya ditanyakan, bukan ditulis di kode. Yang tampil di layar
 * adalah apa yang bisa dipakai kunci itu hari ini.
 *
 * Tokennya tetap di server. Yang dikirim ke peramban hanya nama-nama model.
 */
import { NextRequest, NextResponse } from 'next/server';
import { bacaRahasia } from '@/lib/rahasia-server';

interface ModelGoogle {
  name?: string;
  displayName?: string;
  description?: string;
  supportedGenerationMethods?: string[];
}

export async function GET(request: NextRequest) {
  try {
    const penilai = request.nextUrl.searchParams.get('profil') === 'penilai';

    // Sama seperti /api/ai/generate: token penilai yang kosong jatuh ke token
    // pembuat soal, supaya daftarnya tetap muncul di pemasangan yang belum
    // memisahkan tokennya.
    const [khusus, umum] = await Promise.all([
      penilai ? bacaRahasia('ai.gemini_token_koreksi') : Promise.resolve(null),
      bacaRahasia('ai.gemini_token'),
    ]);
    const token = khusus || umum;
    if (!token) {
      return NextResponse.json(
        { error: { message: 'Token AI belum diisi di Admin Panel → Integrations.' } },
        { status: 503 },
      );
    }

    const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=200', {
      headers: { 'x-goog-api-key': token },
      // Daftar model jarang berubah dalam hitungan menit, tapi sering dalam
      // hitungan minggu. Satu jam cukup menahan panggilan beruntun tanpa
      // membuat model baru terasa tidak pernah muncul.
      next: { revalidate: 3600 },
    });
    const data = await res.json();
    if (!res.ok) {
      const pesan = (Array.isArray(data) ? data[0] : data)?.error?.message
        ?? `Gagal membaca daftar model (HTTP ${res.status}).`;
      return NextResponse.json({ error: { message: pesan } }, { status: res.status });
    }

    const model = ((data?.models ?? []) as ModelGoogle[])
      // Hanya model yang bisa dipakai membuat teks. Daftar mentahnya juga
      // memuat model penyematan dan pembuat gambar - memilihnya di sini akan
      // gagal dengan pesan yang membingungkan.
      .filter(m => (m.supportedGenerationMethods ?? []).includes('generateContent'))
      .map(m => ({
        // Google mengembalikan "models/gemini-2.5-flash"; yang dipakai di URL
        // permintaan hanya bagian setelah garis miring.
        id: (m.name ?? '').replace(/^models\//, ''),
        nama: m.displayName || (m.name ?? '').replace(/^models\//, ''),
      }))
      .filter(m => m.id)
      .sort((a, b) => a.id.localeCompare(b.id));

    return NextResponse.json({ model });
  } catch (e) {
    console.error('[api/ai/model]', e);
    return NextResponse.json(
      { error: { message: 'Gagal menghubungi Google: ' + (e instanceof Error ? e.message : String(e)) } },
      { status: 500 },
    );
  }
}
