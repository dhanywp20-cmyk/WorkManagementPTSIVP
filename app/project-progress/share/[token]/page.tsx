'use client';

import { BarProgres, CatatanTeks, KepingKendala, TEMA, progresDariStat } from '@/app/(portal)/project-progress/_components/tampilan';
import { STATUS_PROYEK, formatTanggal, formatWaktu, keadaanJadwal, statDari, type ChecklistBagian, type ChecklistItem, type StatusProyek } from '@/lib/checklist';
import { NETRAL } from '@/lib/desain';
import { CalendarDays, ChevronRight, Eye, Lock, MapPin } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { PanelLokasi, TimLokasi } from './_bagian/PanelLokasi';
import { hitungRingkasan } from '@/app/(portal)/project-progress/_components/ringkasan/hitung';
import { RingkasanProyek } from '@/app/(portal)/project-progress/_components/ringkasan/Ringkasan';

interface DataShare {
  proyek: {
    id: string; nama: string; client: string | null; deskripsi: string; sales_name: string | null;
    sales_division: string | null; status: StatusProyek; start_date: string | null; target_date: string | null; updated_at: string;
  };
  daftar: {
    id: string; judul: string; keterangan: string; start_date: string | null; target_date: string | null; updated_at: string;
    /** Nama orang di lokasi, diketik manual admin (migrasi 053). */
    support_lokasi?: string;
  }[];
  bagian: ChecklistBagian[];
  items: ChecklistItem[];
  /** Handler per checklist - ringkasan "Dikerjakan Oleh" & nama Handler per lokasi. */
  anggota?: { daftar_id: string; nama: string }[];
}

const TANPA_ANGGOTA: { daftar_id: string; nama: string }[] = [];

/**
 * Link View-Only satu proyek - PUBLIK, tanpa login. Seluruh checklist lokasi
 * ditampilkan hanya-baca (untuk client / atasan). Token Project Progress lama
 * tetap berlaku karena ikut disalin ke proyek baru oleh migrasi 025.
 */
