'use client';
/** Modals-AssignPTSModal.tsx - dipecah dari Modals.tsx (scripts/pecah-modul.mjs); Modals.tsx tetap mengekspor ulang semuanya. */
import { KotakInfo, Modal, PilihPenugasan, TombolModal, TombolSetujui } from '@/components/shared';
import { appLink } from '@/lib/app-url';
import { cobaIdentitas, tanpaIdentitas } from '@/lib/identitas';
import { createNotification } from '@/lib/notifications';
import { supabase } from '@/lib/supabase';
import { adalahAdminMurni, bolehDitugaskanOleh, isAssignablePTSTeam } from '@/lib/teams';
import { useEffect, useState } from 'react';
import { getRoomAssignName, getRoomAssignUserId, ProjectRequest, sendWANotif, User } from './shared';

/**
 * AssignPTSModal - popup Setujui & Tugaskan dan Tugaskan Tim untuk Request
 * Design Project.
 *
 * Tampilan dan model isian penugasannya memakai pola persetujuan bersama
 * (components/shared/Persetujuan.tsx) - sama persis dengan Ticketing dan Request
 * Schedule, bukan gaya sendiri:
 *
 *   1. Kerangka Modal bersama; aksi utama "Setujui & Tugaskan" / "Tugaskan".
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
    //  Admin / Full Access menyetujui langsung tanpa menunggu Sales Internal: tahap review ditutup
    //  supaya request tidak tertinggal di antrean review Sales Internal.
    const lewatiReview = req.routing_status === 'internal_review';
    if (lewatiReview) updatePayload.routing_status = null;

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
        message: `✅ Request diapprove oleh ${currentUser.full_name}${lewatiReview ? ' (langsung, melewati review Sales Internal)' : ''}. Assigned ke Tim PTS: ${calonHandler.full_name}.`,
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

  //  Kerangka & tombol: pola persetujuan bersama (components/shared/Persetujuan.tsx) - sama dengan Ticketing
  //  & Request Schedule. Approve oleh Admin/Manager = "Setujui & Tugaskan"; Supervisor = "Tugaskan".
  const tahapSetujui = allowSupervisorRoute;
  const adaRute = allowSupervisorRoute && supervisors.length > 0;

  return (
    <Modal buka onTutup={onClose} judul={tahapSetujui ? 'Setujui & Tugaskan Request' : 'Tugaskan Tim'} keterangan={req.project_name} lapisan="maks"
      footer={<>
        <TombolModal onClick={onClose} disabled={saving}>Batal</TombolModal>
        <TombolModal jenis="utama" onClick={handleSave} disabled={saving || !selectedPTSId}>
          {saving ? 'Menyimpan...' : tahapSetujui ? (supervisors.length > 0 ? 'Tugaskan Langsung (lewati Supervisor)' : 'Setujui & Tugaskan') : 'Tugaskan'}
        </TombolModal>
      </>}>
      <div className="space-y-4">
        <KotakInfo judul="Request dari Sales">
          <p className="text-sm font-bold text-slate-800">
            {req.sales_name || '-'}{req.sales_division ? ` · ${req.sales_division}` : ''}
            <span className={`ml-2 px-2 py-0.5 rounded-full text-[11px] font-bold align-middle ${isExternal ? 'bg-amber-100 text-amber-800' : 'bg-slate-200 text-slate-700'}`}>
              {isExternal ? 'External' : 'Internal IVP'}
            </span>
          </p>
          <p>Ruangan {req.room_name || '-'} · {req.requester_name}</p>
        </KotakInfo>

        {/* Divisi external: IVP Sales internal sudah ter-mapping sejak request dibuat */}
        {isExternal && (
          <KotakInfo>
            Request dari divisi external <strong>{req.sales_division}</strong>. Cukup pilih <strong>Tim PTS</strong> yang menangani -
            IVP Sales internal untuk divisi ini sudah otomatis ter-mapping sejak request dibuat.
          </KotakInfo>
        )}

        {/* Lewat Supervisor - jalur UTAMA saat menyetujui, sama seperti Request Schedule */}
        {adaRute && (
          <KotakInfo nada="awas" judul="Rekomendasi: lewat Supervisor">
            <p className="mb-2">Supervisor yang dipilih menerima WA untuk menugaskan anggota timnya, atau mengerjakan sendiri.</p>
            <div className="space-y-2">
              <PilihPenugasan nilai={selectedSupervisorId} onUbah={v => { setSelectedSupervisorId(v); setFormErr(''); }} label="Supervisor" kosong="- Pilih Supervisor -"
                pilihan={supervisors.map(s => ({ v: s.id, l: s.full_name, ket: s.team_type }))} />
              <TombolSetujui onClick={handleRouteToSupervisor} disabled={routeSaving || !selectedSupervisorId} className="w-full">
                {routeSaving ? 'Memproses...' : 'Setujui & Teruskan ke Supervisor'}
              </TombolSetujui>
            </div>
          </KotakInfo>
        )}

        {/* Tugaskan ke Tim PTS */}
        {teamMembers.length === 0 ? (
          <KotakInfo>Tidak ada Team PTS tersedia.</KotakInfo>
        ) : (
          <PilihPenugasan nilai={selectedPTSId} onUbah={v => { setSelectedPTSId(v); setFormErr(''); }} wajib={!adaRute}
            label={adaRute ? 'Atau tugaskan langsung ke' : 'Tugaskan ke'} kosong="- Pilih anggota Team PTS -"
            pilihan={[
              { v: 'SELF', l: 'Saya kerjakan sendiri', grup: 'Saya' },
              ...anggotaLain.map(m => ({ v: m.id, l: m.full_name, ket: m.team_type, grup: 'Anggota Tim' })),
            ]} />
        )}

        <KotakInfo nada="baik">WA notifikasi otomatis dikirim ke <strong>Tim PTS</strong> yang ditugaskan (kecuali kamu sendiri).</KotakInfo>

        {formErr && <KotakInfo nada="bahaya">{formErr}</KotakInfo>}
      </div>
    </Modal>
  );
}
