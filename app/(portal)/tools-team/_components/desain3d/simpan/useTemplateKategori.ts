'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { contohAwal, KATEGORI_RUANG, type KategoriRuang } from '../inti';
import { RUANG_AWAL, type KeadaanDesain } from '../useKeadaanDesain';
import type { IsiTemplateKategori, useAksiDesain } from '../aksi/useAksiDesain';
import type { useSimpanDesain } from './useSimpanDesain';
import { isiDariIngatan, KATEGORI_AWAL, tulisIngatanAwal } from './templateAwal';
import { daftarkanTekstur, teksturUntukSimpan } from './teksturRuang';
import { muatGambarLayar } from './aset';

const API = '/api/tools-team/template-kategori';
const BATAS_TUNGGU_MS = 12000;

export interface InfoTemplateKategori { kategori: KategoriRuang; nama: string; ditetapkan_oleh_nama: string | null; updated_at: string }
type BarisTemplate = InfoTemplateKategori & { data: { ruang: IsiTemplateKategori['ruang']; benda: IsiTemplateKategori['benda']; layar?: Record<string, string>; tekstur?: Record<string, string> } };

const judulKategori = (id: KategoriRuang) => KATEGORI_RUANG.find(k => k.id === id)?.judul ?? id;
const isiDari = (t: BarisTemplate): IsiTemplateKategori => ({ nama: t.nama, ruang: t.data.ruang, benda: t.data.benda, layar: t.data.layar, tekstur: t.data.tekstur });

export function useTemplateKategori(K: KeadaanDesain, aksi: ReturnType<typeof useAksiDesain>, simpan: ReturnType<typeof useSimpanDesain>) {
  const { asal, benda, bendaRef, gambarLayar, hanyaLihat, ingatanAwal, mesin, namaDesain, pasSetelahTemplate, potret, riwayat, ruang, ruangRef, setAsal, setBenda,
    setKonfirmasi, setNamaDesain, setPesan, setRuang, setStatusSimpan, setVersiGambar, siap } = K;
  const [daftar, setDaftar] = useState<Partial<Record<KategoriRuang, InfoTemplateKategori>>>({});
  const [bolehAtur, setBolehAtur] = useState(false);
  const [sibuk, setSibuk] = useState<KategoriRuang | null>(null);
  const isiCache = useRef(new Map<KategoriRuang, { updated_at: string; isi: IsiTemplateKategori }>());

  const [menungguAwal, setMenungguAwal] = useState(!isiDariIngatan(ingatanAwal));
  const awalSelesai = useRef(false);
  const bendaAwal = useRef(benda);
  const asalAwal = useRef(asal);
  const asalRef = useRef(asal); asalRef.current = asal;
  const mulaiRiwayat = useRef(false);
  const layarTertunda = useRef<Record<string, string> | null>(isiDariIngatan(ingatanAwal)?.layar ?? null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { daftarkanTekstur(K, isiDariIngatan(ingatanAwal)?.tekstur); }, []);
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
        pasSetelahTemplate.current = 'langsung';
      }
    } else {
      tulisIngatanAwal({ kosong: true });
      if (ingat && belumDiubah()) {
        mulaiRiwayat.current = true;
        layarTertunda.current = null;
        ruangRef.current = RUANG_AWAL;
        setRuang(RUANG_AWAL); setBenda(contohAwal(RUANG_AWAL)); setNamaDesain('Ruang Meeting'); setAsal({ jenis: 'baru' });
      }
    }
  };
  const selesaiAwal = () => {
    if (awalSelesai.current) return;
    awalSelesai.current = true;
    requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(() => setMenungguAwal(false), 150)));
  };
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
    } catch {  } finally {
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

  useEffect(() => {
    const m = mesin.current, layar = layarTertunda.current;
    if (!siap || !m || !layar) return;
    layarTertunda.current = null;
    for (const [idL, url] of Object.entries(layar)) {
      muatGambarLayar(m, idL, url, gambarLayar.current, () => setVersiGambar(v => v + 1));
    }
  }, [siap, menungguAwal, mesin, gambarLayar, setVersiGambar]);

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
      const tekstur = teksturUntukSimpan(K, ruang);
      const data = { ruang, benda: simpan.bendaBersih(benda, new Set(Object.keys(layar))), ...(Object.keys(layar).length ? { layar } : {}), ...(Object.keys(tekstur).length ? { tekstur } : {}) };
      const r = await fetch(API, {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kategori: id, nama, data }),
      });
      const j = await r.json().catch(() => null);
      if (!r.ok || !j?.ok) { setStatusSimpan({ teks: j?.alasan ?? 'Gagal menyimpan template default.', nada: 'galat' }); return; }
      isiCache.current.delete(id);
      if (id === KATEGORI_AWAL && j.template?.updated_at) tulisIngatanAwal({ updated_at: j.template.updated_at, isi: { nama, ...data } });
      setStatusSimpan({ teks: `Isi kanvas sekarang menjadi template default "${judulKategori(id)}" untuk semua pengguna.`, nada: 'ok' });
      void muatDaftar();
    } catch { setStatusSimpan({ teks: 'Tidak terhubung ke server.', nada: 'galat' }); } finally { setSibuk(null); }
  };

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
