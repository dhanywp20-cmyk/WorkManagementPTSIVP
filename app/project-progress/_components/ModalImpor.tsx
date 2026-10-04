'use client';

import { useRef, useState } from 'react';
import { FileSpreadsheet, FileText, Download, Loader2, Sparkles, Upload, X } from 'lucide-react';
import { Modal, TombolModal } from '@/components/shared';
import { NETRAL } from '@/lib/desain';
import { loadXLSX } from '@/lib/xlsx-loader';
import { compressImage } from '@/lib/image-compress';
import {
  bacaBaris, bacaTeks, hitungItemDraft, BATAS, CONTOH_TEMPLATE,
  type DraftChecklist,
} from '@/lib/checklist';
import { TEMA, fontAngka } from './tampilan';

type Jenis = 'teks' | 'excel';
type Tab = Jenis | 'ai';

// Batas body permintaan Vercel ~4,5 MB; sisakan ruang untuk kerangka multipart.
const BATAS_AI_BYTE = 4 * 1024 * 1024;

function ukuran(n: number): string {
  return n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;
}

/** Excel / CSV daftar perangkat -> teks CSV per sheet, supaya bisa dibaca AI. */
function excelKeTeks(f: File): Promise<string> {
  return new Promise((resolve, reject) => {
    loadXLSX(async XLSX => {
      try {
        const wb = XLSX.read(await f.arrayBuffer(), { type: 'array' });
        resolve((wb.SheetNames as string[]).slice(0, 5)
          .map(n => `[${f.name} - sheet ${n}]\n${XLSX.utils.sheet_to_csv(wb.Sheets[n])}`).join('\n\n'));
      } catch (e) { reject(e); }
    }, () => reject(new Error('Gagal memuat pembaca Excel.')));
  });
}

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
  const [jenis, setJenis] = useState<Tab>('teks');
  const [teks, setTeks] = useState('');
  const [draft, setDraft] = useState<DraftChecklist | null>(null);
  const [ikut, setIkut] = useState<boolean[]>([]);
  const [galat, setGalat] = useState('');
  const [menyimpan, setMenyimpan] = useState(false);
  const [memuatExcel, setMemuatExcel] = useState(false);
  const fileTeks = useRef<HTMLInputElement>(null);
  const fileExcel = useRef<HTMLInputElement>(null);
  const fileAi = useRef<HTMLInputElement>(null);
  const [aiBerkas, setAiBerkas] = useState<File[]>([]);
  const [aiInstruksi, setAiInstruksi] = useState('');
  const [aiSibuk, setAiSibuk] = useState(false);
  const [aiHasil, setAiHasil] = useState(0);

  const reset = () => {
    setDraft(null); setIkut([]); setGalat(''); setTeks(''); setJenis('teks'); setMenyimpan(false);
    setAiBerkas([]); setAiInstruksi(''); setAiSibuk(false); setAiHasil(0);
  };
  const tutup = () => { if (menyimpan || aiSibuk) return; reset(); onTutup(); };

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

  /**
   * Susun checklist dengan AI platform dari wiring diagram, foto/layout rak,
   * dan daftar perangkat. Gambar dikompres dulu; Excel/CSV/teks diubah jadi
   * teks di peramban. Hasilnya masuk ke kotak teks untuk DIPERIKSA - belum
   * ada yang tersimpan.
   */
  const susunDenganAI = async () => {
    if (!aiBerkas.length || aiSibuk) return;
    setAiSibuk(true);
    setGalat('');
    try {
      const form = new FormData();
      let total = 0;
      for (const f of aiBerkas) {
        const nama = f.name.toLowerCase();
        if (f.type.startsWith('image/')) {
          const kecil = await compressImage(f, { maxDim: 2000, quality: 0.82 });
          total += kecil.size;
          form.append('berkas', kecil, f.name);
        } else if (f.type === 'application/pdf' || nama.endsWith('.pdf')) {
          total += f.size;
          form.append('berkas', new File([f], f.name, { type: 'application/pdf' }));
        } else if (/\.(xlsx|xls|csv)$/.test(nama)) {
          form.append('lampiran', await excelKeTeks(f));
        } else {
          form.append('lampiran', `[${f.name}]\n${(await f.text()).slice(0, 30_000)}`);
        }
      }
      if (total > BATAS_AI_BYTE) {
        throw new Error(`Total berkas ${ukuran(total)} melebihi 4 MB. Kecilkan PDF (ekspor ulang / screenshot) atau kirim sebagian dulu.`);
      }
      if (aiInstruksi.trim()) form.append('instruksi', aiInstruksi.trim());

      const res = await fetch('/api/project-progress/ai-checklist', { method: 'POST', body: form, cache: 'no-store', credentials: 'include' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || `AI gagal (${res.status}).`);
      setTeks(String(json.markdown ?? ''));
      setAiHasil(aiBerkas.length);
      setJenis('teks');
    } catch (e) {
      setGalat(e instanceof Error ? e.message : 'AI gagal menyusun checklist.');
    } finally {
      setAiSibuk(false);
    }
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
      await onSimpan({ ...draft, bagian: terpilih }, jenis === 'excel' ? 'excel' : 'teks');
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
        : 'Tempel teks/Markdown, unggah Excel, atau biarkan AI menyusunnya dari wiring diagram & foto rak. Tidak perlu mengetik item satu per satu.'}
      footer={draft ? (
        <>
          <TombolModal onClick={() => { setDraft(null); setGalat(''); }} disabled={menyimpan}>Kembali</TombolModal>
          <TombolModal jenis="utama" onClick={simpan} disabled={menyimpan || jumlahItem === 0}>
            {menyimpan ? 'Menyimpan…' : labelSimpan(jumlahItem)}
          </TombolModal>
        </>
      ) : (
        <>
          <TombolModal onClick={tutup} disabled={aiSibuk}>Batal</TombolModal>
          {jenis === 'teks' && (
            <TombolModal jenis="utama" onClick={bacaDariTeks} disabled={!teks.trim()}>Baca isi</TombolModal>
          )}
          {jenis === 'ai' && (
            <TombolModal jenis="utama" onClick={susunDenganAI} disabled={aiSibuk || !aiBerkas.length}>
              {aiSibuk ? 'AI sedang membaca…' : 'Susun dengan AI'}
            </TombolModal>
          )}
        </>
      )}>

      {galat && (
        <p role="alert" className="mb-3 px-3 py-2 rounded-lg text-[12.5px] font-semibold"
          style={{ background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca' }}>{galat}</p>
      )}

      {!draft && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <button type="button" onClick={() => { setJenis('ai'); setGalat(''); }} disabled={aiSibuk}
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left" style={tabGaya(jenis === 'ai')}>
              <Sparkles size={18} />
              <span>
                <span className="block text-[13px] font-bold">AI dari diagram</span>
                <span className="block text-[11px] opacity-80">Wiring diagram, foto rak, daftar perangkat</span>
              </span>
            </button>
            <button type="button" onClick={() => { setJenis('teks'); setGalat(''); }} disabled={aiSibuk}
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left" style={tabGaya(jenis === 'teks')}>
              <FileText size={18} />
              <span>
                <span className="block text-[13px] font-bold">Teks / Markdown</span>
                <span className="block text-[11px] opacity-80">Tempel atau buka file .md / .txt</span>
              </span>
            </button>
            <button type="button" onClick={() => { setJenis('excel'); setGalat(''); }} disabled={aiSibuk}
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left" style={tabGaya(jenis === 'excel')}>
              <FileSpreadsheet size={18} />
              <span>
                <span className="block text-[13px] font-bold">Excel / CSV</span>
                <span className="block text-[11px] opacity-80">Kolom Bagian · Kelompok · Item · Catatan</span>
              </span>
            </button>
          </div>

          {jenis === 'ai' && (
            <div className="space-y-3">
              <button type="button" onClick={() => fileAi.current?.click()} disabled={aiSibuk}
                className="w-full rounded-xl px-4 py-6 flex flex-col items-center gap-2 text-center disabled:opacity-60"
                style={{ border: `2px dashed ${TEMA.garisTint}`, background: TEMA.tint, color: TEMA.warnaTua }}>
                <Upload size={24} />
                <span className="text-[13.5px] font-bold">Pilih berkas</span>
                <span className="text-[11.5px]" style={{ color: NETRAL.tinta2 }}>
                  Wiring diagram (PDF / gambar), foto atau layout rak, daftar perangkat (Excel / CSV). Total maks 4 MB.
                </span>
              </button>
              <input ref={fileAi} type="file" multiple className="hidden"
                accept=".pdf,application/pdf,image/png,image/jpeg,image/webp,.xlsx,.xls,.csv,.txt,.md"
                onChange={e => {
                  const baru = Array.from(e.target.files ?? []);
                  setAiBerkas(prev => [...prev, ...baru].slice(0, 6));
                  e.target.value = '';
                }} />
              {aiBerkas.length > 0 && (
                <ul className="rounded-xl divide-y" style={{ border: `1px solid ${NETRAL.garis}`, borderColor: NETRAL.garis }}>
                  {aiBerkas.map((f, i) => (
                    <li key={`${f.name}-${i}`} className="flex items-center gap-2 px-3 py-2">
                      <FileText size={15} style={{ color: TEMA.samar }} />
                      <span className="flex-1 min-w-0 text-[12.5px] font-semibold truncate" style={{ color: NETRAL.tinta }}>{f.name}</span>
                      <span className="text-[11px]" style={{ ...fontAngka, color: TEMA.samar }}>{ukuran(f.size)}</span>
                      <button type="button" onClick={() => setAiBerkas(prev => prev.filter((_, k) => k !== i))} disabled={aiSibuk}
                        aria-label={`Lepas ${f.name}`} className="p-1 rounded-md hover:bg-slate-100" style={{ color: TEMA.samar }}>
                        <X size={14} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <label className="block">
                <span className="text-[12px] font-bold" style={{ color: NETRAL.tinta2 }}>Instruksi tambahan (opsional)</span>
                <textarea value={aiInstruksi} onChange={e => setAiInstruksi(e.target.value)} rows={2} maxLength={2000} disabled={aiSibuk}
                  placeholder="mis. Ruangan BPKP Padang; fokus instalasi & konfigurasi; switcher meja pakai Aten"
                  className="mt-1 w-full rounded-xl px-3 py-2 text-[13px] outline-none focus:ring-2"
                  style={{ border: `1px solid ${NETRAL.garis}`, color: NETRAL.tinta, background: NETRAL.permukaan }} />
              </label>
              {aiSibuk ? (
                <p className="flex items-center gap-2 text-[12.5px] font-semibold" style={{ color: TEMA.warnaTua }}>
                  <Loader2 size={15} className="animate-spin" /> AI sedang membaca dokumen - biasanya 20-40 detik. Jangan tutup jendela ini.
                </p>
              ) : (
                <p className="text-[11.5px] leading-relaxed" style={{ color: TEMA.samar }}>
                  AI menyusun checklist per produk (pasang, kabel, setting, tes). Hasilnya muncul di kotak teks untuk Anda periksa
                  dan ubah dulu - belum ada yang tersimpan. Berkas tidak disimpan di server.
                </p>
              )}
            </div>
          )}

          {jenis === 'teks' && aiHasil > 0 && (
            <p className="px-3 py-2 rounded-lg text-[12.5px] font-semibold flex items-center gap-2"
              style={{ background: TEMA.tint, color: TEMA.warnaTua, border: `1px solid ${TEMA.garisTint}` }}>
              <Sparkles size={14} /> Disusun AI dari {aiHasil} berkas. Periksa & ubah bila perlu, lalu klik Baca isi.
            </p>
          )}

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
