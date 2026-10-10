'use client';
/**
 * Simpan & buka: laptop (.glb), server tim (versi, gambar layar), salinan lokal lama.
 * Bagian dari Desain3D.tsx (Tools Team) - lihat struktur di desain3d/README.md.
 */
import { useEffect } from 'react';
import { unduhUrl } from '../../bersama/cetak';
import { type Benda, idBaru, type Ruang } from '../inti';
import { denganLegendaSamping } from '../panel/LegendaKabel';
import { bacaDesainGLB, dataDesainFile, KUNCI_DESAIN, namaFileDesain } from './file-glb';
import { daftarkanTekstur, teksturUntukFile, teksturUntukSimpan } from './teksturRuang';
import { muatGambarLayar } from './aset';
import type * as T from 'three';
import type { KeadaanDesain } from '../useKeadaanDesain';
import { ambilKunci, type DesainTim, KUNCI_SIMPAN, RUANG_AWAL } from '../useKeadaanDesain';


export function useSimpanDesain(K: KeadaanDesain) {
  const { asideRef, benda, bendaRef, desainAktif, gambarLayar, impor, legendaKabel, mesin, modal, modelImpor, namaDesain, panel, pilih, riwayat, ruang, ruangRef, setAsal, setBenda, setDaftarTim, setDasar, setDesainAktif, setGalat, setKonfirmasi, setLihatVersi, setModal, setNamaDesain, setPesan, setPilih, setRuang, setSibukSimpan, setStatusSimpan, setTersimpan, setVersiGambar, sisi, tersimpan } = K;
  /** Gambar layar unggahan -> data URL JPEG (maks 1920 px) supaya ikut tersimpan di file laptop. */
  const gambarKeDataUrl = (t: T.Texture): string | null => {
    try {
      const img = t.image as { width: number; height: number } & CanvasImageSource;
      if (!img?.width) return null;
      const skala = Math.min(1, 1920 / img.width);
      const c = document.createElement('canvas'); c.width = Math.round(img.width * skala); c.height = Math.round(img.height * skala);
      c.getContext('2d')?.drawImage(img, 0, 0, c.width, c.height);
      return c.toDataURL('image/jpeg', 0.88);
    } catch { return null; }
  };

  /**
   * Simpan ke laptop (.glb): geometri ruang & benda (bisa dibuka SketchUp /
   * Blender) + data desain di extras supaya bisa dibuka & diedit lagi di sini.
   * Tidak memakai storage server sama sekali.
   */
  const simpanKeLaptop = () => {
    const m = mesin.current; if (!m) return;
    const isi = new m.THREE.Group();
    isi.name = namaDesain || 'Desain AV';
    isi.add(m.grupRuang.clone(true), m.grupBenda.clone(true));
    isi.traverse(o => {
      if (o.userData.sorot) o.visible = false;
      //  Tekstur tanpa transparansi (kayu, kain, pola layar, lantai) disimpan
      //  sebagai JPEG, bukan PNG bawaan exporter - file jauh lebih kecil.
      const mats = (o as T.Mesh).material;
      for (const mt of Array.isArray(mats) ? mats : mats ? [mats] : []) {
        if (mt.transparent) continue;
        for (const v of Object.values(mt)) if (v instanceof m.THREE.Texture) v.userData.mimeType = 'image/jpeg';
      }
    });
    const gambar: Record<string, string> = {};
    for (const b of benda) {
      if (b.konten !== 'gambar') continue;
      const t = gambarLayar.current.get(b.id); const url = t ? gambarKeDataUrl(t) : null;
      if (url) gambar[b.id] = url;
    }
    isi.userData = { [KUNCI_DESAIN]: dataDesainFile(namaDesain || 'Desain AV', ruang, benda, gambar, teksturUntukFile(K, ruang)) };
    new m.GLTFExporter().parse(isi, hasil => {
      const blob = new Blob([hasil as ArrayBuffer], { type: 'model/gltf-binary' });
      const url = URL.createObjectURL(blob);
      unduhUrl(url, namaFileDesain(namaDesain));
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
      setPesan(`Tersimpan di laptop: ${namaFileDesain(namaDesain)} (${(blob.size / 1048576).toFixed(1)} MB)`);
      if (!desainAktif) { setAsal({ jenis: 'laptop', nama: namaFileDesain(namaDesain) }); setDasar(ambilKunci(ruangRef.current, bendaRef.current, namaDesain)); }
    }, () => setGalat('Simpan ke laptop gagal.'), { binary: true, maxTextureSize: 1024 });
  };
  const unduhGLB = simpanKeLaptop;

  /** Buka desain .glb dari laptop. File .glb lain (model produk) ditawarkan sebagai benda baru. */
  const bukaDariLaptop = async (file: File | null) => {
    const m = mesin.current; if (!file || !m) return;
    if (file.size > 80 * 1024 * 1024) { setGalat('File terlalu besar (maks 80 MB).'); return; }
    let buf: ArrayBuffer;
    try { buf = await file.arrayBuffer(); } catch { setGalat('File tidak bisa dibaca.'); return; }
    const d = bacaDesainGLB(buf);
    if (!d) {
      setKonfirmasi({ message: 'File ini bukan desain dari Tools Team.', confirmLabel: 'Tambahkan',
        description: 'Mungkin model produk. Tambahkan sebagai model 3D ke ruangan?', onConfirm: () => void impor.imporBerkas([file]) });
      return;
    }
    const namaBerkas = file.name;
    const pasang = (bendaBaru: Benda[]) => {
      const rb = { ...RUANG_AWAL, ...d.ruang };
      ruangRef.current = rb;
      setRuang(rb); setBenda(bendaBaru); setNamaDesain(d.nama);
      setAsal({ jenis: 'laptop', nama: namaBerkas }); setDasar(ambilKunci(rb, bendaBaru, d.nama));
      riwayat.mulaiBaru({ ruang: rb, benda: bendaBaru });
      setDesainAktif(null); setLihatVersi(null); setPilih(null); setModal(null); setGalat('');
      setPesan(`Dibuka dari laptop: ${d.nama}`);
    };
    daftarkanTekstur(K, d.tekstur);
    //  Gambar layar unggahan dikembalikan sebagai tekstur.
    for (const [id, url] of Object.entries(d.gambar ?? {})) {
      new m.THREE.TextureLoader().load(url, tex => {
        tex.colorSpace = m.THREE.SRGBColorSpace;
        gambarLayar.current.set(id, tex);
        setVersiGambar(v => v + 1);
      });
    }
    //  Model GLB impor: ambil kembali geometrinya dari file yang sama (node ber-id benda itu).
    const adaModel = d.benda.some(b => b.jenis === 'model');
    if (!adaModel) { pasang(d.benda); return; }
    new m.GLTFLoader().parse(buf, '', g => {
      const bendaBaru = d.benda.map(b => {
        if (b.jenis !== 'model') return b;
        let node: T.Object3D | null = null;
        g.scene.traverse(o => { if (!node && o.userData?.id === b.id) node = o; });
        if (!node) return { ...b, modelKunci: undefined };
        const src = (node as T.Object3D).clone(true);
        src.position.set(0, 0, 0); src.rotation.set(0, 0, 0); src.scale.set(1, 1, 1);
        const kunci = idBaru(); modelImpor.current.set(kunci, src);
        //  Rotasi tegak sudah tertanam di simpul berkas: jangan diputar lagi, ukuran berkas ikut posisi tegaknya.
        const tegak = Math.abs(Math.round((b.putarModel ?? 0) / 90)) % 2 === 1;
        const uf = b.ukuranFile && tegak ? [b.ukuranFile[0], b.ukuranFile[2], b.ukuranFile[1]] as [number, number, number] : b.ukuranFile;
        return { ...b, modelKunci: kunci, putarModel: undefined, ukuranFile: uf };
      });
      pasang(bendaBaru);
    }, () => pasang(d.benda.map(b => (b.jenis === 'model' ? { ...b, modelKunci: undefined } : b))));
  };
  const tulisSimpanan = (daftar: typeof tersimpan) => {
    setTersimpan(daftar);
    try { localStorage.setItem(KUNCI_SIMPAN, JSON.stringify(daftar)); } catch { /* abaikan */ }
  };
  // Gambar layar & model impor hanya ada di memori - disimpan sebagai pola uji / kotak.
  const bendaBersih = (bs: Benda[], ada: Set<string> = new Set()) => bs.map(b => ({ ...b, konten: b.konten === 'gambar' && !ada.has(b.id) ? 'pola' as const : b.konten }));
  /**
   * Gambar konten layar untuk server: JPEG maks 1280 px, kualitas diturunkan sampai <= 150 KB
   * (hemat kuota Supabase); maks 6 gambar per desain. Yang tidak muat tetap jadi pola uji.
   */
  const gambarLayarServer = (bs: Benda[]): Record<string, string> => {
    const hasil: Record<string, string> = {};
    for (const b of bs) {
      if (b.konten !== 'gambar' || Object.keys(hasil).length >= 6) continue;
      const t = gambarLayar.current.get(b.id);
      //  Gambar yang dibuka dari server (ref) dan tidak diganti: kirim ref-nya, jangan kompres & unggah ulang.
      if (typeof t?.userData.ref === 'string') { hasil[b.id] = t.userData.ref; continue; }
      const img = t?.image as ({ width: number; height: number } & CanvasImageSource) | undefined;
      if (!img?.width) continue;
      try {
        const skala = Math.min(1, 1280 / img.width);
        const cv = document.createElement('canvas'); cv.width = Math.round(img.width * skala); cv.height = Math.round(img.height * skala);
        cv.getContext('2d')?.drawImage(img, 0, 0, cv.width, cv.height);
        for (const q of [0.8, 0.68, 0.55, 0.42]) { const u = cv.toDataURL('image/jpeg', q); if (u.length <= 195_000) { hasil[b.id] = u; break; } }
      } catch { /* gambar lintas domain: lewati */ }
    }
    return hasil;
  };

  // ── Desain tim di server ──
  const API_DESAIN = '/api/tools-team/desain';
  const muatDaftarTim = async () => {
    try {
      const r = await fetch(API_DESAIN, { credentials: 'include', cache: 'no-store' });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok) setDaftarTim(j.daftar as DesainTim[]);
      else { setDaftarTim([]); setStatusSimpan({ teks: j?.alasan ?? 'Daftar desain tim tidak bisa dimuat.', nada: 'galat' }); }
    } catch { setDaftarTim([]); setStatusSimpan({ teks: 'Tidak terhubung ke server.', nada: 'galat' }); }
  };
  useEffect(() => { if (modal === 'simpan') void muatDaftarTim(); }, [modal]);
  useEffect(() => {
    if ((sisi || panel) && window.innerWidth < 1024) asideRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [sisi, panel]);

  /**
   * Gambar desain dari sudut kamera sekarang tanpa gizmo/sorotan: pratinjau
   * kecil (480 px) untuk daftar, dan versi tajam (±1600 px, dirender 2x) untuk
   * cetak/ZIP Request Design. Kualitas JPEG diturunkan bila melebihi batas.
   */
  const pratinjau = (): { kecil: string | null; hd: string | null } => {
    const m = mesin.current; if (!m) return { kecil: null, hd: null };
    const rasioLama = m.renderer.getPixelRatio();
    const sorot = m.grupBenda.children.filter(o => o.userData.sorot);
    try {
      m.gizmo.detach(); sorot.forEach(o => { o.visible = false; });
      m.renderer.setPixelRatio(Math.min(3, Math.max(2, rasioLama * 2)));
      m.renderer.render(m.scene, m.kamera);
      const src = m.renderer.domElement;
      const jadi = (lebar: number, maks: number, legenda = false) => {
        const w = Math.min(lebar, src.width), h = Math.max(1, Math.round((w * src.height) / Math.max(1, src.width)));
        const c0 = document.createElement('canvas'); c0.width = w; c0.height = h;
        const g = c0.getContext('2d'); if (!g) return null;
        g.imageSmoothingQuality = 'high'; g.drawImage(src, 0, 0, w, h);
        //  Gambar HD (cetak / ZIP Request Design) ikut aturan legend kabel yang sama dengan PNG.
        const c = legenda && legendaKabel ? denganLegendaSamping(c0, legendaKabel, w / Math.max(1, src.clientWidth || w)) : c0;
        for (const q of [0.86, 0.74, 0.6, 0.45]) { const u = c.toDataURL('image/jpeg', q); if (u.length <= maks) return u; }
        return null;
      };
      //  Data URL base64 ±1,33x ukuran JPEG; batas di server 80 KB / 560 KB.
      return { kecil: jadi(400, 78_000), hd: jadi(1400, 550_000, true) };
    } catch { return { kecil: null, hd: null }; } finally {
      m.renderer.setPixelRatio(rasioLama);
      sorot.forEach(o => { o.visible = true; });
      if (pilih) { const o = m.cache.get(pilih)?.obj; if (o) m.gizmo.attach(o); }
    }
  };

  /** Simpan ke server = versi baru. Desain milik orang lain (atau `baru`) disimpan sebagai salinan. */
  const simpanServer = async (baru: boolean, sumber?: { nama: string; ruang: Ruang; benda: Benda[] }) => {
    const nama = (sumber?.nama ?? namaDesain).trim() || 'Tanpa nama';
    const timpa = !sumber && !baru && desainAktif?.bolehUbah ? desainAktif.id : undefined;
    setSibukSimpan(true); setStatusSimpan(null);
    try {
      const layar = sumber ? {} : gambarLayarServer(benda);
      const tekstur = sumber ? {} : teksturUntukSimpan(K, ruang);
      const r = await fetch(API_DESAIN, {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: timpa, versi: timpa ? desainAktif?.versi : undefined, nama,
          data: { ruang: sumber?.ruang ?? ruang, benda: bendaBersih(sumber?.benda ?? benda, new Set(Object.keys(layar))), ...(Object.keys(layar).length ? { layar } : {}), ...(Object.keys(tekstur).length ? { tekstur } : {}) },
          ...(sumber ? {} : (({ kecil, hd }) => ({ gambar: kecil ?? undefined, gambar_hd: hd ?? undefined }))(pratinjau())),
        }),
      });
      const j = await r.json().catch(() => null);
      if (!r.ok || !j?.ok) { setStatusSimpan({ teks: j?.alasan ?? 'Gagal menyimpan.', nada: 'galat' }); return false; }
      if (!sumber) {
        setDesainAktif({ id: j.desain.id, bolehUbah: true, versi: j.desain.versi });
        setLihatVersi(null);
        setAsal({ jenis: 'baru' }); setDasar(ambilKunci(ruang, benda, namaDesain));
        const salinan = !timpa && !!desainAktif && !baru;
        setStatusSimpan({
          teks: timpa ? `Perubahan tersimpan sebagai v${j.desain.versi}.` : salinan ? 'Desain milik orang lain - disimpan sebagai salinan Anda (v1).' : 'Tersimpan di server (v1).',
          nada: 'ok',
        });
      }
      void muatDaftarTim();
      return true;
    } catch { setStatusSimpan({ teks: 'Tidak terhubung ke server.', nada: 'galat' }); return false; } finally { setSibukSimpan(false); }
  };

  /** Buka desain tim (versi terbaru, atau `versi` tertentu dari riwayat). */
  const bukaTim = async (id: string, versi?: number) => {
    setSibukSimpan(true); setStatusSimpan(null);
    try {
      const r = await fetch(`${API_DESAIN}?id=${encodeURIComponent(id)}${versi ? `&versi=${versi}` : ''}`, { credentials: 'include', cache: 'no-store' });
      const j = await r.json().catch(() => null);
      if (!r.ok || !j?.ok) {
        const teks = j?.alasan ?? 'Desain tidak bisa dibuka.';
        setStatusSimpan({ teks, nada: 'galat' }); setPesan(teks); return;
      }
      const d = j.desain as { id: string; nama: string; versi: number; versiTerbaru: number; data: { ruang: Ruang; benda: Benda[]; layar?: Record<string, string>; tekstur?: Record<string, string> }; bolehUbah: boolean };
      const ruangBaru = { ...RUANG_AWAL, ...d.data.ruang };
      daftarkanTekstur(K, d.data.tekstur);
      //  Gambar konten layar yang ikut tersimpan di server dikembalikan sebagai tekstur.
      const m = mesin.current;
      if (m) for (const [idL, url] of Object.entries(d.data.layar ?? {})) {
        muatGambarLayar(m, idL, url, gambarLayar.current, () => setVersiGambar(v => v + 1));
      }
      setRuang(ruangBaru); setBenda(d.data.benda); setNamaDesain(d.nama);
      setAsal({ jenis: 'baru' }); setDasar(ambilKunci(ruangBaru, d.data.benda, d.nama));
      riwayat.mulaiBaru({ ruang: ruangBaru, benda: d.data.benda });
      //  Versi lama: menyimpan membuat versi baru dari isi ini (riwayat tidak diubah).
      setDesainAktif({ id: d.id, bolehUbah: d.bolehUbah, versi: d.versiTerbaru });
      setLihatVersi(d.versi !== d.versiTerbaru ? { versi: d.versi, terbaru: d.versiTerbaru } : null);
      setPilih(null); setModal(null);
    } catch { setStatusSimpan({ teks: 'Tidak terhubung ke server.', nada: 'galat' }); } finally { setSibukSimpan(false); }
  };

  //  Dibuka dari Request Design: /tools-team?alat=3d&desain=<id>&versi=<n>
  useEffect(() => {
    try {
      const sp = new URLSearchParams(window.location.search);
      const id = sp.get('desain');
      if (id && /^[0-9a-f-]{36}$/i.test(id)) void bukaTim(id, Number(sp.get('versi')) || undefined);
    } catch { /* abaikan */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hapusTim = (d: DesainTim) => setKonfirmasi({
    message: `Hapus desain "${d.nama}" dari server?`, danger: true, confirmLabel: 'Hapus',
    description: 'Seluruh tim tidak bisa membukanya lagi.', onConfirm: () => void hapusTimYa(d),
  });
  const hapusTimYa = async (d: DesainTim) => {
    const r = await fetch(`${API_DESAIN}?id=${encodeURIComponent(d.id)}`, { method: 'DELETE', credentials: 'include' }).catch(() => null);
    const j = await r?.json().catch(() => null);
    if (!r?.ok || !j?.ok) { setStatusSimpan({ teks: j?.alasan ?? 'Gagal menghapus.', nada: 'galat' }); return; }
    if (j.diarsipkan) setStatusSimpan({ teks: `"${d.nama}" masih ditautkan ke ${j.tautan} Request Design - diarsipkan (tidak tampil di daftar), versinya tetap tersimpan untuk request itu.`, nada: 'info' });
    if (desainAktif?.id === d.id) { setDesainAktif(null); setLihatVersi(null); setAsal({ jenis: 'baru' }); setDasar(null); }
    void muatDaftarTim();
  };

  /** Pindahkan desain lama yang hanya ada di perangkat ini ke server. */
  const unggahLokal = async (t: { nama: string; ruang: Ruang; benda: Benda[] }) => {
    if (await simpanServer(true, t)) {
      tulisSimpanan(tersimpan.filter(x => x.nama !== t.nama));
      setStatusSimpan({ teks: `"${t.nama}" sekarang tersimpan di server.`, nada: 'ok' });
    }
  };

  return { API_DESAIN, bendaBersih, bukaDariLaptop, bukaTim, gambarKeDataUrl, gambarLayarServer, hapusTim, hapusTimYa, muatDaftarTim, pratinjau, simpanKeLaptop, simpanServer, tulisSimpanan, unduhGLB, unggahLokal };
}
