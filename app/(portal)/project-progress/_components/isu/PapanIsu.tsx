'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { BarChart3, Copy, Search } from 'lucide-react';
import { StatCardGrid, TombolEkspor } from '@/components/shared';
import { NETRAL } from '@/lib/desain';
import type { Ekspor } from '@/lib/ekspor-tabel';
import {
  PRIORITAS_ISU, STATUS_ISU, URUTAN_STATUS, geserTanggal, hariIni, hitungPer, kodeIsu, kunciTeks, labelHari, pecahProduk, ringkasHarian, tanggalSelesai,
  teksRingkasan, umurIsu,
  type Isu, type LokasiIsu, type StatusIsu,
} from '@/lib/isu/inti';
import { TEMA, fontAngka } from '../tampilan';
import { BarisIsu, KepalaDaftarIsu, NavTanggal, TabelKota } from './tampilan-isu';
import { StatistikIsu, petaWarna } from './GrafikIsu';

type Tampilan = 'harian' | 'semua';
type SaringStatus = 'aktif' | 'semua' | StatusIsu;
type Dimensi = 'status' | 'kota' | 'kat' | 'produk' | 'pic';
const PERIODE: [string, string][] = [['', 'Semua tanggal'], ['7', '7 hari terakhir'], ['30', '30 hari terakhir'], ['90', '90 hari terakhir']];

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
  const [tampilan, setTampilan] = useState<Tampilan>('semua');
  const [status, setStatus] = useState<SaringStatus>('semua');
  const [kota, setKota] = useState('');
  const [kat, setKat] = useState('');
  const [cari, setCari] = useState('');
  const [produk, setProduk] = useState('');
  const [pic, setPic] = useState('');
  const [periode, setPeriode] = useState('');
  const [grafik, setGrafik] = useState(true);

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

  const daftarKategori = useMemo(() => [...new Set([...kategori, ...isu.map(i => i.kategori)])], [kategori, isu]);

  const saring = useMemo(() => {
    const q = cari.trim().toLowerCase();
    const mulai = periode ? geserTanggal(hari, 1 - Number(periode)) : '';
    const dasar = isu
      .filter(i => !mulai || i.tanggal >= mulai)
      .filter(i => !q || [i.judul, i.deskripsi, i.produk, i.action, i.solusi, i.pic, i.lokasi, kodeIsu(i)].some(v => (v ?? '').toLowerCase().includes(q)));
    return (kecuali?: Dimensi) => dasar
      .filter(i => kecuali === 'status' || status === 'semua' || (status === 'aktif' ? i.status !== 'solved' : i.status === status))
      .filter(i => kecuali === 'kota' || !kota || i.lokasi === kota)
      .filter(i => kecuali === 'kat' || !kat || i.kategori === kat)
      .filter(i => kecuali === 'produk' || !produk || pecahProduk(i.produk).some(p => kunciTeks(p) === produk))
      .filter(i => kecuali === 'pic' || !pic || kunciTeks(i.pic ?? '') === pic);
  }, [isu, status, kota, kat, produk, pic, cari, periode, hari]);

  const tersaring = useMemo(() => saring().sort((a, b) => b.tanggal.localeCompare(a.tanggal) || b.created_at.localeCompare(a.created_at)), [saring]);
  const grafikKat = useMemo(() => hitungPer(saring('kat'), i => [i.kategori]), [saring]);
  const grafikProduk = useMemo(() => hitungPer(saring('produk'), i => pecahProduk(i.produk)), [saring]);
  const grafikPic = useMemo(() => hitungPer(saring('pic'), i => [i.pic]), [saring]);
  const statusTersaring = useMemo(() => {
    const m: Record<StatusIsu, number> = { open: 0, progress: 0, pending: 0, solved: 0 };
    for (const i of saring('status')) m[i.status] += 1;
    return m;
  }, [saring]);
  const semuaKat = useMemo(() => hitungPer(isu, i => [i.kategori]), [isu]);
  const semuaPic = useMemo(() => hitungPer(isu, i => [i.pic]), [isu]);
  const semuaProduk = useMemo(() => hitungPer(isu, i => pecahProduk(i.produk)), [isu]);
  const warna = useMemo(() => ({ kat: petaWarna(semuaKat), pic: petaWarna(semuaPic), produk: petaWarna(semuaProduk) }), [semuaKat, semuaPic, semuaProduk]);
  const daftarProduk = useMemo(() => [...semuaProduk].sort((a, b) => a.label.localeCompare(b.label)), [semuaProduk]);
  const daftarPic = useMemo(() => [...semuaPic].sort((a, b) => a.label.localeCompare(b.label)), [semuaPic]);
  const labelProduk = daftarProduk.find(p => p.kunci === produk)?.label ?? '';
  const labelPic = daftarPic.find(p => p.kunci === pic)?.label ?? '';
  const adaSaring = status !== 'semua' || !!kota || !!kat || !!produk || !!pic || !!cari || !!periode;
  const hapusSaring = () => { setStatus('semua'); setKota(''); setKat(''); setProduk(''); setPic(''); setCari(''); setPeriode(''); };

  const salin = async () => {
    try { await navigator.clipboard.writeText(teksRingkasan(namaGrup, r)); beritahu('success', 'Ringkasan disalin. Tempel ke grup WhatsApp.'); }
    catch { beritahu('error', 'Gagal menyalin ringkasan.'); }
  };

  const ekspor = (): Ekspor<Isu> => ({
    judul: `Issue Log ${namaGrup}`,
    menu: 'Project Progress · Issue Log',
    warna: [TEMA.warna, '#ffffff'],
    filter: [
      ['Status', status === 'aktif' ? 'Belum solved' : status === 'semua' ? '' : STATUS_ISU[status].label], ['Lokasi', kota], ['Kategori', kat],
      ['Produk', labelProduk], ['Team Handler', labelPic], ['Periode', PERIODE.find(p => p[0] && p[0] === periode)?.[1] ?? ''], ['Cari', cari],
    ],
    baris: tersaring,
    kolom: [
      { judul: 'No', ambil: i => kodeIsu(i) },
      { judul: 'Tanggal', ambil: i => i.tanggal },
      { judul: 'Lokasi', ambil: i => i.lokasi },
      { judul: 'Kategori', ambil: i => i.kategori },
      { judul: 'Produk', ambil: i => i.produk },
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
          {tab('semua', `Semua isu (${isu.length})`)}
          {tab('harian', 'Ringkasan harian')}
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

      {tampilan === 'semua' && grafik && (
        <StatistikIsu status={statusTersaring} statusAktif={status} onStatus={st => setStatus(st || 'semua')}
          kategori={{ data: grafikKat, warna: warna.kat, aktif: kat ? kunciTeks(kat) : '', onPilih: k => setKat(grafikKat.find(x => x.kunci === k)?.label ?? '') }}
          handler={{ data: grafikPic, warna: warna.pic, aktif: pic, onPilih: setPic }}
          produk={{ data: grafikProduk, warna: warna.produk, aktif: produk, onPilih: setProduk }} />
      )}

      {tampilan === 'semua' && (
        <section className="rounded-xl overflow-hidden" style={kartu}>
          <div className="px-3 sm:px-4 py-3 space-y-2.5">
            <div className="flex gap-1.5 flex-wrap" role="group" aria-label="Saring status">
              {([['semua', 'Semua', isu.length], ['aktif', 'Belum solved', isu.length - jumlahStatus.solved], ...URUTAN_STATUS.map(s => [s, STATUS_ISU[s].label, jumlahStatus[s]])] as [SaringStatus, string, number][])
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
                {daftarKategori.map(k => <option key={k} value={k}>{k}</option>)}
              </select>
              <select value={produk} onChange={e => setProduk(e.target.value)} aria-label="Saring produk" className={`${pilih} max-w-[200px]`} style={gayaPilih}>
                <option value="">Semua produk</option>
                {daftarProduk.map(p => <option key={p.kunci} value={p.kunci}>{p.label}</option>)}
              </select>
              <select value={pic} onChange={e => setPic(e.target.value)} aria-label="Saring team handler" className={`${pilih} max-w-[200px]`} style={gayaPilih}>
                <option value="">Semua handler</option>
                {daftarPic.map(p => <option key={p.kunci} value={p.kunci}>{p.label}</option>)}
              </select>
              <select value={periode} onChange={e => setPeriode(e.target.value)} aria-label="Saring periode" className={pilih} style={gayaPilih}>
                {PERIODE.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
              </select>
              {adaSaring && (
                <button type="button" onClick={hapusSaring} className="text-[12px] font-bold px-2 py-1.5 rounded-lg" style={{ color: TEMA.warna }}>Hapus saringan</button>
              )}
              <div className="ml-auto flex items-center gap-2">
                <button type="button" onClick={() => setGrafik(g => !g)} aria-pressed={grafik}
                  className="inline-flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-[12.5px] font-bold" style={gayaPilih}>
                  <BarChart3 size={14} /> {grafik ? 'Sembunyikan grafik' : 'Tampilkan grafik'}
                </button>
                <TombolEkspor data={ekspor} jumlah={tersaring.length} />
              </div>
            </div>
          </div>
        </section>
      )}

      {tampilan === 'semua' && (
        <section className="rounded-xl overflow-hidden" style={kartu}>
          {tersaring.length === 0
            ? <p className="px-4 py-10 text-center text-[13px]" style={{ color: TEMA.samar }}>{isu.length ? 'Tidak ada isu yang cocok.' : 'Belum ada isu tercatat.'}</p>
            : <><KepalaDaftarIsu /><ul className="divide-y" style={{ borderColor: NETRAL.garis }}>{tersaring.map(i => <BarisIsu key={i.id} isu={i} acuan={hari} onBuka={() => onBuka(i)} />)}</ul></>}
        </section>
      )}
    </div>
  );
}
