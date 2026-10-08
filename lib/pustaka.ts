/**
 * lib/pustaka.ts - Pustaka Tools Team: katalog produk, data acuan & artikel panduan yang diisi tim
 * (Admin / Full Access) lewat menu Tools Team › Pustaka, bukan ditulis di kode.
 *
 * Satu REGISTRI jenis: tiap jenis mendefinisikan bidangnya sekali, lalu dipakai untuk validasi server
 * (/api/tools-team/pustaka), formulir admin, tabel daftar, dan isian otomatis di kalkulator. Menambah
 * jenis baru = menambah satu entri JENIS_PUSTAKA. Kalkulator selalu punya nilai bawaan kode bila
 * pustaka kosong / gagal dimuat, jadi tidak pernah macet.
 */

export type TipeBidang = 'teks' | 'angka' | 'pilih' | 'panjang';
export interface Bidang {
  k: string; l: string; tipe: TipeBidang;
  satuan?: string; wajib?: boolean; min?: number; maks?: number;
  opsi?: { v: string; l: string }[];
  /** Ditampilkan sebagai kolom di tabel daftar. */
  kolom?: boolean;
}
export type KelompokPustaka = 'produk' | 'data' | 'artikel';
export interface JenisPustaka { v: string; l: string; ikon: string; kelompok: KelompokPustaka; ket: string; bidang: Bidang[] }

const MEREK: Bidang = { k: 'merek', l: 'Merek', tipe: 'teks', kolom: true };
const CATATAN: Bidang = { k: 'catatan', l: 'Catatan', tipe: 'panjang' };
const RESOLUSI: Bidang = { k: 'resolusi', l: 'Resolusi', tipe: 'pilih', kolom: true, opsi: [
  { v: 'WXGA', l: 'WXGA 1280×800' }, { v: 'FHD', l: 'Full HD 1920×1080' }, { v: 'WUXGA', l: 'WUXGA 1920×1200' }, { v: '4K', l: '4K UHD 3840×2160' },
] };

