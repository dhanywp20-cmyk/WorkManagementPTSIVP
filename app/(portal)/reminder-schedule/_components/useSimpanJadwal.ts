'use client';

/** useSimpanJadwal - dipecah dari app/(portal)/reminder-schedule/page.tsx (scripts/ekstrak-hook.mjs). Keadaan tetap milik komponen; hook dipanggil di posisi yang sama. */
import { Reminder, TeamUser, GuestUser, REVIEW_TRIGGER_CATEGORIES, formatDate, newBatchId, sendFonnteWA, REMINDER_FIELDS } from './shared';
import { supabase } from '@/lib/supabase';
import { adalahKategoriInsentif } from '@/lib/incentive-scheme';
import { normalkanNama } from '@/lib/kelompok-insentif';
import { idDariNama, tanpaIdentitas, cobaIdentitas } from '@/lib/identitas';
import { type ReminderSnapshot } from '@/lib/project-progress-sync';
import { appLink } from '@/lib/app-url';
import { bandingkan, ringkasPerubahan, pesanWAPerubahan } from '@/lib/admin-edit';
import { logAudit } from '@/lib/audit';
import { createNotification } from '@/lib/notifications';

export interface SimpanJadwalKonteks {
  bulkTarget: "none" | "ivp" | "mvi" | "ump";
  currentUser: TeamUser | null;
  editingReminder: Reminder | null;
  emptyForm: Omit<Reminder, "id" | "created_at" | "created_by" | "wa_sent_h1">;
  extraDates: string[];
  fetchRemindersQuiet: (user?: TeamUser | null) => Promise<void>;
  formData: Omit<Reminder, "id" | "created_at" | "created_by" | "wa_sent_h1">;
  guestUsers: GuestUser[];
  notify: (type: "success" | "error", msg: string) => void;
  progressTimelinePayload: () => { progress_start_date: string | null; progress_target_date: string | null; };
  proyekLamaTerpilih: Reminder[] | null;
  reminders: Reminder[];
  setBulkTarget: import("react").Dispatch<import("react").SetStateAction<"none" | "ivp" | "mvi" | "ump">>;
  setEditingReminder: import("react").Dispatch<import("react").SetStateAction<Reminder | null>>;
  setExtraDates: import("react").Dispatch<import("react").SetStateAction<string[]>>;
  setFormData: import("react").Dispatch<import("react").SetStateAction<Omit<Reminder, "id" | "created_at" | "created_by" | "wa_sent_h1">>>;
  setProyekLamaTerpilih: import("react").Dispatch<import("react").SetStateAction<Reminder[] | null>>;
  setSaving: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  setShowFormModal: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  setTanyaLanjutan: import("react").Dispatch<import("react").SetStateAction<{ nama: string; sebelumnya: Reminder[]; lanjut: (grup: string | null) => void; } | null>>;
  setView: import("react").Dispatch<import("react").SetStateAction<"list" | "form">>;
  syncNewRemindersToProgress: (rows: ReminderSnapshot[]) => Promise<void>;
  teamUsers: TeamUser[];
}

