'use client';
/** Keadaan Screen Connection: susunan kabel, alat manual (klik / seret), ukuran custom, ekspor PNG / SVG. */
import { useEffect, useMemo, useRef, useState } from 'react';
import { namaBerkas, unduhSvgPNG, unduhUrl } from '../../bersama/cetak';
import { type DataKoneksi, type PengaturanKoneksi, rantaiDari, susunKoneksi } from './data';
import { svgKoneksi, svgPosterKoneksi } from './svg';
import type { SelRC } from '@/lib/av-hitung';

export interface PropsRuangKoneksi {
  d: DataKoneksi; s: PengaturanKoneksi; onUbah: (s: PengaturanKoneksi) => void; namaFile: string;
}

export function useRuangKoneksi(p: PropsRuangKoneksi) {
  const { d, s, onUbah, namaFile } = p;
  const t = useMemo(() => susunKoneksi(d, s), [d, s]);
  const k = t.hasil;
  const [portAktif, setPortAktif] = useState(1);
  const [alat, setAlat] = useState<'kabel' | 'kosong' | null>(null);
  const alatEf = s.mode === 'manual' ? (alat ?? 'kabel') : alat;
  const svg = useMemo(() => svgKoneksi(d, t, { interaktif: true, portAktif: s.mode === 'manual' ? portAktif : undefined }), [d, t, s.mode, portAktif]);
  const ubah = (p: Partial<PengaturanKoneksi>) => onUbah({ ...s, ...p });
  const nUnit = d.satuan === 'modul' ? 'modul' : 'cabinet';
  const nPortManual = (s.manual ?? []).length;
  useEffect(() => { if (s.mode === 'manual' && portAktif > Math.max(1, nPortManual)) setPortAktif(Math.max(1, nPortManual)); }, [s.mode, nPortManual, portAktif]);

  //  Pengaturan terbaru untuk klik/seret beruntun (sebelum React sempat render ulang).
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
    const m = rantaiSalin(), ai = portAktif - 1;
    while (m.length <= ai) m.push([]);
    const pos = m[ai].findIndex(x => sama(x, c, r));
    if (pos >= 0) { m[ai] = m[ai].slice(0, pos); seret.current = false; }   // putus dari kartu ini ke belakang
    else {
      for (let i = 0; i < m.length; i++) if (i !== ai) m[i] = m[i].filter(x => !sama(x, c, r));
      m[ai].push([c, r]); seret.current = true;
    }
    terapkan({ ...sk, manual: m });
  };
  const seretKe = (c: number, r: number) => {
    if (!seret.current || alatEf !== 'kabel') return;
    const sk = sRef.current;
    if (sk.kosong.some(x => sama(x, c, r)) || (sk.manual ?? []).some(rt => rt.some(x => sama(x, c, r)))) return;
    const m = rantaiSalin(), ai = portAktif - 1;
    while (m.length <= ai) m.push([]);
    m[ai].push([c, r]);
    terapkan({ ...sk, manual: m });
  };
  const selDari = (el: Element | null): [number, number] | null => {
    const v = el?.closest('[data-sel]')?.getAttribute('data-sel');
    if (!v) return null;
    const [c, r] = v.split(',').map(Number);
    return Number.isInteger(c) && Number.isInteger(r) ? [c, r] : null;
  };

  const keManual = (dariTemplate: boolean) => {
    const rantai = dariTemplate || !s.manual ? rantaiDari(susunKoneksi(d, { ...s, mode: 'template' }).hasil) : s.manual;
    onUbah({ ...s, mode: 'manual', manual: rantai });
    setPortAktif(1); setAlat('kabel');
  };
  const gantiManual = (fn: (m: SelRC[][]) => SelRC[][]) => onUbah({ ...s, manual: fn((s.manual ?? []).map(r => [...r])) });

  //  Ukuran receiving card bebas: mulai dari grid yang sedang tampil.
  const keCustom = () => onUbah({ ...s, lebarKol: [...t.lebar], tinggiBaris: [...t.tinggi] });
  const ubahJumlah = (sumbu: 'lebarKol' | 'tinggiBaris', jumlah: number) => {
    const lama = (s[sumbu] ?? (sumbu === 'lebarKol' ? t.lebar : t.tinggi));
    const baru = Array.from({ length: jumlah }, (_, i) => lama[i] ?? lama[lama.length - 1] ?? 256);
    onUbah({ ...s, lebarKol: sumbu === 'lebarKol' ? baru : s.lebarKol ?? [...t.lebar], tinggiBaris: sumbu === 'tinggiBaris' ? baru : s.tinggiBaris ?? [...t.tinggi] });
  };
  const [samaW, setSamaW] = useState(256), [samaH, setSamaH] = useState(256);

  const poster = () => svgPosterKoneksi(d, s, 'Screen Connection LED', namaFile);
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

  const rataBeban = k.port.length ? k.port.reduce((a, p) => a + p.beban, 0) / k.port.length : 0;
  const zona = s.mode === 'template' && s.bagi === 'baris'
    ? new Set(k.port.filter(p => p.mulai).map(p => (s.arah === 'horizontal' ? p.mulai!.c : p.mulai!.r))).size : 1;
  const pAktif = k.port.find(p => p.port === portAktif);
  const resKalk = { x: d.kolom * d.pxX, y: d.baris * d.pxY };

  return { alat, alatEf, d, gantiManual, k, keCustom, keManual, klikSel, nPortManual, nUnit, namaFile, onUbah, pAktif, pngStatus, portAktif, poster, rantaiSalin, rataBeban, resKalk, s, sRef, sama, samaH, samaW, selDari, seret, seretKe, setAlat, setPngStatus, setPortAktif, setSamaH, setSamaW, svg, t, terapkan, ubah, ubahJumlah, unduhPNG, unduhSVG, zona };
}

export type AlatRuangKoneksi = ReturnType<typeof useRuangKoneksi>;
