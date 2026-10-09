'use client';
/**
 * Template default per kategori ruangan yang ditetapkan Admin (Tools Team > Desain 3D).
 *
 * Admin / Full Access bisa menjadikan isi kanvasnya template default sebuah kategori; siapa pun yang
 * memilih kategori itu lalu mendapat isi tersebut alih-alih template bawaan kode. Tetap "terkunci":
 * yang dipasang ke kanvas hanya salinan - Simpan selalu membuat file baru milik pengguna.
 *
 * Daftar ringkas (kategori mana yang punya template Admin) dimuat sekali; isi lengkapnya baru diambil
 * saat kategorinya dipilih, lalu diingat selama `updated_at`-nya sama (hemat egress).
 * Server: /api/tools-team/template-kategori (migrasi 039). Bagian dari Desain3D.tsx - lihat README.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { contohAwal, KATEGORI_RUANG, type KategoriRuang } from '../inti';
import { RUANG_AWAL, type KeadaanDesain } from '../useKeadaanDesain';
import type { IsiTemplateKategori, useAksiDesain } from '../aksi/useAksiDesain';
import type { useSimpanDesain } from './useSimpanDesain';
import { isiDariIngatan, KATEGORI_AWAL, tulisIngatanAwal } from './templateAwal';

const API = '/api/tools-team/template-kategori';
/** Batas tunggu lapisan "Memuat template" saat server lambat - sesudahnya kanvas dibuka apa adanya. */
const BATAS_TUNGGU_MS = 6000;

export interface InfoTemplateKategori { kategori: KategoriRuang; nama: string; ditetapkan_oleh_nama: string | null; updated_at: string }
type BarisTemplate = InfoTemplateKategori & { data: { ruang: IsiTemplateKategori['ruang']; benda: IsiTemplateKategori['benda']; layar?: Record<string, string> } };

const judulKategori = (id: KategoriRuang) => KATEGORI_RUANG.find(k => k.id === id)?.judul ?? id;
const isiDari = (t: BarisTemplate): IsiTemplateKategori => ({ nama: t.nama, ruang: t.data.ruang, benda: t.data.benda, layar: t.data.layar });

