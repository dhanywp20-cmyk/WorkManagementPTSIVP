'use client';
/** Tabel sending card / video processor yang bisa diedit. */
import { Hapus, SelAngka, SelTeks, Tambah, td, th } from './komponen';
import type { Hardware } from '@/lib/av-hitung';

export function TabelHardware({ judul, data, onUbah, tampilSender }: { judul: string; data: Hardware[]; onUbah: (d: Hardware[]) => void; tampilSender: boolean }) {
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
