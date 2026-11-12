'use client';

import type { ChecklistDaftar, ChecklistProyek, HakChecklist, KeadaanJadwal, StatChecklist } from '@/lib/checklist/inti';
import type { Dispatch, SetStateAction } from 'react';
import { ArrowLeft, CalendarDays, Copy, Download, HardHat, Link2, Pencil, Trash2, Upload, Users } from 'lucide-react';
import { NETRAL } from '@/lib/desain';
import { formatTanggal, type ChecklistDetail } from '@/lib/checklist/inti';
import { BarProgres, CatatanTeks, KepingKendala, TEMA, progresDariStat } from './tampilan';
import { kecil } from './DetailChecklist';
import type { FormInfo } from './DetailChecklist';

export interface KepalaDetailChecklistProps {
  kembali: () => void;
  proyek: Pick<ChecklistProyek, "id" | "nama" | "client" | "sales_name" | "sales_division" | "status">;
  daftar: ChecklistDaftar;
  warnaJadwal: "#15803d" | "#b45309" | "#b91c1c" | "#64748b";
  jadwal: { keadaan: KeadaanJadwal; label: string; };
  hak: HakChecklist;
  setShareBuka: Dispatch<SetStateAction<boolean>>;
  setImporBuka: Dispatch<SetStateAction<boolean>>;
  ekspor: () => void;
  setSalinBuka: Dispatch<SetStateAction<boolean>>;
  setFormInfo: Dispatch<SetStateAction<FormInfo | null>>;
  hapusChecklist: () => void;
  stat: StatChecklist;
  detail: ChecklistDetail;
  setFormAnggota: Dispatch<SetStateAction<string[] | null>>;
}

export function KepalaDetailChecklist({
  kembali, proyek, daftar, warnaJadwal, jadwal, hak, setShareBuka, setImporBuka,
  ekspor, setSalinBuka, setFormInfo, hapusChecklist, stat, detail, setFormAnggota,
}: KepalaDetailChecklistProps) {
  return (
    <div className="rounded-xl p-4 space-y-3" style={{ background: NETRAL.permukaan, border: `1px solid ${NETRAL.garis}` }}>
      <div className="flex items-start gap-3 flex-wrap">
        <button onClick={kembali} aria-label="Kembali ke proyek"
          className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
          style={{ border: `1px solid ${NETRAL.garis}`, color: NETRAL.tinta2 }}>
          <ArrowLeft size={16} />
        </button>
        <div className="flex-1 min-w-[220px]">
          <p className="text-[11.5px] font-semibold" style={{ color: TEMA.samar }}>
            {proyek.nama}{proyek.client ? ` · ${proyek.client}` : ''}{proyek.sales_name ? ` · Sales ${proyek.sales_name}` : ''}
          </p>
          <h2 className="text-[17px] font-bold leading-tight" style={{ color: NETRAL.tinta }}>{daftar.judul}</h2>
          <p className="text-[12px] mt-1 flex items-center gap-1.5 flex-wrap" style={{ color: NETRAL.tinta2 }}>
            <CalendarDays size={13} />
            {daftar.start_date || daftar.target_date
              ? `${formatTanggal(daftar.start_date)} – ${formatTanggal(daftar.target_date)}`
              : 'Belum ada jadwal'}
            <span className="font-bold" style={{ color: warnaJadwal }}>· {jadwal.label}</span>
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {hak.edit && (
            <button onClick={() => setShareBuka(true)} className={kecil}
              style={{ background: daftar.share_aktif ? TEMA.selesaiTint : TEMA.warna, color: daftar.share_aktif ? TEMA.selesai : '#fff',
                border: daftar.share_aktif ? '1px solid #bbf7d0' : 'none' }}>
              <Link2 size={14} /> {daftar.share_aktif ? 'Link tim aktif' : 'Link untuk tim'}
            </button>
          )}
          {hak.edit && (
            <button onClick={() => setImporBuka(true)} className={kecil} style={{ border: `1px solid ${NETRAL.garis}`, color: NETRAL.tinta2 }}>
              <Upload size={14} /> Impor isi
            </button>
          )}
          <button onClick={ekspor} className={kecil} style={{ border: `1px solid ${NETRAL.garis}`, color: NETRAL.tinta2 }}>
            <Download size={14} /> Ekspor Excel
          </button>
          {hak.admin && (
            <button onClick={() => setSalinBuka(true)} className={kecil} style={{ border: `1px solid ${NETRAL.garis}`, color: NETRAL.tinta2 }}
              title="Salin checklist ini ke lokasi lain - centang dikosongkan, tinggal edit yang perlu">
              <Copy size={14} /> Salin ke lokasi lain
            </button>
          )}
          {hak.admin && (
            <>
              <button onClick={() => setFormInfo({ judul: daftar.judul, keterangan: daftar.keterangan, support_lokasi: daftar.support_lokasi ?? '', start_date: daftar.start_date ?? '', target_date: daftar.target_date ?? '' })}
                aria-label="Ubah nama, keterangan & jadwal" title="Ubah info & jadwal" className={kecil} style={{ border: `1px solid ${NETRAL.garis}`, color: NETRAL.tinta2 }}>
                <Pencil size={14} />
              </button>
              <button onClick={hapusChecklist} aria-label="Hapus checklist" title="Hapus checklist" className={kecil}
                style={{ border: `1px solid ${NETRAL.garis}`, color: TEMA.bahaya }}>
                <Trash2 size={14} />
              </button>
            </>
          )}
        </div>
      </div>
    
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex-1 min-w-[220px]"><BarProgres progres={progresDariStat(stat)} tebal={10} /></div>
        <KepingKendala jumlah={stat.kendala} />
      </div>
    
      <div className="flex items-center gap-2 flex-wrap">
        <Users size={14} style={{ color: TEMA.samar }} />
        {detail.anggota.length === 0 && <span className="text-[12px]" style={{ color: TEMA.samar }}>Belum ada yang di-assign</span>}
        {detail.anggota.map(a => (
          <span key={a.user_id} className="px-2 py-0.5 rounded-full text-[11.5px] font-semibold"
            style={{ background: NETRAL.permukaanRedam, color: NETRAL.tinta2, border: `1px solid ${NETRAL.garis}` }}>{a.nama}</span>
        ))}
        {hak.admin && (
          <button onClick={() => setFormAnggota(detail.anggota.map(a => a.user_id))} className="text-[12px] font-bold" style={{ color: TEMA.warna }}>
            Atur anggota
          </button>
        )}
        {!hak.edit && (
          <span className="text-[11.5px] font-semibold px-2 py-0.5 rounded-full" style={{ background: '#f1f5f9', color: NETRAL.tinta2 }}>
            Hanya lihat · Anda tidak di-assign
          </span>
        )}
      </div>
      {daftar.support_lokasi && (
        <p className="flex items-center gap-2 text-[12px]" style={{ color: NETRAL.tinta2 }}>
          <HardHat size={14} style={{ color: TEMA.samar }} />
          <span>Support di lokasi: <b style={{ color: NETRAL.tinta }}>{daftar.support_lokasi}</b></span>
        </p>
      )}
      {daftar.keterangan && <CatatanTeks teks={daftar.keterangan} />}
    </div>
  );
}
