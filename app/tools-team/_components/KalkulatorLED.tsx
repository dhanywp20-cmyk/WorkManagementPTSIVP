'use client';
import { useMemo, useState } from 'react';
import { hitungLED, cabinetUntukUkuran, saranController, KECERAHAN } from '@/lib/av-hitung';
import { Angka, Pilih, Segmen, Kartu, Nilai, TombolSalin, Catatan, f } from './ui';

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

export function KalkulatorLED() {
  const [mode, setMode] = useState<'ukuran' | 'cabinet'>('ukuran');
  const [lingkungan, setLingkungan] = useState<Lingkungan>('indoor');
  const [pitch, setPitch] = useState(2.5);
  const [cabKey, setCabKey] = useState('500x500');
  const [cabW, setCabW] = useState(500);
  const [cabH, setCabH] = useState(500);
  const [targetW, setTargetW] = useState(4);
  const [targetH, setTargetH] = useState(2.25);
  const [kolomIn, setKolomIn] = useState(8);
  const [barisIn, setBarisIn] = useState(5);
  const [dayaCab, setDayaCab] = useState<number | null>(null);
  const [beratCab, setBeratCab] = useState<number | null>(null);
  const [faktorRata, setFaktorRata] = useState(33);
  const [refresh, setRefresh] = useState<60 | 120 | 144 | 240>(60);
  const [bit, setBit] = useState<8 | 10 | 12>(8);
  const [tegangan, setTegangan] = useState(220);

  const luasCab = (cabW * cabH) / 1e6;
  const dayaCabEf = dayaCab ?? Math.round(PER_M2[lingkungan].daya * luasCab);
  const beratCabEf = beratCab ?? Math.round(PER_M2[lingkungan].berat * luasCab * 10) / 10;
  const { kolom, baris } = mode === 'ukuran' ? cabinetUntukUkuran(targetW, targetH, cabW, cabH) : { kolom: kolomIn, baris: barisIn };

  const h = useMemo(() => hitungLED({
    pitch, cabLebar: cabW, cabTinggi: cabH, kolom, baris, dayaMaksCab: dayaCabEf,
    faktorRata: faktorRata / 100, beratCab: beratCabEf, refresh, bit, tegangan,
  }), [pitch, cabW, cabH, kolom, baris, dayaCabEf, faktorRata, beratCabEf, refresh, bit, tegangan]);
  const ctrl = saranController(h.resX, h.resY, h.portLAN);
  const selisihW = mode === 'ukuran' ? h.lebarM - targetW : 0;
  const selisihH = mode === 'ukuran' ? h.tinggiM - targetH : 0;

  const pilihCab = (v: string) => {
    setCabKey(v);
    const c = CABINET.find(x => x.v === v);
    if (c && c.w) { setCabW(c.w); setCabH(c.h); }
    setDayaCab(null); setBeratCab(null);
  };

  const ringkasan = () => [
    `*LED Videotron P${pitch} ${lingkungan}*`,
    `Cabinet ${cabW}×${cabH} mm: ${kolom} kolom × ${baris} baris = ${h.jumlahCab} cabinet`,
    `Ukuran: ${f(h.lebarM)} × ${f(h.tinggiM)} m (${f(h.luasM2)} m², diagonal ${f(h.diagonalInci, 0)}")`,
    `Resolusi: ${h.resX} × ${h.resY} px (${f(h.totalPx / 1e6, 2)} MP), rasio ${h.rasioTerdekat}`,
    `Jarak pandang: min ${f(h.jarakMinM, 1)} m, ideal ±${f(h.jarakIdealM, 1)} m`,
    `Daya: maks ${f(h.dayaMaksW / 1000)} kW, rata-rata ${f(h.dayaRataW / 1000)} kW; arus maks ${f(h.arusMaksA, 1)} A @${tegangan}V, MCB ${h.mcbSaranA} A`,
    `Panas: ±${f(h.panasBTU, 0)} BTU/jam; berat ±${f(h.beratKg, 0)} kg`,
    `Data: ${h.portLAN} port LAN (${refresh} Hz, ${bit}-bit)${ctrl[0] ? `, controller: ${ctrl[0].nama}` : ''}`,
  ].join('\n');

  // Pratinjau grid cabinet (SVG), skala mengikuti rasio sebenarnya.
  const skala = Math.min(320 / h.lebarM, 220 / h.tinggiM);
  const wPx = h.lebarM * skala, hPx = h.tinggiM * skala;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] items-start">
      <Kartu judul="Spesifikasi">
        <div className="space-y-3">
          <Segmen label="Hitung dari" nilai={mode} onUbah={setMode}
            opsi={[{ v: 'ukuran', l: 'Ukuran target' }, { v: 'cabinet', l: 'Jumlah cabinet' }]} />
          <Segmen label="Lingkungan" nilai={lingkungan} onUbah={v => { setLingkungan(v); setDayaCab(null); setBeratCab(null); }}
            opsi={[{ v: 'indoor', l: 'Indoor' }, { v: 'semi-outdoor', l: 'Semi' }, { v: 'outdoor', l: 'Outdoor' }]} />
          <div className="grid grid-cols-2 gap-3">
            <Pilih label="Pixel pitch" nilai={PITCH.includes(pitch) ? pitch : -1} onUbah={v => { if (v > 0) setPitch(v); }}
              opsi={[...PITCH.map(p => ({ v: p, l: `P${p}` })), { v: -1, l: 'Custom...' }]} />
            <Angka label="Pitch (mm)" nilai={pitch} onUbah={v => v > 0 && setPitch(v)} satuan="mm" />
          </div>
          <Pilih label="Ukuran cabinet" nilai={cabKey} onUbah={pilihCab} opsi={CABINET.map(c => ({ v: c.v, l: c.l }))} />
          {cabKey === 'custom' && (
            <div className="grid grid-cols-2 gap-3">
              <Angka label="Lebar cabinet" nilai={cabW} onUbah={v => v > 0 && setCabW(v)} satuan="mm" />
              <Angka label="Tinggi cabinet" nilai={cabH} onUbah={v => v > 0 && setCabH(v)} satuan="mm" />
            </div>
          )}
          {mode === 'ukuran' ? (
            <div className="grid grid-cols-2 gap-3">
              <Angka label="Lebar target" nilai={targetW} onUbah={v => v > 0 && setTargetW(v)} satuan="m" />
              <Angka label="Tinggi target" nilai={targetH} onUbah={v => v > 0 && setTargetH(v)} satuan="m" />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <Angka label="Kolom" nilai={kolomIn} onUbah={v => v >= 1 && setKolomIn(Math.round(v))} step={1} />
              <Angka label="Baris" nilai={barisIn} onUbah={v => v >= 1 && setBarisIn(Math.round(v))} step={1} />
            </div>
          )}
          <details className="rounded-xl border border-slate-200 p-3">
            <summary className="text-[12.5px] font-semibold text-slate-700 cursor-pointer">Daya, berat & sinyal (opsional)</summary>
            <div className="grid grid-cols-2 gap-3 mt-3">
              <Angka label="Daya maks/cabinet" nilai={dayaCabEf} onUbah={setDayaCab} satuan="W" />
              <Angka label="Berat/cabinet" nilai={beratCabEf} onUbah={setBeratCab} satuan="kg" />
              <Angka label="Rata-rata pemakaian" nilai={faktorRata} onUbah={v => setFaktorRata(Math.min(100, Math.max(5, v)))} satuan="%" />
              <Angka label="Tegangan" nilai={tegangan} onUbah={v => v > 0 && setTegangan(v)} satuan="V" />
              <Pilih label="Refresh" nilai={refresh} onUbah={setRefresh} opsi={[60, 120, 144, 240].map(v => ({ v: v as 60, l: `${v} Hz` }))} />
              <Pilih label="Bit depth" nilai={bit} onUbah={setBit} opsi={[8, 10, 12].map(v => ({ v: v as 8, l: `${v}-bit` }))} />
            </div>
            {(dayaCab !== null || beratCab !== null) && (
              <button type="button" onClick={() => { setDayaCab(null); setBeratCab(null); }}
                className="mt-2 text-[12px] font-semibold text-blue-700 hover:underline">Kembalikan ke nilai umum</button>
            )}
          </details>
        </div>
      </Kartu>

      <div className="space-y-4 min-w-0">
        <Kartu judul="Hasil" aksi={<TombolSalin teks={ringkasan} />}>
          <div className="flex flex-col sm:flex-row gap-4 items-center mb-4">
            <svg viewBox={`0 0 ${wPx + 20} ${hPx + 36}`} className="w-full max-w-[340px]" role="img"
              aria-label={`Susunan ${kolom} × ${baris} cabinet`}>
              <g transform={`translate(10,10)`}>
                <rect width={wPx} height={hPx} fill="#0f172a" rx="2" />
                {Array.from({ length: kolom + 1 }, (_, i) => (
                  <line key={`v${i}`} x1={(i * wPx) / kolom} x2={(i * wPx) / kolom} y1={0} y2={hPx} stroke="#334155" strokeWidth={kolom > 40 ? 0.3 : 0.8} />
                ))}
                {Array.from({ length: baris + 1 }, (_, i) => (
                  <line key={`h${i}`} y1={(i * hPx) / baris} y2={(i * hPx) / baris} x1={0} x2={wPx} stroke="#334155" strokeWidth={baris > 40 ? 0.3 : 0.8} />
                ))}
                <text x={wPx / 2} y={hPx + 18} textAnchor="middle" fontSize="11" fill="#475569">{f(h.lebarM)} m · {h.resX} px</text>
              </g>
            </svg>
            <div className="text-center sm:text-left">
              <p className="text-3xl font-extrabold text-slate-900 tabular-nums">{kolom} × {baris}</p>
              <p className="text-sm text-slate-600">{h.jumlahCab} cabinet · {f(h.lebarM)} × {f(h.tinggiM)} m</p>
              {mode === 'ukuran' && (Math.abs(selisihW) > 0.001 || Math.abs(selisihH) > 0.001) && (
                <p className="text-[12px] text-amber-700 mt-1">
                  Selisih dari target: {selisihW >= 0 ? '+' : ''}{f(selisihW * 100, 1)} cm lebar, {selisihH >= 0 ? '+' : ''}{f(selisihH * 100, 1)} cm tinggi
                </p>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            <Nilai label="Resolusi" nilai={`${h.resX} × ${h.resY}`} ket={`${f(h.totalPx / 1e6, 2)} MP · per cabinet ${h.pxCabX}×${h.pxCabY}`} />
            <Nilai label="Rasio" nilai={h.rasioTerdekat} ket={`tepat ${h.rasio}`} />
            <Nilai label="Luas / diagonal" nilai={f(h.luasM2)} satuan="m²" ket={`${f(h.diagonalInci, 0)} inci`} />
            <Nilai label="Jarak pandang min" nilai={f(h.jarakMinM, 1)} satuan="m" ket={`ideal ±${f(h.jarakIdealM, 1)} m`} />
            <Nilai label="Daya maks" nilai={f(h.dayaMaksW / 1000)} satuan="kW" ket={`rata-rata ${f(h.dayaRataW / 1000)} kW`} />
            <Nilai label={`Arus maks @${tegangan}V`} nilai={f(h.arusMaksA, 1)} satuan="A"
              ket={`MCB ${h.mcbSaranA} A${h.arusMaksA > 32 ? ' · pertimbangkan 3 fase' : ''}`} nada={h.arusMaksA > 63 ? 'awas' : undefined} />
            <Nilai label="Panas (rata-rata)" nilai={f(h.panasBTU, 0)} satuan="BTU/h" ket={`±${f(h.panasBTU / 9000, 1)} PK AC`} />
            <Nilai label="Berat total" nilai={f(h.beratKg, 0)} satuan="kg" ket="belum termasuk rangka" />
            <Nilai label="Port LAN" nilai={h.portLAN} ket={`±${f(h.pxPerPort / 1000, 0)} rb px/port`} />
          </div>
        </Kartu>

        <Kartu judul="Controller (acuan Novastar)">
          {ctrl.length ? (
            <ul className="space-y-1.5">
              {ctrl.slice(0, 3).map((c, i) => (
                <li key={c.nama} className="flex items-center justify-between gap-2 text-sm">
                  <span className="font-semibold text-slate-800">{c.nama}{i === 0 && <span className="ml-2 text-[11px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700">paling pas</span>}</span>
                  <span className="text-[12px] text-slate-600 tabular-nums">{f(c.maksPx / 1e6, 1)} MP · {c.port} port</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-amber-700">Melebihi satu controller - bagi ke beberapa controller atau pakai video processor/splicer.</p>
          )}
          <Catatan>Kecerahan disarankan: {KECERAHAN[lingkungan]}. Kapasitas port & controller adalah perkiraan (60 Hz 8-bit ≈ 650 rb px/port); cek datasheet dan software konfigurasi sebelum penawaran.</Catatan>
        </Kartu>
      </div>
    </div>
  );
}
