/**
 * /api/asisten - Asisten "Tanya Platform".
 *
 * Model (Gemini) menjawab pertanyaan tim dengan memanggil ALAT baca yang
 * didefinisikan di sini - ia tidak pernah menulis kueri sendiri. Setiap alat
 * berjalan memakai klien Supabase yang membawa token DB milik penanya
 * (klienSebagaiUser), jadi RLS berlaku persis seperti di layarnya: asisten
 * tidak bisa membuka data yang orang itu tidak boleh lihat.
 *
 * Hemat kuota & egress: kolom dibatasi, baris dibatasi (<= 15 per alat),
 * riwayat obrolan dipotong 8 giliran, dan batas per user (lib/ai-server.ts).
 */
import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { pastikanMasuk } from '@/lib/penjaga-admin';
import { jatahAI, klienSebagaiUser, muatUser, panggilGemini, type IsiGemini, type UserLengkap } from '@/lib/ai-server';
import { PANDUAN, cariPanduan, panduanTeks } from '@/lib/panduan';
import { cariSolusiSerupa } from '@/lib/solusi-serupa';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAKS_PESAN = 1000;
const MAKS_RIWAYAT = 8;
const MAKS_PUTARAN = 4;
const BARIS = 15;

const STATUS_TIKET = ['Waiting Approval', 'Pending', 'Call', 'Onsite', 'In Progress', 'Overdue', 'Solved', 'Rejected'];

/** Tanggal hari ini di WIB, YYYY-MM-DD. */
function hariIniWIB(offset = 0): string {
  const d = new Date(Date.now() + 7 * 3600_000 + offset * 86_400_000);
  return d.toISOString().slice(0, 10);
}