export function useTemplateKategori(K: KeadaanDesain, aksi: ReturnType<typeof useAksiDesain>, simpan: ReturnType<typeof useSimpanDesain>) {
  const { asal, benda, bendaRef, gambarLayar, hanyaLihat, ingatanAwal, mesin, namaDesain, potret, riwayat, ruang, ruangRef, setAsal, setBenda,
    setKonfirmasi, setNamaDesain, setPesan, setRuang, setStatusSimpan, setVersiGambar, siap } = K;
  const [daftar, setDaftar] = useState<Partial<Record<KategoriRuang, InfoTemplateKategori>>>({});
  const [bolehAtur, setBolehAtur] = useState(false);
  /** Kategori yang sedang dimuat / disimpan (tombolnya dinonaktifkan). */
  const [sibuk, setSibuk] = useState<KategoriRuang | null>(null);
  const isiCache = useRef(new Map<KategoriRuang, { updated_at: string; isi: IsiTemplateKategori }>());

  /*
    Kanvas AWAL (halaman dibuka / di-refresh).

    Dulu: kanvas selalu mulai dari template pabrikan, lalu sesudah DUA permintaan berurutan (daftar,
    lalu isi) baru diganti default Admin - pengguna melihat versi pabrikan, layar tersendat, lalu
    melompat ke default Admin.

    Sekarang:
      - Perangkat yang sudah pernah memuat ingat isi default Admin (simpan/templateAwal.ts):
        useKeadaanDesain langsung membuka kanvas dengan isi itu. Server hanya dicek di belakang.
      - Perangkat yang belum pernah: kanvas ditutup lapisan "Memuat template" sampai server menjawab
        (satu permintaan - daftar + isi kategori awal sekaligus lewat ?awal=), jadi versi pabrikan
        tidak pernah terlihat.
      - Admin mengubah / mengembalikan bawaan sejak kunjungan terakhir: kanvas mengikuti server,
        selama pengguna belum mengubah kanvas atau membuka berkas lain.
    Riwayat Undo dimulai dari isi awal itu (Undo tidak kembali ke versi pabrikan).
  */
  const [menungguAwal, setMenungguAwal] = useState(ingatanAwal === null);
  const awalSelesai = useRef(false);
  const bendaAwal = useRef(benda);
  const asalAwal = useRef(asal);
  const asalRef = useRef(asal); asalRef.current = asal;
  const mulaiRiwayat = useRef(false);
  /** Gambar konten layar template awal yang menunggu mesin 3D siap (tekstur butuh THREE). */
  const layarTertunda = useRef<Record<string, string> | null>(isiDariIngatan(ingatanAwal)?.layar ?? null);
  const belumDiubah = () => bendaRef.current === bendaAwal.current && asalRef.current === asalAwal.current;

  const terapkanAwal = (t: BarisTemplate | null) => {
    const ingat = isiDariIngatan(ingatanAwal) ? ingatanAwal as { updated_at: string } : null;
    if (t) {
      const isi = isiDari(t);
      isiCache.current.set(KATEGORI_AWAL, { updated_at: t.updated_at, isi });
      tulisIngatanAwal({ updated_at: t.updated_at, isi });
      if (ingat?.updated_at !== t.updated_at && belumDiubah()) {
        mulaiRiwayat.current = true;
        if (!mesin.current) layarTertunda.current = isi.layar ?? null;
        aksi.pasangKategoriYa(KATEGORI_AWAL, isi);
      }
    } else {
      tulisIngatanAwal({ kosong: true });
      //  Ingatan memuat default Admin yang sudah dihapus: kembali ke kanvas pabrikan.
      if (ingat && belumDiubah()) {
        mulaiRiwayat.current = true;
        layarTertunda.current = null;
        ruangRef.current = RUANG_AWAL;
        setRuang(RUANG_AWAL); setBenda(contohAwal(RUANG_AWAL)); setNamaDesain('Ruang Meeting'); setAsal({ jenis: 'baru' });
      }
    }
  };
  const selesaiAwal = () => { awalSelesai.current = true; setMenungguAwal(false); };
  useEffect(() => {
    if (!menungguAwal) return;
    const t = setTimeout(selesaiAwal, BATAS_TUNGGU_MS);
    return () => clearTimeout(t);
  }, [menungguAwal]);

  const muatDaftar = useCallback(async () => {
    const pertama = !awalSelesai.current;
    try {
      const r = await fetch(pertama ? `${API}?awal=${KATEGORI_AWAL}` : API, { credentials: 'include', cache: 'no-store' });
      const j = await r.json().catch(() => null);
      if (!r.ok || !j?.ok) return;
      const peta: Partial<Record<KategoriRuang, InfoTemplateKategori>> = {};
      for (const t of (j.daftar ?? []) as InfoTemplateKategori[]) peta[t.kategori] = t;
      setDaftar(peta);
      setBolehAtur(!!j.bolehAtur && !hanyaLihat);
      if (pertama && !awalSelesai.current && 'awal' in j) terapkanAwal(j.awal as BarisTemplate | null);
    } catch { /* tanpa jaringan: kategori tetap memakai template bawaan */ } finally {
      if (pertama) selesaiAwal();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hanyaLihat]);
  useEffect(() => { void muatDaftar(); }, [muatDaftar]);

  useEffect(() => {
    if (!mulaiRiwayat.current) return;
    mulaiRiwayat.current = false;
    riwayat.mulaiBaru(potret);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [potret]);

  //  Tekstur layar template awal dipasang begitu mesin 3D siap.
  useEffect(() => {
    const m = mesin.current, layar = layarTertunda.current;
    if (!siap || !m || !layar) return;
    layarTertunda.current = null;
    for (const [idL, url] of Object.entries(layar)) {
      new m.THREE.TextureLoader().load(url, tex => { tex.colorSpace = m.THREE.SRGBColorSpace; gambarLayar.current.set(idL, tex); setVersiGambar(v => v + 1); });
    }
  }, [siap, menungguAwal, mesin, gambarLayar, setVersiGambar]);

  /**
   * Isi lengkap template Admin kategori `id` (diingat selama updated_at sama). null = gagal dimuat;
   * 'hilang' = sudah dihapus Admin lain sejak daftar dimuat.
   */
  const ambilIsi = async (id: KategoriRuang, info: InfoTemplateKategori): Promise<IsiTemplateKategori | null | 'hilang'> => {
    const ingat = isiCache.current.get(id);
    if (ingat && ingat.updated_at === info.updated_at) return ingat.isi;
    try {
      const r = await fetch(`${API}?kategori=${encodeURIComponent(id)}`, { credentials: 'include', cache: 'no-store' });
      const j = await r.json().catch(() => null);
      if (!r.ok || !j?.ok) return null;
      const t = j.template as BarisTemplate | null;
      if (!t) return 'hilang';
      const isi = isiDari(t);
      isiCache.current.set(id, { updated_at: t.updated_at, isi });
      if (id === KATEGORI_AWAL) tulisIngatanAwal({ updated_at: t.updated_at, isi });
      return isi;
    } catch { return null; }
  };

  /** Pilih kategori: template Admin bila ada, selain itu template bawaan kode. */
  const pilihKategori = async (id: KategoriRuang) => {
    const info = daftar[id];
    if (!info) { aksi.pasangKategori(id); return; }
    setSibuk(id);
    try {
      const isi = await ambilIsi(id, info);
      if (isi === 'hilang') { aksi.pasangKategori(id); void muatDaftar(); return; }
      if (!isi) { setPesan(`Template Admin "${judulKategori(id)}" tidak bisa dimuat - memakai template bawaan.`); aksi.pasangKategori(id); return; }
      aksi.pasangKategori(id, isi);
    } finally { setSibuk(null); }
  };

  /** Admin: jadikan isi kanvas sekarang template default kategori `id`. */
  const jadikanDefault = (id: KategoriRuang) => {
    if (!benda.length) { setStatusSimpan({ teks: 'Kanvas masih kosong - susun desainnya dulu sebelum dijadikan template.', nada: 'galat' }); return; }
    setKonfirmasi({
      message: `Jadikan isi kanvas template default "${judulKategori(id)}"?`, confirmLabel: 'Jadikan default',
      description: `Semua pengguna yang memilih kategori ini akan mendapat isi kanvas Anda sekarang${daftar[id] ? ', menggantikan template Admin sebelumnya' : ''}. Template bawaan aplikasi tetap bisa dikembalikan kapan saja.`,
      onConfirm: () => void jadikanDefaultYa(id),
    });
  };
  const jadikanDefaultYa = async (id: KategoriRuang) => {
    setSibuk(id); setStatusSimpan(null);
    try {
      const layar = simpan.gambarLayarServer(benda);
      const nama = namaDesain.replace(/\s*\(salinan\)\s*$/i, '').trim() || judulKategori(id);
      const data = { ruang, benda: simpan.bendaBersih(benda, new Set(Object.keys(layar))), ...(Object.keys(layar).length ? { layar } : {}) };
      const r = await fetch(API, {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kategori: id, nama, data }),
      });
      const j = await r.json().catch(() => null);
      if (!r.ok || !j?.ok) { setStatusSimpan({ teks: j?.alasan ?? 'Gagal menyimpan template default.', nada: 'galat' }); return; }
      isiCache.current.delete(id);
      //  Perangkat Admin sendiri langsung memakai default barunya saat di-refresh.
      if (id === KATEGORI_AWAL && j.template?.updated_at) tulisIngatanAwal({ updated_at: j.template.updated_at, isi: { nama, ...data } });
      setStatusSimpan({ teks: `Isi kanvas sekarang menjadi template default "${judulKategori(id)}" untuk semua pengguna.`, nada: 'ok' });
      void muatDaftar();
    } catch { setStatusSimpan({ teks: 'Tidak terhubung ke server.', nada: 'galat' }); } finally { setSibuk(null); }
  };

  /** Admin: hapus template Admin kategori `id` - kembali ke template bawaan kode. */
  const kembalikanBawaan = (id: KategoriRuang) => setKonfirmasi({
    message: `Kembalikan "${judulKategori(id)}" ke template bawaan?`, danger: true, confirmLabel: 'Kembalikan',
    description: 'Template default dari Admin dihapus; pengguna kembali mendapat template bawaan aplikasi. Desain di kanvas tidak berubah.',
    onConfirm: () => void kembalikanBawaanYa(id),
  });
  const kembalikanBawaanYa = async (id: KategoriRuang) => {
    setSibuk(id); setStatusSimpan(null);
    try {
      const r = await fetch(`${API}?kategori=${encodeURIComponent(id)}`, { method: 'DELETE', credentials: 'include' });
      const j = await r.json().catch(() => null);
      if (!r.ok || !j?.ok) { setStatusSimpan({ teks: j?.alasan ?? 'Gagal mengembalikan template bawaan.', nada: 'galat' }); return; }
      isiCache.current.delete(id);
      if (id === KATEGORI_AWAL) tulisIngatanAwal({ kosong: true });
      setStatusSimpan({ teks: `"${judulKategori(id)}" kembali memakai template bawaan.`, nada: 'ok' });
      void muatDaftar();
    } catch { setStatusSimpan({ teks: 'Tidak terhubung ke server.', nada: 'galat' }); } finally { setSibuk(null); }
  };

  return { bolehAtur, daftar, jadikanDefault, kembalikanBawaan, menungguAwal, pilihKategori, sibuk };
}
