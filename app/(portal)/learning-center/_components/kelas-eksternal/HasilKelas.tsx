'use client';

/** Peserta & nilai satu Kelas Eksternal (nilai terakhir tiap peserta) + unduh CSV. */
import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { Modal, TombolModal } from '@/components/shared';

interface BarisHasil {
  id: string; nama: string; created_at: string; percobaan: number;
  hasil: { mulai_pada: string; selesai_pada: string | null; benar: number | null; jumlah: number | null; skor: number | null; lulus: boolean | null; durasi_detik: number | null; lewat_waktu: boolean } | null;
}

const waktu = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '-');
const durasi = (d: number | null | undefined) => (d == null ? '-' : `${Math.floor(d / 60)}m ${String(d % 60).padStart(2, '0')}d`);

export function HasilKelas({ id, judul, onTutup }: { id: string; judul: string; onTutup: () => void }) {
  const [baris, setBaris] = useState<BarisHasil[] | null>(null);
  const [galat, setGalat] = useState('');

  useEffect(() => {
    let batal = false;
    fetch(`/api/admin/kelas-eksternal?id=${id}`, { cache: 'no-store' })
      .then(r => r.json().then(j => ({ ok: r.ok, j })))
      .then(({ ok, j }) => { if (batal) return; if (!ok) setGalat(j.error || 'Gagal memuat.'); else setBaris(j.peserta); })
      .catch(() => { if (!batal) setGalat('Gagal memuat.'); });
    return () => { batal = true; };
  }, [id]);

  const unduh = () => {
    const kepala = ['Nama', 'Terdaftar', 'Selesai', 'Nilai', 'Benar', 'Jumlah soal', 'Lulus', 'Durasi (detik)', 'Lewat waktu', 'Percobaan'];
    const sel = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const isi = (baris ?? []).map(b => [b.nama, b.created_at, b.hasil?.selesai_pada ?? '', b.hasil?.skor ?? '', b.hasil?.benar ?? '', b.hasil?.jumlah ?? '',
      b.hasil?.selesai_pada ? (b.hasil.lulus ? 'Ya' : 'Tidak') : '', b.hasil?.durasi_detik ?? '', b.hasil?.lewat_waktu ? 'Ya' : '', b.percobaan].map(sel).join(','));
    const blob = new Blob(['﻿' + [kepala.map(sel).join(','), ...isi].join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `Hasil-${judul.replace(/[^\w-]+/g, '-').slice(0, 60)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const selesai = (baris ?? []).filter(b => b.hasil?.selesai_pada);
  const lulus = selesai.filter(b => b.hasil?.lulus).length;

  return (
    <Modal buka onTutup={onTutup} judul={judul} ukuran="xl"
      keterangan={baris ? `${baris.length} peserta · ${selesai.length} selesai · ${lulus} lulus` : undefined}
      footer={<>
        <TombolModal onClick={onTutup}>Tutup</TombolModal>
        <TombolModal jenis="utama" onClick={unduh} disabled={!baris?.length}><Download size={14} className="inline mr-1" />CSV</TombolModal>
      </>}>
      {galat && <p className="text-[13px] font-semibold text-red-700">{galat}</p>}
      {!baris && !galat && <p className="py-8 text-center text-[13px] text-slate-400">Memuat…</p>}
      {baris && baris.length === 0 && <p className="py-8 text-center text-[13px] text-slate-500">Belum ada peserta.</p>}
      {baris && baris.length > 0 && (
        <div className="overflow-x-auto -mx-1">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-200">
                <th className="px-2 py-2">Nama</th><th className="px-2 py-2">Selesai</th><th className="px-2 py-2 text-right">Nilai</th>
                <th className="px-2 py-2 text-right">Benar</th><th className="px-2 py-2">Status</th><th className="px-2 py-2 text-right">Durasi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {[...baris].sort((a, b) => (b.hasil?.skor ?? -1) - (a.hasil?.skor ?? -1)).map(b => (
                <tr key={b.id}>
                  <td className="px-2 py-2 font-semibold text-slate-800">{b.nama}{b.percobaan > 1 && <span className="ml-1.5 text-[11px] font-bold text-slate-400">×{b.percobaan}</span>}</td>
                  <td className="px-2 py-2 text-slate-600 whitespace-nowrap">{b.hasil?.selesai_pada ? waktu(b.hasil.selesai_pada) : b.hasil ? 'Mengerjakan' : 'Belum mulai'}</td>
                  <td className="px-2 py-2 text-right font-bold tabular-nums text-slate-900">{b.hasil?.skor ?? '-'}</td>
                  <td className="px-2 py-2 text-right tabular-nums text-slate-600">{b.hasil?.selesai_pada ? `${b.hasil.benar}/${b.hasil.jumlah}` : '-'}</td>
                  <td className="px-2 py-2">
                    {b.hasil?.selesai_pada && (
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${b.hasil.lulus ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{b.hasil.lulus ? 'Lulus' : 'Belum lulus'}</span>
                    )}
                    {b.hasil?.lewat_waktu && <span className="ml-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-red-50 text-red-700" title="Dikirim melewati batas waktu">Lewat waktu</span>}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums text-slate-600">{durasi(b.hasil?.durasi_detik)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}
