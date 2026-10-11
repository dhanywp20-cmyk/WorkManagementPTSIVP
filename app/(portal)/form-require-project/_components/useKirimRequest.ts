'use client';

/** useKirimRequest - dipecah dari app/(portal)/form-require-project/page.tsx (scripts/ekstrak-hook.mjs). Keadaan tetap milik komponen; hook dipanggil di posisi yang sama. */
import { resolveBrandInternals, type Brand } from '@/lib/brand-routing';
import { supabase } from '@/lib/supabase';
import { idDariNama, tanpaIdentitas, cobaIdentitas } from '@/lib/identitas';
import { logAudit } from '@/lib/audit';
import { compressImage } from '@/lib/image-compress';
import { penerimaAdminBernomor } from '@/lib/penerima-admin';
import { appLink } from '@/lib/app-url';
import { User, RoomDetail, fetchWACCTargets, sendWANotif } from './shared';
import { InitialFormType } from './Modals';

export interface KirimRequestKonteks {
  boqFormFile: File | null;
  boqRoomMap: Record<string, File | null>;
  currentUser: User;
  dueDateForm: string;
  fetchRequests: () => Promise<void>;
  form: InitialFormType;
  initialForm: InitialFormType;
  isPTS: boolean;
  myIsInternalSales: boolean;
  notify: (type: "success" | "error" | "info", msg: string) => void;
  roomPhotoMap: Record<string, File[]>;
  rooms: RoomDetail[];
  salesGuestUsers: { id: string; full_name: string; username: string; sales_division?: string; is_internal_sales?: boolean; }[];
  setBoqFormFile: import("react").Dispatch<import("react").SetStateAction<File | null>>;
  setBoqRoomMap: import("react").Dispatch<import("react").SetStateAction<Record<string, File | null>>>;
  setDueDateForm: import("react").Dispatch<import("react").SetStateAction<string>>;
  setForm: import("react").Dispatch<import("react").SetStateAction<InitialFormType>>;
  setRoomPhotoMap: import("react").Dispatch<import("react").SetStateAction<Record<string, File[]>>>;
  setRooms: import("react").Dispatch<import("react").SetStateAction<RoomDetail[]>>;
  setShowNewFormModal: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  setSubmitting: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  setSurveyPhotos: import("react").Dispatch<import("react").SetStateAction<File[]>>;
  setSurveyPhotosPreviews: import("react").Dispatch<import("react").SetStateAction<string[]>>;
  surveyPhotos: File[];
  toStorageSafeName: (name: string) => string;
}

