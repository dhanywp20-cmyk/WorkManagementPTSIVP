/**
 * /api/asisten/draf-daily-report - susun "Ringkasan hari ini" Daily Report
 * dari aktivitas yang sudah ada di form (tiket, jadwal, manual).
 *
 * Datanya dikirim peramban dari form yang sedang dibuka (sudah terfilter hak
 * aksesnya di sana) dan dipangkas di sini; AI hanya MERANGKUM, tidak menambah
 * fakta. Hasilnya draf - user memeriksa sebelum menyimpan.
 */
import { NextRequest, NextResponse } from 'next/server';
import { pastikanMasuk } from '@/lib/penjaga-admin';
import { jatahAI, panggilGemini } from '@/lib/ai-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const potong = (v: unknown, n = 300) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n);

export async function POST(req: NextRequest) {
  const jaga = await pastikanMasuk(req);
  if (!jaga.ok) return NextResponse.json({ ok: false, alasan: jaga.alasan }, { status: jaga.status });

  let b: { tanggal?: unknown; jadwal?: unknown[]; tiket?: unknown[]; manual?: unknown[] };
  try { b = await req.json(); } catch { return NextResponse.json({ ok: false, alasan: 'Body tidak sah.' }, { status: 400 }); }
  const arr = (x: unknown) => (Array.isArray(x) ? x.slice(0, 20) : []) as Record<string, unknown>[];
  const jadwal = arr(b.jadwal).map(r => `- [Jadwal ${potong(r.category, 40)}] ${potong(r.project_name, 120)}${r.address ? ` @ ${potong(r.address, 120)}` : ''} (status ${potong(r.status, 20)})`);
  const tiket = arr(b.tiket).map(t => `- [Tiket] ${potong(t.project_name, 120)}: ${potong(t.issue_case, 160)} → ${potong(t.action_taken, 300)} (status ${potong(t.new_status, 20)})`);
  const manual = arr(b.manual).filter(m => potong(m.project_name) || potong(m.description))
    .map(m => `- [${potong(m.category, 40)}] ${potong(m.project_name, 120)}${m.address ? ` @ ${potong(m.address, 120)}` : ''}: ${potong(m.description, 300)}`);
  const semua = [...jadwal, ...tiket, ...manual];
  if (semua.length === 0) return NextResponse.json({ ok: false, alasan: 'Belum ada aktivitas untuk dirangkum. Tambahkan aktivitas manual dulu.' }, { status: 400 });

  const tolak = await jatahAI(jaga.user.id, 'draf_daily_report');
  if (tolak) return NextResponse.json({ ok: false, alasan: tolak }, { status: 429 });

  const h = await panggilGemini({
    sistem: [
      'Kamu menyusun ringkasan Daily Report teknisi/tim PTS IndoVisual dalam Bahasa Indonesia.',
      'Tulis 3-6 butir singkat diawali "- ": apa yang dikerjakan, hasil/status, dan kendala atau tindak lanjut bila tersirat.',
      'HANYA pakai fakta dari daftar aktivitas. Jangan menambah nama, angka, atau kejadian baru. Tanpa pembuka/penutup.',
    ].join('\n'),
    isi: [{ role: 'user', parts: [{ text: `Tanggal: ${potong(b.tanggal, 20)}\nAktivitas:\n${semua.join('\n')}` }] }],
    suhu: 0.2, maksToken: 500,
  });
  if (!h.ok || !h.parts) return NextResponse.json({ ok: false, alasan: h.alasan ?? 'AI gagal.' }, { status: 502 });
  const draf = h.parts.map(p => p.text ?? '').join('').trim();
  return NextResponse.json({ ok: true, draf });
}
