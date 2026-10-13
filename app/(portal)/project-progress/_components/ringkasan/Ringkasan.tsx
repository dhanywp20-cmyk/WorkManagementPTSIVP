'use client';

/**
 * Ringkasan & grafik Project Progress - satu tampilan untuk semua tempat: daftar proyek, detail
 * proyek, checklist lokasi, link View-Only, dan link checklist tim. Angka dari ./hitung.ts.
 *
 * Aturan: tiap fakta tampil SEKALI di halaman. Progres per lokasi / per bagian sudah ada di kartu
 * di bawahnya, jumlah per status proyek di kartu filter - tidak diulang di sini.
 */
import { useState } from 'react';
import { BarChart3, ChevronDown, ListChecks } from 'lucide-react';
import { MiniPieChart } from '@/components/shared';
import { NETRAL } from '@/lib/desain';
import type { StatChecklist } from '@/lib/checklist';
import type { Kontribusi } from '@/lib/checklist-ringkasan';
import { KepingKendala, TEMA, fontAngka } from '../tampilan';
import type { Ringkasan, RingkasanChecklist as DataChecklist, RingkasanDaftar, TitikLaju, Waktu } from './hitung';

const kartu = { background: NETRAL.permukaan, border: `1px solid ${NETRAL.garis}`, boxShadow: '0 1px 2px rgba(15,23,42,0.04)' };

function Cincin({ persen }: { persen: number }) {
  const r = 42, k = 2 * Math.PI * r;
  const warna = persen >= 100 ? TEMA.selesai : TEMA.warna;
  return (
    <svg viewBox="0 0 100 100" className="w-28 h-28 flex-shrink-0" role="img" aria-label={`Progres ${persen}%`}>
      <circle cx="50" cy="50" r={r} fill="none" stroke={NETRAL.garis} strokeWidth="9" />
      <circle cx="50" cy="50" r={r} fill="none" stroke={warna} strokeWidth="9" strokeLinecap="round"
        strokeDasharray={`${(persen / 100) * k} ${k}`} transform="rotate(-90 50 50)" style={{ transition: 'stroke-dasharray .6s' }} />
      <text x="50" y="50" textAnchor="middle" dominantBaseline="central" fontSize="22" fontWeight="800" fill={NETRAL.tinta} style={fontAngka}>{persen}%</text>
    </svg>
  );
}

function Angka({ label, nilai, sub, warna }: { label: string; nilai: string; sub?: string; warna?: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[10.5px] font-bold uppercase tracking-wide truncate" style={{ color: TEMA.samar }}>{label}</p>
      <p className="text-[19px] font-extrabold leading-tight" style={{ ...fontAngka, color: warna ?? NETRAL.tinta }}>{nilai}</p>
      {sub && <p className="text-[11px] font-semibold truncate" style={{ color: TEMA.samar }}>{sub}</p>}
    </div>
  );
}

/** Waktu: hari berjalan, sisa, waktu terpakai + vonis terhadap pekerjaan (persennya sendiri tampil di tempat lain). */
function BlokWaktu({ w, persen }: { w: Waktu; persen: number }) {
  if (w.hariBerjalan === null && w.sisaHari === null) return null;
  const lewat = w.sisaHari !== null && w.sisaHari < 0;
  return (
    <div className="space-y-2.5 min-w-0">
      <div className="grid grid-cols-2 gap-3">
        <Angka label="Hari berjalan" nilai={w.hariBerjalan === null ? '-' : String(w.hariBerjalan)} />
        <Angka label={lewat ? 'Lewat target' : 'Sisa waktu'} nilai={w.sisaHari === null ? '-' : `${Math.abs(w.sisaHari)} hari`}
          warna={lewat && persen < 100 ? TEMA.bahaya : undefined} />
      </div>
      {w.waktuPersen !== null && (
        <div>
          <div className="flex justify-between text-[11px] font-bold mb-1">
            <span className="uppercase tracking-wide" style={{ color: TEMA.samar }}>Waktu terpakai</span>
            <span style={{ ...fontAngka, color: NETRAL.tinta2 }}>{w.waktuPersen}%</span>
          </div>
          {/* Penanda biru = posisi pekerjaan: di kanan batang abu-abu berarti di depan jadwal. */}
          <div className="relative h-2 rounded-full" style={{ background: NETRAL.garis }}>
            <div className="h-full rounded-full" style={{ width: `${w.waktuPersen}%`, background: '#94a3b8' }} />
            <span className="absolute -top-1 w-1 h-4 rounded-full" style={{ left: `calc(${Math.min(persen, 100)}% - 2px)`, background: persen >= 100 ? TEMA.selesai : TEMA.warna }}
              title={`Pekerjaan ${persen}%`} />
          </div>
          <p className="text-[12px] font-bold mt-1.5" style={{ color: persen >= w.waktuPersen ? TEMA.selesai : TEMA.kendala }}>
            {persen >= 100 ? 'Seluruh pekerjaan selesai'
              : persen >= w.waktuPersen ? `Sesuai jadwal · ${persen - w.waktuPersen}% di depan`
              : `Tertinggal ${w.waktuPersen - persen}% dari jadwal`}
          </p>
        </div>
      )}
    </div>
  );
}