export default function ProyekSharePage() {
  //  Next 15+: params halaman berupa Promise - di client component cukup useParams().
  const params = useParams<{ token: string }>();
  const [data, setData] = useState<DataShare | null>(null);
  const [memuat, setMemuat] = useState(true);
  const [galat, setGalat] = useState('');
  const [buka, setBuka] = useState<string | null>(null);

  useEffect(() => {
    let hidup = true;
    (async () => {
      try {
        const res = await fetch(`/api/project-progress/share/${params.token}`, { cache: 'no-store' });
        const json = await res.json().catch(() => ({}));
        if (!hidup) return;
        if (!res.ok) { setGalat(json.error || 'Link tidak ditemukan.'); return; }
        setData(json as DataShare);
      } catch {
        if (hidup) setGalat('Gagal memuat data. Periksa koneksi internet.');
      } finally {
        if (hidup) setMemuat(false);
      }
    })();
    return () => { hidup = false; };
  }, [params.token]);

  const perDaftar = useMemo(() => {
    const m = new Map<string, { bagian: ChecklistBagian[]; items: ChecklistItem[] }>();
    for (const d of data?.daftar ?? []) m.set(d.id, { bagian: [], items: [] });
    for (const b of data?.bagian ?? []) m.get(b.daftar_id)?.bagian.push(b);
    for (const it of data?.items ?? []) m.get(it.daftar_id)?.items.push(it);
    return m;
  }, [data]);
  const anggotaPer = useMemo(() => {
    const m = new Map<string, { daftar_id: string; nama: string }[]>();
    for (const a of data?.anggota ?? []) m.set(a.daftar_id, [...(m.get(a.daftar_id) ?? []), a]);
    return m;
  }, [data]);
  const handlerDari = (id: string) => [...new Set((anggotaPer.get(id) ?? []).map(a => a.nama.trim()).filter(Boolean))];

  const total = data ? statDari(data.items) : null;
  const lokasiBuka = data?.daftar.find(d => d.id === buka) ?? null;
  const ringkasan = useMemo(() => data ? hitungRingkasan(data.proyek, data.daftar, data.items, data.anggota ?? []) : null, [data]);
  const st = data ? (STATUS_PROYEK[data.proyek.status] ?? STATUS_PROYEK.in_progress) : null;

  return (
    <div className="min-h-screen" style={{ background: 'var(--latar-halaman)' }}>
      <header className="sticky top-0 z-40" style={{ background: NETRAL.permukaan, borderBottom: `1px solid ${NETRAL.garis}` }}>
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-[15.5px] font-bold leading-tight truncate" style={{ color: NETRAL.tinta }}>{data?.proyek.nama ?? 'Project Progress'}</h1>
            <p className="text-[11px] font-semibold" style={{ color: TEMA.samar }}>
              {data?.proyek.client ? `${data.proyek.client} · ` : ''}Tampilan hanya-baca
            </p>
          </div>
          <span className="px-3 py-1.5 rounded-full text-[11px] font-bold flex items-center gap-1.5 flex-shrink-0"
            style={{ background: NETRAL.permukaanRedam, color: NETRAL.tinta2, border: `1px solid ${NETRAL.garis}` }}>
            <Eye size={13} /> View Only
          </span>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-3 sm:px-4 py-4 space-y-3">
        {memuat && <p className="py-16 text-center text-sm font-semibold" style={{ color: TEMA.samar }}>Memuat progres proyek…</p>}

        {!memuat && galat && (
          <div className="rounded-xl p-10 text-center space-y-2" style={{ background: NETRAL.permukaan, border: `1px solid ${NETRAL.garis}` }}>
            <Lock size={30} className="mx-auto" style={{ color: TEMA.samar }} />
            <p className="text-[15px] font-bold" style={{ color: NETRAL.tinta }}>{galat}</p>
            <p className="text-[12.5px]" style={{ color: NETRAL.tinta2 }}>Hubungi admin untuk mendapatkan link yang masih aktif.</p>
          </div>
        )}

        {data && total && st && (
          <>
            <div className="rounded-xl p-4 space-y-3" style={{ background: NETRAL.permukaan, border: `1px solid ${NETRAL.garis}` }}>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold" style={{ background: st.tint, color: st.warna }}>{st.label}</span>
                <span className="text-[12px] flex items-center gap-1" style={{ color: NETRAL.tinta2 }}>
                  <CalendarDays size={13} /> {formatTanggal(data.proyek.start_date)} – {formatTanggal(data.proyek.target_date)}
                </span>
                {data.proyek.sales_name && <span className="text-[12px]" style={{ color: NETRAL.tinta2 }}>· Sales {data.proyek.sales_name}</span>}
              </div>
              {data.proyek.deskripsi && <CatatanTeks teks={data.proyek.deskripsi} />}
            </div>

            {ringkasan && <RingkasanProyek r={ringkasan} />}

            {data.daftar.length > 0 && (
              <h2 className="pt-2 px-1 text-[12px] font-bold uppercase tracking-wider" style={{ color: TEMA.samar }}>
                Progres per Lokasi · {data.daftar.length}
              </h2>
            )}

            {data.daftar.length === 0 && (
              <p className="rounded-xl p-8 text-center text-[13px]" style={{ background: NETRAL.permukaan, border: `1px solid ${NETRAL.garis}`, color: NETRAL.tinta2 }}>
                Belum ada checklist lokasi.
              </p>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 items-start">
            {data.daftar.map(d => {
              const isi = perDaftar.get(d.id) ?? { bagian: [], items: [] };
              const s = statDari(isi.items);
              const j = keadaanJadwal(d.target_date, s.total > 0 && s.selesai === s.total);
              const dipilih = buka === d.id;
              return (
                <section key={d.id} className="rounded-xl overflow-hidden transition-shadow hover:shadow-md" style={{ background: NETRAL.permukaan, border: `1px solid ${dipilih ? TEMA.warna : s.kendala ? TEMA.kendalaGaris : NETRAL.garis}` }}>
                  <button type="button" onClick={() => setBuka(d.id)} aria-haspopup="dialog"
                    className="w-full text-left px-4 py-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <MapPin size={15} style={{ color: TEMA.warna }} />
                      <span className="font-bold text-[14px] flex-1 min-w-0 truncate" style={{ color: NETRAL.tinta }}>{d.judul}</span>
                      <KepingKendala jumlah={s.kendala} />
                      <ChevronRight size={16} className="flex-shrink-0" style={{ color: TEMA.samar }} />
                    </div>
                    <div className="pl-6 flex items-center gap-3 flex-wrap">
                      <div className="flex-1 min-w-[180px]">
                        {s.total > 0 ? <BarProgres progres={progresDariStat(s)} tebal={6} /> : <span className="text-[11.5px]" style={{ color: TEMA.samar }}>Belum ada item</span>}
                      </div>
                      <span className="text-[11.5px] font-bold" style={{ color: j.keadaan === 'terlambat' ? TEMA.bahaya : j.keadaan === 'selesai' ? TEMA.selesai : TEMA.samar }}>{j.label}</span>
                    </div>
                    <div className="pl-6"><TimLokasi handler={handlerDari(d.id)} support={d.support_lokasi ?? ''} kecil /></div>
                  </button>
                </section>
              );
            })}
            </div>

            {lokasiBuka && ringkasan && (
              <PanelLokasi lokasi={ringkasan.lokasi.find(l => l.id === lokasiBuka.id)!} semua={ringkasan.lokasi} keterangan={lokasiBuka.keterangan}
                jadwal={lokasiBuka} anggota={anggotaPer.get(lokasiBuka.id) ?? TANPA_ANGGOTA} support={lokasiBuka.support_lokasi ?? ''}
                bagian={perDaftar.get(lokasiBuka.id)?.bagian ?? []} items={perDaftar.get(lokasiBuka.id)?.items ?? []}
                onPilih={setBuka} onTutup={() => setBuka(null)} />
            )}

            <p className="text-center text-[11px] font-semibold py-4" style={{ color: TEMA.samar }}>
              Work Management PTS IVP · Diperbarui {formatWaktu(data.proyek.updated_at)} · Halaman ini hanya menampilkan data.
            </p>
          </>
        )}
      </main>
    </div>
  );
}
