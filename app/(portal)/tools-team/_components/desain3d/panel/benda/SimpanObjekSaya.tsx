'use client';
/** Simpan benda terpilih ke "Objek saya" (pribadi per akun - simpan/useObjekSaya.ts). */
import { useState } from 'react';
import type { KonteksAtur } from './konteks';

export function SimpanObjekSaya({ c }: { c: KonteksAtur }) {
  const { b, onSimpanObjek } = c;
  const [form, setForm] = useState<{ nama: string; ket: string; galat: string; sibuk: boolean } | null>(null);
  if (!onSimpanObjek) return null;
  if (!form) {
    return (
      <button type="button" onClick={() => setForm({ nama: b.nama, ket: '', galat: '', sibuk: false })}
        title="Simpan ke perpustakaan objek pribadi Anda - bisa dipakai lagi di desain lain & diekspor ke akun lain"
        className="w-full px-3 py-2 rounded-xl text-[12.5px] font-bold text-sky-800 bg-sky-50 border border-sky-200 hover:bg-sky-100">
        👤 Simpan ke Objek saya
      </button>
    );
  }
  const kirim = async () => {
    setForm({ ...form, sibuk: true, galat: '' });
    const galat = await onSimpanObjek(form.nama.trim(), form.ket.trim());
    if (galat) setForm({ ...form, sibuk: false, galat }); else setForm(null);
  };
  return (
    <div className="rounded-xl border border-sky-200 bg-sky-50/60 p-2.5 space-y-2">
      <p className="text-[11px] font-bold uppercase tracking-wider text-sky-800">👤 Objek saya</p>
      <input value={form.nama} maxLength={80} onChange={e => setForm({ ...form, nama: e.target.value })} placeholder="Nama objek" aria-label="Nama objek"
        className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-base sm:text-sm" />
      <input value={form.ket} maxLength={120} onChange={e => setForm({ ...form, ket: e.target.value })} placeholder="Keterangan (opsional)" aria-label="Keterangan objek"
        className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-base sm:text-sm" />
      {form.galat && <p className="text-[12px] font-semibold text-rose-700">{form.galat}</p>}
      <div className="flex gap-2">
        <button type="button" disabled={form.sibuk || !form.nama.trim()} onClick={() => void kirim()}
          className="flex-1 px-3 py-1.5 rounded-lg text-[12.5px] font-bold text-white bg-sky-700 hover:bg-sky-800 disabled:opacity-50">
          {form.sibuk ? 'Menyimpan…' : 'Simpan'}
        </button>
        <button type="button" onClick={() => setForm(null)}
          className="px-3 py-1.5 rounded-lg text-[12.5px] font-bold border border-slate-200 bg-white text-slate-700 hover:bg-slate-50">Batal</button>
      </div>
    </div>
  );
}
