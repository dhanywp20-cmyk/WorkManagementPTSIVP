'use client';

import { useRef, useState } from 'react';
import { FileSpreadsheet, FileText, Download, Upload } from 'lucide-react';
import { Modal, TombolModal } from '@/components/shared';
import { NETRAL } from '@/lib/desain';
import { loadXLSX } from '@/lib/xlsx-loader';
import {
  bacaBaris, bacaTeks, hitungItemDraft, BATAS, CONTOH_TEMPLATE,
  type DraftChecklist,
} from '@/lib/checklist';
import { TEMA, fontAngka } from './tampilan';

type Jenis = 'teks' | 'excel';

const CONTOH_TEKS = `# Checklist Instalasi Ruang Meeting

## 1. Persiapan
- [ ] Cek fisik semua perangkat sesuai daftar
- [ ] Siapkan alat: crimping, LAN tester, multimeter

## 2. Instalasi
**Zona WALL**
- [ ] Pasang bracket dan display
**Zona TABLE**
- [ ] Pasang tabletop box di meja`;

/**
 * Impor checklist - dua langkah: pilih sumber (tempel teks/Markdown atau file
 * Excel) -> pratinjau. Di pratinjau admin melihat apa yang terbaca, bisa
 * mengganti judul dan melewatkan bagian yang tidak perlu (mis. bagian
 * "Progress" dari dokumen asal) sebelum disimpan. Tidak ada item yang perlu
 * diketik satu per satu.
 */