/** Progres keseluruhan + waktu - satu-satunya tempat angka progres proyek tampil. */
function KartuProgres({ persen, stat, w }: { persen: number; stat: StatChecklist; w: Waktu }) {
  return (
    <div className="rounded-xl p-4 flex flex-col sm:flex-row lg:flex-col gap-4" style={kartu}>
      <div className="flex items-center gap-4">
        <Cincin persen={persen} />
        <div className="space-y-1.5">
          <Angka label="Item selesai" nilai={`${stat.selesai}/${stat.total}`} />
          <KepingKendala jumlah={stat.kendala} />
        </div>
      </div>
      <div className="flex-1 sm:pl-4 sm:border-l lg:pl-0 lg:border-l-0 lg:pt-4 lg:border-t" style={{ borderColor: NETRAL.garis }}>
        <BlokWaktu w={w} persen={persen} />
      </div>
    </div>
  );
}

const fmtTgl = (t: string) => new Date(`${t}T00:00:00`).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });

/** Batang = centang per hari, garis = total kumulatif. SVG polos - tanpa pustaka grafik. */
function GrafikLaju({ laju }: { laju: TitikLaju[] }) {
  const L = 600, T = 150, pad = { kiri: 6, kanan: 6, atas: 12, bawah: 4 };
  const lebar = (L - pad.kiri - pad.kanan) / laju.length;
  const maks = Math.max(1, ...laju.map(h => h.jumlah));
  const maksK = Math.max(1, ...laju.map(h => h.kumulatif));
  const tinggi = T - pad.atas - pad.bawah;
  const garis = laju.map((h, i) => `${pad.kiri + lebar * (i + 0.5)},${pad.atas + tinggi - (h.kumulatif / maksK) * tinggi}`).join(' ');
  const totalPeriode = laju.reduce((n, h) => n + h.jumlah, 0);
  return (
    <div className="rounded-xl p-3 sm:p-4" style={kartu}>
      <div className="flex items-center justify-between gap-2 mb-2">
        <p className="text-[12.5px] font-semibold text-slate-700 flex items-center gap-1.5"><ListChecks size={14} className="text-slate-500" />Laju Penyelesaian Harian</p>
        <p className="text-[11px] font-bold flex items-center gap-3" style={{ color: TEMA.samar }}>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: TEMA.warna }} />Item/hari</span>
          <span className="flex items-center gap-1"><span className="w-3 h-0.5" style={{ background: TEMA.selesai }} />Kumulatif</span>
        </p>
      </div>
      <svg viewBox={`0 0 ${L} ${T}`} className="w-full h-36 sm:h-44" preserveAspectRatio="none" role="img" aria-label={`${totalPeriode} item selesai dalam ${laju.length} hari`}>
        {laju.map((h, i) => {
          const t = (h.jumlah / maks) * tinggi;
          return (
            <rect key={h.tanggal} x={pad.kiri + lebar * i + lebar * 0.15} y={pad.atas + tinggi - t} width={lebar * 0.7} height={Math.max(t, h.jumlah ? 1 : 0)} rx="1.5" fill={TEMA.warna} opacity={0.85}>
              <title>{`${fmtTgl(h.tanggal)}: ${h.jumlah} item · total ${h.kumulatif}`}</title>
            </rect>
          );
        })}
        <polyline points={garis} fill="none" stroke={TEMA.selesai} strokeWidth="2" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="flex justify-between text-[10.5px] font-semibold mt-1" style={{ color: TEMA.samar }}>
        <span>{fmtTgl(laju[0].tanggal)}</span>
        <span style={fontAngka}>{totalPeriode} item dalam {laju.length} hari</span>
        <span>{fmtTgl(laju[laju.length - 1].tanggal)}</span>
      </div>
    </div>
  );
}

const PALET = ['#2563eb', '#0891b2', '#7c3aed', '#db2777', '#ea580c', '#16a34a', '#64748b', '#ca8a04'];
const berwarna = (d: { label: string; value: number }[]) => d.map((x, i) => ({ ...x, color: PALET[i % PALET.length] }));
const pieOrang = (o: Kontribusi[]) => berwarna(o.map(x => ({ label: x.nama, value: x.jumlah })));
const pie = (data: { label: string; value: number; color: string }[]) => data.filter(d => d.value > 0);

/** Donat "Dikerjakan Oleh" - handler (anggota checklist) saja. */
function DikerjakanOleh({ orang }: { orang: Kontribusi[] }) {
  return <MiniPieChart title="Dikerjakan Oleh (Handler)" icon="👷" data={pieOrang(orang)} />;
}

