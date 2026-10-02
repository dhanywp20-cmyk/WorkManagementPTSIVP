import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendWA } from '@/lib/wa';
import '@/lib/wa-server';
import { kirimPushKeUser } from '@/lib/web-push-server';
import { bacaRahasia } from '@/lib/rahasia-server';
import { bacaPengaturan } from '@/lib/notifikasi/pengaturan';

export const dynamic = 'force-dynamic';

/**
 * /api/cron/digest - ringkasan tenggat harian per orang, lewat WhatsApp.
 * Mencakup target Project Progress, jadwal reminder, dan garansi yang habis.
 *
 * Prinsip yang dijaga:
 *   - Satu pesan per orang, bukan satu per item. Sepuluh notifikasi terpisah
 *     berakhir diabaikan; satu ringkasan dibaca.
 *   - Tidak mengirim apa pun kepada orang yang tidak punya tenggat. Pesan
 *     "tidak ada apa-apa hari ini" melatih orang mengabaikan pengirimnya.
 *   - Hanya melihat ke depan sampai H+3, dan ke belakang untuk yang lewat.
 */

/** Berapa hari ke depan yang dianggap "mendekat". */
const HARI_KE_DEPAN = 3;

function berwenang(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  if (request.headers.get('authorization') === `Bearer ${secret}`) return true;
  if (request.headers.get('x-cron-secret') === secret) return true;
  return false;
}

/*
  Tanggal WIB, bukan UTC. Cron ini berjalan 23:00 UTC = 06:00 WIB; dengan
  tanggal UTC, "hari ini" di pesan pagi sebenarnya kemarin - tenggat hari ini
  terbaca "besok" dan yang kemarin belum dihitung terlambat.
*/
function tanggalISO(offsetHari: number): string {
  return new Date(Date.now() + 7 * 3600_000 + offsetHari * 86_400_000).toISOString().slice(0, 10);
}
/** 0 = Minggu ... 6 = Sabtu, untuk tanggal ISO. */
const hariDari = (iso: string) => new Date(iso + 'T00:00:00Z').getUTCDay();