/** Bersihkan isian bebas sebelum masuk filter PostgREST (.or / ilike). */
function bersih(v: unknown, maks = 60): string {
  return String(v ?? '').replace(/[%*,()\\"'`]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, maks);
}
const tglSah = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);

function adalahAtasan(u: UserLengkap): boolean {
  const r = (u.role ?? '').toLowerCase();
  const j = (u.jabatan ?? '').toLowerCase();
  return r === 'admin' || r === 'superadmin' || u.access_level === 'full' || /supervisor|manager|head|kepala/.test(j);
}

const ALAT = [
  {
    name: 'tiket_cari',
    description: 'Cari tiket troubleshooting. Pakai saya=true untuk tiket yang ditangani penanya. Status: ' + STATUS_TIKET.join(', ') + '. aktif=true untuk semua yang belum Solved/Rejected.',
    parameters: { type: 'OBJECT', properties: {
      saya: { type: 'BOOLEAN' }, aktif: { type: 'BOOLEAN' }, status: { type: 'STRING' },
      kata: { type: 'STRING', description: 'kata kunci project / kasus / produk' },
    } },
  },
  {
    name: 'jadwal_cari',
    description: 'Cari jadwal Request Schedule (demo, survey, konfigurasi, training, troubleshooting, maintenance, event). Tanggal format YYYY-MM-DD. Bawaan: hari ini s/d 7 hari ke depan.',
    parameters: { type: 'OBJECT', properties: {
      dari: { type: 'STRING' }, sampai: { type: 'STRING' }, saya: { type: 'BOOLEAN' },
      kategori: { type: 'STRING' }, kata: { type: 'STRING', description: 'nama project / lokasi' },
      terlambat: { type: 'BOOLEAN', description: 'hanya yang lewat tenggat dan belum selesai' },
    } },
  },
  {
    name: 'progres_project',
    description: 'Progres instalasi lokasi project (persentase, status, target selesai, PIC).',
    parameters: { type: 'OBJECT', properties: { kata: { type: 'STRING', description: 'nama project / lokasi' }, saya: { type: 'BOOLEAN' } } },
  },
  {
    name: 'daily_report_saya',
    description: 'Isi Daily Report penanya pada satu tanggal (bawaan hari ini): aktivitas tiket, jadwal, manual.',
    parameters: { type: 'OBJECT', properties: { tanggal: { type: 'STRING' } } },
  },
  {
    name: 'daily_report_tim',
    description: 'Hanya untuk Supervisor/Manager/Admin: siapa anggota Team PTS yang sudah/belum mengisi Daily Report pada tanggal tertentu (bawaan hari ini).',
    parameters: { type: 'OBJECT', properties: { tanggal: { type: 'STRING' } } },
  },
  {
    name: 'solusi_serupa',
    description: 'Cari tiket lama yang sudah Solved dengan kasus mirip beserta catatan penyelesaiannya, dan Tech Note R&D terkait. Pakai untuk pertanyaan "cara mengatasi ...".',
    parameters: { type: 'OBJECT', properties: { kata: { type: 'STRING', description: 'gejala / kasus / produk' } }, required: ['kata'] },
  },
  {
    name: 'panduan_modul',
    description: 'Panduan cara pakai modul platform. Modul: ' + PANDUAN.map(p => `${p.kunci} (${p.judul})`).join(', '),
    parameters: { type: 'OBJECT', properties: { modul: { type: 'STRING' } }, required: ['modul'] },
  },
];

async function jalankanAlat(nama: string, a: Record<string, unknown>, db: SupabaseClient, u: UserLengkap): Promise<unknown> {
  const nm = u.full_name ?? '';
  switch (nama) {
    case 'tiket_cari': {
      let q = db.from('tickets')
        .select('project_name, issue_case, product, status, priority, assign_name, created_at, updated_at')
        .not('is_deleted', 'is', true).order('updated_at', { ascending: false }).limit(BARIS);
      if (a.saya) q = q.eq('assign_name', nm);
      const st = STATUS_TIKET.find(s => s.toLowerCase() === String(a.status ?? '').toLowerCase());
      if (st) q = q.eq('status', st);
      else if (a.aktif) q = q.not('status', 'in', '("Solved","Rejected")');
      const k = bersih(a.kata);
      if (k) q = q.or(`project_name.ilike.%${k}%,issue_case.ilike.%${k}%,product.ilike.%${k}%`);
      const { data, error } = await q;
      return error ? { galat: error.message } : { jumlah: data?.length ?? 0, tiket: data };
    }
    case 'jadwal_cari': {
      const dari = tglSah(a.dari) ?? (a.terlambat ? '2000-01-01' : hariIniWIB());
      const sampai = tglSah(a.sampai) ?? (a.terlambat ? hariIniWIB(-1) : hariIniWIB(7));
      let q = db.from('reminders')
        .select('project_name, category, due_date, due_time, assign_name, status, address, sales_name')
        .not('is_deleted', 'is', true).gte('due_date', dari).lte('due_date', sampai)
        .order('due_date').limit(BARIS);
      if (a.terlambat) q = q.not('status', 'in', '("done","cancelled")');
      if (a.saya) q = q.eq('assign_name', nm);
      const kat = bersih(a.kategori, 40);
      if (kat) q = q.ilike('category', `%${kat}%`);
      const k = bersih(a.kata);
      if (k) q = q.or(`project_name.ilike.%${k}%,address.ilike.%${k}%`);
      const { data, error } = await q;
      return error ? { galat: error.message } : { rentang: `${dari} s/d ${sampai}`, jumlah: data?.length ?? 0, jadwal: data };
    }
    case 'progres_project': {
      let q = db.from('progress_locations')
        .select('name, pic, sales_name, status, progress, start_date, target_date, note')
        .order('target_date', { ascending: true, nullsFirst: false }).limit(BARIS);
      const k = bersih(a.kata);
      if (k) q = q.ilike('name', `%${k}%`);
      if (a.saya) q = q.or(`pic.eq.${bersih(nm, 80)},sales_name.eq.${bersih(nm, 80)}`);
      const { data, error } = await q;
      return error ? { galat: error.message } : { hari_ini: hariIniWIB(), lokasi: data };
    }
    case 'daily_report_saya': {
      const tgl = tglSah(a.tanggal) ?? hariIniWIB();
      const { data, error } = await db.from('daily_reports')
        .select('report_date, ticket_activities, reminder_activities, manual_activities, reminder_notes')
        .eq('user_id', u.id).eq('report_date', tgl).maybeSingle();
      if (error) return { galat: error.message };
      return data ? { tanggal: tgl, ada: true, laporan: data } : { tanggal: tgl, ada: false };
    }
    case 'daily_report_tim': {
      if (!adalahAtasan(u)) return { galat: 'Data tim hanya untuk Supervisor, Manager, atau Admin.' };
      const tgl = tglSah(a.tanggal) ?? hariIniWIB();
      const [{ data: tim }, { data: dr }] = await Promise.all([
        db.from('users').select('id, full_name, jabatan, team_type').ilike('team_type', 'Team PTS%').limit(100),
        db.from('daily_reports').select('user_id').eq('report_date', tgl).limit(200),
      ]);
      const sudah = new Set(((dr ?? []) as { user_id: string }[]).map(r => r.user_id));
      const daftar = ((tim ?? []) as { id: string; full_name: string; jabatan: string | null }[]);
      return {
        tanggal: tgl,
        sudah: daftar.filter(t => sudah.has(t.id)).map(t => t.full_name),
        belum: daftar.filter(t => !sudah.has(t.id)).map(t => `${t.full_name}${t.jabatan ? ` (${t.jabatan})` : ''}`),
      };
    }
    case 'solusi_serupa': {
      const hasil = await cariSolusiSerupa(db, bersih(a.kata, 200), { batas: 5 });
      return hasil;
    }
    case 'panduan_modul': {
      const p = cariPanduan(String(a.modul ?? '')) ?? PANDUAN.find(x => x.judul.toLowerCase().includes(String(a.modul ?? '').toLowerCase()));
      return p ? { panduan: panduanTeks(p) } : { galat: 'Modul tidak dikenal.', modul_tersedia: PANDUAN.map(x => x.kunci) };
    }
    default:
      return { galat: 'Alat tidak dikenal.' };
  }
}

export async function POST(req: NextRequest) {
  const jaga = await pastikanMasuk(req);
  if (!jaga.ok) return NextResponse.json({ ok: false, alasan: jaga.alasan }, { status: jaga.status });

  let body: { pesan?: unknown; riwayat?: unknown; modul?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, alasan: 'Body tidak sah.' }, { status: 400 }); }
  const pesan = String(body.pesan ?? '').trim().slice(0, MAKS_PESAN);
  if (!pesan) return NextResponse.json({ ok: false, alasan: 'Pertanyaan kosong.' }, { status: 400 });

  const u = await muatUser(jaga.user.id);
  if (!u) return NextResponse.json({ ok: false, alasan: 'Akun tidak ditemukan.' }, { status: 401 });
  const tolak = await jatahAI(u.id, 'asisten');
  if (tolak) return NextResponse.json({ ok: false, alasan: tolak }, { status: 429 });

  const riwayat: IsiGemini[] = (Array.isArray(body.riwayat) ? body.riwayat : [])
    .slice(-MAKS_RIWAYAT)
    .map((r: { peran?: string; teks?: string }) => ({
      role: r?.peran === 'model' ? 'model' as const : 'user' as const,
      parts: [{ text: String(r?.teks ?? '').slice(0, MAKS_PESAN) }],
    }))
    .filter(r => (r.parts[0].text as string).length > 0);

  const modul = cariPanduan(typeof body.modul === 'string' ? body.modul : '');
  const hari = new Date(Date.now() + 7 * 3600_000).toLocaleDateString('id-ID', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const sistem = [
    'Kamu adalah Asisten Work Management Platform milik tim PTS IndoVisual.',
    'Jawab dalam Bahasa Indonesia yang ringkas, ramah, dan langsung ke inti. Gunakan daftar berbutir bila ada beberapa item.',
    `Hari ini ${hari} (WIB, ${hariIniWIB()}). Penanya: ${u.full_name ?? u.username}, peran ${u.role ?? '-'}, jabatan ${u.jabatan ?? '-'}, tim ${u.team_type ?? '-'}.`,
    modul ? `Penanya sedang membuka modul: ${modul.judul}.` : '',
    'Untuk data (tiket, jadwal, progres, daily report) SELALU panggil alat; jangan menebak angka atau nama. Bila alat mengembalikan kosong, katakan tidak ada data.',
    'Untuk pertanyaan "cara memakai" platform, panggil panduan_modul. Untuk "cara mengatasi" masalah teknis, panggil solusi_serupa dan sebutkan tiket/tech note sumbernya.',
    'Kamu hanya bisa MEMBACA. Bila diminta mengubah data, jelaskan menu yang harus dibuka.',
    'Jangan menampilkan id internal (uuid). Jangan mengarang fitur yang tidak disebut di panduan.',
  ].filter(Boolean).join('\n');

  const db = klienSebagaiUser(u);
  const isi: IsiGemini[] = [...riwayat, { role: 'user', parts: [{ text: pesan }] }];
  const dipakai: string[] = [];

  for (let putaran = 0; putaran < MAKS_PUTARAN; putaran++) {
    const h = await panggilGemini({ sistem, isi, alat: ALAT, suhu: 0.2 });
    if (!h.ok || !h.parts) return NextResponse.json({ ok: false, alasan: h.alasan ?? 'AI gagal menjawab.' }, { status: 502 });

    const panggilan = h.parts.filter(p => p.functionCall);
    if (panggilan.length === 0) {
      const jawaban = h.parts.map(p => p.text ?? '').join('').trim();
      return NextResponse.json({ ok: true, jawaban: jawaban || 'Maaf, saya belum bisa menjawab itu. Coba tanyakan dengan kata lain.', alat: dipakai });
    }

    isi.push({ role: 'model', parts: h.parts as Record<string, unknown>[] });
    const respons = await Promise.all(panggilan.map(async p => {
      const fc = p.functionCall!;
      dipakai.push(fc.name);
      let hasil: unknown;
      try { hasil = await jalankanAlat(fc.name, fc.args ?? {}, db, u); }
      catch (e) { hasil = { galat: (e as Error).message }; }
      return { functionResponse: { name: fc.name, response: { hasil } } };
    }));
    isi.push({ role: 'user', parts: respons });
  }
  return NextResponse.json({ ok: true, jawaban: 'Pertanyaannya butuh terlalu banyak langkah. Coba persempit, misalnya sebutkan nama project atau tanggalnya.', alat: dipakai });
}
