'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getSession } from '@/lib/auth/sesi';
import { contohVoiceKamar } from '@/lib/sld/contoh';
import {
  bersihkanDok, dokBaru, hapusPerangkat, idBaru, kabelBaru, pasangFoto, perangkatBaru, petaFoto, tanpaFoto, ujungBaru,
} from '@/lib/sld/dok';
import { rasioDinding } from '@/lib/sld/dinding';
import { geometri, sudutSah } from '@/lib/sld/geometri';
import { cariTemplat } from '@/lib/sld/katalog';
import { isiPreset, presetKabel } from '@/lib/sld/preset-kabel';
import { periksaDok } from '@/lib/sld/turunan';
import { AREA, type BlokJudul, type DokSLD, type Kabel, MAKS_KABEL, MAKS_PERANGKAT, type Perangkat, UKURAN_MIN } from '@/lib/sld/tipe';
import { useRiwayat } from '../bersama/riwayat';
import {
  type FotoGaleri, type IngatanFoto, kunciModel, muatFotoDraf, muatGaleri, muatIngatan, muatLogo, simpanFotoDraf, simpanGaleri, simpanIngatan, simpanLogo,
} from './foto-lokal';
import type { FotoSiap } from './gambar';

const KUNCI = 'tools-team-sld-v1';
const KUNCI_PRESET = 'tools-team-sld-kabel';
const TEKS_DINDING = ['nama', 'model', 'ket', 'subGambar', 'ikon'];

export type Pilihan = { jenis: 'p' | 'k'; id: string } | null;

const namaPengguna = () => {
  const u = getSession<{ full_name?: string; username?: string }>();
  return u?.full_name || u?.username || '';
};

function muatDraf(): DokSLD | null {
  try { return bersihkanDok(JSON.parse(localStorage.getItem(KUNCI) ?? 'null')); } catch { return null; }
}

