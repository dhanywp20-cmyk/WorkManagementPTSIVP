'use client';
/** Tekstur gambar sendiri untuk lantai / dinding: unggah, pratinjau, ukuran ubin (m), hapus (simpan/teksturRuang.ts). */
import { useRef, useState } from 'react';
import { kunciTeksturBaru, type Ruang, teksturSah, UBIN_AWAL_DINDING, UBIN_AWAL_LANTAI, UBIN_MAKS, UBIN_MIN } from '../inti';
import { berkasKeTekstur, daftarkanTekstur } from '../simpan/teksturRuang';
import { urlAset } from '../simpan/aset';
import type { KeadaanDesain } from '../useKeadaanDesain';

export type PetaTeksturPanel = Pick<KeadaanDesain, 'sumberTekstur' | 'gambarTekstur' | 'setVersiTekstur' | 'setPesan'>;

export function PilihTekstur({ sasaran, ruang, setRuang, peta }: {
  sasaran: 'lantai' | 'dinding'; ruang: Ruang; setRuang: (fn: (r: Ruang) => Ruang) => void; peta: PetaTeksturPanel;
}) {
  const kolom = sasaran === 'lantai' ? 'teksturLantai' : 'teksturDinding';
  const awalUbin = sasaran === 'lantai' ? UBIN_AWAL_LANTAI : UBIN_AWAL_DINDING;
  const t = teksturSah(ruang[kolom], awalUbin);
  const sumber = t ? peta.sumberTekstur.current.get(t.kunci) : undefined;
  const pratinjau = sumber ? urlAset(sumber) : undefined;
  const input = useRef<HTMLInputElement>(null);
  const [sibuk, setSibuk] = useState(false);
  const [ubinKetik, setUbinKetik] = useState<string | null>(null);

  const pilihBerkas = async (f: File | undefined) => {
    if (!f) return;
    setSibuk(true);
    const url = await berkasKeTekstur(f);
    setSibuk(false);
    if (!url) { peta.setPesan('Gambar tidak bisa dipakai sebagai tekstur (pakai JPG / PNG / WebP).'); return; }
    const kunci = kunciTeksturBaru();
    daftarkanTekstur(peta, { [kunci]: url });
    setRuang(r => ({ ...r, [kolom]: { kunci, ubin: t?.ubin ?? awalUbin } }));
  };
  const ubahUbin = (teks: string) => {
    setUbinKetik(teks);
    const v = Number(teks.replace(',', '.'));
    if (t && Number.isFinite(v) && v >= UBIN_MIN && v <= UBIN_MAKS) setRuang(r => ({ ...r, [kolom]: { ...t, ubin: v } }));
  };

  return (
    <div className="mt-2 flex items-center gap-2">
      {pratinjau
        ? <img src={pratinjau} alt="" className="w-9 h-9 shrink-0 rounded-lg object-cover border border-slate-200" />
        : t ? <span className="w-9 h-9 shrink-0 rounded-lg border border-dashed border-slate-300 grid place-items-center text-[10px] text-slate-400" title="Gambar tekstur tidak ikut tersimpan di salinan ini">?</span> : null}
      <button type="button" onClick={() => input.current?.click()} disabled={sibuk}
        title={`Gambar sendiri (foto granit, karpet motif, wallpaper, panel akustik) diulang per ubin di ${sasaran}`}
        className="px-2.5 py-1.5 rounded-lg text-[12px] font-semibold border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50">
        {sibuk ? 'Memproses…' : t ? '🖼 Ganti' : '🖼 Tekstur gambar'}
      </button>
      {t && (
        <>
          <label className="flex items-center gap-1 text-[12px] text-slate-600" title="Ukuran satu gambar di ruangan - gambar diulang (tile) sesuai ukuran ini">
            Ubin
            <input inputMode="decimal" value={ubinKetik ?? String(t.ubin)} onChange={e => ubahUbin(e.target.value)} onBlur={() => setUbinKetik(null)}
              aria-label={`Ukuran ubin tekstur ${sasaran} (meter)`} className="w-14 rounded-lg border border-slate-200 px-2 py-1 text-base sm:text-[12.5px] tabular-nums" />
            m
          </label>
          <button type="button" onClick={() => setRuang(r => ({ ...r, [kolom]: undefined }))} aria-label={`Hapus tekstur ${sasaran}`} title="Kembali ke lantai / dinding biasa"
            className="ml-auto w-7 h-7 grid place-items-center rounded-lg text-slate-500 hover:bg-slate-100">✕</button>
        </>
      )}
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" hidden
        onChange={e => { void pilihBerkas(e.target.files?.[0]); e.target.value = ''; }} />
    </div>
  );
}
