'use client';

import { ChevronLeft, ChevronRight, ImageIcon } from 'lucide-react';
import { NETRAL } from '@/lib/desain';
import { formatWaktu } from '@/lib/checklist/inti';
import {
  PRIORITAS_ISU, STATUS_ISU, dariTiket, geserTanggal, kodeIsu, hariIni, labelHari, labelStatusPada, labelTanggalLengkap, labelTanggalPendek, peranPada, tanggalSelesai, umurIsu,
  type BarisKota, type Isu, type PrioritasIsu, type RiwayatIsu, type StatusIsu,
} from '@/lib/isu/inti';
import { TEMA, fontAngka } from '../tampilan';

export function KepingStatus({ status, label }: { status: StatusIsu; label?: string }) {
  const s = STATUS_ISU[status];
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold whitespace-nowrap"
      style={{ background: s.tint, color: s.warna, border: `1px solid ${s.garis}` }}>
      {label ?? s.label}
    </span>
  );
}

export function KepingPrioritas({ p }: { p: PrioritasIsu }) {
  if (p === 'sedang') return null;
  const x = PRIORITAS_ISU[p];
  return <span className="text-[10.5px] font-bold uppercase tracking-wide" style={{ color: x.warna }}>{p === 'tinggi' ? '▲ ' : ''}{x.label}</span>;
}

export function KodeIsu({ isu }: { isu: Isu }) {
  if (dariTiket(isu)) {
    return <span className="px-1.5 py-0.5 rounded-sm text-[10.5px] font-bold whitespace-nowrap" style={{ background: '#fef2f2', color: '#b91c1c' }} title="Otomatis dari Ticket Troubleshooting">🎫 Tiket</span>;
  }
  return <span className="text-[11.5px] font-bold" style={{ ...fontAngka, color: TEMA.samar }}>{kodeIsu(isu)}</span>;
}

const PERAN = {
  baru: { label: 'Baru', warna: '#7c3aed', tint: '#f5f3ff' },
  selesai: { label: 'Solved hari ini', warna: '#15803d', tint: '#f0fdf4' },
  lanjutan: { label: 'Lanjutan', warna: '#475569', tint: '#f1f5f9' },
} as const;

export function KepingPeran({ isu, tanggal }: { isu: Isu; tanggal: string }) {
  const p = peranPada(isu, tanggal);
  if (!p) return null;
  const x = PERAN[p];
  const teks = p === 'lanjutan' ? `Hari ke-${umurIsu(isu, tanggal) + 1}` : x.label;
  return <span className="px-1.5 py-0.5 rounded-sm text-[10.5px] font-bold whitespace-nowrap" style={{ background: x.tint, color: x.warna }}>{teks}</span>;
}

export function NavTanggal({ tanggal, onUbah }: { tanggal: string; onUbah: (t: string) => void }) {
  const hari = hariIni();
  const tombol = 'w-8 h-8 inline-flex items-center justify-center rounded-lg disabled:opacity-40';
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <button type="button" className={tombol} style={{ border: `1px solid ${NETRAL.garis}`, color: NETRAL.tinta2 }}
        onClick={() => onUbah(geserTanggal(tanggal, -1))} aria-label="Hari sebelumnya"><ChevronLeft size={16} /></button>
      <input type="date" value={tanggal} max={hari} aria-label="Tanggal ringkasan"
        onChange={e => e.target.value && onUbah(e.target.value > hari ? hari : e.target.value)}
        className="rounded-lg px-2.5 py-1.5 text-[13px] font-semibold" style={{ border: `1px solid ${NETRAL.garis}`, color: NETRAL.tinta, background: NETRAL.permukaan }} />
      <button type="button" className={tombol} style={{ border: `1px solid ${NETRAL.garis}`, color: NETRAL.tinta2 }} disabled={tanggal >= hari}
        onClick={() => onUbah(geserTanggal(tanggal, 1))} aria-label="Hari berikutnya"><ChevronRight size={16} /></button>
      {tanggal !== hari && (
        <button type="button" onClick={() => onUbah(hari)} className="px-2.5 py-1.5 rounded-lg text-[12px] font-bold" style={{ color: TEMA.warna }}>Hari ini</button>
      )}
      <span className="text-[12.5px] font-semibold ml-1" style={{ color: NETRAL.tinta2 }}>{labelHari(tanggal)}</span>
    </div>
  );
}

