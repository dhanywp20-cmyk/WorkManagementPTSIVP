'use client';
import { useEffect, useState } from 'react';
import { MODUL_LED, SENDING_CARD, VIDEO_PROCESSOR, type ModulLED, type Hardware } from '@/lib/av-hitung';
import { Ikon } from '@/components/shared/Ikon';

/**
 * Tabel referensi Kalkulator LED (setara sheet "REF Module LED" & "REF
 * Hardware" di LED Calculator v1 - DWP). Bawaan dari lib/av-hitung.ts; ubahan
 * engineer disimpan di perangkat ini supaya simulasi memakai modul & hardware
 * yang benar-benar ditawarkan.
 */

export interface RefLED { modul: ModulLED[]; kartu: Hardware[]; vp: Hardware[] }

const KUNCI = 'wm_led_referensi';
const BAWAAN: RefLED = { modul: MODUL_LED, kartu: SENDING_CARD, vp: VIDEO_PROCESSOR };

function valid(r: unknown): r is RefLED {
  const x = r as RefLED;
  return !!x && Array.isArray(x.modul) && Array.isArray(x.kartu) && Array.isArray(x.vp) && x.modul.length > 0;
}

export function useReferensiLED() {
  const [data, setData] = useState<RefLED>(BAWAAN);
  useEffect(() => {
    try { const s = localStorage.getItem(KUNCI); if (s) { const j = JSON.parse(s); if (valid(j)) setData(j); } } catch { /* abaikan */ }
  }, []);
  const ubah = (r: RefLED) => {
    setData(r);
    try { localStorage.setItem(KUNCI, JSON.stringify(r)); } catch { /* abaikan */ }
  };
  const reset = () => {
    setData(BAWAAN);
    try { localStorage.removeItem(KUNCI); } catch { /* abaikan */ }
  };
  return { data, ubah, reset, diubah: JSON.stringify(data) !== JSON.stringify(BAWAAN) };
}

const sel = 'rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-900 tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400';

function SelAngka({ nilai, onUbah, lebar = 'w-20', label }: { nilai: number; onUbah: (v: number) => void; lebar?: string; label: string }) {
  const [teks, setTeks] = useState<string | null>(null);
  return (
    <input type="number" inputMode="decimal" aria-label={label} value={teks ?? String(nilai)}
      onChange={e => { setTeks(e.target.value); const v = parseFloat(e.target.value.replace(',', '.')); if (Number.isFinite(v) && v >= 0) onUbah(v); }}
      onBlur={() => setTeks(null)} className={`${sel} ${lebar}`} />
  );
}

function SelTeks({ nilai, onUbah, lebar = 'w-28', label }: { nilai: string; onUbah: (v: string) => void; lebar?: string; label: string }) {
  return <input type="text" aria-label={label} value={nilai} onChange={e => onUbah(e.target.value)} className={`${sel} ${lebar}`} />;
}

function Hapus({ onKlik, label }: { onKlik: () => void; label: string }) {
  return (
    <button type="button" onClick={onKlik} aria-label={label} title={label}
      className="w-8 h-8 grid place-items-center rounded-lg text-slate-500 hover:text-rose-700 hover:bg-rose-50">
      <Ikon nama="🗑" ukuran={15} />
    </button>
  );
}

const th = 'px-2 py-2 text-left text-[11px] font-bold uppercase tracking-wider text-slate-600 whitespace-nowrap';
const td = 'px-1.5 py-1 align-middle';

function Tambah({ onKlik, teks }: { onKlik: () => void; teks: string }) {
  return (
    <button type="button" onClick={onKlik}
      className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-200 text-blue-700 hover:bg-blue-50">
      + {teks}
    </button>
  );
}

