'use client';
/**
 * Audio · impedansi speaker low-Z (seri / paralel / seri-paralel) & rugi kabel speaker ke beban itu,
 * dengan saran ukuran kabel (rugi ≤ 0,5 dB). Rumus: lib/av-audio-jaringan.ts.
 */
import { Angka, Catatan, f, Kartu, Nilai, Pilih, TombolSalin } from '../../bersama/ui';
import { aksiLembar, lembarAV } from '../lembar';
import { impedansiSpeaker, rugiKabel, saranKabel, type Susunan, UKURAN_KABEL_MM2 } from '@/lib/av-audio-jaringan';
import { useState } from 'react';

const SUSUNAN: { v: Susunan; l: string }[] = [
  { v: 'paralel', l: 'Paralel' }, { v: 'seri', l: 'Seri' }, { v: 'seri-paralel', l: 'Seri-paralel' },
];
const CATATAN = 'Impedansi beban tidak boleh di bawah impedansi minimum amplifier per kanal (umumnya 4 Ω, beberapa 2 Ω). Rugi kabel dihitung pergi-pulang dengan tembaga 0,0175 Ω·mm²/m; batas umum 0,5 dB (±11% daya) supaya damping factor & bass tetap terjaga.';

export function AudioKabel() {
  const [jumlah, setJumlah] = useState(4);
  const [ohm, setOhm] = useState(8);
  const [susunan, setSusunan] = useState<Susunan>('paralel');
  const [perCabang, setPerCabang] = useState(2);
  const [minAmp, setMinAmp] = useState(4);
  const [panjang, setPanjang] = useState(25);
  const [luas, setLuas] = useState(1.5);
  const z = impedansiSpeaker(jumlah, ohm, susunan, perCabang);
  const k = rugiKabel(panjang, luas, z);
  const saran = saranKabel(panjang, z);
  const ringkas = () => [
    `${jumlah} × ${ohm} Ω ${susunan}${susunan === 'seri-paralel' ? ` (${perCabang}/cabang)` : ''} = ${f(z, 2)} Ω (amplifier min ${minAmp} Ω: ${z >= minAmp ? 'aman' : 'TERLALU RENDAH'})`,
    `Kabel ${f(panjang, 0)} m ${luas} mm²: R ${f(k.rKabelOhm, 2)} Ω, rugi ${f(k.rugiDb, 2)} dB (${f(k.hilangPersen, 1)}%)${saran ? `, saran ≥ ${saran} mm²` : ''}`,
  ].join('\n');
  const lembar = () => lembarAV('Audio · Impedansi & Kabel Speaker',
    [['Speaker', `${jumlah} × ${ohm} Ω`], ['Susunan', `${susunan}${susunan === 'seri-paralel' ? ` (${perCabang} per cabang)` : ''}`], ['Impedansi min amplifier', `${minAmp} Ω`], ['Kabel', `${f(panjang, 0)} m · ${luas} mm²`]],
    [['Impedansi beban', `${f(z, 2)} Ω`, true], ['Status amplifier', z >= minAmp ? 'Aman' : 'Terlalu rendah'], ['Rugi kabel', `${f(k.rugiDb, 2)} dB (${f(k.hilangPersen, 1)}%)`, true], ['Kabel saran (≤0,5 dB)', saran ? `≥ ${saran} mm²` : 'perpendek / bagi kanal']],
    CATATAN,
    [{ judul: 'Rugi per ukuran kabel', jenis: 'tabel', kepala: ['Penampang', 'R kabel', 'Rugi', 'Daya hilang'], rataKanan: [1, 2, 3],
      isi: UKURAN_KABEL_MM2.map(a => { const r = rugiKabel(panjang, a, z); return [`${a} mm²`, `${f(r.rKabelOhm, 2)} Ω`, `${f(r.rugiDb, 2)} dB`, `${f(r.hilangPersen, 1)}%`]; }) }]);
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] items-start">
      <Kartu judul="Masukan">
        <div className="grid grid-cols-2 gap-3">
          <Angka label="Jumlah speaker" nilai={jumlah} onUbah={v => v >= 1 && setJumlah(Math.round(v))} step={1} />
          <Angka label="Impedansi / speaker" nilai={ohm} onUbah={v => v > 0 && setOhm(v)} satuan="Ω" />
          <Pilih label="Susunan" nilai={susunan} onUbah={setSusunan} opsi={SUSUNAN} />
          {susunan === 'seri-paralel'
            ? <Angka label="Speaker per cabang" nilai={perCabang} onUbah={v => v >= 1 && setPerCabang(Math.round(v))} step={1} />
            : <Angka label="Min. amplifier" nilai={minAmp} onUbah={v => v > 0 && setMinAmp(v)} satuan="Ω" />}
          {susunan === 'seri-paralel' && <Angka label="Min. amplifier" nilai={minAmp} onUbah={v => v > 0 && setMinAmp(v)} satuan="Ω" />}
          <Angka label="Panjang kabel" nilai={panjang} onUbah={v => v > 0 && setPanjang(v)} satuan="m" bantuan="satu arah" />
          <Angka label="Luas penampang" nilai={luas} onUbah={v => v > 0 && setLuas(v)} satuan="mm²" />
        </div>
      </Kartu>
      <Kartu judul="Hasil" aksi={<TombolSalin teks={ringkas} {...aksiLembar(lembar, 'Impedansi Kabel Speaker')} />}>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          <Nilai label="Impedansi beban" nilai={f(z, 2)} satuan="Ω" nada={z >= minAmp ? 'baik' : 'buruk'} ket={z >= minAmp ? `aman (min ${minAmp} Ω)` : `di bawah ${minAmp} Ω - ubah susunan`} />
          <Nilai label="R kabel" nilai={f(k.rKabelOhm, 2)} satuan="Ω" ket="pergi-pulang" />
          <Nilai label="Rugi kabel" nilai={f(k.rugiDb, 2)} satuan="dB" ket={`${f(k.hilangPersen, 1)}% daya`} nada={k.rugiDb > 1 ? 'buruk' : k.rugiDb > 0.5 ? 'awas' : 'baik'} />
          <Nilai label="Kabel saran" nilai={saran ? `≥ ${saran}` : '-'} satuan={saran ? 'mm²' : undefined} ket={saran ? 'rugi ≤ 0,5 dB' : 'perpendek / bagi kanal'} />
        </div>
        <Catatan>{CATATAN}</Catatan>
      </Kartu>
    </div>
  );
}
