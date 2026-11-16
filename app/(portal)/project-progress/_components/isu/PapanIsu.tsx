'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { Copy, Search } from 'lucide-react';
import { StatCardGrid, TombolEkspor } from '@/components/shared';
import { NETRAL } from '@/lib/desain';
import type { Ekspor } from '@/lib/ekspor-tabel';
import {
  PRIORITAS_ISU, STATUS_ISU, URUTAN_STATUS, hariIni, labelHari, ringkasHarian, tanggalSelesai, teksRingkasan, umurIsu,
  type Isu, type LokasiIsu, type StatusIsu,
} from '@/lib/isu/inti';
import { TEMA, fontAngka } from '../tampilan';
import { BarisIsu, NavTanggal, TabelKota } from './tampilan-isu';

type Tampilan = 'harian' | 'semua';
type SaringStatus = 'aktif' | 'semua' | StatusIsu;

const kartu = { background: NETRAL.permukaan, border: `1px solid ${NETRAL.garis}` };
const pilih = 'rounded-lg px-2.5 py-2 text-[12.5px] font-semibold';
const gayaPilih = { border: `1px solid ${NETRAL.garis}`, color: NETRAL.tinta, background: NETRAL.permukaan };

export function PapanIsu({ namaGrup, isu, lokasi, kategori, onBuka, beritahu, aksiAtas }: {
  namaGrup: string;
  isu: Isu[];
  lokasi: LokasiIsu[];
  kategori: string[];
  onBuka: (i: Isu) => void;
  beritahu: (type: 'success' | 'error', msg: string) => void;
  aksiAtas?: ReactNode;
}) {
  const [tanggal, setTanggal] = useState(hariIni);
  const [tampilan, setTampilan] = useState<Tampilan>('harian');
  const [status, setStatus] = useState<SaringStatus>('aktif');
  const [kota, setKota] = useState('');
  const [kat, setKat] = useState('');
  const [cari, setCari] = useState('');

  const r = useMemo(() => ringkasHarian(isu, tanggal), [isu, tanggal]);
  const hari = hariIni();
  const jumlahStatus = useMemo(() => {
    const m: Record<StatusIsu, number> = { open: 0, progress: 0, pending: 0, solved: 0 };
    for (const i of isu) m[i.status] += 1;
    return m;
  }, [isu]);

  const namaKota = useMemo(() => {
    const s = new Set(lokasi.map(l => l.nama));
    for (const i of isu) s.add(i.lokasi);
    return [...s];
  }, [lokasi, isu]);

  const tersaring = useMemo(() => {
    const q = cari.trim().toLowerCase();
    return isu
      .filter(i => status === 'semua' || (status === 'aktif' ? i.status !== 'solved' : i.status === status))
      .filter(i => !kota || i.lokasi === kota)
      .filter(i => !kat || i.kategori === kat)
      .filter(i => !q || [i.judul, i.deskripsi, i.action, i.solusi, i.pic, i.lokasi, `#${i.nomor}`].some(v => (v ?? '').toLowerCase().includes(q)));
  }, [isu, status, kota, kat, cari]);

  const salin = async () => {
    try { await navigator.clipboard.writeText(teksRingkasan(namaGrup, r)); beritahu('success', 'Ringkasan disalin. Tempel ke grup WhatsApp.'); }
    catch { beritahu('error', 'Gagal menyalin ringkasan.'); }
  };

  const ekspor = (): Ekspor<Isu> => ({
    judul: `Issue Log ${namaGrup}`,
    menu: 'Project Progress · Issue Log',
    warna: [TEMA.warna, '#ffffff'],
    filter: [['Status', status === 'aktif' ? 'Belum solved' : status === 'semua' ? '' : STATUS_ISU[status].label], ['Lokasi', kota], ['Kategori', kat], ['Cari', cari]],
    baris: tersaring,
    kolom: [
      { judul: 'No', ambil: i => i.nomor, angka: true },
      { judul: 'Tanggal', ambil: i => i.tanggal },
      { judul: 'Lokasi', ambil: i => i.lokasi },
      { judul: 'Kategori', ambil: i => i.kategori },
      { judul: 'Prioritas', ambil: i => PRIORITAS_ISU[i.prioritas].label },
      { judul: 'Isu', ambil: i => i.judul },
      { judul: 'Deskripsi', ambil: i => i.deskripsi },
      { judul: 'Pelapor', ambil: i => i.pelapor },
      { judul: 'PIC', ambil: i => i.pic },
      { judul: 'Status', ambil: i => STATUS_ISU[i.status].label },
      { judul: 'Action', ambil: i => i.action },
      { judul: 'Solusi', ambil: i => i.solusi },
      { judul: 'Tgl Solved', ambil: i => tanggalSelesai(i) ?? '' },
      { judul: 'Umur (hari)', ambil: i => umurIsu(i, hari), angka: true },
    ],
  });

  const tab = (k: Tampilan, label: string) => (
    <button type="button" onClick={() => setTampilan(k)} aria-pressed={tampilan === k}
      className="px-3 py-1.5 rounded-md text-[12.5px] font-bold transition-colors"
      style={tampilan === k ? { background: NETRAL.permukaan, color: NETRAL.tinta, boxShadow: '0 1px 2px rgba(15,23,42,.08)' } : { color: NETRAL.tinta2 }}>
      {label}
    </button>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="inline-flex p-0.5 rounded-lg" style={{ background: NETRAL.garis }} role="group" aria-label="Tampilan">
          {tab('harian', 'Ringkasan harian')}
          {tab('semua', `Semua isu (${isu.length})`)}
        </div>
        <div className="ml-auto flex items-center gap-2 flex-wrap">{aksiAtas}</div>
      </div>

      {tampilan === 'harian' && (
        <>
          <div className="rounded-xl px-3 sm:px-4 py-3" style={kartu}><NavTanggal tanggal={tanggal} onUbah={setTanggal} /></div>
          <StatCardGrid cols={4} items={[
            { label: 'Isu baru', value: r.baru.length, sub: 'dilaporkan hari ini', accent: '#7c3aed' },
            { label: 'Solved', value: r.selesai.length, sub: 'diselesaikan hari ini', accent: TEMA.selesai },
            { label: 'Masih terbuka', value: r.terbuka.length, sub: 'di akhir hari', accent: TEMA.bahaya },
            { label: 'Lokasi terdampak', value: r.kotaTerdampak, sub: `dari ${lokasi.length || namaKota.length} lokasi`, accent: TEMA.kendala },
          ]} />
          <section className="rounded-xl overflow-hidden" style={kartu}>
            <div className="flex items-center gap-2 flex-wrap px-3 sm:px-4 py-3" style={{ borderBottom: `1px solid ${NETRAL.garis}` }}>
              <div className="min-w-0">
                <h2 className="text-[14px] font-bold" style={{ color: NETRAL.tinta }}>Isu per lokasi</h2>
                <p className="text-[11.5px]" style={{ color: TEMA.samar }}>{labelHari(tanggal)} · baru, solved, dan yang masih berjalan dari hari sebelumnya</p>
              </div>
              <button type="button" onClick={salin}
                className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-bold"
                style={{ border: `1px solid ${NETRAL.garis}`, color: NETRAL.tinta2 }}>
                <Copy size={13} /> Salin ringkasan
              </button>
            </div>
            <TabelKota kota={r.kota} tanggal={tanggal} onBuka={onBuka} />
          </section>
        </>
      )}

      {tampilan === 'semua' && (
        <section className="rounded-xl overflow-hidden" style={kartu}>
          <div className="px-3 sm:px-4 py-3 space-y-2.5" style={{ borderBottom: `1px solid ${NETRAL.garis}` }}>
            <div className="flex gap-1.5 flex-wrap" role="group" aria-label="Saring status">
              {([['aktif', 'Belum solved', isu.length - jumlahStatus.solved], ...URUTAN_STATUS.map(s => [s, STATUS_ISU[s].label, jumlahStatus[s]]), ['semua', 'Semua', isu.length]] as [SaringStatus, string, number][])
                .map(([k, label, n]) => (
                  <button key={k} type="button" onClick={() => setStatus(k)} aria-pressed={status === k}
                    className="px-2.5 py-1 rounded-full text-[12px] font-bold"
                    style={status === k ? { background: TEMA.warna, color: '#fff' } : { border: `1px solid ${NETRAL.garis}`, color: NETRAL.tinta2 }}>
                    {label} <span style={fontAngka}>{n}</span>
                  </button>
                ))}
            </div>
            <div className="flex gap-2 flex-wrap items-center">
              <div className="relative flex-1 min-w-[180px] max-w-sm">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: TEMA.samar }} />
                <input value={cari} onChange={e => setCari(e.target.value)} placeholder="Cari isu, action, PIC, #nomor…" aria-label="Cari isu"
                  className="w-full rounded-lg pl-9 pr-3 py-2 text-[13px]" style={gayaPilih} />
              </div>
              <select value={kota} onChange={e => setKota(e.target.value)} aria-label="Saring lokasi" className={pilih} style={gayaPilih}>
                <option value="">Semua lokasi</option>
                {namaKota.map(k => <option key={k} value={k}>{k}</option>)}
              </select>
              <select value={kat} onChange={e => setKat(e.target.value)} aria-label="Saring kategori" className={pilih} style={gayaPilih}>
                <option value="">Semua kategori</option>
                {kategori.map(k => <option key={k} value={k}>{k}</option>)}
              </select>
              <div className="ml-auto"><TombolEkspor data={ekspor} jumlah={tersaring.length} /></div>
            </div>
          </div>
          {tersaring.length === 0
            ? <p className="px-4 py-10 text-center text-[13px]" style={{ color: TEMA.samar }}>{isu.length ? 'Tidak ada isu yang cocok.' : 'Belum ada isu tercatat.'}</p>
            : <ul className="divide-y" style={{ borderColor: NETRAL.garis }}>{tersaring.map(i => <BarisIsu key={i.id} isu={i} acuan={hari} onBuka={() => onBuka(i)} />)}</ul>}
        </section>
      )}
    </div>
  );
}