export const JENIS_PUSTAKA: JenisPustaka[] = [
  { v: 'proyektor', l: 'Proyektor', ikon: '📽', kelompok: 'produk', ket: 'Dipakai Kalkulator AV › Proyektor (throw, lens shift, lumen).', bidang: [
    MEREK, { k: 'lumen', l: 'Lumen', tipe: 'angka', satuan: 'lm', min: 100, maks: 100000, wajib: true, kolom: true }, RESOLUSI,
    { k: 'throwMin', l: 'Throw ratio min', tipe: 'angka', min: 0.1, maks: 20, wajib: true, kolom: true },
    { k: 'throwMaks', l: 'Throw ratio maks', tipe: 'angka', min: 0.1, maks: 20, wajib: true, kolom: true },
    { k: 'shiftAtas', l: 'Lens shift atas', tipe: 'angka', satuan: '%', min: 0, maks: 150 },
    { k: 'shiftBawah', l: 'Lens shift bawah', tipe: 'angka', satuan: '%', min: 0, maks: 150 },
    { k: 'sumber', l: 'Sumber cahaya', tipe: 'pilih', opsi: [{ v: 'laser', l: 'Laser' }, { v: 'lampu', l: 'Lampu' }, { v: 'led', l: 'LED' }] },
    { k: 'watt', l: 'Daya', tipe: 'angka', satuan: 'W', min: 0, maks: 10000 }, CATATAN] },
  { v: 'speaker', l: 'Speaker', ikon: '🔊', kelompok: 'produk', ket: 'Dipakai Kalkulator AV › Audio (sensitivitas, sudut, tap line).', bidang: [
    MEREK, { k: 'tipe', l: 'Tipe', tipe: 'pilih', kolom: true, opsi: [{ v: 'plafon', l: 'Plafon' }, { v: 'dinding', l: 'Dinding / box' }, { v: 'kolom', l: 'Kolom' }, { v: 'line-array', l: 'Line array' }, { v: 'subwoofer', l: 'Subwoofer' }] },
    { k: 'sensitivitas', l: 'Sensitivitas (1 W/1 m)', tipe: 'angka', satuan: 'dB', min: 70, maks: 120, wajib: true, kolom: true },
    { k: 'sudut', l: 'Sudut sebaran', tipe: 'angka', satuan: '°', min: 10, maks: 180, kolom: true },
    { k: 'ohm', l: 'Impedansi', tipe: 'angka', satuan: 'Ω', min: 1, maks: 64 },
    { k: 'tap', l: 'Tap line 70/100 V (W, dipisah /)', tipe: 'teks' },
    { k: 'wattMaks', l: 'Daya maks', tipe: 'angka', satuan: 'W', min: 0, maks: 10000 }, CATATAN] },
  { v: 'amplifier', l: 'Amplifier', ikon: '🎚', kelompok: 'produk', ket: 'Acuan daya & kanal amplifier (Audio, Rak).', bidang: [
    MEREK, { k: 'kanal', l: 'Kanal', tipe: 'angka', min: 1, maks: 64, kolom: true },
    { k: 'wattKanal', l: 'Daya per kanal', tipe: 'angka', satuan: 'W', min: 1, maks: 20000, wajib: true, kolom: true },
    { k: 'beban', l: 'Beban', tipe: 'pilih', kolom: true, opsi: [{ v: '2', l: '2 Ω' }, { v: '4', l: '4 Ω' }, { v: '8', l: '8 Ω' }, { v: '70V', l: '70 V' }, { v: '100V', l: '100 V' }] },
    { k: 'u', l: 'Tinggi rak', tipe: 'angka', satuan: 'U', min: 0, maks: 20 }, { k: 'kg', l: 'Berat', tipe: 'angka', satuan: 'kg', min: 0, maks: 500 },
    { k: 'watt', l: 'Konsumsi daya', tipe: 'angka', satuan: 'W', min: 0, maks: 20000 }, CATATAN] },
  { v: 'display', l: 'Display & panel videowall', ikon: '🖥', kelompok: 'produk', ket: 'Bezel > 0 = panel videowall (Kalkulator AV › Ukuran Layar).', bidang: [
    MEREK, { k: 'diagonal', l: 'Diagonal', tipe: 'angka', satuan: 'inci', min: 10, maks: 300, wajib: true, kolom: true }, RESOLUSI,
    { k: 'bezel', l: 'Bezel-to-bezel (0 = display tunggal)', tipe: 'angka', satuan: 'mm', min: 0, maks: 50, kolom: true },
    { k: 'nits', l: 'Kecerahan', tipe: 'angka', satuan: 'nits', min: 0, maks: 10000 },
    { k: 'watt', l: 'Daya', tipe: 'angka', satuan: 'W', min: 0, maks: 5000 }, CATATAN] },
  { v: 'perangkat-rak', l: 'Perangkat rak', ikon: '🗄', kelompok: 'produk', ket: 'Dipakai Kalkulator AV › Rak.', bidang: [
    MEREK, { k: 'u', l: 'Tinggi', tipe: 'angka', satuan: 'U', min: 0, maks: 20, wajib: true, kolom: true },
    { k: 'kg', l: 'Berat', tipe: 'angka', satuan: 'kg', min: 0, maks: 500, kolom: true },
    { k: 'watt', l: 'Daya', tipe: 'angka', satuan: 'W', min: 0, maks: 20000, kolom: true }, CATATAN] },
  { v: 'perangkat-poe', l: 'Perangkat PoE', ikon: '🔌', kelompok: 'produk', ket: 'Dipakai Kalkulator AV › PoE.', bidang: [
    MEREK, { k: 'watt', l: 'Konsumsi maks', tipe: 'angka', satuan: 'W', min: 0, maks: 100, wajib: true, kolom: true },
    { k: 'kelas', l: 'Kelas PoE', tipe: 'pilih', wajib: true, kolom: true, opsi: [{ v: 'af', l: '802.3af (PoE)' }, { v: 'at', l: '802.3at (PoE+)' }, { v: 'bt3', l: '802.3bt tipe 3' }, { v: 'bt4', l: '802.3bt tipe 4' }] }, CATATAN] },
  { v: 'material-akustik', l: 'Material akustik', ikon: '🧱', kelompok: 'data', ket: 'Koefisien serap 500 Hz untuk Audio › Akustik ruang.', bidang: [
    { k: 'a', l: 'Koefisien serap (500 Hz)', tipe: 'angka', min: 0, maks: 1.2, wajib: true, kolom: true }, CATATAN] },
  { v: 'aliran-ip', l: 'Aliran AV-over-IP', ikon: '🌐', kelompok: 'data', ket: 'Bitrate per aliran untuk Sinyal › Jaringan AV.', bidang: [
    { k: 'mbps', l: 'Bitrate', tipe: 'angka', satuan: 'Mbps', min: 0.1, maks: 100000, wajib: true, kolom: true }, CATATAN] },
  { v: 'artikel', l: 'Artikel panduan', ikon: '📘', kelompok: 'artikel', ket: 'Panduan & pengetahuan tim - bisa dibaca tanpa bantuan AI.', bidang: [
    { k: 'kategori', l: 'Kategori', tipe: 'pilih', wajib: true, kolom: true, opsi: [
      { v: 'layar', l: 'Layar & display' }, { v: 'proyektor', l: 'Proyektor' }, { v: 'led', l: 'LED videotron' }, { v: 'audio', l: 'Audio' },
      { v: 'jaringan', l: 'Sinyal & jaringan' }, { v: 'instalasi', l: 'Instalasi & daya' }, { v: 'produk', l: 'Pengetahuan produk' }, { v: 'umum', l: 'Umum' }] },
    { k: 'ringkas', l: 'Ringkasan', tipe: 'teks', kolom: true },
    { k: 'isi', l: 'Isi', tipe: 'panjang', wajib: true },
    { k: 'sumber', l: 'Sumber / tautan', tipe: 'teks' }] },
];