/** Bungkus yang bisa dilipat - untuk halaman kerja (checklist) supaya ringkasan tidak menghalangi. */
export function LipatRingkasan({ children, hpTerlipat = false }: { children: React.ReactNode; hpTerlipat?: boolean }) {
  //  Dipasang sesudah data termuat di peramban (bukan saat render server), jadi window tersedia.
  const [buka, setBuka] = useState(() => !hpTerlipat || typeof window === 'undefined' || window.matchMedia('(min-width: 768px)').matches);
  return (
    <div className="space-y-3">
      <button type="button" onClick={() => setBuka(v => !v)} aria-expanded={buka}
        className="w-full flex items-center gap-2 rounded-xl px-4 py-2.5 text-left" style={kartu}>
        <BarChart3 size={15} style={{ color: TEMA.warna }} />
        <span className="text-[12px] font-bold uppercase tracking-wider flex-1" style={{ color: NETRAL.tinta2 }}>Ringkasan</span>
        <ChevronDown size={16} className="transition-transform" style={{ color: TEMA.samar, transform: buka ? 'none' : 'rotate(-90deg)' }} />
      </button>
      {buka && children}
    </div>
  );
}

/** Detail proyek & link View-Only. Progres per lokasi ada di kartu lokasi di bawahnya. */
export function RingkasanProyek({ r }: { r: Ringkasan }) {
  const tenggat = pie([
    { label: 'Aman', value: r.perTenggat.aman, color: TEMA.warna },
    { label: '≤ 3 hari lagi', value: r.perTenggat.dekat, color: '#d97706' },
    { label: 'Terlambat', value: r.perTenggat.terlambat, color: TEMA.bahaya },
    { label: 'Tanpa target', value: r.perTenggat.tanpa, color: '#cbd5e1' },
  ]);
  return (
    <div className="space-y-3">
      <div className="grid gap-3 lg:grid-cols-[minmax(280px,1fr)_minmax(0,2.2fr)] items-stretch">
        <KartuProgres persen={r.persen} stat={r.total} w={r} />
        <div className="grid grid-cols-2 xl:grid-cols-3 gap-2.5 content-start">
          <MiniPieChart title="Status Lokasi" icon="📍" data={pie([
            { label: 'Selesai', value: r.perStatus.selesai, color: TEMA.selesai },
            { label: 'Berjalan', value: r.perStatus.berjalan, color: TEMA.warna },
            { label: 'Belum mulai', value: r.perStatus.belum, color: '#94a3b8' },
            { label: 'Belum ada item', value: r.perStatus.kosong, color: '#e2e8f0' },
          ])} />
          {tenggat.length > 0 && <MiniPieChart title="Tenggat Lokasi Berjalan" icon="🗓️" data={tenggat} />}
          {r.perOrang.length > 0 && <DikerjakanOleh orang={r.perOrang} />}
        </div>
      </div>
      {r.laju.length > 1 && <GrafikLaju laju={r.laju} />}
    </div>
  );
}

/** Tampilan depan: hanya yang belum tampil di kartu filter & daftar proyek. */
export function RingkasanDaftarProyek({ r }: { r: RingkasanDaftar }) {
  return (
    <div className="grid grid-cols-2 xl:grid-cols-3 gap-2.5">
      <MiniPieChart title="Item Checklist Semua Proyek" icon="✅" data={pie([
        { label: 'Selesai', value: r.item.selesai, color: TEMA.selesai },
        { label: 'Kendala', value: r.item.kendala, color: TEMA.kendala },
        { label: 'Belum', value: r.item.total - r.item.selesai - r.item.kendala, color: '#cbd5e1' },
      ])} />
      <MiniPieChart title="Proyek per Divisi" icon="🏢" data={berwarna(r.perDivisi)} />
      <div className="col-span-2 xl:col-span-1">
        <MiniPieChart title="Proyek per Sales" icon="🤝" data={berwarna(r.perSales)} />
      </div>
    </div>
  );
}

/** Ada isi yang layak ditampilkan untuk satu checklist (progres & kendala sudah di header halaman). */
export function adaRingkasanChecklist(r: DataChecklist): boolean {
  return r.hariBerjalan !== null || r.sisaHari !== null || r.perOrang.length > 0 || r.laju.length > 1;
}

/** Satu lokasi (detail checklist & link checklist tim): waktu, handler, laju harian. */
export function RingkasanChecklist({ r }: { r: DataChecklist }) {
  const adaWaktu = r.hariBerjalan !== null || r.sisaHari !== null;
  return (
    <div className="space-y-3">
      {(adaWaktu || r.perOrang.length > 0) && (
        <div className={`grid gap-3 ${adaWaktu && r.perOrang.length ? 'md:grid-cols-2' : ''}`}>
          {adaWaktu && <div className="rounded-xl p-4" style={kartu}><BlokWaktu w={r} persen={r.persen} /></div>}
          {r.perOrang.length > 0 && <DikerjakanOleh orang={r.perOrang} />}
        </div>
      )}
      {r.laju.length > 1 && <GrafikLaju laju={r.laju} />}
    </div>
  );
}