function labelTanggal(iso: string): string {
  const hariIni = tanggalISO(0);
  const besok   = tanggalISO(1);
  if (iso === hariIni) return 'HARI INI';
  if (iso === besok)   return 'besok';
  if (iso < hariIni) {
    const lewat = Math.round(
      (new Date(hariIni).getTime() - new Date(iso).getTime()) / 86400000,
    );
    return `TERLAMBAT ${lewat} hari`;
  }
  return new Date(iso + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
}

/** ringan = pengingat rutin (DR belum diisi, tiket aktif): cukup push +
 *  Telegram. WA hanya untuk tenggat sungguhan & blok atasan - nomor gateway
 *  pernah ditandai spam, jangan kirim WA harian ke semua orang. */
interface Item { label: string; tanggal: string; terlambat: boolean; ringan?: boolean }

async function jalankan() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    //  Lihat catatan di lib/supabase-admin.ts: tanpa cache:'no-store' di sini,
    //  digest cron ini bisa mengirim rekap tiket yang sama berulang-ulang -
    //  dibekukan sejak jadwal pertama route ini jalan setelah deploy.
    { global: { fetch: (input, init) => fetch(input, { ...init, cache: 'no-store' }) } },
  );

  const hariIni = tanggalISO(0);
  const batas   = tanggalISO(HARI_KE_DEPAN);

  // nama lengkap  daftar tenggat miliknya
  const perOrang = new Map<string, Item[]>();
  const catat = (nama: string | null | undefined, item: Item) => {
    const n = (nama ?? '').trim();
    if (!n) return;
    const arr = perOrang.get(n) ?? [];
    arr.push(item);
    perOrang.set(n, arr);
  };

  // Lokasi Project Progress yang targetnya mendekat / lewat
  //  Yang sudah selesai dilewati: mengingatkan target pada pekerjaan yang
  //  sudah rampung hanya membuat kiriman ini terasa tidak akurat.
  //  (Project Progress berbasis checklist: satu checklist = satu lokasi.)
  const { data: lokasi } = await supabase
    .from('checklist_daftar')
    .select('id, judul, target_date, proyek_id')
    .not('target_date', 'is', null)
    .lte('target_date', batas);
  const daftarLokasi = (lokasi ?? []) as { id: string; judul: string; target_date: string; proyek_id: string }[];
  const idLokasi = daftarLokasi.map(l => l.id);
  const [{ data: itemLokasi }, { data: anggotaLokasi }, { data: proyekLokasi }] = idLokasi.length
    ? await Promise.all([
        supabase.from('checklist_item').select('daftar_id, selesai, kendala').in('daftar_id', idLokasi).limit(20000),
        supabase.from('checklist_anggota').select('daftar_id, nama').in('daftar_id', idLokasi),
        supabase.from('checklist_proyek').select('id, nama, sales_name, status')
          .in('id', Array.from(new Set(daftarLokasi.map(l => l.proyek_id)))),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }];
  const petaProyekLokasi = new Map(((proyekLokasi ?? []) as { id: string; nama: string; sales_name: string | null; status: string }[]).map(p => [p.id, p]));

  for (const l of daftarLokasi) {
    const p = petaProyekLokasi.get(l.proyek_id);
    if (!p || p.status === 'done') continue;
    const it = ((itemLokasi ?? []) as { daftar_id: string; selesai: boolean; kendala: boolean }[]).filter(i => i.daftar_id === l.id);
    const selesai = it.filter(i => i.selesai).length;
    if (it.length > 0 && selesai === it.length) continue;
    const kendala = it.filter(i => i.kendala && !i.selesai).length;
    const item: Item = {
      label: `📊 ${p.nama} · ${l.judul} - ${selesai}/${it.length} item${kendala ? `, ${kendala} kendala` : ''}`,
      tanggal: l.target_date,
      terlambat: l.target_date < hariIni,
    };
    const anggota = ((anggotaLokasi ?? []) as { daftar_id: string; nama: string }[]).filter(a => a.daftar_id === l.id).map(a => a.nama);
    for (const n of anggota) catat(n, item);
    // Sales ikut diberi tahu hanya bila ia bukan anggotanya sendiri, supaya
    // tidak menerima baris yang sama dua kali.
    if (p.sales_name && !anggota.includes(p.sales_name)) catat(p.sales_name, item);
  }

  // Reminder yang jatuh tempo dan belum selesai
  const { data: reminders } = await supabase
    .from('reminders')
    .select('project_name, address, assign_name, due_date, status, category')
    .lte('due_date', batas)
    .not('status', 'in', '("done","cancelled")');

  for (const r of (reminders ?? []) as {
    project_name: string | null; address: string | null;
    assign_name: string | null; due_date: string; category: string | null;
  }[]) {
    catat(r.assign_name, {
      label: `🗓️ ${r.project_name ?? '-'}${r.address ? ` · ${r.address}` : ''} (${r.category ?? '-'})`,
      tanggal: r.due_date,
      terlambat: r.due_date < hariIni,
    });
  }

  /*
    M3 (docs/UX-WORKFLOW-AUDIT.md): tiket "Waiting Approval" dulu tidak
    pernah di-follow-up otomatis - WA ke approver cuma sekali saat tiket
    dibuat, dan kalau diabaikan tidak ada reminder susulan sama sekali.
    Tiket yang sudah menunggu >24 jam diikutkan ke digest harian ini,
    ditujukan ke admin/superadmin + pemegang Full Access - penerima yang
    sama dengan yang menerima notifikasi persetujuan saat tiket dibuat.
  */
  const batasApproval = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { data: menungguApproval } = await supabase
    .from('tickets')
    .select('project_name, issue_case, created_at')
    .eq('status', 'Waiting Approval')
    .lte('created_at', batasApproval);

  if ((menungguApproval ?? []).length > 0) {
    const { data: approver } = await supabase
      .from('users')
      .select('full_name')
      .or('role.in.(admin,superadmin),access_level.eq.full')
      .not('full_name', 'is', null);
    const namaApprover = ((approver ?? []) as { full_name: string }[]).map(a => a.full_name);
    for (const t of (menungguApproval ?? []) as { project_name: string | null; issue_case: string | null; created_at: string }[]) {
      const tglBuat = t.created_at.slice(0, 10);
      const item: Item = {
        label: `🔴 Menunggu approval: ${t.project_name ?? '-'} (${t.issue_case ?? '-'})`,
        tanggal: tglBuat,
        terlambat: true,
      };
      for (const nama of namaApprover) catat(nama, item);
    }
  }

  /* ── Tambahan briefing pagi ───────────────────────────────────────────
     1. Daily Report hari kerja sebelumnya yang belum diisi (Team PTS).
     2. Tiket aktif yang sedang dipegang.
     3. Untuk atasan: anggota langsungnya yang belum mengisi Daily Report.
     4. Senin: insight mingguan untuk Admin & Manager.  */
  const { data: semuaUser } = await supabase
    .from('users')
    .select('id, full_name, phone_number, team_type, jabatan, role, atasan_id, access_level, telegram_chat_id');
  type U = { id: string; full_name: string | null; phone_number: string | null; team_type: string | null;
    jabatan: string | null; role: string | null; atasan_id: string | null; access_level: string | null; telegram_chat_id: string | null };
  const daftarUser = ((semuaUser ?? []) as U[]).filter(u => u.full_name);
  const timPTS = daftarUser.filter(u => (u.team_type ?? '').startsWith('Team PTS'));
  const adalahAdmin = (u: U) => ['admin', 'superadmin'].includes((u.role ?? '').toLowerCase()) || u.access_level === 'full';
  const adalahManager = (u: U) => /manager/i.test(u.jabatan ?? '');

  //  Hari kerja sebelumnya: mundur melewati Sabtu, Minggu, dan hari libur piket.
  const { data: libur } = await supabase.from('picket_holidays').select('date').gte('date', tanggalISO(-10));
  const setLibur = new Set(((libur ?? []) as { date: string }[]).map(l => l.date));
  let kemarin = tanggalISO(-1);
  for (let n = 1; n <= 5 && (hariDari(kemarin) === 0 || hariDari(kemarin) === 6 || setLibur.has(kemarin)); n++) kemarin = tanggalISO(-1 - n);

  const { data: drKemarin } = await supabase.from('daily_reports').select('user_id').eq('report_date', kemarin);
  const sudahDR = new Set(((drKemarin ?? []) as { user_id: string }[]).map(r => r.user_id));
  const belumDR = timPTS.filter(u => !sudahDR.has(u.id));
  const labelKemarin = new Date(kemarin + 'T00:00:00').toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short' });
  for (const u of belumDR) {
    catat(u.full_name, { label: `📝 Daily Report ${labelKemarin} belum diisi`, tanggal: kemarin, terlambat: true, ringan: true });
  }

  const { data: tiketAktif } = await supabase
    .from('tickets')
    .select('project_name, status, assign_name')
    .not('status', 'in', '("Solved","Rejected")')
    .not('is_deleted', 'is', true)
    .not('assign_name', 'is', null);
  const tiketPer = new Map<string, { project: string; status: string }[]>();
  for (const t of (tiketAktif ?? []) as { project_name: string | null; status: string; assign_name: string }[]) {
    const arr = tiketPer.get(t.assign_name) ?? [];
    arr.push({ project: t.project_name ?? '-', status: t.status });
    tiketPer.set(t.assign_name, arr);
  }
  for (const [nama, ts] of tiketPer) {
    const overdue = ts.filter(t => t.status === 'Overdue').length;
    catat(nama, {
      label: `🎫 ${ts.length} tiket aktif${overdue ? ` (${overdue} overdue)` : ''}: ${ts.slice(0, 3).map(t => t.project).join(', ')}${ts.length > 3 ? ', ...' : ''}`,
      tanggal: hariIni,
      terlambat: overdue > 0,
      ringan: true,
    });
  }

  //  Blok tambahan per penerima (teks bebas di bawah daftar tenggat).
  const blok = new Map<string, string[]>();
  const tambahBlok = (nama: string, teks: string) => { const a = blok.get(nama) ?? []; a.push(teks); blok.set(nama, a); };

  for (const atasan of daftarUser) {
    const bawahanBelum = belumDR.filter(b => b.atasan_id === atasan.id);
    if (bawahanBelum.length) {
      tambahBlok(atasan.full_name!, `*Tim Anda:* ${bawahanBelum.length} anggota belum mengisi Daily Report ${labelKemarin}: ${bawahanBelum.map(b => b.full_name).join(', ')}.`);
    }
  }

  if (hariDari(hariIni) === 1) {
    const sejak = tanggalISO(-7);
    const [{ data: tDibuat }, { data: tSelesai }, { data: rLewat }, { data: drMinggu }] = await Promise.all([
      supabase.from('tickets').select('id').gte('created_at', sejak).not('is_deleted', 'is', true),
      supabase.from('tickets').select('id').eq('status', 'Solved').gte('updated_at', sejak),
      supabase.from('reminders').select('id').lt('due_date', hariIni).not('status', 'in', '("done","cancelled")').not('is_deleted', 'is', true),
      supabase.from('daily_reports').select('user_id, report_date').gte('report_date', sejak).lt('report_date', hariIni),
    ]);
    //  Hari kerja dalam 7 hari terakhir, untuk tingkat pengisian Daily Report.
    const hariKerja: string[] = [];
    for (let n = 7; n >= 1; n--) { const d = tanggalISO(-n); if (hariDari(d) !== 0 && hariDari(d) !== 6 && !setLibur.has(d)) hariKerja.push(d); }
    const setHK = new Set(hariKerja);
    const isiPer = new Map<string, number>();
    for (const r of (drMinggu ?? []) as { user_id: string; report_date: string }[]) {
      if (setHK.has(r.report_date)) isiPer.set(r.user_id, (isiPer.get(r.user_id) ?? 0) + 1);
    }
    const target = timPTS.length * hariKerja.length;
    const terisi = timPTS.reduce((n, u) => n + Math.min(isiPer.get(u.id) ?? 0, hariKerja.length), 0);
    const palingKurang = timPTS
      .map(u => ({ nama: u.full_name!, kurang: hariKerja.length - Math.min(isiPer.get(u.id) ?? 0, hariKerja.length) }))
      .filter(x => x.kurang > 0).sort((a, b) => b.kurang - a.kurang).slice(0, 3);
    const insight =
      `*Insight mingguan (7 hari terakhir)*\n` +
      `• Tiket baru: ${(tDibuat ?? []).length} · Solved: ${(tSelesai ?? []).length}\n` +
      `• Jadwal lewat tenggat & belum selesai: ${(rLewat ?? []).length}\n` +
      `• Pengisian Daily Report: ${target ? Math.round((terisi / target) * 100) : 0}% (${terisi}/${target})` +
      (palingKurang.length ? `\n• Paling banyak belum isi: ${palingKurang.map(p => `${p.nama} (${p.kurang} hari)`).join(', ')}` : '');
    for (const u of daftarUser.filter(u => adalahAdmin(u) || adalahManager(u))) tambahBlok(u.full_name!, insight);
  }

  const penerima = new Set([...perOrang.keys(), ...blok.keys()]);
  if (penerima.size === 0) {
    return { penerima: 0, terkirim: 0, gagal: 0, catatan: 'tidak ada tenggat dalam jangkauan' };
  }

  const perNama = new Map(daftarUser.map(u => [u.full_name!, u]));

  /*  Telegram langsung ke Bot API. lib/telegram-pribadi.ts memanggil
      '/api/notifikasi/telegram' (alamat relatif) yang hanya jalan di
      peramban - dari cron ini ia selalu gagal diam-diam. Teks polos, tanpa
      parse_mode (lihat alasannya di route Telegram). */
  const [tokenTg, pengaturan] = await Promise.all([bacaRahasia('telegram.bot_token'), bacaPengaturan()]);
  const kirimTg = async (chatId: string, teks: string) => {
    if (!tokenTg || !pengaturan.aktif.telegram) return false;
    try {
      const r = await fetch(`https://api.telegram.org/bot${tokenTg}/sendMessage`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: teks.replace(/[*_]/g, '') }),
      });
      return !!(await r.json().catch(() => ({})))?.ok;
    } catch { return false; }
  };
  let telegram = 0;
  let terkirim = 0, gagal = 0, tanpaNomor = 0, push = 0;

  for (const nama of penerima) {
    const u = perNama.get(nama);
    const items = perOrang.get(nama) ?? [];
    const tambahan = blok.get(nama) ?? [];

    // Terlambat lebih dulu, lalu urut tanggal - yang paling mendesak dibaca
    // pertama, karena pesan panjang sering hanya terbaca beberapa baris awal.
    items.sort((a, b) =>
      (a.terlambat === b.terlambat ? 0 : a.terlambat ? -1 : 1) || a.tanggal.localeCompare(b.tanggal));

    const jumlahTerlambat = items.filter(i => i.terlambat).length;
    const tglJudul = new Date(hariIni + 'T00:00:00').toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' });
    const pesan =
      `*Briefing Pagi - ${tglJudul}*\n` +
      (items.length
        ? `Halo ${nama}, ada ${items.length} hal yang perlu perhatian` +
          (jumlahTerlambat ? ` - *${jumlahTerlambat} sudah lewat tenggat*` : '') + `:\n\n` +
          items.map(i => `${i.terlambat ? '🔴' : '•'} ${i.label}\n   _${labelTanggal(i.tanggal)}_`).join('\n')
        : `Halo ${nama}.`) +
      (tambahan.length ? `\n\n${tambahan.join('\n\n')}` : '') +
      `\n\nBuka Work Management untuk menindaklanjuti.`;

    //  Push ke aplikasi/HP: ringkas, pesan lengkap tetap lewat WA/Telegram.
    if (u) {
      const ringkas = items.length
        ? `${items.length} hal perlu perhatian${jumlahTerlambat ? `, ${jumlahTerlambat} lewat tenggat` : ''}: ${items[0].label}`
        : (tambahan[0] ?? '').replace(/\*/g, '').slice(0, 140);
      try { await kirimPushKeUser([u.id], { title: 'Briefing pagi', body: ringkas, url: '/dashboard' }); push++; } catch { /* push opsional */ }
    }

    if (u?.telegram_chat_id && await kirimTg(u.telegram_chat_id, pesan)) telegram++;

    const wa = u?.phone_number;
    if (!wa) { tanpaNomor++; continue; }
    //  WA hanya bila ada tenggat sungguhan / blok atasan (lihat Item.ringan).
    if (!(items.some(i => !i.ringan) || tambahan.length > 0)) continue;
    const hasil = await sendWA(wa, pesan, 'digest_wa', 'system.digest');
    if (hasil.ok) terkirim++; else gagal++;
  }

  return { penerima: penerima.size, terkirim, gagal, tanpaNomor, push, telegram, drAcuan: kemarin };
}

export async function GET(request: NextRequest) {
  if (!berwenang(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    return NextResponse.json({ ok: true, ...(await jalankan()) });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as { message?: string }).message ?? 'gagal' },
      { status: 500 },
    );
  }
}

export const POST = GET;
