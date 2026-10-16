'use client';

/** KolomBarangKeluhan - dipecah dari app/(portal)/ticketing/_components/NewTicketModal.tsx (scripts/ekstrak-jsx.mjs). Semua keadaan tetap milik induk. */
import { Ikon, IkonTeks } from '@/components/shared/Ikon';
import { type NewTicketForm } from '../NewTicketModal';

export interface KolomBarangKeluhanProps {
  form: NewTicketForm;
  set: (patch: Partial<NewTicketForm>) => void;
}

export function KolomBarangKeluhan({ form, set }: KolomBarangKeluhanProps) {
  return (
    <>
      <div className="space-y-4 satulayar:pr-2 satulayar:min-h-0">
      <div className="flex items-center gap-2 pb-2 border-b" style={{ borderColor: "rgba(0,0,0,0.08)" }}>
        <span className="text-sm"><Ikon nama="📦" ukuran="1em" className="inline-block align-[-0.12em]" /></span>
        <h3 className="text-sm font-bold tracking-wide text-slate-700">Product &amp; Issue</h3>
      </div>

      {/* Row 2: Product | SN Unit */}
      <div className="grid grid-cols-1 gap-4">
        <div>
          <label className="block text-[11px] font-bold mb-1.5 tracking-widest uppercase" style={{ color: "#94a3b8" }}><IkonTeks nama="📦" />Product / Brand</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2"><Ikon nama="📦" ukuran="1em" className="inline-block align-[-0.12em]" /></span>
            <input type="text" value={form.product} onChange={e => set({ product: e.target.value })}
              placeholder="Panasonic PT-MZ682, LG 75UL3Q, dll"
              className="w-full rounded-xl pl-9 pr-4 py-2.5 text-sm outline-none transition-all text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-red-500/40"
              style={{ background: "rgba(255,255,255,0.95)", border: "1px solid rgba(0,0,0,0.12)" }} />
          </div>
        </div>
        <div>
          <label className="block text-[11px] font-bold mb-1.5 tracking-widest uppercase" style={{ color: "#94a3b8" }}>
            SN Unit <span className="text-gray-500 normal-case font-normal text-[11px]">(opsional)</span>
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2"><Ikon nama="🔢" ukuran="1em" className="inline-block align-[-0.12em]" /></span>
            <input type="text" value={form.sn_unit} onChange={e => set({ sn_unit: e.target.value })}
              placeholder="SN12345678 (opsional)"
              className="w-full rounded-xl pl-9 pr-4 py-2.5 text-sm outline-none transition-all text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-red-500/40"
              style={{ background: "rgba(255,255,255,0.95)", border: "1px solid rgba(0,0,0,0.12)" }} />
          </div>
        </div>
      </div>


      <div>
        <div>
          <label className="block text-[11px] font-bold mb-1.5 tracking-widest uppercase" style={{ color: "#94a3b8" }}>
            <IkonTeks nama="📅" />Date <span className="text-gray-500 normal-case font-normal text-[11px]">(hari ini)</span>
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"><Ikon nama="📅" ukuran="1em" className="inline-block align-[-0.12em]" /></span>
            <input type="text"
              value={new Date().toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })}
              disabled
              aria-label="Tanggal ticket (otomatis hari ini)"
              className="w-full rounded-xl pl-9 pr-4 py-2.5 text-sm text-slate-500 cursor-not-allowed"
              style={{ background: "rgba(0,0,0,0.04)", border: "1px solid rgba(0,0,0,0.08)" }} />
          </div>
        </div>
      </div>

      {/* Issue Case */}
      <div>
        <label className="block text-[11px] font-bold mb-1.5 tracking-widest uppercase" style={{ color: "#94a3b8" }}>Issue Case *</label>
        <div className="relative">
          <span className="absolute left-3 top-3"><Ikon nama="⚠" ukuran="1em" className="inline-block align-[-0.12em]" /></span>
          <input type="text" value={form.issue_case}
            onChange={e => {
              const val = e.target.value;
              const words = val.trim().split(/\s+/).filter(Boolean);
              if (words.length < 4 || (words.length === 4 && !val.endsWith(" ")))
                set({ issue_case: val });
            }}
            placeholder="Maks. 4 kata, contoh: Videowall Not Working"
            className="w-full rounded-xl pl-9 pr-4 py-2.5 text-sm outline-none transition-all text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-red-500/40"
            style={{ background: "rgba(255,255,255,0.95)", border: "1px solid rgba(0,0,0,0.12)" }} />
        </div>
        <div className="flex justify-between items-center mt-1.5 px-1">
          <span className="text-xs text-gray-500">Maksimal 4 kata</span>
          <span className={`text-xs font-bold ${form.issue_case.trim().split(/\s+/).filter(Boolean).length >= 4 ? "text-red-500" : "text-gray-500"}`}>
            {form.issue_case.trim().split(/\s+/).filter(Boolean).length}/4 kata
          </span>
        </div>
      </div>

      {/* Description */}
      <div>
        <label htmlFor="f-ticketing-components-newticketmodal-1" className="block text-[11px] font-bold mb-1.5 tracking-widest uppercase" style={{ color: "#94a3b8" }}><IkonTeks nama="📝" />Detailed Description</label>
        <textarea id="f-ticketing-components-newticketmodal-1" value={form.description} onChange={e => set({ description: e.target.value })}
          rows={3} placeholder="Explain the problem details..."
          className="w-full rounded-xl px-4 py-2.5 text-sm outline-none transition-all text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-red-500/40 resize-none"
          style={{ background: "rgba(255,255,255,0.95)", border: "1px solid rgba(0,0,0,0.12)" }} />
      </div>

      </div>
    </>
  );
}
