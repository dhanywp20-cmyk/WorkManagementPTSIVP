import { NextRequest, NextResponse } from 'next/server';
import { NO_STORE, akunLihatSemua, ambilAkun, galat } from '@/lib/checklist-server';
import { jatahAI, panggilGemini } from '@/lib/ai-server';

export const dynamic = 'force-dynamic';
// Membaca PDF wiring diagram + foto rak bisa lebih dari 30 detik (batas umum
// route API di vercel.json). Route ini diberi entri khusus 60 detik di sana.
export const maxDuration = 60;

/**
 * POST /api/project-progress/ai-checklist - susun checklist pekerjaan dari
 * wiring diagram, foto/layout rak, dan daftar perangkat memakai model AI
 * platform (Gemini, token & model dari Admin Panel).
 *
 * multipart:
 *   berkas     PDF / PNG / JPG / WEBP (boleh beberapa) - dikirim apa adanya ke AI
 *   lampiran   teks (boleh beberapa) - mis. daftar perangkat Excel yang sudah
 *              diubah ke CSV di peramban
 *   instruksi  teks bebas tambahan dari pengguna (opsional)
 *
 * Hasilnya HANYA teks Markdown berformat impor checklist; tidak ada yang
 * disimpan di sini. Pengguna memeriksa & mengedit dulu di layar impor, lalu
 * menyimpannya lewat jalur impor biasa. Berkas tidak disimpan ke Supabase
 * (hemat penyimpanan & egress paket gratis).
 */

const JENIS_BERKAS = new Set(['application/pdf', 'image/png', 'image/jpeg', 'image/webp']);
// Vercel menolak body di atas ~4,5 MB; sisakan ruang untuk teks & kerangka multipart.
const BATAS_TOTAL = 4 * 1024 * 1024;
const BATAS_JUMLAH = 6;
const BATAS_TEKS = 60_000;

const SISTEM = `Anda insinyur instalasi & konfigurasi audio visual (AV) / smart meeting room yang berpengalaman.
Dari dokumen terlampir (wiring diagram, foto/layout rak, daftar perangkat, catatan), susun CHECKLIST PEKERJAAN instalasi dan konfigurasi untuk SATU ruangan, dipakai teknisi di lapangan.

ATURAN ISI:
- Kelompokkan PER PRODUK / PERANGKAT. Semua pekerjaan satu perangkat (pasang, kabel, setting, tes) berada di SATU bagian. Jangan memecah satu perangkat ke beberapa bagian, dan jangan membuat bagian per tahap (instalasi/kabel/konfigurasi/uji) yang mencampur banyak perangkat.
- Urutan bagian: "1. Persiapan", "2. Rak, Jaringan & UPS", lalu satu bagian per perangkat atau sistem (perangkat sejenis digabung, mis. "Display Signage x3"; sistem yang menyatu digabung, mis. "Audio: DSP, Amplifier & Speaker"), terakhir "Serah Terima".
- Tiap bagian 3 sampai 5 item. Item singkat (maksimal sekitar 10 kata), berupa pekerjaan yang bisa dicentang. Tanpa penjelasan panjang.
- Cantumkan IP di judul bagian bila terlihat di dokumen, mis. "## 6. Kamera Aver (.90)". Tulis segmen jaringan sekali di keterangan.
- HANYA perangkat yang benar-benar ada di dokumen. Jangan mengarang model, jumlah, port, atau IP.
- Bila ada yang tidak jelas atau saling bertentangan antar dokumen, tulis satu baris "Catatan: ..." tepat di bawah judul bagian terkait.
- Tanpa tabel. Urutan rak cukup satu kalimat di bawah judul bagian rak.
- Bahasa Indonesia yang lugas.

FORMAT KELUARAN - Markdown SAJA, tanpa \`\`\` dan tanpa kalimat pembuka/penutup:
# <Judul checklist: jenis pekerjaan - nama ruangan/proyek bila terlihat>
<satu kalimat keterangan singkat>

## 1. Persiapan
- [ ] <item>

## 2. Rak, Jaringan & UPS
<satu kalimat urutan rak, bila ada>
- [ ] <item>

## 3. <Nama perangkat> (<IP bila ada>)
- [ ] <item>`;

export async function POST(request: NextRequest) {
  const s = await ambilAkun(request);
  if ('galat' in s) return s.galat;
  // Admin & tim internal (yang mengerjakan & mengisi checklist). Sales tidak.
  if (!akunLihatSemua(s.akun)) return galat('Fitur AI checklist untuk admin dan tim.', 403);

  let form: FormData;
  try { form = await request.formData(); } catch { return galat('Unggahan tidak terbaca. Pastikan total berkas di bawah 4 MB.'); }

  const berkas = form.getAll('berkas').filter((b): b is File => b instanceof File && b.size > 0);
  const lampiran = form.getAll('lampiran').map(v => String(v)).filter(Boolean);
  const instruksi = String(form.get('instruksi') ?? '').trim().slice(0, 2000);

  if (!berkas.length && !lampiran.length) return galat('Lampirkan minimal satu berkas: wiring diagram, foto rak, atau daftar perangkat.');
  if (berkas.length > BATAS_JUMLAH) return galat(`Maksimal ${BATAS_JUMLAH} berkas sekali proses.`);
  const total = berkas.reduce((n, b) => n + b.size, 0);
  if (total > BATAS_TOTAL) return galat('Total berkas melebihi 4 MB. Kecilkan PDF / gambar, atau kirim sebagian dulu.');
  for (const b of berkas) {
    if (!JENIS_BERKAS.has(b.type)) return galat(`"${b.name}" tidak didukung. Pakai PDF, PNG, JPG, atau WEBP.`);
  }
  const teksLampiran = lampiran.join('\n\n').slice(0, BATAS_TEKS);

  // Jatah dicatat sesudah isian lolos - unggahan yang salah tidak memakan kuota.
  const ditolak = await jatahAI(s.akun.id, 'checklist-ai');
  if (ditolak) return galat(ditolak, 429);

  const parts: Record<string, unknown>[] = [];
  for (const b of berkas) {
    parts.push({ text: `Berkas: ${b.name}` });
    parts.push({ inlineData: { mimeType: b.type, data: Buffer.from(await b.arrayBuffer()).toString('base64') } });
  }
  if (teksLampiran) parts.push({ text: `Lampiran teks (daftar perangkat / catatan):\n${teksLampiran}` });
  parts.push({
    text: `Susun checklist pekerjaan sesuai aturan.${instruksi ? `\n\nInstruksi tambahan dari pengguna (ikuti selama tidak melanggar format):\n${instruksi}` : ''}`,
  });

  const hasil = await panggilGemini({ sistem: SISTEM, isi: [{ role: 'user', parts }], suhu: 0.2, maksToken: 8192 });
  if (!hasil.ok) return galat(hasil.alasan ?? 'AI gagal menjawab.', 502);

  const markdown = (hasil.parts ?? []).map(p => p.text ?? '').join('')
    .replace(/^\s*```(?:markdown|md)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
  if (!/^\s*[-*]\s+\[\s*\]/m.test(markdown)) {
    return galat('AI tidak menghasilkan checklist. Coba lagi, atau lampirkan dokumen yang lebih jelas.', 502);
  }
  return NextResponse.json({ markdown }, { headers: NO_STORE });
}
