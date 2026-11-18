'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { BarChart3, CalendarDays, ChevronDown, Copy, Layers, MapPin, Package, Search, Tag, Users, X, type LucideIcon } from 'lucide-react';
import { StatCardGrid, TombolEkspor } from '@/components/shared';
import { FilterLipat } from '@/components/shared/FilterLipat';
import { NETRAL } from '@/lib/desain';
import type { Ekspor } from '@/lib/ekspor-tabel';
import {
  PRIORITAS_ISU, STATUS_ISU, URUTAN_STATUS, daftarUpdate, geserTanggal, hariIni, hitungPer, kodeIsu, kunciTeks, labelHari, labelWaktu, pecahProduk,
  ringkasHarian, tanggalSelesai, teksRingkasan, teksSemuaUpdate, umurIsu,
  type Isu, type LokasiIsu, type StatusIsu,
} from '@/lib/isu/inti';
import { TEMA, fontAngka } from '../tampilan';
import { BarisIsu, KepalaDaftarIsu, NavTanggal, TabelKota } from './tampilan-isu';
import { StatistikIsu, petaWarna } from './GrafikIsu';

type Tampilan = 'harian' | 'semua';
type SaringStatus = 'aktif' | 'semua' | StatusIsu;
type Dimensi = 'status' | 'kota' | 'kat' | 'produk' | 'pic';
const PERIODE: [string, string][] = [['', 'Semua'], ['7', '7 hari terakhir'], ['30', '30 hari terakhir'], ['90', '90 hari terakhir']];

const kartu = { background: NETRAL.permukaan, border: `1px solid ${NETRAL.garis}` };
const garisBawah = { borderBottom: `1px solid ${NETRAL.garis}` };
const kontrol = 'w-full h-9 rounded-lg pl-8 text-[13px] outline-hidden focus:ring-2 focus:ring-blue-200';
const gayaKontrol = { border: `1px solid ${NETRAL.garis}`, color: NETRAL.tinta, background: NETRAL.permukaanRedam };
const tombolKecil = 'inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-[12px] font-semibold';

function Bidang({ label, ikon: Ikon, children }: { label: string; ikon: LucideIcon; children: ReactNode }) {
  return (
    <label className="block min-w-0">
      <span className="block text-[10.5px] font-bold uppercase tracking-wider mb-1" style={{ color: TEMA.samar }}>{label}</span>
      <span className="relative block">
        <Ikon size={14} aria-hidden className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: TEMA.samar }} />
        {children}
      </span>
    </label>
  );
}

