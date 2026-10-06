'use client';
import { useEffect, useState } from 'react';
import { MODUL_LED, SENDING_CARD, VIDEO_PROCESSOR, type ModulLED, type Hardware } from '@/lib/av-hitung';
import { bersihkanReferensiLED, type RefLED } from '@/lib/tools-team';
import { Ikon } from '@/components/shared/Ikon';
import { Modal } from '@/components/shared/Modal';
import { ConfirmDialog, type ConfirmState } from '@/components/shared/ConfirmDialog';

/**
 * Tabel referensi Kalkulator LED (setara sheet "REF Module LED" & "REF
 * Hardware" di LED Calculator v1 - DWP).
 *
 * Tiga lapis, yang paling atas menang:
 *   1. lokal   - ubahan di perangkat ini yang belum disimpan untuk tim (draf)
 *   2. tim     - referensi bersama di server (/api/tools-team/referensi-led),
 *                hanya Admin/Full Access yang boleh menyimpannya
 *   3. bawaan  - lib/av-hitung.ts
 * Pengguna biasa tetap bisa menyesuaikan tabel untuk simulasinya sendiri
 * (lapis lokal), seperti sebelum referensi bersama ada.
 */

export type { RefLED };
const KUNCI = 'wm_led_referensi';
const BAWAAN: RefLED = { modul: MODUL_LED, kartu: SENDING_CARD, vp: VIDEO_PROCESSOR };

