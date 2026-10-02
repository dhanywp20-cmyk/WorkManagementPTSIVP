'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Copy, Download, Link2, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { ConfirmDialog, Modal, TombolModal, type ConfirmState } from '@/components/shared';
import { NETRAL } from '@/lib/desain';
import { loadXLSX } from '@/lib/xlsx-loader';
import {
  BATAS, KOLOM_TEMPLATE, formatWaktu, hitungProgres,
  type ChecklistBagian, type ChecklistDaftar, type ChecklistDetail, type ChecklistItem,
} from '@/lib/checklist';
import { BarProgres, CatatanTeks, PanelBagian, TEMA, fontAngka, itemPerBagian } from './tampilan';

type FormItem = { mode: 'tambah' | 'ubah'; bagianId: string; item?: ChecklistItem; teks: string; kelompok: string; catatan: string };
type FormBagian = { bagian: ChecklistBagian; judul: string; catatan: string };
type FormInfo = { judul: string; keterangan: string };

async function panggil<T = unknown>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: 'no-store', ...init, headers: { 'Content-Type': 'application/json', ...init?.headers } });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((json as { error?: string }).error || `Gagal (${res.status})`);
  return json as T;
}

const kecil = 'inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-bold transition-colors';

export function DetailChecklist({ id, onKembali, onShare, onDuplikat, beritahu, onBerubah, versiShare }: {
  id: string;
  onKembali: () => void;
  onShare: (d: ChecklistDaftar) => void;
  onDuplikat: (d: ChecklistDaftar) => void;
  beritahu: (type: 'success' | 'error', msg: string) => void;
  /** Dipanggil sesudah ada perubahan supaya angka di daftar ikut segar. */
  onBerubah: () => void;
  /** Naik tiap kali link share diubah dari modal di halaman induk. */
  versiShare: number;
}) {
  const [detail, setDetail] = useState<ChecklistDetail | null>(null);
  const [galat, setGalat] = useState('');
  const [sedangId, setSedangId] = useState<string | null>(null);
  const [sembunyikan, setSembunyikan] = useState(false);
  const [formItem, setFormItem] = useState<FormItem | null>(null);
  const [formBagian, setFormBagian] = useState<FormBagian | null>(null);
  const [formInfo, setFormInfo] = useState<FormInfo | null>(null);
  const [konfirmasi, setKonfirmasi] = useState<ConfirmState | null>(null);
  const [menyimpan, setMenyimpan] = useState(false);

  const muat = useCallback(async () => {
    try {
      setDetail(await panggil<ChecklistDetail>(`/api/checklist/${id}`));
      setGalat('');
    } catch (e) {
      setGalat(e instanceof Error ? e.message : 'Gagal memuat checklist.');
    }
  }, [id]);

  useEffect(() => { muat(); }, [muat, versiShare]);

  const ubah = useCallback(async (body: Record<string, unknown>) => {
    const hasil = await panggil<Record<string, unknown>>(`/api/checklist/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
    onBerubah();
    return hasil;
  }, [id, onBerubah]);

  const peta = useMemo(() => (detail ? itemPerBagian(detail.bagian, detail.items) : new Map()), [detail]);
  const progres = detail ? hitungProgres(detail.items) : null;

  const toggle = async (item: ChecklistItem) => {
    if (!detail || sedangId) return;
    setSedangId(item.id);
    try {
      const { item: baru } = await ubah({ aksi: 'centang', itemId: item.id, selesai: !item.selesai }) as { item: ChecklistItem };
      setDetail(d => d && { ...d, items: d.items.map(i => (i.id === baru.id ? baru : i)) });
      muat(); // riwayat ikut segar
    } catch (e) {
      beritahu('error', e instanceof Error ? e.message : 'Gagal mencentang.');
    } finally {
      setSedangId(null);
    }
  };

  const simpanItem = async () => {
    if (!formItem || !formItem.teks.trim()) return;
    setMenyimpan(true);
    try {
      await ubah(formItem.mode === 'tambah'
        ? { aksi: 'tambahItem', bagianId: formItem.bagianId, teks: formItem.teks, kelompok: formItem.kelompok, catatan: formItem.catatan }
        : { aksi: 'ubahItem', itemId: formItem.item!.id, teks: formItem.teks, kelompok: formItem.kelompok, catatan: formItem.catatan });
      setFormItem(null);
      await muat();
      beritahu('success', formItem.mode === 'tambah' ? 'Item ditambahkan.' : 'Item diperbarui.');
    } catch (e) { beritahu('error', e instanceof Error ? e.message : 'Gagal menyimpan item.'); }
    finally { setMenyimpan(false); }
  };

  const simpanBagian = async () => {
    if (!formBagian || !formBagian.judul.trim()) return;
    setMenyimpan(true);
    try {
      await ubah({ aksi: 'ubahBagian', bagianId: formBagian.bagian.id, judul: formBagian.judul, catatan: formBagian.catatan });
      setFormBagian(null);
      await muat();
      beritahu('success', 'Bagian diperbarui.');
    } catch (e) { beritahu('error', e instanceof Error ? e.message : 'Gagal menyimpan bagian.'); }
    finally { setMenyimpan(false); }
  };

  const simpanInfo = async () => {
    if (!formInfo || !formInfo.judul.trim()) return;
    setMenyimpan(true);
    try {
      await ubah({ aksi: 'ubahInfo', judul: formInfo.judul, keterangan: formInfo.keterangan });
      setFormInfo(null);
      await muat();
      beritahu('success', 'Info checklist diperbarui.');
    } catch (e) { beritahu('error', e instanceof Error ? e.message : 'Gagal menyimpan.'); }
    finally { setMenyimpan(false); }
  };

  const hapusItem = (item: ChecklistItem) => setKonfirmasi({
    message: 'Hapus item ini?',
    description: `"${item.teks}" dihapus dari checklist. Riwayat centangnya tetap tersimpan.`,
    confirmLabel: 'Hapus', danger: true,
    onConfirm: async () => {
      setKonfirmasi(null);
      try { await ubah({ aksi: 'hapusItem', itemId: item.id }); await muat(); beritahu('success', 'Item dihapus.'); }
      catch (e) { beritahu('error', e instanceof Error ? e.message : 'Gagal menghapus.'); }
    },
  });

  const ekspor = () => {
    if (!detail) return;
    loadXLSX(XLSX => {
      const rows: (string)[][] = [[...KOLOM_TEMPLATE, 'Oleh', 'Waktu', 'Lewat']];
      for (const b of detail.bagian) {
        const items = peta.get(b.id) ?? [];
        if (!items.length && b.catatan) rows.push([b.judul, '', '', b.catatan.replace(/\n/g, ' '), '', '', '', '']);
        for (const it of items) {
          rows.push([b.judul, it.kelompok, it.teks, it.catatan, it.selesai ? 'Selesai' : 'Belum',
            it.selesai_oleh ?? '', formatWaktu(it.selesai_pada), it.selesai_lewat ?? '']);
        }
      }
      const ws = XLSX.utils.aoa_to_sheet(rows);
      ws['!cols'] = [{ wch: 26 }, { wch: 18 }, { wch: 60 }, { wch: 30 }, { wch: 9 }, { wch: 18 }, { wch: 16 }, { wch: 7 }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Checklist');
      const nama = detail.daftar.judul.replace(/[\\/:*?"<>|]+/g, '-').slice(0, 80);
      XLSX.writeFile(wb, `${nama}.xlsx`);
    });
  };

  const isian = 'mt-1 w-full rounded-xl px-3 py-2 text-[13px] outline-none focus:ring-2';
  const gayaIsian = { border: `1px solid ${NETRAL.garis}`, color: NETRAL.tinta, background: NETRAL.permukaan };

  if (galat && !detail) {
    return (
      <div className="rounded-xl p-8 text-center space-y-3" style={{ background: NETRAL.permukaan, border: `1px solid ${NETRAL.garis}` }}>
        <p className="text-sm font-bold" style={{ color: NETRAL.tinta }}>{galat}</p>
        <div className="flex justify-center gap-2">
          <button onClick={onKembali} className={kecil} style={{ border: `1px solid ${NETRAL.garis}`, color: NETRAL.tinta2 }}>Kembali</button>
          <button onClick={muat} className={kecil} style={{ background: TEMA.warna, color: '#fff' }}>Coba lagi</button>
        </div>
      </div>
    );
  }

  if (!detail || !progres) {
    return <div className="py-16 text-center text-sm font-semibold" style={{ color: TEMA.samar }}>Memuat checklist…</div>;
  }

  const { daftar } = detail;

  return (
    <div className="space-y-4">
      {/* Kepala: kembali + judul + aksi */}
      <div className="rounded-xl p-4 space-y-3" style={{ background: NETRAL.permukaan, border: `1px solid ${NETRAL.garis}` }}>
        <div className="flex items-start gap-3 flex-wrap">
          <button onClick={onKembali} aria-label="Kembali ke daftar checklist"
            className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ border: `1px solid ${NETRAL.garis}`, color: NETRAL.tinta2 }}>
            <ArrowLeft size={16} />
          </button>
          <div className="flex-1 min-w-[200px]">
            <h2 className="text-[17px] font-bold leading-tight" style={{ color: NETRAL.tinta }}>{daftar.judul}</h2>
            <p className="text-[11.5px] mt-0.5" style={{ color: TEMA.samar }}>
              Diimpor {formatWaktu(daftar.created_at)}{daftar.dibuat_oleh_nama ? ` oleh ${daftar.dibuat_oleh_nama}` : ''} · diperbarui {formatWaktu(daftar.updated_at)}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={() => onShare(daftar)} className={kecil}
              style={{ background: daftar.share_aktif ? TEMA.selesaiTint : TEMA.warna, color: daftar.share_aktif ? TEMA.selesai : '#fff',
                border: daftar.share_aktif ? `1px solid #bbf7d0` : 'none' }}>
              <Link2 size={14} /> {daftar.share_aktif ? 'Link aktif' : 'Bagikan link'}
            </button>
            <button onClick={ekspor} className={kecil} style={{ border: `1px solid ${NETRAL.garis}`, color: NETRAL.tinta2 }}>
              <Download size={14} /> Ekspor Excel
            </button>
            <button onClick={() => onDuplikat(daftar)} className={kecil} style={{ border: `1px solid ${NETRAL.garis}`, color: NETRAL.tinta2 }}>
              <Copy size={14} /> Duplikat
            </button>
            <button onClick={() => setFormInfo({ judul: daftar.judul, keterangan: daftar.keterangan })} aria-label="Ubah judul & keterangan"
              className={kecil} style={{ border: `1px solid ${NETRAL.garis}`, color: NETRAL.tinta2 }}>
              <Pencil size={14} />
            </button>
          </div>
        </div>
        <BarProgres progres={progres} tebal={10} />
        {daftar.keterangan && <CatatanTeks teks={daftar.keterangan} />}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px] items-start">
        <div className="space-y-3 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[12px] font-bold" style={{ color: NETRAL.tinta2 }}>
              <span style={fontAngka}>{detail.bagian.length}</span> bagian · <span style={fontAngka}>{progres.total - progres.selesai}</span> item belum selesai
            </p>
            <label className="flex items-center gap-2 text-[12px] font-semibold cursor-pointer" style={{ color: NETRAL.tinta2 }}>
              <input type="checkbox" checked={sembunyikan} onChange={e => setSembunyikan(e.target.checked)} className="w-4 h-4 accent-blue-600" />
              Sembunyikan yang selesai
            </label>
          </div>

          {detail.bagian.map(b => (
            <PanelBagian key={b.id} bagian={b} items={peta.get(b.id) ?? []}
              onToggle={toggle} sedangId={sedangId} sembunyikanSelesai={sembunyikan}
              aksiKepala={(
                <button onClick={() => setFormBagian({ bagian: b, judul: b.judul, catatan: b.catatan })}
                  aria-label={`Ubah bagian ${b.judul}`} className="p-1.5 rounded-md" style={{ color: TEMA.samar }}>
                  <Pencil size={14} />
                </button>
              )}
              aksiItem={it => (
                <span className="flex gap-0.5 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100 transition-opacity">
                  <button onClick={() => setFormItem({ mode: 'ubah', bagianId: b.id, item: it, teks: it.teks, kelompok: it.kelompok, catatan: it.catatan })}
                    aria-label={`Ubah item ${it.teks}`} className="p-1.5 rounded-md" style={{ color: TEMA.samar }}>
                    <Pencil size={13} />
                  </button>
                  <button onClick={() => hapusItem(it)} aria-label={`Hapus item ${it.teks}`} className="p-1.5 rounded-md" style={{ color: '#dc2626' }}>
                    <Trash2 size={13} />
                  </button>
                </span>
              )}
              kaki={(
                <div className="px-3 sm:px-4 py-2" style={{ borderTop: `1px solid ${NETRAL.garis}` }}>
                  <button onClick={() => {
                    const items = peta.get(b.id) ?? [];
                    setFormItem({ mode: 'tambah', bagianId: b.id, teks: '', kelompok: items[items.length - 1]?.kelompok ?? '', catatan: '' });
                  }} className="inline-flex items-center gap-1 text-[12px] font-bold" style={{ color: TEMA.warna }}>
                    <Plus size={14} /> Tambah item
                  </button>
                </div>
              )}
            />
          ))}
        </div>

        {/* Panel samping: riwayat centang terbaru */}
        <aside className="rounded-xl overflow-hidden lg:sticky lg:top-20" style={{ background: NETRAL.permukaan, border: `1px solid ${NETRAL.garis}` }}>
          <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: `1px solid ${NETRAL.garis}` }}>
            <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: NETRAL.tinta2 }}>Riwayat centang</p>
            <button onClick={muat} aria-label="Muat ulang" className="p-1 rounded-md" style={{ color: TEMA.samar }}><RefreshCw size={14} /></button>
          </div>
          <div className="max-h-[60vh] overflow-y-auto divide-y" style={{ borderColor: NETRAL.garis }}>
            {(detail.riwayat ?? []).length === 0 && (
              <p className="px-4 py-6 text-[12px] text-center" style={{ color: TEMA.samar }}>Belum ada item yang dicentang.</p>
            )}
            {(detail.riwayat ?? []).map(r => (
              <div key={r.id} className="px-4 py-2.5">
                <p className="text-[12px] leading-snug" style={{ color: NETRAL.tinta }}>
                  <b>{r.nama}</b> {r.aksi === 'centang' ? 'mencentang' : 'membatalkan'} <span style={{ color: NETRAL.tinta2 }}>{r.teks_item}</span>
                </p>
                <p className="text-[10.5px] mt-0.5" style={{ color: TEMA.samar }}>
                  {formatWaktu(r.created_at)} · {r.lewat === 'link' ? 'via link' : 'di aplikasi'}
                </p>
              </div>
            ))}
          </div>
        </aside>
      </div>

      {/* Form item */}
      <Modal buka={!!formItem} onTutup={() => !menyimpan && setFormItem(null)} ukuran="md" tutupDiLuar={false}
        judul={formItem?.mode === 'tambah' ? 'Tambah item' : 'Ubah item'}
        footer={<>
          <TombolModal onClick={() => setFormItem(null)} disabled={menyimpan}>Batal</TombolModal>
          <TombolModal jenis="utama" onClick={simpanItem} disabled={menyimpan || !formItem?.teks.trim()}>{menyimpan ? 'Menyimpan…' : 'Simpan'}</TombolModal>
        </>}>
        {formItem && (
          <div className="space-y-3">
            <label className="block"><span className="text-[12px] font-bold" style={{ color: NETRAL.tinta2 }}>Item</span>
              <textarea value={formItem.teks} rows={3} maxLength={BATAS.teks} autoFocus
                onChange={e => setFormItem({ ...formItem, teks: e.target.value })} className={isian} style={gayaIsian} /></label>
            <label className="block"><span className="text-[12px] font-bold" style={{ color: NETRAL.tinta2 }}>Kelompok (opsional)</span>
              <input value={formItem.kelompok} maxLength={BATAS.judul} placeholder="mis. Zona TABLE"
                onChange={e => setFormItem({ ...formItem, kelompok: e.target.value })} className={isian} style={gayaIsian} /></label>
            <label className="block"><span className="text-[12px] font-bold" style={{ color: NETRAL.tinta2 }}>Catatan (opsional)</span>
              <textarea value={formItem.catatan} rows={2} maxLength={BATAS.catatan}
                onChange={e => setFormItem({ ...formItem, catatan: e.target.value })} className={isian} style={gayaIsian} /></label>
          </div>
        )}
      </Modal>

      {/* Form bagian */}
      <Modal buka={!!formBagian} onTutup={() => !menyimpan && setFormBagian(null)} ukuran="lg" tutupDiLuar={false}
        judul="Ubah bagian" keterangan="Catatan mendukung teks, poin (- ...), dan tabel pipa (| a | b |)."
        footer={<>
          <TombolModal onClick={() => setFormBagian(null)} disabled={menyimpan}>Batal</TombolModal>
          <TombolModal jenis="utama" onClick={simpanBagian} disabled={menyimpan || !formBagian?.judul.trim()}>{menyimpan ? 'Menyimpan…' : 'Simpan'}</TombolModal>
        </>}>
        {formBagian && (
          <div className="space-y-3">
            <label className="block"><span className="text-[12px] font-bold" style={{ color: NETRAL.tinta2 }}>Judul bagian</span>
              <input value={formBagian.judul} maxLength={BATAS.judul}
                onChange={e => setFormBagian({ ...formBagian, judul: e.target.value })} className={isian} style={gayaIsian} /></label>
            <label className="block"><span className="text-[12px] font-bold" style={{ color: NETRAL.tinta2 }}>Catatan</span>
              <textarea value={formBagian.catatan} rows={8} maxLength={BATAS.catatan}
                onChange={e => setFormBagian({ ...formBagian, catatan: e.target.value })} className={`${isian} font-mono text-[12px]`} style={gayaIsian} /></label>
          </div>
        )}
      </Modal>

      {/* Form info */}
      <Modal buka={!!formInfo} onTutup={() => !menyimpan && setFormInfo(null)} ukuran="lg" tutupDiLuar={false}
        judul="Ubah judul & keterangan"
        footer={<>
          <TombolModal onClick={() => setFormInfo(null)} disabled={menyimpan}>Batal</TombolModal>
          <TombolModal jenis="utama" onClick={simpanInfo} disabled={menyimpan || !formInfo?.judul.trim()}>{menyimpan ? 'Menyimpan…' : 'Simpan'}</TombolModal>
        </>}>
        {formInfo && (
          <div className="space-y-3">
            <label className="block"><span className="text-[12px] font-bold" style={{ color: NETRAL.tinta2 }}>Judul</span>
              <input value={formInfo.judul} maxLength={BATAS.judul}
                onChange={e => setFormInfo({ ...formInfo, judul: e.target.value })} className={isian} style={gayaIsian} /></label>
            <label className="block"><span className="text-[12px] font-bold" style={{ color: NETRAL.tinta2 }}>Keterangan</span>
              <textarea value={formInfo.keterangan} rows={5} maxLength={BATAS.keterangan}
                onChange={e => setFormInfo({ ...formInfo, keterangan: e.target.value })} className={isian} style={gayaIsian} /></label>
          </div>
        )}
      </Modal>

      <ConfirmDialog state={konfirmasi} onCancel={() => setKonfirmasi(null)} />
    </div>
  );
}
