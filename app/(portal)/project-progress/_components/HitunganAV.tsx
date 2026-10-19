'use client';

/**
 * Hasil Kalkulator AV yang disimpan ke proyek ini (tools_av_hasil, migrasi 055) - dari tombol
 * "Simpan ke proyek" di AV Solution Tools. Tiap hasil bisa dicetak ulang (lembar A4), diunduh PNG,
 * ringkasannya disalin, dan dihapus oleh pembuatnya / admin.
 */
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Calculator, Copy, Download, Printer, Trash2 } from 'lucide-react';
import { ConfirmDialog, type ConfirmState } from '@/components/shared';
import { NETRAL } from '@/lib/desain';
import { bukaCetak, namaBerkas, unduhLembarPNG, type Lembar } from '@/lib/lembar-cetak';
import { formatWaktu } from '@/lib/checklist';
import { TEMA } from './tampilan';

interface HasilAV {
  id: string; judul: string; catatan: string; ringkasan: string; lembar: Lembar;
  dibuat_oleh_nama: string; created_at: string; bolehHapus: boolean;
}

const tombol = 'inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11.5px] font-bold hover:bg-slate-100';

export function HitunganAV({ proyekId, beritahu }: { proyekId: string; beritahu: (type: 'success' | 'error', msg: string) => void }) {
  const [hasil, setHasil] = useState<HasilAV[] | null>(null);
  const [galat, setGalat] = useState('');
  const [konfirmasi, setKonfirmasi] = useState<ConfirmState | null>(null);

  const muat = useCallback(async () => {
    try {
      const r = await fetch(`/api/tools-team/hasil-av?proyek=${proyekId}`, { cache: 'no-store' });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setGalat(j.error || 'Gagal memuat.'); setHasil([]); return; }
      setHasil(j.hasil as HasilAV[]); setGalat('');
    } catch { setGalat('Gagal memuat.'); setHasil([]); }
  }, [proyekId]);
  useEffect(() => { void muat(); }, [muat]);

  const hapus = (h: HasilAV) => setKonfirmasi({
    message: `Hapus "${h.judul}"?`, description: 'Hasil kalkulator ini dihapus dari proyek.', confirmLabel: 'Hapus', danger: true,
    onConfirm: async () => {
      setKonfirmasi(null);
      const r = await fetch(`/api/tools-team/hasil-av?id=${h.id}`, { method: 'DELETE' });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) beritahu('error', j.error || 'Gagal menghapus.');
      else { setHasil(x => (x ?? []).filter(y => y.id !== h.id)); beritahu('success', 'Hasil dihapus.'); }
    },
  });

  const salin = async (h: HasilAV) => {
    try { await navigator.clipboard.writeText(h.ringkasan); beritahu('success', 'Ringkasan disalin.'); } catch { beritahu('error', 'Gagal menyalin.'); }
  };

  return (
    <div className="rounded-xl shadow-xs overflow-hidden" style={{ background: NETRAL.permukaan, border: `1px solid ${NETRAL.garis}` }}>
      <div className="flex items-center gap-2 px-4 py-2.5" style={{ borderBottom: hasil?.length ? `1px solid ${NETRAL.garis}` : undefined }}>
        <Calculator size={14} style={{ color: TEMA.samar }} />
        <p className="text-[12px] font-bold uppercase tracking-wider flex-1" style={{ color: NETRAL.tinta2 }}>
          Hitungan AV{hasil?.length ? ` · ${hasil.length}` : ''}
        </p>
        <Link href="/tools-team?alat=av" className="text-[12px] font-bold" style={{ color: TEMA.warna }}>Buka Kalkulator AV</Link>
      </div>
      {hasil === null && <p className="px-4 py-3 text-[12px]" style={{ color: TEMA.samar }}>Memuat…</p>}
      {galat && <p className="px-4 py-3 text-[12px] font-semibold" style={{ color: TEMA.bahaya }}>{galat}</p>}
      {hasil && !galat && hasil.length === 0 && (
        <p className="px-4 pb-3 text-[12px]" style={{ color: TEMA.samar }}>
          Belum ada. Di Kalkulator AV, tekan <b>Simpan ke proyek</b> pada hasil hitungan untuk menyimpannya di sini.
        </p>
      )}
      {hasil && hasil.length > 0 && (
        <ul className="divide-y" style={{ borderColor: NETRAL.garis }}>
          {hasil.map(h => (
            <li key={h.id} className="px-4 py-2.5 space-y-1">
              <div className="flex items-start gap-2 flex-wrap">
                <div className="flex-1 min-w-[200px]">
                  <p className="text-[13.5px] font-bold" style={{ color: NETRAL.tinta }}>{h.judul}</p>
                  <p className="text-[11.5px]" style={{ color: TEMA.samar }}>
                    {h.dibuat_oleh_nama || 'Tim'} · {formatWaktu(h.created_at)}{h.catatan ? ` · ${h.catatan}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-0.5" style={{ color: NETRAL.tinta2 }}>
                  <button type="button" className={tombol} onClick={() => bukaCetak(h.lembar)} title="Cetak lembar A4"><Printer size={13} />Cetak</button>
                  <button type="button" className={tombol} onClick={() => void unduhLembarPNG(h.lembar, namaBerkas(h.judul))} title="Unduh PNG"><Download size={13} />PNG</button>
                  {h.ringkasan && <button type="button" className={tombol} onClick={() => void salin(h)} title="Salin ringkasan"><Copy size={13} />Salin</button>}
                  {h.bolehHapus && (
                    <button type="button" className={tombol} onClick={() => hapus(h)} aria-label={`Hapus ${h.judul}`} title="Hapus" style={{ color: TEMA.bahaya }}><Trash2 size={13} /></button>
                  )}
                </div>
              </div>
              {h.ringkasan && (
                <p className="text-[12px] whitespace-pre-line line-clamp-3" style={{ color: NETRAL.tinta2 }}>{h.ringkasan.replace(/\*/g, '')}</p>
              )}
            </li>
          ))}
        </ul>
      )}
      <ConfirmDialog state={konfirmasi} onCancel={() => setKonfirmasi(null)} />
    </div>
  );
}
