'use client';
import { useMemo, useState } from 'react';
import { getSession } from '@/lib/auth';
import {
  hitungLED, cabinetUntukUkuran, saranHardware, kapasitasHardware, KECERAHAN, type Pembulatan, type Hardware,
} from '@/lib/av-hitung';
import { Angka, Pilih, Segmen, Kartu, Nilai, TombolSalin, Catatan, f, kelasInput } from './ui';
import { useReferensiLED, EditorReferensiLED } from './ReferensiLED';
import { Ikon } from '@/components/shared/Ikon';

const PITCH = [0.9, 1.2, 1.25, 1.5, 1.56, 1.86, 1.9, 2, 2.5, 2.6, 2.9, 3.91, 4.81, 5, 6.67, 8, 10];
const CABINET: { v: string; l: string; w: number; h: number }[] = [
  { v: '500x500', l: '500 × 500 mm', w: 500, h: 500 },
  { v: '500x1000', l: '500 × 1000 mm', w: 500, h: 1000 },
  { v: '640x480', l: '640 × 480 mm', w: 640, h: 480 },
  { v: '600x337.5', l: '600 × 337,5 mm (16:9)', w: 600, h: 337.5 },
  { v: '960x960', l: '960 × 960 mm (outdoor)', w: 960, h: 960 },
  { v: '1000x1000', l: '1000 × 1000 mm (outdoor)', w: 1000, h: 1000 },
  { v: 'custom', l: 'Custom...', w: 0, h: 0 },
];
type Lingkungan = 'indoor' | 'semi-outdoor' | 'outdoor';
/** Nilai umum per m² (W maks, kg) - selalu bisa ditimpa. */
const PER_M2: Record<Lingkungan, { daya: number; berat: number }> = {
  indoor: { daya: 600, berat: 30 }, 'semi-outdoor': { daya: 750, berat: 38 }, outdoor: { daya: 900, berat: 45 },
};
const LINGKUNGAN_TIPE = { Indoor: 'indoor', 'Indoor/Outdoor': 'semi-outdoor', Outdoor: 'outdoor' } as const;
const BULAT: { v: Pembulatan; l: string }[] = [{ v: 'floor', l: 'Ke bawah' }, { v: 'round', l: 'Terdekat' }, { v: 'ceil', l: 'Ke atas' }];

function Teks({ label, nilai, onUbah, tipe = 'text' }: { label: string; nilai: string; onUbah: (v: string) => void; tipe?: string }) {
  return (
    <label className="block min-w-0">
      <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">{label}</span>
      <input type={tipe} value={nilai} onChange={e => onUbah(e.target.value)} className={kelasInput} />
    </label>
  );
}

function TombolRef({ onKlik, diubah }: { onKlik: () => void; diubah: boolean }) {
  return (
    <button type="button" onClick={onKlik} title="Referensi modul & hardware"
      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold border border-slate-200 text-slate-700 hover:bg-slate-50 print:hidden">
      <Ikon nama="⚙" ukuran={14} /> Referensi{diubah && <span className="w-1.5 h-1.5 rounded-full bg-amber-500" aria-label="diubah" />}
    </button>
  );
}

/** Bilah pemakaian kapasitas (pixel / port). */
function Pakai({ label, persen }: { label: string; persen: number }) {
  const p = Math.min(100, Math.max(0, persen));
  const warna = persen > 100 ? 'bg-rose-600' : persen > 85 ? 'bg-amber-500' : 'bg-emerald-600';
  return (
    <div>
      <div className="flex justify-between text-[11.5px] text-slate-600"><span>{label}</span><span className="tabular-nums font-semibold text-slate-800">{f(persen, 0)}%</span></div>
      <div className="h-1.5 rounded-full bg-slate-200 mt-0.5 overflow-hidden"><div className={`h-full rounded-full ${warna}`} style={{ width: `${p}%` }} /></div>
    </div>
  );
}

