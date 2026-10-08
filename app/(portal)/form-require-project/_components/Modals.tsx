'use client';
import { denganNilai, useDaftarPilihan } from '@/lib/daftar-pilihan';
import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import {
  User, ProjectRequest, RoomDetail, BrandPicMapping,
  ProjectMessage, ProjectAttachment,
  statusConfig, JABATAN_TIER, JABATAN_CC_RULES,
  fetchWACCTargets, sendWANotif, emptyRoom,
  getRoomAssignName, getRoomAssignUserId,
  SALES_DIVISIONS, PIE_COLORS,
} from './shared';
import { SalesPicker, ModalPortal, BatalButton, SubmitFormButton } from '@/components/shared';
import { isAssignablePTSTeam, bolehDitugaskanOleh, adalahAdminMurni } from '@/lib/teams';
import { tanpaIdentitas, cobaIdentitas } from '@/lib/identitas';
import { BRAND_OPTIONS } from '@/lib/brand-routing';
import { appLink } from '@/lib/app-url';
import { createNotification } from '@/lib/notifications';
import { Ikon, IkonTeks } from '@/components/shared/Ikon';
import { FormRuanganUtama } from './form-baru/FormRuanganUtama';
import { KolomInfoProyekBaru } from './form-baru/KolomInfoProyekBaru';

/**
 * AssignPTSModal - popup Approve & Assign dan Assign ke Tim untuk Request
 * Design Project.
 *
 * Tampilan dan model isian assign-nya sengaja MENGIKUTI Ticketing dan Request
 * Schedule, bukan punya gaya sendiri. Tiga hal yang disamakan:
 *
 *   1. Warna menandai TAHAP, bukan halaman. Hijau untuk approve, kuning untuk
 *      assign oleh Supervisor - persis seperti kedua platform lain.
 *   2. Pemilihan orang memakai <select> dengan optgroup, bukan daftar kartu
 *      avatar. Kartu avatar terlihat lebih ramai tapi memaksa admin menggulir
 *      untuk menemukan satu nama, dan tidak bisa diketik.
 *   3. Route ke Supervisor tampil sebagai kartu rekomendasi di dalam popup yang
 *      sama, bukan tab yang menyembunyikan salah satu pilihan.
 *
 * Yang juga ikut: opsi "Saya kerjakan sendiri". Tanpa itu, Supervisor yang
 * timnya penuh tidak punya jalan menyelesaikan sendiri di halaman ini,
 * sementara di dua platform lain ia punya.
 */
