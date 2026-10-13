'use client';

/**
 * Ringkasan & grafik Project Progress - satu tampilan untuk semua tempat: daftar proyek, detail
 * proyek, checklist lokasi, link View-Only, dan link checklist tim. Angka dari ./hitung.ts.
 */
import { useState } from 'react';
import { AlertTriangle, BarChart3, CalendarClock, CheckCircle2, ChevronDown, Layers, ListChecks, MapPin, Timer } from 'lucide-react';
import { MiniPieChart } from '@/components/shared';
import { NETRAL } from '@/lib/desain';
import { STATUS_PROYEK } from '@/lib/checklist';
import { TEMA, fontAngka } from '../tampilan';
import type { Ringkasan, RingkasanChecklist as DataChecklist, RingkasanDaftar, TitikLaju } from './hitung';

const kartu = { background: NETRAL.permukaan, border: `1px solid ${NETRAL.garis}`, boxShadow: '0 1px 2px rgba(15,23,42,0.04)' };

function Cincin({ persen }: { persen: number }) {
  const r = 42, k = 2 * Math.PI * r;
  const warna = persen >= 100 ? TEMA.selesai : TEMA.warna;
  return (
    <svg viewBox="0 0 100 100" className="w-28 h-28 sm:w-32 sm:h-32 flex-shrink-0" role="img" aria-label={`Progres ${persen}%`}>
      <circle cx="50" cy="50" r={r} fill="none" stroke={NETRAL.garis} strokeWidth="9" />
      <circle cx="50" cy="50" r={r} fill="none" stroke={warna} strokeWidth="9" strokeLinecap="round"
        strokeDasharray={`${(persen / 100) * k} ${k}`} transform="rotate(-90 50 50)" style={{ transition: 'stroke-dasharray .6s' }} />
      <text x="50" y="50" textAnchor="middle" dominantBaseline="central" fontSize="22" fontWeight="800" fill={NETRAL.tinta} style={fontAngka}>{persen}%</text>
    </svg>
  );
}

function Kpi({ ikon, label, nilai, sub, warna }: { ikon: React.ReactNode; label: string; nilai: string; sub?: string; warna?: string }) {
  return (
    <div className="rounded-xl px-3 py-2.5 min-w-0" style={{ background: NETRAL.permukaanRedam, border: `1px solid ${NETRAL.garis}` }}>
      <p className="text-[10.5px] font-bold uppercase tracking-wide flex items-center gap-1.5 truncate" style={{ color: TEMA.samar }}>{ikon}{label}</p>
      <p className="text-[19px] font-extrabold leading-tight mt-0.5" style={{ ...fontAngka, color: warna ?? NETRAL.tinta }}>{nilai}</p>
      {sub && <p className="text-[11px] font-semibold truncate" style={{ color: TEMA.samar }}>{sub}</p>}
    </div>
  );
}

