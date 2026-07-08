'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import {
  User, ProjectRequest, RoomDetail, BrandPicMapping,
  ProjectMessage, ProjectAttachment,
  statusConfig, JABATAN_TIER, JABATAN_CC_RULES,
  fetchWACCTargets, sendWANotif, emptyRoom,
  SALES_DIVISIONS, DISPLAY_BRANDS, MIDDLEWARE_BRANDS,
  PIE_COLORS,
} from './shared';
import { SalesPicker } from '@/components/shared';
import { isAssignablePTSTeam } from '@/lib/teams';

export function AssignPTSModal({
  req, onClose, onAssigned, currentUser, allowSupervisorRoute = false,
}: {
  req: ProjectRequest; onClose: () => void; onAssigned: () => void; currentUser: User;
  // true = dibuka oleh Admin/Manager saat approve → boleh pilih "Route ke Supervisor".
  // false = dibuka oleh Supervisor utk assign final ke Tim PTS (tanpa opsi route).
  allowSupervisorRoute?: boolean;
}) {
  const [teamMembers, setTeamMembers] = useState<User[]>([]);
  const [ivpUsers, setIvpUsers] = useState<User[]>([]);
  const [supervisors, setSupervisors] = useState<{ id: string; full_name: string; team_type?: string; phone_number?: string }[]>([]);
  const [selectedPTS, setSelectedPTS] = useState(req.assign_name || '');
  const [selectedIVP, setSelectedIVP] = useState(req.ivp_assignee || '');
  const [selectedSupervisorId, setSelectedSupervisorId] = useState('');
  // mode: 'direct' = assign langsung ke Tim PTS; 'supervisor' = route ke Supervisor
  const [mode, setMode] = useState<'direct' | 'supervisor'>('direct');
  const [saving, setSaving] = useState(false);
  const [formErr, setFormErr] = useState('');

  // Request dari external (non-IVP) wajib assign IVP Sales internal
  const isExternal = !!(req.sales_division && req.sales_division.trim() && req.sales_division.trim().toUpperCase() !== 'IVP');

  useEffect(() => {
    // Fetch Team PTS (hanya team assignable = IVP/MVI, UMP dikecualikan — lib/teams.ts)
    supabase.from('users')
      .select('id, full_name, role, team_type, phone_number, sales_division')
      .in('role', ['team_pts', 'team'])
      .then(({ data }: { data: User[] | null }) => { if (data) setTeamMembers(data.filter(u => isAssignablePTSTeam(u.team_type))); });
    // Fetch IVP Sales internal (guest dengan sales_division = IVP)
    supabase.from('users')
      .select('id, full_name, role, phone_number, sales_division')
      .eq('role', 'guest')
      .eq('sales_division', 'IVP')
      .then(({ data }: { data: User[] | null }) => { if (data) setIvpUsers(data); });
    // Fetch Supervisor (jabatan='Supervisor') — utk opsi Route ke Supervisor
    if (allowSupervisorRoute) {
      supabase.from('users')
        .select('id, full_name, team_type, phone_number')
        .eq('jabatan', 'Supervisor')
        .then(({ data }: { data: { id: string; full_name: string; team_type?: string; phone_number?: string }[] | null }) => { if (data) setSupervisors(data.filter(s => isAssignablePTSTeam(s.team_type))); });
    }
  }, [allowSupervisorRoute]);

  // ── Route ke Supervisor: request lanjut ke Supervisor utk di-assign ke tim ──
  const handleRouteToSupervisor = async () => {
    if (!selectedSupervisorId) { setFormErr('Pilih Supervisor tujuan terlebih dahulu.'); return; }
    if (isExternal && !selectedIVP) { setFormErr('Request dari divisi external wajib assign IVP Sales internal.'); return; }
    setFormErr('');
    setSaving(true);
    const sup = supervisors.find(s => s.id === selectedSupervisorId);
    const updatePayload: Record<string, unknown> = {
      status: 'approved',
      approved_by: currentUser.full_name,
      approved_at: new Date().toISOString(),
      routing_status: 'supervisor_assign',
      assigned_supervisor_id: selectedSupervisorId,
      assign_name: null,   // belum di-assign ke handler — Supervisor yg lanjut
    };
    if (isExternal) updatePayload.ivp_assignee = selectedIVP;
    const { error } = await supabase.from('project_requests').update(updatePayload).eq('id', req.id);
    if (error) { setFormErr('Gagal route: ' + error.message); setSaving(false); return; }
    await supabase.from('project_messages').insert([{
      request_id: req.id, sender_id: currentUser.id, sender_name: 'System', sender_role: 'system',
      message: `✅ Request diapprove oleh ${currentUser.full_name} & diteruskan ke Supervisor ${sup?.full_name ?? '-'} untuk di-assign ke tim.`,
    }]);
    if (sup?.phone_number) {
      const lines = [
        '🎯 *Request Design — Perlu Di-assign ke Tim*',
        '━━━━━━━━━━━━━━━━━━',
        `📋 Project  : ${req.project_name}`,
        `🏢 Sales    : ${req.sales_name || '-'} (${req.sales_division || '-'})`,
        `👤 Requester: ${req.requester_name}`,
        '━━━━━━━━━━━━━━━━━━',
        'Sudah diapprove Admin/Manager — silakan assign ke anggota tim kamu atau kerjakan sendiri.',
        '🔗 https://work-management-ptsivp.vercel.app/dashboard',
      ].join('\n');
      await sendWANotif({ type: 'reminder_wa', target: sup.phone_number, message: lines });
    }
    setSaving(false);
    onAssigned();
  };

  const handleSave = async () => {
    if (mode === 'supervisor') { await handleRouteToSupervisor(); return; }
    if (!selectedPTS) { setFormErr('Pilih Tim PTS handler terlebih dahulu.'); return; }
    if (isExternal && !selectedIVP) { setFormErr('Request dari divisi external wajib assign IVP Sales internal.'); return; }
    setFormErr('');
    setSaving(true);

    const updatePayload: Record<string, unknown> = {
      assign_name: selectedPTS,
      status: 'approved',
      approved_by: currentUser.full_name,
      approved_at: new Date().toISOString(),
      // Assign final ke handler → bersihkan penanda tahap Supervisor (kalau tadinya di-route).
      routing_status: null,
      assigned_supervisor_id: null,
    };
    if (isExternal) updatePayload.ivp_assignee = selectedIVP;

    const { error } = await supabase.from('project_requests').update(updatePayload).eq('id', req.id);
    if (!error) {
      const ivpNote = isExternal && selectedIVP ? ` IVP Sales yang di-assign: ${selectedIVP}.` : '';
      await supabase.from('project_messages').insert([{
        request_id: req.id,
        sender_id: currentUser.id,
        sender_name: 'System',
        sender_role: 'system',
        message: `✅ Request diapprove oleh ${currentUser.full_name}. Assigned ke Tim PTS: ${selectedPTS}.${ivpNote}`,
      }]);

      // WA notif ke PTS
      const ptsMember = teamMembers.find(m => m.full_name === selectedPTS);
      if (ptsMember?.phone_number) {
        const lines = [
          '🏗️ *request design Project — Assigned ke Kamu*',
          '━━━━━━━━━━━━━━━━━━',
          `📋 Project  : ${req.project_name}`,
          `🛋️ Ruangan  : ${req.room_name || '-'}`,
          `🏢 Sales    : ${req.sales_name || '-'} (${req.sales_division || '-'})`,
          `👤 Requester: ${req.requester_name}`,
          isExternal && selectedIVP ? `🔗 IVP CC   : ${selectedIVP}` : '',
          '━━━━━━━━━━━━━━━━━━',
          'Segera proses dan update status ya! 💪',
          '🔗 https://work-management-ptsivp.vercel.app/dashboard',
        ].filter(Boolean).join('\n');
        await sendWANotif({ type: 'reminder_wa', target: ptsMember.phone_number, message: lines });
      }

      // WA notif ke IVP yang di-assign
      if (isExternal && selectedIVP) {
        const ivpUser = ivpUsers.find(u => u.full_name === selectedIVP);
        if (ivpUser?.phone_number) {
          const lines = [
            '🔗 *request design — Kamu Di-assign sebagai IVP Sales*',
            '━━━━━━━━━━━━━━━━━━',
            `📋 Project      : ${req.project_name}`,
			`🛋️ Ruangan		 : ${req.room_name || '-'}`,
            `🏢 Sales Ext.   : ${req.sales_name} (${req.sales_division})`,
            `👷 Tim PTS      : ${selectedPTS}`,
            '━━━━━━━━━━━━━━━━━━',
            'Akses portal untuk melihat detail dan ikut chat.',
            '🔗 https://work-management-ptsivp.vercel.app/dashboard',
          ].join('\n');
          await sendWANotif({ type: 'reminder_wa', target: ivpUser.phone_number, message: lines });
        }
      }
      onAssigned();
    } else {
      setFormErr('Gagal approve: ' + error.message);
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-4">
      <div className="bg-white/90 rounded-2xl shadow-2xl w-full border-2 border-teal-500 overflow-hidden"
        style={{ maxWidth: isExternal ? 680 : 460 }}>

        {/* Header */}
        <div className="bg-gradient-to-r from-teal-600 to-teal-800 px-6 py-4 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-white text-lg">✅ Approve & Assign</h3>
            <p className="text-teal-100 text-xs mt-0.5 flex items-center gap-2">
              {req.project_name}
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${isExternal ? 'bg-orange-400 text-white' : 'bg-teal-400 text-white'}`}>
                {isExternal ? `External · ${req.sales_division}` : 'Internal IVP'}
              </span>
            </p>
          </div>
          <button onClick={onClose} className="bg-white/20 hover:bg-white/30 text-white w-8 h-8 rounded-lg flex items-center justify-center font-bold">✕</button>
        </div>

        {/* Info banner untuk external */}
        {isExternal && (
          <div className="px-6 py-3 flex items-start gap-3 border-b border-indigo-100" style={{ background: 'rgba(99,102,241,0.07)' }}>
            <span className="text-xl flex-shrink-0">🔗</span>
            <div>
              <p className="text-sm font-bold text-indigo-700">Request dari Divisi External: {req.sales_division}</p>
              <p className="text-xs text-indigo-600 mt-0.5">
                Pilih <strong>Tim PTS</strong> yang akan menangani, dan pilih <strong>IVP Sales internal</strong> yang akan di-cc
                untuk memantau dan berpartisipasi dalam project ini.
              </p>
            </div>
          </div>
        )}

        {/* Toggle: assign langsung ke Tim PTS ATAU route ke Supervisor (hanya
            saat dibuka Admin/Manager di tahap approve). */}
        {allowSupervisorRoute && (
          <div className="px-6 pt-4">
            <div className="grid grid-cols-2 gap-2 p-1 rounded-xl" style={{ background: 'rgba(0,0,0,0.04)' }}>
              <button type="button" onClick={() => { setMode('direct'); setFormErr(''); }}
                className={`py-2 rounded-lg text-xs font-bold transition-all ${mode === 'direct' ? 'bg-white text-teal-700 shadow' : 'text-gray-500'}`}>
                👷 Assign langsung ke Tim PTS
              </button>
              <button type="button" onClick={() => { setMode('supervisor'); setFormErr(''); }}
                className={`py-2 rounded-lg text-xs font-bold transition-all ${mode === 'supervisor' ? 'bg-white text-amber-700 shadow' : 'text-gray-500'}`}>
                🎯 Route ke Supervisor
              </button>
            </div>
          </div>
        )}

        <div className={`p-6 ${isExternal ? 'grid grid-cols-2 gap-6' : ''}`}>

          {/* Kolom kiri: Tim PTS (mode direct) ATAU Supervisor (mode supervisor) */}
          <div>
            {mode === 'supervisor' ? (
              <>
                <p className="text-xs font-bold text-amber-600 uppercase tracking-widest mb-1">
                  🎯 Route ke Supervisor <span className="text-red-500">*</span>
                </p>
                <p className="text-[11px] text-gray-500 mb-3">
                  Supervisor yang dipilih akan meng-assign ke anggota tim-nya (atau kerjakan sendiri).
                </p>
                {supervisors.length === 0 ? (
                  <div className="text-center py-8 text-gray-400 text-sm">
                    <div className="text-4xl mb-2">🎯</div>
                    <p>Tidak ada Supervisor terdaftar</p>
                    <p className="text-xs mt-1">(User jabatan = Supervisor di Struktur Organisasi)</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                    {supervisors.map(s => (
                      <button key={s.id} type="button" onClick={() => setSelectedSupervisorId(s.id)}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left transition-all
                          ${selectedSupervisorId === s.id ? 'border-amber-500 bg-amber-50' : 'border-gray-200 hover:border-amber-300 bg-white'}`}>
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0
                          ${selectedSupervisorId === s.id ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-600'}`}>
                          {s.full_name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-bold truncate ${selectedSupervisorId === s.id ? 'text-amber-700' : 'text-gray-700'}`}>{s.full_name}</p>
                          <p className="text-xs text-gray-400">{s.team_type || 'Supervisor'}</p>
                        </div>
                        {selectedSupervisorId === s.id && <span className="text-amber-600 font-bold flex-shrink-0">✓</span>}
                      </button>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">
                  👷 Tim PTS Handler <span className="text-red-500">*</span>
                </p>
                {teamMembers.length === 0 ? (
                  <div className="text-center py-8 text-gray-400 text-sm">
                    <div className="text-4xl mb-2">👥</div>
                    <p>Tidak ada Team PTS tersedia</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                    {teamMembers.map(m => (
                      <button key={m.id} type="button" onClick={() => setSelectedPTS(m.full_name)}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left transition-all
                          ${selectedPTS === m.full_name ? 'border-teal-500 bg-teal-50' : 'border-gray-200 hover:border-teal-300 bg-white'}`}>
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0
                          ${selectedPTS === m.full_name ? 'bg-teal-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
                          {m.full_name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-bold truncate ${selectedPTS === m.full_name ? 'text-teal-700' : 'text-gray-700'}`}>{m.full_name}</p>
                          <p className="text-xs text-gray-400">{m.team_type || m.role}</p>
                        </div>
                        {selectedPTS === m.full_name && <span className="text-teal-600 font-bold flex-shrink-0">✓</span>}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Kolom kanan: IVP Sales — hanya untuk external */}
          {isExternal && (
            <div>
              <p className="text-xs font-bold text-indigo-500 uppercase tracking-widest mb-1">
                🔗 IVP Sales Internal <span className="text-red-500">*</span>
              </p>
              <p className="text-[11px] text-gray-500 mb-3">
                Admin memilih <strong>satu akun IVP</strong> yang akan bisa melihat request ini dan ikut chat.
              </p>
              {ivpUsers.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-sm">
                  <div className="text-4xl mb-2">🏢</div>
                  <p>Tidak ada akun IVP Sales terdaftar</p>
                  <p className="text-xs mt-1">(Akun guest dengan sales_division = IVP)</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {ivpUsers.map(u => (
                    <button key={u.id} type="button" onClick={() => setSelectedIVP(u.full_name)}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left transition-all
                        ${selectedIVP === u.full_name ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:border-indigo-300 bg-white'}`}>
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0
                        ${selectedIVP === u.full_name ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
                        {u.full_name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-bold truncate ${selectedIVP === u.full_name ? 'text-indigo-700' : 'text-gray-700'}`}>{u.full_name}</p>
                        <p className="text-xs text-indigo-400">IVP Sales Internal</p>
                      </div>
                      {selectedIVP === u.full_name && <span className="text-indigo-600 font-bold flex-shrink-0">✓</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 flex flex-col gap-2">
          {formErr && (
            <div className="px-4 py-2.5 rounded-xl text-sm font-medium text-red-700 bg-red-50 border border-red-200">{formErr}</div>
          )}
          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 border-2 border-gray-300 text-gray-700 py-3 rounded-xl font-bold hover:bg-gray-50 transition-all">Batal</button>
            <button onClick={handleSave} disabled={saving || (mode === 'supervisor' ? !selectedSupervisorId : !selectedPTS)}
              className={`flex-[2] text-white py-3 rounded-xl font-bold shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2 ${mode === 'supervisor' ? 'bg-gradient-to-r from-amber-500 to-amber-700' : 'bg-gradient-to-r from-teal-600 to-teal-800'}`}>
              {saving
                ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Menyimpan...</>
                : mode === 'supervisor' ? <>🎯 Approve &amp; Route ke Supervisor</> : <>✅ Approve &amp; Assign</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── RoomSection ─────────────────────────────────────────────────────────────
// Style matches Ruangan 1 exactly: larger buttons (px-3 py-2 text-sm), bold labels

export function RoomSection({ room, rIdx, onUpdate, onRemove, brandPicMappings, photos, onAddPhotos, onRemovePhoto, toggleArr, boqFile, onSetBoq, isGuest }: {
  room: RoomDetail; rIdx: number;
  onUpdate: (patch: Partial<RoomDetail>) => void;
  onRemove: () => void;
  brandPicMappings: BrandPicMapping[];
  photos: File[];
  onAddPhotos: (files: File[]) => void;
  onRemovePhoto: (i: number) => void;
  toggleArr: (arr: string[], val: string) => string[];
  boqFile?: File | null;
  onSetBoq?: (file: File | null) => void;
  isGuest?: boolean;
}) {
  const [previews, setPreviews] = useState<string[]>([]);
  useEffect(() => { setPreviews(photos.map(f => URL.createObjectURL(f))); }, [photos]);
  const fileRef = useRef<HTMLInputElement>(null);
  const boqRef = useRef<HTMLInputElement>(null);
  const getBrandPic = (type: 'display'|'middleware', brand: string) =>
    brandPicMappings.find(m => m.brand_type === type && m.brand_name === brand);

  // Same style as Ruangan 1 RadioGroup
  const YN = ({ label, field, value }: { label: string; field: keyof RoomDetail; value: string }) => (
    <div className="mb-4">
      <label className="block text-xs font-bold text-gray-600 tracking-widest uppercase mb-2">{label}</label>
      <div className="flex flex-wrap gap-2">
        {['Yes','No'].map(opt => (
          <button key={opt} type="button" onClick={() => onUpdate({ [field]: opt } as any)}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 text-sm font-medium transition-all ${value === opt ? 'border-teal-500 bg-teal-50 text-teal-700 shadow-md' : 'border-gray-300 bg-white text-gray-600 hover:border-teal-300'}`}>
            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${value === opt ? 'border-teal-500' : 'border-gray-400'}`}>
              {value === opt && <div className="w-2 h-2 rounded-full bg-teal-500" />}
            </div>
            {opt}
          </button>
        ))}
      </div>
    </div>
  );

  // Same style as Ruangan 1 CheckGroup
  const Chips = ({ label, opts, value, field, multi=true }: { label:string; opts:string[]; value:string[]; field:keyof RoomDetail; multi?:boolean }) => (
    <div className="mb-4">
      <label className="block text-xs font-bold text-gray-600 tracking-widest uppercase mb-2">{label}</label>
      <div className="flex flex-wrap gap-2">
        {opts.map(opt => {
          const active = value.includes(opt);
          return (
            <button key={opt} type="button"
              onClick={() => onUpdate({ [field]: multi ? toggleArr(value, opt) : (active ? [] : [opt]) } as any)}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 text-sm font-medium transition-all ${active ? 'border-teal-500 bg-teal-50 text-teal-700 shadow-md' : 'border-gray-300 bg-white text-gray-600 hover:border-teal-300 hover:bg-teal-50/50'}`}>
              <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${active ? 'border-teal-500 bg-teal-500' : 'border-gray-400'}`}>
                {active && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
              </div>
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="space-y-0">
      {/* Room name header — matches Ruangan 1 style */}
      <div className="flex items-center gap-2 mb-4 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl">
        <span className="text-xs font-black text-teal-700 flex-shrink-0">Ruangan {rIdx + 2}</span>
        <input value={room.room_name} onChange={e => onUpdate({ room_name: e.target.value })}
          placeholder="Nama ruangan / area..."
          className="flex-1 border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm font-medium bg-white outline-none focus:border-teal-400" />
        <button type="button" onClick={onRemove}
          className="p-1.5 rounded-lg bg-red-50 text-red-400 hover:bg-red-100 hover:text-red-600 transition-all flex-shrink-0">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
      </div>

      {/* Kebutuhan */}
      <Chips label="Kebutuhan *" opts={['Signage','Immersive','Meeting Room','Mapping','Command Center','Hybrid Classroom']} value={room.kebutuhan} field="kebutuhan" multi={false} />
      <div className="mb-4">
        <input value={room.kebutuhan_other} onChange={e => onUpdate({ kebutuhan_other: e.target.value })} placeholder="Other kebutuhan..."
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-teal-400" />
      </div>

      {/* Solution Product */}
      <Chips label="Solution Product *" opts={['Videowall','Signage Display','Videotron','Projector','Kiosk','IFP']} value={room.solution_product} field="solution_product" />
      <div className="mb-4">
        <input value={room.solution_other} onChange={e => onUpdate({ solution_other: e.target.value })} placeholder="Other solution..."
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-teal-400" />
      </div>

      {/* Brand Display & Middleware */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4 pt-2 border-t border-gray-100">
        <div>
          <label className="block text-[10px] font-bold text-amber-600 uppercase tracking-widest mb-1.5">🖥️ Brand Display <span className="text-gray-400 font-normal">(opsional)</span></label>
          <select value={room.brand_display} onChange={e => {
            const brand = e.target.value;
            const pic = getBrandPic('display', brand);
            onUpdate({ brand_display: brand, brand_display_pic_id: pic?.pic_user_id||'', brand_display_pic_name: pic?.pic_user_name||'' });
          }} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-amber-400 appearance-none">
            <option value="">— Pilih Brand Display —</option>
            {DISPLAY_BRANDS.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
          {room.brand_display && room.brand_display_pic_name && <p className="mt-1 text-[11px] text-amber-700 font-semibold bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1">👤 PIC: {room.brand_display_pic_name}</p>}
          {room.brand_display && !room.brand_display_pic_name && <p className="mt-1 text-[11px] text-gray-400 italic">PIC belum di-set admin</p>}
        </div>
        <div>
          <label className="block text-[10px] font-bold text-violet-600 uppercase tracking-widest mb-1.5">🔌 Brand Middleware <span className="text-gray-400 font-normal">(opsional)</span></label>
          <select value={room.brand_middleware} onChange={e => {
            const brand = e.target.value;
            const pic = getBrandPic('middleware', brand);
            onUpdate({ brand_middleware: brand, brand_middleware_pic_id: pic?.pic_user_id||'', brand_middleware_pic_name: pic?.pic_user_name||'' });
          }} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-violet-400 appearance-none">
            <option value="">— Pilih Brand Middleware —</option>
            {MIDDLEWARE_BRANDS.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
          {room.brand_middleware && room.brand_middleware_pic_name && <p className="mt-1 text-[11px] text-violet-700 font-semibold bg-violet-50 border border-violet-200 rounded-lg px-2.5 py-1">👤 PIC: {room.brand_middleware_pic_name}</p>}
          {room.brand_middleware && !room.brand_middleware_pic_name && <p className="mt-1 text-[11px] text-gray-400 italic">PIC belum di-set admin</p>}
        </div>
      </div>

      {/* Layout Signage — only if Signage selected */}
      {room.kebutuhan.includes('Signage') && (
        <div className="mb-4 pt-2 border-t border-gray-100">
          <Chips label="Layout Signage" opts={['Single Zone','Multi Zone','Full Screen','Custom Layout']} value={room.layout_signage} field="layout_signage" />
          <Chips label="Jaringan CMS" opts={['Cloud','Onpremise','USB']} value={room.jaringan_cms} field="jaringan_cms" />
          <div className="grid grid-cols-2 gap-3 mt-1">
            <div><label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Jumlah Input</label><input value={room.jumlah_input} onChange={e => onUpdate({jumlah_input:e.target.value})} placeholder="e.g. 4" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-teal-400"/></div>
            <div><label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Jumlah Output</label><input value={room.jumlah_output} onChange={e => onUpdate({jumlah_output:e.target.value})} placeholder="e.g. 2" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-teal-400"/></div>
          </div>
        </div>
      )}

      {/* Source */}
      <div className="mb-4 pt-2 border-t border-gray-100">
        <Chips label="Source" opts={['PC / Mini PC','Laptop','URL Dashboard','NVR CCTV','Media Player','IPTV','Set Top Box']} value={room.source} field="source" />
        <div className="flex gap-3 mb-3">
          {room.source.includes('Laptop') && <div className="flex-1"><label className="block text-[10px] font-bold text-amber-600 uppercase tracking-widest mb-1">Qty Laptop</label><input type="number" min="1" value={room.source_laptop_qty} onChange={e=>onUpdate({source_laptop_qty:e.target.value})} placeholder="1" className="w-full border border-amber-200 rounded-lg px-3 py-2 text-sm bg-amber-50 outline-none focus:border-amber-400"/></div>}
          {room.source.includes('PC / Mini PC') && <div className="flex-1"><label className="block text-[10px] font-bold text-blue-600 uppercase tracking-widest mb-1">Qty PC</label><input type="number" min="1" value={room.source_pc_qty} onChange={e=>onUpdate({source_pc_qty:e.target.value})} placeholder="1" className="w-full border border-blue-200 rounded-lg px-3 py-2 text-sm bg-blue-50 outline-none focus:border-blue-400"/></div>}
        </div>
        <input value={room.source_other} onChange={e=>onUpdate({source_other:e.target.value})} placeholder="Other source..." className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-teal-400"/>
      </div>

      {/* Camera */}
      <div className="pt-2 border-t border-gray-100">
        <YN label="Camera Conference" field="camera_conference" value={room.camera_conference}/>
        {room.camera_conference==='Yes' && <div className="ml-4 mb-4 space-y-3 border-l-2 border-teal-200 pl-4">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Jumlah Camera</label>
            <input value={room.camera_jumlah} onChange={e=>onUpdate({camera_jumlah:e.target.value})} placeholder="e.g. 2 unit" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-teal-400"/>
          </div>
          <Chips label="Tipe Tracking" opts={['Auto Tracking','Manual PTZ','Fixed']} value={room.camera_tracking} field="camera_tracking"/>
        </div>}
      </div>

      {/* Audio */}
      <div className="pt-2 border-t border-gray-100">
        <YN label="Audio System" field="audio_system" value={room.audio_system}/>
        {room.audio_system==='Yes' && <div className="ml-4 mb-4 space-y-3 border-l-2 border-teal-200 pl-4">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Mixer / DSP</label>
            <input value={room.audio_mixer} onChange={e=>onUpdate({audio_mixer:e.target.value})} placeholder="e.g. Yamaha QL1, QSC, etc." className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-teal-400"/>
          </div>
          <Chips label="Audio Detail" opts={['Speaker Ceiling','Speaker Line Array','Subwoofer','Microphone','Amplifier']} value={room.audio_detail} field="audio_detail"/>
        </div>}
      </div>

      {/* Wallplate + Tabletop — 2 col */}
      <div className="pt-2 border-t border-gray-100 grid grid-cols-2 gap-3">
        <div>
          <YN label="Wallplate Input" field="wallplate_input" value={room.wallplate_input}/>
          {room.wallplate_input==='Yes' && <div className="ml-4 border-l-2 border-teal-200 pl-4 mb-4">
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Jumlah Wallplate</label>
            <input value={room.wallplate_jumlah} onChange={e=>onUpdate({wallplate_jumlah:e.target.value})} placeholder="e.g. 3 unit" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-teal-400"/>
          </div>}
        </div>
        <div>
          <YN label="Tabletop Input" field="tabletop_input" value={room.tabletop_input}/>
          {room.tabletop_input==='Yes' && <div className="ml-4 border-l-2 border-teal-200 pl-4 mb-4">
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Jumlah Tabletop</label>
            <input value={room.tabletop_jumlah} onChange={e=>onUpdate({tabletop_jumlah:e.target.value})} placeholder="e.g. 2 unit" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-teal-400"/>
          </div>}
        </div>
      </div>

      {/* Wireless */}
      <div className="pt-2 border-t border-gray-100">
        <YN label="Wireless Presentation" field="wireless_presentation" value={room.wireless_presentation}/>
        {room.wireless_presentation==='Yes' && <div className="ml-4 mb-4 space-y-3 border-l-2 border-teal-200 pl-4">
          <Chips label="Wireless Mode" opts={['Aplikasi','AirPlay','Miracast','Chromecast','BYOM']} value={room.wireless_mode} field="wireless_mode"/>
          <YN label="Dongle" field="wireless_dongle" value={room.wireless_dongle}/>
        </div>}
      </div>

      {/* Controller */}
      <div className="pt-2 border-t border-gray-100">
        <YN label="Controller / Automation" field="controller_automation" value={room.controller_automation}/>
        {room.controller_automation==='Yes' && <div className="ml-4 mb-4 border-l-2 border-teal-200 pl-4">
          <Chips label="Controller Type" opts={['Cue','Wyrestorm','Extron','Custom']} value={room.controller_type} field="controller_type"/>
        </div>}
      </div>

      {/* Ukuran, Suggest, Keterangan */}
      <div className="pt-2 border-t border-gray-100 space-y-3 mb-4">
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Ukuran Ruangan (P×L×T)</label>
          <input value={room.ukuran_ruangan} onChange={e=>onUpdate({ukuran_ruangan:e.target.value})} placeholder="e.g. 8m×6m×3m" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-teal-400"/>
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Suggest Tampilan (W×H)</label>
          <input value={room.suggest_tampilan} onChange={e=>onUpdate({suggest_tampilan:e.target.value})} placeholder="e.g. 1920×1080 atau 4K" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-teal-400"/>
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Keterangan Lain</label>
          <textarea value={room.keterangan_lain} onChange={e=>onUpdate({keterangan_lain:e.target.value})} rows={2} placeholder="Info tambahan..." className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-teal-400 resize-none"/>
        </div>
      </div>

      {/* Foto + BOQ — 2 col, same layout as Ruangan 1 */}
      {isGuest && (
        <div className="pt-2 border-t border-gray-100 grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Foto Survey */}
          <div>
            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">📸 Foto Survey Ruangan Ini</label>
            <input ref={fileRef} type="file" accept="image/*" multiple className="hidden"
              id={`room-photo-${room.id}`}
              onChange={e => { const files = Array.from(e.target.files||[]); if(files.length) onAddPhotos(files); e.target.value=''; }}/>
            {previews.length === 0 ? (
              <label htmlFor={`room-photo-${room.id}`} className="w-full border-2 border-dashed border-gray-300 rounded-xl py-4 flex flex-col items-center justify-center text-gray-400 hover:border-teal-400 hover:text-teal-500 transition-all cursor-pointer">
                <span className="text-2xl mb-1">📷</span>
                <span className="text-xs font-medium">Klik upload foto</span>
                <span className="text-[11px] opacity-70">Max 10 foto</span>
              </label>
            ) : (
              <div>
                <div className="grid grid-cols-4 gap-1.5 mb-2">
                  {previews.map((src, i) => (
                    <div key={i} className="relative group rounded-lg overflow-hidden aspect-square border border-gray-200">
                      <img src={src} alt="" className="w-full h-full object-cover"/>
                      <button type="button" onClick={() => onRemovePhoto(i)} className="absolute top-0.5 right-0.5 bg-red-500 text-white w-4 h-4 rounded-full text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">✕</button>
                    </div>
                  ))}
                  {photos.length < 10 && (
                    <label htmlFor={`room-photo-${room.id}`} className="aspect-square border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center text-gray-400 hover:border-teal-400 cursor-pointer"><span className="text-xl">+</span></label>
                  )}
                </div>
                <p className="text-[11px] text-gray-400">{photos.length}/10 foto</p>
              </div>
            )}
          </div>
          {/* BOQ Excel */}
          <div>
            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">📊 BOQ Excel Ruangan Ini</label>
            <input ref={boqRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f && onSetBoq) onSetBoq(f); e.target.value=''; }} />
            {!boqFile ? (
              <button type="button" onClick={() => boqRef.current?.click()}
                className="w-full border-2 border-dashed border-emerald-300 rounded-xl py-4 flex flex-col items-center justify-center text-emerald-500 hover:border-emerald-500 hover:bg-emerald-50 transition-all cursor-pointer">
                <span className="text-2xl mb-1">📊</span>
                <span className="text-xs font-medium">Klik upload BOQ</span>
                <span className="text-[11px] opacity-70">.xlsx / .xls / .csv</span>
              </button>
            ) : (
              <div>
                <div className="border-2 border-emerald-300 bg-emerald-50 rounded-xl p-3 flex items-center gap-3">
                  <span className="text-xl">📊</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-emerald-800 truncate">{boqFile.name}</p>
                    <p className="text-[11px] text-emerald-600">{(boqFile.size/1024).toFixed(1)} KB</p>
                  </div>
                  <button type="button" onClick={() => onSetBoq && onSetBoq(null)} className="text-red-400 hover:text-red-600 font-bold text-sm">✕</button>
                </div>
                <button type="button" onClick={() => boqRef.current?.click()}
                  className="mt-1.5 w-full text-xs text-emerald-600 hover:text-emerald-800 font-bold py-1 transition-all">🔄 Ganti File</button>
              </div>
            )}
          </div>
        </div>
      )}
      {/* Foto only (no BOQ) for team users */}
      {!isGuest && (
        <div className="pt-2 border-t border-gray-100">
          <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">📸 Foto Survey Ruangan Ini</label>
          <input ref={fileRef} type="file" accept="image/*" multiple className="hidden"
            id={`room-photo-ng-${room.id}`}
            onChange={e => { const files = Array.from(e.target.files||[]); if(files.length) onAddPhotos(files); e.target.value=''; }}/>
          {previews.length === 0 ? (
            <label htmlFor={`room-photo-ng-${room.id}`} className="w-full border-2 border-dashed border-gray-300 rounded-xl py-4 flex flex-col items-center justify-center text-gray-400 hover:border-teal-400 hover:text-teal-500 transition-all cursor-pointer">
              <span className="text-2xl mb-1">📷</span><span className="text-xs font-medium">Klik upload foto</span>
              <span className="text-[11px] opacity-70">Max 10 foto</span>
            </label>
          ) : (
            <div>
              <div className="grid grid-cols-4 gap-1.5 mb-2">
                {previews.map((src, i) => (
                  <div key={i} className="relative group rounded-lg overflow-hidden aspect-square border border-gray-200">
                    <img src={src} alt="" className="w-full h-full object-cover"/>
                    <button type="button" onClick={() => onRemovePhoto(i)} className="absolute top-0.5 right-0.5 bg-red-500 text-white w-4 h-4 rounded-full text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">✕</button>
                  </div>
                ))}
                {photos.length < 10 && (
                  <label htmlFor={`room-photo-ng-${room.id}`} className="aspect-square border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center text-gray-400 hover:border-teal-400 cursor-pointer"><span className="text-xl">+</span></label>
                )}
              </div>
              <p className="text-[11px] text-gray-400">{photos.length}/10 foto</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── NewFormModal ─────────────────────────────────────────────────────────────

export type InitialFormType = {
  project_name: string; room_name: string; project_location: string; sales_name: string; sales_division: string;
  kebutuhan: string[]; kebutuhan_other: string;
  solution_product: string[]; solution_other: string;
  layout_signage: string[]; jaringan_cms: string[];
  jumlah_input: string; jumlah_output: string;
  source: string[]; source_other: string;
  camera_conference: string; camera_jumlah: string; camera_tracking: string[];
  audio_system: string; audio_mixer: string; audio_detail: string[];
  wallplate_input: string; wallplate_jumlah: string;
  tabletop_input: string; tabletop_jumlah: string;
  wireless_presentation: string; wireless_mode: string[]; wireless_dongle: string;
  controller_automation: string; controller_type: string[];
  ukuran_ruangan: string; suggest_tampilan: string; keterangan_lain: string;
  brand_display: string; brand_display_pic_id: string; brand_display_pic_name: string;
  brand_middleware: string; brand_middleware_pic_id: string; brand_middleware_pic_name: string;
  source_laptop_qty: string; source_pc_qty: string;
};

export interface NewFormModalProps {
  currentUser: User;
  form: InitialFormType;
  setForm: React.Dispatch<React.SetStateAction<InitialFormType>>;
  initialForm: InitialFormType;
  dueDateForm: string;
  setDueDateForm: React.Dispatch<React.SetStateAction<string>>;
  surveyPhotos: File[];
  setSurveyPhotos: React.Dispatch<React.SetStateAction<File[]>>;
  surveyPhotosPreviews: string[];
  setSurveyPhotosPreviews: React.Dispatch<React.SetStateAction<string[]>>;
  boqFormFile: File | null;
  setBoqFormFile: React.Dispatch<React.SetStateAction<File | null>>;
  submitting: boolean;
  onClose: () => void;
  onSubmit: () => void;
  salesGuestUsers: {id:string;full_name:string;username:string;sales_division?:string;is_internal_sales?:boolean}[];
  isInternalSalesGuest?: boolean; // creator = Sales Internal (guest) → tampilkan field SBU
  rooms: RoomDetail[];
  setRooms: React.Dispatch<React.SetStateAction<RoomDetail[]>>;
  brandPicMappings: BrandPicMapping[];
  roomPhotoMap: Record<string, File[]>;
  setRoomPhotoMap: React.Dispatch<React.SetStateAction<Record<string, File[]>>>;
  boqRoomMap: Record<string, File | null>;
  setBoqRoomMap: React.Dispatch<React.SetStateAction<Record<string, File | null>>>;
}

export function NewFormModal({
  currentUser, form, setForm, initialForm, dueDateForm, setDueDateForm,
  surveyPhotos, setSurveyPhotos, surveyPhotosPreviews, setSurveyPhotosPreviews,
  boqFormFile, setBoqFormFile,
  submitting, onClose, onSubmit,
  salesGuestUsers, isInternalSalesGuest = false, rooms, setRooms, brandPicMappings, roomPhotoMap, setRoomPhotoMap,
  boqRoomMap, setBoqRoomMap,
}: NewFormModalProps) {
  const surveyPhotoRef = useRef<HTMLInputElement>(null);
  const boqFormRef = useRef<HTMLInputElement>(null);
  const boqRoom1Ref = useRef<HTMLInputElement>(null);

  const toggleArr = (arr: string[], val: string): string[] =>
    arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val];

  // Active room tab index for navigation (0 = Ruangan 1 / main form)
  const [activeRoomIdx, setActiveRoomIdx] = useState(0);
  const totalRooms = 1 + rooms.length; // main room + extra rooms
  const goLeft = () => setActiveRoomIdx(i => Math.max(0, i - 1));
  const goRight = () => setActiveRoomIdx(i => Math.min(totalRooms - 1, i + 1));
  const addAndGoToRoom = () => {
    setRooms(p => [...p, emptyRoom()]);
    setActiveRoomIdx(1 + rooms.length); // go to new room
  };

  const CheckGroup = ({ label, options, value, onChange }: { label: string; options: string[]; value: string[]; onChange: (v: string[]) => void }) => (
    <div className="mb-4">
      <label className="block text-xs font-bold text-gray-600 tracking-widest uppercase mb-2">{label}</label>
      <div className="flex flex-wrap gap-2">
        {options.map(opt => {
          const checked = value.includes(opt);
          return (
            <button key={opt} type="button" onClick={() => onChange(toggleArr(value, opt))}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 text-sm font-medium transition-all ${checked ? 'border-teal-500 bg-teal-50 text-teal-700 shadow-md' : 'border-gray-300 bg-white text-gray-600 hover:border-teal-300 hover:bg-teal-50/50'}`}>
              <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${checked ? 'border-teal-500 bg-teal-500' : 'border-gray-400'}`}>
                {checked && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
              </div>
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );

  const RadioGroup = ({ label, options, value, onChange }: { label: string; options: string[]; value: string; onChange: (v: string) => void }) => (
    <div className="mb-4">
      <label className="block text-xs font-bold text-gray-600 tracking-widest uppercase mb-2">{label}</label>
      <div className="flex flex-wrap gap-2">
        {options.map(opt => (
          <button key={opt} type="button" onClick={() => onChange(opt)}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 text-sm font-medium transition-all ${value === opt ? 'border-teal-500 bg-teal-50 text-teal-700 shadow-md' : 'border-gray-300 bg-white text-gray-600 hover:border-teal-300'}`}>
            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${value === opt ? 'border-teal-500' : 'border-gray-400'}`}>
              {value === opt && <div className="w-2 h-2 rounded-full bg-teal-500" />}
            </div>
            {opt}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9998] p-4">
      <div className="bg-white/90 rounded-3xl shadow-2xl w-full max-w-5xl max-h-[94vh] flex flex-col border-2 border-teal-500 animate-scale-in overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-teal-600 to-teal-800 px-6 py-4 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">📋 Form Equipment Request — IVP</h2>
            <p className="text-teal-100 text-xs mt-0.5">Requester: <span className="font-bold">{currentUser.full_name}</span></p>
          </div>
          <button onClick={onClose} className="bg-white/20 hover:bg-white/30 text-white w-9 h-9 rounded-xl flex items-center justify-center font-bold transition-all text-lg">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-gray-50">

          {/* ── Project Info ── */}
          <div className="bg-white/95 rounded-2xl p-5 border-2 border-gray-200 shadow-sm">
            <h3 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
              <span className="w-7 h-7 bg-teal-600 text-white rounded-lg flex items-center justify-center text-xs shadow">📁</span>
              Informasi Project
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Nama Project *</label>
                <input value={form.project_name} onChange={e => setForm(prev => ({ ...prev, project_name: e.target.value }))}
                  placeholder="Contoh: Meeting Room Lantai 5 - PT ABC"
                  className="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 focus:border-teal-500 focus:ring-2 focus:ring-teal-100 transition-all text-sm font-medium bg-white outline-none" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Lokasi Project *</label>
                <textarea value={form.project_location} onChange={e => setForm(prev => ({ ...prev, project_location: e.target.value }))}
                  placeholder="Contoh: Gedung Wisma 46 Lt.12, Jl. MH Thamrin No.1, Jakarta Pusat"
                  rows={3} className="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 focus:border-teal-500 focus:ring-2 focus:ring-teal-100 transition-all text-sm font-medium bg-white outline-none resize-none" />
              </div>
              {['admin','superadmin','team_pts','team'].includes((currentUser?.role || '').toLowerCase().trim()) && (
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Sales / Account</label>
                  <SalesPicker
                    value={form.sales_name}
                    users={salesGuestUsers}
                    onChange={(name, div) => setForm(prev => ({ ...prev, sales_name: name, sales_division: div }))}
                    triggerClassName="border-2 border-gray-200 rounded-xl px-3 py-2.5 bg-white cursor-pointer hover:border-teal-400 transition-all"
                  />
                </div>
              )}
              {/* SBU — Sales Internal buat request ATAS NAMA Sales External tertentu.
                 Opsional; kalau kosong, request atas nama Sales Internal sendiri. */}
              {isInternalSalesGuest && (
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">
                    SBU <span className="normal-case text-gray-400 font-medium tracking-normal">(opsional — atas nama Sales External)</span>
                  </label>
                  <SalesPicker
                    value={form.sales_name}
                    users={salesGuestUsers.filter(u => !u.is_internal_sales && u.id !== currentUser.id)}
                    onChange={(name, div) => setForm(prev => ({ ...prev, sales_name: name, sales_division: div }))}
                    placeholder="— Pilih Sales External (opsional) —"
                    triggerClassName="border-2 border-gray-200 rounded-xl px-3 py-2.5 bg-white cursor-pointer hover:border-teal-400 transition-all"
                  />
                  {form.sales_name && (
                    <p className="text-[11px] text-teal-600 mt-1">Request diatasnamakan <strong>{form.sales_name}</strong>{form.sales_division ? ` · ${form.sales_division}` : ''}.</p>
                  )}
                </div>
              )}
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Target Selesai *</label>
                <input type="date" value={dueDateForm} onChange={e => setDueDateForm(e.target.value)} required
                  className="w-full border-2 border-gray-200 rounded-xl px-3 py-2.5 focus:border-teal-500 focus:ring-2 focus:ring-teal-100 transition-all text-sm font-medium bg-white outline-none" />
              </div>

            </div>
          </div>

          {/* ── Room Tab Navigator ── */}
          <div className="bg-white/95 rounded-2xl border-2 border-teal-200 shadow-sm overflow-hidden">
            {/* Tab bar */}
            <div className="flex items-center bg-teal-50 border-b border-teal-200 px-2 py-1.5 gap-1 overflow-x-auto">
              <button type="button" onClick={goLeft} disabled={activeRoomIdx === 0}
                className="p-1.5 rounded-lg text-teal-600 hover:bg-teal-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all flex-shrink-0">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7"/></svg>
              </button>
              {Array.from({length: totalRooms}).map((_, i) => {
                const label = i === 0 ? (form.room_name.trim() || 'Ruangan 1') : (rooms[i-1]?.room_name?.trim() || `Ruangan ${i+1}`);
                const isActive = activeRoomIdx === i;
                return (
                  <button key={i} type="button" onClick={() => setActiveRoomIdx(i)}
                    className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${isActive ? 'bg-teal-600 text-white shadow' : 'text-teal-700 hover:bg-teal-100'}`}>
                    {label}
                  </button>
                );
              })}
              <button type="button" onClick={goRight} disabled={activeRoomIdx === totalRooms - 1}
                className="p-1.5 rounded-lg text-teal-600 hover:bg-teal-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all flex-shrink-0">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7"/></svg>
              </button>
              <button type="button" onClick={addAndGoToRoom}
                className="flex-shrink-0 px-3 py-1.5 rounded-xl bg-teal-500 text-white text-xs font-bold hover:bg-teal-600 transition-all whitespace-nowrap ml-1">
                + Ruangan Lain
              </button>
              <div className="flex-1"/>
              <span className="text-[10px] text-teal-600 font-bold mr-1">{activeRoomIdx+1}/{totalRooms}</span>
              {activeRoomIdx > 0 && (
                <button type="button" onClick={() => { setRooms(p => p.filter((_,i)=>i!==activeRoomIdx-1)); setActiveRoomIdx(a=>Math.max(0,a-1)); }}
                  className="flex-shrink-0 p-1.5 rounded-lg bg-red-50 text-red-400 hover:bg-red-100 hover:text-red-600 transition-all">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
              )}
            </div>

            {/* Content — 2 columns */}
            <div className="p-5">
              {activeRoomIdx === 0 ? (
                /* ── Ruangan 1 (main form) — same style as RoomSection ── */
                <>
                {/* Nama Ruangan 1 */}
                <div className="flex items-center gap-2 mb-4 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl">
                  <span className="text-xs font-black text-teal-700 flex-shrink-0">Ruangan 1</span>
                  <input value={form.room_name} onChange={e => setForm(prev => ({ ...prev, room_name: e.target.value }))}
                    placeholder="Nama ruangan / area..."
                    className="flex-1 border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm font-medium bg-white outline-none focus:border-teal-400" />
                </div>

                {/* Kebutuhan */}
                <div className="mb-4">
                  <label className="block text-xs font-bold text-gray-600 tracking-widest uppercase mb-2">Kebutuhan *</label>
                  <div className="flex flex-wrap gap-2">
                    {['Signage','Immersive','Meeting Room','Mapping','Command Center','Hybrid Classroom'].map(opt => {
                      const active = form.kebutuhan[0] === opt;
                      return <button key={opt} type="button" onClick={() => setForm(prev => ({ ...prev, kebutuhan: active ? [] : [opt] }))}
                        className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 text-sm font-medium transition-all ${active ? 'border-teal-500 bg-teal-50 text-teal-700 shadow-md' : 'border-gray-300 bg-white text-gray-600 hover:border-teal-300 hover:bg-teal-50/50'}`}>
                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${active ? 'border-teal-500' : 'border-gray-400'}`}>{active && <div className="w-2 h-2 rounded-full bg-teal-500" />}</div>
                        {opt}
                      </button>;
                    })}
                  </div>
                </div>
                <div className="mb-4">
                  <input value={form.kebutuhan_other} onChange={e => setForm(prev => ({ ...prev, kebutuhan_other: e.target.value }))}
                    placeholder="Other kebutuhan..." className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-teal-400 bg-white outline-none" />
                </div>

                {/* Solution Product */}
                <div className="mb-4">
                  <label className="block text-xs font-bold text-gray-600 tracking-widest uppercase mb-2">Solution Product *</label>
                  <div className="flex flex-wrap gap-2">
                    {['Videowall','Signage Display','Videotron','Projector','Kiosk','IFP'].map(opt => {
                      const active = form.solution_product.includes(opt);
                      return <button key={opt} type="button" onClick={() => setForm(prev => ({ ...prev, solution_product: active ? prev.solution_product.filter(x=>x!==opt) : [...prev.solution_product,opt] }))}
                        className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 text-sm font-medium transition-all ${active ? 'border-teal-500 bg-teal-50 text-teal-700 shadow-md' : 'border-gray-300 bg-white text-gray-600 hover:border-teal-300 hover:bg-teal-50/50'}`}>
                        <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${active ? 'border-teal-500 bg-teal-500' : 'border-gray-400'}`}>{active && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}</div>
                        {opt}
                      </button>;
                    })}
                  </div>
                </div>
                <div className="mb-4">
                  <input value={form.solution_other} onChange={e => setForm(prev => ({ ...prev, solution_other: e.target.value }))}
                    placeholder="Other solution..." className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-teal-400 bg-white outline-none" />
                </div>

                {/* Brand Display & Middleware */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4 pt-2 border-t border-gray-100">
                  <div>
                    <label className="block text-[10px] font-bold text-amber-600 uppercase tracking-widest mb-1.5">🖥️ Brand Display <span className="text-gray-400 font-normal">(opsional)</span></label>
                    <select value={form.brand_display||''} onChange={e => {
                      const brand = e.target.value;
                      const pic = brandPicMappings.find(m => m.brand_type==='display' && m.brand_name===brand);
                      setForm(prev => ({...prev, brand_display:brand, brand_display_pic_id:pic?.pic_user_id||'', brand_display_pic_name:pic?.pic_user_name||''}));
                    }} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-amber-400 appearance-none">
                      <option value="">— Pilih Brand Display —</option>
                      {DISPLAY_BRANDS.map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                    {form.brand_display && form.brand_display_pic_name && <p className="mt-1 text-[11px] text-amber-700 font-semibold bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1">👤 PIC: {form.brand_display_pic_name}</p>}
                    {form.brand_display && !form.brand_display_pic_name && <p className="mt-1 text-[11px] text-gray-400 italic">PIC belum di-set admin</p>}
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-violet-600 uppercase tracking-widest mb-1.5">🔌 Brand Middleware <span className="text-gray-400 font-normal">(opsional)</span></label>
                    <select value={form.brand_middleware||''} onChange={e => {
                      const brand = e.target.value;
                      const pic = brandPicMappings.find(m => m.brand_type==='middleware' && m.brand_name===brand);
                      setForm(prev => ({...prev, brand_middleware:brand, brand_middleware_pic_id:pic?.pic_user_id||'', brand_middleware_pic_name:pic?.pic_user_name||''}));
                    }} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-violet-400 appearance-none">
                      <option value="">— Pilih Brand Middleware —</option>
                      {MIDDLEWARE_BRANDS.map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                    {form.brand_middleware && form.brand_middleware_pic_name && <p className="mt-1 text-[11px] text-violet-700 font-semibold bg-violet-50 border border-violet-200 rounded-lg px-2.5 py-1">👤 PIC: {form.brand_middleware_pic_name}</p>}
                    {form.brand_middleware && !form.brand_middleware_pic_name && <p className="mt-1 text-[11px] text-gray-400 italic">PIC belum di-set admin</p>}
                  </div>
                </div>

                {/* Layout Signage — only if Signage */}
                {form.kebutuhan.includes('Signage') && (
                  <div className="mb-4 pt-2 border-t border-gray-100">
                    <div className="mb-4">
                      <label className="block text-xs font-bold text-gray-600 tracking-widest uppercase mb-2">Layout Signage</label>
                      <div className="flex flex-wrap gap-2">
                        {['Single Zone','Multi Zone','Full Screen','Custom Layout'].map(opt => {
                          const active = form.layout_signage[0] === opt;
                          return <button key={opt} type="button" onClick={() => setForm(prev => ({ ...prev, layout_signage: active ? [] : [opt] }))}
                            className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 text-sm font-medium transition-all ${active ? 'border-teal-500 bg-teal-50 text-teal-700 shadow-md' : 'border-gray-300 bg-white text-gray-600 hover:border-teal-300'}`}>
                            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${active ? 'border-teal-500' : 'border-gray-400'}`}>{active && <div className="w-2 h-2 rounded-full bg-teal-500" />}</div>
                            {opt}
                          </button>;
                        })}
                      </div>
                    </div>
                    <div className="mb-4">
                      <label className="block text-xs font-bold text-gray-600 tracking-widest uppercase mb-2">Jaringan / CMS</label>
                      <div className="flex flex-wrap gap-2">
                        {['Cloud','Onpremise','USB'].map(opt => {
                          const active = form.jaringan_cms.includes(opt);
                          return <button key={opt} type="button" onClick={() => setForm(prev => ({ ...prev, jaringan_cms: active ? prev.jaringan_cms.filter(x=>x!==opt) : [...prev.jaringan_cms,opt] }))}
                            className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 text-sm font-medium transition-all ${active ? 'border-teal-500 bg-teal-50 text-teal-700 shadow-md' : 'border-gray-300 bg-white text-gray-600 hover:border-teal-300 hover:bg-teal-50/50'}`}>
                            <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${active ? 'border-teal-500 bg-teal-500' : 'border-gray-400'}`}>{active && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}</div>
                            {opt}
                          </button>;
                        })}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div><label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Jumlah Input</label><input value={form.jumlah_input} onChange={e => setForm(prev => ({...prev, jumlah_input: e.target.value}))} placeholder="e.g. 4" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-teal-400"/></div>
                      <div><label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Jumlah Output</label><input value={form.jumlah_output} onChange={e => setForm(prev => ({...prev, jumlah_output: e.target.value}))} placeholder="e.g. 2" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-teal-400"/></div>
                    </div>
                  </div>
                )}

                {/* Source */}
                <div className="mb-4 pt-2 border-t border-gray-100">
                  <div className="mb-4">
                    <label className="block text-xs font-bold text-gray-600 tracking-widest uppercase mb-2">Source</label>
                    <div className="flex flex-wrap gap-2">
                      {['PC / Mini PC','Laptop','URL Dashboard','NVR CCTV','Media Player','IPTV','Set Top Box'].map(opt => {
                        const active = form.source.includes(opt);
                        return <button key={opt} type="button" onClick={() => setForm(prev => ({ ...prev, source: active ? prev.source.filter(x=>x!==opt) : [...prev.source,opt] }))}
                          className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 text-sm font-medium transition-all ${active ? 'border-teal-500 bg-teal-50 text-teal-700 shadow-md' : 'border-gray-300 bg-white text-gray-600 hover:border-teal-300 hover:bg-teal-50/50'}`}>
                          <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${active ? 'border-teal-500 bg-teal-500' : 'border-gray-400'}`}>{active && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}</div>
                          {opt}
                        </button>;
                      })}
                    </div>
                  </div>
                  <div className="flex gap-3 mb-3">
                    {form.source.includes('Laptop') && <div className="flex-1"><label className="block text-[10px] font-bold text-amber-600 uppercase tracking-widest mb-1">Qty Laptop</label><input type="number" min="1" value={(form as any).source_laptop_qty||''} onChange={e=>setForm(prev=>({...prev, source_laptop_qty:e.target.value} as any))} placeholder="1" className="w-full border border-amber-200 rounded-lg px-3 py-2 text-sm bg-amber-50 outline-none focus:border-amber-400"/></div>}
                    {form.source.includes('PC / Mini PC') && <div className="flex-1"><label className="block text-[10px] font-bold text-blue-600 uppercase tracking-widest mb-1">Qty PC</label><input type="number" min="1" value={(form as any).source_pc_qty||''} onChange={e=>setForm(prev=>({...prev, source_pc_qty:e.target.value} as any))} placeholder="1" className="w-full border border-blue-200 rounded-lg px-3 py-2 text-sm bg-blue-50 outline-none focus:border-blue-400"/></div>}
                  </div>
                  <input value={form.source_other} onChange={e => setForm(prev => ({ ...prev, source_other: e.target.value }))}
                    placeholder="Other source..." className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-teal-400" />
                </div>

                {/* Camera */}
                <div className="mb-4 pt-2 border-t border-gray-100">
                  <div className="mb-4">
                    <label className="block text-xs font-bold text-gray-600 tracking-widest uppercase mb-2">Camera Conference</label>
                    <div className="flex flex-wrap gap-2">
                      {['Yes','No'].map(opt => <button key={opt} type="button" onClick={() => setForm(prev => ({ ...prev, camera_conference: opt }))}
                        className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 text-sm font-medium transition-all ${form.camera_conference === opt ? 'border-teal-500 bg-teal-50 text-teal-700 shadow-md' : 'border-gray-300 bg-white text-gray-600 hover:border-teal-300'}`}>
                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${form.camera_conference === opt ? 'border-teal-500' : 'border-gray-400'}`}>{form.camera_conference === opt && <div className="w-2 h-2 rounded-full bg-teal-500" />}</div>
                        {opt}
                      </button>)}
                    </div>
                  </div>
                  {form.camera_conference === 'Yes' && <div className="ml-4 mb-4 space-y-3 border-l-2 border-teal-200 pl-4">
                    <div><label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Jumlah Camera</label><input value={form.camera_jumlah} onChange={e => setForm(prev => ({ ...prev, camera_jumlah: e.target.value }))} placeholder="e.g. 2 unit" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-teal-400"/></div>
                    <div className="mb-4">
                      <label className="block text-xs font-bold text-gray-600 tracking-widest uppercase mb-2">Tipe Tracking</label>
                      <div className="flex flex-wrap gap-2">
                        {['Auto Tracking','Manual PTZ','Fixed'].map(opt => {
                          const active = form.camera_tracking.includes(opt);
                          return <button key={opt} type="button" onClick={() => setForm(prev => ({ ...prev, camera_tracking: active ? prev.camera_tracking.filter(x=>x!==opt) : [...prev.camera_tracking,opt] }))}
                            className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 text-sm font-medium transition-all ${active ? 'border-teal-500 bg-teal-50 text-teal-700 shadow-md' : 'border-gray-300 bg-white text-gray-600 hover:border-teal-300 hover:bg-teal-50/50'}`}>
                            <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${active ? 'border-teal-500 bg-teal-500' : 'border-gray-400'}`}>{active && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}</div>
                            {opt}
                          </button>;
                        })}
                      </div>
                    </div>
                  </div>}
                </div>

                {/* Audio */}
                <div className="mb-4 pt-2 border-t border-gray-100">
                  <div className="mb-4">
                    <label className="block text-xs font-bold text-gray-600 tracking-widest uppercase mb-2">Audio System</label>
                    <div className="flex flex-wrap gap-2">
                      {['Yes','No'].map(opt => <button key={opt} type="button" onClick={() => setForm(prev => ({ ...prev, audio_system: opt }))}
                        className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 text-sm font-medium transition-all ${form.audio_system === opt ? 'border-teal-500 bg-teal-50 text-teal-700 shadow-md' : 'border-gray-300 bg-white text-gray-600 hover:border-teal-300'}`}>
                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${form.audio_system === opt ? 'border-teal-500' : 'border-gray-400'}`}>{form.audio_system === opt && <div className="w-2 h-2 rounded-full bg-teal-500" />}</div>
                        {opt}
                      </button>)}
                    </div>
                  </div>
                  {form.audio_system === 'Yes' && <div className="ml-4 mb-4 space-y-3 border-l-2 border-teal-200 pl-4">
                    <div><label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Mixer / DSP</label><input value={form.audio_mixer} onChange={e => setForm(prev => ({ ...prev, audio_mixer: e.target.value }))} placeholder="e.g. Yamaha QL1, QSC, etc." className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-teal-400"/></div>
                    <div className="mb-4">
                      <label className="block text-xs font-bold text-gray-600 tracking-widest uppercase mb-2">Audio Detail</label>
                      <div className="flex flex-wrap gap-2">
                        {['Speaker Ceiling','Speaker Line Array','Subwoofer','Microphone','Amplifier'].map(opt => {
                          const active = form.audio_detail.includes(opt);
                          return <button key={opt} type="button" onClick={() => setForm(prev => ({ ...prev, audio_detail: active ? prev.audio_detail.filter(x=>x!==opt) : [...prev.audio_detail,opt] }))}
                            className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 text-sm font-medium transition-all ${active ? 'border-teal-500 bg-teal-50 text-teal-700 shadow-md' : 'border-gray-300 bg-white text-gray-600 hover:border-teal-300 hover:bg-teal-50/50'}`}>
                            <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${active ? 'border-teal-500 bg-teal-500' : 'border-gray-400'}`}>{active && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}</div>
                            {opt}
                          </button>;
                        })}
                      </div>
                    </div>
                  </div>}
                </div>

                {/* Wallplate + Tabletop — 2 col */}
                <div className="mb-4 pt-2 border-t border-gray-100 grid grid-cols-2 gap-3">
                  <div>
                    <div className="mb-4">
                      <label className="block text-xs font-bold text-gray-600 tracking-widest uppercase mb-2">Wallplate Input</label>
                      <div className="flex flex-wrap gap-2">
                        {['Yes','No'].map(opt => <button key={opt} type="button" onClick={() => setForm(prev => ({ ...prev, wallplate_input: opt }))}
                          className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 text-sm font-medium transition-all ${form.wallplate_input === opt ? 'border-teal-500 bg-teal-50 text-teal-700 shadow-md' : 'border-gray-300 bg-white text-gray-600 hover:border-teal-300'}`}>
                          <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${form.wallplate_input === opt ? 'border-teal-500' : 'border-gray-400'}`}>{form.wallplate_input === opt && <div className="w-2 h-2 rounded-full bg-teal-500" />}</div>
                          {opt}
                        </button>)}
                      </div>
                    </div>
                    {form.wallplate_input === 'Yes' && <div className="ml-4 border-l-2 border-teal-200 pl-4 mb-4"><label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Jumlah Wallplate</label><input value={form.wallplate_jumlah} onChange={e => setForm(prev => ({ ...prev, wallplate_jumlah: e.target.value }))} placeholder="e.g. 3 unit" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-teal-400"/></div>}
                  </div>
                  <div>
                    <div className="mb-4">
                      <label className="block text-xs font-bold text-gray-600 tracking-widest uppercase mb-2">Tabletop Input</label>
                      <div className="flex flex-wrap gap-2">
                        {['Yes','No'].map(opt => <button key={opt} type="button" onClick={() => setForm(prev => ({ ...prev, tabletop_input: opt }))}
                          className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 text-sm font-medium transition-all ${form.tabletop_input === opt ? 'border-teal-500 bg-teal-50 text-teal-700 shadow-md' : 'border-gray-300 bg-white text-gray-600 hover:border-teal-300'}`}>
                          <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${form.tabletop_input === opt ? 'border-teal-500' : 'border-gray-400'}`}>{form.tabletop_input === opt && <div className="w-2 h-2 rounded-full bg-teal-500" />}</div>
                          {opt}
                        </button>)}
                      </div>
                    </div>
                    {form.tabletop_input === 'Yes' && <div className="ml-4 border-l-2 border-teal-200 pl-4 mb-4"><label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Jumlah Tabletop</label><input value={form.tabletop_jumlah} onChange={e => setForm(prev => ({ ...prev, tabletop_jumlah: e.target.value }))} placeholder="e.g. 2 unit" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-teal-400"/></div>}
                  </div>
                </div>

                {/* Wireless */}
                <div className="mb-4 pt-2 border-t border-gray-100">
                  <div className="mb-4">
                    <label className="block text-xs font-bold text-gray-600 tracking-widest uppercase mb-2">Wireless Presentation</label>
                    <div className="flex flex-wrap gap-2">
                      {['Yes','No'].map(opt => <button key={opt} type="button" onClick={() => setForm(prev => ({ ...prev, wireless_presentation: opt }))}
                        className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 text-sm font-medium transition-all ${form.wireless_presentation === opt ? 'border-teal-500 bg-teal-50 text-teal-700 shadow-md' : 'border-gray-300 bg-white text-gray-600 hover:border-teal-300'}`}>
                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${form.wireless_presentation === opt ? 'border-teal-500' : 'border-gray-400'}`}>{form.wireless_presentation === opt && <div className="w-2 h-2 rounded-full bg-teal-500" />}</div>
                        {opt}
                      </button>)}
                    </div>
                  </div>
                  {form.wireless_presentation === 'Yes' && <div className="ml-4 mb-4 space-y-3 border-l-2 border-teal-200 pl-4">
                    <div className="mb-4">
                      <label className="block text-xs font-bold text-gray-600 tracking-widest uppercase mb-2">Wireless Mode</label>
                      <div className="flex flex-wrap gap-2">
                        {['Aplikasi','AirPlay','Miracast','Chromecast','BYOM'].map(opt => {
                          const active = form.wireless_mode.includes(opt);
                          return <button key={opt} type="button" onClick={() => setForm(prev => ({ ...prev, wireless_mode: active ? prev.wireless_mode.filter(x=>x!==opt) : [...prev.wireless_mode,opt] }))}
                            className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 text-sm font-medium transition-all ${active ? 'border-teal-500 bg-teal-50 text-teal-700 shadow-md' : 'border-gray-300 bg-white text-gray-600 hover:border-teal-300 hover:bg-teal-50/50'}`}>
                            <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${active ? 'border-teal-500 bg-teal-500' : 'border-gray-400'}`}>{active && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}</div>
                            {opt}
                          </button>;
                        })}
                      </div>
                    </div>
                    <div className="mb-4">
                      <label className="block text-xs font-bold text-gray-600 tracking-widest uppercase mb-2">Dongle</label>
                      <div className="flex flex-wrap gap-2">
                        {['Yes','No'].map(opt => <button key={opt} type="button" onClick={() => setForm(prev => ({ ...prev, wireless_dongle: opt }))}
                          className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 text-sm font-medium transition-all ${form.wireless_dongle === opt ? 'border-teal-500 bg-teal-50 text-teal-700 shadow-md' : 'border-gray-300 bg-white text-gray-600 hover:border-teal-300'}`}>
                          <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${form.wireless_dongle === opt ? 'border-teal-500' : 'border-gray-400'}`}>{form.wireless_dongle === opt && <div className="w-2 h-2 rounded-full bg-teal-500" />}</div>
                          {opt}
                        </button>)}
                      </div>
                    </div>
                  </div>}
                </div>

                {/* Controller */}
                <div className="mb-4 pt-2 border-t border-gray-100">
                  <div className="mb-4">
                    <label className="block text-xs font-bold text-gray-600 tracking-widest uppercase mb-2">Controller / Automation</label>
                    <div className="flex flex-wrap gap-2">
                      {['Yes','No'].map(opt => <button key={opt} type="button" onClick={() => setForm(prev => ({ ...prev, controller_automation: opt }))}
                        className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 text-sm font-medium transition-all ${form.controller_automation === opt ? 'border-teal-500 bg-teal-50 text-teal-700 shadow-md' : 'border-gray-300 bg-white text-gray-600 hover:border-teal-300'}`}>
                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${form.controller_automation === opt ? 'border-teal-500' : 'border-gray-400'}`}>{form.controller_automation === opt && <div className="w-2 h-2 rounded-full bg-teal-500" />}</div>
                        {opt}
                      </button>)}
                    </div>
                  </div>
                  {form.controller_automation === 'Yes' && <div className="ml-4 mb-4 border-l-2 border-teal-200 pl-4">
                    <div className="mb-4">
                      <label className="block text-xs font-bold text-gray-600 tracking-widest uppercase mb-2">Controller Type</label>
                      <div className="flex flex-wrap gap-2">
                        {['Cue','Wyrestorm','Extron','Custom'].map(opt => {
                          const active = form.controller_type.includes(opt);
                          return <button key={opt} type="button" onClick={() => setForm(prev => ({ ...prev, controller_type: active ? prev.controller_type.filter(x=>x!==opt) : [...prev.controller_type,opt] }))}
                            className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 text-sm font-medium transition-all ${active ? 'border-teal-500 bg-teal-50 text-teal-700 shadow-md' : 'border-gray-300 bg-white text-gray-600 hover:border-teal-300 hover:bg-teal-50/50'}`}>
                            <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${active ? 'border-teal-500 bg-teal-500' : 'border-gray-400'}`}>{active && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}</div>
                            {opt}
                          </button>;
                        })}
                      </div>
                    </div>
                  </div>}
                </div>

                {/* Ukuran, Suggest, Keterangan */}
                <div className="mb-4 pt-2 border-t border-gray-100 space-y-3">
                  <div><label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Ukuran Ruangan (P×L×T)</label><input value={form.ukuran_ruangan} onChange={e=>setForm(p=>({...p,ukuran_ruangan:e.target.value}))} placeholder="e.g. 8m×6m×3m" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-teal-400"/></div>
                  <div><label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Suggest Tampilan (W×H)</label><input value={form.suggest_tampilan} onChange={e=>setForm(p=>({...p,suggest_tampilan:e.target.value}))} placeholder="e.g. 1920×1080 atau 4K" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-teal-400"/></div>
                  <div><label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Keterangan Lain</label><textarea value={form.keterangan_lain} onChange={e=>setForm(p=>({...p,keterangan_lain:e.target.value}))} rows={2} placeholder="Info tambahan..." className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-teal-400 resize-none"/></div>
                </div>

                {/* Foto + BOQ — 2 col, only for non-team */}
                {!['admin','superadmin','team_pts','team'].includes((currentUser?.role || '').toLowerCase().trim()) && (
                  <div className="pt-2 border-t border-gray-100 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">📸 Foto Survey Ruangan Ini</label>
                      <input ref={surveyPhotoRef} type="file" accept="image/*" multiple className="hidden"
                        onChange={e => { const files = Array.from(e.target.files||[]); if(!files.length) return; const c=[...surveyPhotos,...files].slice(0,10); setSurveyPhotos(c); setSurveyPhotosPreviews(c.map(f=>URL.createObjectURL(f))); e.target.value=''; }} />
                      {surveyPhotosPreviews.length === 0 ? (
                        <label onClick={() => surveyPhotoRef.current?.click()} className="w-full border-2 border-dashed border-gray-300 rounded-xl py-4 flex flex-col items-center justify-center text-gray-400 hover:border-teal-400 hover:text-teal-500 transition-all cursor-pointer">
                          <span className="text-2xl mb-1">📷</span><span className="text-xs font-medium">Klik upload foto</span><span className="text-[11px] opacity-70">Max 10 foto</span>
                        </label>
                      ) : (
                        <div>
                          <div className="grid grid-cols-4 gap-1.5 mb-2">
                            {surveyPhotosPreviews.map((src,i) => (
                              <div key={i} className="relative group rounded-lg overflow-hidden aspect-square border border-gray-200">
                                <img src={src} alt="" className="w-full h-full object-cover"/>
                                <button type="button" onClick={() => { const n=surveyPhotos.filter((_,j)=>j!==i); setSurveyPhotos(n); setSurveyPhotosPreviews(n.map(f=>URL.createObjectURL(f))); }} className="absolute top-0.5 right-0.5 bg-red-500 text-white w-4 h-4 rounded-full text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">✕</button>
                              </div>
                            ))}
                            {surveyPhotos.length < 10 && <button type="button" onClick={() => surveyPhotoRef.current?.click()} className="aspect-square border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center text-gray-400 hover:border-teal-400 cursor-pointer"><span className="text-xl">+</span></button>}
                          </div>
                          <p className="text-[11px] text-gray-400">{surveyPhotos.length}/10 foto</p>
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">📊 BOQ Excel Ruangan Ini</label>
                      <input ref={boqRoom1Ref} type="file" accept=".xlsx,.xls,.csv" className="hidden"
                        onChange={e => { const f=e.target.files?.[0]; if(f) setBoqFormFile(f); e.target.value=''; }} />
                      {!boqFormFile ? (
                        <button type="button" onClick={() => boqRoom1Ref.current?.click()}
                          className="w-full border-2 border-dashed border-emerald-300 rounded-xl py-4 flex flex-col items-center justify-center text-emerald-500 hover:border-emerald-500 hover:bg-emerald-50 transition-all cursor-pointer">
                          <span className="text-2xl mb-1">📊</span><span className="text-xs font-medium">Klik upload BOQ</span><span className="text-[11px] opacity-70">.xlsx / .xls / .csv</span>
                        </button>
                      ) : (
                        <div>
                          <div className="border-2 border-emerald-300 bg-emerald-50 rounded-xl p-3 flex items-center gap-3">
                            <span className="text-xl">📊</span>
                            <div className="flex-1 min-w-0"><p className="text-xs font-bold text-emerald-800 truncate">{boqFormFile.name}</p><p className="text-[11px] text-emerald-600">{(boqFormFile.size/1024).toFixed(1)} KB</p></div>
                            <button type="button" onClick={() => setBoqFormFile(null)} className="text-red-400 hover:text-red-600 font-bold text-sm">✕</button>
                          </div>
                          <button type="button" onClick={() => boqRoom1Ref.current?.click()} className="mt-1.5 w-full text-xs text-emerald-600 hover:text-emerald-800 font-bold py-1 transition-all">🔄 Ganti File</button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                </>
              ) : (
                /* ── Extra Room (RoomSection component) ── */
                <RoomSection
                  room={rooms[activeRoomIdx - 1]}
                  rIdx={activeRoomIdx - 1}
                  onUpdate={patch => setRooms(p => p.map((r,i) => i === activeRoomIdx-1 ? {...r,...patch} : r))}
                  onRemove={() => { setRooms(p => p.filter((_,i) => i !== activeRoomIdx-1)); setActiveRoomIdx(a => Math.max(0,a-1)); }}
                  brandPicMappings={brandPicMappings}
                  photos={roomPhotoMap[rooms[activeRoomIdx-1]?.id] || []}
                  onAddPhotos={files => setRoomPhotoMap(p => ({ ...p, [rooms[activeRoomIdx-1].id]: [...(p[rooms[activeRoomIdx-1].id]||[]),...files].slice(0,10) }))}
                  onRemovePhoto={i => setRoomPhotoMap(p => { const arr=[...(p[rooms[activeRoomIdx-1].id]||[])]; arr.splice(i,1); return {...p,[rooms[activeRoomIdx-1].id]:arr}; })}
                  boqFile={boqRoomMap[rooms[activeRoomIdx-1]?.id] || null}
                  onSetBoq={file => setBoqRoomMap(p => ({ ...p, [rooms[activeRoomIdx-1].id]: file }))}
                  toggleArr={toggleArr}
                  isGuest={!['admin','superadmin','team_pts','team'].includes((currentUser?.role || '').toLowerCase().trim())}
                />
              )}
            </div>
          </div>


        </div>

        <div className="border-t-2 border-gray-200 p-4 flex gap-3 bg-white/90 flex-shrink-0">
          <button type="button" onClick={onClose}
            className="flex-1 border-2 border-gray-300 text-gray-700 py-3 rounded-xl font-bold hover:bg-gray-50 transition-all">
            Batal
          </button>
          <button type="button" onClick={onSubmit} disabled={submitting}
            className="flex-[2] bg-gradient-to-r from-teal-600 to-teal-800 hover:from-teal-700 hover:to-teal-900 text-white py-3 rounded-xl font-bold shadow-lg transition-all disabled:opacity-60 flex items-center justify-center gap-2">
            {submitting
              ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Mengirim...</>
              : <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>Submit Form</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── request design Project Module ──────────────────────────────────────────────
