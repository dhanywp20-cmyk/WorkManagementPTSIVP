'use client';
import { type SetStateAction, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getSession } from '@/lib/auth/sesi';
import { contohVoiceKamar } from '@/lib/sld/contoh';
import {
  bersihkanDok, dokBaru, hapusFotoLokal, hapusPerangkat, hurufSah, idBaru, kabelBaru, kabelYatim, pasangFoto, zonaBaru, perangkatBaru, petaFoto, tanpaFoto, teksBaru, ubahKertas, ujungBaru,
} from '@/lib/sld/dok';
import { rasioDinding } from '@/lib/sld/dinding';
import { dokRuang, duplikatRuang, gabungRuang, hapusRuang, jumlahRuang, namaiRuang, semuaPerangkat, tambahRuang } from '@/lib/sld/ruang';
import { rapikanLabel, terapkanQtyDiNama } from '@/lib/sld/rapikan';
import { geometri, kotakTampak, sudutSah } from '@/lib/sld/geometri';
import { cariTemplat } from '@/lib/sld/katalog';
import { perangkatDariTim, segarkanFotoTim as segarkanFotoTimDok, type ItemTim } from '@/lib/sld/katalog-tim';
import { isiPreset, presetKabel } from '@/lib/sld/preset-kabel';
import { periksaDok } from '@/lib/sld/turunan';
import { type Format, hapusObjek, type Klip, type Rata, ratakan, salinObjek, samakanUkuran, tempelKlip, geserObjek, terapkanFormat, urutkan } from '@/lib/sld/pilih';
import { gantiTeks } from '@/lib/sld/cari';
import {
  AREA, areaDok, type BlokJudul, type DokSLD, type IsiBoqItem, type Kabel, type Kertas, MAKS_KABEL, MAKS_PERANGKAT, MAKS_TEKS, MAKS_ZONA, type Perangkat, type PosisiLabel, type TeksBebas, type Titik, UKURAN_MIN, type ZonaSLD,
} from '@/lib/sld/tipe';
import { useRiwayat } from '../bersama/riwayat';
import {
  type FotoGaleri, hapusIngatanLama, muatFotoDraf, muatGaleri, muatLogo, simpanFotoDraf, simpanGaleri, simpanLogo,
} from './foto-lokal';
import type { FotoSiap } from './gambar';

const KUNCI = 'tools-team-sld-v1';
const KUNCI_PRESET = 'tools-team-sld-kabel';
const TEKS_DINDING = ['nama', 'model', 'ket', 'subGambar', 'ikon'];

export type Alat = 'pilih' | 'geser' | 'garis' | 'teks' | 'area' | 'format' | 'hapus';
export type Pilihan = { jenis: 'p' | 'k' | 't' | 'z'; id: string } | null;
const KUNCI_KLIP = 'tools-team-sld-klip';

const namaPengguna = () => {
  const u = getSession<{ full_name?: string; username?: string }>();
  return u?.full_name || u?.username || '';
};

function muatDraf(): DokSLD | null {
  try {
    const mentah = JSON.parse(localStorage.getItem(KUNCI) ?? 'null') as Record<string, unknown> | null;
    const d = bersihkanDok(mentah);
    return d && mentah && !('kertas' in mentah) ? ubahKertas(d, '169') : d;
  } catch { return null; }
}

