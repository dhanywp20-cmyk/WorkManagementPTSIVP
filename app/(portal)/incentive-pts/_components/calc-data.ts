/** calc-data.ts - dipecah dari calc.ts (scripts/pecah-modul.mjs); calc.ts tetap mengekspor ulang semuanya. */
import { tempelkanNominal } from '@/lib/incentive-nominal';
import { ambilPetaNominal, lengkapiNominal } from '@/lib/incentive-nominal-api';
import { kategoriInsentif, muatKategoriInsentif } from '@/lib/incentive-scheme';
import { gabungkanProyek } from '@/lib/kelompok-insentif';
import { supabase } from '@/lib/supabase';
import { IncentiveProjectRow, IncentiveSplit, IncentiveTranche } from './calc-tipe';

/**
 * Apakah kolom `incentive_excluded` sudah ada di basis data ini.
 *
 * null = belum diketahui. Disimpan di tingkat modul supaya jawabannya berlaku
 * untuk sisa sesi, bukan ditanyakan ulang tiap kali daftar dimuat.
 */
let kolomKeluarkanAda: boolean | null = null;

/**
 * Satukan beberapa jadwal jadi satu proyek insentif. Dipanggil tombol
 * "Gabungkan" - tidak pernah otomatis.
 *
 * Yang ditandai BUKAN hanya baris wakilnya. Jadwal 5 hari diwakili satu baris
 * di layar, tapi kelimanya harus ikut - kalau tidak, empat sisanya tetap
 * berdiri sendiri dan proyeknya muncul lagi sebagai duplikat begitu daftar
 * dimuat ulang.
 *
 * Penandaannya lewat batch_id, bukan dengan mengambil dulu seluruh barisnya:
 * satu perintah update per batch, tanpa satu pun pembacaan tambahan.
 */
export async function satukanProyek(
  anggota: { id: string; batch_id?: string | null }[],
): Promise<{ error: { message: string } | null; grup: string }> {
  const grup = crypto.randomUUID();
  const batchIds = [...new Set(anggota.map(a => a.batch_id).filter(Boolean))] as string[];
  const idLepas = anggota.filter(a => !a.batch_id).map(a => a.id);

  const hasil: { error: { message: string } | null }[] = [];
  if (batchIds.length > 0) {
    hasil.push(await supabase.from('reminders')
      .update({ incentive_group_id: grup }).in('batch_id', batchIds));
  }
  if (idLepas.length > 0) {
    hasil.push(await supabase.from('reminders')
      .update({ incentive_group_id: grup }).in('id', idLepas));
  }
  const gagal = hasil.find(r => r.error)?.error ?? null;
  return { error: gagal, grup };
}

/**
 * Batalkan penggabungan.
 *
 * Ada karena keputusan soal uang harus bisa dicabut. Menggabungkan dua proyek
 * yang ternyata memang terpisah akan menghilangkan satu pool - dan tanpa jalan
 * kembali, satu-satunya cara membetulkannya adalah menyunting basis data
 * langsung.
 */
export async function pisahkanProyek(grup: string) {
  return await supabase.from('reminders')
    .update({ incentive_group_id: null }).eq('incentive_group_id', grup);
}

/**
 * Daftar proyek insentif.
 *
 * PENYARINGAN "dikeluarkan" DIBUAT TAHAN bila kolomnya belum dipasang.
 *
 * Ini bukan kehati-hatian yang berlebihan - persis inilah yang terjadi. Saat
 * penyaring `.not('incentive_excluded', ...)` pertama kali dipasang, kolomnya
 * belum ada di produksi; PostgREST menolak SELURUH kueri, dan daftar Incentive
 * tampil KOSONG. Bukan pesan galat, bukan daftar sebagian - kosong, seolah
 * tidak ada satu pun proyek. Kode aplikasi dan skema basis data tidak pernah
 * mendarat pada detik yang sama, jadi jeda di antaranya harus tetap bisa
 * dipakai bekerja.
 *
 * Bila kolomnya memang belum ada, daftarnya tetap tampil utuh - hanya fitur
 * "keluarkan" yang belum berfungsi, dan itu memang belum dipasang.
 */
