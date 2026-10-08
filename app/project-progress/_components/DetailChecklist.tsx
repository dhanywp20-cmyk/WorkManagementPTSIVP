'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft, CalendarDays, Copy, Download, Link2, Pencil, Plus, RefreshCw, Trash2, Upload, Users,
} from 'lucide-react';
import { ConfirmDialog, Modal, TombolModal, type ConfirmState } from '@/components/shared';
import { NETRAL } from '@/lib/desain';
import { loadXLSX } from '@/lib/xlsx-loader';
import {
  BATAS, KOLOM_TEMPLATE, formatTanggal, formatWaktu, keadaanJadwal, statDari,
  type ChecklistAnggota, type ChecklistBagian, type ChecklistDetail, type ChecklistItem, type ChecklistRiwayat,
  type DraftChecklist,
} from '@/lib/checklist';
import {
  BarProgres, CatatanTeks, KepingKendala, ModalKendala, PanelBagian, TEMA, fontAngka,
  itemPerBagian, kirimFoto, progresDariStat,
} from './tampilan';
import { ModalImpor } from './ModalImpor';
import { ModalShare } from './ModalShare';
import { PilihAnggota, type CalonAnggota } from './PilihAnggota';
import { ModalSalinChecklist, type ProyekPilihan } from './FormProyek';
import { BilahSimpan, useTertunda } from './tertunda';
import { panggil, pesanGalat } from './api';

type FormItem = { mode: 'tambah' | 'ubah'; bagianId: string; item?: ChecklistItem; teks: string; kelompok: string; catatan: string };
type FormBagian = { bagian: ChecklistBagian | null; judul: string; catatan: string };
type FormInfo = { judul: string; keterangan: string; start_date: string; target_date: string };

const LABEL_AKSI: Record<string, string> = {
  centang: 'mencentang', batal: 'membatalkan centang', kendala: 'menandai kendala', kendala_selesai: 'menyelesaikan kendala',
};

const kecil = 'inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-bold transition-colors';

/**
 * Satu checklist lokasi. Hak dari server (detail.hak):
 *   admin -> semua, termasuk ubah info/jadwal, atur anggota, hapus
 *   edit  -> anggota yang di-assign: centang, kendala, foto, item, impor, link tim
 *   lain  -> hanya lihat
 */
