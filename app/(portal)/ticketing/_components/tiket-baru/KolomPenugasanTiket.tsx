'use client';

/** KolomPenugasanTiket - dipecah dari app/(portal)/ticketing/_components/NewTicketModal.tsx (scripts/ekstrak-jsx.mjs). Semua keadaan tetap milik induk. */
import { Ikon } from '@/components/shared/Ikon';
import { SalesPicker } from '@/components/shared';
import { User, TeamMember } from '../shared';
import { type NewTicketForm } from '../NewTicketModal';

export interface KolomPenugasanTiketProps {
  canAssignDirect: boolean;
  currentUser: User | null;
  externalSalesUsers: { id: string; full_name: string; sales_division: string | null; }[];
  form: NewTicketForm;
  isInternalSalesGuest: boolean;
  set: (patch: Partial<NewTicketForm>) => void;
  supervisorMembers: TeamMember[];
  teamPTSMembers: TeamMember[];
  users: User[];
}

export function KolomPenugasanTiket({ canAssignDirect, currentUser, externalSalesUsers, form, isInternalSalesGuest, set, supervisorMembers, teamPTSMembers, users }: KolomPenugasanTiketProps) {
  return (
    <>
      <div className="space-y-4 satulayar:pr-2 satulayar:min-h-0">
      <div className="flex items-center gap-2 pb-2 border-b" style={{ borderColor: "rgba(0,0,0,0.08)" }}>
        <span className="text-sm"><Ikon nama="🎯" ukuran="1em" className="inline-block align-[-0.12em]" /></span>
        <h3 className="text-sm font-bold tracking-wide text-slate-700">Penugasan &amp; Lampiran</h3>
      </div>

      {/* SBU — Sales Internal (guest) buat ticket ATAS NAMA Sales External.
         Opsional; kalau kosong, ticket atas nama Sales Internal sendiri. */}
      {isInternalSalesGuest && (
        <div>
          <div className="flex items-center gap-2 pb-2 border-b pt-2 mb-3" style={{ borderColor: "rgba(0,0,0,0.1)" }}>
            <span className="text-lg"><Ikon nama="🏢" ukuran="1em" className="inline-block align-[-0.12em]" /></span>
            <span className="text-sm font-bold tracking-wide text-slate-700">SBU (Sales External)</span>
          </div>
          <label className="block text-[11px] font-bold mb-1.5 tracking-widest uppercase" style={{ color: "#94a3b8" }}>
            SBU <span className="normal-case text-gray-500 font-medium tracking-normal">(opsional — atas nama Sales External)</span>
          </label>
          <SalesPicker
            value={form.sales_name}
            users={externalSalesUsers}
            onChange={(name, div, id) => set({ sales_name: name, sales_division: div, sales_user_id: id })}
            placeholder="— Pilih Sales External (opsional) —"
            triggerClassName="rounded-xl px-4 py-3 cursor-pointer"
            triggerStyle={{ background: "rgba(255,255,255,0.90)", border: "1px solid rgba(0,0,0,0.12)" }}
          />
          {form.sales_name && (
            <p className="text-[11px] text-red-500 mt-1">Ticket diatasnamakan <strong>{form.sales_name}</strong>{form.sales_division ? ` · ${form.sales_division}` : ''}.</p>
          )}
        </div>
      )}

      {/* Sales — hidden for guest (auto-inserted), shown for admin/team */}
      {currentUser?.role !== "guest" && (
        <div>
          <div className="flex items-center gap-2 pb-2 border-b pt-2 mb-3" style={{ borderColor: "rgba(0,0,0,0.1)" }}>
            <span className="text-lg"><Ikon nama="🏢" ukuran="1em" className="inline-block align-[-0.12em]" /></span>
            <span className="text-sm font-bold tracking-wide text-slate-700">Informasi Sales</span>
          </div>
          <label className="block text-[11px] font-bold mb-1.5 tracking-widest uppercase" style={{ color: "#94a3b8" }}>Sales Name</label>
          <SalesPicker
            value={form.sales_name}
            users={users.filter(u => u.role === "guest")}
            onChange={(name, div, id) => set({ sales_name: name, sales_division: div, sales_user_id: id })}
            triggerClassName="rounded-xl px-4 py-3 cursor-pointer"
            triggerStyle={{ background: "rgba(255,255,255,0.90)", border: "1px solid rgba(0,0,0,0.12)" }}
          />
        </div>
      )}

      {/* Admin/Superadmin/Manager: tentukan penanganan langsung */}
      {canAssignDirect && (
        <div>
          <div className="flex items-center gap-2 pb-2 border-b pt-2 mb-3" style={{ borderColor: "rgba(0,0,0,0.1)" }}>
            <span className="text-lg"><Ikon nama="👷" ukuran="1em" className="inline-block align-[-0.12em]" /></span>
            <span className="text-sm font-bold tracking-wide text-slate-700">Penanganan</span>
          </div>
          <label className="block text-[11px] font-bold mb-1.5 tracking-widest uppercase" style={{ color: "#94a3b8" }}>Tugaskan ke *</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2">👨‍💼</span>
            <select aria-label="— Pilih penanganan —" value={form.assign_name} onChange={e => set({ assign_name: e.target.value })}
              className="w-full rounded-xl pl-9 pr-4 py-2.5 text-sm outline-none transition-all text-slate-800 focus:ring-2 focus:ring-red-500/40 appearance-none cursor-pointer"
              style={{ background: "rgba(255,255,255,0.90)", border: "1px solid rgba(0,0,0,0.12)" }}>
              <option value="">— Pilih penanganan —</option>
              <option value="SELF">Saya kerjakan sendiri</option>
              <optgroup label="👷 Assign langsung ke Team PTS">
                {teamPTSMembers.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
              </optgroup>
              {supervisorMembers.length > 0 && (
                <optgroup label="🎯 Route ke Supervisor">
                  {supervisorMembers.map(m => <option key={`sup-${m.id}`} value={`SUP::${m.id}::${m.name}`}>{m.name} (Supervisor)</option>)}
                </optgroup>
              )}
            </select>
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none text-xs">▾</span>
          </div>
        </div>
      )}

      {/* Approval notice — hanya utk yg TIDAK bisa assign langsung (guest / team biasa) */}
      {!canAssignDirect && (
        <div className="rounded-xl p-4 flex items-start gap-3"
          style={{ background: "rgba(245,158,11,0.1)", border: "1.5px solid rgba(245,158,11,0.3)" }}>
          <span className="text-2xl"><Ikon nama="⏳" ukuran="1em" className="inline-block align-[-0.12em]" /></span>
          <div>
            <p className="text-sm font-bold text-orange-800">Perlu Persetujuan Superadmin</p>
            <p className="text-xs text-orange-700 mt-0.5">
              Ticket yang Anda buat akan masuk ke antrian approval Superadmin terlebih dahulu.
              Setelah disetujui, Superadmin akan assign ticket ke Tim PTS yang tersedia.
            </p>
          </div>
        </div>
      )}

      {/* Upload Foto */}
      <div className="flex items-center gap-2 pb-2 border-b pt-2" style={{ borderColor: "rgba(0,0,0,0.1)" }}>
        <span className="text-lg"><Ikon nama="📸" ukuran="1em" className="inline-block align-[-0.12em]" /></span>
        <span className="text-sm font-bold tracking-wide text-slate-700">Foto Pendukung</span>
      </div>
      <div>
        <label className="block text-[11px] font-bold mb-1.5 tracking-widest uppercase" style={{ color: "#94a3b8" }}>
          Upload Foto <span className="text-gray-500 font-normal">(Optional)</span>
        </label>
        <p className="text-xs text-gray-500 mb-3">Foto pendukung kondisi awal / bukti masalah</p>
        <input type="file" accept="image/*" aria-label="Foto pendukung ticket" onChange={e => set({ photo: e.target.files?.[0] || null })}
          className="w-full border rounded-xl px-4 py-2.5 bg-white file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-red-50 file:text-red-700 hover:file:bg-red-100 transition-all text-sm"
          style={{ borderColor: "rgba(0,0,0,0.12)" }} />
        {form.photo && (
          <div className="mt-3 space-y-2">
            <div className="flex items-center gap-2 p-2 bg-white rounded-lg border" style={{ borderColor: "rgba(220,38,38,0.2)" }}>
              <span className="text-red-600">✓</span>
              <span className="text-sm font-semibold text-gray-700 flex-1 truncate">{form.photo.name}</span>
              <span className="text-xs text-gray-500">({(form.photo.size / 1024).toFixed(1)} KB)</span>
              <button aria-label="Tutup" type="button" onClick={() => set({ photo: null })} className="text-red-600 hover:text-red-700 font-bold text-xs ml-1">✕</button>
            </div>
            <img src={URL.createObjectURL(form.photo)} alt="Preview"
              className="w-full max-h-48 object-cover rounded-lg border-2 shadow-sm"
              style={{ borderColor: "rgba(220,38,38,0.3)" }} />
          </div>
        )}
      </div>

      {/* Action Buttons */}
      </div>
    </>
  );
}
