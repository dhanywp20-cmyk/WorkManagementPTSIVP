/**
 * /api/tools-team/perbandingan - Product Comparison (battle card) Tools Team, mode otomatis.
 *
 *   POST { bahasa, produk: [{ nama, berkas, halaman: string[] }] }   (produk[0] = unggulan / RECOMMENDED)
 *     -> { ok, data: KartuBanding, dicek, terpangkas }
 *
 * Alur data (jujur):
 *   - Berkas brosur TIDAK pernah sampai ke server ini: teksnya diekstrak di peramban (pdf.js), yang dikirim
 *     hanya teks per halaman.
 *   - Teks itu diteruskan ke Google Gemini (token Admin Panel → Integrations, sama dengan Asisten AI) untuk
 *     disusun menjadi perbandingan. Kebijakan data Google berlaku; layanan Gemini gratis dapat memakai isi
 *     permintaan untuk peningkatan layanannya - UI memberi tahu pengguna sebelum mengirim.
 *   - Tidak ada yang disimpan: tidak ke Supabase Storage, tidak ke tabel (kecuali satu baris jatah pemakaian
 *     ai_pakai_log berisi user & nama fitur, tanpa isi), tidak ke berkas sementara. Isi brosur & token tidak
 *     pernah ditulis ke log.
 *   - PDF dibuat di peramban (pdfmake) dari hasil yang sudah diperiksa pengguna.
 */
import { NextRequest, NextResponse } from 'next/server';
import { pastikanMasuk } from '@/lib/penjaga-admin';
import { getAdminClient } from '@/lib/supabase-admin';
import { jatahAI, panggilGemini } from '@/lib/ai-server';
import { bolehPerbandingan, periksaHasil } from '@/lib/perbandingan';
import { ambilJson, periksaKiriman, promptPengguna, promptSistem, SKEMA_GEMINI, teksBertanda } from '@/lib/perbandingan-prompt';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
/** Vercel Hobby: maks 60 detik; Gemini dibatasi 52 detik supaya jawaban galat sempat terkirim. */
export const maxDuration = 60;

const MAKS_BODY = 900_000;
const gagal = (alasan: string, status = 400) => NextResponse.json({ ok: false, alasan }, { status });

export async function POST(req: NextRequest) {
  const jaga = await pastikanMasuk(req);
  if (!jaga.ok) return gagal(jaga.alasan, jaga.status);
  const { data: u } = await getAdminClient().from('users').select('role, allowed_menus, pimpinan').eq('id', jaga.user.id).maybeSingle();
  if (!bolehPerbandingan(u as Parameters<typeof bolehPerbandingan>[0])) return gagal('Product Comparison hanya untuk akun yang diberi akses AV Solution Tools.', 403);

  const mentah = await req.text();
  if (mentah.length > MAKS_BODY) return gagal('Teks brosur terlalu besar untuk diproses sekaligus.', 413);
  let body: unknown;
  try { body = JSON.parse(mentah); } catch { return gagal('Format permintaan tidak sah.'); }
  const k = periksaKiriman(body);
  if (!k.ok) return gagal(k.alasan);

  //  Jatah pemakaian AI bersama (per jam / per hari per orang) - mencegah biaya / kuota tak terkendali.
  const tolak = await jatahAI(jaga.user.id, 'product-comparison');
  if (tolak) return gagal(tolak, 429);

  const pesan = promptPengguna(k.produk);
  const h = await panggilGemini({
    sistem: promptSistem(k.bahasa), isi: [{ role: 'user', parts: [{ text: pesan.teks }] }],
    suhu: 0.1, maksToken: 16_000, json: true, skema: SKEMA_GEMINI, batasMs: 52_000,
  });
  if (!h.ok) return gagal(h.alasan ?? 'AI gagal menjawab.', 502);
  const jawaban = (h.parts ?? []).map(p => p.text ?? '').join('');
  const json = ambilJson(jawaban);
  if (!json) {
    //  Alasan berhenti saja (tanpa isi) - cukup untuk tahu terpotong / diblokir / kosong.
    const sebab = h.selesai === 'MAX_TOKENS' ? 'jawaban terpotong (brosur terlalu panjang - kurangi halaman / produk)'
      : h.selesai && h.selesai !== 'STOP' ? `dihentikan Gemini (${h.selesai})` : jawaban.trim() ? 'bukan JSON yang sah' : 'jawaban kosong';
    return gagal(`Jawaban AI tidak bisa dipakai: ${sebab}. Coba lagi, atau pakai mode "AI chat lain".`, 502);
  }
  //  Kutipan diverifikasi terhadap teks yang SAMA dengan yang dikirim ke AI.
  const sumber = k.produk.map(p => teksBertanda(p).teks);
  const hasil = periksaHasil(json, sumber, k.bahasa);
  if (!hasil.ok) return gagal(`Hasil AI tidak sesuai template: ${hasil.alasan}`, 502);
  return NextResponse.json({ ok: true, data: hasil.data, dicek: hasil.dicek, terpangkas: pesan.terpangkas });
}