export function useReferensiLED() {
  const [lokal, setLokal] = useState<RefLED | null>(null);
  const [tim, setTim] = useState<RefLED | null>(null);
  const [infoTim, setInfoTim] = useState<{ oleh: string | null; pada: string | null }>({ oleh: null, pada: null });
  const [bolehSimpanTim, setBolehSimpanTim] = useState(false);
  const [sibuk, setSibuk] = useState(false);
  const [pesan, setPesan] = useState('');

  useEffect(() => {
    try { const s = localStorage.getItem(KUNCI); if (s) { const j = bersihkanReferensiLED(JSON.parse(s)); if (j) setLokal(j); } } catch { /* abaikan */ }
    let hidup = true;
    fetch('/api/tools-team/referensi-led', { credentials: 'include', cache: 'no-store' })
      .then(r => (r.ok ? r.json() : null))
      .then(j => {
        if (!hidup || !j?.ok) return;
        setTim(j.referensi ?? null); setBolehSimpanTim(!!j.bolehUbah); setInfoTim({ oleh: j.oleh ?? null, pada: j.diubahPada ?? null });
      })
      .catch(() => { /* luring: lapis lokal / bawaan tetap jalan */ });
    return () => { hidup = false; };
  }, []);

  const data = lokal ?? tim ?? BAWAAN;
  const sumber: 'lokal' | 'tim' | 'bawaan' = lokal ? 'lokal' : tim ? 'tim' : 'bawaan';
  const tulisLokal = (r: RefLED | null) => {
    setLokal(r);
    try { if (r) localStorage.setItem(KUNCI, JSON.stringify(r)); else localStorage.removeItem(KUNCI); } catch { /* abaikan */ }
  };
  const ubah = (r: RefLED) => { tulisLokal(r); setPesan(''); };
  /** Buang draf lokal - kembali ke referensi tim (atau bawaan bila belum ada). */
  const reset = () => { tulisLokal(null); setPesan(''); };

  const panggil = async (metode: 'PUT' | 'DELETE', body?: unknown) => {
    setSibuk(true); setPesan('');
    try {
      const r = await fetch('/api/tools-team/referensi-led', {
        method: metode, credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined,
      });
      const j = await r.json().catch(() => null);
      if (!r.ok || !j?.ok) { setPesan(j?.alasan ?? 'Gagal menyimpan ke server.'); return false; }
      return true;
    } catch { setPesan('Tidak terhubung ke server.'); return false; } finally { setSibuk(false); }
  };
  const simpanUntukTim = async () => {
    if (!lokal) return;
    if (await panggil('PUT', { referensi: lokal })) {
      setTim(lokal); tulisLokal(null); setInfoTim({ oleh: 'Anda', pada: new Date().toISOString() }); setPesan('Tersimpan untuk seluruh tim.');
    }
  };
  const resetTim = async () => {
    if (await panggil('DELETE')) { setTim(null); tulisLokal(null); setInfoTim({ oleh: null, pada: null }); setPesan('Referensi tim dikembalikan ke tabel bawaan.'); }
  };

  return {
    data, ubah, reset, sumber, infoTim, bolehSimpanTim, simpanUntukTim, resetTim, sibuk, pesan,
    diubah: JSON.stringify(data) !== JSON.stringify(BAWAAN),
  };
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

export function EditorReferensiLED({ data: r, ubah, reset, diubah, sumber, infoTim, bolehSimpanTim, simpanUntukTim, resetTim, sibuk, pesan, buka, onTutup }: ReturnType<typeof useReferensiLED> & { buka: boolean; onTutup: () => void }) {
  const [konfirmasi, setKonfirmasi] = useState<ConfirmState | null>(null);
  const tglTim = infoTim.pada ? new Date(infoTim.pada).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
  const keteranganSumber = sumber === 'lokal'
    ? (bolehSimpanTim ? 'Ada perubahan di perangkat ini yang belum disimpan untuk tim.' : 'Perubahan Anda hanya berlaku di perangkat ini. Referensi tim diatur Admin / Full Access.')
    : sumber === 'tim' ? `Memakai referensi tim${infoTim.oleh ? ` (disimpan ${infoTim.oleh}${tglTim ? `, ${tglTim}` : ''})` : ''}.`
      : 'Memakai tabel bawaan.';
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
    <>
    <ConfirmDialog state={konfirmasi} onCancel={() => setKonfirmasi(null)} />
    <Modal buka={buka} onTutup={onTutup} ukuran="penuh" ikon={<Ikon nama="⚙" ukuran={18} />}
      judul={<>Referensi modul & hardware {diubah && <span className="ml-2 align-middle text-[11px] font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-800">diubah</span>}</>}
      keterangan={`Isi sesuai datasheet produk yang ditawarkan. Pilihan pitch dan hardware di kalkulator langsung memakai tabel ini. ${keteranganSumber}`}
      footer={
        <div className="flex items-center justify-between gap-2 w-full flex-wrap">
          <div className="flex items-center gap-3 flex-wrap">
            {sumber === 'lokal' && (
              <button type="button" onClick={() => setKonfirmasi({ message: 'Buang perubahan di perangkat ini?', danger: true, confirmLabel: 'Buang', onConfirm: reset })}
                className="text-[12.5px] font-semibold text-blue-700 hover:underline">Buang perubahan lokal</button>
            )}
            {sumber === 'tim' && bolehSimpanTim && diubah && (
              <button type="button" disabled={sibuk} onClick={() => setKonfirmasi({ message: 'Kembalikan referensi SELURUH TIM ke tabel bawaan?', danger: true, confirmLabel: 'Kembalikan', onConfirm: () => void resetTim() })}
                className="text-[12.5px] font-semibold text-rose-700 hover:underline disabled:opacity-50">Kembalikan tim ke tabel bawaan</button>
            )}
            {pesan && <span className="text-[12px] text-slate-600">{pesan}</span>}
          </div>
          <div className="flex items-center gap-2">
            {sumber === 'lokal' && bolehSimpanTim && (
              <button type="button" disabled={sibuk} onClick={() => void simpanUntukTim()}
                className="px-4 py-2 rounded-xl text-sm font-bold text-blue-800 bg-blue-50 border border-blue-200 hover:bg-blue-100 disabled:opacity-50">
                {sibuk ? 'Menyimpan...' : 'Simpan untuk seluruh tim'}
              </button>
            )}
            <button type="button" onClick={onTutup} className="px-4 py-2 rounded-xl text-sm font-bold text-white bg-blue-700 hover:bg-blue-800">Selesai</button>
          </div>
        </div>
      }>
      <div className="space-y-5">
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
      </div>
    </Modal>
    </>
  );
}
