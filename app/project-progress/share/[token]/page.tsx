'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { CalendarDays, ChevronDown, Eye, Lock, MapPin } from 'lucide-react';
import { NETRAL } from '@/lib/desain';
import {
  STATUS_PROYEK, formatTanggal, formatWaktu, keadaanJadwal, statDari,
  type ChecklistBagian, type ChecklistItem, type StatusProyek,
} from '@/lib/checklist';
import { BarProgres, CatatanTeks, KepingKendala, PanelBagian, TEMA, itemPerBagian, progresDariStat } from '../../_components/tampilan';

interface DataShare {
  proyek: {
    id: string; nama: string; client: string | null; deskripsi: string; sales_name: string | null;
    sales_division: string | null; status: StatusProyek; start_date: string | null; target_date: string | null; updated_at: string;
  };
  daftar: { id: string; judul: string; keterangan: string; start_date: string | null; target_date: string | null; updated_at: string }[];
  bagian: ChecklistBagian[];
  items: ChecklistItem[];
}

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

  const total = data ? statDari(data.items) : null;
  const st = data ? (STATUS_PROYEK[data.proyek.status] ?? STATUS_PROYEK.in_progress) : null;

  return (
    <div className="min-h-screen" style={{ background: 'var(--latar-halaman)' }}>
      <header className="sticky top-0 z-40" style={{ background: NETRAL.permukaan, borderBottom: `1px solid ${NETRAL.garis}` }}>
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
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

      <main className="max-w-4xl mx-auto px-3 sm:px-4 py-4 space-y-3">
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
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex-1 min-w-[200px]"><BarProgres progres={progresDariStat(total)} tebal={10} /></div>
                <KepingKendala jumlah={total.kendala} />
              </div>
              {data.proyek.deskripsi && <CatatanTeks teks={data.proyek.deskripsi} />}
            </div>

            {data.daftar.length === 0 && (
              <p className="rounded-xl p-8 text-center text-[13px]" style={{ background: NETRAL.permukaan, border: `1px solid ${NETRAL.garis}`, color: NETRAL.tinta2 }}>
                Belum ada checklist lokasi.
              </p>
            )}

            {data.daftar.map(d => {
              const isi = perDaftar.get(d.id) ?? { bagian: [], items: [] };
              const s = statDari(isi.items);
              const j = keadaanJadwal(d.target_date, s.total > 0 && s.selesai === s.total);
              const terbuka = buka === d.id;
              const peta = itemPerBagian(isi.bagian, isi.items);
              return (
                <section key={d.id} className="rounded-xl overflow-hidden" style={{ background: NETRAL.permukaan, border: `1px solid ${s.kendala ? TEMA.kendalaGaris : NETRAL.garis}` }}>
                  <button type="button" onClick={() => setBuka(terbuka ? null : d.id)} aria-expanded={terbuka}
                    className="w-full text-left px-4 py-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <ChevronDown size={16} className="flex-shrink-0 transition-transform" style={{ transform: terbuka ? 'none' : 'rotate(-90deg)', color: TEMA.samar }} />
                      <MapPin size={15} style={{ color: TEMA.warna }} />
                      <span className="font-bold text-[14px] flex-1 min-w-0 truncate" style={{ color: NETRAL.tinta }}>{d.judul}</span>
                      <KepingKendala jumlah={s.kendala} />
                    </div>
                    <div className="pl-6 flex items-center gap-3 flex-wrap">
                      <div className="flex-1 min-w-[180px]">
                        {s.total > 0 ? <BarProgres progres={progresDariStat(s)} tebal={6} /> : <span className="text-[11.5px]" style={{ color: TEMA.samar }}>Belum ada item</span>}
                      </div>
                      <span className="text-[11.5px] font-bold" style={{ color: j.keadaan === 'terlambat' ? TEMA.bahaya : j.keadaan === 'selesai' ? TEMA.selesai : TEMA.samar }}>{j.label}</span>
                    </div>
                  </button>
                  {terbuka && (
                    <div className="px-3 pb-3 space-y-2" style={{ borderTop: `1px solid ${NETRAL.garis}`, paddingTop: 12 }}>
                      {d.keterangan && <div className="px-1"><CatatanTeks teks={d.keterangan} /></div>}
                      {isi.bagian.map(b => (
                        <PanelBagian key={b.id} bagian={b} items={peta.get(b.id) ?? []} sedangId={null} aksi={{}} terbukaAwal={false} />
                      ))}
                    </div>
                  )}
                </section>
              );
            })}

            <p className="text-center text-[11px] font-semibold py-4" style={{ color: TEMA.samar }}>
              Work Management PTS IVP · Diperbarui {formatWaktu(data.proyek.updated_at)} · Halaman ini hanya menampilkan data.
            </p>
          </>
        )}
      </main>
    </div>
  );
}
