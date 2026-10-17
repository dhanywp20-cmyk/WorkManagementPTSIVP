'use client';

/**
 * Detail lokasi di link View-Only.
 *  - Desktop (>= 1024px): panel lebar hampir layar penuh, dua kolom: kiri daftar semua lokasi untuk
 *    berpindah, kanan isi checklist dengan bagian disusun 2 kolom (layar lebar tidak terbuang).
 *  - Tablet: panel dari kanan tanpa daftar; HP: lembar dari bawah. ‹ › pindah lokasi.
 * Isi kanan: tim (Handler + Support di lokasi), ringkasan lokasi (waktu, Dikerjakan Oleh, laju
 * harian - sama dengan detail checklist di aplikasi), lalu bagian. Bagian yang belum selesai terbuka.
 * Esc ditangani PenjagaDialog lewat tombol "Tutup".
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, ChevronsDownUp, ChevronsUpDown, HardHat, MapPin, Users, X } from 'lucide-react';
import { NETRAL } from '@/lib/desain';
import { statDari, type ChecklistBagian, type ChecklistItem } from '@/lib/checklist';
import type { AnggotaNama } from '@/lib/checklist-ringkasan';
import { BarProgres, CatatanTeks, KepingKendala, PanelBagian, TEMA, itemPerBagian, progresDariStat } from '@/app/(portal)/project-progress/_components/tampilan';
import { ringkasChecklist, type RingkasLokasi } from '@/app/(portal)/project-progress/_components/ringkasan/hitung';
import { RingkasanChecklist, adaRingkasanChecklist } from '@/app/(portal)/project-progress/_components/ringkasan/Ringkasan';

const DURASI = 220;

const warnaJadwal = (l: RingkasLokasi) => (l.jadwal === 'terlambat' ? TEMA.bahaya : l.jadwal === 'selesai' ? TEMA.selesai : TEMA.samar);

/** Handler & Support di lokasi - satu baris chip, dipakai panel dan kartu lokasi. */
export function TimLokasi({ handler, support, kecil = false }: { handler: string[]; support: string; kecil?: boolean }) {
  if (!handler.length && !support) return null;
  const ukuran = kecil ? 'text-[11px]' : 'text-[12px]';
  const chip = (nama: string) => (
    <span key={nama} className={`px-2 py-0.5 rounded-full font-semibold ${ukuran}`}
      style={{ background: NETRAL.permukaanRedam, color: NETRAL.tinta2, border: `1px solid ${NETRAL.garis}` }}>{nama}</span>
  );
  return (
    <div className={`flex flex-wrap items-center gap-x-4 gap-y-1.5 ${ukuran}`}>
      {handler.length > 0 && (
        <span className="flex flex-wrap items-center gap-1.5">
          <Users size={kecil ? 12 : 14} style={{ color: TEMA.samar }} />
          <span className="font-semibold" style={{ color: TEMA.samar }}>Handler</span>
          {handler.map(chip)}
        </span>
      )}
      {support && (
        <span className="flex flex-wrap items-center gap-1.5">
          <HardHat size={kecil ? 12 : 14} style={{ color: TEMA.samar }} />
          <span className="font-semibold" style={{ color: TEMA.samar }}>Support di lokasi</span>
          {chip(support)}
        </span>
      )}
    </div>
  );
}

export function PanelLokasi({ lokasi, semua, keterangan, jadwal, anggota, support, bagian, items, onPilih, onTutup }: {
  lokasi: RingkasLokasi; semua: RingkasLokasi[]; keterangan: string;
  jadwal: { start_date: string | null; target_date: string | null };
  /** Handler checklist ini (nama saja). */
  anggota: AnggotaNama[]; support: string;
  bagian: ChecklistBagian[]; items: ChecklistItem[];
  onPilih: (id: string) => void; onTutup: () => void;
}) {
  const [masuk, setMasuk] = useState(false);
  //  Buka/Tutup semua, berlaku untuk lokasi tempat tombolnya ditekan. Pindah lokasi -> kembali ke
  //  bawaan (null: bagian yang belum selesai terbuka).
  const [pilihanBuka, setPilihanBuka] = useState<{ id: string; buka: boolean } | null>(null);
  const semuaBuka = pilihanBuka?.id === lokasi.id ? pilihanBuka.buka : null;
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
  const ringkasan = useMemo(() => ringkasChecklist(jadwal, items, anggota), [jadwal, items, anggota]);
  const handler = [...new Set(anggota.map(a => a.nama.trim()).filter(Boolean))];
  const bukaAwal = (b: ChecklistBagian) => {
    if (semuaBuka !== null) return semuaBuka;
    const s = statDari(peta.get(b.id) ?? []);
    return s.kendala > 0 || s.selesai < s.total;
  };
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
            <TimLokasi handler={handler} support={support} />
          </header>

          <div ref={isi} className="flex-1 overflow-y-auto overscroll-contain p-3 sm:p-4 lg:p-5 space-y-3">
            {keterangan && <CatatanTeks teks={keterangan} />}
            {adaRingkasanChecklist(ringkasan) && <RingkasanChecklist r={ringkasan} />}
            {bagian.length === 0 && <p className="py-10 text-center text-[13px]" style={{ color: TEMA.samar }}>Belum ada checklist.</p>}
            {bagian.length > 0 && (
              <div className="flex items-center justify-between gap-2 px-1">
                <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: TEMA.samar }}>Bagian · {bagian.length}</p>
                <button type="button" onClick={() => setPilihanBuka({ id: lokasi.id, buka: !semuaBuka })}
                  className="inline-flex items-center gap-1 text-[12px] font-bold rounded-lg px-2.5 py-1 hover:bg-white" style={{ color: TEMA.warna }}>
                  {semuaBuka ? <><ChevronsDownUp size={14} /> Tutup semua</> : <><ChevronsUpDown size={14} /> Buka semua</>}
                </button>
              </div>
            )}
            {/* Layar lebar: bagian mengalir dalam 2 kolom, bukan satu kolom panjang. Kunci ikut
                semuaBuka supaya Buka/Tutup semua memasang ulang panel dengan keadaan awal baru. */}
            <div className="xl:columns-2 xl:gap-4">
              {bagian.map(b => (
                <div key={`${b.id}-${semuaBuka}`} className="mb-3 break-inside-avoid">
                  <PanelBagian bagian={b} items={peta.get(b.id) ?? []} sedangId={null} aksi={{}} terbukaAwal={bukaAwal(b)} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
