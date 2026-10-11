/**
 * lib/perbandingan.ts - Product Comparison (battle card) Tools Team: bentuk data, label template (EN / ID),
 * validasi berkas brosur, dan validasi + verifikasi hasil AI. Murni - dipakai peramban & server
 * (diuji di uji/perbandingan.ts).
 *
 * Template baku: "LG 22SM3G-B vs DigiSIGN DSN-LAD-015 Comparison (EN).pdf" (owner, 2026-10-07) - header gelap,
 * kartu produk (unggulan = RECOMMENDED), bagian bernomor dengan tabel SPECIFICATION | produk..., lalu
 * "Summary & Recommendation" (ringkasan, 3 sorotan, kotak rekomendasi, catatan). Tanpa footer.
 *
 * Integritas data: setiap nilai berstatus 'ada' WAJIB membawa kutipan dari brosur; kutipan diperiksa
 * benar-benar ada di teks brosur (verifikasiBukti). Yang tidak terbukti menjadi 'cek' dan harus diputuskan
 * pengguna sebelum PDF bisa diunduh - AI tidak bisa menyelundupkan spesifikasi karangan.
 */

export const MIN_PRODUK = 2, MAKS_PRODUK = 4;
/** Batas berkas (di peramban; berkas tidak pernah diunggah ke server) & teks yang dikirim ke AI. */
export const MAKS_BYTE_BERKAS = 25_000_000, MAKS_BYTE_TOTAL = 60_000_000;
export const MAKS_KARAKTER_PRODUK = 45_000, MAKS_KARAKTER_TOTAL = 140_000;
/** Teks per halaman yang terlalu sedikit untuk dianggap ber-teks (PDF hasil scan). */
export const MIN_KARAKTER_TEKS = 80;

export type Bahasa = 'en' | 'id';
/** ada = disebut brosur; tidak-disebut = tidak ada di brosur; tidak-tersedia = brosur menyatakan tidak ada;
 *  cek = perlu ditinjau (kutipan tidak ditemukan / data bertentangan). */
export type StatusNilai = 'ada' | 'tidak-disebut' | 'tidak-tersedia' | 'cek';
export interface Bukti { halaman?: number; kutipan: string }
export interface NilaiSpek { teks: string; status: StatusNilai; unggul?: boolean; bukti?: Bukti; alasanCek?: string }
export interface BarisSpek { spesifikasi: string; nilai: NilaiSpek[] }
export interface BagianSpek { judul: string; baris: BarisSpek[] }
export interface ProdukBanding { merek: string; nama: string; judulKartu: string; deskripsi: string; berkas?: string }
export interface Sorotan { judul: string; teks: string }
export interface KartuBanding {
  bahasa: Bahasa;
  /** Eyebrow header, mis. 'PRODUCT COMPARISON — COMPACT DISPLAY 22"'. */
  kategori: string;
  judul: string;
  pengantar: string;
  /** Urutan kolom; indeks 0 = produk unggulan (RECOMMENDED). */
  produk: ProdukBanding[];
  bagian: BagianSpek[];
  /** Teks boleh memuat **tebal** (nama produk). */
  ringkasan: string;
  sorotan: Sorotan[];
  rekomendasi: string;
  catatan: string;
}

/** Label tetap template (tidak diisi AI). */
export const LABEL: Record<Bahasa, { spesifikasi: string; rekomendasiPil: string; ringkasan: string; rekomendasi: string; catatan: string; tidakDisebut: string; tidakTersedia: string }> = {
  en: { spesifikasi: 'SPECIFICATION', rekomendasiPil: 'RECOMMENDED', ringkasan: 'Summary & Recommendation', rekomendasi: 'Recommendation:', catatan: 'Note:', tidakDisebut: 'Not officially published', tidakTersedia: 'Not available' },
  id: { spesifikasi: 'SPESIFIKASI', rekomendasiPil: 'DIREKOMENDASIKAN', ringkasan: 'Ringkasan & Rekomendasi', rekomendasi: 'Rekomendasi:', catatan: 'Catatan:', tidakDisebut: 'Tidak dipublikasikan resmi', tidakTersedia: 'Tidak tersedia' },
};

/** Teks yang tampil di sel untuk sebuah nilai. */
export const teksNilai = (n: NilaiSpek, b: Bahasa) =>
  n.status === 'tidak-disebut' ? LABEL[b].tidakDisebut : n.status === 'tidak-tersedia' ? (n.teks || LABEL[b].tidakTersedia) : n.teks;

// ── Akses ─────────────────────────────────────────────────────────────────────