function KartuHw({ peran, hw, totalPx, portLAN, nada, catatan }: { peran: string; hw: Hardware; totalPx: number; portLAN: number; nada: 'hijau' | 'abu'; catatan?: string }) {
  const k = kapasitasHardware(hw, totalPx, portLAN);
  return (
    <div className={`rounded-xl border p-3 ${nada === 'hijau' ? 'border-emerald-200 bg-emerald-50/60' : 'border-slate-200 bg-slate-50'}`}>
      <p className={`text-[11px] font-bold uppercase tracking-wider ${nada === 'hijau' ? 'text-emerald-800' : 'text-slate-600'}`}>{peran}</p>
      <p className="text-lg font-extrabold text-slate-900 mt-0.5">{k.qty > 1 ? `${k.qty}× ` : ''}{hw.nama}</p>
      <p className="text-[12px] text-slate-600">{f(hw.maksPx / 1e6, 2)} MP · {hw.port > 0 ? `${hw.port} port` : 'tanpa port LAN'}{hw.ket ? ` · ${hw.ket}` : ''}</p>
      <div className="mt-2 space-y-1.5">
        <Pakai label="Pemakaian pixel" persen={k.pakaiPx} />
        {hw.port > 0 && <Pakai label="Pemakaian port" persen={k.pakaiPort} />}
      </div>
      {k.pembatas && <p className="text-[12px] text-amber-800 mt-1.5">Butuh {k.qty} unit karena {k.pembatas === 'port' ? 'jumlah port LAN' : 'kapasitas pixel'}.</p>}
      {catatan && <p className={`text-[12px] mt-1.5 ${nada === 'hijau' ? 'text-emerald-800' : 'text-slate-600'}`}>{catatan}</p>}
    </div>
  );
}

