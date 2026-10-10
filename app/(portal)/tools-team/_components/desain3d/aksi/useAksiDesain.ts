'use client';
/**
 * Aksi edit desain: template kategori, tambah / duplikat / salin / tempel benda, ruang & bukaan, gambar layar.
 * Bagian dari Desain3D.tsx (Tools Team) - lihat struktur di desain3d/README.md.
 */
import { type Benda, bendaBaru, BISA_PASANG, type Bukaan, BUKAAN_AWAL, CELAH_PASANG, daftarRuang, idBaru, type ItemKatalog, KATEGORI_RUANG, type KategoriRuang, type Kotak, layarTerdekat, MAKS_RUANG, panjangDinding, pasangDari, proyektorKeLayar, pusatkanIsi, type Ruang, ruangDari, type RuangSambung, salinIsi, salinKeRuang, sambungan, sambunganKe, sesuaikanUkuranRuang, setRuangKelas, type SisiDinding, sisiLuar, type SumbuPusat, templateRuang, tinggiAlasDi } from '../inti';
import type { KeadaanDesain } from '../useKeadaanDesain';
import { R2_AWAL, RUANG_AWAL } from '../useKeadaanDesain';
import type { Sisi } from '../mesin/tipe';
import { daftarkanTekstur } from '../simpan/teksturRuang';


/** Isi template default kategori yang ditetapkan Admin (format sama dengan data desain tim). */
export interface IsiTemplateKategori { nama: string; ruang: Ruang; benda: Benda[]; layar?: Record<string, string>; tekstur?: Record<string, string> }

