'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase, User, Material, Question, QuizSession, fmtDate, SearchInput, AppDialog, DialogState, BtnDelete } from './shared';
import { logAudit } from '@/lib/audit';
import { ModalPortal } from '@/components/shared';
import { Ikon, IkonTeks } from '@/components/shared/Ikon';
import { ModalAlihkanSesi } from './sesi/ModalAlihkanSesi';
import { DaftarSesi } from './sesi/DaftarSesi';
import { FormSesi } from './sesi/FormSesi';

export function SessionsPage({ user, onViewResults }: { user: User; onViewResults?: (sessionId: string) => void }) {
  const [sessions, setSessions] = useState<QuizSession[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [teamUsers, setTeamUsers] = useState<User[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    session_name: '', material_id: '', batch_filter: '',
    question_count: 10, timer_minutes: 30, passing_grade: 70,
    allow_retake: true, acak_soal: false, target_mode: 'all' as 'all' | 'role' | 'user' | 'division',
    target_roles: [] as string[],
    target_user_ids: [] as string[],
    target_divisions: [] as string[],
    open_at: '', close_at: '',
    session_type: 'abcd' as 'abcd' | 'essay',
  });
  const [saving, setSaving] = useState(false);
  // Pencarian target penerima. Daftar anggota memuat seluruh akun (74 dan terus
  // bertambah); tanpa penyaring, memilih satu orang berarti menggulir kotak
  // setinggi 13rem sampai ketemu.
  const [cariAnggota, setCariAnggota] = useState('');
  const [cariDivisi, setCariDivisi]   = useState('');
  /*
    Pencarian untuk modal Assign Ulang dipisah dari form Buat Sesi di atas.
    Keduanya memilih dari daftar yang sama, tapi berbagi satu kotak pencarian
    berarti membuka Assign Ulang menampilkan daftar yang sudah tersaring oleh
    kata kunci yang diketik di layar lain - anggota yang "hilang" tanpa
    penjelasan, padahal ia hanya tersaring.
  */
  const [cariAnggotaUlang, setCariAnggotaUlang] = useState('');
  const [cariDivisiUlang, setCariDivisiUlang]   = useState('');
  const [search, setSearch] = useState('');
  const [dialog, setDialog] = useState<DialogState>(null);

  // Re-Assign (assign quiz ke target berbeda tanpa buat quiz baru)
  const [showReassign, setShowReassign] = useState(false);
  const [reassignSource, setReassignSource] = useState<QuizSession | null>(null);
  const [reassignForm, setReassignForm] = useState({
    session_name  : '',
    timer_minutes : 30,
    passing_grade : 70,
    allow_retake  : true,
    acak_soal     : false,
    target_mode   : 'all' as 'all' | 'role' | 'user' | 'division',
    target_roles  : [] as string[],
    target_user_ids : [] as string[],
    target_divisions: [] as string[],
    open_at  : '',
    close_at : '',
  });
  const [reassigning, setReassigning] = useState(false);

  /**
   * Berapa orang sudah MEMULAI tiap sesi, dan berapa yang sudah submit.
   *
   * "Memulai" = punya baris lc_quiz_attempts (dibuat saat quiz dibuka), submit
   * atau belum. Dua angka ini beda pertanyaan: yang pertama menjawab "sudah
   * berapa orang yang mengaksesnya", yang kedua "berapa yang selesai". Tanpa
   * yang pertama, sesi yang baru dibagikan terlihat sama persis dengan sesi
   * yang tidak dibuka siapa pun.
   */
  const [progresSesi, setProgresSesi] = useState<Record<string, { mulai: number; submit: number }>>({});

  const load = useCallback(async () => {
    const [{ data: s }, { data: m }, { data: q }, { data: u }, { data: att }] = await Promise.all([
      supabase.from('lc_quiz_sessions').select('*').order('created_at', { ascending: false }),
      supabase.from('lc_materials').select('*').order('materi_name'),
      supabase.from('lc_questions').select('id, material_id, difficulty, batch_name, question_type'),
      supabase.from('users').select('id, full_name, username, role, jabatan, sales_division').order('full_name'),
      supabase.from('lc_quiz_attempts').select('quiz_session_id, user_id, is_submitted'),
    ]);
    setSessions((s as QuizSession[]) ?? []);
    setMaterials(m ?? []);
    setQuestions(q ?? []);
    setTeamUsers((u ?? []) as User[]);

    //  Dihitung per ORANG, bukan per baris attempt: satu peserta yang mengulang
    //  quiz 3x tetap satu orang yang mengaksesnya.
    type BarisAtt = { quiz_session_id: string; user_id: string; is_submitted: boolean };
    const mulai: Record<string, Set<string>> = {};
    const submit: Record<string, Set<string>> = {};
    for (const a of ((att ?? []) as BarisAtt[])) {
      (mulai[a.quiz_session_id] ??= new Set()).add(a.user_id);
      if (a.is_submitted) (submit[a.quiz_session_id] ??= new Set()).add(a.user_id);
    }
    const rekap: Record<string, { mulai: number; submit: number }> = {};
    for (const id of Object.keys(mulai)) {
      rekap[id] = { mulai: mulai[id].size, submit: submit[id]?.size ?? 0 };
    }
    setProgresSesi(rekap);
  }, []);
  useEffect(() => { load(); }, [load]);

  const uniqueRoles = [...new Set(teamUsers.map(u => (u.role ?? '').toLowerCase()).filter(Boolean))].sort();

  const roleLabel: Record<string, string> = {
    admin: '🔑 Admin', superadmin: '👑 Super Admin',
    team: '👥 Team', marketing: '📣 Marketing', guest: '👤 Guest',
  };

  const toggleTargetUser = (uid: string) => {
    setForm(p => ({
      ...p,
      target_user_ids: p.target_user_ids.includes(uid)
        ? p.target_user_ids.filter(id => id !== uid)
        : [...p.target_user_ids, uid],
    }));
  };

  const toggleTargetRole = (role: string) => {
    setForm(p => ({
      ...p,
      target_roles: p.target_roles.includes(role)
        ? p.target_roles.filter(r => r !== role)
        : [...p.target_roles, role],
    }));
  };

  const toggleTargetDivision = (div: string) => {
    setForm(p => ({
      ...p,
      target_divisions: p.target_divisions.includes(div)
        ? p.target_divisions.filter(d => d !== div)
        : [...p.target_divisions, div],
    }));
  };

  const uniqueDivisions = [...new Set(teamUsers.map(u => (u as any).sales_division).filter(Boolean))].sort();

  const handleCreate = async () => {
    if (!form.session_name.trim()) { setDialog({ type: 'error', message: 'Nama sesi wajib diisi!' }); return; }
    if (!form.material_id) { setDialog({ type: 'error', message: 'Pilih materi!' }); return; }
    if (form.target_mode === 'role' && form.target_roles.length === 0) { setDialog({ type: 'error', message: 'Pilih minimal 1 role!' }); return; }
    if (form.target_mode === 'user' && form.target_user_ids.length === 0) { setDialog({ type: 'error', message: 'Pilih minimal 1 anggota!' }); return; }
    if (form.target_mode === 'division' && form.target_divisions.length === 0) { setDialog({ type: 'error', message: 'Pilih minimal 1 sales division!' }); return; }
    if (form.open_at && form.close_at && new Date(form.open_at) >= new Date(form.close_at)) {
      setDialog({ type: 'error', message: 'Waktu tutup harus setelah waktu buka!' }); return;
    }
    const mat = materials.find(m => m.id === form.material_id);
    const pool = questions.filter(q =>
      q.material_id === form.material_id &&
      (!form.batch_filter || (q as any).batch_name === form.batch_filter) &&
      // Sesi essay hanya boleh berisi soal essay, sesi ABCD hanya boleh berisi soal ABCD
      ((q as any).question_type ?? 'abcd') === form.session_type
    );
    if (pool.length < form.question_count) {
      const batchInfo = form.batch_filter ? ` di grup "${form.batch_filter}"` : '';
      const typeLabel = form.session_type === 'essay' ? 'soal essay' : 'soal ABCD';
      setDialog({ type: 'error', message: `Hanya ada ${pool.length} ${typeLabel}${batchInfo}. Kurangi jumlah soal atau tambah soal ${typeLabel} dulu.` }); return;
    }
    const shuffled = [...pool].sort(() => Math.random() - 0.5).slice(0, form.question_count);
    let resolvedTargetIds: string[] | null = null;
    if (form.target_mode === 'role') {
      resolvedTargetIds = teamUsers
        .filter(u => form.target_roles.includes((u.role ?? '').toLowerCase()))
        .map(u => u.id);
    } else if (form.target_mode === 'user') {
      resolvedTargetIds = form.target_user_ids;
    } else if (form.target_mode === 'division') {
      resolvedTargetIds = teamUsers
        .filter(u => form.target_divisions.includes((u as any).sales_division ?? ''))
        .map(u => u.id);
    }
    setSaving(true);
    const { error } = await supabase.from('lc_quiz_sessions').insert([{
      session_name: form.session_name, material_id: form.material_id,
      materi_name: form.batch_filter ? `${mat?.materi_name ?? ''} — ${form.batch_filter}` : (mat?.materi_name ?? ''),
      question_ids: shuffled.map(q => q.id), question_count: form.question_count,
      timer_minutes: form.timer_minutes || null, passing_grade: form.passing_grade,
      allow_retake: form.allow_retake, acak_soal: form.acak_soal, is_active: true, created_by: user.id,
      target_user_ids: resolvedTargetIds,
      open_at: form.open_at ? new Date(form.open_at).toISOString() : null,
      close_at: form.close_at ? new Date(form.close_at).toISOString() : null,
      scheduled_at: form.open_at ? new Date(form.open_at).toISOString() : null,
      session_type: form.session_type,
    }]);
    setSaving(false);
    if (error) { setDialog({ type: 'error', message: 'Error: ' + error.message }); return; }
    setShowForm(false);
    setForm({ session_name: '', material_id: '', batch_filter: '', question_count: 10, timer_minutes: 30, passing_grade: 70, allow_retake: true, acak_soal: false, target_mode: 'all', target_roles: [], target_user_ids: [], target_divisions: [], open_at: '', close_at: '', session_type: 'abcd' });
    load();
    setDialog({ type: 'success', message: 'Sesi quiz berhasil dibuat!' });
  };

  const toggleActive = async (id: string, current: boolean) => {
    //  Diperiksa: kalau ditolak diam-diam, sesi yang admin kira sudah
    //  dinonaktifkan tetap aktif dan peserta masih bisa mengerjakannya.
    const { data, error } = await supabase.from('lc_quiz_sessions').update({ is_active: !current }).eq('id', id).select('id');
    if (error || !data || data.length === 0) {
      setDialog({ type: 'error', message: 'Gagal mengubah status sesi.' });
      return;
    }
    load();
  };

  // Duplicate an existing session - re-sends the same quiz to the same targets
  const handleResend = (session: QuizSession) => {
    setDialog({
      type: 'confirm',
      title: '🔄 Kirim Ulang Sesi Quiz',
      message: `Buat salinan baru dari "${session.session_name}" dengan pengaturan yang sama? Sesi baru akan langsung aktif sehingga peserta dapat mengerjakan kembali.`,
      confirmLabel: 'Kirim Ulang',
      onConfirm: async () => {
        const { error } = await supabase.from('lc_quiz_sessions').insert([{
          session_name    : session.session_name + ' (Ulang)',
          material_id     : session.material_id,
          materi_name     : session.materi_name,
          question_ids    : session.question_ids ?? [],
          question_count  : session.question_count,
          timer_minutes   : session.timer_minutes,
          passing_grade   : session.passing_grade,
          allow_retake    : session.allow_retake,
          acak_soal       : session.acak_soal ?? false,
          is_active       : true,
          created_by      : user.id,
          target_user_ids : session.target_user_ids ?? null,
          session_type    : session.session_type ?? 'abcd',
        }]);
        if (error) {
          setDialog({ type: 'error', title: 'Gagal', message: 'Gagal menduplikasi sesi: ' + error.message });
          return;
        }
        load();
        setDialog({ type: 'success', message: 'Sesi berhasil dikirim ulang dan sudah aktif!' });
      },
    });
  };

  // Open re-assign modal - pre-fill from source session
  const openReassign = (session: QuizSession) => {
    setReassignSource(session);
    setReassignForm({
      session_name   : session.session_name,
      timer_minutes  : session.timer_minutes ?? 30,
      passing_grade  : session.passing_grade,
      allow_retake   : session.allow_retake,
      acak_soal      : session.acak_soal ?? false,
      target_mode    : 'all',
      target_roles   : [],
      target_user_ids: [],
      target_divisions: [],
      open_at  : '',
      close_at : '',
    });
    // Kata kunci dari pembukaan sebelumnya ikut dikosongkan bersama pilihannya.
    // Kalau tidak, modal terbuka dengan daftar yang sudah tersaring tanpa ada
    // yang mengetik apa pun - dan anggota yang tidak muncul akan dikira tidak
    // terdaftar, bukan tersaring.
    setCariAnggotaUlang(''); setCariDivisiUlang('');
    setShowReassign(true);
  };

  // Confirm re-assign - creates a new session row with new targets
  const handleReassign = async () => {
    if (!reassignSource) return;
    if (!reassignForm.session_name.trim()) { setDialog({ type: 'error', message: 'Nama sesi wajib diisi!' }); return; }
    if (reassignForm.target_mode === 'role'     && reassignForm.target_roles.length     === 0) { setDialog({ type: 'error', message: 'Pilih minimal 1 role!' }); return; }
    if (reassignForm.target_mode === 'user'     && reassignForm.target_user_ids.length  === 0) { setDialog({ type: 'error', message: 'Pilih minimal 1 anggota!' }); return; }
    if (reassignForm.target_mode === 'division' && reassignForm.target_divisions.length === 0) { setDialog({ type: 'error', message: 'Pilih minimal 1 divisi!' }); return; }
    if (reassignForm.open_at && reassignForm.close_at && new Date(reassignForm.open_at) >= new Date(reassignForm.close_at)) {
      setDialog({ type: 'error', message: 'Waktu tutup harus setelah waktu buka!' }); return;
    }
    let resolvedTargetIds: string[] | null = null;
    if (reassignForm.target_mode === 'role') {
      resolvedTargetIds = teamUsers
        .filter(u => reassignForm.target_roles.includes((u.role ?? '').toLowerCase()))
        .map(u => u.id);
    } else if (reassignForm.target_mode === 'user') {
      resolvedTargetIds = reassignForm.target_user_ids;
    } else if (reassignForm.target_mode === 'division') {
      resolvedTargetIds = teamUsers
        .filter(u => reassignForm.target_divisions.includes((u as any).sales_division ?? ''))
        .map(u => u.id);
    }
    setReassigning(true);
    const { error } = await supabase.from('lc_quiz_sessions').insert([{
      session_name    : reassignForm.session_name.trim(),
      material_id     : reassignSource.material_id,
      materi_name     : reassignSource.materi_name,
      question_ids    : reassignSource.question_ids ?? [],
      question_count  : reassignSource.question_count,
      timer_minutes   : reassignForm.timer_minutes || null,
      passing_grade   : reassignForm.passing_grade,
      allow_retake    : reassignForm.allow_retake,
      acak_soal       : reassignForm.acak_soal,
      is_active       : true,
      created_by      : user.id,
      target_user_ids : resolvedTargetIds,
      open_at         : reassignForm.open_at  ? new Date(reassignForm.open_at).toISOString()  : null,
      close_at        : reassignForm.close_at ? new Date(reassignForm.close_at).toISOString() : null,
      scheduled_at    : reassignForm.open_at  ? new Date(reassignForm.open_at).toISOString()  : null,
      session_type    : reassignSource.session_type ?? 'abcd',
    }]);
    setReassigning(false);
    if (error) { setDialog({ type: 'error', message: 'Error: ' + error.message }); return; }
    setShowReassign(false);
    load();
    setDialog({ type: 'success', message: `Quiz "${reassignForm.session_name}" berhasil di-assign ke target baru! ✅` });
  };

  const handleDelete = (id: string) => {
    setDialog({
      type: 'confirm', title: 'Hapus Sesi Quiz',
      message: 'Sesi quiz dan semua jawaban akan dihapus permanen. Lanjutkan?',
      confirmLabel: 'Hapus',
      onConfirm: async () => {
        // 1. Ambil semua attempt yang terkait sesi ini
        const { data: attempts } = await supabase
          .from('lc_quiz_attempts')
          .select('id')
          .eq('quiz_session_id', id);

        // 2. Hapus jawaban untuk setiap attempt
        //  H8 (audit): dulu menghapus dari 'lc_answer_records' - tabel itu
        //  bukan tempat jawaban sungguhan disimpan (lihat runAiGrading di
        //  TeamPage.tsx, semuanya menulis/membaca 'lc_answers'). Akibatnya
        //  jawaban attempt yang dihapus TIDAK PERNAH ikut terhapus - baris
        //  yatim menumpuk tiap kali sesi quiz dihapus.
        if (attempts && attempts.length > 0) {
          const attemptIds = attempts.map((a: any) => a.id);
          await supabase.from('lc_answers').delete().in('attempt_id', attemptIds);
        }

        // 3. Hapus semua attempts terkait sesi ini
        await supabase.from('lc_quiz_attempts').delete().eq('quiz_session_id', id);

        // 4. Baru hapus sesi-nya
        const { error } = await supabase.from('lc_quiz_sessions').delete().eq('id', id);
        if (error) {
          setDialog({ type: 'error', title: 'Gagal Menghapus', message: 'Error: ' + error.message });
          return;
        }
        void logAudit({ user_id: user.id, user_name: user.full_name ?? '', action: 'delete', module: 'learning-center', target_id: id, notes: 'Hapus sesi quiz' });
        load();
      },
    });
  };

  const getSessionStatus = (s: QuizSession) => {
    const now = new Date();
    if (!s.is_active) return { label: '⭕ Non-aktif', cls: 'bg-slate-100 text-slate-500 border-slate-200' };
    if (s.open_at && new Date(s.open_at) > now) return { label: '⏳ Belum Dibuka', cls: 'bg-amber-100 text-amber-700 border-amber-200' };
    if (s.close_at && new Date(s.close_at) < now) return { label: '🔒 Ditutup', cls: 'bg-rose-100 text-rose-600 border-rose-200' };
    return { label: '🟢 Aktif', cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' };
  };

  const fmtDT = (d: string) =>
    new Date(d).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  const filtered = search
    ? sessions.filter(s =>
        s.session_name.toLowerCase().includes(search.toLowerCase()) ||
        s.materi_name.toLowerCase().includes(search.toLowerCase())
      )
    : sessions;

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 sm:px-8 py-3 sm:py-5 border-b border-slate-200 sticky top-0 z-10"
        style={{ background: '#ffffff' }}>
        <div>
          <h1 className="text-base sm:text-xl font-bold text-slate-800 tracking-tight"><IkonTeks nama="🎯" />Sesi Quiz</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">Buat & kelola sesi quiz untuk team</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <SearchInput value={search} onChange={setSearch} placeholder="Cari sesi..." />
          <button data-tulis onClick={() => setShowForm(true)}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl shadow transition-all flex items-center gap-2">
            + Buat Sesi Quiz
          </button>
        </div>
      </div>
      <div className="p-4 sm:p-8 space-y-6">
        <FormSesi
          cariAnggota={cariAnggota} cariDivisi={cariDivisi} form={form} handleCreate={handleCreate} materials={materials} questions={questions} roleLabel={roleLabel} saving={saving} setCariAnggota={setCariAnggota} setCariDivisi={setCariDivisi} setForm={setForm} setShowForm={setShowForm} showForm={showForm} teamUsers={teamUsers} toggleTargetDivision={toggleTargetDivision} toggleTargetRole={toggleTargetRole} toggleTargetUser={toggleTargetUser} uniqueDivisions={uniqueDivisions} uniqueRoles={uniqueRoles}
        />

        <DaftarSesi
          filtered={filtered} fmtDT={fmtDT} getSessionStatus={getSessionStatus} handleDelete={handleDelete} handleResend={handleResend} onViewResults={onViewResults} openReassign={openReassign} progresSesi={progresSesi} search={search} showForm={showForm} teamUsers={teamUsers} toggleActive={toggleActive}
        />
      </div>
      {/* ════ Assign Ulang Modal ════ */}
      <ModalAlihkanSesi
        cariAnggotaUlang={cariAnggotaUlang} cariDivisiUlang={cariDivisiUlang} handleReassign={handleReassign} reassignForm={reassignForm} reassignSource={reassignSource} reassigning={reassigning} roleLabel={roleLabel} setCariAnggotaUlang={setCariAnggotaUlang} setCariDivisiUlang={setCariDivisiUlang} setReassignForm={setReassignForm} setShowReassign={setShowReassign} showReassign={showReassign} teamUsers={teamUsers} uniqueDivisions={uniqueDivisions} uniqueRoles={uniqueRoles}
      />

      {dialog && <AppDialog dialog={dialog} onClose={() => setDialog(null)} />}
    </div>
  );
}