export function useSimpanJadwal(k: SimpanJadwalKonteks) {
  const { bulkTarget, currentUser, editingReminder, emptyForm, extraDates, fetchRemindersQuiet, formData, guestUsers, notify, progressTimelinePayload, proyekLamaTerpilih, reminders, setBulkTarget, setEditingReminder, setExtraDates, setFormData, setProyekLamaTerpilih, setSaving, setShowFormModal, setTanyaLanjutan, setView, syncNewRemindersToProgress, teamUsers } = k;
  const resolveGrupInsentif = async (sumber: Reminder[]): Promise<string> => {
    const adaGrup = sumber.find(r => r.incentive_group_id)?.incentive_group_id;
    const grup = adaGrup ?? crypto.randomUUID();
    if (!adaGrup) {
      const idLama = sumber.map(r => r.id);
      //  Diperiksa: baris LAMA harus benar-benar ikut ditandai grup baru ini,
      //  atau ia tetap berdiri sendiri di Incentive PTS sementara jadwal baru
      //  yang memakai `grup` ini justru terhitung sebagai proyek terpisah -
      //  persis pola "dua pool insentif untuk satu proyek" yang jadi alasan
      //  seluruh berkas lib/kelompok-insentif.ts ditulis.
      const { data: terubah, error } = await supabase.from('reminders')
        .update({ incentive_group_id: grup }).in('id', idLama).select('id');
      if (error || !terubah || terubah.length < idLama.length) {
        notify('error', 'Sebagian jadwal lama gagal ditandai satu proyek yang sama - periksa manual di Incentive PTS.');
      }
    }
    return grup;
  };

  const cariProyekSerupa = (nama: string, kategori: string): Reminder[] => {
    if (!adalahKategoriInsentif(kategori)) return [];
    const n = normalkanNama(nama);
    if (!n) return [];
    return reminders.filter(r =>
      normalkanNama(r.project_name) === n
      && adalahKategoriInsentif(r.category)
      && r.status !== 'cancelled');
  };

  const handleSave = async (argGrup?: string | null) => {
    /*
      Hanya string atau null yang diterima sebagai penanda kelompok.

      Fungsi ini dipasang sebagai onSubmit, dan onSubmit dipanggil tanpa
      argumen - tapi cukup seseorang kelak menyambungkannya ke onClick, dan
      objek MouseEvent akan masuk ke sini lalu tertulis ke kolom yang
      menentukan pembagian uang. Penyaring ini murah; kekeliruannya tidak.
    */
    const grupInsentif = (typeof argGrup === 'string' || argGrup === null) ? argGrup : undefined;

    if (!formData.project_name.trim())            { notify('error', 'Nama project wajib diisi!');  return; }
    if (bulkTarget === 'none' && !formData.assigned_to) { notify('error', 'Pilih anggota team!'); return; }
    if (!formData.due_date)                { notify('error', 'Tanggal wajib diisi!');          return; }
    if (!formData.address.trim()) { notify('error', 'Lokasi Project wajib diisi!');  return; }

    const isTriggerCat = (REVIEW_TRIGGER_CATEGORIES as readonly string[]).includes(formData.category);
    if (!formData.sales_name?.trim()) {
      notify('error', 'Pilih Sales wajib diisi!');
      return;
    }
    if (isTriggerCat && !formData.sales_name?.trim()) {
      notify('error', `Kategori "${formData.category}" memerlukan pilihan Guest / Sales untuk form review!`);
      return;
    }

    // Identitas uuid dicatat berdampingan dengan namanya - uuid menjawab SIAPA,
    // nama tetap menjawab TERCATAT SEBAGAI SIAPA. Sales dicari di antara akun
    // guest maupun akun tim, karena jadwal bisa diatasnamakan keduanya. Kalau
    // namanya dimiliki lebih dari satu akun, idDariNama sengaja menjawab null:
    // baris itu tetap bekerja lewat nama, persis seperti sebelum perubahan ini.
    const semuaOrang = [...guestUsers, ...teamUsers];
    const salesUserId = idDariNama(semuaOrang, formData.sales_name);

    /*
      Sebelum membuat jadwal baru: kalau proyek dengan nama sama sudah punya
      jadwal kategori insentif, tanyakan hubungannya. Pertanyaannya muncul
      SEKALI - grupInsentif yang sudah terisi (atau dijawab "terpisah") membuat
      alur ini lanjut tanpa bertanya lagi.

      TIDAK ditanyakan bila project-nya sudah dipilih lewat pencarian Lapis 4
      (proyekLamaTerpilih terisi) - saat itu hubungannya sudah dipastikan lewat
      pencarian, bukan ditebak dari kecocokan nama. Menanyakannya lagi hanya
      mengulang jawaban yang sudah diberikan. Kelompoknya tetap diresolve di
      sini, bukan saat menekan "OK, Isi Form" - supaya kategori pekerjaan yang
      BARU (yang baru diketahui sekarang, setelah form diisi) yang menentukan
      apakah penggabungan ini relevan sama sekali.
    */
    if (!editingReminder && grupInsentif === undefined) {
      if (proyekLamaTerpilih) {
        const relevan = adalahKategoriInsentif(formData.category)
          ? proyekLamaTerpilih.filter(r => adalahKategoriInsentif(r.category))
          : [];
        const grup = relevan.length > 0 ? await resolveGrupInsentif([...relevan]) : null;
        void handleSave(grup);
        return;
      }
      const serupa = cariProyekSerupa(formData.project_name, formData.category);
      if (serupa.length > 0) {
        setTanyaLanjutan({
          nama: formData.project_name.trim(),
          sebelumnya: serupa,
          lanjut: (grup) => { setTanyaLanjutan(null); void handleSave(grup); },
        });
        return;
      }
    }

    // Multi-tanggal: satu pengiriman untuk beberapa hari sekaligus. Berlaku
    // saat MEMBUAT maupun MENYUNTING - lihat rekonsiliasi tanggal di bawah.
    const allDates: string[] = Array.from(
      new Set([formData.due_date, ...extraDates].filter(Boolean))).sort();
    // Grup semua baris dari 1 submission multi-tanggal - supaya Schedule List
    // menampilkannya sbg 1 baris (bukan N baris identik per tanggal).
    const batchId = (!editingReminder && allDates.length > 1) ? newBatchId() : null;
    const jadwalLine = allDates.length > 1
      ? `🕐 *Jadwal (${allDates.length} hari):* ${allDates.map(d => formatDate(d)).join(', ')}${formData.due_time ? ' · ' + formData.due_time : ''}`
      : `🕐 Jadwal: *${formatDate(formData.due_date)}${formData.due_time ? ' · ' + formData.due_time : ''}*`;

    // BULK ASSIGN
    if (bulkTarget !== 'none') {
      const teamTypeMap: Record<string, string> = { ivp: 'Team PTS IVP', mvi: 'Team PTS MVI', ump: 'Team PTS UMP' };
      const bulkLabelMap: Record<string, string> = { ivp: 'PTS IVP', mvi: 'PTS MVI', ump: 'PTS UMP' };
      // Assign massal "Semua PTS ..." tidak pernah menyertakan Manager.
      const targets = teamUsers.filter(u => u.team_type === teamTypeMap[bulkTarget] && u.jabatan !== 'Manager');
      if (targets.length === 0) { notify('error', 'Tidak ada anggota team yang ditemukan!'); return; }
      setSaving(true);
      const payloads = targets.flatMap(u => allDates.map(d => ({
        ...formData,
        due_date: d,
        ...progressTimelinePayload(),
        batch_id: batchId,
        assigned_to: u.username,
        assign_name: u.full_name,
        sales_user_id: salesUserId,
        assign_user_id: u.id,
        created_by: currentUser?.username ?? 'system',
        ...progressTimelinePayload(),
      })));
      // .select() supaya id reminder yang baru dibuat bisa ditautkan ke draft
      // Project Progress. Tanpa id, penautan & pencegahan duplikat mustahil.
      const { data: bulkRows, error: bulkErr } = await cobaIdentitas(async pakaiUuid =>
        await supabase.from('reminders').insert(pakaiUuid ? payloads : payloads.map(tanpaIdentitas))
          .select('id, project_name, address, sales_name, sales_division, assign_name, due_date, category, progress_start_date, progress_target_date'));
      if (bulkErr) { notify('error', 'Gagal menyimpan: ' + bulkErr.message); setSaving(false); return; }
      void syncNewRemindersToProgress((bulkRows ?? []) as ReminderSnapshot[]);
      notify('success', `${payloads.length} reminder dibuat untuk Tim ${bulkLabelMap[bulkTarget]}${allDates.length > 1 ? ` (${allDates.length} hari)` : ''}!`);
      for (const u of targets) {
        if (u.phone_number) {
          const msg =
            `🗓️ *JADWAL BARU — PTS IVP*\n\n` +
            `Halo *${u.full_name}*, kamu mendapat jadwal baru:\n\n` +
            `*Nama Project: ${formData.project_name}*\n` +
            `*Deskripsi: ${formData.description}*\n` +
            `📦 *Product: ${formData.product}*\n` +
            `🏷️ Kategori: ${formData.category}\n` +
            `📍 Lokasi: ${formData.address || '-'}\n` +
            `👤 Sales: ${formData.sales_name}${formData.sales_division ? ' - ' + formData.sales_division : ''}\n` +
            `${jadwalLine}\n` +
            (formData.pic_name  ? `🙋 PIC: ${formData.pic_name}${formData.pic_phone ? ' - ' + formData.pic_phone : ''}\n\n` : '') +
            (formData.notes     ? `📝 Catatan: ${formData.notes}\n\n` : '') +
            `-\n` +
            `Link Dashboard: ${appLink()}\n` +
            `jangan lupa peralatan & Semangat💪🏼`;
          await sendFonnteWA(u.phone_number, msg, { reminderType: 'new_schedule' }, 'reminder.assigned');
        }
      }
      setSaving(false);
      setShowFormModal(false);
      setView('list');
      setEditingReminder(null);
      setFormData(emptyForm);
      setBulkTarget('none');
      setExtraDates([]);
      fetchRemindersQuiet();
      return;
    }
    // SINGLE ASSIGN

    const assignee = teamUsers.find(u => u.username === formData.assigned_to);

    setSaving(true);
    let error: { message: string } | null = null;
    /** Baris yang benar-benar tersimpan - dipakai mencatat riwayat pembuatan. */
    let barisBaru: { id: string; project_name: string | null }[] = [];
    // Tujuan "SUP::id::nama" berarti dialihkan ke Supervisor, bukan ke anggota
    // tim. Bedanya: assigned_to dikosongkan dan reminder masuk kembali ke tahap
    // supervisor_assign, sehingga Supervisor itulah yang menentukan siapa yang
    // mengerjakan - persis seperti alur normalnya, bukan jalur pintas.
    const alihKeSupervisor = formData.assigned_to.startsWith('SUP::')
      ? formData.assigned_to.split('::')
      : null;

    if (editingReminder) {
      // Saat menyunting, uuid lama TIDAK boleh ditimpa null hanya karena nama
      // yang sama itu ambigu. Kalau namanya tidak berubah, uuid yang sudah
      // tercatat dipertahankan - ia hasil penetapan sebelumnya, dan menebak
      // ulang dari nama justru membuang keterangan yang lebih pasti.
      const namaSalesTetap = (formData.sales_name ?? '').trim() === (editingReminder.sales_name ?? '').trim();
      // progressTimelinePayload() WAJIB ikut di jalur sunting, bukan cuma di
      // jalur buat-baru. Saat form dibuka, progress_start_date/target diisi
      // `r.xxx ?? ''` - jadi reminder yang tanggal progress-nya NULL memberi
      // string kosong, dan string kosong dikirim apa adanya ke kolom bertipe
      // date: "invalid input syntax for type date". Seluruh penyuntingan gagal,
      // termasuk yang tidak menyentuh tanggal sama sekali.
      // Fungsi ini juga yang mengosongkan tanggal ketika kategorinya berganti
      // ke kategori yang bukan pemicu Project Progress.
      const payload = { ...formData, ...progressTimelinePayload(),
        assign_name: assignee?.full_name ?? formData.assigned_to,
        sales_user_id: namaSalesTetap ? (editingReminder.sales_user_id ?? salesUserId) : salesUserId,
        assign_user_id: assignee?.id ?? null,
        // created_by TIDAK ditimpa. Ia menjawab siapa yang MEMBUAT jadwal ini,
        // dan menyuntingnya tidak mengubah jawaban itu. Sebelumnya kolom ini
        // diisi ulang dengan penyunting, sehingga satu suntingan admin
        // menghapus jejak pembuat aslinya - sekaligus, bila kelak RLS
        // dinyalakan untuk reminders, memindahkan kepemilikan barisnya.
        created_by: editingReminder.created_by ?? currentUser?.username ?? 'system',
        updated_at: new Date().toISOString() };
      if (alihKeSupervisor) {
        const [, supId] = alihKeSupervisor;
        Object.assign(payload, {
          assigned_to: '', assign_name: '', assign_user_id: null,
          routing_status: 'supervisor_assign', assigned_supervisor_id: supId,
        });
      }
      /*
        Menyunting jadwal multi-tanggal harus mengenai SELURUH tanggalnya.

        Dulu pembaruan dipatok .eq('id', editingReminder.id), jadi menyunting
        jadwal lima hari hanya mengubah satu baris - empat hari lainnya tetap
        membawa produk, kategori, dan penangan yang lama. Daftar menampilkannya
        sebagai satu baris, jadi ketidakcocokan itu tidak terlihat sampai
        seseorang membuka detailnya.

        due_date SENGAJA dikeluarkan dari pembaruan bersama: tiap baris punya
        tanggalnya sendiri, dan menimpanya dengan satu nilai akan meruntuhkan
        seluruh jadwal ke satu hari.
      */
      const sebatchLama = editingReminder.batch_id
        ? reminders.filter(x => x.batch_id === editingReminder.batch_id)
        : [editingReminder];
      const barisLama = [...sebatchLama].sort((a, b) => (a.due_date ?? '').localeCompare(b.due_date ?? ''));
      const { due_date: _tanggalBersama, ...payloadBersama } = payload as Record<string, unknown>;

      // Jadwal sehari yang kini jadi berhari-hari perlu batch_id; yang sudah
      // punya tetap memakai miliknya supaya tautan lama tidak putus.
      const batchSunting = allDates.length > 1
        ? (editingReminder.batch_id ?? newBatchId())
        : editingReminder.batch_id ?? null;

      /*
        Baris lama DIPAKAI ULANG untuk tanggal baru, tidak dihapus lalu dibuat
        lagi. Id baris inilah yang ditunjuk tickets.reminder_id, form_reviews,
        dan tahapan insentif - membuat baris baru berarti memutus semuanya
        hanya karena tanggalnya digeser.
      */
      const jumlahDipakai = Math.min(barisLama.length, allDates.length);
      const galatSunting: string[] = [];
      for (let i = 0; i < jumlahDipakai; i++) {
        const r = await cobaIdentitas(async pakaiUuid => {
          const isi = { ...payloadBersama, due_date: allDates[i], batch_id: batchSunting };
          return await supabase.from('reminders')
            .update(pakaiUuid ? isi : tanpaIdentitas(isi as typeof payload))
            .eq('id', barisLama[i].id);
        });
        if (r.error) galatSunting.push(r.error.message);
      }
      // Tanggal berkurang: baris sisanya dibuang.
      const dibuang = barisLama.slice(jumlahDipakai).map(r => r.id);
      if (dibuang.length > 0) {
        //  select('id') supaya RLS yang diam-diam menolak sebagian baris
        //  (0 baris, tanpa galat) ikut terlihat - bukan hanya galat Postgres.
        const r = await supabase.from('reminders').delete().in('id', dibuang).select('id');
        if (r.error) galatSunting.push(r.error.message);
        else if ((r.data ?? []).length < dibuang.length) {
          galatSunting.push(`${dibuang.length - (r.data ?? []).length} jadwal lama gagal dihapus (tidak punya akses).`);
        }
      }
      // Tanggal bertambah: baris baru menyusul, tetap satu batch.
      if (allDates.length > barisLama.length) {
        const tambahan = allDates.slice(barisLama.length).map(d => ({
          ...payloadBersama, due_date: d, batch_id: batchSunting,
        }));
        const r = await cobaIdentitas(async pakaiUuid =>
          await supabase.from('reminders')
            .insert(pakaiUuid ? tambahan : tambahan.map(x => tanpaIdentitas(x as typeof payload))));
        if (r.error) galatSunting.push(r.error.message);
      }
      error = galatSunting.length > 0 ? { message: galatSunting[0] } : null;
    } else {
      const payloads = allDates.map(d => ({
        ...formData,
        due_date: d,
        ...progressTimelinePayload(),
        batch_id: batchId,
        // Hanya ditulis bila memang dijawab "kelanjutan" - kolomnya boleh NULL,
        // dan NULL di sini berarti "berdiri sendiri", bukan "belum tahu".
        ...(grupInsentif ? { incentive_group_id: grupInsentif } : {}),
        assign_name: assignee?.full_name ?? formData.assigned_to,
        sales_user_id: salesUserId,
        assign_user_id: assignee?.id ?? null,
        created_by: currentUser?.username ?? 'system',
        // Dibuat langsung ke Supervisor: jadwal masuk ke tahap supervisor_assign
        // dengan pelaksana masih kosong, jadi Supervisor itu yang menentukan
        // siapa yang mengerjakan - alurnya sama dengan ticket Troubleshooting.
        ...(alihKeSupervisor ? {
          assigned_to: '', assign_name: '', assign_user_id: null,
          routing_status: 'supervisor_assign',
          assigned_supervisor_id: alihKeSupervisor[1],
        } : {}),
      }));
      const insRes = await cobaIdentitas(async pakaiUuid =>
        await supabase.from('reminders').insert(pakaiUuid ? payloads : payloads.map(tanpaIdentitas))
          .select('id, project_name, address, sales_name, sales_division, assign_name, due_date, category, progress_start_date, progress_target_date'));
      error = insRes.error;
      barisBaru = (insRes.data ?? []) as { id: string; project_name: string | null }[];
      if (!insRes.error) void syncNewRemindersToProgress((insRes.data ?? []) as ReminderSnapshot[]);
    }

    if (error) {
      notify('error', 'Gagal menyimpan: ' + error.message);
      setSaving(false);
      return;
    }

    if (editingReminder) {
      // Catat APA yang berubah, bukan sekadar bahwa ada perubahan.
      // Saat dialihkan ke Supervisor, `assigned_to` dikeluarkan dari perbandingan:
      // yang tersimpan di database adalah string kosong (Supervisor-lah yang
      // menentukan pelaksana), bukan nilai dropdown-nya, dan tujuannya sudah
      // disebut di awal catatan. Membandingkannya hanya menghasilkan baris yang
      // mengulang - atau, kalau tidak diterjemahkan, membocorkan penanda internal.
      const bandingkanDengan = { ...(formData as unknown as Record<string, unknown>) };
      if (alihKeSupervisor) delete bandingkanDengan.assigned_to;
      const perubahanEdit = bandingkan(
        REMINDER_FIELDS,
        editingReminder as unknown as Record<string, unknown>,
        bandingkanDengan,
      );
      logAudit({
        user_id: currentUser?.id ?? '', user_name: currentUser?.full_name ?? '',
        action: 'update', module: 'reminder',
        target_id: editingReminder.id, target_name: formData.project_name,
        notes: alihKeSupervisor
          ? `Re-route ke Supervisor ${alihKeSupervisor[2]}${perubahanEdit.length ? ' | ' + ringkasPerubahan(perubahanEdit) : ''}`
          : (perubahanEdit.length ? ringkasPerubahan(perubahanEdit) : 'Disimpan tanpa perubahan'),
      }).catch(() => {});

      // Dialihkan ke Supervisor: yang perlu dikabari adalah Supervisor itu,
      // bukan assignee lama - assigned_to sudah dikosongkan di atas, jadi blok
      // WA di bawah tidak akan menemukan siapa pun untuk dikirimi.
      if (alihKeSupervisor) {
        const supUser = teamUsers.find(u => u.id === alihKeSupervisor[1]);
        if (supUser?.phone_number) {
          void sendFonnteWA(supUser.phone_number, pesanWAPerubahan({
            namaPenerima: supUser.full_name,
            namaPengubah: currentUser?.full_name ?? 'Admin',
            judulItem: formData.project_name,
            jenisItem: 'Jadwal',
            perubahan: perubahanEdit,
            reroute: { dari: editingReminder.assign_name ?? '', ke: supUser.full_name },
            tautan: appLink('/reminder-schedule'),
          }), undefined, 'reminder.updated');
        }
        if (supUser?.id) {
          void createNotification({
            user_id: supUser.id, type: 'reminder',
            title: '🔀 Jadwal dialihkan ke kamu',
            body: `${formData.project_name} — pilih anggota tim yang mengerjakan`,
            action_url: '/reminder-schedule', ref_id: editingReminder.id,
            created_by: currentUser?.full_name ?? 'Admin',
          });
        }
      }

      // Beri tahu yang menangani. Tanpa ini, koreksi tanggal atau alamat tidak
      // pernah sampai ke orang yang akan berangkat ke lokasi.
      // Badge in-app TETAP dikirim walau penanganya diri sendiri (mis. memilih
      // diri sendiri lewat dropdown assignee) - WA ke nomor sendiri tetap
      // dilewati karena tidak berguna.
      if (perubahanEdit.length > 0 && assignee?.id) {
        if (assignee.full_name === currentUser?.full_name) {
          void createNotification({
            user_id: assignee.id, type: 'reminder',
            title: '✏️ Jadwal kamu diperbarui',
            body: `${formData.project_name}`,
            action_url: '/reminder-schedule', ref_id: editingReminder.id,
            created_by: currentUser?.full_name ?? 'Admin',
          });
        } else if (assignee.phone_number) {
          void sendFonnteWA(
            assignee.phone_number,
            pesanWAPerubahan({
              namaPenerima: assignee.full_name ?? formData.assigned_to,
              namaPengubah: currentUser?.full_name ?? 'Admin',
              judulItem: formData.project_name,
              jenisItem: 'Jadwal',
              perubahan: perubahanEdit,
              reroute: null,
              tautan: appLink('/reminder-schedule'),
            }),
            undefined, 'reminder.updated',
          );
        }
      }
    } else {
      for (const row of barisBaru) {
        logAudit({
          user_id: currentUser?.id ?? '', user_name: currentUser?.full_name ?? '',
          action: 'create', module: 'reminder',
          target_id: row.id, target_name: row.project_name ?? formData.project_name,
          notes: `Dibuat langsung oleh admin — kategori ${formData.category}`,
        }).catch(() => {});
      }
    }
    notify('success', editingReminder ? 'Reminder diperbarui!' : (allDates.length > 1 ? `${allDates.length} reminder dibuat!` : 'Reminder ditambahkan!'));

    // Kirim WA notifikasi ke assignee saat reminder BARU dibuat
    // Dibuat langsung ke Supervisor: yang dikabari Supervisor-nya, bukan
    // pelaksana - pelaksananya memang belum ada, dia yang akan menentukan.
    if (!editingReminder && alihKeSupervisor) {
      const supUser = teamUsers.find(u => u.id === alihKeSupervisor[1]);
      if (supUser?.phone_number) {
        void sendFonnteWA(supUser.phone_number, [
          '🎯 *Jadwal Perlu Di-assign ke Tim*',
          '━━━━━━━━━━━━━━━━━━',
          `Halo *${supUser.full_name}*, kamu dapat jadwal dari *${currentUser?.full_name ?? 'Admin'}*:`,
          `📌 *Project :* ${formData.project_name}`,
          `🏷️ *Kategori:* ${formData.category}`,
          `📍 *Lokasi  :* ${formData.address || '-'}`,
          `🗓️ *Tanggal :* ${formatDate(formData.due_date)} ${formData.due_time || ''}`,
          '━━━━━━━━━━━━━━━━━━',
          'Mohon tentukan anggota tim yang mengerjakan.',
          `🔗 ${appLink('/reminder-schedule')}`,
        ].join('\n'), undefined, 'reminder.routed_supervisor');
      }
      if (supUser?.id) {
        void createNotification({
          user_id: supUser.id, type: 'reminder',
          title: '🎯 Jadwal perlu kamu assign',
          body: `${formData.project_name} — dari ${currentUser?.full_name ?? 'Admin'}`,
          action_url: '/reminder-schedule',
          //  ref_id membuat notifikasi ini membuka jadwalnya langsung
          //  (?open=<id>), bukan cuma daftar - lihat deep-link di page ini.
          ref_id: barisBaru[0]?.id,
          created_by: currentUser?.full_name ?? 'Admin',
        });
      }
    }

    if (!editingReminder && assignee?.phone_number) {
      const assigneeName = assignee.full_name ?? formData.assigned_to;
      const msg =
        `🗓️ *JADWAL BARU — PTS IVP*\n\n` +
        `Halo *${assigneeName}*, kamu mendapat jadwal baru:\n\n` +
        `*Nama Project: ${formData.project_name}*\n` +
        `*Deskripsi: ${formData.description}*\n` +
        `📦 *Product: ${formData.product}*\n` +
        `🏷️ Kategori: ${formData.category}\n` +
        `📍 Lokasi: ${formData.address || '-'}\n` +
        `👤 Sales: ${formData.sales_name}${formData.sales_division ? ' - ' + formData.sales_division : ''}\n` +
        `${jadwalLine}\n` +
        (formData.pic_name  ? `🙋 PIC: ${formData.pic_name}${formData.pic_phone ? ' - ' + formData.pic_phone : ''}\n\n`    : '') +
        (formData.notes     ? `📝 Catatan: ${formData.notes}\n\n`    : '') +
        `-\n` +
       `Link Dashboard: ${appLink()}\n` +
        `jangan lupa peralatan & Semangat💪🏼`;

      //  Telegram TIDAK dipanggil di sini lagi: sejak lib/wa.ts mengirim ke
      //  dua kanal sekaligus, memanggilnya terpisah di sini membuat orang yang
      //  sama menerima pesan Telegram dua kali untuk satu jadwal.
      const waResult = await sendFonnteWA(assignee.phone_number, msg, { reminderType: 'new_schedule' }, 'reminder.assigned');
      if (waResult.ok) notify('success', `WA notifikasi terkirim ke ${assigneeName}!`);
    }

    setSaving(false);
    setShowFormModal(false);
    setView('list');
    setEditingReminder(null);
    setFormData(emptyForm);
    setExtraDates([]);
    setProyekLamaTerpilih(null);
    fetchRemindersQuiet();
  };
  return { resolveGrupInsentif, cariProyekSerupa, handleSave };
}
