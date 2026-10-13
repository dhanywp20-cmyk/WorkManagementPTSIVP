'use client';

/**
 * Detail lokasi di link View-Only.
 *  - Desktop (>= 1024px): panel lebar hampir layar penuh, dua kolom: kiri daftar semua lokasi untuk
 *    berpindah, kanan isi checklist dengan bagian disusun 2 kolom (layar lebar tidak terbuang).
 *  - Tablet: panel dari kanan tanpa daftar; HP: lembar dari bawah. ‹ › pindah lokasi.
 * Esc ditangani PenjagaDialog lewat tombol "Tutup".
 */
import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, MapPin, X } from 'lucide-react';
import { NETRAL } from '@/lib/desain';
import type { ChecklistBagian, ChecklistItem } from '@/lib/checklist';
import { BarProgres, CatatanTeks, KepingKendala, PanelBagian, TEMA, itemPerBagian, progresDariStat } from '@/app/(portal)/project-progress/_components/tampilan';
import type { RingkasLokasi } from '@/app/(portal)/project-progress/_components/ringkasan/hitung';

const DURASI = 220;

const warnaJadwal = (l: RingkasLokasi) => (l.jadwal === 'terlambat' ? TEMA.bahaya : l.jadwal === 'selesai' ? TEMA.selesai : TEMA.samar);