/** Siapa boleh memakai Product Comparison: Admin, Team, pimpinan, atau akun berizin menu Tools Team. */
export function bolehPerbandingan(u: { role?: string | null; allowed_menus?: string[] | null; pimpinan?: boolean | null } | null | undefined): boolean {
  if (!u) return false;
  const r = (u.role ?? '').toLowerCase();
  if (['admin', 'superadmin', 'team', 'team_pts'].includes(r) || u.pimpinan) return true;
  return Array.isArray(u.allowed_menus) && u.allowed_menus.includes('tools-team');
}

// ── Berkas ────────────────────────────────────────────────────────────────────

/** null = berkas boleh; string = alasan ditolak. `kepala` = beberapa byte pertama berkas. */
export function periksaBerkas(nama: string, ukuran: number, kepala: Uint8Array): string | null {
  if (ukuran <= 0) return `${nama}: berkas kosong.`;
  if (ukuran > MAKS_BYTE_BERKAS) return `${nama}: terlalu besar (maks ${MAKS_BYTE_BERKAS / 1_000_000} MB).`;
  //  Tanda tangan PDF "%PDF-" (bukan ekstensi / tipe dari nama berkas).
  const pdf = kepala.length >= 5 && kepala[0] === 0x25 && kepala[1] === 0x50 && kepala[2] === 0x44 && kepala[3] === 0x46 && kepala[4] === 0x2d;
  return pdf ? null : `${nama}: bukan PDF. Hanya brosur PDF yang didukung.`;
}

/** null = susunan berkas boleh. */
export function periksaDaftarBerkas(berkas: { nama: string; ukuran: number }[]): string | null {
  if (berkas.length < MIN_PRODUK) return `Unggah minimal ${MIN_PRODUK} brosur produk.`;
  if (berkas.length > MAKS_PRODUK) return `Maksimal ${MAKS_PRODUK} produk dalam satu perbandingan.`;
  const total = berkas.reduce((s, b) => s + b.ukuran, 0);
  if (total > MAKS_BYTE_TOTAL) return `Total ukuran brosur maks ${MAKS_BYTE_TOTAL / 1_000_000} MB.`;
  return null;
}

/** Nama berkas aman untuk unduhan: Product-Comparison-A-vs-B.pdf. */
export function namaBerkasPdf(produk: { nama: string }[]): string {
  const bersih = (s: string) => s.normalize('NFKD').replace(/[^\w.\- ]+/g, '').trim().replace(/\s+/g, '-').slice(0, 40) || 'Produk';
  return `Product-Comparison-${produk.map(p => bersih(p.nama)).join('-vs-')}.pdf`.slice(0, 180);
}

// ── Verifikasi bukti ──────────────────────────────────────────────────────────