export function ModalImpor({ buka, onTutup, onSimpan, labelSimpan = n => `Simpan ${n} item` }: {
  buka: boolean;
  /** Teks tombol simpan di pratinjau, mis. "Pakai 98 item" saat membuat checklist. */
  labelSimpan?: (jumlahItem: number) => string;
  onTutup: () => void;
  onSimpan: (draft: DraftChecklist, sumber: Jenis) => Promise<void>;
}) {
  const [jenis, setJenis] = useState<Jenis>('teks');
  const [teks, setTeks] = useState('');
  const [draft, setDraft] = useState<DraftChecklist | null>(null);
  const [ikut, setIkut] = useState<boolean[]>([]);
  const [galat, setGalat] = useState('');
  const [menyimpan, setMenyimpan] = useState(false);
  const [memuatExcel, setMemuatExcel] = useState(false);
  const fileTeks = useRef<HTMLInputElement>(null);
  const fileExcel = useRef<HTMLInputElement>(null);

  const reset = () => {
    setDraft(null); setIkut([]); setGalat(''); setTeks(''); setJenis('teks'); setMenyimpan(false);
  };
  const tutup = () => { if (menyimpan) return; reset(); onTutup(); };

  const keDraft = (d: DraftChecklist, judulCadangan: string) => {
    if (!d.bagian.length || hitungItemDraft(d) === 0) {
      setGalat('Tidak ada item checklist yang terbaca. Item ditulis "- [ ] teks item" (teks) atau kolom Item terisi (Excel).');
      return;
    }
    setGalat('');
    setDraft({ ...d, judul: (d.judul || judulCadangan).slice(0, BATAS.judul) });
    setIkut(d.bagian.map(b => b.items.length > 0 || b.catatan !== ''));
  };

  const bacaDariTeks = () => keDraft(bacaTeks(teks), '');

  const muatFileTeks = (f: File | undefined) => {
    if (!f) return;
    const r = new FileReader();
    r.onload = () => setTeks(String(r.result ?? ''));
    r.readAsText(f);
  };

  const muatFileExcel = (f: File | undefined) => {
    if (!f) return;
    setMemuatExcel(true);
    setGalat('');
    loadXLSX(async XLSX => {
      try {
        const buf = await f.arrayBuffer();
        const wb = XLSX.read(buf, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false });
        keDraft(bacaBaris(rows), f.name.replace(/\.[^.]+$/, ''));
      } catch {
        setGalat('File tidak bisa dibaca. Pastikan formatnya .xlsx, .xls, atau .csv.');
      } finally {
        setMemuatExcel(false);
      }
    }, () => { setMemuatExcel(false); setGalat('Gagal memuat pembaca Excel. Periksa koneksi internet.'); });
  };

  const unduhTemplate = () => loadXLSX(XLSX => {
    const ws = XLSX.utils.aoa_to_sheet(CONTOH_TEMPLATE);
    ws['!cols'] = [{ wch: 22 }, { wch: 16 }, { wch: 50 }, { wch: 32 }, { wch: 10 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Checklist');
    XLSX.writeFile(wb, 'template-checklist.xlsx');
  });

  const terpilih = draft ? draft.bagian.filter((_, i) => ikut[i]) : [];
  const jumlahItem = terpilih.reduce((s, b) => s + b.items.length, 0);

  const simpan = async () => {
    if (!draft) return;
    if (jumlahItem === 0) { setGalat('Pilih minimal satu bagian yang berisi item.'); return; }
    setMenyimpan(true);
    setGalat('');
    try {
      await onSimpan({ ...draft, bagian: terpilih }, jenis);
      reset();
    } catch (e) {
      setGalat(e instanceof Error ? e.message : 'Gagal menyimpan.');
      setMenyimpan(false);
    }
  };

  const tabGaya = (aktif: boolean) => ({
    background: aktif ? TEMA.tint : NETRAL.permukaan,
    color: aktif ? TEMA.warnaTua : NETRAL.tinta2,
    border: `1px solid ${aktif ? TEMA.garisTint : NETRAL.garis}`,
  });

  return (
    <Modal buka={buka} onTutup={tutup} ukuran="xl" tutupDiLuar={false} ikon="📥"
      judul={draft ? 'Pratinjau impor' : 'Impor isi checklist'}
      keterangan={draft
        ? 'Periksa hasil bacaan. Bagian yang tidak dicentang tidak ikut disimpan.'
        : 'Tempel teks/Markdown (mis. ekspor dokumen checklist) atau unggah file Excel. Tidak perlu mengetik item satu per satu.'}
      footer={draft ? (
        <>
          <TombolModal onClick={() => { setDraft(null); setGalat(''); }} disabled={menyimpan}>Kembali</TombolModal>
          <TombolModal jenis="utama" onClick={simpan} disabled={menyimpan || jumlahItem === 0}>
            {menyimpan ? 'Menyimpan…' : labelSimpan(jumlahItem)}
          </TombolModal>
        </>
      ) : (
        <>
          <TombolModal onClick={tutup}>Batal</TombolModal>
          {jenis === 'teks' && (
            <TombolModal jenis="utama" onClick={bacaDariTeks} disabled={!teks.trim()}>Baca isi</TombolModal>
          )}
        </>
      )}>

      {galat && (
        <p role="alert" className="mb-3 px-3 py-2 rounded-lg text-[12.5px] font-semibold"
          style={{ background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca' }}>{galat}</p>
      )}

      {!draft && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => { setJenis('teks'); setGalat(''); }}
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left" style={tabGaya(jenis === 'teks')}>
              <FileText size={18} />
              <span>
                <span className="block text-[13px] font-bold">Teks / Markdown</span>
                <span className="block text-[11px] opacity-80">Tempel atau buka file .md / .txt</span>
              </span>
            </button>
            <button type="button" onClick={() => { setJenis('excel'); setGalat(''); }}
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left" style={tabGaya(jenis === 'excel')}>
              <FileSpreadsheet size={18} />
              <span>
                <span className="block text-[13px] font-bold">Excel / CSV</span>
                <span className="block text-[11px] opacity-80">Kolom Bagian · Kelompok · Item · Catatan</span>
              </span>
            </button>
          </div>

          {jenis === 'teks' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <label htmlFor="impor-teks" className="text-[12px] font-bold" style={{ color: NETRAL.tinta2 }}>Isi checklist</label>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setTeks(CONTOH_TEKS)} className="text-[11.5px] font-bold" style={{ color: TEMA.warna }}>
                    Isi contoh
                  </button>
                  <button type="button" onClick={() => fileTeks.current?.click()}
                    className="inline-flex items-center gap-1 text-[11.5px] font-bold" style={{ color: TEMA.warna }}>
                    <Upload size={13} /> Buka file .md / .txt
                  </button>
                  <input ref={fileTeks} type="file" accept=".md,.markdown,.txt,text/plain,text/markdown" className="hidden"
                    onChange={e => { muatFileTeks(e.target.files?.[0]); e.target.value = ''; }} />
                </div>
              </div>
              <textarea id="impor-teks" value={teks} onChange={e => setTeks(e.target.value)} rows={14}
                placeholder={CONTOH_TEKS}
                className="w-full rounded-xl px-3 py-2.5 text-[13px] font-mono outline-none focus:ring-2"
                style={{ border: `1px solid ${NETRAL.garis}`, color: NETRAL.tinta, background: NETRAL.permukaan }} />
              <p className="text-[11.5px] leading-relaxed" style={{ color: TEMA.samar }}>
                <b>## Judul</b> = bagian · <b>**Teks tebal**</b> atau <b>### Judul</b> = kelompok · <b>- [ ] teks</b> = item
                (<b>- [x]</b> = sudah selesai) · teks & tabel lain = catatan bagian.
              </p>
            </div>
          )}

          {jenis === 'excel' && (
            <div className="space-y-3">
              <button type="button" onClick={() => fileExcel.current?.click()} disabled={memuatExcel}
                className="w-full rounded-xl px-4 py-8 flex flex-col items-center gap-2 text-center transition-colors disabled:opacity-60"
                style={{ border: `2px dashed ${TEMA.garisTint}`, background: TEMA.tint, color: TEMA.warnaTua }}>
                <FileSpreadsheet size={28} />
                <span className="text-[13.5px] font-bold">{memuatExcel ? 'Membaca file…' : 'Pilih file Excel / CSV'}</span>
                <span className="text-[11.5px]" style={{ color: NETRAL.tinta2 }}>Sheet pertama dibaca. Sel Bagian kosong ikut bagian di atasnya.</span>
              </button>
              <input ref={fileExcel} type="file" accept=".xlsx,.xls,.csv" className="hidden"
                onChange={e => { muatFileExcel(e.target.files?.[0]); e.target.value = ''; }} />
              <button type="button" onClick={unduhTemplate}
                className="inline-flex items-center gap-1.5 text-[12px] font-bold" style={{ color: TEMA.warna }}>
                <Download size={14} /> Unduh template Excel
              </button>
              <p className="text-[11.5px]" style={{ color: TEMA.samar }}>
                Hasil <b>Ekspor Excel</b> dari checklist lain juga bisa diimpor langsung - kolom Status &quot;Selesai&quot; ikut terbaca.
              </p>
            </div>
          )}
        </div>
      )}

      {draft && (
        <div className="space-y-4">
          <div className="grid gap-3">
            {draft.keterangan && (
              <label className="block">
                <span className="text-[12px] font-bold" style={{ color: NETRAL.tinta2 }}>Keterangan (dari teks sebelum bagian pertama)</span>
                <textarea value={draft.keterangan} rows={2} maxLength={BATAS.keterangan}
                  onChange={e => setDraft({ ...draft, keterangan: e.target.value })}
                  className="mt-1 w-full rounded-xl px-3 py-2 text-[12.5px] outline-none focus:ring-2"
                  style={{ border: `1px solid ${NETRAL.garis}`, color: NETRAL.tinta }} />
              </label>
            )}
          </div>

          <div className="flex items-center justify-between gap-2">
            <p className="text-[12.5px] font-bold" style={{ color: NETRAL.tinta }}>
              <span style={fontAngka}>{terpilih.length}</span> bagian · <span style={fontAngka}>{jumlahItem}</span> item akan diimpor
            </p>
            <span className="text-[11px]" style={{ color: TEMA.samar }}>Hapus centang untuk melewatkan bagian</span>
          </div>

          <div className="rounded-xl divide-y max-h-[46vh] overflow-y-auto" style={{ border: `1px solid ${NETRAL.garis}`, borderColor: NETRAL.garis }}>
            {draft.bagian.map((b, i) => {
              const kelompok = Array.from(new Set(b.items.map(it => it.kelompok).filter(Boolean)));
              const sudah = b.items.filter(it => it.selesai).length;
              return (
                <label key={i} className="flex items-start gap-3 px-3 py-2.5 cursor-pointer"
                  style={{ opacity: ikut[i] ? 1 : 0.5, background: NETRAL.permukaan }}>
                  <input type="checkbox" checked={!!ikut[i]} className="mt-1 w-4 h-4 accent-blue-600"
                    onChange={e => setIkut(prev => prev.map((v, k) => (k === i ? e.target.checked : v)))} />
                  <span className="flex-1 min-w-0">
                    <span className="flex items-center gap-2 flex-wrap">
                      <span className="text-[13.5px] font-bold" style={{ color: NETRAL.tinta }}>{b.judul}</span>
                      <span className="text-[11px] font-bold px-1.5 py-0.5 rounded" style={{ ...fontAngka, background: TEMA.tint, color: TEMA.warnaTua }}>
                        {b.items.length} item
                      </span>
                      {sudah > 0 && (
                        <span className="text-[11px] font-bold px-1.5 py-0.5 rounded" style={{ background: TEMA.selesaiTint, color: TEMA.selesai }}>
                          {sudah} sudah selesai
                        </span>
                      )}
                      {b.catatan && (
                        <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded" style={{ background: NETRAL.permukaanRedam, color: NETRAL.tinta2 }}>
                          + catatan
                        </span>
                      )}
                    </span>
                    {kelompok.length > 0 && (
                      <span className="block text-[11.5px] mt-0.5" style={{ color: TEMA.warnaTua }}>{kelompok.join(' · ')}</span>
                    )}
                    {b.items.length > 0 && (
                      <span className="block text-[12px] mt-0.5 truncate" style={{ color: TEMA.samar }}>
                        {b.items.slice(0, 3).map(it => it.teks).join(' · ')}{b.items.length > 3 ? ' …' : ''}
                      </span>
                    )}
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      )}
    </Modal>
  );
}