export function useKeadaanSLD() {
  const [proyek, setProyek] = useState<DokSLD>(() => dokBaru());
  const [ruangAktif, setRuangAktifState] = useState(0);
  const ruangRef = useRef(0);
  const aktif = Math.min(ruangAktif, jumlahRuang(proyek) - 1);
  const dok = useMemo(() => dokRuang(proyek, aktif), [proyek, aktif]);
  const setDok = useCallback((f: SetStateAction<DokSLD>) => setProyek(p => {
    const i = Math.min(ruangRef.current, jumlahRuang(p) - 1), lama = dokRuang(p, i), baru = typeof f === 'function' ? f(lama) : f;
    return baru === lama ? p : gabungRuang(p, i, baru);
  }), []);
  const [siap, setSiap] = useState(false);
  const [pilih, setPilih] = useState<Pilihan>(null);
  const [grup, setGrup] = useState<{ utama: string | null; ids: string[] }>({ utama: null, ids: [] });
  const [galatSimpan, setGalatSimpan] = useState(false);
  const [galeri, setGaleri] = useState<FotoGaleri[]>([]);
  const [logo, setLogoState] = useState<string | null>(null);
  const mulaiRef = useRef<(d: DokSLD) => void>(() => {});

  useEffect(() => {
    let batal = false;
    const d = muatDraf() ?? dokBaru(namaPengguna());
    void Promise.all([muatFotoDraf().catch(() => ({})), muatGaleri().catch(() => []), muatLogo().catch(() => null)]).then(([peta, g, l]) => {
      if (batal) return;
      void hapusIngatanLama().catch(() => {});
      const awal = pasangFoto(d, peta);
      setProyek(awal); setGaleri(g); setLogoState(l); setSiap(true); mulaiRef.current(awal);
    });
    return () => { batal = true; };
  }, []);
  useEffect(() => {
    if (!siap) return;
    const t = setTimeout(() => {
      try { localStorage.setItem(KUNCI, JSON.stringify(tanpaFoto(proyek))); setGalatSimpan(false); } catch { setGalatSimpan(true); }
    }, 500);
    return () => clearTimeout(t);
  }, [proyek, siap]);
  const kunciFoto = semuaPerangkat(proyek).map(p => (p.gambar ? `${p.id}:${p.gambar.length}` : '')).join('|');
  const dokRef = useRef(dok); dokRef.current = dok;
  const proyekRef = useRef(proyek); proyekRef.current = proyek;
  useEffect(() => {
    if (!siap) return;
    const t = setTimeout(() => { simpanFotoDraf(petaFoto(proyekRef.current)).catch(() => setGalatSimpan(true)); }, 600);
    return () => clearTimeout(t);
  }, [kunciFoto, siap]);

  const riwayat = useRiwayat(proyek, setProyek);
  mulaiRef.current = riwayat.mulaiBaru;
  const geo = useMemo(() => geometri(dok), [dok]);
  const temuan = useMemo(() => periksaDok(dok), [dok]);

  const tambahGaleri = useCallback((baru: FotoGaleri[]) => setGaleri(g => {
    const ada = new Set(g.map(x => x.gambar));
    const hasil = [...baru.filter(x => !ada.has(x.gambar)), ...g];
    void simpanGaleri(hasil).catch(() => {});
    return hasil;
  }), []);
  const hapusGaleri = useCallback((id: string) => setGaleri(g => {
    const hasil = g.filter(x => x.id !== id);
    void simpanGaleri(hasil).catch(() => {});
    return hasil;
  }), []);
  const setLogo = useCallback((l: string | null) => { setLogoState(l); void simpanLogo(l).catch(() => setGalatSimpan(true)); }, []);
  const setWatermark = useCallback((aktif: boolean) => setDok(d => ({ ...d, watermark: aktif })), [setDok]);

  const pasangFotoKe = useCallback((id: string, f: FotoSiap, nama = 'Foto') => {
    setDok(d => ({ ...d, perangkat: d.perangkat.map(p => (p.id === id
      ? { ...p, gambar: f.dataUrl, rasio: f.rasio, h: Math.max(10, Math.min(80, Math.round((p.w / f.rasio) * 2) / 2)) } : p)) }));
    tambahGaleri([{ id: idBaru('g'), nama, gambar: f.dataUrl, rasio: f.rasio }]);
  }, [tambahGaleri, setDok]);

  const ubahBlok = useCallback((p: Partial<BlokJudul>) => setDok(d => ({ ...d, blok: { ...d.blok, ...p } })), [setDok]);
  const ubahPerangkat = useCallback((id: string, p: Partial<Perangkat>) =>
    setDok(d => ({ ...d, perangkat: d.perangkat.map(x => {
      if (x.id !== id) return x;
      const baru = { ...x, ...p };
      const rd = !baru.gambar && !baru.foto && TEKS_DINDING.some(k => k in p) ? rasioDinding(baru.ikon, baru) : null;
      return rd && p.h === undefined ? { ...baru, h: Math.round(Math.min(AREA.h, Math.max(UKURAN_MIN.h, baru.w / rd)) * 2) / 2 } : baru;
    }) })), [setDok]);
  const putarPerangkat = useCallback((id: string, delta: number) => setDok(d => ({ ...d, perangkat: d.perangkat.map(x => {
    if (x.id !== id) return x;
    const putar = sudutSah((x.putar ?? 0) + delta) || undefined;
    if (Math.abs(delta) % 180 !== 90) return { ...x, putar };
    const w = Math.max(UKURAN_MIN.w, x.h), h = Math.max(UKURAN_MIN.h, x.w);
    return { ...x, putar, w, h, x: x.x + (x.w - w) / 2, y: x.y + (x.h - h) / 2 };
  }) })), [setDok]);
  const balikPerangkat = useCallback((id: string, sumbu: 'h' | 'v') => setDok(d => ({ ...d, perangkat: d.perangkat.map(x => {
    if (x.id !== id) return x;
    return sumbu === 'h' ? { ...x, balikH: !x.balikH || undefined } : { ...x, balikV: !x.balikV || undefined };
  }) })), [setDok]);
  const ubahKabel = useCallback((id: string, p: Partial<Kabel>) =>
    setDok(d => ({ ...d, kabel: d.kabel.map(x => (x.id === id ? { ...x, ...p } : x)) })), [setDok]);

  const tambahObjekTim = useCallback((t: ItemTim) => {
    const n = dokRef.current.perangkat.length;
    if (n >= MAKS_PERANGKAT) return;
    const p = perangkatDariTim(t, AREA.x + 20 + (n % 6) * 60, AREA.y + 15 + (Math.floor(n / 6) % 4) * 65);
    setDok(d => (d.perangkat.length >= MAKS_PERANGKAT ? d : { ...d, perangkat: [...d.perangkat, p] }));
    setPilih({ jenis: 'p', id: p.id });
  }, [setDok]);
  const tambahPerangkat = useCallback((k: string, posisi?: { x: number; y: number }) => {
    const t = cariTemplat(k);
    const id = idBaru('p');
    setDok(d => {
      if (d.perangkat.length >= MAKS_PERANGKAT) return d;
      const n = d.perangkat.length;
      const x = posisi?.x ?? AREA.x + 20 + (n % 6) * 60, y = posisi?.y ?? AREA.y + 15 + (Math.floor(n / 6) % 4) * 65;
      return { ...d, perangkat: [...d.perangkat, { ...perangkatBaru(k, x - (posisi ? t.w / 2 : 0), y - (posisi ? t.h / 2 : 0)), id }] };
    });
    setPilih({ jenis: 'p', id });
  }, [setDok]);

  const duplikat = useCallback((id: string) => {
    const baru = idBaru('p');
    setDok(d => {
      const p = d.perangkat.find(x => x.id === id);
      if (!p || d.perangkat.length >= MAKS_PERANGKAT) return d;
      return { ...d, perangkat: [...d.perangkat, { ...p, id: baru, x: p.x + 8, y: p.y + 8 }] };
    });
    setPilih({ jenis: 'p', id: baru });
  }, [setDok]);

  const [presetTerakhir, setPresetTerakhirState] = useState(() => {
    try { return localStorage.getItem(KUNCI_PRESET) ?? 'cat6'; } catch { return 'cat6'; }
  });
  const [kabelBaruId, setKabelBaruId] = useState<string | null>(null);
  const setPresetTerakhir = useCallback((k: string) => {
    setPresetTerakhirState(k);
    try { localStorage.setItem(KUNCI_PRESET, k); } catch {  }
  }, []);
  const [alat, setAlat] = useState<Alat>('pilih');
  const gambarKabel = alat === 'garis';
  const setGambarKabel = useCallback((v: boolean) => setAlat(v ? 'garis' : 'pilih'), []);
  const terapkanFormatKe = useCallback((f: Format, id: string) => setDok(d => terapkanFormat(d, f, id)), [setDok]);
  const hubungkan = useCallback((dari: string, ke: string, jalur?: Titik[]) => {
    if (dari === ke) return;
    const c = { ...kabelBaru(dari, ke, isiPreset(presetKabel(presetTerakhir))), ...(jalur?.length ? { jalur } : {}) };
    setDok(d => (d.kabel.length >= MAKS_KABEL ? d : { ...d, kabel: [...d.kabel, c] }));
    setPilih({ jenis: 'k', id: c.id });
    setKabelBaruId(c.id);
  }, [presetTerakhir, setDok]);

  const kabelBebas = useCallback(() => {
    const c = { ...kabelBaru('', '', { jenis: 'ac', daya: true, media: 'Kabel listrik 230 VAC' }), dari: { ...ujungBaru(), nama: 'MCB panel listrik' } };
    setDok(d => (d.kabel.length >= MAKS_KABEL ? d : { ...d, kabel: [...d.kabel, c] }));
    setPilih({ jenis: 'k', id: c.id });
  }, [setDok]);

  const geserKabel = useCallback((id: string, arah: -1 | 1) => setDok(d => {
    const i = d.kabel.findIndex(c => c.id === id), j = i + arah;
    if (i < 0 || j < 0 || j >= d.kabel.length) return d;
    const kabel = [...d.kabel];
    [kabel[i], kabel[j]] = [kabel[j], kabel[i]];
    return { ...d, kabel };
  }), [setDok]);

  const terpilih = useMemo(() => (grup.utama === (pilih?.id ?? null) && grup.ids.length ? grup.ids : pilih ? [pilih.id] : []), [grup, pilih]);
  const terpilihRef = useRef(terpilih); terpilihRef.current = terpilih;
  const pilihRef = useRef(pilih); pilihRef.current = pilih;
  const jenisDari = useCallback((id: string): Pilihan => {
    const d = dokRef.current;
    if (d.perangkat.some(p => p.id === id)) return { jenis: 'p', id };
    if (d.teks.some(t => t.id === id)) return { jenis: 't', id };
    if ((d.zona ?? []).some(z => z.id === id)) return { jenis: 'z', id };
    return d.kabel.some(c => c.id === id) ? { jenis: 'k', id } : null;
  }, []);
  const pilihBanyak = useCallback((ids: string[]) => {
    const unik = [...new Set(ids)];
    if (unik.length === 1) { setPilih(jenisDari(unik[0])); setGrup({ utama: null, ids: [] }); return; }
    setPilih(null); setGrup({ utama: null, ids: unik });
  }, [jenisDari]);
  const togglePilih = useCallback((id: string) => {
    const kini = terpilihRef.current;
    pilihBanyak(kini.includes(id) ? kini.filter(x => x !== id) : [...kini, id]);
  }, [pilihBanyak]);
  const geserGrup = useCallback((awal: Map<string, { x: number; y: number }>, dx: number, dy: number) => setDok(d => geserObjek(d, awal, dx, dy)), [setDok]);
  const klip = useRef<Klip | null>(null);
  const salin = useCallback(() => {
    const k = salinObjek(dokRef.current, terpilihRef.current);
    if (!k.perangkat.length && !k.teks.length && !k.zona.length) return false;
    klip.current = k;
    try { localStorage.setItem(KUNCI_KLIP, JSON.stringify({ ...k, perangkat: k.perangkat.map(p => ({ ...p, gambar: undefined })) })); } catch {  }
    return true;
  }, []);
  const tempel = useCallback(() => {
    let k = klip.current;
    if (!k) { try { k = JSON.parse(localStorage.getItem(KUNCI_KLIP) ?? 'null') as Klip | null; } catch { k = null; } }
    if (!k || (!k.perangkat?.length && !k.teks?.length && !k.zona?.length)) return false;
    const h = tempelKlip(dokRef.current, { perangkat: k.perangkat ?? [], kabel: k.kabel ?? [], teks: k.teks ?? [], zona: k.zona ?? [] });
    setDok(h.dok); pilihBanyak(h.ids);
    return true;
  }, [setDok, pilihBanyak]);
  const hapusTerpilih = useCallback(() => {
    const ids = terpilihRef.current;
    if (!ids.length) return;
    setDok(d => hapusObjek(d, ids)); setPilih(null); setGrup({ utama: null, ids: [] });
  }, [setDok]);
  const ratakanTerpilih = useCallback((cara: Rata) => setDok(d => ratakan(d, terpilihRef.current, cara)), [setDok]);
  const urutkanTerpilih = useCallback((arah: 'depan' | 'belakang') => setDok(d => urutkan(d, terpilihRef.current, arah)), [setDok]);
  const samakanUkuranTerpilih = useCallback((cara: 'w' | 'h' | 'wh') => setDok(d => samakanUkuran(d, terpilihRef.current, pilihRef.current?.id, cara)), [setDok]);
  const gantiSemua = useCallback((cari: string, ganti: string) => { const h = gantiTeks(dokRef.current, cari, ganti); if (h.jumlah) setDok(h.dok); return h.jumlah; }, [setDok]);
  const aturLompat = useCallback((aktif: boolean) => setProyek(p => ({ ...p, tanpaLompat: aktif ? undefined : true })), []);
  const aturLabelDi = useCallback((ids: string[], posisi: PosisiLabel) => setDok(d => ({ ...d, perangkat: d.perangkat.map(p => (ids.includes(p.id) ? { ...p, labelDi: posisi === 'bawah' ? undefined : posisi } : p)) })), [setDok]);
  const aturLebarLabel = useCallback((ids: string[], v: number | 'gambar' | undefined) => setDok(d => ({ ...d, perangkat: d.perangkat.map(p => (ids.includes(p.id)
    ? { ...p, lebarLabel: v === 'gambar' ? Math.max(8, Math.round(kotakTampak(p).w)) : v } : p)) })), [setDok]);
  const aturModel = useCallback((ids: string[], model: string, kategori?: string) => setDok(d => ({ ...d, perangkat: d.perangkat.map(x => {
    if (!ids.includes(x.id)) return x;
    return { ...x, model, ...(kategori !== undefined ? { kategori } : {}) };
  }) })), [setDok]);
  const tambahZona = useCallback((posisi?: { x: number; y: number }, label?: string, ukuran?: { w: number; h: number }) => {
    const a = areaDok(dokRef.current), z = { ...zonaBaru(posisi?.x ?? a.x + 20, posisi?.y ?? a.y + 15, label), ...ukuran };
    setDok(d => ((d.zona?.length ?? 0) >= MAKS_ZONA ? d : { ...d, zona: [...(d.zona ?? []), z] }));
    setPilih({ jenis: 'z', id: z.id });
  }, [setDok]);
  const ubahZona = useCallback((id: string, p: Partial<ZonaSLD>) => setDok(d => ({ ...d, zona: (d.zona ?? []).map(z => (z.id === id ? { ...z, ...p } : z)) })), [setDok]);
  const bersihkanKabelYatim = useCallback(() => setDok(d => { const y = new Set(kabelYatim(d).map(c => c.id)); return { ...d, kabel: d.kabel.filter(c => !y.has(c.id)) }; }), [setDok]);

  const hapus = useCallback((p: Pilihan) => {
    if (!p) return;
    setDok(d => (p.jenis === 'p' ? hapusPerangkat(d, p.id) : p.jenis === 'z' ? { ...d, zona: (d.zona ?? []).filter(z => z.id !== p.id) } : p.jenis === 't' ? { ...d, teks: d.teks.filter(t => t.id !== p.id) } : { ...d, kabel: d.kabel.filter(c => c.id !== p.id) }));
    setPilih(null);
  }, [setDok]);

  const tambahTeks = useCallback((posisi?: { x: number; y: number }, isi?: string) => {
    const id = idBaru('t');
    setDok(d => {
      if (d.teks.length >= MAKS_TEKS) return d;
      const a = areaDok(d), n = d.teks.length;
      const t = { ...teksBaru(posisi?.x ?? a.x + a.w / 2 - 10 + (n % 5) * 4, posisi?.y ?? a.y + a.h / 2 + (n % 5) * 4, isi), id };
      return { ...d, teks: [...d.teks, t] };
    });
    setPilih({ jenis: 't', id });
  }, [setDok]);
  const ubahTeks = useCallback((id: string, p: Partial<TeksBebas>) => setDok(d => ({ ...d, teks: d.teks.map(t => (t.id === id ? { ...t, ...p } : t)) })), [setDok]);
  const duplikatTeks = useCallback((id: string) => {
    const baru = idBaru('t');
    setDok(d => {
      const t = d.teks.find(x => x.id === id);
      return !t || d.teks.length >= MAKS_TEKS ? d : { ...d, teks: [...d.teks, { ...t, id: baru, x: t.x + 6, y: t.y + 6 }] };
    });
    setPilih({ jenis: 't', id: baru });
  }, [setDok]);
  const ubahBoq = useCallback((ruang: number, kunci: string, isi: IsiBoqItem) => setProyek(p => {
    const r = dokRuang(p, ruang);
    return gabungRuang(p, ruang, { ...r, boq: { ...r.boq, [kunci]: { ...r.boq?.[kunci], ...isi } } });
  }), []);
  const aturSheet2 = useCallback((aktif: boolean) => setProyek(p => ({ ...p, tanpaKoneksi: aktif ? undefined : true })), []);
  const aturKertas = useCallback((k: Kertas) => setProyek(p => ubahKertas(p, k)), []);
  const pilihRuang = useCallback((i: number) => { ruangRef.current = i; setRuangAktifState(i); setPilih(null); }, []);
  const tambahRuangBaru = useCallback(() => {
    const p = proyekRef.current, baru = tambahRuang(p);
    if (baru === p) return;
    setProyek(baru);
    pilihRuang(jumlahRuang(baru) - 1);
  }, [pilihRuang]);
  const duplikatRuangKe = useCallback((i: number) => {
    const p = proyekRef.current, baru = duplikatRuang(p, i);
    if (baru === p) return;
    setProyek(baru);
    pilihRuang(jumlahRuang(baru) - 1);
  }, [pilihRuang]);
  const qtyDariNama = useCallback(() => setDok(d => terapkanQtyDiNama(d)), [setDok]);
  const rapikanSemuaLabel = useCallback(() => { const h = rapikanLabel(dokRef.current); if (h.dipindah) setDok(h.dok); return h.dipindah; }, [setDok]);
  const hapusRuangKe = useCallback((i: number) => {
    const baru = hapusRuang(proyekRef.current, i), aktif = ruangRef.current;
    setProyek(baru);
    pilihRuang(Math.max(0, Math.min(jumlahRuang(baru) - 1, aktif > i ? aktif - 1 : aktif === i ? i - 1 : aktif)));
  }, [pilihRuang]);
  const namaiRuangKe = useCallback((i: number, nama: string) => setProyek(p => namaiRuang(p, i, nama)), []);
  const aturHurufDok = useCallback((kunci: 'perangkat' | 'kabel', nilai: number | undefined) => setDok(d => {
    const huruf = { ...d.huruf, [kunci]: hurufSah(nilai) };
    return { ...d, huruf: huruf.perangkat || huruf.kabel ? huruf : undefined };
  }), [setDok]);

  const hapusSemuaFotoLokal = useCallback(() => setProyek(p => hapusFotoLokal(p)), []);
  const segarkanFotoTim = useCallback((daftar: ItemTim[]) => setProyek(p => segarkanFotoTimDok(p, daftar) ?? p), []);
  const muat = useCallback((d: DokSLD) => { ruangRef.current = 0; setRuangAktifState(0); setProyek(d); riwayat.mulaiBaru(d); setPilih(null); }, [riwayat]);
  const baru = useCallback(() => muat(dokBaru(namaPengguna())), [muat]);
  const contoh = useCallback(() => muat(ubahKertas(contohVoiceKamar(namaPengguna()), '169')), [muat]);

  return {
    dok, setDok, proyek, ruangAktif: aktif, pilihRuang, tambahRuangBaru, duplikatRuangKe, qtyDariNama, rapikanSemuaLabel, hapusRuangKe, namaiRuangKe, siap, pilih, setPilih, geo, temuan, riwayat, galatSimpan, galeri, tambahGaleri, hapusGaleri, pasangFotoKe, logo, setLogo, setWatermark,
    ubahBlok, ubahPerangkat, putarPerangkat, balikPerangkat, ubahKabel, tambahTeks, ubahTeks, duplikatTeks, terpilih, pilihBanyak, togglePilih, geserGrup, salin, tempel, hapusTerpilih, ratakanTerpilih,
    aturLabelDi, aturLebarLabel, aturModel, tambahZona, ubahZona, bersihkanKabelYatim, aturKertas, aturSheet2, aturHurufDok, ubahBoq, tambahPerangkat, tambahObjekTim, segarkanFotoTim, hapusSemuaFotoLokal, duplikat, hubungkan, kabelBebas, geserKabel, hapus, muat, baru, contoh,
    presetTerakhir, setPresetTerakhir, kabelBaruId, setKabelBaruId, gambarKabel, setGambarKabel, alat, setAlat, terapkanFormatKe, urutkanTerpilih, samakanUkuranTerpilih, gantiSemua, aturLompat,
  };
}

export type KeadaanSLD = ReturnType<typeof useKeadaanSLD>;
