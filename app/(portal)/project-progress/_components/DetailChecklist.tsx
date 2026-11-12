'use client';
import { Pencil, RefreshCw, Trash2 } from 'lucide-react';
import { ConfirmDialog, Modal, TombolModal } from '@/components/shared';
import { NETRAL } from '@/lib/desain';
import { BATAS, formatWaktu, keadaanJadwal, type ChecklistAnggota, type ChecklistBagian, type ChecklistItem } from '@/lib/checklist/inti';
import { ModalKendala, TEMA } from './tampilan';
import { LipatRingkasan, RingkasanChecklist, adaRingkasanChecklist } from './ringkasan/Ringkasan';
import { ModalImpor } from './ModalImpor';
import { ModalShare } from './ModalShare';
import { PilihAnggota, type CalonAnggota } from './PilihAnggota';
import { ModalSalinChecklist, type ProyekPilihan } from './FormProyek';
import { BilahSimpan } from './tertunda';
import { useDetailChecklist } from './useDetailChecklist';
import { RingkasanDetailChecklist } from './RingkasanDetailChecklist';
import { KepalaDetailChecklist } from './KepalaDetailChecklist';

export type FormItem = { mode: 'tambah' | 'ubah'; bagianId: string; item?: ChecklistItem; teks: string; kelompok: string; catatan: string };
export type FormBagian = { bagian: ChecklistBagian | null; judul: string; catatan: string };
export type FormInfo = { judul: string; keterangan: string; support_lokasi: string; start_date: string; target_date: string };

const LABEL_AKSI: Record<string, string> = {
  centang: 'mencentang', batal: 'membatalkan centang', kendala: 'menandai kendala', kendala_selesai: 'menyelesaikan kendala',
};

export const kecil = 'inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-bold transition-colors';

export function DetailChecklist({ id, onKembali, beritahu, onBerubah, calonAnggota, namaSaya, daftarProyek, onBukaChecklist }: {
  id: string;
  onKembali: () => void;
  beritahu: (type: 'success' | 'error', msg: string) => void;
  onBerubah: () => void;
  calonAnggota: CalonAnggota[];
  namaSaya: string;
  daftarProyek: ProyekPilihan[];
  onBukaChecklist: (id: string, proyekId: string) => void;
}) {
  const {
    galat, detail, muat, stat, hak, toggle, setKendalaUntuk, unggahFoto,
    setFormItem, hapusItem, hanyaKendala, kembali, setShareBuka, setImporBuka, ekspor, setSalinBuka,
    setFormInfo, hapusChecklist, setFormAnggota, ringkasan, setHanyaKendala, sembunyikan, setSembunyikan, peta,
    sedangId, setFormBagian, formItem, menyimpan, jalankan, setDetail, label, isian,
    gayaIsian, formBagian, formInfo, formAnggota, kendalaUntuk, simpanKendala, t, menyimpanCentang,
    simpanCentang, salinBuka, imporBuka, imporIsi, ubahShare, shareBuka, konfirmasi, setKonfirmasi,
  } = useDetailChecklist({ id, onBerubah, namaSaya, beritahu, onKembali });

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
      <KepalaDetailChecklist
        kembali={kembali} proyek={proyek} daftar={daftar} warnaJadwal={warnaJadwal} jadwal={jadwal} hak={hak}
        setShareBuka={setShareBuka} setImporBuka={setImporBuka} ekspor={ekspor} setSalinBuka={setSalinBuka} setFormInfo={setFormInfo} hapusChecklist={hapusChecklist}
        stat={stat} detail={detail} setFormAnggota={setFormAnggota}
      />

      {adaRingkasanChecklist(ringkasan) && (
        <LipatRingkasan hpTerlipat>
          <RingkasanChecklist r={ringkasan} />
        </LipatRingkasan>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px] items-start">
        <RingkasanDetailChecklist
          detail={detail} stat={stat} hanyaKendala={hanyaKendala} setHanyaKendala={setHanyaKendala} sembunyikan={sembunyikan} setSembunyikan={setSembunyikan}
          hak={hak} setImporBuka={setImporBuka} itemTampil={itemTampil} peta={peta} sedangId={sedangId} aksi={aksi}
          setFormBagian={setFormBagian} setFormItem={setFormItem}
        />

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
                <p className="text-[11px] mt-0.5" style={{ color: r.aksi === 'kendala' ? TEMA.kendala : TEMA.samar }}>
                  {formatWaktu(r.created_at)} · {r.lewat === 'link' ? 'via link' : 'di aplikasi'}
                </p>
              </div>
            ))}
          </div>
        </aside>
      </div>

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

      <Modal buka={!!formInfo} onTutup={() => !menyimpan && setFormInfo(null)} ukuran="lg" tutupDiLuar={false}
        judul="Ubah info & jadwal checklist"
        footer={<>
          <TombolModal onClick={() => setFormInfo(null)} disabled={menyimpan}>Batal</TombolModal>
          <TombolModal jenis="utama" disabled={menyimpan || !formInfo?.judul.trim()}
            onClick={() => formInfo && jalankan({ aksi: 'ubahInfo', ...formInfo }, 'Info checklist diperbarui.', () => setFormInfo(null),
              () => setDetail(d => d && { ...d, daftar: {
                ...d.daftar, judul: formInfo.judul.trim(), keterangan: formInfo.keterangan, support_lokasi: formInfo.support_lokasi.trim(),
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
            <label className="block">{label('Support di lokasi (opsional)')}
              <input value={formInfo.support_lokasi} maxLength={BATAS.support} placeholder="mis. Budi (teknisi lokal), Andi"
                onChange={e => setFormInfo({ ...formInfo, support_lokasi: e.target.value })} className={isian} style={gayaIsian} />
              <span className="block mt-1 text-[11px]" style={{ color: TEMA.samar }}>
                Diketik manual. Isi bila handler bekerja remote atau orang di lokasi tidak punya akun. Tampil di link View-Only.
              </span></label>
            <label className="block">{label('Keterangan')}
              <textarea value={formInfo.keterangan} rows={5} maxLength={BATAS.keterangan}
                onChange={e => setFormInfo({ ...formInfo, keterangan: e.target.value })} className={isian} style={gayaIsian} /></label>
          </div>
        )}
      </Modal>

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