export function KalkulatorLED() {
  const refLED = useReferensiLED();
  const { modul: daftarModul, kartu: daftarKartu, vp: daftarVP } = refLED.data;
  const [modeHw, setModeHw] = useState<'otomatis' | 'manual'>('otomatis');
  const [bukaRef, setBukaRef] = useState(false);
  const [vpPilih, setVpPilih] = useState('');
  const [kartuPilih, setKartuPilih] = useState('');
  const [project, setProject] = useState('');
  const [customer, setCustomer] = useState('');
  const [tanggal, setTanggal] = useState(() => new Date().toISOString().slice(0, 10));
  const [pembuat, setPembuat] = useState(() => getSession<{ full_name?: string }>()?.full_name ?? '');

  const [mode, setMode] = useState<'ukuran' | 'jumlah'>('ukuran');
  const [satuan, setSatuan] = useState<'modul' | 'cabinet'>('modul');
  const [modulKode, setModulKode] = useState('P2.5');
  const [lingkungan, setLingkungan] = useState<Lingkungan>('indoor');
  const [pitch, setPitch] = useState(2.5);
  const [cabKey, setCabKey] = useState('500x500');
  const [cabW, setCabW] = useState(500);
  const [cabH, setCabH] = useState(500);
  const [pxIn, setPxIn] = useState<{ x: number; y: number } | null>(null);
  const [targetW, setTargetW] = useState(4);
  const [targetH, setTargetH] = useState(2.25);
  const [bulat, setBulat] = useState<Pembulatan>('round');
  const [screen, setScreen] = useState(1);
  const [kolomIn, setKolomIn] = useState(8);
  const [barisIn, setBarisIn] = useState(5);
  const [dayaUnit, setDayaUnit] = useState<number | null>(null);
  const [beratUnit, setBeratUnit] = useState<number | null>(null);
  const [faktorRata, setFaktorRata] = useState(33);
  const [refresh, setRefresh] = useState<60 | 120 | 144 | 240>(60);
  const [bit, setBit] = useState<8 | 10 | 12>(8);
  const [tegangan, setTegangan] = useState(220);

  //  Satuan aktif: modul dari tabel referensi, atau cabinet bebas.
  const modul = daftarModul.find(m => m.kode === modulKode) ?? daftarModul[0];
  const u = satuan === 'modul'
    ? { pitch: modul.pitch, w: modul.w, h: modul.h, pxX: modul.pxW, pxY: modul.pxH, kode: modul.kode }
    : { pitch, w: cabW, h: cabH, pxX: Math.round(cabW / pitch), pxY: Math.round(cabH / pitch), kode: `P${pitch}` };
  const px = pxIn ?? { x: u.pxX, y: u.pxY };
  const namaUnit = satuan === 'modul' ? 'modul' : 'cabinet';

  const luasUnit = (u.w * u.h) / 1e6;
  const dayaUnitEf = dayaUnit ?? Math.round(PER_M2[lingkungan].daya * luasUnit * 10) / 10;
  const beratUnitEf = beratUnit ?? Math.round(PER_M2[lingkungan].berat * luasUnit * 100) / 100;
  const opsiBulat = BULAT.map(b => ({ ...b, ...cabinetUntukUkuran(targetW, targetH, u.w, u.h, b.v) }));
  const { kolom, baris } = mode === 'ukuran' ? opsiBulat.find(o => o.v === bulat)! : { kolom: kolomIn, baris: barisIn };

  const h = useMemo(() => hitungLED({
    pitch: u.pitch, cabLebar: u.w, cabTinggi: u.h, kolom, baris, pxX: px.x, pxY: px.y, dayaMaksCab: dayaUnitEf,
    faktorRata: faktorRata / 100, beratCab: beratUnitEf, refresh, bit, tegangan,
  }), [u.pitch, u.w, u.h, kolom, baris, px.x, px.y, dayaUnitEf, faktorRata, beratUnitEf, refresh, bit, tegangan]);
  const hw = saranHardware(h.totalPx, h.portLAN, daftarKartu, daftarVP);
  const vpSaja = daftarVP.filter(v => !(v.senderBawaan && v.port > 0));
  //  Mode manual: VP pilihan; sending card hanya dibutuhkan bila VP tidak all-in-one.
  const vpM = daftarVP.find(v => v.nama === vpPilih) ?? null;
  const vpAio = !!vpM && vpM.senderBawaan && vpM.port > 0;
  const kartuM = vpAio ? null : (daftarKartu.find(k => k.nama === kartuPilih) ?? hw.kartu?.hw ?? null);
  const teksHw = modeHw === 'manual'
    ? [vpM && `${kapasitasHardware(vpM, h.totalPx, h.portLAN).qty}× ${vpM.nama}`, kartuM && `${kapasitasHardware(kartuM, h.totalPx, h.portLAN).qty}× ${kartuM.nama}`].filter(Boolean).join(' + ')
    : '';
  const lewat4K = h.resX > 3840 || h.resY > 2160;
  const n = Math.max(1, screen);
  const selisihW = mode === 'ukuran' ? h.lebarM - targetW : 0;
  const selisihH = mode === 'ukuran' ? h.tinggiM - targetH : 0;

  const resetUnit = () => { setPxIn(null); setDayaUnit(null); setBeratUnit(null); };
  const pilihModul = (k: string) => {
    setModulKode(k); resetUnit();
    const m = daftarModul.find(x => x.kode === k);
    if (m) setLingkungan(LINGKUNGAN_TIPE[m.tipe]);
  };
  const pilihCab = (v: string) => {
    setCabKey(v); resetUnit();
    const c = CABINET.find(x => x.v === v);
    if (c && c.w) { setCabW(c.w); setCabH(c.h); }
  };

  const ringkasan = () => [
    project && `*${project}*${customer ? ` - ${customer}` : ''}`,
    `*LED Videotron ${u.kode} ${lingkungan}*${n > 1 ? ` · ${n} screen identik` : ''}`,
    `${namaUnit[0].toUpperCase()}${namaUnit.slice(1)} ${u.w}×${u.h} mm (${px.x}×${px.y} px): ${kolom} × ${baris} = ${h.jumlahCab} ${namaUnit}/screen${n > 1 ? `, total ${h.jumlahCab * n}` : ''}`,
    `Ukuran: ${f(h.lebarM)} × ${f(h.tinggiM)} m (${f(h.luasM2)} m², diagonal ${f(h.diagonalInci, 0)}")${n > 1 ? `, total ${f(h.luasM2 * n)} m²` : ''}`,
    `Resolusi: ${h.resX} × ${h.resY} px (${f(h.totalPx / 1e6, 2)} MP), rasio ${h.rasioTerdekat}`,
    `Jarak pandang: min ${f(h.jarakMinM, 1)} m, ideal ±${f(h.jarakIdealM, 1)} m`,
    `Daya/screen: maks ${f(h.dayaMaksW / 1000)} kW, rata-rata ${f(h.dayaRataW / 1000)} kW; arus maks ${f(h.arusMaksA, 1)} A @${tegangan}V, MCB ${h.mcbSaranA} A`,
    `Panas ±${f(h.panasBTU, 0)} BTU/jam; berat ±${f(h.beratKg, 0)} kg/screen`,
    `Data: ${h.portLAN} port LAN (${refresh} Hz, ${bit}-bit)`,
    modeHw === 'manual' ? `Hardware: ${teksHw || '-'} /screen` : hw.vp && `All-in-one: ${hw.vp.qty}× ${hw.vp.hw.nama}/screen`,
    modeHw === 'otomatis' && hw.kartu && `Atau sending card: ${hw.kartu.qty}× ${hw.kartu.hw.nama}/screen + video processor`,
    (pembuat || tanggal) && `Dibuat: ${[pembuat, tanggal].filter(Boolean).join(', ')}`,
  ].filter(Boolean).join('\n');

  // Pratinjau grid (SVG), skala mengikuti rasio sebenarnya.
  const skala = Math.min(320 / h.lebarM, 220 / h.tinggiM);
  const wPx = h.lebarM * skala, hPx = h.tinggiM * skala;
  const garisTipis = (k: number) => (k > 60 ? 0 : k > 30 ? 0.3 : 0.8);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] items-start">
      <div className="space-y-4 min-w-0">
        <Kartu judul="Informasi project">
          <div className="grid grid-cols-2 gap-3">
            <Teks label="Nama project" nilai={project} onUbah={setProject} />
            <Teks label="Customer" nilai={customer} onUbah={setCustomer} />
            <Teks label="Tanggal" nilai={tanggal} onUbah={setTanggal} tipe="date" />
            <Teks label="Dibuat oleh" nilai={pembuat} onUbah={setPembuat} />
          </div>
        </Kartu>

        <Kartu judul="Spesifikasi" aksi={<TombolRef onKlik={() => setBukaRef(true)} diubah={refLED.diubah} />}>
          <div className="space-y-3">
            <Segmen label="Satuan" nilai={satuan} onUbah={v => { setSatuan(v); resetUnit(); }}
              opsi={[{ v: 'modul', l: 'Modul (referensi)' }, { v: 'cabinet', l: 'Cabinet' }]} />
            {satuan === 'modul' ? (
              <>
                <Pilih label="Pitch LED" nilai={modulKode} onUbah={pilihModul}
                  opsi={daftarModul.map(m => ({ v: m.kode, l: `${m.kode} · ${m.w}×${m.h} mm · ${m.pxW}×${m.pxH} px · ${m.tipe}` }))} />
                <p className="text-[12px] text-slate-600 -mt-1">{modul.guna}</p>
              </>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <Pilih label="Pixel pitch" nilai={PITCH.includes(pitch) ? pitch : -1} onUbah={v => { if (v > 0) { setPitch(v); setPxIn(null); } }}
                    opsi={[...PITCH.map(p => ({ v: p, l: `P${p}` })), { v: -1, l: 'Custom...' }]} />
                  <Angka label="Pitch (mm)" nilai={pitch} onUbah={v => { if (v > 0) { setPitch(v); setPxIn(null); } }} satuan="mm" />
                </div>
                <Pilih label="Ukuran cabinet" nilai={cabKey} onUbah={pilihCab} opsi={CABINET.map(c => ({ v: c.v, l: c.l }))} />
                {cabKey === 'custom' && (
                  <div className="grid grid-cols-2 gap-3">
                    <Angka label="Lebar cabinet" nilai={cabW} onUbah={v => { if (v > 0) { setCabW(v); setPxIn(null); } }} satuan="mm" />
                    <Angka label="Tinggi cabinet" nilai={cabH} onUbah={v => { if (v > 0) { setCabH(v); setPxIn(null); } }} satuan="mm" />
                  </div>
                )}
              </>
            )}
            <div className="grid grid-cols-2 gap-3">
              <Angka label={`Pixel/${namaUnit} (W)`} nilai={px.x} step={1} satuan="px"
                onUbah={v => v >= 1 && setPxIn({ x: Math.round(v), y: px.y })} />
              <Angka label={`Pixel/${namaUnit} (H)`} nilai={px.y} step={1} satuan="px"
                onUbah={v => v >= 1 && setPxIn({ x: px.x, y: Math.round(v) })} />
            </div>
            <Segmen label="Lingkungan" nilai={lingkungan} onUbah={v => { setLingkungan(v); setDayaUnit(null); setBeratUnit(null); }}
              opsi={[{ v: 'indoor', l: 'Indoor' }, { v: 'semi-outdoor', l: 'Semi' }, { v: 'outdoor', l: 'Outdoor' }]} />

            <Segmen label="Hitung dari" nilai={mode} onUbah={setMode}
              opsi={[{ v: 'ukuran', l: 'Ukuran target' }, { v: 'jumlah', l: `Jumlah ${namaUnit}` }]} />
            {mode === 'ukuran' ? (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <Angka label="Lebar target" nilai={targetW} onUbah={v => v > 0 && setTargetW(v)} satuan="m" />
                  <Angka label="Tinggi target" nilai={targetH} onUbah={v => v > 0 && setTargetH(v)} satuan="m" />
                </div>
                <div>
                  <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">Pembulatan</span>
                  <div className="grid grid-cols-3 gap-1.5">
                    {opsiBulat.map(o => {
                      const on = o.v === bulat;
                      return (
                        <button key={o.v} type="button" onClick={() => setBulat(o.v)} aria-pressed={on}
                          className={`rounded-xl border px-2 py-1.5 text-left ${on ? 'border-blue-600 bg-blue-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}>
                          <span className={`block text-[12px] font-bold ${on ? 'text-blue-800' : 'text-slate-700'}`}>{o.l}</span>
                          <span className="block text-[11px] text-slate-600 tabular-nums">{o.kolom}×{o.baris} · {f((o.kolom * u.w) / 1000)}×{f((o.baris * u.h) / 1000)} m</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <Angka label="Kolom" nilai={kolomIn} onUbah={v => v >= 1 && setKolomIn(Math.round(v))} step={1} />
                <Angka label="Baris" nilai={barisIn} onUbah={v => v >= 1 && setBarisIn(Math.round(v))} step={1} />
              </div>
            )}
            <Angka label="Jumlah screen identik" nilai={screen} onUbah={v => v >= 1 && setScreen(Math.round(v))} step={1} satuan="screen" />

            <details className="rounded-xl border border-slate-200 p-3">
              <summary className="text-[12.5px] font-semibold text-slate-700 cursor-pointer">Daya, berat & sinyal (opsional)</summary>
              <div className="grid grid-cols-2 gap-3 mt-3">
                <Angka label={`Daya maks/${namaUnit}`} nilai={dayaUnitEf} onUbah={setDayaUnit} satuan="W" />
                <Angka label={`Berat/${namaUnit}`} nilai={beratUnitEf} onUbah={setBeratUnit} satuan="kg" />
                <Angka label="Rata-rata pemakaian" nilai={faktorRata} onUbah={v => setFaktorRata(Math.min(100, Math.max(5, v)))} satuan="%" />
                <Angka label="Tegangan" nilai={tegangan} onUbah={v => v > 0 && setTegangan(v)} satuan="V" />
                <Pilih label="Refresh" nilai={refresh} onUbah={setRefresh} opsi={[60, 120, 144, 240].map(v => ({ v: v as 60, l: `${v} Hz` }))} />
                <Pilih label="Bit depth" nilai={bit} onUbah={setBit} opsi={[8, 10, 12].map(v => ({ v: v as 8, l: `${v}-bit` }))} />
              </div>
              {(dayaUnit !== null || beratUnit !== null || pxIn !== null) && (
                <button type="button" onClick={resetUnit}
                  className="mt-2 text-[12px] font-semibold text-blue-700 hover:underline">Kembalikan ke nilai umum</button>
              )}
            </details>
          </div>
        </Kartu>
      </div>

      <div className="space-y-4 min-w-0">
        <Kartu judul={n > 1 ? 'Hasil per screen' : 'Hasil'} aksi={<TombolSalin teks={ringkasan} />}>
          {(project || customer) && (
            <p className="text-[12.5px] text-slate-600 mb-3">
              <span className="font-semibold text-slate-800">{project || '-'}</span>{customer && ` · ${customer}`}
              {(pembuat || tanggal) && <span className="block text-[11.5px] text-slate-500">{[pembuat, tanggal].filter(Boolean).join(' · ')}</span>}
            </p>
          )}
          <div className="flex flex-col sm:flex-row gap-4 items-center mb-4">
            <svg viewBox={`0 0 ${wPx + 20} ${hPx + 36}`} className="w-full max-w-[340px]" role="img"
              aria-label={`Susunan ${kolom} × ${baris} ${namaUnit}`}>
              <g transform="translate(10,10)">
                <rect width={wPx} height={hPx} fill="#0f172a" rx="2" />
                {garisTipis(kolom) > 0 && Array.from({ length: kolom + 1 }, (_, i) => (
                  <line key={`v${i}`} x1={(i * wPx) / kolom} x2={(i * wPx) / kolom} y1={0} y2={hPx} stroke="#334155" strokeWidth={garisTipis(kolom)} />
                ))}
                {garisTipis(baris) > 0 && Array.from({ length: baris + 1 }, (_, i) => (
                  <line key={`h${i}`} y1={(i * hPx) / baris} y2={(i * hPx) / baris} x1={0} x2={wPx} stroke="#334155" strokeWidth={garisTipis(baris)} />
                ))}
                <text x={wPx / 2} y={hPx + 18} textAnchor="middle" fontSize="11" fill="#475569">{f(h.lebarM)} m · {h.resX} px</text>
              </g>
            </svg>
            <div className="text-center sm:text-left">
              <p className="text-3xl font-extrabold text-slate-900 tabular-nums">{kolom} × {baris}</p>
              <p className="text-sm text-slate-600">{h.jumlahCab} {namaUnit} · {f(h.lebarM)} × {f(h.tinggiM)} m</p>
              {mode === 'ukuran' && (Math.abs(selisihW) > 0.001 || Math.abs(selisihH) > 0.001) && (
                <p className="text-[12px] text-amber-700 mt-1">
                  Selisih dari target: {selisihW >= 0 ? '+' : ''}{f(selisihW * 100, 1)} cm lebar, {selisihH >= 0 ? '+' : ''}{f(selisihH * 100, 1)} cm tinggi
                </p>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            <Nilai label="Resolusi" nilai={`${h.resX} × ${h.resY}`} ket={`${f(h.totalPx / 1e6, 2)} MP · per ${namaUnit} ${h.pxCabX}×${h.pxCabY}`} nada={lewat4K ? 'awas' : undefined} />
            <Nilai label="Rasio" nilai={h.rasioTerdekat} ket={`tepat ${h.rasio}`} />
            <Nilai label="Luas / diagonal" nilai={f(h.luasM2)} satuan="m²" ket={`${f(h.diagonalInci, 0)} inci`} />
            <Nilai label="Jarak pandang min" nilai={f(h.jarakMinM, 1)} satuan="m" ket={`ideal ±${f(h.jarakIdealM, 1)} m (estimasi)`} />
            <Nilai label="Daya maks" nilai={f(h.dayaMaksW / 1000)} satuan="kW" ket={`rata-rata ${f(h.dayaRataW / 1000)} kW`} />
            <Nilai label={`Arus maks @${tegangan}V`} nilai={f(h.arusMaksA, 1)} satuan="A"
              ket={`MCB ${h.mcbSaranA} A${h.arusMaksA > 32 ? ' · pertimbangkan 3 fase' : ''}`} nada={h.arusMaksA > 63 ? 'awas' : undefined} />
            <Nilai label="Panas (rata-rata)" nilai={f(h.panasBTU, 0)} satuan="BTU/h" ket={`±${f(h.panasBTU / 9000, 1)} PK AC`} />
            <Nilai label="Berat" nilai={f(h.beratKg, 0)} satuan="kg" ket="belum termasuk rangka" />
            <Nilai label="Port LAN" nilai={h.portLAN} ket={`±${f(h.pxPerPort / 1000, 0)} rb px/port`} />
          </div>
          {lewat4K && (
            <p className="mt-3 text-[12.5px] text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
              Resolusi melebihi 3840 × 2160: satu sumber/input 4K tidak cukup untuk native pixel. Pakai beberapa input, processor dengan scaling, atau splicer.
            </p>
          )}
          {n > 1 && (
            <div className="mt-4 pt-3 border-t border-slate-100">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-2">Total {n} screen</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <Nilai label={`Total ${namaUnit}`} nilai={h.jumlahCab * n} />
                <Nilai label="Total luas" nilai={f(h.luasM2 * n)} satuan="m²" />
                <Nilai label="Total daya maks" nilai={f((h.dayaMaksW * n) / 1000)} satuan="kW" />
                <Nilai label="Total berat" nilai={f(h.beratKg * n, 0)} satuan="kg" />
              </div>
            </div>
          )}
        </Kartu>

        <Kartu judul="Hardware Novastar (per screen)" aksi={<TombolRef onKlik={() => setBukaRef(true)} diubah={refLED.diubah} />}>
          <div className="space-y-3">
            <Segmen label="Pemilihan" nilai={modeHw} onUbah={setModeHw}
              opsi={[{ v: 'otomatis', l: 'Otomatis (terkecil yang cukup)' }, { v: 'manual', l: 'Pilih model' }]} />
            {modeHw === 'manual' && (
              <div className="grid sm:grid-cols-2 gap-3">
                <Pilih label="Video processor" nilai={vpPilih} onUbah={setVpPilih}
                  opsi={[{ v: '', l: 'Tanpa VP (sumber langsung)' }, ...daftarVP.map(v => ({ v: v.nama, l: `${v.nama} · ${f(v.maksPx / 1e6, 1)} MP${v.senderBawaan && v.port > 0 ? ` · ${v.port} port` : ' · perlu sending card'}` }))]} />
                {!vpAio && (
                  <Pilih label="Sending card" nilai={kartuM?.nama ?? ''} onUbah={setKartuPilih}
                    opsi={daftarKartu.map(k => ({ v: k.nama, l: `${k.nama} · ${f(k.maksPx / 1e6, 1)} MP · ${k.port} port` }))} />
                )}
              </div>
            )}
            {modeHw === 'otomatis' ? (
              <div className="grid sm:grid-cols-2 gap-2.5">
                {hw.vp && <KartuHw peran="Opsi A · All-in-one" hw={hw.vp.hw} totalPx={h.totalPx} portLAN={h.portLAN} nada="hijau" catatan="Sending sudah terpasang, tidak perlu sending card." />}
                {hw.kartu && <KartuHw peran="Opsi B · Sending card" hw={hw.kartu.hw} totalPx={h.totalPx} portLAN={h.portLAN} nada="abu"
                  catatan={`Dengan video processor tanpa sender${vpSaja.length ? ` (${vpSaja.map(v => v.nama).join(', ')})` : ''} atau langsung dari sumber.`} />}
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 gap-2.5">
                {vpM && <KartuHw peran={vpAio ? 'Video processor · all-in-one' : 'Video processor'} hw={vpM} totalPx={h.totalPx} portLAN={h.portLAN} nada={vpAio ? 'hijau' : 'abu'}
                  catatan={vpAio ? 'Sending sudah terpasang, tidak perlu sending card.' : 'Tanpa output LAN: dipasangkan dengan sending card.'} />}
                {kartuM && <KartuHw peran="Sending card" hw={kartuM} totalPx={h.totalPx} portLAN={h.portLAN} nada="abu" />}
              </div>
            )}
            {hw.vp && hw.vp.qty > 1 && modeHw === 'otomatis' && (
              <p className="text-[12.5px] text-amber-800">Melebihi kapasitas satu unit: layar dibagi ke beberapa controller, perlu sinkronisasi/splicer.</p>
            )}
          </div>
          <Catatan>Kecerahan disarankan: {KECERAHAN[lingkungan]}. Kapasitas sesuai tabel referensi (60 Hz 8-bit ≈ 650 rb px/port); cek datasheet dan NovaLCT sebelum penawaran.</Catatan>
        </Kartu>


        <details className="rounded-2xl bg-white border border-slate-200 p-4 sm:p-5">
          <summary className="text-[13px] font-bold text-slate-800 cursor-pointer">Rumus & asumsi</summary>
          <ul className="mt-3 space-y-1.5 text-[12.5px] text-slate-700 list-disc pl-5">
            <li>Kolom = lebar target ÷ lebar {namaUnit}; baris = tinggi target ÷ tinggi {namaUnit}, dibulatkan sesuai pilihan (terdekat / ke bawah / ke atas).</li>
            <li>Resolusi = kolom × pixel/{namaUnit} (W), baris × pixel/{namaUnit} (H). Pixel/modul diambil dari tabel referensi; bisa diganti sesuai datasheet.</li>
            <li>Jarak pandang minimum (m) ≈ pitch (mm); nyaman ≈ 3 × pitch. Estimasi.</li>
            <li>Daya bawaan = {PER_M2[lingkungan].daya} W/m² maks ({lingkungan}); rata-rata = {faktorRata}% dari maks. Arus = W ÷ {tegangan} V; MCB ≥ 1,25 × arus maks.</li>
            <li>Panas = daya rata-rata × 3,412 BTU/jam; 1 PK AC ≈ 9.000 BTU/jam.</li>
            <li>Port LAN = total pixel ÷ (655.360 × 60/refresh × 8/bit).</li>
            <li>Hardware dipilih yang terkecil dengan kapasitas pixel & port cukup; bila tidak ada, jumlah unit dihitung dari yang terbesar.</li>
          </ul>
        </details>
      </div>
      <EditorReferensiLED {...refLED} buka={bukaRef} onTutup={() => setBukaRef(false)} />
    </div>
  );
}