export function PanelLokasi({ lokasi, semua, keterangan, bagian, items, onPilih, onTutup }: {
  lokasi: RingkasLokasi; semua: RingkasLokasi[]; keterangan: string;
  bagian: ChecklistBagian[]; items: ChecklistItem[];
  onPilih: (id: string) => void; onTutup: () => void;
}) {
  const [masuk, setMasuk] = useState(false);
  //  Desktop/tablet: geser dari kanan. HP: naik dari bawah. Panel dipasang sesudah diklik, jadi window ada.
  const [geser] = useState(() => window.matchMedia('(min-width: 768px)').matches ? 'translate3d(100%,0,0)' : 'translate3d(0,100%,0)');
  const isi = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = requestAnimationFrame(() => setMasuk(true));
    const lama = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { cancelAnimationFrame(id); document.body.style.overflow = lama; };
  }, []);
  //  Pindah lokasi: mulai dari atas, panel tidak diputar ulang animasinya.
  useEffect(() => { isi.current?.scrollTo({ top: 0 }); }, [lokasi.id]);

  const tutup = () => { setMasuk(false); window.setTimeout(onTutup, DURASI); };
  const peta = itemPerBagian(bagian, items);
  const urutan = semua.findIndex(l => l.id === lokasi.id);
  const pindah = (arah: -1 | 1) => { const l = semua[urutan + arah]; if (l) onPilih(l.id); };

  return (
    <div className="fixed inset-0 z-[1000]" role="dialog" aria-modal="true" aria-label={lokasi.judul}>
      <div className="absolute inset-0 bg-slate-900/40" onClick={tutup}
        style={{ opacity: masuk ? 1 : 0, transition: `opacity ${DURASI}ms ease` }} />

      <aside
        className="absolute flex overflow-hidden shadow-2xl inset-x-0 bottom-0 h-[92dvh] rounded-t-2xl md:inset-y-0 md:left-auto md:right-0 md:h-full md:w-[min(900px,92vw)] md:rounded-none md:rounded-l-2xl lg:w-[min(1480px,96vw)]"
        style={{ background: 'var(--halaman, #f3f5f8)', transform: masuk ? 'none' : geser, transition: `transform ${DURASI}ms cubic-bezier(.2,.8,.2,1)` }}
      >
        {/* Daftar lokasi - desktop saja */}
        <nav aria-label="Lokasi" className="hidden lg:flex flex-col w-72 flex-shrink-0" style={{ background: NETRAL.permukaan, borderRight: `1px solid ${NETRAL.garis}` }}>
          <p className="px-4 py-3.5 text-[11px] font-bold uppercase tracking-wider" style={{ color: TEMA.samar, borderBottom: `1px solid ${NETRAL.garis}` }}>
            Lokasi · {semua.length}
          </p>
          <ul className="flex-1 overflow-y-auto overscroll-contain py-1">
            {semua.map(l => {
              const aktif = l.id === lokasi.id;
              return (
                <li key={l.id}>
                  <button type="button" onClick={() => onPilih(l.id)} aria-current={aktif ? 'true' : undefined}
                    className="w-full text-left px-4 py-2.5 space-y-1.5 transition-colors hover:bg-slate-50"
                    style={{ background: aktif ? TEMA.tint : undefined, boxShadow: aktif ? `inset 3px 0 0 ${TEMA.warna}` : undefined }}>
                    <span className="flex items-center gap-2">
                      <span className="text-[13px] font-semibold flex-1 min-w-0 truncate" style={{ color: aktif ? TEMA.warnaTua : NETRAL.tinta }}>{l.judul}</span>
                      {l.stat.kendala > 0 && <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: TEMA.kendala }} title={`${l.stat.kendala} kendala`} />}
                      <span className="text-[11px] font-bold tabular-nums" style={{ color: l.persen === 100 ? TEMA.selesai : TEMA.samar }}>{l.persen}%</span>
                    </span>
                    <span className="block h-1 rounded-full overflow-hidden" style={{ background: NETRAL.garis }}>
                      <span className="block h-full rounded-full" style={{ width: `${l.persen}%`, background: l.persen === 100 ? TEMA.selesai : TEMA.warna }} />
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="flex-1 min-w-0 flex flex-col">
          <div className="md:hidden flex justify-center pt-2"><span className="w-10 h-1 rounded-full bg-slate-300" /></div>

          <header className="px-4 sm:px-6 py-3 space-y-2" style={{ background: NETRAL.permukaan, borderBottom: `1px solid ${NETRAL.garis}` }}>
            <div className="flex items-center gap-2">
              <MapPin size={17} className="flex-shrink-0" style={{ color: TEMA.warna }} />
              <h2 className="font-bold text-[15px] lg:text-[17px] flex-1 min-w-0 truncate" style={{ color: NETRAL.tinta }}>{lokasi.judul}</h2>
              <KepingKendala jumlah={lokasi.stat.kendala} />
              <span className="lg:hidden text-[11px] font-semibold tabular-nums" style={{ color: TEMA.samar }}>{urutan + 1}/{semua.length}</span>
              <button type="button" onClick={() => pindah(-1)} disabled={urutan <= 0} aria-label="Lokasi sebelumnya" title="Sebelumnya"
                className="lg:hidden p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-30"><ChevronLeft size={18} /></button>
              <button type="button" onClick={() => pindah(1)} disabled={urutan >= semua.length - 1} aria-label="Lokasi berikutnya" title="Berikutnya"
                className="lg:hidden p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-30"><ChevronRight size={18} /></button>
              <button type="button" onClick={tutup} aria-label="Tutup" title="Tutup (Esc)"
                className="p-1.5 rounded-lg hover:bg-slate-100"><X size={18} /></button>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex-1 min-w-0 lg:max-w-xl">
                {lokasi.stat.total > 0
                  ? <BarProgres progres={progresDariStat(lokasi.stat)} tebal={8} />
                  : <span className="text-[12px]" style={{ color: TEMA.samar }}>Belum ada item</span>}
              </div>
              <span className="text-[12px] font-bold whitespace-nowrap lg:ml-auto" style={{ color: warnaJadwal(lokasi) }}>{lokasi.labelJadwal}</span>
            </div>
          </header>

          <div ref={isi} className="flex-1 overflow-y-auto overscroll-contain p-3 sm:p-4 lg:p-5">
            {keterangan && <div className="mb-3"><CatatanTeks teks={keterangan} /></div>}
            {bagian.length === 0 && <p className="py-10 text-center text-[13px]" style={{ color: TEMA.samar }}>Belum ada checklist.</p>}
            {/* Layar lebar: bagian mengalir dalam 2 kolom, bukan satu kolom panjang. */}
            <div className="xl:columns-2 xl:gap-4">
              {bagian.map(b => (
                <div key={b.id} className="mb-3 break-inside-avoid">
                  <PanelBagian bagian={b} items={peta.get(b.id) ?? []} sedangId={null} aksi={{}} terbukaAwal={bagian.length <= 4} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
