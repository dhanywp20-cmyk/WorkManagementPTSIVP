import { NextRequest, NextResponse } from 'next/server';
import { NO_STORE, ambilAkun, buatChecklist, galat } from '@/lib/checklist-server';
import { daftarId } from '@/lib/checklist-isian';
import { triggersProjectProgress } from '@/lib/project-progress-sync';
import { BATAS } from '@/lib/checklist';

export const dynamic = 'force-dynamic';

/**
 * POST /api/project-progress/sinkron { reminderIds } - jembatan Request
 * Schedule -> Project Progress. Dipanggil sesudah reminder kategori
 * Konfigurasi dibuat / disetujui.
 *
 * Yang dikirim klien HANYA id reminder; isinya dibaca ulang di server,
 * jadi nama proyek, Sales, dan penangan tidak bisa dipalsukan dari peramban.
 *
 * Pemetaan (snapshot saat reminder dibuat - sesudahnya kedua sisi mandiri):
 *   project_name          -> proyek (dicocokkan tanpa beda besar-kecil huruf)
 *   sales_name / division -> Sales proyek baru
 *   address               -> nama checklist lokasi (bisa diganti admin)
 *   assign_name           -> anggota checklist (dicocokkan ke akun)
 *   progress_start/target -> jadwal checklist
 * Isi checklist sengaja kosong: diimpor atau disalin menyusul.
 */
interface Reminder {
  id: string;
  project_name: string | null;
  address: string | null;
  sales_name: string | null;
  sales_division: string | null;
  assign_name: string | null;
  category: string | null;
  progress_start_date: string | null;
  progress_target_date: string | null;
  batch_id: string | null;
  is_deleted: boolean | null;
}

function normal(v: string | null | undefined): string {
  return (v ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
}

export async function POST(request: NextRequest) {
  const s = await ambilAkun(request);
  if ('galat' in s) return s.galat;
  const { db, akun } = s;

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return galat('Permintaan tidak terbaca.'); }
  const ids = daftarId(body.reminderIds).slice(0, 100);
  const out = { created: 0, skipped: 0, errors: [] as string[] };
  if (!ids.length) return NextResponse.json(out, { headers: NO_STORE });

  const { data: rem, error } = await db.from('reminders')
    .select('id,project_name,address,sales_name,sales_division,assign_name,category,progress_start_date,progress_target_date,batch_id,is_deleted')
    .in('id', ids);
  if (error) return galat(error.message, 500);

  const relevanSemua = ((rem ?? []) as Reminder[]).filter(r => !r.is_deleted && triggersProjectProgress(r.category));
  // Satu jadwal multi-tanggal (batch) = SATU lokasi per penangan, bukan satu per hari.
  const dipakai = new Set<string>();
  const relevan = relevanSemua.filter(r => {
    if (!r.batch_id) return true;
    const kunci = `${r.batch_id}::${r.assign_name ?? ''}`;
    if (dipakai.has(kunci)) return false;
    dipakai.add(kunci);
    return true;
  });
  out.skipped += ids.length - relevan.length;
  if (!relevan.length) return NextResponse.json(out, { headers: NO_STORE });

  const [{ data: sudahAda }, { data: proyekAda }] = await Promise.all([
    db.from('checklist_daftar').select('source_reminder_id').in('source_reminder_id', relevan.map(r => r.id)),
    db.from('checklist_proyek').select('id,nama'),
  ]);
  const terpakai = new Set(((sudahAda ?? []) as { source_reminder_id: string }[]).map(r => r.source_reminder_id));
  const petaProyek = new Map<string, string>();
  for (const p of (proyekAda ?? []) as { id: string; nama: string }[]) {
    const k = normal(p.nama);
    if (k && !petaProyek.has(k)) petaProyek.set(k, p.id);
  }

  for (const r of relevan) {
    if (terpakai.has(r.id)) { out.skipped++; continue; }
    const namaProyek = (r.project_name ?? '').trim().slice(0, BATAS.judul);
    if (!namaProyek) { out.skipped++; continue; }
    try {
      let proyekId = petaProyek.get(normal(namaProyek));
      if (!proyekId) {
        const { data: p, error: pErr } = await db.from('checklist_proyek').insert({
          nama: namaProyek, status: 'in_progress',
          sales_name: r.sales_name || null, sales_division: r.sales_division || null,
          start_date: r.progress_start_date, target_date: r.progress_target_date,
          origin: 'auto_reminder', source_reminder_id: r.id,
          dibuat_oleh: akun.id, dibuat_oleh_nama: akun.nama,
        }).select('id').single();
        if (pErr || !p) throw new Error(pErr?.message ?? 'Proyek gagal dibuat');
        proyekId = p.id as string;
        petaProyek.set(normal(namaProyek), proyekId);
      }

      let anggota: string[] = [];
      if (r.assign_name) {
        const { data: u } = await db.from('users').select('id').eq('full_name', r.assign_name.trim()).limit(1);
        anggota = ((u ?? []) as { id: string }[]).map(x => x.id);
      }

      await buatChecklist(db, proyekId, {
        judul: ((r.address ?? '').trim() || 'Lokasi baru').slice(0, BATAS.judul),
        keterangan: `Dibuat otomatis dari Request Schedule (${r.category}). Isi checklist diimpor atau disalin menyusul.`,
        start_date: r.progress_start_date, target_date: r.progress_target_date,
        sumber: 'reminder', anggota, origin: 'auto_reminder', source_reminder_id: r.id,
      }, null, akun, { baseUrl: request.nextUrl.origin });
      out.created++;
    } catch (e) {
      const pesan = e instanceof Error ? e.message : String(e);
      // Index unik menolak sinkron ganda yang berjalan bersamaan - itu memang diinginkan.
      if (pesan.toLowerCase().includes('duplicate')) out.skipped++;
      else out.errors.push(`"${namaProyek}": ${pesan}`);
    }
  }

  return NextResponse.json(out, { headers: NO_STORE });
}