export function TabelKota({ kota, tanggal, onBuka }: { kota: BarisKota[]; tanggal: string; onBuka: (i: Isu) => void }) {
  if (!kota.length) {
    return <p className="px-4 py-8 text-center text-[13px]" style={{ color: TEMA.samar }}>Tidak ada isu tercatat atau terbuka di tanggal ini.</p>;
  }
  return (
    <ul className="divide-y" style={{ borderColor: NETRAL.garis }}>
      {kota.map(k => (
        <li key={k.lokasi} className="px-3 sm:px-4 py-3 flex flex-col md:flex-row gap-2 md:gap-4">
          <div className="md:w-[220px] shrink-0">
            <p className="text-[13.5px] font-bold" style={{ color: NETRAL.tinta }}>{k.lokasi}</p>
            <p className="text-[11.5px] font-semibold mt-0.5 flex gap-2 flex-wrap" style={fontAngka}>
              {k.baru > 0 && <span style={{ color: PERAN.baru.warna }}>{k.baru} baru</span>}
              {k.selesai > 0 && <span style={{ color: TEMA.selesai }}>{k.selesai} solved</span>}
              <span style={{ color: k.terbuka ? TEMA.bahaya : TEMA.samar }}>{k.terbuka} terbuka</span>
            </p>
          </div>
          <ul className="flex-1 min-w-0 space-y-1.5">
            {k.isu.map(i => (
              <li key={i.id}>
                <button type="button" onClick={() => onBuka(i)} className="w-full text-left rounded-lg px-2.5 py-1.5 hover:bg-slate-50 transition-colors"
                  style={{ border: `1px solid ${NETRAL.garis}` }}>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <KodeIsu isu={i} />
                    <span className="text-[13px] font-semibold" style={{ color: NETRAL.tinta }}>{i.judul}</span>
                    <KepingStatus status={peranPada(i, tanggal) === 'selesai' ? 'solved' : i.status} label={labelStatusPada(i, tanggal)} />
                    <KepingPeran isu={i} tanggal={tanggal} />
                  </div>
                  {(i.action || (i.status === 'solved' && i.solusi)) && (
                    <p className="text-[12px] mt-0.5 line-clamp-2" style={{ color: NETRAL.tinta2 }}>
                      <b>{i.status === 'solved' && i.solusi ? 'Solusi' : 'Action'}:</b> {i.status === 'solved' && i.solusi ? i.solusi : i.action}
                      {i.pic ? <span style={{ color: TEMA.samar }}> · PIC {i.pic}</span> : null}
                    </p>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  );
}

export function KepalaDaftarIsu() {
  const sel = 'text-[11px] font-bold uppercase tracking-wide';
  return (
    <div className="hidden md:flex gap-4 px-4 py-2" style={{ background: NETRAL.permukaanRedam, borderBottom: `1px solid ${NETRAL.garis}`, color: TEMA.samar }}>
      <span className={`${sel} w-[120px] shrink-0`}>Tanggal</span>
      <span className={`${sel} w-[160px] shrink-0`}>Lokasi</span>
      <span className={`${sel} flex-1`}>Isu · Action / Solusi</span>
      <span className={`${sel} w-[160px] shrink-0 text-right`}>Status</span>
    </div>
  );
}

export function BarisIsu({ isu, acuan, onBuka }: { isu: Isu; acuan: string; onBuka: () => void }) {
  const selesai = tanggalSelesai(isu);
  const umur = umurIsu(isu, acuan);
  return (
    <li>
      <button type="button" onClick={onBuka}
        className="w-full text-left flex flex-col md:flex-row md:items-start gap-1.5 md:gap-4 px-3 sm:px-4 py-3 hover:bg-slate-50/70 transition-colors">
        <div className="md:w-[120px] shrink-0 flex md:flex-col gap-x-2 gap-y-1 items-center md:items-start flex-wrap">
          <p className="text-[12.5px] font-bold whitespace-nowrap" style={{ ...fontAngka, color: NETRAL.tinta }}>{labelTanggalLengkap(isu.tanggal)}</p>
          <KodeIsu isu={isu} />
        </div>
        <div className="md:w-[160px] shrink-0">
          <p className="text-[12.5px] font-bold truncate" style={{ color: NETRAL.tinta2 }}>{isu.lokasi}</p>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[13.5px] font-semibold" style={{ color: NETRAL.tinta }}>{isu.judul}</span>
            {isu.foto_thumb_url && <ImageIcon size={13} aria-label="Ada foto" style={{ color: TEMA.samar }} />}
            <KepingPrioritas p={isu.prioritas} />
          </div>
          <p className="text-[11.5px] mt-0.5" style={{ color: TEMA.samar }}>
            {[isu.kategori, isu.produk || null, isu.pic ? `PIC ${isu.pic}` : null, isu.pelapor ? `Lapor: ${isu.pelapor}` : null].filter(Boolean).join(' · ')}
          </p>
          {(isu.action || isu.solusi) && (
            <p className="text-[12px] mt-1 line-clamp-2" style={{ color: NETRAL.tinta2 }}>
              <b>{isu.status === 'solved' && isu.solusi ? 'Solusi' : 'Action'}:</b> {isu.status === 'solved' && isu.solusi ? isu.solusi : isu.action}
            </p>
          )}
        </div>
        <div className="md:w-[160px] shrink-0 flex md:flex-col md:items-end gap-1.5 flex-wrap">
          <KepingStatus status={isu.status} />
          <span className="text-[11px] font-semibold" style={{ ...fontAngka, color: umur >= 3 && !selesai ? TEMA.bahaya : TEMA.samar }}>
            {selesai ? `Solved ${labelTanggalPendek(selesai)} · ${umur} hari` : umur === 0 ? 'Dilaporkan hari ini' : `Terbuka ${umur} hari`}
          </span>
        </div>
      </button>
    </li>
  );
}

const LABEL_AKSI: Record<string, string> = { dibuat: 'mencatat isu', status: 'mengubah status', action: 'update action', ubah: 'mengubah data' };

export function TimelineRiwayat({ riwayat }: { riwayat: RiwayatIsu[] | null }) {
  if (!riwayat) return <p className="text-[12px]" style={{ color: TEMA.samar }}>Memuat riwayat…</p>;
  if (!riwayat.length) return <p className="text-[12px]" style={{ color: TEMA.samar }}>Belum ada riwayat.</p>;
  return (
    <ol className="space-y-2.5">
      {[...riwayat].reverse().map(r => {
        const ke = r.ke && r.ke in STATUS_ISU ? (r.ke as StatusIsu) : null;
        return (
          <li key={r.id} className="flex gap-2.5">
            <span className="mt-1.5 w-2 h-2 rounded-full shrink-0" style={{ background: ke ? STATUS_ISU[ke].warna : NETRAL.garisKuat }} />
            <div className="min-w-0">
              <p className="text-[12px]" style={{ color: NETRAL.tinta2 }}>
                <b style={{ color: NETRAL.tinta }}>{r.nama || 'Tim'}</b> {LABEL_AKSI[r.aksi] ?? r.aksi}
                {r.aksi === 'status' && r.dari && r.dari in STATUS_ISU && ke && <> {STATUS_ISU[r.dari as StatusIsu].label} → <b>{STATUS_ISU[ke].label}</b></>}
                {r.aksi === 'dibuat' && ke && <> sebagai <b>{STATUS_ISU[ke].label}</b></>}
                <span style={{ color: TEMA.samar }}> · {formatWaktu(r.created_at)}</span>
              </p>
              {r.keterangan && <p className="text-[12.5px] mt-0.5 whitespace-pre-wrap" style={{ color: NETRAL.tinta }}>{r.keterangan}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