export const KODE_JENIS = JENIS_PUSTAKA.map(j => j.v);
export const jenisPustaka = (v: string) => JENIS_PUSTAKA.find(j => j.v === v);

export interface EntriPustaka { id: string; jenis: string; nama: string; data: Record<string, string | number>; diubah_oleh_nama?: string | null; updated_at?: string }

export const MAKS_TEKS = 200, MAKS_PANJANG = 20000, MAKS_NAMA = 120;

/** Validasi & bersihkan isian satu entri menurut registri. Bidang tak dikenal dibuang. */
export function periksaEntri(jenis: unknown, nama: unknown, data: unknown):
  { ok: true; jenis: string; nama: string; data: Record<string, string | number> } | { ok: false; alasan: string } {
  const j = typeof jenis === 'string' ? jenisPustaka(jenis) : undefined;
  if (!j) return { ok: false, alasan: 'Jenis pustaka tidak dikenal.' };
  const n = typeof nama === 'string' ? nama.trim().slice(0, MAKS_NAMA) : '';
  if (!n) return { ok: false, alasan: 'Nama wajib diisi.' };
  const d = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>;
  const hasil: Record<string, string | number> = {};
  for (const b of j.bidang) {
    const v = d[b.k];
    const kosong = v === undefined || v === null || v === '';
    if (kosong) { if (b.wajib) return { ok: false, alasan: `${b.l} wajib diisi.` }; continue; }
    if (b.tipe === 'angka') {
      const x = typeof v === 'number' ? v : Number(String(v).replace(',', '.'));
      if (!Number.isFinite(x)) return { ok: false, alasan: `${b.l} harus angka.` };
      if ((b.min !== undefined && x < b.min) || (b.maks !== undefined && x > b.maks)) return { ok: false, alasan: `${b.l} di luar rentang ${b.min ?? '-∞'}-${b.maks ?? '∞'}.` };
      hasil[b.k] = x;
    } else if (b.tipe === 'pilih') {
      const s = String(v);
      if (!b.opsi?.some(o => o.v === s)) return { ok: false, alasan: `${b.l} tidak sah.` };
      hasil[b.k] = s;
    } else {
      hasil[b.k] = String(v).slice(0, b.tipe === 'panjang' ? MAKS_PANJANG : MAKS_TEKS);
    }
  }
  return { ok: true, jenis: j.v, nama: n, data: hasil };
}

/** Angka dari data entri (dengan cadangan), untuk mengisi kalkulator. */
export const angkaDari = (e: EntriPustaka, k: string, cadangan = 0) => (typeof e.data[k] === 'number' ? (e.data[k] as number) : cadangan);
export const teksDari = (e: EntriPustaka, k: string) => (e.data[k] === undefined ? '' : String(e.data[k]));
/** Tap pertama dari "3/6/12" atau "7,5/15/30" (W) - dipisah garis miring/titik koma/spasi; koma = desimal. */
export const tapPertama = (e: EntriPustaka) => teksDari(e, 'tap').split(/[/; ]+/).map(x => Number(x.replace(',', '.'))).find(x => x > 0) ?? 0;
