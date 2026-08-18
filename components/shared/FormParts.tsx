'use client';

/**
 * Shared form helpers — sama persis dipakai di reminder-schedule & form-review.
 */

/**
 * Ukuran label & header sengaja kecil.
 *
 * Form create kini bertata letak tiga kolom dalam satu layar; tiap kolom cuma
 * selebar ~470px. Ukuran yang nyaman saat form masih satu kolom lebar membuat
 * isian di sini berdesakan dan justru memaksa gulir — yang persis ingin
 * dihindari oleh tata letak satu layar itu.
 */
export function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[10px] font-bold mb-1 tracking-widest uppercase" style={{ color: '#94a3b8' }}>{label}</label>
      {children}
    </div>
  );
}

export function SectionHeader({ icon, title }: { icon: string; title: string }) {
  return (
    <div className="flex items-center gap-1.5 pb-1.5 border-b" style={{ borderColor: 'rgba(0,0,0,0.1)' }}>
      <span className="text-sm">{icon}</span>
      <span className="text-xs font-bold tracking-wide text-slate-700">{title}</span>
    </div>
  );
}

export function SectionHeaderSmall({ icon, title }: { icon: string; title: string }) {
  return (
    <p className="text-[10px] font-bold tracking-widest uppercase flex items-center gap-1.5" style={{ color: '#94a3b8' }}>
      <span>{icon}</span>{title}
    </p>
  );
}

export function InfoRow({ icon, label, value }: { icon: string; label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
      <span className="text-base flex-shrink-0">{icon}</span>
      <div className="min-w-0">
        <p className="text-[10px] font-bold tracking-widest uppercase" style={{ color: '#64748b' }}>{label}</p>
        <p className="text-sm font-semibold text-slate-800 break-words">{value}</p>
      </div>
    </div>
  );
}

/**
 * InfoLine — compact print-style row untuk detail popup (style dari ticketing)
 */
export function InfoLine({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="py-2 border-b border-gray-100 last:border-0">
      <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500 mr-1.5">{label}:</span>
      <span className="text-sm text-slate-800 font-medium">{value}</span>
    </div>
  );
}
