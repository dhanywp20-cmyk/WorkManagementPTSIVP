'use client';
/** Audio · speaker plafon & SPL (jarak, daya amplifier untuk SPL target). Bagian dari KalkulatorAudio. */
import { Angka, Catatan, f, Kartu, Nilai, Segmen, TombolSalin } from '../../bersama/ui';
import { aksiLembar, lembarAV } from '../lembar';
import { speakerPlafon, splMaks, splPadaJarak } from '@/lib/av-hitung';
import { dayaUntukSPL } from '@/lib/av-audio-jaringan';
import { angkaDari } from '@/lib/pustaka';
import { PilihPustaka } from '../../pustaka/PilihPustaka';
import { useState } from 'react';

export function AudioSpeaker() {
  const [mode, setMode] = useState<'plafon' | 'spl'>('plafon');
  const [p, setP] = useState(10); const [l, setL] = useState(8); const [t, setT] = useState(3);
  const [telinga, setTelinga] = useState(1.2); const [sudut, setSudut] = useState(90);
  const [rapat, setRapat] = useState<'rapat' | 'standar'>('rapat');
  const [sens, setSens] = useState(90); const [daya, setDaya] = useState(60); const [jarak, setJarak] = useState(10);
  const sp = speakerPlafon(p, l, t, telinga, sudut, rapat === 'rapat');
  const maks = splMaks(sens, daya);
  const diJarak = splPadaJarak(maks, jarak);
  //  Kebalikannya: daya yang dibutuhkan untuk SPL target di pendengar (+ headroom puncak).
  const [target, setTarget] = useState(75); const [headroom, setHeadroom] = useState(10);
  const dayaPerlu = dayaUntukSPL(target, sens, jarak, headroom);
  const ringkas = () => mode === 'plafon'
    ? `Ruang ${p}×${l} m, plafon ${t} m, speaker ${sudut}°: diameter cakupan ${f(sp.diameterM)} m, jarak antar speaker ±${f(sp.jarakM)} m, butuh ${sp.jumlah} speaker (${sp.kolom}×${sp.baris}).`
    : `Speaker ${sens} dB/1W/1m @${daya} W: SPL maks ${f(maks, 1)} dB di 1 m, ±${f(diJarak, 1)} dB di ${jarak} m.`;
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] items-start">
      <Kartu judul="Masukan">
        <div className="space-y-3">
          <Segmen nilai={mode} onUbah={setMode} opsi={[{ v: 'plafon', l: 'Speaker plafon' }, { v: 'spl', l: 'SPL & jarak' }]} />
          <PilihPustaka jenis="speaker" label="Speaker dari Pustaka" onPilih={e => {
            setSens(angkaDari(e, 'sensitivitas', sens));
            const s = angkaDari(e, 'sudut', 0); if (s > 10 && s < 180) setSudut(s);
          }} />
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
              <Angka label="SPL target" nilai={target} onUbah={setTarget} satuan="dB" bantuan="ucapan: bising latar + 25 dB" />
              <Angka label="Headroom puncak" nilai={headroom} onUbah={v => v >= 0 && setHeadroom(v)} satuan="dB" />
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
          [['SPL maks @1 m', `${f(maks, 1)} dB`], [`SPL @${f(jarak)} m`, `${f(diJarak, 1)} dB`, true], [`Daya untuk ${target} dB (+${headroom} dB)`, `${f(dayaPerlu, 1)} W`, true]],
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
            <Nilai label={`Daya untuk ${target} dB`} nilai={f(dayaPerlu, dayaPerlu < 10 ? 1 : 0)} satuan="W"
              ket={`+${headroom} dB headroom di ${f(jarak)} m`} nada={dayaPerlu > daya ? 'awas' : 'baik'} />
          </div>
        )}
        <Catatan>Hitungan geometris/medan bebas; ruangan dengan pantulan kuat menambah SPL namun menurunkan kejelasan (STI). Sisakan headroom 6-10 dB dari daya amplifier.</Catatan>
      </Kartu>
    </div>
  );
}

/* ── Daya, UPS & panas ───────────────────────────────────────────────── */
