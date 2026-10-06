'use client';
import { namaBerkas, unduhSvgPNG, unduhUrl } from '../../bersama/cetak';
import { Angka, Catatan, f, Nilai, Pilih, Segmen } from '../../bersama/ui';
import { type DataKoneksi, namaCadangan, namaPort, type PengaturanKoneksi, PX_RC_UMUM, rantaiDari, SUDUT, susunKoneksi, warnaPort } from './data';
import { svgKoneksi, svgPosterKoneksi } from './svg';
import { hitungKoneksi, RECEIVING_CARD, type SelRC, type SudutMulai } from '@/lib/av-hitung';
import { Cable, Download, Eraser, Image as IkonGambar, Plus, SquareDashed, Trash2, Wand2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
/**
 * Screen Connection ala NovaLCT: grid receiving card, urutan kabel data per port LAN.
 * Dua cara: template cepat (pojok mulai, arah, pola S/Z, pembagian port) atau manual
 * (klik / seret receiving card berurutan per port). Ukuran receiving card bisa mengikuti
 * Kalkulator LED atau diisi bebas per kolom/baris (px); sel bisa dikosongkan untuk layar
 * yang tidak persegi.
 */

/** Ikon pola kabel 3×3 (S/Z) dari pojok & arah - seperti tombol koneksi cepat NovaLCT. */
function IkonPola({ mulai, arah, pola }: { mulai: SudutMulai; arah: 'horizontal' | 'vertikal'; pola: 'S' | 'Z' }) {
  const h = hitungKoneksi({ kolom: 3, baris: 3, pxPerRC: 1, pxPerPort: 100, mulai, arah, pola, bagi: 'penuh' });
  const titik = h.sel.map(s => `${6 + s.c * 10},${6 + s.r * 10}`).join(' ');
  const a = h.sel[0];
  return (
    <svg viewBox="0 0 32 32" width="30" height="30" aria-hidden>
      <rect x="1" y="1" width="30" height="30" rx="3" fill="#f8fafc" stroke="#cbd5e1" />
      <polyline points={titik} fill="none" stroke="#2563eb" strokeWidth="1.8" strokeLinejoin="round" />
      <circle cx={6 + a.c * 10} cy={6 + a.r * 10} r="2.6" fill="#16a34a" />
    </svg>
  );
}

/** Isian angka kecil (untuk deret lebar kolom / tinggi baris). */
function AngkaKecil({ nilai, onUbah, label }: { nilai: number; onUbah: (v: number) => void; label: string }) {
  const [teks, setTeks] = useState<string | null>(null);
  return (
    <input type="number" inputMode="numeric" min={1} step={1} aria-label={label} title={label}
      value={teks ?? String(nilai)}
      onChange={e => { setTeks(e.target.value); const v = Math.round(Number(e.target.value)); if (v >= 1 && v <= 8192) onUbah(v); }}
      onBlur={() => setTeks(null)}
      className="w-[64px] shrink-0 rounded-lg border border-slate-200 bg-white px-1.5 py-1 text-[12px] tabular-nums text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-200" />
  );
}

const kelasTombol = 'inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-transparent';

const kelasJudul = 'text-[11px] font-bold uppercase tracking-wider text-slate-600';

/** Ruang kerja Screen Connection (menu tersendiri di Tools Team). */
export function RuangKoneksi({ d, s, onUbah, namaFile }: {
  d: DataKoneksi; s: PengaturanKoneksi; onUbah: (s: PengaturanKoneksi) => void; namaFile: string;
}) {
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

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,300px)_minmax(0,1fr)] items-start">
      {/* ── Panel pengaturan ── */}
      <div className="space-y-3 min-w-0">
        <section className="rounded-2xl bg-white border border-slate-200 p-3 space-y-3">
          <Segmen label="Cara menyambung" nilai={s.mode} onUbah={v => (v === 'manual' ? keManual(false) : (ubah({ mode: 'template' }), setAlat(null)))}
            opsi={[{ v: 'template', l: 'Template cepat' }, { v: 'manual', l: 'Manual (klik / seret)' }]} />
          {s.mode === 'template' ? (
            <>
              <div>
                <span className={kelasJudul}>Pola koneksi cepat</span>
                <div className="grid grid-cols-4 gap-1.5 mt-1" role="radiogroup" aria-label="Pola koneksi cepat">
                  {(['horizontal', 'vertikal'] as const).flatMap(arah => SUDUT.map(sd => {
                    const on = s.mulai === sd.v && s.arah === arah;
                    return (
                      <button key={`${arah}-${sd.v}`} type="button" role="radio" aria-checked={on} onClick={() => ubah({ mulai: sd.v, arah })}
                        title={`Mulai ${sd.l.toLowerCase()}, kabel ${arah === 'horizontal' ? 'mendatar' : 'tegak'}`}
                        className={`grid place-items-center rounded-xl border p-1 ${on ? 'border-blue-600 bg-blue-50 ring-1 ring-blue-300' : 'border-slate-200 bg-white hover:bg-slate-50'}`}>
                        <IkonPola mulai={sd.v} arah={arah} pola={s.pola} />
                      </button>
                    );
                  }))}
                </div>
                <p className="text-[11px] text-slate-500 mt-1">Titik hijau = receiving card pertama. Baris atas: kabel mendatar, baris bawah: kabel tegak.</p>
              </div>
              <Segmen label="Pola" nilai={s.pola} onUbah={v => ubah({ pola: v })} opsi={[{ v: 'S', l: 'S · bolak-balik' }, { v: 'Z', l: 'Z · balik ke awal' }]} />
              <Segmen label="Pembagian port" nilai={s.bagi} onUbah={v => ubah({ bagi: v })}
                opsi={[{ v: 'baris', l: s.arah === 'horizontal' ? 'Baris utuh' : 'Kolom utuh' }, { v: 'penuh', l: 'Isi penuh' }]} />
              <button type="button" onClick={() => keManual(true)} className={`${kelasTombol} w-full justify-center`}>
                <Wand2 size={14} /> Edit manual dari pola ini
              </button>
            </>
          ) : (
            <>
              <div>
                <div className="flex items-center justify-between">
                  <span className={kelasJudul}>Port aktif</span>
                  <button type="button" className={kelasTombol} onClick={() => { gantiManual(m => [...m, []]); setPortAktif(nPortManual + 1); }}><Plus size={13} /> Port</button>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {(s.manual ?? []).map((rt, i) => {
                    const on = portAktif === i + 1;
                    return (
                      <button key={i} type="button" onClick={() => setPortAktif(i + 1)} aria-pressed={on}
                        className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[12px] font-bold border ${on ? 'text-white border-transparent' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'}`}
                        style={on ? { background: warnaPort(i + 1) } : undefined}>
                        {!on && <span className="w-2 h-2 rounded-sm" style={{ background: warnaPort(i + 1) }} />}P{i + 1}<span className={`font-semibold ${on ? 'text-white/85' : 'text-slate-500'}`}>{rt.length}</span>
                      </button>
                    );
                  })}
                  {!nPortManual && <span className="text-[12px] text-slate-500">Belum ada port - tambah port dulu.</span>}
                </div>
                {pAktif && (
                  <p className="text-[11.5px] text-slate-600 mt-1.5">
                    P{portAktif}: {pAktif.jumlah} RC · {pAktif.px.toLocaleString('id-ID')} px · <b className={pAktif.beban > s.beban ? 'text-rose-700' : 'text-slate-800'}>{f(pAktif.beban, 0)}%</b>
                  </p>
                )}
              </div>
              <Segmen label="Klik sel untuk" nilai={alatEf ?? 'kabel'} onUbah={v => setAlat(v)}
                opsi={[{ v: 'kabel', l: 'Sambung kabel' }, { v: 'kosong', l: 'Kosong / isi' }]} />
              <p className="text-[11.5px] text-slate-600 leading-relaxed">
                {alatEf === 'kabel'
                  ? 'Klik receiving card berurutan (atau tekan lalu seret) untuk menyambung ke port aktif. Klik kartu yang sudah tersambung di port ini untuk memutus dari kartu itu ke belakang.'
                  : 'Klik sel untuk menandai tidak ada receiving card (layar tidak persegi), klik lagi untuk mengisi.'}
              </p>
              <div className="grid grid-cols-2 gap-1.5">
                <button type="button" className={kelasTombol} disabled={!pAktif?.jumlah} onClick={() => gantiManual(m => m.map((rt, i) => (i === portAktif - 1 ? [] : rt)))}><Eraser size={13} /> Putus port ini</button>
                <button type="button" className={kelasTombol} disabled={!nPortManual} onClick={() => { gantiManual(m => m.filter((_, i) => i !== portAktif - 1)); setPortAktif(p => Math.max(1, p - 1)); }}><Trash2 size={13} /> Hapus port</button>
                <button type="button" className={kelasTombol} onClick={() => gantiManual(m => m.map(() => []))}><Cable size={13} /> Putus semua</button>
                <button type="button" className={kelasTombol} onClick={() => keManual(true)}><Wand2 size={13} /> Dari template</button>
              </div>
            </>
          )}
        </section>

        <section className="rounded-2xl bg-white border border-slate-200 p-3 space-y-3">
          <Segmen label="Ukuran receiving card" nilai={t.custom ? 'custom' : 'ikut'} onUbah={v => (v === 'custom' ? keCustom() : ubah({ lebarKol: null, tinggiBaris: null }))}
            opsi={[{ v: 'ikut', l: 'Ikut kalkulator' }, { v: 'custom', l: 'Custom (px)' }]} />
          {!t.custom ? (
            <div>
              <div className="grid grid-cols-2 gap-3">
                <Angka label={`${nUnit} mendatar`} nilai={t.rcKol} step={1} onUbah={v => v >= 1 && ubah({ rcKol: Math.round(v) })} />
                <Angka label={`${nUnit} tegak`} nilai={t.rcBaris} step={1} onUbah={v => v >= 1 && ubah({ rcBaris: Math.round(v) })} />
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Per receiving card: {t.rcKol}×{t.rcBaris} {nUnit} = {t.rcKol * d.pxX}×{t.rcBaris * d.pxY} px{s.rcKol === null && s.rcBaris === null && ' (otomatis)'}
                {(s.rcKol !== null || s.rcBaris !== null) && <button type="button" onClick={() => ubah({ rcKol: null, rcBaris: null })} className="ml-1.5 font-semibold text-blue-700 hover:underline">Otomatis</button>}
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              <div className="grid grid-cols-2 gap-3">
                <Angka label="Kolom RC" nilai={t.K} step={1} onUbah={v => v >= 1 && v <= 256 && ubahJumlah('lebarKol', Math.round(v))} />
                <Angka label="Baris RC" nilai={t.B} step={1} onUbah={v => v >= 1 && v <= 256 && ubahJumlah('tinggiBaris', Math.round(v))} />
              </div>
              <div>
                <span className={kelasJudul}>Lebar tiap kolom (px)</span>
                <div className="flex gap-1 overflow-x-auto pb-1 mt-1">
                  {t.lebar.map((w, i) => <AngkaKecil key={i} nilai={w} label={`Lebar kolom ${i + 1}`} onUbah={v => ubah({ lebarKol: t.lebar.map((x, j) => (j === i ? v : x)), tinggiBaris: [...t.tinggi] })} />)}
                </div>
              </div>
              <div>
                <span className={kelasJudul}>Tinggi tiap baris (px)</span>
                <div className="flex gap-1 overflow-x-auto pb-1 mt-1">
                  {t.tinggi.map((h, i) => <AngkaKecil key={i} nilai={h} label={`Tinggi baris ${i + 1}`} onUbah={v => ubah({ tinggiBaris: t.tinggi.map((x, j) => (j === i ? v : x)), lebarKol: [...t.lebar] })} />)}
                </div>
              </div>
              <div className="flex items-end gap-1.5 flex-wrap">
                <span className="text-[11.5px] text-slate-600 w-full">Samakan semua receiving card:</span>
                <AngkaKecil nilai={samaW} label="Lebar semua (px)" onUbah={setSamaW} /><span className="text-slate-500 text-sm pb-1">×</span>
                <AngkaKecil nilai={samaH} label="Tinggi semua (px)" onUbah={setSamaH} />
                <button type="button" className={kelasTombol} onClick={() => ubah({ lebarKol: t.lebar.map(() => samaW), tinggiBaris: t.tinggi.map(() => samaH) })}>Terapkan</button>
              </div>
            </div>
          )}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="text-[11.5px] text-slate-600">Sel kosong: <b className="text-slate-800">{t.kosong.size}</b></span>
            <div className="flex gap-1.5">
              <button type="button" className={`${kelasTombol} ${alatEf === 'kosong' ? 'ring-2 ring-blue-300 border-blue-400 text-blue-800 bg-blue-50' : ''}`}
                onClick={() => setAlat(alatEf === 'kosong' ? (s.mode === 'manual' ? 'kabel' : null) : 'kosong')} aria-pressed={alatEf === 'kosong'}>
                <SquareDashed size={13} /> {alatEf === 'kosong' ? 'Selesai' : 'Kosongkan sel'}
              </button>
              {t.kosong.size > 0 && <button type="button" className={kelasTombol} onClick={() => ubah({ kosong: [] })}>Isi semua</button>}
            </div>
          </div>
        </section>

        <section className="rounded-2xl bg-white border border-slate-200 p-3 space-y-3">
          <Angka label="Kapasitas per port" nilai={t.pxPort} satuan="px" step={1000} onUbah={v => v >= 1000 && ubah({ pxPort: Math.round(v) })}
            bantuan={s.pxPort === null ? `Dari kalkulator: ${d.refresh} Hz, ${d.bit}-bit` : 'Diisi manual'} />
          {s.pxPort !== null && <button type="button" onClick={() => ubah({ pxPort: null })} className="-mt-2 text-[12px] font-semibold text-blue-700 hover:underline">Ikut kalkulator ({d.pxPerPort.toLocaleString('id-ID')} px)</button>}
          <Angka label="Batas beban port" nilai={s.beban} satuan="%" step={1} onUbah={v => v >= 10 && v <= 100 && ubah({ beban: Math.round(v) })}
            bantuan={`Maks ${Math.floor((t.pxPort * s.beban) / 100).toLocaleString('id-ID')} px per port`} />
          <Pilih label="Model receiving card" nilai={s.rcModel ?? ''} onUbah={v => ubah({ rcModel: v || null, rcKol: null, rcBaris: null })}
            opsi={[{ v: '', l: 'Umum (±512 × 512 px)' }, ...RECEIVING_CARD.map(r => ({ v: r.nama, l: `${r.nama} · ${r.w}×${r.h} px · ${r.ket}` }))]} />
          <Segmen label="Kabel cadangan (backup)" nilai={s.cadangan} onUbah={v => ubah({ cadangan: v })}
            opsi={[{ v: 'tidak', l: 'Tidak' }, { v: 'loop', l: 'Loop port' }, { v: 'controller', l: 'Controller' }]} />
          {s.cadangan !== 'tidak' && (
            <p className="-mt-2 text-[11px] text-slate-500">
              {s.cadangan === 'loop'
                ? 'Ujung tiap rantai kembali ke port cadangan di controller yang sama (separuh port controller untuk cadangan). Satu kabel putus, layar tetap tampil.'
                : 'Ujung tiap rantai disambung ke controller cadangan (hot backup). Controller utama mati, layar tetap tampil.'}
            </p>
          )}
          <Angka label="Port per controller" nilai={t.ppkPenuh} step={1} satuan="port" onUbah={v => v >= 0 && ubah({ ppk: Math.round(v) })}
            bantuan={s.ppk === null ? (d.namaHw ? `Dari ${d.namaHw}` : 'Belum ada hardware: isi manual') : 'Diisi manual'} />
          {s.ppk !== null && d.ppkHw > 0 && <button type="button" onClick={() => ubah({ ppk: null })} className="-mt-2 text-[12px] font-semibold text-blue-700 hover:underline">Ikut hardware ({d.ppkHw} port)</button>}
        </section>
      </div>

      {/* ── Kanvas & tabel ── */}
      <div className="space-y-3 min-w-0">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <Nilai label="Receiving card" nilai={k.sel.length + k.tanpaPort.length} ket={`${t.K} × ${t.B}${t.kosong.size ? ` · ${t.kosong.size} kosong` : ''}`} />
          <Nilai label="Port LAN dipakai" nilai={t.portTerpakai} ket={`perkiraan pixel: ${d.portIdeal}`} nada={t.portTerpakai > d.portIdeal ? 'awas' : undefined} />
          <Nilai label="Controller" nilai={t.ppk > 0 ? t.controller + t.controllerCadangan : '-'}
            ket={t.ppk > 0 ? `${t.ppkPenuh} port/unit${d.namaHw && s.ppk === null ? ` · ${d.namaHw}` : ''}${t.controllerCadangan ? ` · ${t.controllerCadangan} cadangan` : t.cadangan === 'loop' ? ` · ${t.ppk} utama + ${t.ppk} cadangan` : ''}` : 'isi port per controller'} />
          <Nilai label="Beban rata-rata" nilai={f(rataBeban, 0)} satuan="%" ket={`resolusi ${t.resX}×${t.resY}`} />
        </div>
        {k.galat && <p className="text-[12.5px] text-rose-800 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">{k.galat}</p>}
        {s.mode === 'manual' && k.tanpaPort.length > 0 && (
          <p className="text-[12.5px] text-amber-900 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">{k.tanpaPort.length} receiving card belum tersambung (bingkai jingga putus-putus).</p>
        )}
        {k.lewat.length > 0 && (
          <p className="text-[12.5px] text-rose-800 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">Port {k.lewat.join(', ')} melebihi batas beban {s.beban}% - pindahkan sebagian receiving card ke port lain.</p>
        )}
        {t.rc && t.rcLewat && (
          <p className="text-[12.5px] text-rose-800 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">
            Ada receiving card melebihi kapasitas {t.rc.nama} ({t.rc.w}×{t.rc.h} px). Kurangi {nUnit} per receiving card atau pilih model yang lebih besar.
          </p>
        )}
        {s.cadangan === 'loop' && t.ppkPenuh === 1 && (
          <p className="text-[12.5px] text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">Controller hanya 1 port: loop cadangan butuh port kedua. Pilih &quot;Controller&quot; atau hardware dengan port lebih banyak.</p>
        )}
        {!t.rc && Math.max(...t.lebar) * Math.max(...t.tinggi) > PX_RC_UMUM && !k.galat && (
          <p className="text-[12.5px] text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
            Ada receiving card lebih dari ±512×512 px (kapasitas receiving card umum). Kecilkan area per receiving card atau cek tipe receiving card.
          </p>
        )}
        {t.custom && (t.resX !== resKalk.x || t.resY !== resKalk.y) && (
          <p className="text-[12.5px] text-amber-800">Resolusi receiving card ({t.resX}×{t.resY}) berbeda dari layar di kalkulator ({resKalk.x}×{resKalk.y}).</p>
        )}
        {s.mode === 'template' && s.bagi === 'baris' && zona > 1 && (
          <p className="text-[12.5px] text-slate-700">Satu {s.arah === 'horizontal' ? 'baris' : 'kolom'} melebihi kapasitas port, jadi layar dibagi <b>{zona} zona</b> yang dikabel terpisah. Pilih &quot;Isi penuh&quot; untuk menghemat port.</p>
        )}
        <div className="rounded-2xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-slate-100 flex-wrap">
            <span className="text-[12px] text-slate-600">
              {alatEf === 'kabel' ? <>Mode kabel · port aktif <b style={{ color: warnaPort(portAktif) }}>P{portAktif}</b></>
                : alatEf === 'kosong' ? 'Mode kosongkan sel - klik sel untuk mengosongkan / mengisi'
                  : 'Template cepat - pilih "Manual" untuk menyambung sendiri'}
            </span>
            <div className="flex items-center gap-1.5">
              <button type="button" onClick={() => void unduhPNG()} disabled={pngStatus === 'proses'} title="Unduh diagram + legenda port sebagai gambar PNG (resolusi 2x)" className={kelasTombol}>
                <IkonGambar size={14} /> {pngStatus === 'proses' ? 'Membuat...' : pngStatus === 'gagal' ? 'PNG gagal' : 'PNG'}
              </button>
              <button type="button" onClick={unduhSVG} title="Unduh diagram sebagai SVG (vektor, bisa diedit di Illustrator / Inkscape)" className={kelasTombol}><Download size={14} /> SVG</button>
            </div>
          </div>
          {/* HP: diagram diberi lebar minimum (±48 px per receiving card) lalu digeser mendatar,
              supaya sel tetap cukup besar untuk diketuk / diseret saat menyambung kabel. */}
          <div className="overflow-x-auto">
          <div className="p-2 [&>svg]:mx-auto [&>svg]:block select-none" role="img" style={{ minWidth: Math.min(1100, t.K * 48 + 110) }}
            aria-label={`Diagram koneksi ${t.portTerpakai} port untuk ${k.sel.length} receiving card`}
            onPointerDown={e => {
              if (!alatEf) return;
              const sel = selDari(e.target as Element); if (!sel) return;
              e.preventDefault();
              try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* abaikan */ }
              klikSel(sel[0], sel[1]);
            }}
            onPointerMove={e => {
              if (!seret.current) return;
              const sel = selDari(document.elementFromPoint(e.clientX, e.clientY));
              if (sel) seretKe(sel[0], sel[1]);
            }}
            onPointerUp={() => { seret.current = false; }} onPointerCancel={() => { seret.current = false; }}
            dangerouslySetInnerHTML={{ __html: svg }} />
          </div>
        </div>
        <div className="overflow-x-auto max-h-80 overflow-y-auto rounded-2xl border border-slate-200 bg-white">
          <table className="w-full text-[12.5px]">
            <thead className="bg-slate-50 text-slate-600 sticky top-0">
              <tr>
                <th className="text-left font-bold px-3 py-2">Port</th>
                <th className="text-right font-bold px-3 py-2">RC</th>
                <th className="text-right font-bold px-3 py-2">Pixel</th>
                <th className="text-left font-bold px-3 py-2 w-40">Beban</th>
                <th className="text-left font-bold px-3 py-2">Masuk di</th>
                {t.cadangan !== 'tidak' && <th className="text-left font-bold px-3 py-2">Cadangan (B)</th>}
              </tr>
            </thead>
            <tbody>
              {k.port.map(p => (
                <tr key={p.port} className={`border-t border-slate-100 ${s.mode === 'manual' ? 'cursor-pointer hover:bg-slate-50' : ''} ${s.mode === 'manual' && p.port === portAktif ? 'bg-blue-50/60' : ''}`}
                  onClick={() => s.mode === 'manual' && setPortAktif(p.port)}>
                  <td className="px-3 py-1.5 font-semibold text-slate-800 whitespace-nowrap">
                    <span className="inline-block w-2.5 h-2.5 rounded-sm mr-2 align-middle" style={{ background: warnaPort(p.port) }} />{namaPort(t, p.port)}
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{p.jumlah}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{p.px.toLocaleString('id-ID')}</td>
                  <td className="px-3 py-1.5">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 flex-1 rounded-full bg-slate-200 overflow-hidden">
                        <div className={`h-full rounded-full ${p.beban > 100 ? 'bg-rose-600' : p.beban > s.beban ? 'bg-amber-500' : 'bg-emerald-600'}`} style={{ width: `${Math.min(100, p.beban)}%` }} />
                      </div>
                      <span className="tabular-nums w-9 text-right">{f(p.beban, 0)}%</span>
                    </div>
                  </td>
                  <td className="px-3 py-1.5 text-slate-600 whitespace-nowrap">{p.mulai ? `kolom ${p.mulai.c + 1}, baris ${p.mulai.r + 1}` : '—'}</td>
                  {t.cadangan !== 'tidak' && <td className="px-3 py-1.5 text-slate-600 whitespace-nowrap">{p.jumlah ? namaCadangan(t, p.port) : '—'}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Catatan>Label sel = port-urutan receiving card, angka kecil = ukuran receiving card (px); P1, P2, … = titik masuk kabel LAN{s.cadangan !== 'tidak' ? '; B1, B2, … = kabel cadangan dari ujung rantai' : ''}. Samakan dengan NovaLCT (Screen Configuration → Screen Connection) saat instalasi.</Catatan>
      </div>
    </div>
  );
}
