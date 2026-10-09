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
import { KATEGORI_RUANG, type KategoriRuang } from '../inti';
import type { KeadaanDesain } from '../useKeadaanDesain';
import type { IsiTemplateKategori, useAksiDesain } from '../aksi/useAksiDesain';
import type { useSimpanDesain } from './useSimpanDesain';

const API = '/api/tools-team/template-kategori';
/** Kategori yang isinya tampil saat Desain 3D pertama dibuka (contohAwal = template Ruangan Meeting). */
const KATEGORI_AWAL: KategoriRuang = 'meeting';

export interface InfoTemplateKategori { kategori: KategoriRuang; nama: string; ditetapkan_oleh_nama: string | null; updated_at: string }

const judulKategori = (id: KategoriRuang) => KATEGORI_RUANG.find(k => k.id === id)?.judul ?? id;

export function useTemplateKategori(K: KeadaanDesain, aksi: ReturnType<typeof useAksiDesain>, simpan: ReturnType<typeof useSimpanDesain>) {
  const { asal, benda, bendaRef, hanyaLihat, namaDesain, potret, riwayat, ruang, setKonfirmasi, setPesan, setStatusSimpan } = K;
  const [daftar, setDaftar] = useState<Partial<Record<KategoriRuang, InfoTemplateKategori>>>({});
  const [bolehAtur, setBolehAtur] = useState(false);
  /** Kategori yang sedang dimuat / disimpan (tombolnya dinonaktifkan). */
  const [sibuk, setSibuk] = useState<KategoriRuang | null>(null);
  const isiCache = useRef(new Map<KategoriRuang, { updated_at: string; isi: IsiTemplateKategori }>());

  const muatDaftar = useCallback(async () => {
    try {
      const r = await fetch(API, { credentials: 'include', cache: 'no-store' });
      const j = await r.json().catch(() => null);
      if (!r.ok || !j?.ok) return;
      const peta: Partial<Record<KategoriRuang, InfoTemplateKategori>> = {};
      for (const t of (j.daftar ?? []) as InfoTemplateKategori[]) peta[t.kategori] = t;
      setDaftar(peta);
      setBolehAtur(!!j.bolehAtur && !hanyaLihat);
    } catch { /* tanpa jaringan: kategori tetap memakai template bawaan */ }
  }, [hanyaLihat]);
  useEffect(() => { void muatDaftar(); }, [muatDaftar]);

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
      const t = j.template as { nama: string; updated_at: string; data: { ruang: IsiTemplateKategori['ruang']; benda: IsiTemplateKategori['benda']; layar?: Record<string, string> } } | null;
      if (!t) return 'hilang';
      const isi: IsiTemplateKategori = { nama: t.nama, ruang: t.data.ruang, benda: t.data.benda, layar: t.data.layar };
      isiCache.current.set(id, { updated_at: t.updated_at, isi });
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

  /*
    Kanvas AWAL (saat halaman dibuka / di-refresh) = template "Ruangan Meeting" bawaan kode. Dulu default
    Admin hanya dipakai saat kategori diklik, jadi setelah refresh kanvas kembali ke versi pabrikan walau
    Admin sudah menetapkan default. Sekarang: begitu daftar termuat, bila kategori awal punya default
    Admin DAN kanvas belum diubah / belum membuka berkas lain, kanvas awal memakai default Admin -
    tanpa dialog, dan riwayat Undo dimulai dari situ (Undo tidak kembali ke versi pabrikan).
  */
  const bendaAwal = useRef(benda);
  const awalDiperiksa = useRef(false);
  const mulaiRiwayat = useRef(false);
  useEffect(() => {
    const info = daftar[KATEGORI_AWAL];
    if (awalDiperiksa.current || !info) return;
    awalDiperiksa.current = true;
    if (bendaRef.current !== bendaAwal.current || asal.jenis !== 'baru') return;
    void ambilIsi(KATEGORI_AWAL, info).then(isi => {
      //  Pengguna sempat mengubah kanvas selama template diunduh: jangan ditimpa.
      if (!isi || isi === 'hilang' || bendaRef.current !== bendaAwal.current) return;
      mulaiRiwayat.current = true;
      aksi.pasangKategoriYa(KATEGORI_AWAL, isi);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [daftar]);
  useEffect(() => {
    if (!mulaiRiwayat.current) return;
    mulaiRiwayat.current = false;
    riwayat.mulaiBaru(potret);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [potret]);

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
      const r = await fetch(API, {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kategori: id, nama,
          data: { ruang, benda: simpan.bendaBersih(benda, new Set(Object.keys(layar))), ...(Object.keys(layar).length ? { layar } : {}) },
        }),
      });
      const j = await r.json().catch(() => null);
      if (!r.ok || !j?.ok) { setStatusSimpan({ teks: j?.alasan ?? 'Gagal menyimpan template default.', nada: 'galat' }); return; }
      isiCache.current.delete(id);
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
      setStatusSimpan({ teks: `"${judulKategori(id)}" kembali memakai template bawaan.`, nada: 'ok' });
      void muatDaftar();
    } catch { setStatusSimpan({ teks: 'Tidak terhubung ke server.', nada: 'galat' }); } finally { setSibuk(null); }
  };

  return { bolehAtur, daftar, jadikanDefault, kembalikanBawaan, pilihKategori, sibuk };
}
