'use client';
/**
 * Sub menu Bandingkan Pitch: 2-4 modul dari referensi pada ukuran target yang sama - resolusi, jarak
 * pandang, daya, berat & port berdampingan, plus saran pitch dari jarak penonton terdekat.
 * "Pakai" memindahkan modul & ukuran itu ke Calculator LED. Rumus: lib/led-banding.ts.
 */
import { useMemo, useState } from 'react';
import { Angka, Catatan, f, Kartu, Pilih, Segmen, TombolSalin } from '../../bersama/ui';
import { bukaCetak, type Lembar, namaBerkas, unduhLembarPNG } from '../../bersama/cetak';
import { BRAND_UMUM, brandModul, kunciModul, type ModulLED, type Pembulatan } from '@/lib/av-hitung';
import { bandingPitch, saranPitch } from '@/lib/led-banding';
import { BULAT, LINGKUNGAN_TIPE, PER_M2 } from '../data';
import { BarSub } from '../panel/BarSub';
import { ModalBersama } from '../panel/ModalBersama';
import type { AlatLED } from '../panel/alat';

const MAKS = 4;
const CATATAN = 'Jarak minimum ≈ 1 m per 1 mm pitch (piksel mulai terlihat), jarak nyaman ≈ 3× pitch. Saran = pitch PALING BESAR (paling hemat) yang masih nyaman dari penonton terdekat. Daya & berat memakai angka tipikal per m² sesuai tipe modul - cek datasheet sebelum penawaran.';
const labelModul = (m: ModulLED) => [brandModul(m) !== BRAND_UMUM && brandModul(m), m.model, m.kode].filter(Boolean).join(' ');