function TabelHardware({ judul, data, onUbah, tampilSender }: { judul: string; data: Hardware[]; onUbah: (d: Hardware[]) => void; tampilSender: boolean }) {
  const set = (i: number, p: Partial<Hardware>) => onUbah(data.map((h, j) => (j === i ? { ...h, ...p } : h)));
  return (
    <div>
      <p className="text-[12.5px] font-bold text-slate-800 mb-1.5">{judul}</p>
      <div className="relative overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className={th}>Model</th><th className={th}>Maks pixel</th><th className={th}>Port LAN</th>
              {tampilSender && <th className={th}>Sender bawaan</th>}
              <th className={th}>Keterangan</th><th className={th}><span className="sr-only">Hapus</span></th>
            </tr>
          </thead>
          <tbody>
            {data.map((h, i) => (
              <tr key={i} className="border-t border-slate-100">
                <td className={td}><SelTeks label="Model" nilai={h.nama} onUbah={v => set(i, { nama: v })} lebar="w-36" /></td>
                <td className={td}><SelAngka label="Maks pixel" nilai={h.maksPx} onUbah={v => set(i, { maksPx: Math.round(v) })} lebar="w-28" /></td>
                <td className={td}><SelAngka label="Port LAN" nilai={h.port} onUbah={v => set(i, { port: Math.round(v) })} lebar="w-16" /></td>
                {tampilSender && (
                  <td className={`${td} text-center`}>
                    <input type="checkbox" aria-label="Sender bawaan" checked={h.senderBawaan} onChange={e => set(i, { senderBawaan: e.target.checked })} className="w-4 h-4" />
                  </td>
                )}
                <td className={td}><SelTeks label="Keterangan" nilai={h.ket} onUbah={v => set(i, { ket: v })} lebar="w-56" /></td>
                <td className={td}><Hapus label={`Hapus ${h.nama}`} onKlik={() => onUbah(data.filter((_, j) => j !== i))} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Tambah teks="Tambah model" onKlik={() => onUbah([...data, { nama: 'Model baru', maksPx: 1_000_000, port: 2, senderBawaan: tampilSender, ket: '' }])} />
    </div>
  );
}

export function EditorReferensiLED({ data: r, ubah, reset, diubah }: ReturnType<typeof useReferensiLED>) {
  const setModul = (i: number, p: Partial<ModulLED>) => ubah({
    ...r,
    modul: r.modul.map((m, j) => {
      if (j !== i) return m;
      const baru = { ...m, ...p };
      //  Pitch / ukuran berubah -> pixel dihitung ulang; pixel tetap bisa diketik manual.
      if (p.pitch !== undefined || p.w !== undefined || p.h !== undefined) {
        baru.pxW = Math.round(baru.w / Math.max(0.1, baru.pitch));
        baru.pxH = Math.round(baru.h / Math.max(0.1, baru.pitch));
      }
      return baru;
    }),
  });
  return (
    <details className="rounded-2xl bg-white border border-slate-200 p-4 sm:p-5">
      <summary className="text-[13px] font-bold text-slate-800 cursor-pointer">
        Tabel referensi modul & hardware {diubah && <span className="ml-2 text-[11px] font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-800">diubah</span>}
      </summary>
      <p className="text-[12px] text-slate-600 mt-2">
        Isi sesuai datasheet produk yang ditawarkan. Pilihan pitch dan hardware di kalkulator langsung memakai tabel ini. Tersimpan di perangkat ini.
      </p>

      <div className="mt-4 space-y-5">
        <div>
          <p className="text-[12.5px] font-bold text-slate-800 mb-1.5">Modul LED</p>
          <div className="relative overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className={th}>Pitch</th><th className={th}>Pitch (mm)</th><th className={th}>Modul W (mm)</th><th className={th}>Modul H (mm)</th>
                  <th className={th}>Pixel W</th><th className={th}>Pixel H</th><th className={th}>Tipe</th><th className={th}>Pemakaian</th>
                  <th className={th}><span className="sr-only">Hapus</span></th>
                </tr>
              </thead>
              <tbody>
                {r.modul.map((m, i) => (
                  <tr key={i} className="border-t border-slate-100">
                    <td className={td}><SelTeks label="Kode pitch" nilai={m.kode} onUbah={v => setModul(i, { kode: v })} lebar="w-20" /></td>
                    <td className={td}><SelAngka label="Pitch mm" nilai={m.pitch} onUbah={v => v > 0 && setModul(i, { pitch: v })} lebar="w-20" /></td>
                    <td className={td}><SelAngka label="Lebar modul" nilai={m.w} onUbah={v => v > 0 && setModul(i, { w: v })} /></td>
                    <td className={td}><SelAngka label="Tinggi modul" nilai={m.h} onUbah={v => v > 0 && setModul(i, { h: v })} /></td>
                    <td className={td}><SelAngka label="Pixel W" nilai={m.pxW} onUbah={v => v >= 1 && setModul(i, { pxW: Math.round(v) })} lebar="w-16" /></td>
                    <td className={td}><SelAngka label="Pixel H" nilai={m.pxH} onUbah={v => v >= 1 && setModul(i, { pxH: Math.round(v) })} lebar="w-16" /></td>
                    <td className={td}>
                      <select aria-label="Tipe" value={m.tipe} onChange={e => setModul(i, { tipe: e.target.value as ModulLED['tipe'] })} className={`${sel} w-32`}>
                        {(['Indoor', 'Indoor/Outdoor', 'Outdoor'] as const).map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </td>
                    <td className={td}><SelTeks label="Pemakaian" nilai={m.guna} onUbah={v => setModul(i, { guna: v })} lebar="w-56" /></td>
                    <td className={td}>{r.modul.length > 1 && <Hapus label={`Hapus ${m.kode}`} onKlik={() => ubah({ ...r, modul: r.modul.filter((_, j) => j !== i) })} />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Tambah teks="Tambah modul" onKlik={() => ubah({ ...r, modul: [...r.modul, { kode: 'P baru', pitch: 2.5, w: 320, h: 160, pxW: 128, pxH: 64, tipe: 'Indoor', guna: '' }] })} />
        </div>

        <TabelHardware judul="Sending card" data={r.kartu} onUbah={kartu => ubah({ ...r, kartu })} tampilSender={false} />
        <TabelHardware judul="Video processor" data={r.vp} onUbah={vp => ubah({ ...r, vp })} tampilSender />
        <p className="text-[11.5px] text-slate-500">Video processor dengan &quot;Sender bawaan&quot; dan port LAN &gt; 0 dianggap all-in-one. Port 0 = perlu sending card terpisah.</p>

        {diubah && (
          <button type="button" onClick={() => { if (window.confirm('Kembalikan semua tabel ke nilai bawaan?')) reset(); }}
            className="text-[12px] font-semibold text-blue-700 hover:underline">Kembalikan ke tabel bawaan</button>
        )}
      </div>
    </details>
  );
}