export async function fetchIncentiveProjects() {
  /*
    Kategori dibaca dari SKEMA, bukan dari daftar yang dipaku di kode. Skema
    ditarik lebih dulu supaya cache kategorinya terisi walau halaman ini
    dibuka langsung (deep link) tanpa sempat memuat skema duluan.
  */
  await muatKategoriInsentif();
  const dasar = () => supabase
    .from('reminders')
    .select('*')
    .in('category', kategoriInsentif())
    .eq('status', 'done')
    .order('due_date', { ascending: false });

  if (kolomKeluarkanAda !== false) {
    // `not.is.true` DIPILIH karena ia juga meloloskan baris NULL; `neq.true`
    // tidak, dan itu akan menyembunyikan seluruh proyek lama yang kolomnya
    // belum pernah diisi.
    const r = await dasar().not('incentive_excluded', 'is', true);
    if (!r.error) {
      kolomKeluarkanAda = true;
      return { data: await lengkapiNominal(gabungkanProyek((r.data || []) as IncentiveProjectRow[])), error: r.error };
    }
    if (!/does not exist/i.test(r.error.message)) {
      // Galat lain - jangan disembunyikan di balik percobaan kedua.
      return { data: [] as IncentiveProjectRow[], error: r.error };
    }
    kolomKeluarkanAda = false;
    console.warn(
      '[incentive] kolom incentive_excluded belum ada - daftar ditampilkan utuh. ' +
      'Jalankan sql/incentive-keluarkan-proyek.sql untuk mengaktifkan fitur "keluarkan dari Incentive".');
  }

  const r2 = await dasar();
  return { data: await lengkapiNominal(gabungkanProyek((r2.data || []) as IncentiveProjectRow[])), error: r2.error };
}

/**
 * Keluarkan / masukkan kembali proyek ke daftar Incentive PTS.
 *
 * Yang berubah hanya penanda; jadwalnya di Request Schedule tidak disentuh.
 * Pemeriksaan "tahapan sudah diproses" dilakukan pemanggil sebelum sampai ke
 * sini, karena pesannya perlu menyebut proyek yang mana.
 */
export async function setProyekDikeluarkan(ids: string[], keluar: boolean) {
  if (!ids.length) return { error: null };
  const { error } = await supabase
    .from('reminders')
    .update({ incentive_excluded: keluar })
    .in('id', ids);
  if (error) return { error };
  if (!keluar) return { error: null };  // dimasukkan kembali - tidak ada yang perlu dibersihkan

  /*
    Proyek yang baru dikeluarkan mungkin sudah punya tahapan pencairan yang
    ter-generate lebih dulu (mis. dari Generate Tahapan Massal, atau sisa
    percobaan Process Batch yang gagal separuh jalan). Tanpa ini, tahapannya
    tetap nangkring di Tranche Schedule selamanya - proyeknya sudah tidak ada
    di daftar Incentive, tapi jejaknya masih tampil seolah masih aktif.
    "Keluarkan dari Incentive" berarti proyek ini TIDAK ikut Incentive sama
    sekali, bukan cuma berhenti dari titik ini.

    Kasus nyata yang jadi alasan ini ditulis: PLN Salatiga dikeluarkan lewat
    tombol ini, tapi tahap 1-nya (tahun bayar 2027) masih tampil di Tranche
    Schedule DENGAN baris pembagian yang sudah terlanjur tertulis (sisa
    percobaan Process Batch yang gagal menandai processed, dari SEBELUM
    perbaikan T-1 di processYearlyBatch) - PIC di baris pembagian itu nama
    LAMA (dari saat percobaan itu berjalan), beda dari PIC yang berlaku
    sekarang di Request Schedule. Bukan proyek ini saja - tujuh proyek lain
    punya sisa yang sama, dibersihkan manual sekali lewat SQL saat audit ini.
    Perbaikan di sini supaya kejadian yang sama tidak terulang lewat jalur
    "Keluarkan" tanpa perlu turun tangan manual lagi.

    Hanya tahapan PENDING yang dibersihkan - yang processed/paid dianggap
    "sudah berjalan" dan pemanggil WAJIB menolak permintaan keluarkan sebelum
    sampai ke sini kalau ada yang begitu (lihat tahapanSudahJalan). Diperiksa
    lagi di sini, bukan dipercaya begitu saja dari pemanggil: proyek dengan
    campuran tahapan pending+processed tetap harus menyisakan yang
    processed/paid utuh, tidak ikut terhapus.
  */
  const { data: tr, error: bacaErr } = await supabase
    .from('incentive_tranches').select('id').in('project_id', ids).eq('status', 'pending');
  if (bacaErr) return { error: bacaErr };
  const trancheIds = (tr ?? []).map((t: { id: string }) => t.id);
  if (trancheIds.length === 0) return { error: null };

  //  Splits dulu (jaga-jaga - tahapan pending SEHARUSNYA tidak punya splits,
  //  tapi sisa Process Batch yang gagal setengah jalan justru meninggalkan
  //  persis kombinasi itu), baru tahapannya sendiri.
  const rollback = await hapusSplitsServer({ trancheIds });
  if (rollback.error) return { error: rollback.error };
  const { error: hapusErr } = await supabase.from('incentive_tranches').delete().in('id', trancheIds);
  return { error: hapusErr ?? null };
}

