'use client';

import type { Dispatch, RefObject, SetStateAction } from 'react';
import { FileSpreadsheet, FileText, Download, Loader2, Sparkles, Upload, X } from 'lucide-react';
import { NETRAL } from '@/lib/desain';
import { type DraftChecklist } from '@/lib/checklist/inti';
import { TEMA, fontAngka } from './tampilan';
import { ukuran, CONTOH_TEKS } from './ModalImpor';
import type { Tab } from './ModalImpor';

export interface FormSumberImporProps {
  draft: DraftChecklist | null;
  setJenis: Dispatch<SetStateAction<Tab>>;
  setGalat: Dispatch<SetStateAction<string>>;
  aiSibuk: boolean;
  tabGaya: (aktif: boolean) => { background: "#eff6ff" | "#ffffff"; color: "#1d4ed8" | "#475569"; border: string; };
  jenis: Tab;
  fileAi: RefObject<HTMLInputElement | null>;
  setAiBerkas: Dispatch<SetStateAction<File[]>>;
  aiBerkas: File[];
  aiInstruksi: string;
  setAiInstruksi: Dispatch<SetStateAction<string>>;
  aiHasil: number;
  setTeks: Dispatch<SetStateAction<string>>;
  fileTeks: RefObject<HTMLInputElement | null>;
  muatFileTeks: (f: File | undefined) => void;
  teks: string;
  fileExcel: RefObject<HTMLInputElement | null>;
  memuatExcel: boolean;
  muatFileExcel: (f: File | undefined) => void;
  unduhTemplate: () => void;
}

export function FormSumberImpor({
  draft, setJenis, setGalat, aiSibuk, tabGaya, jenis, fileAi, setAiBerkas,
  aiBerkas, aiInstruksi, setAiInstruksi, aiHasil, setTeks, fileTeks, muatFileTeks, teks,
  fileExcel, memuatExcel, muatFileExcel, unduhTemplate,
}: FormSumberImporProps) {
  return (
    <>{!draft && (
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
                className="mt-1 w-full rounded-xl px-3 py-2 text-[13px] outline-hidden focus:ring-2"
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
              className="w-full rounded-xl px-3 py-2.5 text-[13px] font-mono outline-hidden focus:ring-2"
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
    )}</>
  );
}
