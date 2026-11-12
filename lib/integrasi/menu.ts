
import { filterLingkup } from '@/lib/project-scope';
import { BARIS, akunTambahan, bersih, gagal, idSah } from '@/lib/integrasi/bantu';
import { str, lingkupServer, type Aksi, type Baris } from '@/lib/integrasi/menu-dasar';
import { catatanCari, catatanDetail, unitCari, reviewCari, piketJadwal, kpi, insentifSaya, belajar } from './menu-lain';
import { desainDetail, tiketPersetujuan } from './menu-desain';

const projectCari: Aksi = async (a, k) => {
  const t = await akunTambahan(k);
  let q = k.db.from('v_project_summary').select('*').order('last_activity', { ascending: false, nullsFirst: false }).limit(BARIS);
  const batas = filterLingkup(await lingkupServer(k, t), 'sales_name');
  if (batas) q = q.or(batas);
  const kata = bersih(a.kata);
  if (kata) q = q.or(`name.ilike.%${kata}%,code.ilike.%${kata}%,customer.ilike.%${kata}%,location.ilike.%${kata}%`);
  const st = str(a.status).trim().toLowerCase();
  if (['active', 'done', 'archived'].includes(st)) q = q.eq('status', st);
  const { data, error } = await q;
  return error ? gagal(error.message) : { ok: true, jumlah: data?.length ?? 0, project: data ?? [] };
};

const KOLOM_DETAIL_PROJECT: Record<string, string> = {
  reminders: 'id, project_name, category, due_date, bast_date, status, assign_name, address',
  tickets: 'id, project_name, issue_case, status, date, assign_name',
  project_requests: 'id, project_name, status, requester_name, due_date, assign_name',
  form_reviews: 'id, project_name, reminder_id, review_category, grade_product_knowledge, grade_training_customer, grade_product_knowledge_bast',
};

const projectDetail: Aksi = async (a, k) => {
  const id = idSah(a.id);
  if (!id) return gagal('id project tidak sah (ambil dari project_cari).');
  const t = await akunTambahan(k);
  const lingkup = await lingkupServer(k, t);
  const batas = filterLingkup(lingkup, 'sales_name');
  let qp = k.db.from('v_project_summary').select('*').eq('project_id', id);
  if (batas) qp = qp.or(batas);
  const { data: p } = await qp.maybeSingle();
  if (!p) return gagal('Project tidak ditemukan atau Anda tidak punya akses.');
  const { data: links } = await k.db.from('project_source_links').select('source_module, source_record_id').eq('project_id', id);
  const ids: Record<string, string[]> = { reminders: [], tickets: [], project_requests: [], form_reviews: [] };
  for (const l of (links ?? []) as { source_module: string; source_record_id: string }[]) ids[l.source_module]?.push(l.source_record_id);
  const ambil = async (modul: string) => {
    if (!ids[modul].length) return [] as Baris[];
    let q = k.db.from(modul).select(KOLOM_DETAIL_PROJECT[modul]).in('id', ids[modul]);
    if (modul !== 'form_reviews') q = q.or('is_deleted.is.null,is_deleted.eq.false');
    if (batas) q = q.or(batas);
    const { data } = await q;
    return (data ?? []) as unknown as Baris[];
  };
  const [jadwal, tiket, desain] = await Promise.all([ambil('reminders'), ambil('tickets'), ambil('project_requests')]);
  return { ok: true, project: p, jadwal, tiket, request_desain: desain };
};

export const AKSI_MENU_BACA: Record<string, Aksi> = {
  desain_detail: desainDetail,
  tiket_persetujuan: tiketPersetujuan,
  catatan_cari: catatanCari,
  catatan_detail: catatanDetail,
  unit_cari: unitCari,
  review_cari: reviewCari,
  piket_jadwal: piketJadwal,
  kpi,
  insentif_saya: insentifSaya,
  belajar,
  project_cari: projectCari,
  project_detail: projectDetail,
};
