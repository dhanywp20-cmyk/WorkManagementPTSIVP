/** incentive-scheme-simpan.ts - dipecah dari incentive-scheme.ts (scripts/pecah-modul.mjs); incentive-scheme.ts tetap mengekspor ulang semuanya. */
import { SKEMA_BAWAAN, periksaSkema } from './incentive-scheme-aturan';
import { aturKategoriBerlaku } from './incentive-scheme-kategori';
import { SkemaInsentif } from './incentive-scheme-tipe';
import { supabase } from './supabase';

// Baca / simpan

/**
 * Baca managerSebagaiPic dari bentuk LAMA maupun BARU.
 *
 * Bentuk lama = satu peta datar ({ pic: 100 }). Bentuk baru = dua keadaan.
 * Baris lama disalin ke KEDUA keadaan, jadi perilakunya persis sama seperti
 * sebelumnya - tidak ada proyek yang mendadak dibayar berbeda karena
 * strukturnya berubah. Admin yang memutuskan kapan keduanya dibedakan.
 */
function bacaManagerPic(raw: unknown): SkemaInsentif['managerSebagaiPic'] {
  const r = raw as Partial<SkemaInsentif['managerSebagaiPic']> & Record<string, unknown>;
  if (r && typeof r === 'object' && ('adaSupport' in r || 'tanpaSupport' in r)) {
    return {
      adaSupport: (r.adaSupport as Record<string, number>) ?? SKEMA_BAWAAN.managerSebagaiPic.adaSupport,
      tanpaSupport: (r.tanpaSupport as Record<string, number>) ?? SKEMA_BAWAAN.managerSebagaiPic.tanpaSupport,
    };
  }
  const datar = (r as Record<string, number> | null | undefined);
  if (datar && Object.keys(datar).length) return { adaSupport: { ...datar }, tanpaSupport: { ...datar } };
  return SKEMA_BAWAAN.managerSebagaiPic;
}

/** Gabungkan hasil baca dengan bawaan supaya kolom baru tidak bernilai undefined. */
function rapikan(raw: unknown): SkemaInsentif {
  const r = (raw ?? {}) as Partial<SkemaInsentif>;
  /*
    Kategori diambil dari skema tersimpan bila ada, dan hasilnya DIPASANG ke
    cache modul di sini - satu tempat yang pasti dilewati semua pembacaan
    skema (ambilSkema & riwayatSkema), jadi tidak ada jalur baca yang bisa
    lupa menyegarkannya.

    Baris skema lama tidak punya kolom ini; ia jatuh ke bawaan, yaitu daftar
    yang selama ini dipakai - jadi tidak ada proyek yang mendadak hilang dari
    daftar Incentive hanya karena kolomnya ditambahkan.
  */
  const kategori = Array.isArray(r.kategoriProyek) && r.kategoriProyek.length
    ? r.kategoriProyek.map(k => String(k).trim()).filter(Boolean)
    : [...SKEMA_BAWAAN.kategoriProyek];
  aturKategoriBerlaku(kategori);
  return {
    versi: r.versi ?? SKEMA_BAWAAN.versi,
    kategoriProyek: kategori,
    porsi: Array.isArray(r.porsi) && r.porsi.length ? r.porsi : SKEMA_BAWAAN.porsi,
    tanpaSupport: r.tanpaSupport ?? SKEMA_BAWAAN.tanpaSupport,
    jendelaSupportBulan: r.jendelaSupportBulan ?? SKEMA_BAWAAN.jendelaSupportBulan,
    hangusSupervisorKe: r.hangusSupervisorKe ?? SKEMA_BAWAAN.hangusSupervisorKe,
    managerSebagaiPic: bacaManagerPic(r.managerSebagaiPic),
    //  Skema yang tersimpan SEBELUM saklar ini ada tidak punya installerAktif.
    //  Jatuhnya TIDAK boleh ke bawaan (false): baris lama yang porsinya sudah
    //  diisi > 0 akan diam-diam berhenti membayar Installer pada perhitungan
    //  berikutnya, dan tidak ada yang tahu sampai seseorang memeriksa rekap.
    //  Jadi keaktifannya disimpulkan dari porsinya - itu memang satu-satunya
    //  penanda yang tersedia di baris lama.
    installerAktif: r.installerAktif ?? (r.installerRemotePersen ?? 0) > 0,
    installerRemotePersen: r.installerRemotePersen ?? SKEMA_BAWAAN.installerRemotePersen,
    installerHanyaRemote: r.installerHanyaRemote ?? SKEMA_BAWAAN.installerHanyaRemote,
    installerBayarDiMuka: r.installerBayarDiMuka ?? SKEMA_BAWAAN.installerBayarDiMuka,
    tranche: Array.isArray(r.tranche) && r.tranche.length ? r.tranche : SKEMA_BAWAAN.tranche,
    //  Skema lama tidak punya kolom ini. Jatuh ke bawaan yang saklarnya MATI,
    //  jadi perilakunya persis seperti sebelumnya - tidak ada proyek yang
    //  mendadak dibayar dengan angka lain karena penambahan kolom.
    porsiRemote: r.porsiRemote ?? SKEMA_BAWAAN.porsiRemote,
    //  Sama seperti porsiRemote: baris lama tidak punya kolom ini, jatuh ke
    //  bawaan yang saklarnya MATI - hitungPembagian tetap memindah porsi
    //  Supervisor ke hangusSupervisorKe persis seperti sebelum kolom ini ada.
    supervisorSebagaiPic: r.supervisorSebagaiPic ?? SKEMA_BAWAAN.supervisorSebagaiPic,
  };
}

