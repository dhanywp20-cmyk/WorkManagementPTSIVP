'use client';

import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, CalendarDays, Link2, MapPin, Pencil, Plus, Trash2, Users } from 'lucide-react';
import { ConfirmDialog, type ConfirmState, type SalesPickerUser } from '@/components/shared';
import { NETRAL } from '@/lib/desain';
import {
  STATUS_PROYEK, formatTanggal, keadaanJadwal, type ChecklistRingkas, type ProyekDetail,
} from '@/lib/checklist';
import { BarProgres, CatatanTeks, KepingKendala, TEMA, progresDariStat } from './tampilan';
import { ModalShare } from './ModalShare';
import { ModalChecklistBaru, ModalProyek, type IsianProyek } from './FormProyek';
import type { CalonAnggota } from './PilihAnggota';
import { panggil, pesanGalat } from './api';

const kecil = 'inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-bold transition-colors';

function warnaJadwal(k: ReturnType<typeof keadaanJadwal>['keadaan']): string {
  return k === 'terlambat' ? TEMA.bahaya : k === 'dekat' ? TEMA.kendala : k === 'selesai' ? TEMA.selesai : TEMA.samar;
}

function KartuChecklist({ c, onBuka }: { c: ChecklistRingkas; onBuka: () => void }) {
  const tuntas = c.stat.total > 0 && c.stat.selesai === c.stat.total;
  const j = keadaanJadwal(c.target_date, tuntas);
  return (
    <button type="button" onClick={onBuka}
      className="text-left rounded-xl p-4 space-y-2.5 transition-all hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2"
      style={{ background: NETRAL.permukaan, border: `1px solid ${c.stat.kendala ? TEMA.kendalaGaris : NETRAL.garis}`, boxShadow: '0 1px 2px rgba(15,23,42,0.05)' }}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-[14px] font-bold leading-snug flex items-start gap-1.5" style={{ color: NETRAL.tinta }}>
          <MapPin size={15} className="mt-0.5 flex-shrink-0" style={{ color: TEMA.warna }} /> {c.judul}
        </p>
        <span className="flex items-center gap-1 flex-shrink-0">
          {c.saya && <span className="px-1.5 py-0.5 rounded text-[11px] font-bold" style={{ background: TEMA.tint, color: TEMA.warnaTua }}>Tugas saya</span>}
          {c.share_aktif && <Link2 size={14} aria-label="Link tim aktif" style={{ color: TEMA.selesai }} />}
        </span>
      </div>
      {c.stat.total > 0
        ? <BarProgres progres={progresDariStat(c.stat)} tebal={7} />
        : <p className="text-[12px] font-semibold" style={{ color: TEMA.samar }}>Belum ada item - buka untuk impor isi</p>}
      <div className="flex items-center gap-2 flex-wrap text-[11.5px]">
        <span className="font-bold" style={{ color: warnaJadwal(j.keadaan) }}>{j.label}</span>
        <KepingKendala jumlah={c.stat.kendala} />
      </div>
      <p className="text-[11.5px] flex items-center gap-1.5 truncate" style={{ color: NETRAL.tinta2 }}>
        <Users size={12} className="flex-shrink-0" />
        {c.anggota.length ? c.anggota.map(a => a.nama).join(', ') : 'Belum di-assign'}
      </p>
    </button>
  );
}