function Pilihan({ label, ikon, value, onChange, children }: {
  label: string; ikon: LucideIcon; value: string; onChange: (v: string) => void; children: ReactNode;
}) {
  return (
    <Bidang label={label} ikon={ikon}>
      <select value={value} onChange={e => onChange(e.target.value)} className={`${kontrol} pr-8 appearance-none cursor-pointer truncate`} style={gayaKontrol}>
        {children}
      </select>
      <ChevronDown size={14} aria-hidden className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: TEMA.samar }} />
    </Bidang>
  );
}

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
  const hapusSaring = () => { setStatus('semua'); setKota(''); setKat(''); setProduk(''); setPic(''); setCari(''); setPeriode(''); };
  const labelStatus = status === 'semua' ? '' : status === 'aktif' ? 'Belum solved' : STATUS_ISU[status].label;
  const labelPeriode = PERIODE.find(p => p[0] && p[0] === periode)?.[1] ?? '';
  const saringanAktif = ([
    ['Status', labelStatus, () => setStatus('semua')], ['Lokasi', kota, () => setKota('')], ['Kategori', kat, () => setKat('')],
    ['Produk', labelProduk, () => setProduk('')], ['Handler', labelPic, () => setPic('')], ['Periode', labelPeriode, () => setPeriode('')],
    ['Cari', cari.trim(), () => setCari('')],
  ] as [string, string, () => void][]).filter(([, v]) => v);

  const salin = async () => {
    try { await navigator.clipboard.writeText(teksRingkasan(namaGrup, r)); beritahu('success', 'Ringkasan disalin. Tempel ke grup WhatsApp.'); }
    catch { beritahu('error', 'Gagal menyalin ringkasan.'); }
  };

  const ekspor = (): Ekspor<Isu> => ({
    judul: `Issue Log ${namaGrup}`,
    menu: 'Project Progress · Issue Log',
    warna: [TEMA.warna, '#ffffff'],
    filter: [
      ['Status', labelStatus], ['Lokasi', kota], ['Kategori', kat],
      ['Produk', labelProduk], ['Team Handler', labelPic], ['Periode', labelPeriode], ['Cari', cari],
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
      { judul: 'Update terakhir', ambil: i => i.action },
      { judul: 'Solusi', ambil: i => i.solusi },
      { judul: 'Tgl Solved', ambil: i => tanggalSelesai(i) ?? '' },
      { judul: 'Umur (hari)', ambil: i => umurIsu(i, hari), angka: true },
      { judul: 'Jumlah update', ambil: i => daftarUpdate(i).filter(u => !u.awal).length, angka: true, hanyaExcel: true },
      { judul: 'Semua update', ambil: i => teksSemuaUpdate(i), hanyaExcel: true },
    ],
    lembarLain: [{
      nama: 'Riwayat Update',
      judul: `Riwayat semua update · Issue Log ${namaGrup}`,
      kolom: ['No', 'Tanggal isu', 'Lokasi', 'Isu', 'Status isu', 'Update ke', 'Waktu update', 'Oleh', 'Status', 'Update / Action', 'Catatan'],
      baris: tersaring.flatMap(i => daftarUpdate(i).map((u, n) => [
        kodeIsu(i), i.tanggal, i.lokasi, i.judul, STATUS_ISU[i.status].label, n + 1, labelWaktu(u.waktu), u.oleh, u.status, u.update, u.catatan,
      ])),
    }],
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
          <div className="flex items-center gap-2 flex-wrap px-3 sm:px-5 py-3" style={garisBawah}>
            <span className="text-[11.5px] font-bold uppercase tracking-widest" style={{ color: NETRAL.tinta2 }}>Daftar Isu</span>
            <span className="px-2 py-0.5 rounded-full text-[11.5px] font-bold" style={{ ...fontAngka, background: NETRAL.permukaanRedam, color: NETRAL.tinta2, border: `1px solid ${NETRAL.garis}` }}>
              {tersaring.length === isu.length ? isu.length : `${tersaring.length} / ${isu.length}`}
            </span>
            <div className="ml-auto flex items-center gap-1.5 flex-wrap">
              <button type="button" onClick={() => setGrafik(g => !g)} aria-pressed={grafik} className={tombolKecil}
                title={grafik ? 'Sembunyikan grafik' : 'Tampilkan grafik'}
                style={grafik
                  ? { border: `1px solid ${TEMA.garisTint}`, color: TEMA.warnaTua, background: TEMA.tint }
                  : { border: `1px solid ${NETRAL.garis}`, color: NETRAL.tinta2, background: NETRAL.permukaan }}>
                <BarChart3 size={14} /> Grafik
              </button>
              <TombolEkspor data={ekspor} jumlah={tersaring.length} />
            </div>
          </div>

          <div className="px-3 sm:px-5 py-3" style={garisBawah}>
            <FilterLipat kelas="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-2 sm:gap-3" aktif={[labelStatus, kota, kat, produk, pic, periode]}>
              <div className="col-span-2 md:col-span-4 xl:col-span-2">
                <Bidang label="Cari" ikon={Search}>
                  <input value={cari} onChange={e => setCari(e.target.value)} placeholder="Isu, action, PIC, #nomor…" className={`${kontrol} pr-3`} style={gayaKontrol} />
                </Bidang>
              </div>
              <Pilihan label="Status" ikon={Tag} value={status} onChange={v => setStatus(v as SaringStatus)}>
                <option value="semua">Semua ({isu.length})</option>
                <option value="aktif">Belum solved ({isu.length - jumlahStatus.solved})</option>
                {URUTAN_STATUS.map(s => <option key={s} value={s}>{STATUS_ISU[s].label} ({jumlahStatus[s]})</option>)}
              </Pilihan>
              <Pilihan label="Lokasi" ikon={MapPin} value={kota} onChange={setKota}>
                <option value="">Semua</option>
                {namaKota.map(k => <option key={k} value={k}>{k}</option>)}
              </Pilihan>
              <Pilihan label="Kategori" ikon={Layers} value={kat} onChange={setKat}>
                <option value="">Semua</option>
                {daftarKategori.map(k => <option key={k} value={k}>{k}</option>)}
              </Pilihan>
              <Pilihan label="Produk" ikon={Package} value={produk} onChange={setProduk}>
                <option value="">Semua</option>
                {daftarProduk.map(p => <option key={p.kunci} value={p.kunci}>{p.label}</option>)}
              </Pilihan>
              <Pilihan label="Team Handler" ikon={Users} value={pic} onChange={setPic}>
                <option value="">Semua</option>
                {daftarPic.map(p => <option key={p.kunci} value={p.kunci}>{p.label}</option>)}
              </Pilihan>
              <Pilihan label="Periode" ikon={CalendarDays} value={periode} onChange={setPeriode}>
                {PERIODE.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
              </Pilihan>
            </FilterLipat>
          </div>

          {saringanAktif.length > 0 && (
            <div className="px-3 sm:px-5 py-2 flex flex-wrap gap-1.5 items-center" style={{ ...garisBawah, background: NETRAL.permukaanRedam }}>
              <span className="text-[10.5px] font-bold uppercase tracking-widest mr-1" style={{ color: TEMA.samar }}>Filter aktif</span>
              {saringanAktif.map(([k, v, hapus]) => (
                <button key={k} type="button" onClick={hapus} aria-label={`Hapus filter ${k}`}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11.5px] font-bold max-w-[260px]"
                  style={{ background: TEMA.tint, color: TEMA.warnaTua, border: `1px solid ${TEMA.garisTint}` }}>
                  <span className="truncate">{k}: {v}</span> <X size={12} className="shrink-0" />
                </button>
              ))}
              <button type="button" onClick={hapusSaring} className="ml-auto text-[11.5px] font-bold px-2 py-1 rounded-lg" style={{ color: TEMA.bahaya }}>Reset semua</button>
            </div>
          )}

          {tersaring.length === 0
            ? <p className="px-4 py-10 text-center text-[13px]" style={{ color: TEMA.samar }}>{isu.length ? 'Tidak ada isu yang cocok dengan filter.' : 'Belum ada isu tercatat.'}</p>
            : <><KepalaDaftarIsu /><ul className="divide-y" style={{ borderColor: NETRAL.garis }}>{tersaring.map(i => <BarisIsu key={i.id} isu={i} acuan={hari} onBuka={() => onBuka(i)} />)}</ul></>}
        </section>
      )}
    </div>
  );
}