export function useAksiDesain(K: KeadaanDesain) {
  const { batas, benda, gambarLayar, gantiBenda, kotakRuang, mesin, opsiKelas, pasSetelahTemplate, ruang, ruangRef, setAsal, setBenda, setBukaKelas, setDasar, setDesainAktif, setFokusRuang, setKonfirmasi, setLihatVersi, setMenuPusat, setModal, setNamaDesain, setPesan, setPilih, setRuang, setTargetRuang, setVersiGambar, targetRuang, terpilih } = K;
  /**
   * Pasang template kategori ruangan (mengganti isi kanvas; tercatat di undo). `kustom` = template default
   * yang ditetapkan Admin untuk kategori ini (simpan/useTemplateKategori.ts); tanpa itu = bawaan kode.
   */
  const pasangKategori = (id: KategoriRuang, kustom?: IsiTemplateKategori | null) => {
    const kat = KATEGORI_RUANG.find(k => k.id === id);
    if (!benda.length) { pasangKategoriYa(id, kustom); return; }
    setKonfirmasi({
      message: `Ganti isi kanvas dengan template "${kat?.judul}"?`, confirmLabel: 'Ganti isi',
      description: 'Isi kanvas sekarang diganti template ini. Bisa dikembalikan dengan Undo.',
      onConfirm: () => pasangKategoriYa(id, kustom),
    });
  };
  const pasangKategoriYa = (id: KategoriRuang, kustom?: IsiTemplateKategori | null) => {
    const kat = KATEGORI_RUANG.find(k => k.id === id);
    const t = kustom ? { nama: kustom.nama, ruang: { ...RUANG_AWAL, ...kustom.ruang }, benda: kustom.benda } : templateRuang(id);
    //  Gambar konten layar milik template Admin dikembalikan sebagai tekstur (sama seperti membuka desain tim).
    const m = mesin.current;
    if (kustom?.layar && m) for (const [idL, url] of Object.entries(kustom.layar)) {
      new m.THREE.TextureLoader().load(url, tex => { tex.colorSpace = m.THREE.SRGBColorSpace; gambarLayar.current.set(idL, tex); setVersiGambar(v => v + 1); });
    }
    daftarkanTekstur(K, kustom?.tekstur);
    ruangRef.current = t.ruang;
    //  Template default dibuat ulang dari kode tiap kali dipasang (terkunci - tidak ada yang bisa mengubah
    //  aslinya). Yang diubah pengguna hanya salinan di kanvas; Simpan selalu membuat file baru miliknya.
    setRuang(t.ruang); setBenda(t.benda); setNamaDesain(`${t.nama} (salinan)`);
    setDesainAktif(null); setLihatVersi(null); setAsal({ jenis: 'template', nama: kustom ? `${kat?.judul ?? t.nama} · default Admin` : kat?.judul ?? t.nama }); setDasar(null); setPilih(null); setFokusRuang('semua');
    pasSetelahTemplate.current = true;
    setPesan(kustom ? `Template ${kat?.judul} (default dari Admin) dipasang - atur sesuai kebutuhan.` : id === 'mapping-objek'
      ? 'Template Mapping objek dipasang. Tambah → Objek dari luar: impor berkas 3D (SketchUp .dae/.obj/.stl, .glb, .fbx) atau buat dari gambar, letakkan di atas alas - sinar proyektor langsung jatuh di permukaannya.'
      : `Template ${kat?.judul} dipasang - atur sesuai kebutuhan.`);
  };
  const tambahSetKelas = () => {
    const k = kotakRuang[Number(targetRuang)] ?? kotakRuang[0];
    const daftar = setRuangKelas(k, opsiKelas);
    setBenda(bs => [...bs, ...daftar]); setPilih(null); setBukaKelas(false);
  };

  // ── Pintu & jendela dinding luar ──
  const ubahBukaan = (id: string, x: Partial<Bukaan>) => setRuang(r => ({ ...r, bukaan: (r.bukaan ?? []).map(b => (b.id === id ? { ...b, ...x } : b)) }));
  const tambahBukaan = (jenis: Bukaan['jenis']) => setRuang(r => {
    const ri = Math.min(Math.max(0, Number(targetRuang) || 0), daftarRuang(r).length - 1);
    const sisiAda = sisiLuar(r, ri);
    const sisi: SisiDinding = jenis === 'pintu' ? (sisiAda.includes('belakang') ? 'belakang' : sisiAda[0])
      : sisiAda.includes(ri === 0 ? 'kiri' : 'kanan') ? (ri === 0 ? 'kiri' : 'kanan') : 'belakang';
    const k = daftarRuang(r)[ri] ?? daftarRuang(r)[0];
    const awal = BUKAAN_AWAL[jenis];
    const b: Bukaan = { id: idBaru(), ruang: ri, sisi, jenis, posisi: Math.round(panjangDinding(k, sisi) / 2 * 100) / 100, ...awal };
    return { ...r, bukaan: [...(r.bukaan ?? []), b] };
  });

  const tambah = (it: ItemKatalog) => {
    const k = kotakRuang[Number(targetRuang)] ?? kotakRuang[0];
    if (it.set) {
      //  Preset (mis. set ruang kelas): banyak benda sekaligus, tidak ada yang dipilih.
      const daftar = it.set(k);
      setBenda(bs => [...bs, ...daftar]); setPilih(null); setModal(null);
      return;
    }
    const b0 = bendaBaru(it.jenis, k, it.atur);
    //  Proyektor langsung menghadap layar di ruang itu (bila ada) pada jarak lempar idealnya.
    const layar = b0.jenis === 'proyektor' ? layarTerdekat(b0, benda, ruang) : null;
    const b1 = layar ? proyektorKeLayar(b0, layar, k, ruang) : b0;
    //  Objek mapping berdiri di atas alas / panggung di bawahnya (template Mapping objek: alas di tengah).
    const b = b1.jenis === 'objek' ? { ...b1, elev: tinggiAlasDi(benda, b1.x, b1.z) } : b1;
    setBenda(bs => [...bs, b]); setPilih(b.id); setModal(null);
  };

  /** Gambar unggahan ikut ke salinan (tekstur dipakai bersama, tidak diunggah ulang). */
  const salinGambar = (dari: string, ke: string) => {
    const t = gambarLayar.current.get(dari); if (t) gambarLayar.current.set(ke, t);
  };

  const duplikat = (b: Benda) => {
    const c = { ...b, id: idBaru(), x: Math.min(batas.x, b.x + 0.6) };
    salinGambar(b.id, c.id);
    setBenda(bs => [...bs, c]); setPilih(c.id);
  };

  /** Salin satu benda ke ruang sebelah (posisi relatif sama). */
  const salinKeRuangLain = (b: Benda) => {
    const asal = ruangDari(ruang, b.x), tujuan = (asal + 1) % kotakRuang.length;
    const kA = kotakRuang[asal], kT = kotakRuang[tujuan]; if (!kA || !kT || asal === tujuan) return;
    const c = salinKeRuang(b, kA, kT);
    salinGambar(b.id, c.id);
    setBenda(bs => [...bs, c]); setPilih(c.id);
    setPesan(`${b.nama} disalin ke Ruang ${tujuan + 1}.`);
  };

  /** Salin seluruh perangkat & interior satu ruang ke ruang sebelah. */
  const salinIsiRuang = (asal: number, ganti: boolean, ke?: number) => {
    const tujuan = ke ?? (asal + 1) % kotakRuang.length;
    if (tujuan === asal) return;
    const kA = kotakRuang[asal], kT = kotakRuang[tujuan]; if (!kA || !kT) return;
    const isi = benda.filter(b => ruangDari(ruang, b.x) === asal);
    if (!isi.length) { setPesan(`Ruang ${asal + 1} masih kosong.`); return; }
    const lama = benda.filter(b => ruangDari(ruang, b.x) === tujuan);
    const lanjut = () => {
      const baru = salinIsi(isi, ruang, kA, kT);
      isi.forEach((b, i) => salinGambar(b.id, baru[i].id));
      setBenda(bs => [...(ganti ? bs.filter(b => ruangDari(ruang, b.x) !== tujuan) : bs), ...baru]);
      setPilih(null);
      setPesan(`${baru.length} benda disalin dari Ruang ${asal + 1} ke Ruang ${tujuan + 1}.`);
    };
    if (ganti && lama.length) {
      setKonfirmasi({ message: `Ganti isi Ruang ${tujuan + 1}?`, confirmLabel: 'Ganti isi', danger: true,
        description: `${lama.length} benda di sana dihapus lalu diganti salinan Ruang ${asal + 1}. Bisa dikembalikan dengan Undo.`, onConfirm: lanjut });
      return;
    }
    lanjut();
  };

  /** Tempel ke dinding ruang tempat benda berada; sisi belakang menyentuh dinding, menghadap ke dalam. */
  const tempel = (sisi: Sisi) => {
    if (!terpilih) return;
    const k: Kotak = kotakRuang[ruangDari(ruang, terpilih.x)] ?? kotakRuang[0];
    //  Display ditempel dengan bracket / struktur hollow: punggungnya berjarak sesuai pemasangan.
    const psTempel = BISA_PASANG.includes(terpilih.jenis) ? (pasangDari(terpilih) === 'standfloor' && terpilih.jenis !== 'ifp' ? (terpilih.jenis === 'led' ? 'hollow' : 'dinding') : pasangDari(terpilih)) : null;
    const tebal = terpilih.d / 2 + (psTempel ? (psTempel === 'standfloor' ? 0.06 : CELAH_PASANG[psTempel]) : 0.02);
    const xi = Math.min(k.x0 + k.p - terpilih.w / 2, Math.max(k.x0 + terpilih.w / 2, terpilih.x));
    const zi = Math.min(k.l - terpilih.w / 2, Math.max(terpilih.w / 2, terpilih.z));
    const pos: Record<Sisi, Partial<Benda>> = {
      depan: { x: xi, z: tebal, rot: 0 },
      belakang: { x: xi, z: k.l - tebal, rot: 180 },
      kiri: { x: k.x0 + tebal, z: zi, rot: 90 },
      kanan: { x: k.x0 + k.p - tebal, z: zi, rot: 270 },
    };
    const bulat = (v?: number) => (v === undefined ? v : Math.round(v * 100) / 100);
    const p = pos[sisi];
    gantiBenda({ ...terpilih, ...p, x: bulat(p.x)!, z: bulat(p.z)!, pasang: psTempel ?? terpilih.pasang });
  };

  /** Ubah ukuran ruang: isi ruang ikut menyesuaikan, tidak tertinggal di posisi lama. */
  const ubahUkuran = (fn: (r: Ruang) => Ruang) => {
    const lama = ruangRef.current, baru = fn(lama);
    ruangRef.current = baru;
    setBenda(bs => sesuaikanUkuranRuang(bs, lama, baru));
    setRuang(baru);
  };

  /** Ruang tambahan ke-j (r2 = 1, lain[0] = 2, ...). */
  const pasangSambungan = (r: Ruang, j: number, x: RuangSambung | null): Ruang => {
    if (j === 1) return { ...r, r2: x };
    const lain = [...(r.lain ?? [])];
    while (lain.length < j - 1) lain.push({ ...R2_AWAL, aktif: false });
    if (x) lain[j - 2] = x; else lain.splice(j - 2);
    return { ...r, lain };
  };
  const ubahSambungan = (j: number, x: Partial<RuangSambung>, ukur = false) => {
    const fn = (r: Ruang) => { const s0 = sambunganKe(r, j); return s0 ? pasangSambungan(r, j, { ...s0, ...x }) : r; };
    if (ukur) ubahUkuran(fn); else setRuang(fn);
  };
  /** Tambah ruang di kanan ruang terakhir (maks MAKS_RUANG). */
  const tambahRuang = () => setRuang(r => {
    const n = sambungan(r).length;
    if (n >= MAKS_RUANG - 1) return r;
    const lama = n === 0 ? r.r2 : r.lain?.[n - 1];
    return pasangSambungan(r, n + 1, { ...R2_AWAL, ...(lama ?? {}), aktif: true });
  });
  /** Hapus ruang terakhir beserta isinya (dengan konfirmasi bila ada benda). */
  const hapusRuangTerakhir = () => {
    const n = kotakRuang.length - 1; if (n < 1) return;
    const k = kotakRuang[n];
    const isi = benda.filter(b => ruangDari(ruang, b.x) === n);
    const lanjut = () => {
      setBenda(bs => bs.filter(b => !(b.x > k.x0)));
      setRuang(r => { const s0 = sambunganKe(r, n); return s0 ? pasangSambungan(r, n, n === 1 ? { ...s0, aktif: false } : null) : r; });
      setTargetRuang('0'); setFokusRuang('semua');
    };
    if (!isi.length) { lanjut(); return; }
    setKonfirmasi({ message: `Hapus ruang ${n + 1}?`, confirmLabel: 'Hapus', danger: true,
      description: `${isi.length} benda di ruang ${n + 1} ikut dihapus. Bisa dikembalikan dengan Undo.`, onConfirm: lanjut });
  };

  const unggahGambar = (file: File | null) => {
    const m = mesin.current; if (!file || !m || !terpilih) return;
    const url = URL.createObjectURL(file);
    const id = terpilih.id;
    new m.THREE.TextureLoader().load(url, tex => {
      //  Gambar sudah terunggah ke GPU - URL objeknya tidak dipakai lagi.
      URL.revokeObjectURL(url);
      tex.colorSpace = m.THREE.SRGBColorSpace;
      //  Tekstur lama dilepas hanya bila tidak dipakai salinan lain.
      const lama = gambarLayar.current.get(id);
      gambarLayar.current.set(id, tex);
      if (lama && ![...gambarLayar.current.values()].includes(lama)) lama.dispose();
      setBenda(bs => bs.map(b => (b.id === id ? { ...b, konten: 'gambar' } : b)));
      setVersiGambar(v => v + 1);
    });
  };
  /** Pusatkan isi tiap ruang (benda bebas digeser bersama; yang menempel dinding tetap). */
  const pusatkan = (sumbu: SumbuPusat) => {
    const baru = pusatkanIsi(benda, ruang, sumbu);
    setMenuPusat(false);
    if (baru === benda) { setPesan('Isi ruang sudah di tengah.'); return; }
    setBenda(baru);
    setPesan(`Isi ruang dipusatkan (${sumbu === 'x' ? 'kiri-kanan' : sumbu === 'z' ? 'depan-belakang' : 'kiri-kanan & depan-belakang'}). Undo bila perlu.`);
  };

  return { duplikat, hapusRuangTerakhir, pasangKategori, pasangKategoriYa, pasangSambungan, pusatkan, salinGambar, salinIsiRuang, salinKeRuangLain, tambah, tambahBukaan, tambahRuang, tambahSetKelas, tempel, ubahBukaan, ubahSambungan, ubahUkuran, unggahGambar };
}
