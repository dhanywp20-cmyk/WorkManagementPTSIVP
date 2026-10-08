'use client';
/** Kalkulator audio: SPL, jarak, daya amplifier. */
import { Angka, Catatan, f, Kartu, Nilai, Segmen, TombolSalin } from '../bersama/ui';
import { aksiLembar, lembarAV } from './lembar';
import { speakerPlafon, splMaks, splPadaJarak } from '@/lib/av-hitung';
import { useState } from 'react';

export function KalkulatorAudio() {
  const [mode, setMode] = useState<'plafon' | 'spl'>('plafon');
  const [p, setP] = useState(10); const [l, setL] = useState(8); const [t, setT] = useState(3);
  const [telinga, setTelinga] = useState(1.2); const [sudut, setSudut] = useState(90);
  const [rapat, setRapat] = useState<'rapat' | 'standar'>('rapat');
  const [sens, setSens] = useState(90); const [daya, setDaya] = useState(60); const [jarak, setJarak] = useState(10);
  const sp = speakerPlafon(p, l, t, telinga, sudut, rapat === 'rapat');
  const maks = splMaks(sens, daya);
  const diJarak = splPadaJarak(maks, jarak);
  const ringkas = () => mode === 'plafon'
    ? `Ruang ${p}×${l} m, plafon ${t} m, speaker ${sudut}°: diameter cakupan ${f(sp.diameterM)} m, jarak antar speaker ±${f(sp.jarakM)} m, butuh ${sp.jumlah} speaker (${sp.kolom}×${sp.baris}).`
    : `Speaker ${sens} dB/1W/1m @${daya} W: SPL maks ${f(maks, 1)} dB di 1 m, ±${f(diJarak, 1)} dB di ${jarak} m.`;
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] items-start">
      <Kartu judul="Masukan">
        <div className="space-y-3">
          <Segmen nilai={mode} onUbah={setMode} opsi={[{ v: 'plafon', l: 'Speaker plafon' }, { v: 'spl', l: 'SPL & jarak' }]} />
          {mode === 'plafon' ? (
            <div className="grid grid-cols-2 gap-3">
              <Angka label="Panjang ruang" nilai={p} onUbah={v => v > 0 && setP(v)} satuan="m" />
              <Angka label="Lebar ruang" nilai={l} onUbah={v => v > 0 && setL(v)} satuan="m" />
              <Angka label="Tinggi plafon" nilai={t} onUbah={v => v > 0 && setT(v)} satuan="m" />
              <Angka label="Tinggi telinga" nilai={telinga} onUbah={v => v > 0 && setTelinga(v)} satuan="m" bantuan="duduk 1,2 · berdiri 1,6" />
              <Angka label="Sudut sebaran" nilai={sudut} onUbah={v => v > 10 && v < 180 && setSudut(v)} satuan="°" />
              <Segmen label="Kerapatan" nilai={rapat} onUbah={setRapat} opsi={[{ v: 'rapat', l: 'Merata' }, { v: 'standar', l: 'Tepi-tepi' }]} />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <Angka label="Sensitivitas" nilai={sens} onUbah={setSens} satuan="dB" bantuan="1W / 1m" />
              <Angka label="Daya ke speaker" nilai={daya} onUbah={v => v > 0 && setDaya(v)} satuan="W" />
              <Angka label="Jarak pendengar" nilai={jarak} onUbah={v => v > 0 && setJarak(v)} satuan="m" />
            </div>
          )}
        </div>
      </Kartu>
      <Kartu judul="Hasil" aksi={<TombolSalin teks={ringkas} {...aksiLembar(() => (mode === 'plafon'
        ? lembarAV('Audio · Speaker Plafon',
          [['Ruang', `${f(p)} × ${f(l)} m`], ['Tinggi plafon / telinga', `${f(t)} m / ${f(telinga)} m`], ['Sudut sebaran', `${sudut}° · ${rapat === 'rapat' ? 'merata' : 'tepi-tepi'}`]],
          [['Diameter cakupan', `${f(sp.diameterM)} m`], ['Jarak antar speaker', `${f(sp.jarakM)} m`], ['Jumlah speaker', `${sp.jumlah} (${sp.kolom} × ${sp.baris})`, true]],
          'Hitungan geometris; sisakan headroom 6-10 dB dari daya amplifier.')
        : lembarAV('Audio · SPL & Jarak',
          [['Sensitivitas', `${sens} dB (1 W / 1 m)`], ['Daya ke speaker', `${daya} W`], ['Jarak pendengar', `${f(jarak)} m`]],
          [['SPL maks @1 m', `${f(maks, 1)} dB`], [`SPL @${f(jarak)} m`, `${f(diJarak, 1)} dB`, true]],
          'Medan bebas: turun 6 dB tiap jarak 2×. Pantulan ruang menambah SPL namun menurunkan kejelasan (STI).')), 'Audio')} />}>
        {mode === 'plafon' ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            <Nilai label="Diameter cakupan" nilai={f(sp.diameterM)} satuan="m" ket="di ketinggian telinga" />
            <Nilai label="Jarak antar speaker" nilai={f(sp.jarakM)} satuan="m" />
            <Nilai label="Jumlah speaker" nilai={sp.jumlah} ket={`${sp.kolom} × ${sp.baris} titik`} nada="baik" />
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            <Nilai label="SPL maks @1 m" nilai={f(maks, 1)} satuan="dB" />
            <Nilai label={`SPL @${jarak} m`} nilai={f(diJarak, 1)} satuan="dB"
              ket={diJarak >= 85 ? 'cukup untuk musik/event' : diJarak >= 70 ? 'cukup untuk percakapan/paging' : 'kurang - tambah speaker/daya'}
              nada={diJarak >= 70 ? 'baik' : 'buruk'} />
            <Nilai label="Turun per 2× jarak" nilai="-6" satuan="dB" ket="medan bebas, tanpa pantulan" />
          </div>
        )}
        <Catatan>Hitungan geometris/medan bebas; ruangan dengan pantulan kuat menambah SPL namun menurunkan kejelasan (STI). Sisakan headroom 6-10 dB dari daya amplifier.</Catatan>
      </Kartu>
    </div>
  );
}

/* ── Daya, UPS & panas ───────────────────────────────────────────────── */
