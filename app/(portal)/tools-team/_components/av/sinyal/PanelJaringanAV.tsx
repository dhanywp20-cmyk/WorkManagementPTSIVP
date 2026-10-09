'use client';
/**
 * Jaringan AV-over-IP & Dante: aliran video (NDI, H.264/265, JPEG2000, SDVoE) + kanal audio Dante →
 * total bandwidth & link yang disarankan (≤ 70% kapasitas). Rumus: lib/av-audio-jaringan.ts.
 */
import { Angka, Catatan, f, Kartu, Nilai, Pilih, TombolSalin } from '../../bersama/ui';
import { aksiLembar, lembarAV } from '../lembar';
import { ALIRAN_IP, danteMbps, saranLink } from '@/lib/av-audio-jaringan';
import { angkaDari } from '@/lib/pustaka';
import { usePustaka } from '../../pustaka/usePustaka';
import { useState } from 'react';

/** Aliran diacu lewat NAMA - daftarnya dari Pustaka (aliran-ip), bawaan kode bila kosong. */
interface Aliran { jenis: string; jumlah: number }
const CATATAN = 'Bitrate per aliran adalah angka tipikal pabrikan (bisa berbeda per encoder & pengaturan kualitas). Dante dihitung 48 kHz dengan wadah 32-bit + ±10% overhead. Sisakan ≥ 30% kapasitas link; pakai switch managed dengan IGMP snooping (multicast) & QoS untuk Dante.';

export function PanelJaringanAV() {
  const { entri } = usePustaka('aliran-ip');
  const jenisAliran = entri.length ? entri.map(e => ({ l: e.nama, mbps: angkaDari(e, 'mbps') })) : ALIRAN_IP.map(a => ({ l: a.l, mbps: a.mbps }));
  const mbpsDari = (n: string) => jenisAliran.find(a => a.l === n)?.mbps ?? ALIRAN_IP.find(a => a.l === n)?.mbps ?? 0;
  const [aliran, setAliran] = useState<Aliran[]>([{ jenis: 'NDI|HX 1080p60', jumlah: 4 }, { jenis: 'H.264 1080p (encoder / streaming)', jumlah: 2 }]);
  const [dante, setDante] = useState(32);
  const ubah = (i: number, x: Partial<Aliran>) => setAliran(a => a.map((v, j) => (j === i ? { ...v, ...x } : v)));
  const baris = aliran.map(a => ({ ...a, label: a.jenis, mbps: mbpsDari(a.jenis) * Math.max(0, a.jumlah) }));
  const videoMbps = baris.reduce((n, b) => n + b.mbps, 0);
  const audioMbps = danteMbps(dante);
  const total = videoMbps + audioMbps;
  const link = saranLink(total);
  const pakai1G = (total / 1000) * 100, pakai10G = (total / 10000) * 100;
  const ringkas = () => [
    '*Jaringan AV-over-IP*',
    ...baris.map(b => `- ${b.jumlah} × ${b.label}: ${f(b.mbps, 0)} Mbps`),
    `- Dante ${dante} kanal: ${f(audioMbps, 1)} Mbps`,
    `Total ±${f(total, 0)} Mbps → link ${link} (1 GbE terpakai ${f(pakai1G, 0)}%, 10 GbE ${f(pakai10G, 1)}%)`,
  ].join('\n');
  const lembar = () => lembarAV('Jaringan AV-over-IP & Dante',
    [['Aliran video', String(aliran.reduce((n, a) => n + a.jumlah, 0))], ['Kanal Dante', String(dante)]],
    [['Video', `${f(videoMbps, 0)} Mbps`], ['Audio Dante', `${f(audioMbps, 1)} Mbps`], ['Total', `±${f(total, 0)} Mbps`, true], ['Link disarankan', link, true]],
    CATATAN,
    [{ judul: 'Rincian aliran', jenis: 'tabel', kepala: ['Aliran', 'Jumlah', 'Bitrate'], rataKanan: [1, 2],
      isi: [...baris.map(b => [b.label, String(b.jumlah), `${f(b.mbps, 0)} Mbps`]), [`Dante 48 kHz`, `${dante} kanal`, `${f(audioMbps, 1)} Mbps`]] }]);
  return (
    <Kartu judul="Jaringan AV-over-IP & Dante" aksi={<TombolSalin teks={ringkas} {...aksiLembar(lembar, 'Jaringan AV')} />}>
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,300px)]">
        <div className="space-y-2">
          {aliran.map((a, i) => (
            <div key={i} className="grid grid-cols-[minmax(0,1fr)_72px_32px] gap-2 items-end">
              <Pilih label={i === 0 ? 'Aliran video' : ''} nilai={a.jenis} onUbah={v => ubah(i, { jenis: v })} opsi={jenisAliran.map(x => ({ v: x.l, l: `${x.l} · ${f(x.mbps, 0)} Mbps` }))} />
              <Angka label={i === 0 ? 'Jml' : ''} nilai={a.jumlah} onUbah={v => ubah(i, { jumlah: Math.round(v) })} step={1} />
              <button type="button" aria-label="Hapus aliran" onClick={() => setAliran(x => x.filter((_, j) => j !== i))}
                className="h-[38px] rounded-lg text-slate-500 hover:bg-rose-50 hover:text-rose-700">✕</button>
            </div>
          ))}
          <button type="button" onClick={() => setAliran(a => [...a, { jenis: jenisAliran[0]?.l ?? '', jumlah: 1 }])}
            className="w-full py-2 rounded-xl border border-dashed border-slate-300 text-sm font-semibold text-slate-600 hover:bg-slate-50">+ Tambah aliran</button>
          <Angka label="Kanal audio Dante" nilai={dante} onUbah={v => v >= 0 && setDante(Math.round(v))} step={1} bantuan="total kanal yang mengalir di link ini" />
        </div>
        <div className="grid grid-cols-2 gap-2.5 content-start">
          <Nilai label="Video" nilai={f(videoMbps, 0)} satuan="Mbps" />
          <Nilai label="Dante" nilai={f(audioMbps, 1)} satuan="Mbps" />
          <Nilai label="Total" nilai={f(total, 0)} satuan="Mbps" />
          <Nilai label="Link disarankan" nilai={link} nada={pakai10G > 70 ? 'awas' : 'baik'} />
          <Nilai label="Beban 1 GbE" nilai={f(pakai1G, 0)} satuan="%" nada={pakai1G > 70 ? 'buruk' : pakai1G > 50 ? 'awas' : 'baik'} />
          <Nilai label="Beban 10 GbE" nilai={f(pakai10G, 1)} satuan="%" nada={pakai10G > 70 ? 'buruk' : 'baik'} />
        </div>
      </div>
      <Catatan>{CATATAN}</Catatan>
    </Kartu>
  );
}