/** Bentuk pembanding: huruf kecil, spasi & tanda baca dirapatkan, superskrip / simbol umum disamakan. */
export function normalTeks(s: string): string {
  return s.normalize('NFKC').toLowerCase()
    .replace(/[‐-―−]/g, '-').replace(/[“”„″]/g, '"').replace(/[‘’′]/g, "'")
    .replace(/[^\p{L}\p{N}%°"'.,:/+\-x]+/gu, ' ').replace(/\s+/g, ' ').trim();
}

/** Kutipan dianggap terbukti bila (bentuk normalnya) ada di teks brosur produk itu. */
export function kutipanAda(kutipan: string, sumber: string): boolean {
  const k = normalTeks(kutipan);
  return k.length >= 2 && normalTeks(sumber).includes(k);
}

// ── Validasi hasil AI ─────────────────────────────────────────────────────────

const STATUS: StatusNilai[] = ['ada', 'tidak-disebut', 'tidak-tersedia', 'cek'];
const teks = (v: unknown, maks: number) => (typeof v === 'string' ? v.replace(/[\u0000-\u0008\u000b-\u001f]/g, '').trim().slice(0, maks) : '');

/**
 * Periksa & rapikan JSON hasil AI. `sumber[i]` = teks brosur produk ke-i (urutan kolom). Nilai 'ada' tanpa
 * kutipan yang ditemukan di brosur -> 'cek'. `unggul` hanya untuk nilai 'ada'.
 */
export function periksaHasil(x: unknown, sumber: string[], bahasa: Bahasa): { ok: true; data: KartuBanding; dicek: number } | { ok: false; alasan: string } {
  const d = x as Record<string, unknown>;
  if (!d || typeof d !== 'object') return { ok: false, alasan: 'Hasil AI bukan objek JSON.' };
  const n = sumber.length;
  if (!Array.isArray(d.produk) || d.produk.length !== n) return { ok: false, alasan: `Hasil AI harus berisi tepat ${n} produk.` };
  const produk: ProdukBanding[] = d.produk.map(p => {
    const q = (p ?? {}) as Record<string, unknown>;
    return { merek: teks(q.merek, 60), nama: teks(q.nama, 80), judulKartu: teks(q.judulKartu, 100), deskripsi: teks(q.deskripsi, 420) };
  });
  if (produk.some(p => !p.nama)) return { ok: false, alasan: 'Nama produk dari AI kosong - isi nama produk secara manual lalu ulangi.' };
  if (!Array.isArray(d.bagian) || !d.bagian.length || d.bagian.length > 10) return { ok: false, alasan: 'Bagian perbandingan dari AI tidak lengkap.' };
  let dicek = 0, jumlahBaris = 0;
  const bagian: BagianSpek[] = [];
  for (const b0 of d.bagian) {
    const b = (b0 ?? {}) as Record<string, unknown>;
    const judul = teks(b.judul, 80);
    if (!judul || !Array.isArray(b.baris) || !b.baris.length) return { ok: false, alasan: 'Ada bagian tanpa judul atau tanpa baris spesifikasi.' };
    const baris: BarisSpek[] = [];
    for (const r0 of b.baris) {
      const r = (r0 ?? {}) as Record<string, unknown>;
      const spesifikasi = teks(r.spesifikasi, 80);
      if (!spesifikasi || !Array.isArray(r.nilai) || r.nilai.length !== n) return { ok: false, alasan: `Baris "${spesifikasi || '?'}" tidak berisi ${n} nilai.` };
      const nilai = r.nilai.map((v0, i): NilaiSpek => {
        const v = (v0 ?? {}) as Record<string, unknown>;
        let status = STATUS.includes(v.status as StatusNilai) ? (v.status as StatusNilai) : 'cek';
        const isi = teks(v.teks, 220);
        const bk = (v.bukti ?? {}) as Record<string, unknown>;
        const kutipan = teks(bk.kutipan, 300);
        const halaman = typeof bk.halaman === 'number' && bk.halaman > 0 && bk.halaman < 1000 ? Math.round(bk.halaman) : undefined;
        let alasanCek = status === 'cek' ? teks(v.alasanCek, 200) || (bahasa === 'id' ? 'Ditandai AI untuk ditinjau.' : 'Flagged by AI for review.') : undefined;
        if (status === 'ada' && !isi) status = 'tidak-disebut';
        if ((status === 'ada' || status === 'tidak-tersedia') && !(kutipan && kutipanAda(kutipan, sumber[i]))) {
          status = 'cek'; alasanCek = 'Kutipan sumber tidak ditemukan di brosur.';
        }
        if (status === 'cek') dicek++;
        return {
          teks: status === 'tidak-disebut' ? '' : isi, status,
          ...(status === 'ada' && v.unggul === true ? { unggul: true } : {}),
          ...(kutipan ? { bukti: { kutipan, ...(halaman ? { halaman } : {}) } } : {}),
          ...(alasanCek ? { alasanCek } : {}),
        };
      });
      baris.push({ spesifikasi, nilai });
      if (++jumlahBaris > 90) return { ok: false, alasan: 'Hasil AI terlalu panjang (maks 90 baris spesifikasi).' };
    }
    bagian.push({ judul, baris });
  }
  const sorotan = (Array.isArray(d.sorotan) ? d.sorotan : []).slice(0, 3).map(s => {
    const q = (s ?? {}) as Record<string, unknown>;
    return { judul: teks(q.judul, 60), teks: teks(q.teks, 320) };
  }).filter(s => s.judul && s.teks);
  const data: KartuBanding = {
    bahasa, kategori: teks(d.kategori, 90), judul: teks(d.judul, 140) || produk.map(p => p.nama).join(' vs '),
    pengantar: teks(d.pengantar, 900), produk, bagian, ringkasan: teks(d.ringkasan, 1400), sorotan,
    rekomendasi: teks(d.rekomendasi, 700), catatan: teks(d.catatan, 600),
  };
  return { ok: true, data, dicek };
}

/** Jumlah nilai yang masih 'cek' (PDF hanya boleh diunduh bila 0). */
export const jumlahCek = (k: KartuBanding) => k.bagian.reduce((s, b) => s + b.baris.reduce((t, r) => t + r.nilai.filter(v => v.status === 'cek').length, 0), 0);

/** Pecah teks "**tebal**" menjadi potongan biasa / tebal (untuk HTML & PDF). */
export function potongTebal(s: string): { t: string; tebal: boolean }[] {
  return s.split(/(\*\*[^*]+\*\*)/g).filter(Boolean).map(p => (p.startsWith('**') && p.endsWith('**') ? { t: p.slice(2, -2), tebal: true } : { t: p, tebal: false }));
}
