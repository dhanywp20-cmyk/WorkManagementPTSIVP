'use client';
/**
 * Katalog "Produk saya" (template produk tim di server).
 * Bagian dari Desain3D.tsx (Tools Team) - lihat struktur di desain3d/README.md.
 */
import { useEffect } from 'react';
import { type Benda, bendaBaru, layarTerdekat, proyektorKeLayar } from '../inti';
import type { KeadaanDesain } from '../useKeadaanDesain';
import { API_PRODUK, type ProdukTimC } from '../useKeadaanDesain';


export function useProdukTim(K: KeadaanDesain) {
  const { benda, kotakRuang, produkTim, ruang, setBenda, setGalatProduk, setKonfirmasi, setPesan, setPilih, setProdukTim, sisi, targetRuang } = K;
  // ── Katalog "Produk saya" (template tim) ──
  const muatProduk = async () => {
    setGalatProduk('');
    try {
      const r = await fetch(API_PRODUK, { credentials: 'include', cache: 'no-store' });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) setProdukTim({ daftar: j.daftar as ProdukTimC[], bolehTambah: j.bolehTambah !== false });
      else setGalatProduk(j?.alasan ?? 'Gagal memuat Produk saya.');
    } catch { setGalatProduk('Tidak terhubung ke server.'); }
  };
  useEffect(() => { if (sisi === 'tambah' && !produkTim) void muatProduk(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [sisi]);
  /** Benda dari template: ukuran & tinggi pasang dari template, posisi bawaan di ruang tujuan. */
  const tambahProduk = (p: ProdukTimC) => {
    const k = kotakRuang[Number(targetRuang)] ?? kotakRuang[0];
    const atur = p.atur as Partial<Benda>;
    const b0 = bendaBaru(p.jenis, k, atur);
    const b1: Benda = { ...b0, w: atur.w ?? b0.w, h: atur.h ?? b0.h, d: atur.d ?? b0.d, elev: atur.elev ?? b0.elev, nama: atur.nama ?? p.label };
    const layar = b1.jenis === 'proyektor' ? layarTerdekat(b1, benda, ruang) : null;
    const b = layar ? proyektorKeLayar(b1, layar, k, ruang) : b1;
    setBenda(bs => [...bs, b]); setPilih(b.id);
  };
  const simpanProduk = async (b: Benda, label: string, ket: string): Promise<string | null> => {
    //  Posisi & id tidak ikut; konten 'gambar' (unggahan) tidak bisa jadi template.
    const { id: _id, x: _x, z: _z, rot: _r, modelKunci: _m, konten, ...atur } = b;
    void _id; void _x; void _z; void _r; void _m;
    try {
      const r = await fetch(API_PRODUK, {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label, ket, jenis: b.jenis, atur: { ...atur, ...(konten === 'mati' ? { konten } : {}) } }),
      });
      const j = await r.json().catch(() => null);
      if (!r.ok || !j?.ok) return j?.alasan ?? 'Gagal menyimpan produk.';
      setProdukTim(v => ({ daftar: [j.produk as ProdukTimC, ...(v?.daftar ?? [])], bolehTambah: true }));
      setPesan(`"${label}" tersimpan di Produk saya (Tambah → Produk saya).`);
      return null;
    } catch { return 'Tidak terhubung ke server.'; }
  };
  const hapusProduk = (p: ProdukTimC) => setKonfirmasi({
    message: `Hapus "${p.label}" dari Produk saya?`, danger: true, confirmLabel: 'Hapus',
    description: 'Seluruh tim tidak bisa memakainya lagi (benda yang sudah ada di desain tidak berubah).',
    onConfirm: () => void hapusProdukYa(p),
  });
  const hapusProdukYa = async (p: ProdukTimC) => {
    const r = await fetch(`${API_PRODUK}?id=${encodeURIComponent(p.id)}`, { method: 'DELETE', credentials: 'include' }).catch(() => null);
    const j = await r?.json().catch(() => null);
    if (!r?.ok || !j?.ok) { setGalatProduk(j?.alasan ?? 'Gagal menghapus.'); return; }
    setProdukTim(v => v && { ...v, daftar: v.daftar.filter(x => x.id !== p.id) });
  };

  return { hapusProduk, hapusProdukYa, muatProduk, simpanProduk, tambahProduk };
}
