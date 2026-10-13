'use client';

/**
 * Detail satu lokasi di link View-Only: panel geser dari kanan (desktop) / lembar dari bawah (HP),
 * bukan kartu yang memanjang ke bawah. Daftar lokasi tetap terlihat di belakangnya, dan ‹ › pindah
 * ke lokasi sebelah tanpa menutup panel. Esc ditangani PenjagaDialog lewat tombol "Tutup".
 */
import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, MapPin, X } from 'lucide-react';
import { NETRAL } from '@/lib/desain';
import type { ChecklistBagian, ChecklistItem } from '@/lib/checklist';
import { BarProgres, CatatanTeks, KepingKendala, PanelBagian, TEMA, itemPerBagian, progresDariStat } from '@/app/(portal)/project-progress/_components/tampilan';
import type { RingkasLokasi } from '@/app/(portal)/project-progress/_components/ringkasan/hitung';

const DURASI = 220;

export function PanelLokasi({ lokasi, keterangan, bagian, items, urutan, jumlah, onPindah, onTutup }: {
  lokasi: RingkasLokasi; keterangan: string;
  bagian: ChecklistBagian[]; items: ChecklistItem[];
  urutan: number; jumlah: number;
  onPindah: (arah: -1 | 1) => void; onTutup: () => void;
}) {
  const [masuk, setMasuk] = useState(false);
  //  Desktop: geser dari kanan. HP: naik dari bawah. Panel baru dipasang sesudah diklik, jadi window ada.
  const [geser] = useState(() => window.matchMedia('(min-width: 768px)').matches ? 'translate3d(100%,0,0)' : 'translate3d(0,100%,0)');

  useEffect(() => {
    const id = requestAnimationFrame(() => setMasuk(true));
    const lama = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { cancelAnimationFrame(id); document.body.style.overflow = lama; };
  }, []);

  const tutup = () => { setMasuk(false); window.setTimeout(onTutup, DURASI); };
  const peta = itemPerBagian(bagian, items);
  const warnaJadwal = lokasi.jadwal === 'terlambat' ? TEMA.bahaya : lokasi.jadwal === 'selesai' ? TEMA.selesai : TEMA.samar;

  return (
    <div className="fixed inset-0 z-[1000]" role="dialog" aria-modal="true" aria-label={lokasi.judul}>
      <div className="absolute inset-0 bg-slate-900/40" onClick={tutup}
        style={{ opacity: masuk ? 1 : 0, transition: `opacity ${DURASI}ms ease` }} />

      <aside
        className="absolute flex flex-col overflow-hidden shadow-2xl inset-x-0 bottom-0 h-[92dvh] rounded-t-2xl md:inset-y-0 md:left-auto md:right-0 md:h-full md:w-[min(760px,60vw)] md:rounded-none md:rounded-l-2xl"
        style={{
          background: 'var(--halaman, #f3f5f8)',
          transform: masuk ? 'none' : geser,
          transition: `transform ${DURASI}ms cubic-bezier(.2,.8,.2,1)`,
        }}
      >
        <div className="md:hidden flex justify-center pt-2"><span className="w-10 h-1 rounded-full bg-slate-300" /></div>

        <header className="px-4 sm:px-5 py-3 space-y-2" style={{ background: NETRAL.permukaan, borderBottom: `1px solid ${NETRAL.garis}` }}>
          <div className="flex items-center gap-2">
            <MapPin size={16} className="flex-shrink-0" style={{ color: TEMA.warna }} />
            <h2 className="font-bold text-[15px] flex-1 min-w-0 truncate" style={{ color: NETRAL.tinta }}>{lokasi.judul}</h2>
            <KepingKendala jumlah={lokasi.stat.kendala} />
            <span className="text-[11px] font-semibold tabular-nums" style={{ color: TEMA.samar }}>{urutan + 1}/{jumlah}</span>
            <button type="button" onClick={() => onPindah(-1)} disabled={urutan === 0} aria-label="Lokasi sebelumnya" title="Sebelumnya"
              className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-30"><ChevronLeft size={18} /></button>
            <button type="button" onClick={() => onPindah(1)} disabled={urutan >= jumlah - 1} aria-label="Lokasi berikutnya" title="Berikutnya"
              className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-30"><ChevronRight size={18} /></button>
            <button type="button" onClick={tutup} aria-label="Tutup" title="Tutup"
              className="p-1.5 rounded-lg hover:bg-slate-100"><X size={18} /></button>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              {lokasi.stat.total > 0
                ? <BarProgres progres={progresDariStat(lokasi.stat)} tebal={8} />
                : <span className="text-[12px]" style={{ color: TEMA.samar }}>Belum ada item</span>}
            </div>
            <span className="text-[12px] font-bold whitespace-nowrap" style={{ color: warnaJadwal }}>{lokasi.labelJadwal}</span>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto overscroll-contain p-3 sm:p-4 space-y-2.5">
          {keterangan && <CatatanTeks teks={keterangan} />}
          {bagian.length === 0 && <p className="py-10 text-center text-[13px]" style={{ color: TEMA.samar }}>Belum ada checklist.</p>}
          {bagian.map(b => (
            <PanelBagian key={b.id} bagian={b} items={peta.get(b.id) ?? []} sedangId={null} aksi={{}} terbukaAwal={bagian.length <= 3} />
          ))}
        </div>
      </aside>
    </div>
  );
}