/**
 * Tahapan pencairan yang UANGNYA SUDAH BERJALAN untuk sekumpulan proyek.
 *
 * Dipakai menolak penghapusan: rekap yang sudah diterima Finance tidak boleh
 * kehilangan proyeknya, karena angka di rekap itu jadi tidak bisa dijelaskan.
 */
export async function tahapanSudahJalan(projectIds: string[]) {
  if (!projectIds.length) return { data: [] as { project_id: string; status: string }[], error: null };
  const { data, error } = await supabase
    .from('incentive_tranches')
    .select('project_id, status')
    .in('project_id', projectIds)
    .in('status', ['processed', 'paid']);
  return { data: (data || []) as { project_id: string; status: string }[], error };
}

export async function fetchTranches(filters?: { payment_year?: number; status?: string }) {
  let q = supabase.from('incentive_tranches').select('*, project:reminders(*)').order('payment_year');
  if (filters?.payment_year) q = q.eq('payment_year', filters.payment_year);
  if (filters?.status) q = q.eq('status', filters.status);
  const { data, error } = await q;
  const baris = (data || []) as (IncentiveTranche & { project: IncentiveProjectRow })[];
  //  Nominal tidak lagi di kolom reminders (terkunci) - ditempel dari server.
  const { peta } = baris.length ? await ambilPetaNominal() : { peta: {} as Record<string, number> };
  return {
    data: baris.map(t => (t.project ? { ...t, project: tempelkanNominal([t.project], peta)[0] } : t)),
    error,
  };
}

export async function fetchSplits(projectId?: string) {
  let q = supabase.from('incentive_splits').select('*').order('created_at');
  if (projectId) q = q.eq('project_id', projectId);
  const { data, error } = await q;
  return { data: (data || []) as IncentiveSplit[], error };
}

/**
 * Baca splits lewat server route dengan filter privasi (pemegang akses
 * input/penuh melihat semua; selain itu hanya jatahnya sendiri). Dipakai UI
 * menggantikan fetchSplits setelah RLS incentive_splits dikunci dari anon.
 */
export async function fetchVisibleSplits(projectId?: string): Promise<{ data: IncentiveSplit[]; error: unknown }> {
  try {
    const url = projectId
      ? `/api/incentive/splits?projectId=${encodeURIComponent(projectId)}`
      : '/api/incentive/splits';
    const res = await fetch(url);
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return { data: [], error: { message: json.error || 'Gagal memuat data incentive' } };
    return { data: (json.data || []) as IncentiveSplit[], error: null };
  } catch (e) {
    return { data: [], error: e };
  }
}

/**
 * Hapus baris pembagian LEWAT SERVER.
 *
 * Wajib lewat route, tidak boleh `supabase.from('incentive_splits').delete()`
 * dari peramban: tabel itu force-RLS dan satu-satunya kebijakannya adalah
 * INSERT untuk anon. Penghapusan dari klien karena itu selalu mengenai NOL
 * baris - dan PostgREST tidak menganggapnya galat, jadi kodenya menyangka
 * berhasil. Tiga jalur pembatalan di berkas ini dulu semuanya begitu, dan
 * itulah asal baris "Bagian Saya" yang berlipat: pembagian lama tidak pernah
 * benar-benar hilang, lalu Process Batch berikutnya menumpuk set baru.
 */
export async function hapusSplitsServer(
  target: { trancheIds: string[] } | { projectId: string },
): Promise<{ dihapus: number; error: { message: string } | null }> {
  const qs = 'trancheIds' in target
    ? `trancheIds=${encodeURIComponent(target.trancheIds.join(','))}`
    : `projectId=${encodeURIComponent(target.projectId)}`;
  try {
    const res = await fetch(`/api/incentive/splits?${qs}`, { method: 'DELETE' });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return { dihapus: 0, error: { message: json.error || 'Gagal menghapus baris pembagian.' } };
    return { dihapus: Number(json.dihapus ?? 0), error: null };
  } catch (e) {
    return { dihapus: 0, error: { message: (e as Error).message } };
  }
}
