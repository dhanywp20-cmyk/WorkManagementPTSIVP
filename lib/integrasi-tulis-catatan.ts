import { hasFullAccess } from '@/lib/constants';
import { appLink } from '@/lib/app-url';
import { linkOneDriveSah } from '@/lib/aturan-tech-note';
import { gagal, idSah, penerimaAdminServer, samaNama, teks } from '@/lib/integrasi-bantu';

import { type Aksi, GARIS, kirimWA, audit } from '@/lib/integrasi-tulis-bersama';

export const catatanBuat: Aksi = async (a, k) => {
  const { db, u } = k;
  const judul = teks(a.judul, 200);
  const link = teks(a.link, 1000);
  const folderArg = teks(a.folder, 120);
  if (!judul) return gagal('judul wajib diisi.');
  if (!linkOneDriveSah(link)) return gagal('link wajib tautan OneDrive/SharePoint https (1drv.ms, onedrive.live.com, *.sharepoint.com).');
  const { data: folders, error: fe } = await db.from('tech_note_folders').select('id, name').order('name');
  if (fe) return gagal(fe.message);
  const fl = (folders ?? []) as { id: string; name: string }[];
  const folder = fl.find(f => f.id === folderArg) ?? fl.find(f => samaNama(f.name, folderArg));
  if (!folder) return gagal(`folder wajib salah satu folder Tech Note: ${fl.map(f => f.name).join(', ') || '(belum ada folder)'}.`);
  const tags = (Array.isArray(a.tags) ? a.tags.map(String) : String(a.tags ?? '').split(',')).map(s => s.trim()).filter(Boolean).slice(0, 20);
  const kini = new Date().toISOString();
  const { data: masuk, error } = await db.from('tech_notes').insert({
    title: judul, description: teks(a.deskripsi, 3000), folder_id: folder.id, author_id: u.id, author_name: u.full_name,
    one_drive_link: link, product: teks(a.produk, 150), tags, status: 'pending', submitted_at: kini, team_type: u.team_type ?? '',
  }).select('id').single();
  const id = (masuk as { id?: string } | null)?.id;
  if (error || !id) return gagal(`Gagal menyimpan tech note${error ? `: ${error.message}` : ' (ditolak sistem).'}`);
  await db.from('tech_note_history').insert({ tech_note_id: id, action: 'submitted', performed_by: u.id, performed_by_name: u.full_name,
    note: 'Submitted for review', created_at: kini });
  await audit(k, { action: 'create', module: 'tech-note', target_id: id, target_name: judul });
  for (const ad of await penerimaAdminServer(db)) await k.efek.inApp({ user_id: ad.id, type: 'system', title: '📄 Tech Note baru menunggu review',
    body: `"${judul}" oleh ${u.full_name}`, action_url: '/tech-note', ref_id: id, created_by: u.full_name ?? '' });
  return { ok: true, id, judul, folder: folder.name, status: 'pending' };
};

const PETA_REVIEW: Record<string, 'approved' | 'revision_requested' | 'rejected'> = {
  approved: 'approved', approve: 'approved', setuju: 'approved', disetujui: 'approved',
  revision: 'revision_requested', revision_requested: 'revision_requested', revisi: 'revision_requested',
  rejected: 'rejected', reject: 'rejected', tolak: 'rejected', ditolak: 'rejected',
};

export const catatanReview: Aksi = async (a, k) => {
  const { db, u } = k;
  if (!hasFullAccess(u)) return gagal('Review tech note hanya untuk Admin atau pemegang Full Access.');
  const id = idSah(a.id);
  if (!id) return gagal('id tech note tidak sah (ambil dari catatan_cari).');
  const aksi = PETA_REVIEW[String(a.keputusan ?? '').trim().toLowerCase()];
  if (!aksi) return gagal('keputusan wajib: approved, revisi, atau rejected.');
  const { data: n, error: ne } = await db.from('tech_notes').select('id, title, status, author_id').eq('id', id).maybeSingle();
  if (ne) return gagal(ne.message);
  const c = n as { id: string; title: string; status: string; author_id: string | null } | null;
  if (!c) return gagal('Tech note tidak ditemukan.');
  if (c.status !== 'pending') return gagal(`Tech note ini berstatus ${c.status} - hanya yang Pending yang bisa direview.`);
  const catatan = teks(a.catatan, 1000);
  const kini = new Date().toISOString();
  const statusBaru = aksi === 'approved' ? 'approved' : aksi === 'rejected' ? 'rejected' : 'revision';
  const { data: terubah, error } = await db.from('tech_notes').update({ status: statusBaru, reviewed_at: kini, reviewed_by: u.id,
    reviewed_by_name: u.full_name, review_note: catatan || null }).eq('id', id).select('id');
  if (error || !terubah || terubah.length === 0) return gagal('Gagal menyimpan keputusan review. Coba lagi atau hubungi admin.');
  await db.from('tech_note_history').insert({ tech_note_id: id, action: aksi, performed_by: u.id, performed_by_name: u.full_name,
    note: catatan || null, created_at: kini });
  await audit(k, { action: aksi === 'approved' ? 'approve' : 'reject', module: 'tech-note', target_id: id, target_name: c.title, notes: catatan || undefined });
  let wa = false;
  if (c.author_id) {
    const label = aksi === 'approved' ? '✅ Disetujui' : aksi === 'rejected' ? '❌ Ditolak' : '🔄 Perlu Revisi';
    await k.efek.inApp({ user_id: c.author_id, type: 'system', title: `📄 Tech Note ${label}`, body: `"${c.title}" — ${catatan || 'Tanpa catatan'}`,
      action_url: '/tech-note', ref_id: id, created_by: u.full_name ?? '' });
    try {
      const { data: p } = await db.from('users').select('full_name, phone_number').eq('id', c.author_id).maybeSingle();
      const penulis = p as { full_name: string; phone_number: string | null } | null;
      if (penulis?.phone_number) {
        wa = await kirimWA(k, penulis.phone_number, [`📄 *TECH NOTE ${label.replace(/^[^\s]+\s/, '').toUpperCase()}*`, GARIS,
          `Halo *${penulis.full_name}*, catatan teknismu sudah direview oleh *${u.full_name}*:`,
          `📌 *Judul  :* ${c.title}`, `📝 *Catatan:* ${catatan || 'Tanpa catatan'}`, GARIS,
          aksi === 'approved' ? 'Terima kasih sudah berbagi — catatanmu kini bisa dipakai tim. 🙌' : 'Silakan ditindaklanjuti lalu ajukan kembali.',
          `🔗 ${appLink('/tech-note')}`].join('\n'));
      }
    } catch {  }
  }
  return { ok: true, judul: c.title, status_baru: statusBaru, wa_penulis: wa };
};
