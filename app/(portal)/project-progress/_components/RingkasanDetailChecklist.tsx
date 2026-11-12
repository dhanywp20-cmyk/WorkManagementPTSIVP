'use client';

import type { HakChecklist, StatChecklist } from '@/lib/checklist/inti';
import type { JSX } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { Pencil, Plus, Upload } from 'lucide-react';
import { NETRAL } from '@/lib/desain';
import { type ChecklistDetail, type ChecklistItem } from '@/lib/checklist/inti';
import { PanelBagian, TEMA, fontAngka } from './tampilan';
import { kecil } from './DetailChecklist';
import type { FormBagian, FormItem } from './DetailChecklist';

export interface RingkasanDetailChecklistProps {
  detail: ChecklistDetail;
  stat: StatChecklist;
  hanyaKendala: boolean;
  setHanyaKendala: Dispatch<SetStateAction<boolean>>;
  sembunyikan: boolean;
  setSembunyikan: Dispatch<SetStateAction<boolean>>;
  hak: HakChecklist;
  setImporBuka: Dispatch<SetStateAction<boolean>>;
  itemTampil: (items: ChecklistItem[]) => ChecklistItem[];
  peta: Map<string, ChecklistItem[]>;
  sedangId: string | null;
  aksi: {
    onToggle: (item: ChecklistItem) => void; onKendala: Dispatch<SetStateAction<ChecklistItem | null>>;
    onFoto: (item: ChecklistItem, file: File) => Promise<void>; aksiTambahan: (it: ChecklistItem) => JSX.Element;
  } | { onToggle?: undefined; onKendala?: undefined; onFoto?: undefined; aksiTambahan?: undefined; };
  setFormBagian: Dispatch<SetStateAction<FormBagian | null>>;
  setFormItem: Dispatch<SetStateAction<FormItem | null>>;
}

export function RingkasanDetailChecklist({
  detail, stat, hanyaKendala, setHanyaKendala, sembunyikan, setSembunyikan, hak, setImporBuka,
  itemTampil, peta, sedangId, aksi, setFormBagian, setFormItem,
}: RingkasanDetailChecklistProps) {
  return (
    <div className="space-y-3 min-w-0">
      <div className="flex items-center justify-between gap-2 flex-wrap rounded-xl px-4 py-2.5 shadow-xs"
        style={{ background: NETRAL.permukaan, border: `1px solid ${NETRAL.garis}` }}>
        <p className="text-[12px] font-bold" style={{ color: NETRAL.tinta2 }}>
          <span style={fontAngka}>{detail.bagian.length}</span> bagian · <span style={fontAngka}>{stat.total - stat.selesai}</span> item belum selesai
        </p>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-[12px] font-semibold cursor-pointer" style={{ color: NETRAL.tinta2 }}>
            <input type="checkbox" checked={hanyaKendala} onChange={e => setHanyaKendala(e.target.checked)} className="w-4 h-4 accent-amber-600" />
            Hanya kendala
          </label>
          <label className="flex items-center gap-2 text-[12px] font-semibold cursor-pointer" style={{ color: NETRAL.tinta2 }}>
            <input type="checkbox" checked={sembunyikan} onChange={e => setSembunyikan(e.target.checked)} className="w-4 h-4 accent-blue-600" />
            Sembunyikan yang selesai
          </label>
        </div>
      </div>
    
      {detail.bagian.length === 0 && (
        <div className="rounded-xl p-8 text-center space-y-3" style={{ background: NETRAL.permukaan, border: `1px dashed ${NETRAL.garisKuat}` }}>
          <p className="text-[14px] font-bold" style={{ color: NETRAL.tinta }}>Checklist ini masih kosong</p>
          <p className="text-[12.5px]" style={{ color: NETRAL.tinta2 }}>
            {hak.edit ? 'Impor dari teks/Markdown atau Excel, atau tambahkan bagian satu per satu.' : 'Admin atau anggota yang di-assign belum mengisi checklist ini.'}
          </p>
          {hak.edit && (
            <button onClick={() => setImporBuka(true)} className={kecil} style={{ background: TEMA.warna, color: '#fff' }}>
              <Upload size={14} /> Impor isi checklist
            </button>
          )}
        </div>
      )}
    
      {detail.bagian.map(b => {
        const items = itemTampil(peta.get(b.id) ?? []);
        if (hanyaKendala && !items.length) return null;
        return (
          <PanelBagian key={b.id} bagian={b} items={items} sedangId={sedangId} sembunyikanSelesai={sembunyikan} aksi={aksi}
            aksiKepala={hak.edit ? (
              <button onClick={() => setFormBagian({ bagian: b, judul: b.judul, catatan: b.catatan })}
                aria-label={`Ubah bagian ${b.judul}`} className="p-1.5 rounded-md" style={{ color: TEMA.samar }}>
                <Pencil size={14} />
              </button>
            ) : undefined}
            kaki={hak.edit ? (
              <div className="px-3 sm:px-4 py-2" style={{ borderTop: `1px solid ${NETRAL.garis}` }}>
                <button onClick={() => {
                  const ada = peta.get(b.id) ?? [];
                  setFormItem({ mode: 'tambah', bagianId: b.id, teks: '', kelompok: ada[ada.length - 1]?.kelompok ?? '', catatan: '' });
                }} className="inline-flex items-center gap-1 text-[12px] font-bold" style={{ color: TEMA.warna }}>
                  <Plus size={14} /> Tambah item
                </button>
              </div>
            ) : undefined}
          />
        );
      })}
    
      {hak.edit && detail.bagian.length > 0 && (
        <button onClick={() => setFormBagian({ bagian: null, judul: '', catatan: '' })}
          className="inline-flex items-center gap-1 text-[12px] font-bold rounded-lg px-3 py-1.5 shadow-xs"
          style={{ color: TEMA.warna, background: NETRAL.permukaan, border: `1px solid ${NETRAL.garis}` }}>
          <Plus size={14} /> Tambah bagian
        </button>
      )}
    </div>
  );
}
