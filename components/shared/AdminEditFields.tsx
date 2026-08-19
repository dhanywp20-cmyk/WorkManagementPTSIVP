'use client';
import type { AdminField } from '@/lib/admin-edit';

/**
 * Grid isian untuk panel "Edit Detail" milik admin.
 *
 * Digerakkan skema (lihat AdminField), bukan JSX per field, karena tiga modul
 * memakainya dengan 20–40 field masing-masing. Ditulis manual, itu berarti
 * ratusan baris yang nyaris sama - dan tiap penambahan kolom di database harus
 * disisipkan di tiga tempat berbeda dengan gaya yang pelan-pelan menyimpang.
 */
export function AdminEditFields({
  fields, value, onChange, disabled,
}: {
  fields: AdminField[];
  value: Record<string, unknown>;
  onChange: (key: string, next: string) => void;
  disabled?: boolean;
}) {
  const kelasIsian =
    'w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none ' +
    'focus:ring-2 focus:ring-rose-200 focus:border-rose-400 disabled:bg-slate-50 disabled:text-slate-400';

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {fields.map(f => {
        // Nilai SELALU dijadikan string terkendali. Kalau null dibiarkan lewat,
        // React memperlakukan isiannya sebagai uncontrolled dan memunculkan
        // peringatan begitu user mulai mengetik.
        const v = value[f.key];
        const teks = v === null || v === undefined ? '' : String(v);
        const span = f.span === 3 ? 'lg:col-span-3 sm:col-span-2' : f.span === 2 ? 'sm:col-span-2' : '';
        return (
          <div key={f.key} className={span}>
            <label className="block text-[11px] font-bold mb-1 text-slate-600 uppercase tracking-widest">
              {f.label}
            </label>
            {f.type === 'textarea' ? (
              <textarea rows={3} value={teks} disabled={disabled} placeholder={f.placeholder}
                onChange={e => onChange(f.key, e.target.value)} className={kelasIsian + ' resize-y'} />
            ) : f.type === 'select' ? (
              <select aria-label="— pilih —" value={teks} disabled={disabled}
                onChange={e => onChange(f.key, e.target.value)} className={kelasIsian + ' bg-white'}>
                <option value="">— pilih —</option>
                {(f.options ?? []).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            ) : (
              <input type={f.type ?? 'text'} value={teks} disabled={disabled} placeholder={f.placeholder}
                onChange={e => onChange(f.key, e.target.value)} className={kelasIsian} />
            )}
          </div>
        );
      })}
    </div>
  );
}
