'use client';

import { useRef, useState } from 'react';
import { Modal, TombolModal } from '@/components/shared';
import { NETRAL } from '@/lib/desain';
import { loadXLSX } from '@/lib/xlsx-loader';
import { compressImage } from '@/lib/image-compress';
import { BATAS, type DraftChecklist } from '@/lib/checklist/inti';
import { bacaBaris, bacaTeks, hitungItemDraft, CONTOH_TEMPLATE } from '@/lib/checklist/inti-baca';
import { TEMA } from './tampilan';
import { PratinjauImpor } from './PratinjauImpor';
import { FormSumberImpor } from './FormSumberImpor';

type Jenis = 'teks' | 'excel';
export type Tab = Jenis | 'ai';

const BATAS_AI_BYTE = 4 * 1024 * 1024;

export function ukuran(n: number): string {
  return n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;
}

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

export const CONTOH_TEKS = `# Checklist Instalasi Ruang Meeting

## 1. Persiapan
- [ ] Cek fisik semua perangkat sesuai daftar
- [ ] Siapkan alat: crimping, LAN tester, multimeter

## 2. Instalasi
**Zona WALL**
- [ ] Pasang bracket dan display
**Zona TABLE**
- [ ] Pasang tabletop box di meja`;

export function ModalImpor({ buka, onTutup, onSimpan, labelSimpan = n => `Simpan ${n} item` }: {
  buka: boolean;
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

      <FormSumberImpor
        draft={draft} setJenis={setJenis} setGalat={setGalat} aiSibuk={aiSibuk} tabGaya={tabGaya} jenis={jenis}
        fileAi={fileAi} setAiBerkas={setAiBerkas} aiBerkas={aiBerkas} aiInstruksi={aiInstruksi} setAiInstruksi={setAiInstruksi} aiHasil={aiHasil}
        setTeks={setTeks} fileTeks={fileTeks} muatFileTeks={muatFileTeks} teks={teks} fileExcel={fileExcel} memuatExcel={memuatExcel}
        muatFileExcel={muatFileExcel} unduhTemplate={unduhTemplate}
      />

      <PratinjauImpor draft={draft} setDraft={setDraft} terpilih={terpilih} jumlahItem={jumlahItem} ikut={ikut} setIkut={setIkut} />
    </Modal>
  );
}