export function useKeadaanSLD() {
  const [dok, setDok] = useState<DokSLD>(() => dokBaru());
  const [siap, setSiap] = useState(false);
  const [pilih, setPilih] = useState<Pilihan>(null);
  const [galatSimpan, setGalatSimpan] = useState(false);
  const [galeri, setGaleri] = useState<FotoGaleri[]>([]);
  const [logo, setLogoState] = useState<string | null>(null);
  const ingatan = useRef<IngatanFoto>({});
  const mulaiRef = useRef<(d: DokSLD) => void>(() => {});

  useEffect(() => {
    let batal = false;
    const d = muatDraf() ?? dokBaru(namaPengguna());
    void Promise.all([muatFotoDraf().catch(() => ({})), muatGaleri().catch(() => []), muatLogo().catch(() => null), muatIngatan().catch(() => ({}))]).then(([peta, g, l, m]) => {
      if (batal) return;
      ingatan.current = m;
      const awal = pasangFoto(d, peta);
      setDok(awal); setGaleri(g); setLogoState(l); setSiap(true); mulaiRef.current(awal);
    });
    return () => { batal = true; };
  }, []);
  useEffect(() => {
    if (!siap) return;
    const t = setTimeout(() => {
      try { localStorage.setItem(KUNCI, JSON.stringify(tanpaFoto(dok))); setGalatSimpan(false); } catch { setGalatSimpan(true); }
    }, 500);
    return () => clearTimeout(t);
  }, [dok, siap]);
  const kunciFoto = dok.perangkat.map(p => (p.gambar ? `${p.id}:${p.gambar.length}` : '')).join('|');
  const dokRef = useRef(dok); dokRef.current = dok;
  useEffect(() => {
    if (!siap) return;
    const t = setTimeout(() => { simpanFotoDraf(petaFoto(dokRef.current)).catch(() => setGalatSimpan(true)); }, 600);
    return () => clearTimeout(t);
  }, [kunciFoto, siap]);

  const riwayat = useRiwayat(dok, setDok);
  mulaiRef.current = riwayat.mulaiBaru;
  const geo = useMemo(() => geometri(dok), [dok]);
  const temuan = useMemo(() => periksaDok(dok), [dok]);

  const ingatFoto = useCallback((model: string, f: { dataUrl: string; rasio: number }) => {
    const k = kunciModel(model);
    if (!k) return;
    ingatan.current = { ...ingatan.current, [k]: { gambar: f.dataUrl, rasio: f.rasio } };
    void simpanIngatan(ingatan.current).catch(() => {});
  }, []);
  const pasangIngatan = useCallback((d: DokSLD): DokSLD => ({ ...d, perangkat: d.perangkat.map(p => {
    const m = !p.gambar && p.model.trim() ? ingatan.current[kunciModel(p.model)] : undefined;
    return m ? { ...p, gambar: m.gambar, rasio: m.rasio } : p;
  }) }), []);
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
  const setWatermark = useCallback((aktif: boolean) => setDok(d => ({ ...d, watermark: aktif })), []);

  const pasangFotoKe = useCallback((id: string, f: FotoSiap, nama = 'Foto') => {
    const p = dokRef.current.perangkat.find(x => x.id === id);
    if (p?.model.trim()) ingatFoto(p.model, f);
    setDok(d => ({ ...d, perangkat: d.perangkat.map(p => (p.id === id
      ? { ...p, gambar: f.dataUrl, rasio: f.rasio, h: Math.max(10, Math.min(80, Math.round((p.w / f.rasio) * 2) / 2)) } : p)) }));
    tambahGaleri([{ id: idBaru('g'), nama, gambar: f.dataUrl, rasio: f.rasio }]);
  }, [tambahGaleri, ingatFoto]);

  const ubahBlok = useCallback((p: Partial<BlokJudul>) => setDok(d => ({ ...d, blok: { ...d.blok, ...p } })), []);
  const ubahPerangkat = useCallback((id: string, p: Partial<Perangkat>) =>
    setDok(d => ({ ...d, perangkat: d.perangkat.map(x => {
      if (x.id !== id) return x;
      const ingat = p.model !== undefined && !x.gambar ? ingatan.current[kunciModel(p.model)] : undefined;
      const baru = ingat ? { ...x, ...p, gambar: ingat.gambar, rasio: ingat.rasio } : { ...x, ...p };
      const rd = !baru.gambar && !baru.foto && TEKS_DINDING.some(k => k in p) ? rasioDinding(baru.ikon, baru) : null;
      return rd && p.h === undefined ? { ...baru, h: Math.round(Math.min(AREA.h, Math.max(UKURAN_MIN.h, baru.w / rd)) * 2) / 2 } : baru;
    }) })), []);
  const putarPerangkat = useCallback((id: string, delta: number) => setDok(d => ({ ...d, perangkat: d.perangkat.map(x => {
    if (x.id !== id) return x;
    const putar = sudutSah((x.putar ?? 0) + delta) || undefined;
    if (Math.abs(delta) % 180 !== 90) return { ...x, putar };
    const w = Math.max(UKURAN_MIN.w, x.h), h = Math.max(UKURAN_MIN.h, x.w);
    return { ...x, putar, w, h, x: x.x + (x.w - w) / 2, y: x.y + (x.h - h) / 2 };
  }) })), []);
  const balikPerangkat = useCallback((id: string, sumbu: 'h' | 'v') => setDok(d => ({ ...d, perangkat: d.perangkat.map(x => {
    if (x.id !== id) return x;
    return sumbu === 'h' ? { ...x, balikH: !x.balikH || undefined } : { ...x, balikV: !x.balikV || undefined };
  }) })), []);
  const ubahKabel = useCallback((id: string, p: Partial<Kabel>) =>
    setDok(d => ({ ...d, kabel: d.kabel.map(x => (x.id === id ? { ...x, ...p } : x)) })), []);

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
  }, []);

  const duplikat = useCallback((id: string) => {
    const baru = idBaru('p');
    setDok(d => {
      const p = d.perangkat.find(x => x.id === id);
      if (!p || d.perangkat.length >= MAKS_PERANGKAT) return d;
      return { ...d, perangkat: [...d.perangkat, { ...p, id: baru, x: p.x + 8, y: p.y + 8 }] };
    });
    setPilih({ jenis: 'p', id: baru });
  }, []);

  const [presetTerakhir, setPresetTerakhirState] = useState(() => {
    try { return localStorage.getItem(KUNCI_PRESET) ?? 'cat6'; } catch { return 'cat6'; }
  });
  const [kabelBaruId, setKabelBaruId] = useState<string | null>(null);
  const setPresetTerakhir = useCallback((k: string) => {
    setPresetTerakhirState(k);
    try { localStorage.setItem(KUNCI_PRESET, k); } catch {  }
  }, []);
  const hubungkan = useCallback((dari: string, ke: string) => {
    if (dari === ke) return;
    const c = kabelBaru(dari, ke, isiPreset(presetKabel(presetTerakhir)));
    setDok(d => (d.kabel.length >= MAKS_KABEL ? d : { ...d, kabel: [...d.kabel, c] }));
    setPilih({ jenis: 'k', id: c.id });
    setKabelBaruId(c.id);
  }, [presetTerakhir]);

  const kabelBebas = useCallback(() => {
    const c = { ...kabelBaru('', '', { jenis: 'ac', daya: true, media: 'Kabel listrik 230 VAC' }), dari: { ...ujungBaru(), nama: 'MCB panel listrik' } };
    setDok(d => (d.kabel.length >= MAKS_KABEL ? d : { ...d, kabel: [...d.kabel, c] }));
    setPilih({ jenis: 'k', id: c.id });
  }, []);

  const geserKabel = useCallback((id: string, arah: -1 | 1) => setDok(d => {
    const i = d.kabel.findIndex(c => c.id === id), j = i + arah;
    if (i < 0 || j < 0 || j >= d.kabel.length) return d;
    const kabel = [...d.kabel];
    [kabel[i], kabel[j]] = [kabel[j], kabel[i]];
    return { ...d, kabel };
  }), []);

  const hapus = useCallback((p: Pilihan) => {
    if (!p) return;
    setDok(d => (p.jenis === 'p' ? hapusPerangkat(d, p.id) : { ...d, kabel: d.kabel.filter(c => c.id !== p.id) }));
    setPilih(null);
  }, []);

  const muat = useCallback((d: DokSLD) => { setDok(d); riwayat.mulaiBaru(d); setPilih(null); }, [riwayat]);
  const baru = useCallback(() => muat(dokBaru(namaPengguna())), [muat]);
  const contoh = useCallback(() => muat(contohVoiceKamar(namaPengguna())), [muat]);

  return {
    dok, setDok, siap, pilih, setPilih, geo, temuan, riwayat, galatSimpan, galeri, tambahGaleri, hapusGaleri, pasangFotoKe, ingatFoto, logo, setLogo, setWatermark,
    ubahBlok, ubahPerangkat, putarPerangkat, balikPerangkat, ubahKabel, tambahPerangkat, duplikat, hubungkan, kabelBebas, geserKabel, hapus, muat, baru, contoh,
    presetTerakhir, setPresetTerakhir, kabelBaruId, setKabelBaruId, pasangIngatan,
  };
}

export type KeadaanSLD = ReturnType<typeof useKeadaanSLD>;
