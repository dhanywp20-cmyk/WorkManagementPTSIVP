'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { namaBerkas, unduhSvgPNG, unduhUrl } from '../../bersama/cetak';
import { type PengaturanKoneksi, rantaiDari, susunKoneksi } from './data';
import { KUNCI_VP, type LayarKoneksi, susunMulti } from './multi';
import { svgKoneksiMulti, svgPosterKoneksiMulti } from './svg';
import type { SelRC } from '@/lib/av/hitung';

export interface PropsRuangKoneksi {
  /** Screen 1 dulu; semua screen memakai satu video processor. */
  layar: LayarKoneksi[];
  onUbah: (i: number, s: PengaturanKoneksi) => void;
  pisahKartu: boolean; onPisahKartu: (v: boolean) => void;
  namaFile: string;
}

export function useRuangKoneksi(p: PropsRuangKoneksi) {
  const { layar, onUbah: onUbahLayar, pisahKartu, onPisahKartu, namaFile } = p;
  const m = useMemo(() => susunMulti(layar, pisahKartu), [layar, pisahKartu]);
  const [aktifIn, setAktifIn] = useState(0);
  const aktif = Math.min(aktifIn, m.per.length - 1);
  const b = m.per[aktif];
  const { d, s, t, off } = b;
  const g = m.gabung;
  const k = t.hasil;
  const [portAktif, setPortAktif] = useState(1);
  const [alat, setAlat] = useState<'kabel' | 'kosong' | null>(null);
  const alatEf = s.mode === 'manual' ? (alat ?? 'kabel') : alat;
  const svg = useMemo(() => svgKoneksiMulti(m, { interaktif: true, aktif, portAktif: s.mode === 'manual' ? off + portAktif : undefined }), [m, aktif, s.mode, off, portAktif]);
  /** Kunci milik video processor selalu disimpan di Screen 1. */
  const onUbah = (baru: PengaturanKoneksi) => {
    if (aktif > 0 && KUNCI_VP.some(x => baru[x] !== s[x])) {
      const s0 = layar[0].s;
      onUbahLayar(0, { ...s0, ...Object.fromEntries(KUNCI_VP.map(x => [x, baru[x]])) });
    }
    onUbahLayar(aktif, baru);
  };
  const ubah = (x: Partial<PengaturanKoneksi>) => onUbah({ ...s, ...x });
  const nUnit = d.satuan === 'modul' ? 'modul' : 'cabinet';
  const nPortManual = (s.manual ?? []).length;
  useEffect(() => { if (s.mode === 'manual' && portAktif > Math.max(1, nPortManual)) setPortAktif(Math.max(1, nPortManual)); }, [s.mode, nPortManual, portAktif]);
  const pilihLayar = (i: number) => { if (i === aktif) return; setAktifIn(i); setPortAktif(1); setAlat(null); };

  const sRef = useRef(s); sRef.current = s;
  const seret = useRef(false);
  const terapkan = (baru: PengaturanKoneksi) => { sRef.current = baru; onUbah(baru); };
  const rantaiSalin = () => (sRef.current.manual ?? []).map(r => [...r] as SelRC[]);
  const sama = (a: SelRC, c: number, r: number) => a[0] === c && a[1] === r;

  const klikSel = (c: number, r: number) => {
    const sk = sRef.current;
    const kosongIni = sk.kosong.some(x => sama(x, c, r));
    if (alatEf === 'kosong') {
      const kosong = kosongIni ? sk.kosong.filter(x => !sama(x, c, r)) : [...sk.kosong, [c, r] as SelRC];
      terapkan({ ...sk, kosong, manual: sk.manual?.map(rt => rt.filter(x => !sama(x, c, r))) ?? null });
      return;
    }
    if (alatEf !== 'kabel' || kosongIni) return;
    const mm = rantaiSalin(), ai = portAktif - 1;
    while (mm.length <= ai) mm.push([]);
    const pos = mm[ai].findIndex(x => sama(x, c, r));
    if (pos >= 0) { mm[ai] = mm[ai].slice(0, pos); seret.current = false; }
    else {
      for (let i = 0; i < mm.length; i++) if (i !== ai) mm[i] = mm[i].filter(x => !sama(x, c, r));
      mm[ai].push([c, r]); seret.current = true;
    }
    terapkan({ ...sk, manual: mm });
  };
  const seretKe = (c: number, r: number) => {
    if (!seret.current || alatEf !== 'kabel') return;
    const sk = sRef.current;
    if (sk.kosong.some(x => sama(x, c, r)) || (sk.manual ?? []).some(rt => rt.some(x => sama(x, c, r)))) return;
    const mm = rantaiSalin(), ai = portAktif - 1;
    while (mm.length <= ai) mm.push([]);
    mm[ai].push([c, r]);
    terapkan({ ...sk, manual: mm });
  };
  /** [layar, kolom, baris] dari sel yang disentuh. */
  const selDari = (el: Element | null): [number, number, number] | null => {
    const node = el?.closest('[data-sel]');
    const v = node?.getAttribute('data-sel');
    if (!v) return null;
    const [c, r] = v.split(',').map(Number);
    const l = Number(node?.getAttribute('data-layar') ?? 0);
    return Number.isInteger(c) && Number.isInteger(r) ? [Number.isInteger(l) ? l : 0, c, r] : null;
  };

  const keManual = (dariTemplate: boolean) => {
    const rantai = dariTemplate || !s.manual ? rantaiDari(susunKoneksi(d, { ...s, mode: 'template' }).hasil) : s.manual;
    onUbah({ ...s, mode: 'manual', manual: rantai });
    setPortAktif(1); setAlat('kabel');
  };
  const gantiManual = (fn: (x: SelRC[][]) => SelRC[][]) => onUbah({ ...s, manual: fn((s.manual ?? []).map(r => [...r])) });

  const keCustom = () => onUbah({ ...s, lebarKol: [...t.lebar], tinggiBaris: [...t.tinggi] });
  const ubahJumlah = (sumbu: 'lebarKol' | 'tinggiBaris', jumlah: number) => {
    const lama = (s[sumbu] ?? (sumbu === 'lebarKol' ? t.lebar : t.tinggi));
    const baru = Array.from({ length: jumlah }, (_, i) => lama[i] ?? lama[lama.length - 1] ?? 256);
    onUbah({ ...s, lebarKol: sumbu === 'lebarKol' ? baru : s.lebarKol ?? [...t.lebar], tinggiBaris: sumbu === 'tinggiBaris' ? baru : s.tinggiBaris ?? [...t.tinggi] });
  };
  const [samaW, setSamaW] = useState(256), [samaH, setSamaH] = useState(256);

  const poster = () => svgPosterKoneksiMulti(layar, pisahKartu, 'Screen Connection LED', namaFile);
  const [pngStatus, setPngStatus] = useState<'siap' | 'proses' | 'gagal'>('siap');
  const unduhPNG = async () => {
    setPngStatus('proses');
    try { await unduhSvgPNG(poster(), namaBerkas('Screen Connection', namaFile), 2); setPngStatus('siap'); }
    catch { setPngStatus('gagal'); setTimeout(() => setPngStatus('siap'), 2500); }
  };
  const unduhSVG = () => {
    const url = URL.createObjectURL(new Blob([poster()], { type: 'image/svg+xml' }));
    unduhUrl(url, `${namaBerkas('Screen Connection', namaFile)}.svg`);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  const rataBeban = g.hasil.port.length ? g.hasil.port.reduce((a, x) => a + x.beban, 0) / g.hasil.port.length : 0;
  const zona = s.mode === 'template' && s.bagi === 'baris'
    ? new Set(k.port.filter(x => x.mulai).map(x => (s.arah === 'horizontal' ? x.mulai!.c : x.mulai!.r))).size : 1;
  const pAktif = k.port.find(x => x.port === off + portAktif);
  const resKalk = { x: d.kolom * d.pxX, y: d.baris * d.pxY };

  return { aktif, alat, alatEf, b, d, g, gantiManual, k, keCustom, keManual, klikSel, m, nPortManual, nUnit, namaFile, off, onPisahKartu, onUbah, pAktif, pilihLayar, pisahKartu, pngStatus, portAktif, poster, rantaiSalin, rataBeban, resKalk, s, sRef, sama, samaH, samaW, selDari, seret, seretKe, setAlat, setPngStatus, setPortAktif, setSamaH, setSamaW, svg, t, terapkan, ubah, ubahJumlah, unduhPNG, unduhSVG, zona };
}

export type AlatRuangKoneksi = ReturnType<typeof useRuangKoneksi>;
