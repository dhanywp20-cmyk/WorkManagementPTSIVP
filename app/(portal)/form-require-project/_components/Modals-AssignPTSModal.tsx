'use client';
/** Modals-AssignPTSModal.tsx - dipecah dari Modals.tsx (scripts/pecah-modul.mjs); Modals.tsx tetap mengekspor ulang semuanya. */
import { ModalPortal } from '@/components/shared';
import { Ikon, IkonTeks } from '@/components/shared/Ikon';
import { appLink } from '@/lib/app-url';
import { cobaIdentitas, tanpaIdentitas } from '@/lib/identitas';
import { createNotification } from '@/lib/notifications';
import { supabase } from '@/lib/supabase';
import { adalahAdminMurni, bolehDitugaskanOleh, isAssignablePTSTeam } from '@/lib/teams';
import { useEffect, useState } from 'react';
import { getRoomAssignName, getRoomAssignUserId, ProjectRequest, sendWANotif, User } from './shared';

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
      .then(({ data: baris }) => {
        const data = baris as unknown as User[] | null;
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
    <div role="dialog" aria-modal="true" className="fixed inset-0 bg-black/60 flex items-center justify-center z-1200 p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
        style={{ animation: 'scale-in 0.25s ease-out', border: `2px solid ${aksen.garis}` }}>

        {/* Header */}
        <div className="px-6 py-5 flex items-center justify-between" style={{ background: aksen.gradasi }}>
          <div className="min-w-0">
            <h3 className="text-lg font-bold text-white">{hijau ? '✅ Approve & Assign Request' : '🎯 Assign ke Tim'}</h3>
            <p className={`text-xs mt-0.5 truncate max-w-[300px] ${aksen.subjudul}`}>{req.project_name}</p>
          </div>
          <button aria-label="Tutup" onClick={onClose} className="bg-white/15 hover:bg-white/25 text-white p-2 rounded-lg transition-all shrink-0">
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
              <span className="text-base shrink-0"><Ikon nama="🔗" ukuran="1em" className="inline-block align-[-0.12em]" /></span>
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
                className="w-full rounded-xl px-4 py-2.5 text-sm outline-hidden transition-all text-slate-800 focus:ring-2 focus:ring-amber-500/40 mb-2.5"
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
                className={`w-full rounded-xl px-4 py-3 text-sm outline-hidden transition-all text-slate-800 focus:ring-2 ${aksen.cincin}`}
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
            <span className="text-base shrink-0"><Ikon nama="💬" ukuran="1em" className="inline-block align-[-0.12em]" /></span>
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
              className="flex-2 text-white py-3 rounded-xl font-bold transition-all text-sm flex items-center justify-center gap-2 hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
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