/** Satu proyek: info (seperti Project Progress lama) + checklist per lokasi. */
export function DetailProyek({ proyekId, onKembali, onBukaChecklist, beritahu, onBerubah, salesUsers, calonAnggota }: {
  proyekId: string;
  onKembali: () => void;
  onBukaChecklist: (id: string) => void;
  beritahu: (type: 'success' | 'error', msg: string) => void;
  onBerubah: () => void;
  salesUsers: SalesPickerUser[];
  calonAnggota: CalonAnggota[];
}) {
  const [data, setData] = useState<ProyekDetail | null>(null);
  const [galat, setGalat] = useState('');
  const [ubahBuka, setUbahBuka] = useState(false);
  const [baruBuka, setBaruBuka] = useState(false);
  const [shareBuka, setShareBuka] = useState(false);
  const [konfirmasi, setKonfirmasi] = useState<ConfirmState | null>(null);

  const muat = useCallback(async () => {
    try { setData(await panggil<ProyekDetail>(`/api/project-progress/${proyekId}`)); setGalat(''); }
    catch (e) { setGalat(pesanGalat(e, 'Gagal memuat proyek.')); }
  }, [proyekId]);
  useEffect(() => { muat(); }, [muat]);

  const simpanProyek = async (f: IsianProyek) => {
    await panggil(`/api/project-progress/${proyekId}`, { method: 'PATCH', body: JSON.stringify({ aksi: 'ubahInfo', ...f }) });
    setUbahBuka(false);
    await muat();
    onBerubah();
    beritahu('success', 'Proyek diperbarui.');
  };

  const ubahShare = async (aksi: 'share' | 'tokenBaru', aktif?: boolean) => {
    const hasil = await panggil<{ share_aktif: boolean; share_token: string }>(`/api/project-progress/${proyekId}`, {
      method: 'PATCH', body: JSON.stringify({ aksi, aktif }),
    });
    setData(d => d && { ...d, proyek: { ...d.proyek, ...hasil } });
  };

  const hapus = () => setKonfirmasi({
    message: `Hapus proyek "${data?.proyek.nama}"?`,
    description: `Semua checklist (${data?.checklist.length ?? 0} lokasi), item, foto, kendala, dan riwayatnya ikut terhapus permanen. Semua link share berhenti berfungsi.`,
    confirmLabel: 'Hapus permanen', danger: true,
    onConfirm: async () => {
      setKonfirmasi(null);
      try {
        await panggil(`/api/project-progress/${proyekId}`, { method: 'DELETE' });
        onBerubah();
        beritahu('success', 'Proyek dihapus.');
        onKembali();
      } catch (e) { beritahu('error', pesanGalat(e, 'Gagal menghapus.')); }
    },
  });

  if (galat && !data) {
    return (
      <div className="rounded-xl p-8 text-center space-y-3" style={{ background: NETRAL.permukaan, border: `1px solid ${NETRAL.garis}` }}>
        <p className="text-sm font-bold" style={{ color: NETRAL.tinta }}>{galat}</p>
        <button onClick={onKembali} className={kecil} style={{ border: `1px solid ${NETRAL.garis}`, color: NETRAL.tinta2 }}>Kembali</button>
      </div>
    );
  }
  if (!data) return <div className="py-16 text-center text-sm font-semibold" style={{ color: TEMA.samar }}>Memuat proyek…</div>;

  const { proyek, checklist, admin } = data;
  const st = STATUS_PROYEK[proyek.status] ?? STATUS_PROYEK.in_progress;
  const total = checklist.reduce((a, c) => ({
    total: a.total + c.stat.total, selesai: a.selesai + c.stat.selesai, kendala: a.kendala + c.stat.kendala,
  }), { total: 0, selesai: 0, kendala: 0 });
  const j = keadaanJadwal(proyek.target_date, proyek.status === 'done');
  // Yang bermasalah di depan: kendala, lalu terlambat, lalu sisanya sesuai urutan.
  const urut = [...checklist].sort((a, b) => (b.stat.kendala > 0 ? 1 : 0) - (a.stat.kendala > 0 ? 1 : 0) || a.urutan - b.urutan);

  return (
    <div className="space-y-4">
      <div className="rounded-xl p-4 space-y-3" style={{ background: NETRAL.permukaan, border: `1px solid ${NETRAL.garis}` }}>
        <div className="flex items-start gap-3 flex-wrap">
          <button onClick={onKembali} aria-label="Kembali ke daftar proyek"
            className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ border: `1px solid ${NETRAL.garis}`, color: NETRAL.tinta2 }}>
            <ArrowLeft size={16} />
          </button>
          <div className="flex-1 min-w-[220px]">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-[18px] font-bold leading-tight" style={{ color: NETRAL.tinta }}>{proyek.nama}</h2>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold" style={{ background: st.tint, color: st.warna }}>{st.label}</span>
            </div>
            <dl className="mt-1.5 grid gap-x-6 gap-y-0.5 text-[12.5px] sm:grid-cols-2" style={{ color: NETRAL.tinta2 }}>
              <div><dt className="inline font-semibold">Client: </dt><dd className="inline" style={{ color: NETRAL.tinta }}>{proyek.client || '-'}</dd></div>
              <div><dt className="inline font-semibold">Sales: </dt><dd className="inline" style={{ color: NETRAL.tinta }}>
                {proyek.sales_name || '-'}{proyek.sales_division ? ` (${proyek.sales_division})` : ''}</dd></div>
              <div className="flex items-center gap-1.5"><CalendarDays size={13} />
                {formatTanggal(proyek.start_date)} – {formatTanggal(proyek.target_date)}
                <span className="font-bold" style={{ color: warnaJadwal(j.keadaan) }}>· {j.label}</span></div>
              <div><dt className="inline font-semibold">Asal: </dt><dd className="inline">
                {proyek.origin === 'auto_reminder' ? 'Otomatis dari Request Schedule' : proyek.origin === 'migrasi' ? 'Project Progress lama' : `Dibuat ${proyek.dibuat_oleh_nama ?? 'admin'}`}</dd></div>
            </dl>
          </div>
          {admin && (
            <div className="flex items-center gap-2 flex-wrap">
              <button onClick={() => setShareBuka(true)} className={kecil}
                style={{ background: proyek.share_aktif ? TEMA.selesaiTint : NETRAL.permukaan, color: proyek.share_aktif ? TEMA.selesai : NETRAL.tinta2,
                  border: `1px solid ${proyek.share_aktif ? '#bbf7d0' : NETRAL.garis}` }}>
                <Link2 size={14} /> {proyek.share_aktif ? 'Link proyek aktif' : 'Link proyek'}
              </button>
              <button onClick={() => setUbahBuka(true)} className={kecil} style={{ border: `1px solid ${NETRAL.garis}`, color: NETRAL.tinta2 }}>
                <Pencil size={14} /> Ubah
              </button>
              <button onClick={hapus} aria-label="Hapus proyek" title="Hapus proyek" className={kecil} style={{ border: `1px solid ${NETRAL.garis}`, color: TEMA.bahaya }}>
                <Trash2 size={14} />
              </button>
            </div>
          )}
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex-1 min-w-[220px]"><BarProgres progres={progresDariStat(total)} tebal={10} /></div>
          <KepingKendala jumlah={total.kendala} />
        </div>
        {proyek.deskripsi && <CatatanTeks teks={proyek.deskripsi} />}
      </div>

      {/* Berpanel: latar halaman bisa berupa foto (Admin Panel > Merek). */}
      <div className="flex items-center justify-between gap-2 rounded-xl px-4 py-2.5 shadow-sm"
        style={{ background: NETRAL.permukaan, border: `1px solid ${NETRAL.garis}` }}>
        <p className="text-[12px] font-bold uppercase tracking-wider" style={{ color: NETRAL.tinta2 }}>
          Checklist per lokasi · {checklist.length}
        </p>
        {admin && (
          <button onClick={() => setBaruBuka(true)} className={kecil} style={{ background: TEMA.warna, color: '#fff' }}>
            <Plus size={14} /> Checklist lokasi
          </button>
        )}
      </div>

      {checklist.length === 0 ? (
        <div className="rounded-xl p-8 text-center space-y-2" style={{ background: NETRAL.permukaan, border: `1px dashed ${NETRAL.garisKuat}` }}>
          <p className="text-[14px] font-bold" style={{ color: NETRAL.tinta }}>Belum ada checklist lokasi</p>
          <p className="text-[12.5px]" style={{ color: NETRAL.tinta2 }}>
            {admin ? 'Tambahkan checklist untuk tiap lokasi/ruangan - impor dari teks/Excel atau salin dari proyek lain.' : 'Admin belum menambahkan checklist untuk proyek ini.'}
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {urut.map(c => <KartuChecklist key={c.id} c={c} onBuka={() => onBukaChecklist(c.id)} />)}
        </div>
      )}

      <ModalProyek buka={ubahBuka} awal={proyek} salesUsers={salesUsers} onTutup={() => setUbahBuka(false)} onSimpan={simpanProyek} />
      <ModalChecklistBaru proyekId={proyekId} buka={baruBuka} calonAnggota={calonAnggota} onTutup={() => setBaruBuka(false)}
        onDibuat={id => { setBaruBuka(false); onBerubah(); beritahu('success', 'Checklist lokasi dibuat.'); onBukaChecklist(id); }} />
      <ModalShare beritahu={beritahu} onUbah={ubahShare} onTutup={() => setShareBuka(false)}
        target={shareBuka ? { jenis: 'proyek', judul: proyek.nama, share_aktif: proyek.share_aktif, share_token: proyek.share_token } : null} />
      <ConfirmDialog state={konfirmasi} onCancel={() => setKonfirmasi(null)} />
    </div>
  );
}