export function DetailChecklist({ id, onKembali, beritahu, onBerubah, calonAnggota, namaSaya, daftarProyek, onBukaChecklist }: {
  id: string;
  onKembali: () => void;
  beritahu: (type: 'success' | 'error', msg: string) => void;
  /** Menandai daftar proyek perlu dimuat ulang (dimuat saat kembali ke daftar, bukan sekarang). */
  onBerubah: () => void;
  calonAnggota: CalonAnggota[];
  /** Nama yang tampil pada centang yang belum disimpan. */
  namaSaya: string;
  /** Tujuan "Salin ke lokasi lain". */
  daftarProyek: ProyekPilihan[];
  onBukaChecklist: (id: string, proyekId: string) => void;
}) {
  const [detail, setDetail] = useState<ChecklistDetail | null>(null);
  const [galat, setGalat] = useState('');
  const [sedangId, setSedangId] = useState<string | null>(null);
  const [sembunyikan, setSembunyikan] = useState(false);
  const [hanyaKendala, setHanyaKendala] = useState(false);
  const [formItem, setFormItem] = useState<FormItem | null>(null);
  const [formBagian, setFormBagian] = useState<FormBagian | null>(null);
  const [formInfo, setFormInfo] = useState<FormInfo | null>(null);
  const [formAnggota, setFormAnggota] = useState<string[] | null>(null);
  const [kendalaUntuk, setKendalaUntuk] = useState<ChecklistItem | null>(null);
  const [imporBuka, setImporBuka] = useState(false);
  const [shareBuka, setShareBuka] = useState(false);
  const [konfirmasi, setKonfirmasi] = useState<ConfirmState | null>(null);
  const [menyimpan, setMenyimpan] = useState(false);
  const [menyimpanCentang, setMenyimpanCentang] = useState(false);
  const [salinBuka, setSalinBuka] = useState(false);

  const muat = useCallback(async () => {
    try {
      setDetail(await panggil<ChecklistDetail>(`/api/project-progress/checklist/${id}`));
      setGalat('');
    } catch (e) {
      setGalat(pesanGalat(e, 'Gagal memuat checklist.'));
    }
  }, [id]);

  useEffect(() => { muat(); }, [muat]);

  const ubah = useCallback(async (body: Record<string, unknown>) => {
    const hasil = await panggil<Record<string, unknown>>(`/api/project-progress/checklist/${id}`, { method: 'PATCH', body: JSON.stringify(body) });
    onBerubah();
    return hasil;
  }, [id, onBerubah]);

  const gantiItem = (baru: ChecklistItem) => setDetail(d => d && { ...d, items: d.items.map(i => (i.id === baru.id ? baru : i)) });

  const hak = detail?.hak ?? { admin: false, edit: false };
  // Centang & kendala ditampung sampai tombol Simpan ditekan - lihat tertunda.tsx.
  const t = useTertunda(detail?.items, namaSaya, 'admin');
  const itemsTampil = useMemo(() => (detail ? detail.items.map(t.tampil) : []), [detail, t.tampil]);
  const peta = useMemo(() => (detail ? itemPerBagian(detail.bagian, itemsTampil) : new Map<string, ChecklistItem[]>()), [detail, itemsTampil]);
  const stat = detail ? statDari(itemsTampil) : null;

  const toggle = (item: ChecklistItem) => t.toggle(item);

  const simpanKendala = async (item: ChecklistItem, kendala: boolean, catatan: string) => {
    t.aturKendala(item, kendala, catatan);
  };

  /** Kirim semua centang & kendala yang tertunda dalam SATU permintaan. */
  const simpanCentang = async () => {
    if (!t.jumlah || menyimpanCentang) return;
    setMenyimpanCentang(true);
    try {
      const hasil = await ubah({ aksi: 'simpan', perubahan: t.daftar }) as { items: ChecklistItem[]; riwayat: ChecklistRiwayat[] };
      const baru = new Map(hasil.items.map(i => [i.id, i]));
      setDetail(d => d && {
        ...d,
        items: d.items.map(i => baru.get(i.id) ?? i),
        riwayat: [...hasil.riwayat, ...(d.riwayat ?? [])].slice(0, 80),
      });
      t.reset();
      beritahu('success', `${hasil.items.length} item tersimpan.`);
    } catch (e) {
      beritahu('error', pesanGalat(e, 'Gagal menyimpan. Perubahan Anda masih ada - coba Simpan lagi.'));
    } finally {
      setMenyimpanCentang(false);
    }
  };

  const kembali = () => {
    if (!t.jumlah) { onKembali(); return; }
    setKonfirmasi({
      message: `${t.jumlah} perubahan belum disimpan`, description: 'Perubahan akan hilang bila kembali sekarang.',
      confirmLabel: 'Tetap kembali', danger: true, onConfirm: () => { setKonfirmasi(null); onKembali(); },
    });
  };

  const unggahFoto = async (item: ChecklistItem, file: File) => {
    setSedangId(item.id);
    try {
      gantiItem(await kirimFoto(`/api/project-progress/checklist/${id}/foto`, item.id, file));
      onBerubah();
      beritahu('success', 'Foto bukti tersimpan.');
    } catch (e) {
      beritahu('error', pesanGalat(e, 'Gagal mengunggah foto.'));
    } finally {
      setSedangId(null);
    }
  };

  /**
   * Jalankan satu aksi ubah lalu terapkan hasilnya ke layar TANPA memuat
   * ulang seluruh checklist (hemat egress). `terapkan` menerima jawaban server.
   */
  const jalankan = async (body: Record<string, unknown>, sukses: string, tutup: () => void,
    terapkan: (hasil: Record<string, unknown>) => void) => {
    setMenyimpan(true);
    try { const hasil = await ubah(body); terapkan(hasil); tutup(); beritahu('success', sukses); }
    catch (e) { beritahu('error', pesanGalat(e, 'Gagal menyimpan.')); }
    finally { setMenyimpan(false); }
  };

  const hapusItem = (item: ChecklistItem) => setKonfirmasi({
    message: 'Hapus item ini?',
    description: `"${item.teks}" dihapus dari checklist. Riwayat centangnya tetap tersimpan.`,
    confirmLabel: 'Hapus', danger: true,
    onConfirm: async () => {
      setKonfirmasi(null);
      try {
        await ubah({ aksi: 'hapusItem', itemId: item.id });
        setDetail(d => d && { ...d, items: d.items.filter(i => i.id !== item.id) });
        beritahu('success', 'Item dihapus.');
      }
      catch (e) { beritahu('error', pesanGalat(e, 'Gagal menghapus.')); }
    },
  });

  const hapusChecklist = () => setKonfirmasi({
    message: `Hapus checklist "${detail?.daftar.judul}"?`,
    description: 'Semua item, centang, foto, kendala, dan riwayatnya ikut terhapus permanen. Link tim berhenti berfungsi.',
    confirmLabel: 'Hapus permanen', danger: true,
    onConfirm: async () => {
      setKonfirmasi(null);
      try {
        await panggil(`/api/project-progress/checklist/${id}`, { method: 'DELETE' });
        onBerubah();
        beritahu('success', 'Checklist dihapus.');
        onKembali();
      } catch (e) { beritahu('error', pesanGalat(e, 'Gagal menghapus.')); }
    },
  });

  const imporIsi = async (draft: DraftChecklist) => {
    const { jumlah } = await ubah({ aksi: 'impor', draft }) as { jumlah: number };
    setImporBuka(false);
    await muat();
    beritahu('success', `${jumlah} item ditambahkan.`);
  };

  const ubahShare = async (aksi: 'share' | 'tokenBaru', aktif?: boolean) => {
    const hasil = await ubah({ aksi, aktif }) as { share_aktif: boolean; share_token: string };
    setDetail(d => d && { ...d, daftar: { ...d.daftar, ...hasil } });
  };

  const ekspor = () => {
    if (!detail) return;
    loadXLSX(XLSX => {
      const rows: string[][] = [[...KOLOM_TEMPLATE, 'Oleh', 'Waktu', 'Lewat', 'Kendala', 'Foto']];
      for (const b of detail.bagian) {
        const items = peta.get(b.id) ?? [];
        if (!items.length && b.catatan) rows.push([b.judul, '', '', b.catatan.replace(/\n/g, ' '), '', '', '', '', '', '']);
        for (const it of items) {
          rows.push([b.judul, it.kelompok, it.teks, it.catatan, it.selesai ? 'Selesai' : it.kendala ? 'Kendala' : 'Belum',
            it.selesai_oleh ?? '', formatWaktu(it.selesai_pada), it.selesai_lewat === 'link' ? 'link' : it.selesai ? 'aplikasi' : '',
            it.kendala ? `${it.kendala_catatan} (${it.kendala_oleh ?? ''} ${formatWaktu(it.kendala_pada)})` : '', it.foto_url ?? '']);
        }
      }
      const ws = XLSX.utils.aoa_to_sheet(rows);
      ws['!cols'] = [{ wch: 26 }, { wch: 18 }, { wch: 60 }, { wch: 30 }, { wch: 9 }, { wch: 18 }, { wch: 16 }, { wch: 8 }, { wch: 40 }, { wch: 30 }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Checklist');
      const nama = `${detail.proyek.nama} - ${detail.daftar.judul}`.replace(/[\\/:*?"<>|]+/g, '-').slice(0, 100);
      XLSX.writeFile(wb, `${nama}.xlsx`);
    });
  };

  const isian = 'mt-1 w-full rounded-xl px-3 py-2 text-[13px] outline-none focus:ring-2';
  const gayaIsian = { border: `1px solid ${NETRAL.garis}`, color: NETRAL.tinta, background: NETRAL.permukaan };
  const label = (t: string) => <span className="text-[12px] font-bold" style={{ color: NETRAL.tinta2 }}>{t}</span>;

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
  if (!detail || !stat) {
    return <div className="py-16 text-center text-sm font-semibold" style={{ color: TEMA.samar }}>Memuat checklist…</div>;
  }

  const { daftar, proyek } = detail;
  const jadwal = keadaanJadwal(daftar.target_date, stat.total > 0 && stat.selesai === stat.total);
  const warnaJadwal = jadwal.keadaan === 'terlambat' ? TEMA.bahaya : jadwal.keadaan === 'dekat' ? TEMA.kendala : jadwal.keadaan === 'selesai' ? TEMA.selesai : TEMA.samar;

  const aksi = hak.edit ? {
    onToggle: toggle,
    onKendala: setKendalaUntuk,
    onFoto: unggahFoto,
    aksiTambahan: (it: ChecklistItem) => (
      <span className="flex gap-0.5 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100 transition-opacity">
        <button onClick={() => setFormItem({ mode: 'ubah', bagianId: it.bagian_id, item: it, teks: it.teks, kelompok: it.kelompok, catatan: it.catatan })}
          aria-label={`Ubah item ${it.teks}`} className="p-1.5 rounded-md" style={{ color: TEMA.samar }}>
          <Pencil size={13} />
        </button>
        <button onClick={() => hapusItem(it)} aria-label={`Hapus item ${it.teks}`} className="p-1.5 rounded-md" style={{ color: TEMA.bahaya }}>
          <Trash2 size={13} />
        </button>
      </span>
    ),
  } : {};

  const itemTampil = (items: ChecklistItem[]) => (hanyaKendala ? items.filter(i => i.kendala && !i.selesai) : items);

  return (
    <div className="space-y-4">
      {/* Kepala */}
      <div className="rounded-xl p-4 space-y-3" style={{ background: NETRAL.permukaan, border: `1px solid ${NETRAL.garis}` }}>
        <div className="flex items-start gap-3 flex-wrap">
          <button onClick={kembali} aria-label="Kembali ke proyek"
            className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
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
                <button onClick={() => setFormInfo({ judul: daftar.judul, keterangan: daftar.keterangan, start_date: daftar.start_date ?? '', target_date: daftar.target_date ?? '' })}
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
        {daftar.keterangan && <CatatanTeks teks={daftar.keterangan} />}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px] items-start">
        <div className="space-y-3 min-w-0">
          <div className="flex items-center justify-between gap-2 flex-wrap">
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
              className="inline-flex items-center gap-1 text-[12px] font-bold" style={{ color: TEMA.warna }}>
              <Plus size={14} /> Tambah bagian
            </button>
          )}
        </div>

        {/* Riwayat: siapa mengerjakan apa, kapan */}
        <aside className="rounded-xl overflow-hidden lg:sticky lg:top-20" style={{ background: NETRAL.permukaan, border: `1px solid ${NETRAL.garis}` }}>
          <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: `1px solid ${NETRAL.garis}` }}>
            <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: NETRAL.tinta2 }}>Riwayat pengerjaan</p>
            <button onClick={muat} aria-label="Muat ulang" className="p-1 rounded-md" style={{ color: TEMA.samar }}><RefreshCw size={14} /></button>
          </div>
          <div className="max-h-[60vh] overflow-y-auto divide-y" style={{ borderColor: NETRAL.garis }}>
            {(detail.riwayat ?? []).length === 0 && (
              <p className="px-4 py-6 text-[12px] text-center" style={{ color: TEMA.samar }}>Belum ada item yang dikerjakan.</p>
            )}
            {(detail.riwayat ?? []).map(r => (
              <div key={r.id} className="px-4 py-2.5">
                <p className="text-[12px] leading-snug" style={{ color: NETRAL.tinta }}>
                  <b>{r.nama}</b> {LABEL_AKSI[r.aksi] ?? r.aksi} <span style={{ color: NETRAL.tinta2 }}>{r.teks_item}</span>
                </p>
                <p className="text-[10.5px] mt-0.5" style={{ color: r.aksi === 'kendala' ? TEMA.kendala : TEMA.samar }}>
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
          <TombolModal jenis="utama" disabled={menyimpan || !formItem?.teks.trim()} onClick={() => formItem && jalankan(
            formItem.mode === 'tambah'
              ? { aksi: 'tambahItem', bagianId: formItem.bagianId, teks: formItem.teks, kelompok: formItem.kelompok, catatan: formItem.catatan }
              : { aksi: 'ubahItem', itemId: formItem.item!.id, teks: formItem.teks, kelompok: formItem.kelompok, catatan: formItem.catatan },
            formItem.mode === 'tambah' ? 'Item ditambahkan.' : 'Item diperbarui.', () => setFormItem(null),
            h => {
              const it = h.item as ChecklistItem;
              setDetail(d => d && { ...d, items: formItem.mode === 'tambah' ? [...d.items, it] : d.items.map(i => (i.id === it.id ? it : i)) });
            })}>
            {menyimpan ? 'Menyimpan…' : 'Simpan'}
          </TombolModal>
        </>}>
        {formItem && (
          <div className="space-y-3">
            <label className="block">{label('Item')}
              <textarea value={formItem.teks} rows={3} maxLength={BATAS.teks} autoFocus
                onChange={e => setFormItem({ ...formItem, teks: e.target.value })} className={isian} style={gayaIsian} /></label>
            <label className="block">{label('Kelompok (opsional)')}
              <input value={formItem.kelompok} maxLength={BATAS.judul} placeholder="mis. Zona TABLE"
                onChange={e => setFormItem({ ...formItem, kelompok: e.target.value })} className={isian} style={gayaIsian} /></label>
            <label className="block">{label('Catatan (opsional)')}
              <textarea value={formItem.catatan} rows={2} maxLength={BATAS.catatan}
                onChange={e => setFormItem({ ...formItem, catatan: e.target.value })} className={isian} style={gayaIsian} /></label>
          </div>
        )}
      </Modal>

      {/* Form bagian */}
      <Modal buka={!!formBagian} onTutup={() => !menyimpan && setFormBagian(null)} ukuran="lg" tutupDiLuar={false}
        judul={formBagian?.bagian ? 'Ubah bagian' : 'Tambah bagian'}
        keterangan="Catatan mendukung teks, poin (- ...), dan tabel pipa (| a | b |)."
        footer={<>
          <TombolModal onClick={() => setFormBagian(null)} disabled={menyimpan}>Batal</TombolModal>
          <TombolModal jenis="utama" disabled={menyimpan || !formBagian?.judul.trim()} onClick={() => formBagian && jalankan(
            formBagian.bagian
              ? { aksi: 'ubahBagian', bagianId: formBagian.bagian.id, judul: formBagian.judul, catatan: formBagian.catatan }
              : { aksi: 'tambahBagian', judul: formBagian.judul },
            formBagian.bagian ? 'Bagian diperbarui.' : 'Bagian ditambahkan.', () => setFormBagian(null),
            h => setDetail(d => d && {
              ...d,
              bagian: formBagian.bagian
                ? d.bagian.map(b => (b.id === formBagian.bagian!.id ? { ...b, judul: formBagian.judul.trim(), catatan: formBagian.catatan } : b))
                : [...d.bagian, h.bagian as ChecklistBagian],
            }))}>
            {menyimpan ? 'Menyimpan…' : 'Simpan'}
          </TombolModal>
        </>}>
        {formBagian && (
          <div className="space-y-3">
            <label className="block">{label('Judul bagian')}
              <input value={formBagian.judul} maxLength={BATAS.judul} autoFocus placeholder="mis. 5. Pengujian"
                onChange={e => setFormBagian({ ...formBagian, judul: e.target.value })} className={isian} style={gayaIsian} /></label>
            {formBagian.bagian && (
              <label className="block">{label('Catatan')}
                <textarea value={formBagian.catatan} rows={8} maxLength={BATAS.catatan}
                  onChange={e => setFormBagian({ ...formBagian, catatan: e.target.value })} className={`${isian} font-mono text-[12px]`} style={gayaIsian} /></label>
            )}
          </div>
        )}
      </Modal>

      {/* Form info & jadwal (admin) */}
      <Modal buka={!!formInfo} onTutup={() => !menyimpan && setFormInfo(null)} ukuran="lg" tutupDiLuar={false}
        judul="Ubah info & jadwal checklist"
        footer={<>
          <TombolModal onClick={() => setFormInfo(null)} disabled={menyimpan}>Batal</TombolModal>
          <TombolModal jenis="utama" disabled={menyimpan || !formInfo?.judul.trim()}
            onClick={() => formInfo && jalankan({ aksi: 'ubahInfo', ...formInfo }, 'Info checklist diperbarui.', () => setFormInfo(null),
              () => setDetail(d => d && { ...d, daftar: {
                ...d.daftar, judul: formInfo.judul.trim(), keterangan: formInfo.keterangan,
                start_date: formInfo.start_date || null, target_date: formInfo.target_date || null,
              } }))}>
            {menyimpan ? 'Menyimpan…' : 'Simpan'}
          </TombolModal>
        </>}>
        {formInfo && (
          <div className="space-y-3">
            <label className="block">{label('Nama lokasi / ruangan')}
              <input value={formInfo.judul} maxLength={BATAS.judul}
                onChange={e => setFormInfo({ ...formInfo, judul: e.target.value })} className={isian} style={gayaIsian} /></label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">{label('Mulai')}
                <input type="date" value={formInfo.start_date} onChange={e => setFormInfo({ ...formInfo, start_date: e.target.value })} className={isian} style={gayaIsian} /></label>
              <label className="block">{label('Target selesai')}
                <input type="date" value={formInfo.target_date} onChange={e => setFormInfo({ ...formInfo, target_date: e.target.value })} className={isian} style={gayaIsian} /></label>
            </div>
            <label className="block">{label('Keterangan')}
              <textarea value={formInfo.keterangan} rows={5} maxLength={BATAS.keterangan}
                onChange={e => setFormInfo({ ...formInfo, keterangan: e.target.value })} className={isian} style={gayaIsian} /></label>
          </div>
        )}
      </Modal>

      {/* Anggota (admin) */}
      <Modal buka={!!formAnggota} onTutup={() => !menyimpan && setFormAnggota(null)} ukuran="md" tutupDiLuar={false} ikon="👥"
        judul="Anggota checklist" keterangan="Yang di-assign bisa mencentang, menandai kendala, mengunggah foto, dan mengubah item checklist ini."
        footer={<>
          <TombolModal onClick={() => setFormAnggota(null)} disabled={menyimpan}>Batal</TombolModal>
          <TombolModal jenis="utama" disabled={menyimpan}
            onClick={() => formAnggota && jalankan({ aksi: 'anggota', anggota: formAnggota }, 'Anggota diperbarui.', () => setFormAnggota(null),
              h => {
                setDetail(d => d && { ...d, anggota: h.anggota as ChecklistAnggota[] });
                const kabar = h.kabar as { terkirim: number; tanpaTelegram: number } | undefined;
                if (kabar && (kabar.terkirim || kabar.tanpaTelegram)) {
                  beritahu('success', `Anggota diperbarui. Telegram terkirim ke ${kabar.terkirim} orang`
                    + (kabar.tanpaTelegram ? `; ${kabar.tanpaTelegram} belum menghubungkan Telegram.` : '.'));
                }
              })}>
            {menyimpan ? 'Menyimpan…' : 'Simpan'}
          </TombolModal>
        </>}>
        {formAnggota && <PilihAnggota calon={calonAnggota} terpilih={formAnggota} onUbah={setFormAnggota} />}
      </Modal>

      <ModalKendala item={kendalaUntuk} onTutup={() => setKendalaUntuk(null)} onSimpan={simpanKendala} />
      <BilahSimpan jumlah={t.jumlah} sibuk={menyimpanCentang} onSimpan={simpanCentang} onBatal={t.reset} />
      <ModalSalinChecklist buka={salinBuka} onTutup={() => setSalinBuka(false)} calonAnggota={calonAnggota} daftarProyek={daftarProyek}
        sumber={{ id: daftar.id, judul: daftar.judul, proyekId: daftar.proyek_id, anggota: detail.anggota.map(a => a.user_id), jumlahItem: stat.total }}
        onDibuat={(baruId, proyekId) => { setSalinBuka(false); onBerubah(); beritahu('success', 'Checklist disalin. Silakan edit yang perlu.'); onBukaChecklist(baruId, proyekId); }} />
      <ModalImpor buka={imporBuka} onTutup={() => setImporBuka(false)} onSimpan={imporIsi}
        labelSimpan={n => `Tambahkan ${n} item`} />
      <ModalShare beritahu={beritahu} onUbah={ubahShare} onTutup={() => setShareBuka(false)}
        target={shareBuka ? { jenis: 'checklist', judul: `${proyek.nama} · ${daftar.judul}`, share_aktif: daftar.share_aktif, share_token: daftar.share_token } : null} />
      <ConfirmDialog state={konfirmasi} onCancel={() => setKonfirmasi(null)} />
    </div>
  );
}
