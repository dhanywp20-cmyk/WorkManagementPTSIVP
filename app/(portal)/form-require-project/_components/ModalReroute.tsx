'use client';

/** ModalReroute - dipecah dari app/(portal)/form-require-project/page.tsx (scripts/ekstrak-jsx.mjs). Semua keadaan tetap milik induk. */
import { ModalPortal } from '@/components/shared';
import { IkonTeks } from '@/components/shared/Ikon';
import { bolehDitugaskanOleh } from '@/lib/teams';
import { ProjectRequest } from './shared';

export interface ModalRerouteProps {
  isAdmin: boolean;
  isSuperAdmin: boolean;
  rerouteSaving: boolean;
  rerouteTarget: ProjectRequest | null;
  rerouteTo: string;
  rosterPTS: { id: string; full_name: string; jabatan: string | null; phone_number: string | null; team_type?: string | null; bisa_ditugaskan?: boolean | null; }[];
  setRerouteTarget: import("react").Dispatch<import("react").SetStateAction<ProjectRequest | null>>;
  setRerouteTo: import("react").Dispatch<import("react").SetStateAction<string>>;
  simpanReroute: () => Promise<void>;
}

export function ModalReroute({ isAdmin, isSuperAdmin, rerouteSaving, rerouteTarget, rerouteTo, rosterPTS, setRerouteTarget, setRerouteTo, simpanReroute }: ModalRerouteProps) {
  return (
    <>
      {rerouteTarget && (
      <ModalPortal>
        <div role="dialog" aria-modal="true" className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[1100]"
          onClick={e => { if (e.target === e.currentTarget && !rerouteSaving) setRerouteTarget(null); }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4" style={{ background: 'linear-gradient(135deg,#6366f1,#4f46e5)' }}>
              <h3 className="text-lg font-bold text-white"><IkonTeks nama="🔀" />Alihkan Pekerjaan</h3>
              <p className="text-indigo-100/90 text-xs mt-0.5 truncate">{rerouteTarget.project_name}</p>
            </div>
            <div className="p-6 space-y-4">
              <div className="rounded-xl p-3 text-xs" style={{ background: 'rgba(99,102,241,0.07)', border: '1px solid rgba(99,102,241,0.2)' }}>
                Sekarang dikerjakan: <strong>{rerouteTarget.assign_name || 'belum di-assign'}</strong>
              </div>
              <div>
                <label htmlFor="f-form-require-project-page-2" className="block text-[11px] font-bold mb-1 text-slate-600 uppercase tracking-widest">Alihkan ke</label>
                <select id="f-form-require-project-page-2" value={rerouteTo} onChange={e => setRerouteTo(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-200">
                  <option value="">— pilih tujuan —</option>
                  {rosterPTS.filter(u => u.jabatan === 'Supervisor').length > 0 && (
                    <optgroup label="🎯 Supervisor">
                      {rosterPTS.filter(u => u.jabatan === 'Supervisor').map(u => (
                        <option key={u.id} value={u.id}>{u.full_name} (Supervisor)</option>
                      ))}
                    </optgroup>
                  )}
                  <optgroup label="👥 Anggota Tim">
                    {/* Toggle per akun + aturan Manager (hanya Admin murni yang boleh
                        meng-assign Manager) - lihat bolehDitugaskanOleh di lib/teams.ts. */}
                    {rosterPTS.filter(u => u.jabatan !== 'Supervisor' && bolehDitugaskanOleh(u, isAdmin || isSuperAdmin)).map(u => (
                      <option key={u.id} value={u.id}>{u.full_name}</option>
                    ))}
                  </optgroup>
                </select>
                <p className="text-[11px] text-slate-500 mt-1.5">
                  Kalau dialihkan ke Supervisor, request kembali ke tahap penugasan — Supervisor
                  itu yang menentukan siapa yang mengerjakan. Tujuannya langsung dikabari lewat WA.
                </p>
              </div>
            </div>
            <div className="px-6 py-4 flex gap-3 border-t border-slate-100">
              <button onClick={() => setRerouteTarget(null)} disabled={rerouteSaving}
                className="flex-1 py-2.5 rounded-xl font-semibold text-sm border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40">
                Batal
              </button>
              <button onClick={simpanReroute} disabled={rerouteSaving || !rerouteTo}
                className="flex-[2] text-white py-2.5 rounded-xl font-bold text-sm disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg,#6366f1,#4f46e5)' }}>
                {rerouteSaving ? 'Mengalihkan...' : '🔀 Alihkan Sekarang'}
              </button>
            </div>
          </div>
        </div>
      </ModalPortal>
      )}
    </>
  );
}