/**
 * Ambil skema yang berlaku.
 *
 * Bila tabelnya belum dibuat (migrasi belum dijalankan) atau barisnya belum
 * ada, kembalikan bawaan - perhitungan tetap jalan dengan kebijakan terkini,
 * bukan gagal total.
 */
export async function ambilSkema(): Promise<SkemaInsentif> {
  try {
    const { data } = await supabase
      .from('incentive_scheme_settings')
      .select('scheme')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    return rapikan((data as { scheme?: unknown } | null)?.scheme);
  } catch {
    return SKEMA_BAWAAN;
  }
}

/**
 * Simpan skema sebagai VERSI BARU - baris lama tidak ditimpa.
 *
 * Dulu fungsi ini melakukan UPDATE pada satu-satunya baris pengaturan, jadi
 * angka sebelumnya lenyap begitu disimpan. Untuk pengaturan tampilan itu tidak
 * masalah; untuk aturan pembagian uang itu menghapus bukti. Sebuah proyek
 * dihitung tiga kali dalam tiga tahun, dan tanpa baris lamanya tidak ada cara
 * menjelaskan kenapa tahap 1 berbeda dari tahap 2.
 *
 * ambilSkema() sudah mengambil baris TERBARU, jadi menambah baris tidak
 * mengubah apa pun soal skema mana yang berlaku - hanya menyimpan jejaknya.
 */
export async function simpanSkema(sk: SkemaInsentif, olehNama: string): Promise<{ error: string | null }> {
  //  Peringatan tidak menahan penyimpanan - hanya galat sungguhan yang menahan.
  const galat = periksaSkema(sk).filter(m => !m.peringatan);
  if (galat.length) return { error: galat.map(m => m.pesan).join(' ') };
  const { error } = await supabase.from('incentive_scheme_settings').insert({
    scheme: sk as unknown as Record<string, unknown>,
    updated_at: new Date().toISOString(),
    updated_by: olehNama,
  });
  return { error: error?.message ?? null };
}

export interface VersiSkema {
  id: string;
  scheme: SkemaInsentif;
  updated_at: string;
  updated_by: string | null;
}

/** Riwayat perubahan skema, terbaru dulu. */
export async function riwayatSkema(batas = 20): Promise<VersiSkema[]> {
  try {
    const { data } = await supabase
      .from('incentive_scheme_settings')
      .select('id, scheme, updated_at, updated_by')
      .order('updated_at', { ascending: false })
      .limit(batas);
    return ((data ?? []) as { id: string; scheme: unknown; updated_at: string; updated_by: string | null }[])
      .map(r => ({ id: r.id, scheme: rapikan(r.scheme), updated_at: r.updated_at, updated_by: r.updated_by }));
  } catch {
    return [];
  }
}

/**
 * Penanda skema untuk dicetak di rekap ke Finance.
 *
 * Tanpa ini, rekap hanya berisi nominal - dan setahun kemudian tidak ada yang
 * bisa memastikan angka itu dihitung dengan aturan yang mana.
 */
export function labelSkema(sk: SkemaInsentif, tanggal?: string, oleh?: string | null): string {
  const porsi = sk.porsi.map(p => `${p.peran}${p.persen}`).join('/');
  const tgl = tanggal
    ? new Date(tanggal).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
    : '';
  return [`Skema v${sk.versi}`, porsi, tgl, oleh].filter(Boolean).join(' · ');
}