export function useKirimRequest(k: KirimRequestKonteks) {
  const { boqFormFile, boqRoomMap, currentUser, dueDateForm, fetchRequests, form, initialForm, isPTS, myIsInternalSales, notify, roomPhotoMap, rooms, salesGuestUsers, setBoqFormFile, setBoqRoomMap, setDueDateForm, setForm, setRoomPhotoMap, setRooms, setShowNewFormModal, setSubmitting, setSurveyPhotos, setSurveyPhotosPreviews, surveyPhotos, toStorageSafeName } = k;
  const handleSubmitForm = async () => {
    if (!form.project_name.trim()) { notify('error', 'Nama Project wajib diisi!'); return; }
    if (rooms.length === 0) {
      if (form.kebutuhan.length === 0 && !form.kebutuhan_other.trim()) { notify('error', 'Pilih minimal satu Kategori Kebutuhan!'); return; }
      if (form.solution_product.length === 0 && !form.solution_other.trim()) { notify('error', 'Pilih minimal satu Solution Product!'); return; }
    } else {
      const emptyRoomIdx = rooms.findIndex(r => r.kebutuhan.length === 0 && !r.kebutuhan_other.trim());
      if (emptyRoomIdx >= 0) { notify('error', `Pilih Kebutuhan untuk Ruangan ${emptyRoomIdx + 2}!`); return; }
    }
    if (!dueDateForm) { notify('error', 'Target Selesai wajib diisi!'); return; }
    setSubmitting(true);
    try {
      // Routing: Sales External wajib direview Sales Internal (division_ivp_mappings)
      // dulu, BARU Admin dapat notifikasi actionable. Sales Internal/Marketing yang
      // request utk kebutuhan sendiri (project direct ke user) TIDAK kena gerbang ini
      // - sama seperti Request Schedule. Admin/PTS yang submit langsung (isPTS) juga
      // skip gerbang (dia sudah tahu/putuskan sendiri).
      let routingStatus: 'internal_review' | 'admin_review' = 'admin_review';
      let internalSalesId: string | null = null;
      let internalSalesId2: string | null = null;   // reviewer kedua (IVP) saat brand BOTH
      const chosenBrand: Brand | null = (form.brand as Brand | undefined) ?? null;
      if (!isPTS) {
        const { data: freshSelf } = await supabase.from('users').select('is_internal_sales, team_type').eq('id', currentUser.id).maybeSingle();
        const isInternalOrMarketing = !!freshSelf?.is_internal_sales || freshSelf?.team_type === 'Marketing';
        const salesDivision = (currentUser.sales_division || form.sales_division || '').trim();
        if (!isInternalOrMarketing && salesDivision) {
          // Sales External: WAJIB pilih Marketing Brand + ada PIC Sales Internal utk brand itu.
          if (!chosenBrand) { notify('error', 'Pilih Marketing Brand dulu (MVI / IVP / Kedua Brand)!'); setSubmitting(false); return; }
          const rb = await resolveBrandInternals(salesDivision, chosenBrand);
          if (rb.missing.length > 0) { notify('error', `Divisi ${salesDivision} belum punya PIC Sales Internal untuk brand: ${rb.missing.join(' & ')}. Hubungi Admin untuk mapping dulu.`); setSubmitting(false); return; }
          routingStatus = 'internal_review';
          const primary = rb.mvi ?? rb.ivp;
          internalSalesId = primary?.id ?? null;
          if (chosenBrand === 'BOTH' && rb.mvi && rb.ivp && rb.mvi.id !== rb.ivp.id) internalSalesId2 = rb.ivp.id;
        }
      }
      const internalHandlers: { phone_number: string | null; full_name: string }[] = [];
      if (routingStatus === 'internal_review') {
        const ids = [internalSalesId, internalSalesId2].filter(Boolean) as string[];
        if (ids.length) {
          const { data: hs } = await supabase.from('users').select('full_name, phone_number').in('id', ids);
          (hs ?? []).forEach((h: any) => internalHandlers.push({ phone_number: h.phone_number, full_name: h.full_name }));
        }
      }
      const payload = {
        project_name: form.project_name.trim(), room_name: form.room_name.trim(),
        project_location: form.project_location.trim(),
        // Guest biasa: pakai nama & divisi akun sendiri. TAPI Sales Internal yang
        // pilih SBU (Sales External)  atasnamakan External tsb (form.sales_name).
        // requester_id/name tetap akun Sales Internal (jejak pembuat).
        sales_name: (!isPTS
          ? ((myIsInternalSales && form.sales_name.trim()) ? form.sales_name.trim() : (currentUser.full_name || form.sales_name).trim())
          : form.sales_name.trim()),
        sales_division: (!isPTS
          ? ((myIsInternalSales && form.sales_name.trim()) ? (form.sales_division?.trim() || '') : (currentUser.sales_division || form.sales_division || '').trim())
          : (form.sales_division?.trim() || '')),
        // uuid berdampingan dengan sales_name, mengikuti aturan yang sama persis
        // seperti barisnya di atas. Saat Sales Internal mengatasnamakan Sales
        // External (SBU), yang dicatat adalah uuid External itu; kalau namanya
        // diketik dan tidak bisa dipastikan milik siapa, dibiarkan kosong.
        // requester_id di bawah tetap jejak siapa yang menekan tombolnya.
        sales_user_id: (!isPTS
          ? ((myIsInternalSales && form.sales_name.trim()) ? idDariNama(salesGuestUsers, form.sales_name) : (currentUser.id ?? null))
          : idDariNama(salesGuestUsers, form.sales_name)),
        kebutuhan: form.kebutuhan, kebutuhan_other: form.kebutuhan_other.trim(),
        solution_product: form.solution_product, solution_other: form.solution_other.trim(),
        layout_signage: form.layout_signage, jaringan_cms: form.jaringan_cms,
        jumlah_input: form.jumlah_input.trim(), jumlah_output: form.jumlah_output.trim(),
        source: form.source, source_other: form.source_other.trim(),
        camera_conference: form.camera_conference, camera_jumlah: form.camera_jumlah.trim(), camera_tracking: form.camera_tracking,
        audio_system: form.audio_system, audio_mixer: form.audio_mixer, audio_detail: form.audio_detail,
        wallplate_input: form.wallplate_input, wallplate_jumlah: form.wallplate_jumlah.trim(),
        tabletop_input: form.tabletop_input, tabletop_jumlah: form.tabletop_jumlah.trim(),
        wireless_presentation: form.wireless_presentation, wireless_mode: form.wireless_mode, wireless_dongle: form.wireless_dongle,
        controller_automation: form.controller_automation, controller_type: form.controller_type,
        ukuran_ruangan: form.ukuran_ruangan.trim(), suggest_tampilan: form.suggest_tampilan.trim(), keterangan_lain: form.keterangan_lain.trim(),
        requester_id: currentUser.id, requester_name: currentUser.full_name, status: 'pending' as const,
        due_date: dueDateForm || null,
        rooms: rooms.length > 0 ? rooms : [],
        routing_status: routingStatus,
        internal_sales_id: internalSalesId,
        // Kolom brand hanya ditulis kalau ada brand (Sales External) - supaya submit
        // internal/admin tetap jalan walau sql/brand-multi-internal.sql belum di-run.
        ...(chosenBrand ? { internal_sales_id_2: internalSalesId2, brand: chosenBrand } : {}),
      };

      // Brand Ruangan 1 dipisah dari payload utama supaya bisa dilepas kalau
      // kolomnya belum ada. Ruangan ke-2 dst tersimpan di `rooms` (JSONB),
      // sementara Ruangan 1 memakai kolom tabel tersendiri. Lihat
      // sql/design-project-brand-display-2.sql.
      const brandRuangan1 = {
        brand_display: form.brand_display || null,
        brand_display_pic_id: form.brand_display_pic_id || null,
        brand_display_pic_name: form.brand_display_pic_name || null,
        brand_display_2: form.brand_display_2 || null,
        brand_display_2_pic_id: form.brand_display_2_pic_id || null,
        brand_display_2_pic_name: form.brand_display_2_pic_name || null,
        brand_middleware: form.brand_middleware || null,
        brand_middleware_pic_id: form.brand_middleware_pic_id || null,
        brand_middleware_pic_name: form.brand_middleware_pic_name || null,
      };
      let { data, error } = await cobaIdentitas(async pakaiUuid => await supabase.from('project_requests')
        .insert([{ ...(pakaiUuid ? payload : tanpaIdentitas(payload)), ...brandRuangan1 }]).select().single());
      if (error) {
        // PostgREST menolak SELURUH insert kalau satu kolom tak dikenal, bukan
        // cuma kolom itu. Tanpa jalur mundur ini, submit gagal total di basis
        // data yang migrasinya belum dijalankan.
        ({ data, error } = await cobaIdentitas(async pakaiUuid => await supabase.from('project_requests')
          .insert([pakaiUuid ? payload : tanpaIdentitas(payload)]).select().single()));
      }
      if (error) { notify('error', 'Gagal submit form: ' + error.message); setSubmitting(false); return; }
      if (data?.id) {
        // Catat pembuatan ke audit trail supaya riwayat request punya pangkal.
        // Saat Sales Internal mengajukan atas nama Sales External (SBU),
        // keduanya disebut supaya jelas siapa penginput sebenarnya.
        {
          const atasNama = (payload.sales_name ?? '').trim();
          const bedaPenginput = atasNama && atasNama !== currentUser.full_name;
          logAudit({
            user_id: currentUser.id, user_name: currentUser.full_name,
            action: 'create', module: 'project',
            target_id: data.id, target_name: payload.project_name,
            notes: bedaPenginput
              ? `Diinput ${currentUser.full_name} atas nama Sales ${atasNama}`
              : `Kebutuhan: ${payload.kebutuhan || '-'}`,
          }).catch(() => {});
        }
        await supabase.from('project_messages').insert([{
          request_id: data.id, sender_id: currentUser.id, sender_name: 'System', sender_role: 'system',
          message: `📋 Request baru dari ${currentUser.full_name} telah masuk dan menunggu approval dari Superadmin.`,
        }]);
        /*
          M12 (docs/UX-WORKFLOW-AUDIT.md): request-nya SUDAH tersimpan (data.id
          valid, pesan sistem "menunggu approval" sudah terkirim) di titik ini.
          Dulu upload foto survey/BOQ awal di bawah ini TIDAK dibungkus
          try/catch sendiri - kalau compressImage() atau storage.upload()
          melontar exception (file korup, kuota browser penuh, dsb), yang
          tertangkap adalah catch generik di akhir fungsi ini yang bilang
          "Terjadi kesalahan tidak terduga. Coba lagi." - menyiratkan submit
          gagal TOTAL padahal sudah tersimpan. User yang percaya pesan itu
          submit ulang seluruh form -> request duplikat, notifikasi ganda ke
          Admin & Sales Internal. Sekarang dibungkus try/catch sendiri: upload
          lampiran awal boleh gagal, tapi TIDAK BOLEH terlihat seperti request-
          nya sendiri gagal.
        */
        if (surveyPhotos.length > 0) {
          try {
            for (const photo of surveyPhotos) {
              const compressedPhoto = await compressImage(photo);
              const filePath = `project-files/${data.id}/survey-${Date.now()}-${toStorageSafeName(compressedPhoto.name)}`;
              const { error: storageErr } = await supabase.storage.from('project-files').upload(filePath, compressedPhoto, { cacheControl: '31536000', upsert: false });
              if (!storageErr) {
                const { data: urlData } = supabase.storage.from('project-files').getPublicUrl(filePath);
                await supabase.from('project_attachments').insert([{
                  request_id: data.id, message_id: null, file_name: photo.name,
                  file_url: urlData.publicUrl, file_type: compressedPhoto.type, file_size: compressedPhoto.size,
                  uploaded_by: currentUser.full_name,
                }]);
              }
            }
          } catch {
            notify('error', 'Request berhasil dikirim, tapi sebagian foto survey gagal diupload. Upload manual lewat detail request setelah ini.');
          }
        }
        if (boqFormFile && data?.id) {
          try {
            const filePath = `project-files/${data.id}/boq-initial-${Date.now()}-${toStorageSafeName(boqFormFile.name)}`;
            const { error: boqErr } = await supabase.storage.from('project-files').upload(filePath, boqFormFile, { cacheControl: '31536000', upsert: false });
            if (!boqErr) {
              const { data: urlData } = supabase.storage.from('project-files').getPublicUrl(filePath);
              await supabase.from('project_attachments').insert([{
                request_id: data.id, message_id: null, file_name: boqFormFile.name,
                file_url: urlData.publicUrl, file_type: boqFormFile.type, file_size: boqFormFile.size,
                uploaded_by: currentUser.full_name, attachment_category: 'boq', revision_version: 1,
              }]);
            }
          } catch {
            notify('error', 'Request berhasil dikirim, tapi file BOQ awal gagal diupload. Upload manual lewat detail request setelah ini.');
          }
        }
        // Termasuk pemegang Full Access (Manager PTS IVP), bukan hanya
        // role admin - lihat lib/penerima-admin.ts.
        const adminUsersWA = await penerimaAdminBernomor();
        const adminPhonesWA = (adminUsersWA || []).map((u: any) => u.phone_number).filter(Boolean);
        if (adminUsersWA && adminUsersWA.length > 0 && routingStatus === 'internal_review') {
          // Sales External: WA WAJIB ke Sales Internal dulu (actionable), Admin cuma pengingat.
          const internalMsg =
            `📩 *REQUEST DESIGN BARU - PERLU REVIEW KAMU*\n\n` +
            `Sales External *${currentUser.full_name}* (${currentUser.sales_division || '-'}) mengajukan request design:\n\n` +
            `📋 Project: ${form.project_name.trim()}\n` +
            `🛋️ Ruangan: ${form.room_name.trim() || '-'}\n\n` +
            `Silakan review & teruskan ke Admin:\n` +
            `🔗 ${appLink()}`;
          await Promise.allSettled(
            internalHandlers.filter(h => h.phone_number).map(h => sendWANotif({ type: 'reminder_wa', target: h.phone_number as string, message: internalMsg, event: 'project.internal_review' }))
          );
          const adminHeadsUp =
            `ℹ️ *ADA REQUEST DESIGN BARU (pengingat)*\n\n` +
            `Sales External *${currentUser.full_name}* mengajukan request untuk *${form.project_name.trim()}*.\n` +
            `Sedang menunggu review dari Sales Internal *${internalHandlers[0]?.full_name ?? '-'}* sebelum bisa diproses Admin.`;
          await Promise.allSettled(
            (adminUsersWA as any[]).map((a: any) => sendWANotif({ type: 'reminder_wa', target: a.phone_number, message: adminHeadsUp, event: 'project.approval_needed' }))
          );
        }
        if (adminUsersWA && adminUsersWA.length > 0 && routingStatus !== 'internal_review') {
          const approvalWaMsg = [
            '🏗️ *Request Design Project \u2014 Request Baru*',
            '\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501',
            `📋 *Project  :* ${form.project_name.trim()}`,
            `🛋️ *Ruangan  :* ${form.room_name.trim() || '-'}`,
            `👤 *Requester:* ${currentUser.full_name}`,
            `🏢 *Sales    :* ${form.sales_name.trim() || '-'}`,
            '\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501',
            'Silakan buka dashboard untuk *Approve / Reject*.',
            `🔗 ${appLink()}`,
          ].join('\n');
          await Promise.allSettled(
            (adminUsersWA as any[]).map((a: any) =>
              sendWANotif({ type: 'reminder_wa', target: a.phone_number, message: approvalWaMsg, event: 'project.approval_needed' })
            )
          );
        }
        // CC/upload/brand-PIC di bawah ini berlaku utk KEDUA jalur routing (internal_review & admin_review).
        if (adminUsersWA && adminUsersWA.length > 0) {
          // CC ke atasan + IVP berdasarkan divisi requester
          try {
            const ccDiv = currentUser?.sales_division ?? '';
            if (ccDiv && ccDiv !== 'IVP' && currentUser?.id) {
              const ccTargets = await fetchWACCTargets(currentUser.id, ccDiv);
              if (ccTargets.length > 0) {
                const ccMsg = [
                  `🏗️ *[CC] Request Design Baru — Divisi ${ccDiv}*`,
                  '━━━━━━━━━━━━━━━━━━',
                  `📋 *Project  :* ${form.project_name.trim()}`,
                  `👤 *Sales    :* ${currentUser.full_name} (${ccDiv})`,
                  '━━━━━━━━━━━━━━━━━━',
                  `📋 *CC ke   :* ${ccTargets.map(t => t.name + (t.relation === 'ivp_handler' ? ' (IVP)' : '')).join(', ')}`,
                  `🔗 ${appLink()}`,
                ].join('\n');
                await Promise.allSettled(ccTargets.map(t => sendWANotif({ type: 'reminder_wa', target: t.phone, message: ccMsg, event: 'project.brand_cc' })));
              }
            }
          } catch { }

          // Upload foto per ruangan tambahan
          try {
            for (const [roomId, photos] of Object.entries(roomPhotoMap)) {
              const rIdx = rooms.findIndex(r => r.id === roomId);
              const label = rIdx >= 0 ? `room${rIdx+2}` : roomId.slice(0,6);
              for (const photo of photos) {
                const compressedPhoto = await compressImage(photo);
                const filePath = `project-files/${data.id}/survey-${label}-${Date.now()}-${toStorageSafeName(compressedPhoto.name)}`;
                const { error: sErr } = await supabase.storage.from('project-files').upload(filePath, compressedPhoto, { cacheControl:'31536000', upsert:false });
                if (!sErr) {
                  const { data: urlData } = supabase.storage.from('project-files').getPublicUrl(filePath);
                  await supabase.from('project_attachments').insert([{
                    request_id: data.id, message_id: null, file_name: `[${label}] ${photo.name}`,
                    file_url: urlData.publicUrl, file_type: compressedPhoto.type, file_size: compressedPhoto.size, uploaded_by: currentUser.full_name,
                  }]);
                }
              }
            }
          } catch { }

          // Upload BOQ per ruangan tambahan
          try {
            for (const [roomId, boqFile] of Object.entries(boqRoomMap)) {
              if (!boqFile) continue;
              const rIdx = rooms.findIndex(r => r.id === roomId);
              const label = rIdx >= 0 ? `room${rIdx+2}` : roomId.slice(0,6);
              const filePath = `project-files/${data.id}/boq-${label}-${Date.now()}-${toStorageSafeName(boqFile.name)}`;
              const { error: bErr } = await supabase.storage.from('project-files').upload(filePath, boqFile, { cacheControl:'31536000', upsert:false });
              if (!bErr) {
                const { data: urlData } = supabase.storage.from('project-files').getPublicUrl(filePath);
                const existingBOQ = await supabase.from('project_attachments').select('revision_version').eq('request_id', data.id).eq('attachment_category','boq').order('revision_version',{ascending:false}).limit(1);
                const revNum = ((existingBOQ.data?.[0]?.revision_version) || 0) + 1;
                await supabase.from('project_attachments').insert([{
                  request_id: data.id, message_id: null, file_name: `[${label}] ${boqFile.name}`,
                  file_url: urlData.publicUrl, file_type: boqFile.type, file_size: boqFile.size,
                  uploaded_by: currentUser.full_name, attachment_category: 'boq', revision_version: revNum,
                }]);
              }
            }
          } catch { }

          // WA notif ke Brand PIC dari rooms
          try {
            // Ruangan 1 ikut: datanya ada di `form`, bukan di `rooms` - tanpa
            // ini PIC Ruangan 1 tidak pernah dikabari sama sekali, padahal
            // ruangan itulah yang paling sering diisi.
            const ruangan1 = {
              room_name: form.room_name || 'Ruangan 1',
              brand_display: form.brand_display, brand_display_pic_id: form.brand_display_pic_id,
              brand_display_2: form.brand_display_2, brand_display_2_pic_id: form.brand_display_2_pic_id,
              brand_middleware: form.brand_middleware, brand_middleware_pic_id: form.brand_middleware_pic_id,
            } as unknown as (typeof rooms)[number];
            const allRooms = [ruangan1, ...rooms];
            const brandPicIds = new Set<string>();
            allRooms.forEach(r => {
              // Ketiganya ikut: PIC display KEDUA harus dikabari juga, kalau
              // tidak slot display keduanya cuma jadi catatan dan orang yang
              // seharusnya menangani tidak pernah tahu.
              if (r.brand_display_pic_id) brandPicIds.add(r.brand_display_pic_id);
              if (r.brand_display_2_pic_id) brandPicIds.add(r.brand_display_2_pic_id);
              if (r.brand_middleware_pic_id) brandPicIds.add(r.brand_middleware_pic_id);
            });
            if (brandPicIds.size > 0) {
              const { data: picUsers } = await supabase.from('users').select('id, full_name, phone_number').in('id', Array.from(brandPicIds));
              for (const pic of (picUsers || []) as any[]) {
                if (!pic.phone_number) continue;
                const picRooms = allRooms.filter(r => r.brand_display_pic_id===pic.id || r.brand_display_2_pic_id===pic.id || r.brand_middleware_pic_id===pic.id);
                const brandMsg = [
                  '🏷️ *[Brand PIC] Request Design Project Baru*',
                  '━━━━━━━━━━━━━━━━━━',
                  `📋 *Project :* ${form.project_name.trim()}`,
                  `👤 *Sales   :* ${currentUser.full_name} (${currentUser.sales_division||'—'})`,
                  '─────────────────',
                  ...picRooms.map((r,i) => {
                    const lines = [`🚪 *Ruangan:* ${r.room_name||'—'}`];
                    if (r.brand_display_pic_id===pic.id) lines.push(`  🖥️ Brand Display: ${r.brand_display} *(Anda PIC-nya)*`);
                    if (r.brand_display_2_pic_id===pic.id) lines.push(`  🖥️ Brand Display 2: ${r.brand_display_2} *(Anda PIC-nya)*`);
                    if (r.brand_middleware_pic_id===pic.id) lines.push(`  🔌 Brand Middleware: ${r.brand_middleware} *(Anda PIC-nya)*`);
                    return lines.join('\n');
                  }),
                  '━━━━━━━━━━━━━━━━━━',
                  `🔗 ${appLink('/request-design-project')}`,
                ].join('\n');
                await sendWANotif({ type: 'reminder_wa', target: pic.phone_number, message: brandMsg, event: 'project.brand_cc' });
              }
            }
          } catch { }
        }
      }
      notify('success', routingStatus === 'internal_review'
        ? `✅ Form berhasil dikirim! ⏳ Menunggu review ${internalHandlers[0]?.full_name ?? 'Sales Internal'} terlebih dahulu.`
        : '✅ Form berhasil dikirim! ⏳ Menunggu approval dari Superadmin.');
      setForm(initialForm); setDueDateForm(''); setSurveyPhotos([]); setSurveyPhotosPreviews([]); setBoqFormFile(null);
      setRooms([]); setRoomPhotoMap({}); setBoqRoomMap({});
      setShowNewFormModal(false);
      fetchRequests();
    } catch { notify('error', 'Terjadi kesalahan tidak terduga. Coba lagi.'); }
    finally { setSubmitting(false); }
  };
  return { handleSubmitForm };
}