export function AssignPTSModal({
  req, onClose, onAssigned, currentUser, allowSupervisorRoute = false, roomIdx = 0,
}: {
  req: ProjectRequest; onClose: () => void; onAssigned: () => void; currentUser: User;
  // true = dibuka oleh Admin/Manager saat approve  boleh pilih "Route ke Supervisor".
  // false = dibuka oleh Supervisor utk assign final ke Tim PTS (tanpa opsi route).
  allowSupervisorRoute?: boolean;
  // 0 = ruangan pertama (kolom request langsung, termasuk approve awal & route
  // ke Supervisor - tahap itu memang milik seluruh request, bukan satu ruangan).
  // 1+ = ruangan lain di dalam `rooms` JSONB, hanya dipakai untuk assign/re-assign
  // handler ruangan itu sendiri - lihat handleSave.
  roomIdx?: number;
}) {
  const [teamMembers, setTeamMembers] = useState<User[]>([]);
  const [supervisors, setSupervisors] = useState<{ id: string; full_name: string; team_type?: string; phone_number?: string }[]>([]);
  // Nilai pilihan adalah id, bukan nama. Nama bisa dimiliki dua orang di satu
  // kantor; id tidak. Nama tetap ditulis ke assign_name untuk tampilan.
  const [selectedPTSId, setSelectedPTSId] = useState('');
  const [selectedSupervisorId, setSelectedSupervisorId] = useState('');
  const [saving, setSaving] = useState(false);
  const [routeSaving, setRouteSaving] = useState(false);
  const [formErr, setFormErr] = useState('');

  // Request dari external (non-IVP) wajib assign IVP Sales internal
  const isExternal = !!(req.sales_division && req.sales_division.trim() && req.sales_division.trim().toUpperCase() !== 'IVP');

  useEffect(() => {
    // Fetch Team PTS (hanya team assignable = IVP/MVI, UMP dikecualikan - lib/teams.ts)
    supabase.from('users')
      .select('id, full_name, role, team_type, phone_number, sales_division, jabatan, bisa_ditugaskan')
      .in('role', ['team_pts', 'team'])
      .then(({ data }: { data: User[] | null }) => {
        if (!data) return;
        // Manager hanya ditawarkan bila penugasnya Admin murni.
        const penugasAdmin = adalahAdminMurni(currentUser);
        const anggota = data.filter(u => bolehDitugaskanOleh(u, penugasAdmin));
        setTeamMembers(anggota);
        // Pra-pilih handler yang sudah tercatat, kalau orangnya memang ketemu.
        // Dicocokkan lewat uuid dulu; nama hanya cadangan untuk baris lama.
        const roomAssignUserId = getRoomAssignUserId(req, roomIdx);
        const roomAssignName = getRoomAssignName(req, roomIdx);
        const sekarang = (roomAssignUserId && anggota.find(u => u.id === roomAssignUserId))
          || (roomAssignName ? anggota.find(u => u.full_name === roomAssignName) : undefined);
        if (sekarang) setSelectedPTSId(sekarang.id);
      });
    // Fetch Supervisor (jabatan='Supervisor') - utk opsi Route ke Supervisor
    if (allowSupervisorRoute) {
      supabase.from('users')
        .select('id, full_name, team_type, phone_number')
        .eq('jabatan', 'Supervisor')
        .then(({ data }: { data: { id: string; full_name: string; team_type?: string; phone_number?: string }[] | null }) => { if (data) setSupervisors(data.filter(s => isAssignablePTSTeam(s.team_type))); });
    }
  }, [allowSupervisorRoute, req, roomIdx, currentUser]);

  // Orang yang akan dicatat sebagai handler. 'SELF' berarti yang membuka popup
  // ini mengerjakannya sendiri - jalan keluar saat timnya penuh.
  const calonHandler: { id: string; full_name: string; phone_number?: string } | undefined =
    selectedPTSId === 'SELF' ? currentUser : teamMembers.find(m => m.id === selectedPTSId);

  // Dirinya sendiri disembunyikan dari daftar anggota karena sudah diwakili
  // opsi "Saya kerjakan sendiri" - kalau tidak, namanya muncul dua kali.
  const anggotaLain = teamMembers.filter(m => m.id !== currentUser.id);

  // Route ke Supervisor: request lanjut ke Supervisor utk di-assign ke tim
  const handleRouteToSupervisor = async () => {
    if (!selectedSupervisorId) { setFormErr('Pilih Supervisor tujuan terlebih dahulu.'); return; }
    setFormErr('');
    setRouteSaving(true);
    const sup = supervisors.find(s => s.id === selectedSupervisorId);
    const updatePayload: Record<string, unknown> = {
      status: 'approved',
      approved_by: currentUser.full_name,
      approved_at: new Date().toISOString(),
      routing_status: 'supervisor_assign',
      assigned_supervisor_id: selectedSupervisorId,
      assign_name: null,   // belum di-assign ke handler — Supervisor yg lanjut
      assign_user_id: null,
    };
    const { error, data } = await cobaIdentitas(async pakaiUuid => await supabase.from('project_requests')
      .update(pakaiUuid ? updatePayload : tanpaIdentitas(updatePayload)).eq('id', req.id).select('id'));
    if (error) { setFormErr('Gagal route: ' + error.message); setRouteSaving(false); return; }
    if (!data || data.length === 0) { setFormErr('Gagal route: perubahan ditolak sistem (RLS). Hubungi admin.'); setRouteSaving(false); return; }
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
        `🔗 ${appLink()}`,
      ].join('\n');
      await sendWANotif({ type: 'reminder_wa', target: sup.phone_number, message: lines , event: 'project.routed_supervisor' });
    }
    if (sup?.id) {
      void createNotification({
        user_id: sup.id, type: 'project',
        title: '🎯 Request perlu kamu assign',
        body: `${req.sales_name || '-'} — ${req.project_name}`,
        action_url: '/form-require-project', ref_id: req.id,
        created_by: currentUser.full_name,
      });
    }
    setRouteSaving(false);
    onAssigned();
  };

  const handleSave = async () => {
    if (!calonHandler) { setFormErr('Pilih Tim PTS handler terlebih dahulu.'); return; }
    setFormErr('');
    setSaving(true);

    // Nama DAN uuid ditulis bersamaan: uuid menjawab siapa orangnya, nama
    // menjawab tercatat sebagai siapa. Menulis salah satunya saja akan
    // melahirkan baris baru dengan cacat data lama yang sedang dibereskan.
    //
    // Ruangan pertama (roomIdx 0) menulis kolom request langsung seperti
    // semula. Ruangan lain (1+) hidup di dalam array JSONB `rooms` - assign
    // ruangan itu TIDAK menyentuh status/approved_by milik request atau
    // ruangan lain, supaya Command Center bisa masih "in_progress" sementara
    // Smart ClassRoom sudah "completed" - lihat getRoomStatus() di shared.ts.
    let updatePayload: Record<string, unknown>;
    if (roomIdx === 0) {
      updatePayload = {
        assign_name: calonHandler.full_name,
        assign_user_id: calonHandler.id,
        status: 'approved',
        approved_by: currentUser.full_name,
        approved_at: new Date().toISOString(),
      };
      // Penanda tahap Supervisor (routing_status) dibersihkan kalau request ini
      // memang di-route ke sana - assign langsung tidak menyentuh kolom routing
      // supaya tetap jalan walau migrasi supervisor belum dijalankan.
      // assigned_supervisor_id SENGAJA TIDAK ikut dikosongkan: RLS pr_update
      // mengizinkan Supervisor menulis baris ini lewat assigned_supervisor_id =
      // dirinya sendiri - kalau kolom itu ikut di-null-kan di update yang sama,
      // WITH CHECK dievaluasi terhadap baris BARU (bukan baris lama) dan tidak
      // ada lagi syarat yang cocok, jadi RLS diam-diam menolak (0 baris, tanpa
      // error) walau notifikasi WA/Telegram sudah kadung terkirim.
      if (req.routing_status === 'supervisor_assign') {
        updatePayload.routing_status = null;
      }
    } else {
      const rooms = [...(req.rooms || [])];
      const i = roomIdx - 1;
      if (rooms[i]) {
        rooms[i] = {
          ...rooms[i],
          assign_name: calonHandler.full_name,
          assign_user_id: calonHandler.id,
          status: 'approved',
          approved_by: currentUser.full_name,
          approved_at: new Date().toISOString(),
        };
      }
      updatePayload = { rooms };
    }

    const { error, data } = await cobaIdentitas(async pakaiUuid => await supabase.from('project_requests')
      .update(pakaiUuid ? updatePayload : tanpaIdentitas(updatePayload)).eq('id', req.id).select('id'));
    if (!error && (!data || data.length === 0)) {
      setFormErr('Gagal approve: perubahan ditolak sistem (RLS). Hubungi admin.');
      setSaving(false);
      return;
    }
    if (!error) {
      await supabase.from('project_messages').insert([{
        request_id: req.id,
        sender_id: currentUser.id,
        sender_name: 'System',
        sender_role: 'system',
        message: `✅ Request diapprove oleh ${currentUser.full_name}. Assigned ke Tim PTS: ${calonHandler.full_name}.`,
      }]);

      // WA notif ke PTS. (IVP Sales internal reviewer sudah dinotif via WA saat
      // request dibuat - lihat resolveBrandInternals/internalHandlers di page.tsx -
      // jadi tidak perlu dikirim ulang di sini.)
      // WA tidak dikirim ke diri sendiri: yang menekan tombolnya sudah tahu.
      // Badge in-app TETAP dikirim walau ke diri sendiri - supaya ada
      // catatan/link yang bisa dibuka lagi nanti, sama seperti assign ke orang lain.
      if (calonHandler.phone_number && calonHandler.id !== currentUser.id) {
        const lines = [
          '🏗️ *request design Project — Assigned ke Kamu*',
          '━━━━━━━━━━━━━━━━━━',
          `📋 Project  : ${req.project_name}`,
          `🛋️ Ruangan  : ${req.room_name || '-'}`,
          `🏢 Sales    : ${req.sales_name || '-'} (${req.sales_division || '-'})`,
          `👤 Requester: ${req.requester_name}`,
          '━━━━━━━━━━━━━━━━━━',
          'Segera proses dan update status ya! 💪',
          `🔗 ${appLink()}`,
        ].join('\n');
        await sendWANotif({ type: 'reminder_wa', target: calonHandler.phone_number, message: lines , event: 'project.assigned' });
      }
      void createNotification({
        user_id: calonHandler.id, type: 'project',
        title: calonHandler.id === currentUser.id ? '🏗️ Kamu assign request ini ke diri sendiri' : '🏗️ Request design di-assign ke kamu',
        body: `${req.project_name} — ${req.room_name || '-'}`,
        action_url: '/form-require-project', ref_id: req.id,
        created_by: currentUser.full_name,
      });

      onAssigned();
    } else {
      setFormErr('Gagal approve: ' + error.message);
    }
    setSaving(false);
  };

  // Warna menandai tahap, bukan halaman - sama seperti Ticketing & Request
  // Schedule: hijau saat approve, kuning saat Supervisor meng-assign.
  const hijau = allowSupervisorRoute;
  const aksen = hijau
    ? { garis: 'rgba(34,197,94,0.4)', gradasi: 'linear-gradient(135deg,#16a34a,#15803d)', bayang: '0 4px 14px rgba(22,163,74,0.35)', cincin: 'focus:ring-green-500/40', subjudul: 'text-green-200/80' }
    : { garis: 'rgba(245,158,11,0.4)', gradasi: 'linear-gradient(135deg,#f59e0b,#d97706)', bayang: '0 4px 14px rgba(245,158,11,0.35)', cincin: 'focus:ring-amber-500/40', subjudul: 'text-amber-100/90' };

  return (
  <ModalPortal>
    <div role="dialog" aria-modal="true" className="fixed inset-0 bg-black/60 flex items-center justify-center z-[1200] p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
        style={{ animation: 'scale-in 0.25s ease-out', border: `2px solid ${aksen.garis}` }}>

        {/* Header */}
        <div className="px-6 py-5 flex items-center justify-between" style={{ background: aksen.gradasi }}>
          <div className="min-w-0">
            <h3 className="text-lg font-bold text-white">{hijau ? '✅ Approve & Assign Request' : '🎯 Assign ke Tim'}</h3>
            <p className={`text-xs mt-0.5 truncate max-w-[300px] ${aksen.subjudul}`}>{req.project_name}</p>
          </div>
          <button aria-label="Tutup" onClick={onClose} className="bg-white/15 hover:bg-white/25 text-white p-2 rounded-lg transition-all flex-shrink-0">
            <svg aria-hidden="true" focusable="false" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Info request */}
          <div className="rounded-xl p-3 space-y-1"
            style={{ background: 'rgba(59,130,246,0.07)', border: '1px solid rgba(59,130,246,0.2)' }}>
            <p className="text-[11px] font-bold text-blue-600 uppercase tracking-widest">Request dari Sales</p>
            <p className="text-sm font-bold text-slate-800">
              {req.sales_name || '-'}{req.sales_division ? ` · ${req.sales_division}` : ''}
              <span className={`ml-2 px-2 py-0.5 rounded-full text-[11px] font-bold align-middle ${isExternal ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'}`}>
                {isExternal ? 'External' : 'Internal IVP'}
              </span>
            </p>
            <p className="text-xs text-slate-500">🛋️ {req.room_name || '-'} · 👤 {req.requester_name}</p>
          </div>

          {/* Divisi external: IVP Sales internal sudah ter-mapping sejak request dibuat */}
          {isExternal && (
            <div className="rounded-xl p-3 flex items-start gap-2"
              style={{ background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.25)' }}>
              <span className="text-base flex-shrink-0"><Ikon nama="🔗" ukuran="1em" className="inline-block align-[-0.12em]" /></span>
              <p className="text-xs text-indigo-700 leading-relaxed">
                Request dari divisi external <strong>{req.sales_division}</strong>. Cukup pilih <strong>Tim PTS</strong> yang menangani —
                IVP Sales internal untuk divisi ini sudah otomatis ter-mapping sejak request dibuat.
              </p>
            </div>
          )}

          {/* Route ke Supervisor — jalur UTAMA saat approve, sama seperti Request Schedule */}
          {allowSupervisorRoute && supervisors.length > 0 && (
            <div className="rounded-xl p-4" style={{ background: 'rgba(245,158,11,0.08)', border: '1.5px solid rgba(245,158,11,0.3)' }}>
              <p className="text-xs font-bold text-amber-700 mb-1"><IkonTeks nama="🎯" />Route ke Supervisor (Rekomendasi)</p>
              <p className="text-[11px] text-amber-700 mb-3">
                Supervisor yang dipilih akan di-WA untuk meng-assign ke anggota timnya, atau mengerjakan sendiri.
              </p>
              <select aria-label="-- Pilih Supervisor --" value={selectedSupervisorId}
                onChange={e => { setSelectedSupervisorId(e.target.value); setFormErr(''); }}
                className="w-full rounded-xl px-4 py-2.5 text-sm outline-none transition-all text-slate-800 focus:ring-2 focus:ring-amber-500/40 mb-2.5"
                style={{ background: '#ffffff', border: '1px solid rgba(0,0,0,0.12)' }}>
                <option value="">-- Pilih Supervisor --</option>
                {supervisors.map(s => <option key={s.id} value={s.id}>{s.full_name}{s.team_type ? ` · ${s.team_type}` : ''}</option>)}
              </select>
              <button type="button" onClick={handleRouteToSupervisor} disabled={routeSaving || !selectedSupervisorId}
                className="w-full py-2.5 rounded-xl font-bold text-sm text-white transition-all flex items-center justify-center gap-2 hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                style={{ background: 'linear-gradient(135deg,#f59e0b,#d97706)' }}>
                {routeSaving && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                <IkonTeks nama="🎯" />Approve &amp; Route ke Supervisor
              </button>
            </div>
          )}

          {/* Assign ke Tim PTS */}
          <div>
            <label className="block text-xs font-bold mb-1.5 tracking-widest uppercase" style={{ color: '#64748b' }}>
              {allowSupervisorRoute && supervisors.length > 0 ? 'Atau Assign Langsung Manual' : 'Assign ke Team PTS *'}
            </label>
            {teamMembers.length === 0 ? (
              <div className="text-center py-6 text-gray-500 text-sm rounded-xl" style={{ background: '#f8fafc', border: '1px solid rgba(0,0,0,0.08)' }}>
                <div className="text-3xl mb-1"><Ikon nama="👥" ukuran="1em" className="inline-block align-[-0.12em]" /></div>
                <p className="text-xs">Tidak ada Team PTS tersedia</p>
              </div>
            ) : (
              <select aria-label="-- Pilih Anggota Team PTS --" value={selectedPTSId}
                onChange={e => { setSelectedPTSId(e.target.value); setFormErr(''); }}
                className={`w-full rounded-xl px-4 py-3 text-sm outline-none transition-all text-slate-800 focus:ring-2 ${aksen.cincin}`}
                style={{ background: '#ffffff', border: '1px solid rgba(0,0,0,0.12)' }}>
                <option value="">-- Pilih Anggota Team PTS --</option>
                <option value="SELF">Saya kerjakan sendiri</option>
                <optgroup label="Anggota Tim">
                  {anggotaLain.map(m => (
                    <option key={m.id} value={m.id}>{m.full_name}{m.team_type ? ` · ${m.team_type}` : ''}</option>
                  ))}
                </optgroup>
              </select>
            )}
          </div>

          {/* Info WA */}
          <div className="rounded-xl p-3 flex items-start gap-2"
            style={{ background: 'rgba(34,197,94,0.07)', border: '1px solid rgba(34,197,94,0.2)' }}>
            <span className="text-base flex-shrink-0"><Ikon nama="💬" ukuran="1em" className="inline-block align-[-0.12em]" /></span>
            <p className="text-[11px] text-green-700 leading-relaxed">
              WA notifikasi otomatis dikirim ke <strong>Tim PTS</strong> yang di-assign (kecuali kamu sendiri).
            </p>
          </div>

          {formErr && (
            <div className="px-4 py-2.5 rounded-xl text-sm font-medium text-red-700 bg-red-50 border border-red-200">{formErr}</div>
          )}

          {/* Buttons */}
          <div className="flex gap-3 pt-1">
            <button onClick={onClose}
              className="flex-1 py-3 rounded-xl font-semibold text-sm transition-all"
              style={{ background: '#f8fafc', color: '#64748b', border: '1px solid rgba(0,0,0,0.12)' }}>
              Batal
            </button>
            <button onClick={handleSave} disabled={saving || !selectedPTSId}
              className="flex-[2] text-white py-3 rounded-xl font-bold transition-all text-sm flex items-center justify-center gap-2 hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              style={{ background: aksen.gradasi, boxShadow: aksen.bayang }}>
              {saving
                ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Menyimpan...</>
                : hijau
                  ? (supervisors.length > 0 ? <>✅ Assign Langsung (lewati Supervisor)</> : <>✅ Approve &amp; Assign</>)
                  : <>🎯 Assign</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  </ModalPortal>
  );
}

// RoomSection
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
  const merekDisplay = useDaftarPilihan('merek-display');
  const merekMiddleware = useDaftarPilihan('merek-middleware');
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
            <button aria-pressed={active} key={opt} type="button"
              onClick={() => onUpdate({ [field]: multi ? toggleArr(value, opt) : (active ? [] : [opt]) } as any)}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 text-sm font-medium transition-all ${active ? 'border-teal-500 bg-teal-50 text-teal-700 shadow-md' : 'border-gray-300 bg-white text-gray-600 hover:border-teal-300 hover:bg-teal-50/50'}`}>
              <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${active ? 'border-teal-500 bg-teal-500' : 'border-gray-400'}`}>
                {active && <svg aria-hidden="true" focusable="false" className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
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
          className="flex-1 min-w-0 border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm font-medium bg-white outline-none focus:border-teal-400" />
        <button aria-label="Tutup" type="button" onClick={onRemove}
          className="p-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 transition-all flex-shrink-0">
          <svg aria-hidden="true" focusable="false" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
      </div>

      {/* Kebutuhan */}
      {Chips({ label: "Kebutuhan *", opts: ['Signage','Immersive','Meeting Room','Mapping','Command Center','Hybrid Classroom'], value: room.kebutuhan, field: "kebutuhan", multi: false })}
      <div className="mb-4">
        <input value={room.kebutuhan_other} onChange={e => onUpdate({ kebutuhan_other: e.target.value })} placeholder="Other kebutuhan..."
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-teal-400" />
      </div>

      {/* Solution Product */}
      {Chips({ label: "Solution Product *", opts: ['Videowall','Signage Display','Videotron','Projector','Kiosk','IFP'], value: room.solution_product, field: "solution_product" })}
      <div className="mb-4">
        <input value={room.solution_other} onChange={e => onUpdate({ solution_other: e.target.value })} placeholder="Other solution..."
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-teal-400" />
      </div>

      {/* Brand Display 1 & 2 + Middleware.
          Slot display KEDUA ada karena satu ruangan bisa memakai dua produk
          display dari brand berbeda, dan tiap brand punya PIC-nya sendiri.
          Sebelumnya brand yang satunya hanya bisa dititipkan di kolom
          keterangan — dan PIC-nya tidak pernah ikut ter-mapping, jadi orang
          yang seharusnya menangani tidak pernah tahu. */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4 pt-2 border-t border-gray-100">
        <div>
          <label htmlFor="f-form-require-project-components-modals-1" className="block text-[11px] font-bold text-amber-700 uppercase tracking-widest mb-1.5"><IkonTeks nama="🖥" />Brand Display <span className="text-gray-500 font-normal">(opsional)</span></label>
          <select id="f-form-require-project-components-modals-1" value={room.brand_display} onChange={e => {
            const brand = e.target.value;
            const pic = getBrandPic('display', brand);
            onUpdate({ brand_display: brand, brand_display_pic_id: pic?.pic_user_id||'', brand_display_pic_name: pic?.pic_user_name||'' });
          }} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-amber-400 appearance-none">
            <option value="">— Pilih Brand Display —</option>
            {denganNilai(merekDisplay, room.brand_display).map(b => <option key={b} value={b}>{b}</option>)}
          </select>
          {room.brand_display && room.brand_display_pic_name && <p className="mt-1 text-[11px] text-amber-700 font-semibold bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1"><IkonTeks nama="👤" />PIC: {room.brand_display_pic_name}</p>}
          {room.brand_display && !room.brand_display_pic_name && <p className="mt-1 text-[11px] text-gray-500 italic">PIC belum di-set admin</p>}
        </div>
        <div>
          <label htmlFor="f-form-require-project-components-modals-2" className="block text-[11px] font-bold text-amber-700 uppercase tracking-widest mb-1.5"><IkonTeks nama="🖥" />Brand Display 2 <span className="text-gray-500 normal-case font-normal">(opsional)</span></label>
          <select id="f-form-require-project-components-modals-2" value={room.brand_display_2 ?? ''} onChange={e => {
            const brand = e.target.value;
            const pic = getBrandPic('display', brand);
            onUpdate({ brand_display_2: brand, brand_display_2_pic_id: pic?.pic_user_id||'', brand_display_2_pic_name: pic?.pic_user_name||'' });
          }} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-amber-400">
            <option value="">— Pilih Brand Display 2 —</option>
            {denganNilai(merekDisplay, room.brand_display_2).map(b => <option key={b} value={b}>{b}</option>)}
          </select>
          {room.brand_display_2 && room.brand_display_2_pic_name && <p className="mt-1 text-[11px] text-amber-700 font-semibold bg-amber-50 border border-amber-200 rounded px-2 py-1"><IkonTeks nama="👤" />PIC: {room.brand_display_2_pic_name}</p>}
          {room.brand_display_2 && !room.brand_display_2_pic_name && <p className="mt-1 text-[11px] text-gray-500 italic">PIC belum di-mapping</p>}
        </div>
        <div>
          <label htmlFor="f-form-require-project-components-modals-3" className="block text-[11px] font-bold text-violet-600 uppercase tracking-widest mb-1.5"><IkonTeks nama="🔌" />Brand Middleware <span className="text-gray-500 font-normal">(opsional)</span></label>
          <select id="f-form-require-project-components-modals-3" value={room.brand_middleware} onChange={e => {
            const brand = e.target.value;
            const pic = getBrandPic('middleware', brand);
            onUpdate({ brand_middleware: brand, brand_middleware_pic_id: pic?.pic_user_id||'', brand_middleware_pic_name: pic?.pic_user_name||'' });
          }} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-violet-400 appearance-none">
            <option value="">— Pilih Brand Middleware —</option>
            {denganNilai(merekMiddleware, room.brand_middleware).map(b => <option key={b} value={b}>{b}</option>)}
          </select>
          {room.brand_middleware && room.brand_middleware_pic_name && <p className="mt-1 text-[11px] text-violet-700 font-semibold bg-violet-50 border border-violet-200 rounded-lg px-2.5 py-1"><IkonTeks nama="👤" />PIC: {room.brand_middleware_pic_name}</p>}
          {room.brand_middleware && !room.brand_middleware_pic_name && <p className="mt-1 text-[11px] text-gray-500 italic">PIC belum di-set admin</p>}
        </div>
      </div>

      {/* Layout Signage — only if Signage selected */}
      {room.kebutuhan.includes('Signage') && (
        <div className="mb-4 pt-2 border-t border-gray-100">
          {Chips({ label: "Layout Signage", opts: ['Single Zone','Multi Zone','Full Screen','Custom Layout'], value: room.layout_signage, field: "layout_signage" })}
          {Chips({ label: "Jaringan CMS", opts: ['Cloud','Onpremise','USB'], value: room.jaringan_cms, field: "jaringan_cms" })}
          <div className="grid grid-cols-2 gap-3 mt-1">
            <div><label htmlFor="f-form-require-project-components-modals-4" className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Jumlah Input</label><input id="f-form-require-project-components-modals-4" value={room.jumlah_input} onChange={e => onUpdate({jumlah_input:e.target.value})} placeholder="e.g. 4" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-teal-400"/></div>
            <div><label htmlFor="f-form-require-project-components-modals-5" className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Jumlah Output</label><input id="f-form-require-project-components-modals-5" value={room.jumlah_output} onChange={e => onUpdate({jumlah_output:e.target.value})} placeholder="e.g. 2" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-teal-400"/></div>
          </div>
        </div>
      )}

      {/* Source */}
      <div className="mb-4 pt-2 border-t border-gray-100">
        {Chips({ label: "Source", opts: ['PC / Mini PC','Laptop','URL Dashboard','NVR CCTV','Media Player','IPTV','Set Top Box'], value: room.source, field: "source" })}
        <div className="flex gap-3 mb-3">
          {room.source.includes('Laptop') && <div className="flex-1 min-w-0"><label htmlFor="f-form-require-project-components-modals-6" className="block text-[11px] font-bold text-amber-700 uppercase tracking-widest mb-1">Qty Laptop</label><input id="f-form-require-project-components-modals-6" type="number" min="1" value={room.source_laptop_qty} onChange={e=>onUpdate({source_laptop_qty:e.target.value})} placeholder="1" className="w-full border border-amber-200 rounded-lg px-3 py-2 text-sm bg-amber-50 outline-none focus:border-amber-400"/></div>}
          {room.source.includes('PC / Mini PC') && <div className="flex-1 min-w-0"><label htmlFor="f-form-require-project-components-modals-7" className="block text-[11px] font-bold text-blue-600 uppercase tracking-widest mb-1">Qty PC</label><input id="f-form-require-project-components-modals-7" type="number" min="1" value={room.source_pc_qty} onChange={e=>onUpdate({source_pc_qty:e.target.value})} placeholder="1" className="w-full border border-blue-200 rounded-lg px-3 py-2 text-sm bg-blue-50 outline-none focus:border-blue-400"/></div>}
        </div>
        <input value={room.source_other} onChange={e=>onUpdate({source_other:e.target.value})} placeholder="Other source..." className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-teal-400"/>
      </div>

      {/* Camera + Audio — 2 kolom.
          Sebelumnya tiap Yes/No memakai satu baris penuh sendiri, KECUALI
          Wallplate+Tabletop yang berdua. Hasilnya satu baris terlihat
          berpasangan sementara sisanya menyisakan ruang kosong selebar
          setengah kartu — terbaca seperti ada isian yang lupa dipasang.
          Semua dipasangkan supaya ritmenya sama. */}
      <div className="pt-2 border-t border-gray-100 grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
      <div>
        {YN({ label: "Camera Conference", field: "camera_conference", value: room.camera_conference })}
        {room.camera_conference==='Yes' && <div className="ml-4 mb-4 space-y-3 border-l-2 border-teal-200 pl-4">
          <div>
            <label htmlFor="f-form-require-project-components-modals-8" className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Jumlah Camera</label>
            <input id="f-form-require-project-components-modals-8" value={room.camera_jumlah} onChange={e=>onUpdate({camera_jumlah:e.target.value})} placeholder="e.g. 2 unit" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-teal-400"/>
          </div>
          {Chips({ label: "Tipe Tracking", opts: ['Auto Tracking','Manual PTZ','Fixed'], value: room.camera_tracking, field: "camera_tracking" })}
        </div>}
      </div>

      <div>
        {YN({ label: "Audio System", field: "audio_system", value: room.audio_system })}
        {room.audio_system==='Yes' && <div className="ml-4 mb-4 space-y-3 border-l-2 border-teal-200 pl-4">
          <div>
            <label htmlFor="f-form-require-project-components-modals-9" className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Mixer / DSP</label>
            <input id="f-form-require-project-components-modals-9" value={room.audio_mixer} onChange={e=>onUpdate({audio_mixer:e.target.value})} placeholder="e.g. Yamaha QL1, QSC, etc." className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-teal-400"/>
          </div>
          {Chips({ label: "Audio Detail", opts: ['Speaker Ceiling','Speaker Line Array','Subwoofer','Microphone','Amplifier'], value: room.audio_detail, field: "audio_detail" })}
        </div>}
      </div>
      </div>

      {/* Wallplate + Tabletop — 2 col */}
      <div className="pt-2 border-t border-gray-100 grid grid-cols-2 gap-3">
        <div>
          {YN({ label: "Wallplate Input", field: "wallplate_input", value: room.wallplate_input })}
          {room.wallplate_input==='Yes' && <div className="ml-4 border-l-2 border-teal-200 pl-4 mb-4">
            <label htmlFor="f-form-require-project-components-modals-10" className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Jumlah Wallplate</label>
            <input id="f-form-require-project-components-modals-10" value={room.wallplate_jumlah} onChange={e=>onUpdate({wallplate_jumlah:e.target.value})} placeholder="e.g. 3 unit" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-teal-400"/>
          </div>}
        </div>
        <div>
          {YN({ label: "Tabletop Input", field: "tabletop_input", value: room.tabletop_input })}
          {room.tabletop_input==='Yes' && <div className="ml-4 border-l-2 border-teal-200 pl-4 mb-4">
            <label htmlFor="f-form-require-project-components-modals-11" className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Jumlah Tabletop</label>
            <input id="f-form-require-project-components-modals-11" value={room.tabletop_jumlah} onChange={e=>onUpdate({tabletop_jumlah:e.target.value})} placeholder="e.g. 2 unit" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-teal-400"/>
          </div>}
        </div>
      </div>

      {/* Wireless + Controller — 2 kolom, alasan sama dengan Camera+Audio di atas. */}
      <div className="pt-2 border-t border-gray-100 grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
      <div>
        {YN({ label: "Wireless Presentation", field: "wireless_presentation", value: room.wireless_presentation })}
        {room.wireless_presentation==='Yes' && <div className="ml-4 mb-4 space-y-3 border-l-2 border-teal-200 pl-4">
          {Chips({ label: "Wireless Mode", opts: ['Aplikasi','AirPlay','Miracast','Chromecast','BYOM'], value: room.wireless_mode, field: "wireless_mode" })}
          {YN({ label: "Dongle", field: "wireless_dongle", value: room.wireless_dongle })}
        </div>}
      </div>

      <div>
        {YN({ label: "Controller / Automation", field: "controller_automation", value: room.controller_automation })}
        {room.controller_automation==='Yes' && <div className="ml-4 mb-4 border-l-2 border-teal-200 pl-4">
          {Chips({ label: "Controller Type", opts: ['Cue','Wyrestorm','Extron','Custom'], value: room.controller_type, field: "controller_type" })}
        </div>}
      </div>
      </div>

      {/* Ukuran, Suggest, Keterangan */}
      <div className="pt-2 border-t border-gray-100 space-y-3 mb-4">
        <div>
          <label htmlFor="f-form-require-project-components-modals-12" className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Ukuran Ruangan (P×L×T)</label>
          <input id="f-form-require-project-components-modals-12" value={room.ukuran_ruangan} onChange={e=>onUpdate({ukuran_ruangan:e.target.value})} placeholder="e.g. 8m×6m×3m" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-teal-400"/>
        </div>
        <div>
          <label htmlFor="f-form-require-project-components-modals-13" className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Suggest Tampilan (W×H)</label>
          <input id="f-form-require-project-components-modals-13" value={room.suggest_tampilan} onChange={e=>onUpdate({suggest_tampilan:e.target.value})} placeholder="e.g. 1920×1080 atau 4K" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-teal-400"/>
        </div>
        <div>
          <label htmlFor="f-form-require-project-components-modals-14" className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Keterangan Lain</label>
          <textarea id="f-form-require-project-components-modals-14" value={room.keterangan_lain} onChange={e=>onUpdate({keterangan_lain:e.target.value})} rows={2} placeholder="Info tambahan..." className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-teal-400 resize-none"/>
        </div>
      </div>

      {/* Foto + BOQ — 2 col, same layout as Ruangan 1 */}
      {isGuest && (
        <div className="pt-2 border-t border-gray-100 grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Foto Survey */}
          <div>
            <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-2"><IkonTeks nama="📸" />Foto Survey Ruangan Ini</label>
            <input ref={fileRef} type="file" accept="image/*" multiple className="hidden"
              id={`room-photo-${room.id}`}
              onChange={e => { const files = Array.from(e.target.files||[]); if(files.length) onAddPhotos(files); e.target.value=''; }}/>
            {previews.length === 0 ? (
              <label htmlFor={`room-photo-${room.id}`} className="w-full border-2 border-dashed border-gray-300 rounded-xl py-4 flex flex-col items-center justify-center text-gray-500 hover:border-teal-400 hover:text-teal-500 transition-all cursor-pointer">
                <span className="text-2xl mb-1"><Ikon nama="📷" ukuran="1em" className="inline-block align-[-0.12em]" /></span>
                <span className="text-xs font-medium">Klik upload foto</span>
                <span className="text-[11px] opacity-70">Max 10 foto</span>
              </label>
            ) : (
              <div>
                <div className="grid grid-cols-4 gap-1.5 mb-2">
                  {previews.map((src, i) => (
                    <div key={i} className="relative group rounded-lg overflow-hidden aspect-square border border-gray-200">
                      <img src={src} alt="" className="w-full h-full object-cover"/>
                      <button aria-label="Tutup" type="button" onClick={() => onRemovePhoto(i)} className="absolute top-0.5 right-0.5 bg-red-500 text-white w-4 h-4 rounded-full text-[11px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">✕</button>
                    </div>
                  ))}
                  {photos.length < 10 && (
                    <label htmlFor={`room-photo-${room.id}`} className="aspect-square border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center text-gray-500 hover:border-teal-400 cursor-pointer"><span className="text-xl">+</span></label>
                  )}
                </div>
                <p className="text-[11px] text-gray-500">{photos.length}/10 foto</p>
              </div>
            )}
          </div>
          {/* BOQ Excel */}
          <div>
            <label htmlFor="f-form-require-project-components-modals-15" className="block text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-2"><IkonTeks nama="📊" />BOQ Excel Ruangan Ini</label>
            <input id="f-form-require-project-components-modals-15" ref={boqRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f && onSetBoq) onSetBoq(f); e.target.value=''; }} />
            {!boqFile ? (
              <button type="button" onClick={() => boqRef.current?.click()}
                className="w-full border-2 border-dashed border-emerald-300 rounded-xl py-4 flex flex-col items-center justify-center text-emerald-700 hover:border-emerald-500 hover:bg-emerald-50 transition-all cursor-pointer">
                <span className="text-2xl mb-1"><Ikon nama="📊" ukuran="1em" className="inline-block align-[-0.12em]" /></span>
                <span className="text-xs font-medium">Klik upload BOQ</span>
                <span className="text-[11px] opacity-70">.xlsx / .xls / .csv</span>
              </button>
            ) : (
              <div>
                <div className="border-2 border-emerald-300 bg-emerald-50 rounded-xl p-3 flex items-center gap-3">
                  <span className="text-xl"><Ikon nama="📊" ukuran="1em" className="inline-block align-[-0.12em]" /></span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-emerald-800 truncate">{boqFile.name}</p>
                    <p className="text-[11px] text-emerald-700">{(boqFile.size/1024).toFixed(1)} KB</p>
                  </div>
                  <button aria-label="Tutup" type="button" onClick={() => onSetBoq && onSetBoq(null)} className="text-red-600 hover:text-red-700 font-bold text-sm">✕</button>
                </div>
                <button type="button" onClick={() => boqRef.current?.click()}
                  className="mt-1.5 w-full text-xs text-emerald-700 hover:text-emerald-800 font-bold py-1 transition-all"><IkonTeks nama="🔄" />Ganti File</button>
              </div>
            )}
          </div>
        </div>
      )}
      {/* Foto only (no BOQ) for team users */}
      {!isGuest && (
        <div className="pt-2 border-t border-gray-100">
          <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-2"><IkonTeks nama="📸" />Foto Survey Ruangan Ini</label>
          <input ref={fileRef} type="file" accept="image/*" multiple className="hidden"
            id={`room-photo-ng-${room.id}`}
            onChange={e => { const files = Array.from(e.target.files||[]); if(files.length) onAddPhotos(files); e.target.value=''; }}/>
          {previews.length === 0 ? (
            <label htmlFor={`room-photo-ng-${room.id}`} className="w-full border-2 border-dashed border-gray-300 rounded-xl py-4 flex flex-col items-center justify-center text-gray-500 hover:border-teal-400 hover:text-teal-500 transition-all cursor-pointer">
              <span className="text-2xl mb-1"><Ikon nama="📷" ukuran="1em" className="inline-block align-[-0.12em]" /></span><span className="text-xs font-medium">Klik upload foto</span>
              <span className="text-[11px] opacity-70">Max 10 foto</span>
            </label>
          ) : (
            <div>
              <div className="grid grid-cols-4 gap-1.5 mb-2">
                {previews.map((src, i) => (
                  <div key={i} className="relative group rounded-lg overflow-hidden aspect-square border border-gray-200">
                    <img src={src} alt="" className="w-full h-full object-cover"/>
                    <button aria-label="Tutup" type="button" onClick={() => onRemovePhoto(i)} className="absolute top-0.5 right-0.5 bg-red-500 text-white w-4 h-4 rounded-full text-[11px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">✕</button>
                  </div>
                ))}
                {photos.length < 10 && (
                  <label htmlFor={`room-photo-ng-${room.id}`} className="aspect-square border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center text-gray-500 hover:border-teal-400 cursor-pointer"><span className="text-xl">+</span></label>
                )}
              </div>
              <p className="text-[11px] text-gray-500">{photos.length}/10 foto</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// NewFormModal

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
  /**
   * Display KEDUA - satu ruangan bisa memakai dua produk display dari brand
   * berbeda, dan tiap brand punya PIC-nya sendiri. Tanpa slot kedua, brand
   * yang satunya hanya bisa dititipkan di kolom keterangan dan PIC-nya tidak
   * pernah ikut ter-mapping.
   *
   * Opsional: ruangan yang dibuat sebelum kolom ini ada tidak memilikinya.
   * Rooms disimpan sebagai JSONB, jadi tidak perlu migrasi basis data.
   */
  brand_display_2?: string; brand_display_2_pic_id?: string; brand_display_2_pic_name?: string;
  brand_middleware: string; brand_middleware_pic_id: string; brand_middleware_pic_name: string;
  source_laptop_qty: string; source_pc_qty: string;
  brand?: string; // Marketing Brand: 'MVI' | 'IVP' | 'BOTH' - Sales External pilih (routing Sales Internal)
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
  isInternalSalesGuest?: boolean; // creator = Sales Internal (guest)  tampilkan field SBU
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
                {checked && <svg aria-hidden="true" focusable="false" className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
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
  <ModalPortal>
    <div role="dialog" aria-modal="true" className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[1100] p-4">
      <div className="bg-white/90 rounded-3xl shadow-2xl w-full max-w-[1500px] h-full max-h-full flex flex-col border-2 border-teal-500 animate-scale-in overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-teal-600 to-teal-800 px-6 py-4 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2"><IkonTeks nama="📋" />Form Equipment Request — IVP &amp; MVI</h2>
            <p className="text-teal-100 text-xs mt-0.5">Requester: <span className="font-bold">{currentUser.full_name}</span></p>
          </div>
          <button aria-label="Tutup" onClick={onClose} className="bg-white/20 hover:bg-white/30 text-white w-9 h-9 rounded-xl flex items-center justify-center font-bold transition-all text-lg">✕</button>
        </div>

        {/* Dua kolom, BUKAN tiga seperti form lain — pembagiannya mengikuti
            isinya, bukan angka. Konfigurator ruangan di kanan berisi tab per
            ruangan dengan puluhan isian perangkat; dipaksa selebar sepertiga
            layar, tab-nya berdesakan dan justru lebih sulit dipakai daripada
            saat harus digulir. Info project yang ringkas cukup di kolom kiri. */}
        <div className="flex-1 min-h-0 overflow-y-auto satulayar:overflow-hidden bg-gray-50">
          <div className="p-5 grid grid-cols-1 satulayar:grid-cols-3 gap-4 satulayar:h-full satulayar:overflow-hidden">

          <KolomInfoProyekBaru
            currentUser={currentUser} dueDateForm={dueDateForm} form={form} isInternalSalesGuest={isInternalSalesGuest} salesGuestUsers={salesGuestUsers} setDueDateForm={setDueDateForm} setForm={setForm}
          />

          <div className="satulayar:col-span-2 space-y-4 satulayar:overflow-y-auto satulayar:pr-1 satulayar:min-h-0">
          {/* ── Room Tab Navigator ── */}
          <div className="bg-white/95 rounded-2xl border-2 border-teal-200 shadow-sm overflow-hidden">
            {/* Tab bar */}
            <div className="flex items-center bg-teal-50 border-b border-teal-200 px-2 py-1.5 gap-1 overflow-x-auto">
              <button aria-label="Sebelumnya" type="button" onClick={goLeft} disabled={activeRoomIdx === 0}
                className="p-1.5 rounded-lg text-teal-700 hover:bg-teal-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all flex-shrink-0">
                <svg aria-hidden="true" focusable="false" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7"/></svg>
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
              <button aria-label="Berikutnya" type="button" onClick={goRight} disabled={activeRoomIdx === totalRooms - 1}
                className="p-1.5 rounded-lg text-teal-700 hover:bg-teal-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all flex-shrink-0">
                <svg aria-hidden="true" focusable="false" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7"/></svg>
              </button>
              <button type="button" onClick={addAndGoToRoom}
                className="flex-shrink-0 px-3 py-1.5 rounded-xl bg-teal-500 text-white text-xs font-bold hover:bg-teal-600 transition-all whitespace-nowrap ml-1">
                + Ruangan Lain
              </button>
              {/* Pendorong ini hanya dipakai saat barisnya memang muat. Di ponsel
                  ia mendorong penghitung ruangan keluar dari bagian yang terlihat. */}
              <div className="hidden sm:block flex-1"/>
              <span className="text-[11px] text-teal-700 font-bold mr-1">{activeRoomIdx+1}/{totalRooms}</span>
              {activeRoomIdx > 0 && (
                <button aria-label="Tutup" type="button" onClick={() => { setRooms(p => p.filter((_,i)=>i!==activeRoomIdx-1)); setActiveRoomIdx(a=>Math.max(0,a-1)); }}
                  className="flex-shrink-0 p-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 transition-all">
                  <svg aria-hidden="true" focusable="false" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
              )}
            </div>

            {/* Content — 2 columns */}
            <div className="p-5">
              <FormRuanganUtama
                activeRoomIdx={activeRoomIdx} boqFormFile={boqFormFile} boqRoom1Ref={boqRoom1Ref} boqRoomMap={boqRoomMap} brandPicMappings={brandPicMappings} currentUser={currentUser} form={form} roomPhotoMap={roomPhotoMap} rooms={rooms} setActiveRoomIdx={setActiveRoomIdx} setBoqFormFile={setBoqFormFile} setBoqRoomMap={setBoqRoomMap} setForm={setForm} setRoomPhotoMap={setRoomPhotoMap} setRooms={setRooms} setSurveyPhotos={setSurveyPhotos} setSurveyPhotosPreviews={setSurveyPhotosPreviews} surveyPhotoRef={surveyPhotoRef} surveyPhotos={surveyPhotos} surveyPhotosPreviews={surveyPhotosPreviews} toggleArr={toggleArr}
              />
            </div>
          </div>



          </div>
          </div>
        </div>

        <div className="border-t border-gray-200 px-4 py-3 flex gap-2 justify-end bg-white/90 flex-shrink-0">
          <BatalButton onClick={onClose} />
          <SubmitFormButton onClick={onSubmit} loading={submitting}
            gradient="linear-gradient(135deg,#0d9488,#115e59)"
            shadow="0 4px 14px rgba(13,148,136,0.35)" />
        </div>
      </div>
    </div>
  </ModalPortal>
  );
}

// request design Project Module