function Meter({ label, persen, warna }: { label: string; persen: number; warna: string }) {
  return (
    <div>
      <div className="flex justify-between text-[11px] font-bold mb-1">
        <span className="uppercase tracking-wide" style={{ color: TEMA.samar }}>{label}</span>
        <span style={{ ...fontAngka, color: warna }}>{persen}%</span>
      </div>
      <div className="h-2 rounded-full overflow-hidden" style={{ background: NETRAL.garis }}>
        <div className="h-full rounded-full" style={{ width: `${persen}%`, background: warna, transition: 'width .6s' }} />
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

const WARNA_ORANG = ['#2563eb', '#0891b2', '#7c3aed', '#db2777', '#ea580c', '#16a34a', '#64748b'];
const pieOrang = (o: { nama: string; jumlah: number }[]) => o.map((x, i) => ({ label: x.nama, value: x.jumlah, color: WARNA_ORANG[i % WARNA_ORANG.length] }));
const warnaPersen = (p: number) => (p >= 100 ? TEMA.selesai : p >= 50 ? TEMA.warna : p > 0 ? '#d97706' : '#94a3b8');
const pie = (data: { label: string; value: number; color: string }[]) => data.filter(d => d.value > 0);

function WaktuVsPekerjaan({ waktuPersen, persen }: { waktuPersen: number | null; persen: number }) {
  if (waktuPersen === null) return null;
  const sesuai = persen >= waktuPersen;
  return (
    <div className="rounded-xl p-4 space-y-2.5" style={kartu}>
      <Meter label="Waktu terpakai" persen={waktuPersen} warna={TEMA.samar} />
      <Meter label="Pekerjaan selesai" persen={persen} warna={persen >= 100 ? TEMA.selesai : TEMA.warna} />
      <p className="text-[12px] font-bold" style={{ color: sesuai ? TEMA.selesai : TEMA.kendala }}>
        {persen >= 100 ? 'Seluruh pekerjaan selesai'
          : sesuai ? `Sesuai jadwal · pekerjaan ${persen - waktuPersen}% di depan waktu`
          : `Tertinggal ${waktuPersen - persen}% dari jadwal`}
      </p>
    </div>
  );
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

export function RingkasanProyek({ r }: { r: Ringkasan }) {
  const nLokasi = r.lokasi.length;
  return (
    <div className="space-y-3">
      <div className="rounded-xl p-4 flex flex-col sm:flex-row gap-4 items-center" style={kartu}>
        <Cincin persen={r.persen} />
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 w-full">
          <Kpi ikon={<MapPin size={12} />} label="Lokasi selesai" nilai={`${r.lokasiSelesai}/${nLokasi}`} warna={r.lokasiSelesai === nLokasi && nLokasi ? TEMA.selesai : undefined} />
          <Kpi ikon={<CheckCircle2 size={12} />} label="Item selesai" nilai={`${r.total.selesai}/${r.total.total}`} />
          <Kpi ikon={<AlertTriangle size={12} />} label="Kendala aktif" nilai={String(r.total.kendala)} warna={r.total.kendala ? TEMA.kendala : undefined} />
          <Kpi ikon={<CalendarClock size={12} />} label="Lokasi terlambat" nilai={String(r.lokasiTerlambat)} warna={r.lokasiTerlambat ? TEMA.bahaya : undefined} />
          <Kpi ikon={<Timer size={12} />} label="Hari berjalan" nilai={r.hariBerjalan === null ? '-' : String(r.hariBerjalan)} />
          <Kpi ikon={<Timer size={12} />} label="Sisa waktu" nilai={r.sisaHari === null ? '-' : r.sisaHari < 0 ? `+${-r.sisaHari}` : String(r.sisaHari)}
            sub={r.sisaHari === null ? undefined : r.sisaHari < 0 ? 'hari lewat target' : 'hari ke target'} warna={r.sisaHari !== null && r.sisaHari < 0 && r.persen < 100 ? TEMA.bahaya : undefined} />
        </div>
      </div>

      <WaktuVsPekerjaan waktuPersen={r.waktuPersen} persen={r.persen} />

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-2.5">
        <MiniPieChart title="Status Lokasi" icon="📍" data={pie([
          { label: 'Selesai', value: r.perStatus.selesai, color: TEMA.selesai },
          { label: 'Berjalan', value: r.perStatus.berjalan, color: TEMA.warna },
          { label: 'Belum mulai', value: r.perStatus.belum, color: '#94a3b8' },
          { label: 'Belum ada item', value: r.perStatus.kosong, color: '#e2e8f0' },
        ])} />
        <MiniPieChart title="Jadwal Lokasi" icon="🗓️" data={pie([
          { label: 'Selesai', value: r.perJadwal.selesai, color: TEMA.selesai },
          { label: 'Aman', value: r.perJadwal.aman, color: TEMA.warna },
          { label: '≤ 3 hari lagi', value: r.perJadwal.dekat, color: '#d97706' },
          { label: 'Terlambat', value: r.perJadwal.terlambat, color: TEMA.bahaya },
          { label: 'Tanpa target', value: r.perJadwal.tanpa, color: '#cbd5e1' },
        ])} />
        <MiniPieChart title="Item Checklist" icon="✅" data={pie([
          { label: 'Selesai', value: r.total.selesai, color: TEMA.selesai },
          { label: 'Kendala', value: r.total.kendala, color: TEMA.kendala },
          { label: 'Belum', value: r.total.total - r.total.selesai - r.total.kendala, color: '#cbd5e1' },
        ])} />
        {r.perOrang.length > 0
          ? <MiniPieChart title="Dikerjakan Oleh" icon="👷" data={pieOrang(r.perOrang)} />
          : <MiniPieChart title="Progres per Lokasi" icon="📊" valueSuffix="%" data={r.lokasi.filter(l => l.stat.total > 0).map(l => ({ label: l.judul, value: l.persen, color: warnaPersen(l.persen) }))} />}
      </div>

      {r.laju.length > 1 && <GrafikLaju laju={r.laju} />}
    </div>
  );
}

/** Tampilan depan: komposisi seluruh proyek (kartu angka sudah ada di atasnya). */
export function RingkasanDaftarProyek({ r }: { r: RingkasanDaftar }) {
  return (
    <div className="grid grid-cols-2 xl:grid-cols-4 gap-2.5">
      <MiniPieChart title="Status Proyek" icon="🗂️" data={pie((Object.keys(STATUS_PROYEK) as (keyof typeof STATUS_PROYEK)[]).map(k => ({
        label: STATUS_PROYEK[k].label, value: r.perStatus[k], color: k === 'done' ? TEMA.selesai : k === 'blocked' ? TEMA.bahaya : TEMA.warna,
      })))} />
      <MiniPieChart title="Jadwal Proyek" icon="🗓️" data={pie([
        { label: 'Selesai', value: r.perJadwal.selesai, color: TEMA.selesai },
        { label: 'Aman', value: r.perJadwal.aman, color: TEMA.warna },
        { label: '≤ 3 hari lagi', value: r.perJadwal.dekat, color: '#d97706' },
        { label: 'Terlambat', value: r.perJadwal.terlambat, color: TEMA.bahaya },
        { label: 'Tanpa target', value: r.perJadwal.tanpa, color: '#cbd5e1' },
      ])} />
      <MiniPieChart title="Item Checklist" icon="✅" data={pie([
        { label: 'Selesai', value: r.item.selesai, color: TEMA.selesai },
        { label: 'Kendala', value: r.item.kendala, color: TEMA.kendala },
        { label: 'Belum', value: r.item.total - r.item.selesai - r.item.kendala, color: '#cbd5e1' },
      ])} />
      <MiniPieChart title="Progres Proyek Berjalan" icon="📊" valueSuffix="%" data={r.progres.map(p => ({ ...p, color: warnaPersen(p.value) }))} />
    </div>
  );
}

/** Satu lokasi (detail checklist & link checklist tim). */
export function RingkasanChecklist({ r }: { r: DataChecklist }) {
  return (
    <div className="space-y-3">
      <div className="rounded-xl p-4 flex flex-col sm:flex-row gap-4 items-center" style={kartu}>
        <Cincin persen={r.persen} />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 w-full">
          <Kpi ikon={<CheckCircle2 size={12} />} label="Item selesai" nilai={`${r.total.selesai}/${r.total.total}`} warna={r.persen === 100 ? TEMA.selesai : undefined} />
          <Kpi ikon={<Layers size={12} />} label="Bagian selesai" nilai={`${r.bagianSelesai}/${r.jumlahBagian}`} />
          <Kpi ikon={<AlertTriangle size={12} />} label="Kendala aktif" nilai={String(r.total.kendala)} warna={r.total.kendala ? TEMA.kendala : undefined} />
          <Kpi ikon={<Timer size={12} />} label="Sisa waktu" nilai={r.sisaHari === null ? '-' : r.sisaHari < 0 ? `+${-r.sisaHari}` : String(r.sisaHari)}
            sub={r.sisaHari === null ? undefined : r.sisaHari < 0 ? 'hari lewat target' : 'hari ke target'} warna={r.sisaHari !== null && r.sisaHari < 0 && r.persen < 100 ? TEMA.bahaya : undefined} />
        </div>
      </div>
      <WaktuVsPekerjaan waktuPersen={r.waktuPersen} persen={r.persen} />
      <div className="grid grid-cols-2 xl:grid-cols-3 gap-2.5">
        <MiniPieChart title="Item Checklist" icon="✅" data={pie([
          { label: 'Selesai', value: r.total.selesai, color: TEMA.selesai },
          { label: 'Kendala', value: r.total.kendala, color: TEMA.kendala },
          { label: 'Belum', value: r.total.total - r.total.selesai - r.total.kendala, color: '#cbd5e1' },
        ])} />
        <MiniPieChart title="Progres per Bagian" icon="📊" valueSuffix="%" data={r.perBagian.map(b => ({ ...b, color: warnaPersen(b.value) }))} />
        <div className="col-span-2 xl:col-span-1">
          <MiniPieChart title="Dikerjakan Oleh" icon="👷" data={pieOrang(r.perOrang)} />
        </div>
      </div>
      {r.laju.length > 1 && <GrafikLaju laju={r.laju} />}
    </div>
  );
}