export function TampilanBanding({ a }: { a: AlatLED }) {
  const K = a.K;
  const semua = K.daftarModul;
  //  Awal: modul aktif + tetangga pitch-nya di brand yang sama.
  const [pilihan, setPilihan] = useState<string[]>(() => {
    const sebrand = K.modulBrand.length ? K.modulBrand : semua;
    const i = Math.max(0, sebrand.findIndex(m => kunciModul(m) === kunciModul(K.modul)));
    return [sebrand[i - 1], sebrand[i], sebrand[i + 1]].filter((m): m is ModulLED => !!m).map(kunciModul);
  });
  const [lebar, setLebar] = useState(() => (K.mode === 'ukuran' ? K.targetW : Math.round(K.h.lebarM * 100) / 100));
  const [tinggi, setTinggi] = useState(() => (K.mode === 'ukuran' ? K.targetH : Math.round(K.h.tinggiM * 100) / 100));
  const [bulat, setBulat] = useState<Pembulatan>(K.bulat);
  const [jarak, setJarak] = useState(() => Math.max(1, Math.round(K.h.jarakIdealM)));

  const modul = useMemo(() => pilihan.map(k => semua.find(m => kunciModul(m) === k)).filter((m): m is ModulLED => !!m), [pilihan, semua]);
  const baris = useMemo(() => bandingPitch(modul, {
    lebarM: lebar, tinggiM: tinggi, bulat, faktorRata: K.faktorRata / 100, refresh: K.refresh, bit: K.bit, tegangan: K.tegangan, faktorDaya: K.faktorDaya,
    perM2: m => PER_M2[LINGKUNGAN_TIPE[m.tipe]],
  }), [modul, lebar, tinggi, bulat, K.faktorRata, K.refresh, K.bit, K.tegangan, K.faktorDaya]);
  const saran = saranPitch(baris, jarak);
  const disarankan = (m: ModulLED) => !!saran && kunciModul(saran.modul) === kunciModul(m);
  const namaSaran = saran ? labelModul(saran.modul) : '';
  const sisa = semua.filter(m => !pilihan.includes(kunciModul(m)));

  const pakai = (m: ModulLED) => {
    K.setSatuan('modul'); K.pilihModul(kunciModul(m));
    K.setMode('ukuran'); K.setTargetW(lebar); K.setTargetH(tinggi); K.setBulat(bulat);
    K.pindah('led');
  };

  //  Tabel: baris = ukuran, kolom = modul (lebih mudah dibandingkan berdampingan).
  const metrik: [string, (i: number) => string][] = [
    ['Susunan', i => `${baris[i].kolom} × ${baris[i].baris} ${baris[i].modul.unit ?? 'modul'} (${baris[i].h.jumlahCab})`],
    ['Ukuran nyata', i => `${f(baris[i].h.lebarM)} × ${f(baris[i].h.tinggiM)} m`],
    ['Selisih dari target', i => `${baris[i].selisihLebarM >= 0 ? '+' : ''}${f(baris[i].selisihLebarM * 100, 0)} / ${baris[i].selisihTinggiM >= 0 ? '+' : ''}${f(baris[i].selisihTinggiM * 100, 0)} cm`],
    ['Resolusi', i => `${baris[i].h.resX} × ${baris[i].h.resY} px`],
    ['Total piksel', i => `${f(baris[i].h.totalPx / 1e6, 2)} MP`],
    ['Rasio', i => baris[i].h.rasioTerdekat],
    ['Jarak min / nyaman', i => `${f(baris[i].h.jarakMinM, 1)} / ${f(baris[i].h.jarakIdealM, 1)} m`],
    ['Daya maks / rata-rata', i => `${f(baris[i].h.dayaMaksW / 1000, 2)} / ${f(baris[i].h.dayaRataW / 1000, 2)} kW`],
    ['Berat', i => `${f(baris[i].h.beratKg, 0)} kg`],
    ['Port LAN', i => `${baris[i].h.portLAN} port (${K.refresh} Hz ${K.bit}-bit)`],
    ['Tipe · pemakaian', i => `${baris[i].modul.tipe} · ${baris[i].modul.guna}`],
  ];
  const kepala = baris.map(b => labelModul(b.modul) + (disarankan(b.modul) ? ' ★' : ''));
  const teks = () => [
    `*Perbandingan pitch LED* - target ${f(lebar)} × ${f(tinggi)} m, penonton terdekat ${f(jarak, 1)} m`,
    ...baris.map((b, i) => `- ${kepala[i]}: ${metrik.slice(0, 9).map(([l, v]) => `${l} ${v(i)}`).join('; ')}`),
    saran ? `Saran: ${namaSaran}${saran.nyaman ? '' : ' (cukup, belum nyaman)'}` : 'Semua pitch terlalu kasar untuk jarak ini.',
  ].join('\n');
  const lembar = (): Lembar => ({
    judul: 'Perbandingan Pitch LED', subjudul: [K.project || 'Tanpa nama project', K.customer].filter(Boolean).join(' · '),
    kepala: [['Target', `${f(lebar)} × ${f(tinggi)} m`], ['Penonton terdekat', `${f(jarak, 1)} m`]],
    seksi: [{ judul: 'Perbandingan', jenis: 'tabel', kepala: ['', ...kepala], isi: metrik.map(([l, v]) => [l, ...baris.map((_, i) => v(i))]) }],
    catatan: `${saran ? `Saran: ${namaSaran}${saran.nyaman ? '' : ' (cukup, belum nyaman)'}. ` : ''}${CATATAN}`,
  });

  return (
    <div className="space-y-4">
      <BarSub a={a} />
      <Kartu judul="Bandingkan Pitch" aksi={<TombolSalin teks={teks} onCetak={() => bukaCetak(lembar())}
        onPng={() => unduhLembarPNG(lembar(), namaBerkas('Perbandingan Pitch', K.project, K.customer))} />}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Angka label="Lebar target" nilai={lebar} onUbah={v => v > 0 && setLebar(v)} satuan="m" />
          <Angka label="Tinggi target" nilai={tinggi} onUbah={v => v > 0 && setTinggi(v)} satuan="m" />
          <Angka label="Penonton terdekat" nilai={jarak} onUbah={v => v > 0 && setJarak(v)} satuan="m" bantuan="baris kursi / posisi berdiri terdekat" />
          <Segmen label="Pembulatan" nilai={bulat} onUbah={setBulat} opsi={BULAT} />
        </div>
        <div className="flex flex-wrap items-end gap-2 mt-3">
          {modul.map(m => (
            <span key={kunciModul(m)} className="inline-flex items-center gap-1 pl-2.5 pr-1 py-1 rounded-lg bg-blue-50 border border-blue-200 text-[12.5px] font-semibold text-blue-900">
              {labelModul(m)}
              <button type="button" aria-label={`Hapus ${labelModul(m)}`} disabled={modul.length <= 1}
                onClick={() => setPilihan(p => p.filter(k => k !== kunciModul(m)))} className="px-1.5 rounded hover:bg-blue-100 disabled:opacity-40">✕</button>
            </span>
          ))}
          {modul.length < MAKS && sisa.length > 0 && (
            <div className="w-64 max-w-full">
              <Pilih label="Tambah modul" nilai="" onUbah={(v: string) => v && setPilihan(p => [...p, v].slice(0, MAKS))}
                opsi={[{ v: '', l: `Pilih (maks ${MAKS})...` }, ...sisa.map(m => ({ v: kunciModul(m), l: `${labelModul(m)} · ${m.tipe}` }))]} />
            </div>
          )}
        </div>
        {saran
          ? <p className="mt-3 text-[13px] rounded-xl px-3 py-2 bg-emerald-50 border border-emerald-200 text-emerald-900">
              Saran untuk penonton terdekat {f(jarak, 1)} m: <b>{namaSaran}</b>{saran.nyaman ? ' - pitch paling hemat yang tetap nyaman dilihat.' : ' - piksel masih sedikit terlihat; pilih pitch lebih halus bila anggaran memungkinkan.'}
            </p>
          : <p className="mt-3 text-[13px] rounded-xl px-3 py-2 bg-amber-50 border border-amber-200 text-amber-900">Semua modul terpilih terlalu kasar untuk penonton {f(jarak, 1)} m - tambahkan pitch yang lebih halus.</p>}
      </Kartu>
      <Kartu judul="Hasil perbandingan">
        <div className="overflow-x-auto -mx-1">
          <table className="w-full text-[12.5px] border-separate border-spacing-0 min-w-[560px]">
            <thead>
              <tr>
                <th className="text-left p-2 sticky left-0 bg-white" />
                {baris.map((b, i) => (
                  <th key={kunciModul(b.modul)} className={`text-left p-2 align-bottom rounded-t-xl ${disarankan(b.modul) ? 'bg-emerald-50' : ''}`}>
                    <div className="font-extrabold text-slate-900 text-[13.5px]">{kepala[i]}</div>
                    <div className="text-[11px] text-slate-500 font-semibold">{b.modul.w}×{b.modul.h} mm · {b.modul.pxW}×{b.modul.pxH} px</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {metrik.map(([l, v]) => (
                <tr key={l} className="border-t border-slate-100">
                  <th scope="row" className="text-left p-2 font-semibold text-slate-600 sticky left-0 bg-white border-t border-slate-100 whitespace-nowrap">{l}</th>
                  {baris.map((b, i) => (
                    <td key={kunciModul(b.modul)} className={`p-2 border-t border-slate-100 tabular-nums text-slate-800 ${disarankan(b.modul) ? 'bg-emerald-50' : ''}`}>{v(i)}</td>
                  ))}
                </tr>
              ))}
              <tr>
                <td className="sticky left-0 bg-white" />
                {baris.map(b => (
                  <td key={kunciModul(b.modul)} className={`p-2 rounded-b-xl ${disarankan(b.modul) ? 'bg-emerald-50' : ''}`}>
                    <button type="button" onClick={() => pakai(b.modul)}
                      className="px-2.5 py-1.5 rounded-lg text-xs font-bold border border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100">Pakai di Calculator LED</button>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
        <Catatan>{CATATAN}</Catatan>
      </Kartu>
      <ModalBersama a={a} />
    </div>
  );
}
