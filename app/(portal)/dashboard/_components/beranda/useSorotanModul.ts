'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { statDari } from '@/lib/checklist/inti';
import { hasFullAccess } from '@/lib/constants';
import { hasMenu } from '../widgets/permissions';
import type { User } from '../shared';

export interface BarisProyek { id: string; nama: string; target: string; kendala: number; persen: number }
export interface BarisAntrean { kunci: string; label: string; jumlah: number; menu: string }
export interface BarisUnit { id: string; barang: string; proyek: string; pic: string; hariLewat: number; kembali: string }
export interface RingkasReview { rata: number; jumlah: number; terendahNama: string; terendahNilai: number }

export interface SorotanModul {
  loading: boolean;
  proyek: BarisProyek[];
  antrean: BarisAntrean[];
  unit: { total: number; lewat: number; daftar: BarisUnit[] } | null;
  review: RingkasReview | null;
  techNote: { menunggu: number; disetujui: number } | null;
}

const KOSONG: SorotanModul = { loading: true, proyek: [], antrean: [], unit: null, review: null, techNote: null };

const tglPendek = (s: string) => new Date(`${s}T00:00:00`).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });

const tanggalIni = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

async function muatProyek(): Promise<BarisProyek[]> {
  const { data: proyek, error } = await supabase.from('checklist_proyek')
    .select('id, nama, target_date, status').neq('status', 'done')
    .order('target_date', { ascending: true, nullsFirst: false }).limit(3);
  if (error || !proyek?.length) return [];
  const { data: dftr } = await supabase.from('checklist_daftar').select('id, proyek_id').in('proyek_id', proyek.map((p: { id: string }) => p.id));
  const idDaftar = (dftr ?? []).map((d: { id: string }) => d.id);
  const { data: items } = idDaftar.length
    ? await supabase.from('checklist_item').select('daftar_id, selesai, kendala').in('daftar_id', idDaftar).limit(5000)
    : { data: [] };
  const milik = new Map((dftr ?? []).map((d: { id: string; proyek_id: string }) => [d.id, d.proyek_id]));
  return proyek.map((p: { id: string; nama: string; target_date: string | null }) => {
    const stat = statDari((items ?? []).filter((i: { daftar_id: string }) => milik.get(i.daftar_id) === p.id));
    return {
      id: p.id, nama: p.nama, kendala: stat.kendala,
      target: p.target_date ? tglPendek(p.target_date) : '—',
      persen: stat.total ? Math.round((stat.selesai / stat.total) * 100) : 0,
    };
  });
}

async function hitung(kueri: PromiseLike<{ count: number | null; error: unknown }>): Promise<number | null> {
  try {
    const { count, error } = await kueri;
    return error ? null : (count ?? 0);
  } catch {
    return null;
  }
}

async function muatUnit(): Promise<SorotanModul['unit']> {
  const kini = tanggalIni();
  const { data, count, error } = await supabase.from('movement_logs')
    .select('id, type_barang, project_name, nama_pts, expected_return_date', { count: 'exact' })
    .eq('status_barang', 'Keluar').eq('return_confirmed', false).not('is_deleted', 'is', true)
    .not('expected_return_date', 'is', null)
    .order('expected_return_date', { ascending: true }).limit(4);
  if (error) return null;
  const baris = (data ?? []) as { id: string; type_barang: string | null; project_name: string | null; nama_pts: string | null; expected_return_date: string }[];
  const lewat = await hitung(supabase.from('movement_logs').select('id', { count: 'exact', head: true })
    .eq('status_barang', 'Keluar').eq('return_confirmed', false).not('is_deleted', 'is', true)
    .lt('expected_return_date', kini));
  return {
    total: count ?? baris.length,
    lewat: lewat ?? 0,
    daftar: baris.map(b => ({
      id: b.id, barang: b.type_barang || 'Unit', proyek: b.project_name || '—', pic: b.nama_pts || '—',
      kembali: tglPendek(b.expected_return_date),
      hariLewat: Math.round((new Date(`${kini}T00:00:00`).getTime() - new Date(`${b.expected_return_date}T00:00:00`).getTime()) / 86_400_000),
    })),
  };
}

async function muatReview(): Promise<RingkasReview | null> {
  const { data, error } = await supabase.from('form_reviews')
    .select('project_name, grade_product_knowledge, grade_training_customer, grade_product_knowledge_bast')
    .order('created_at', { ascending: false }).limit(30);
  if (error) return null;
  const nilai = ((data ?? []) as Record<string, string | number | null>[]).map(r => {
    const skor = [r.grade_product_knowledge, r.grade_training_customer, r.grade_product_knowledge_bast].filter((g): g is number => typeof g === 'number' && g > 0);
    return { nama: String(r.project_name ?? '—'), skor: skor.length ? skor.reduce((a, b) => a + b, 0) / skor.length : 0 };
  }).filter(n => n.skor > 0);
  if (!nilai.length) return { rata: 0, jumlah: 0, terendahNama: '', terendahNilai: 0 };
  const terendah = nilai.reduce((a, b) => (b.skor < a.skor ? b : a));
  return { rata: nilai.reduce((a, b) => a + b.skor, 0) / nilai.length, jumlah: nilai.length, terendahNama: terendah.nama, terendahNilai: terendah.skor };
}

export function useSorotanModul(user: User): SorotanModul {
  const [hasil, setHasil] = useState<SorotanModul>(KOSONG);
  const kunci = JSON.stringify([user.id, user.role, user.allowed_menus, user.access_level]);

  useEffect(() => {
    let alive = true;
    const boleh = (menu: string) => hasFullAccess(user) || hasMenu(user, menu);
    const pengelola = hasFullAccess(user) || ['admin', 'superadmin'].includes((user.role ?? '').toLowerCase());
    const tahun = `${new Date().getFullYear()}-01-01`;
    (async () => {
      const [proyek, jadwal, desain, approvalNote, disetujuiNote, koreksi, akun, unit, review] = await Promise.all([
        boleh('project-progress') ? muatProyek().catch(() => []) : Promise.resolve([]),
        pengelola ? hitung(supabase.from('reminders').select('id', { count: 'exact', head: true }).eq('assigned_to', '').eq('status', 'pending').ilike('notes', '%[REQUEST SALES]%')) : null,
        pengelola ? hitung(supabase.from('project_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending')) : null,
        pengelola ? hitung(supabase.from('tech_notes').select('id', { count: 'exact', head: true }).eq('status', 'pending')) : null,
        boleh('tech-note') ? hitung(supabase.from('tech_notes').select('id', { count: 'exact', head: true }).eq('status', 'approved').gte('created_at', tahun)) : null,
        pengelola ? hitung(supabase.from('lc_quiz_attempts').select('id', { count: 'exact', head: true }).eq('is_submitted', true).eq('grading_status', 'pending_review')) : null,
        pengelola ? hitung(supabase.from('users').select('id', { count: 'exact', head: true }).eq('team_type', 'Pending Approval')) : null,
        boleh('unit-movement') ? muatUnit().catch(() => null) : Promise.resolve(null),
        boleh('form-bast') ? muatReview().catch(() => null) : Promise.resolve(null),
      ]);
      if (!alive) return;
      const antrean: BarisAntrean[] = [
        { kunci: 'jadwal', label: 'Request jadwal belum di-assign', jumlah: jadwal, menu: 'reminder-schedule' },
        { kunci: 'desain', label: 'Request design menunggu', jumlah: desain, menu: 'request-design-project' },
        { kunci: 'note', label: 'Tech Note menunggu approval', jumlah: approvalNote, menu: 'tech-note' },
        { kunci: 'koreksi', label: 'Jawaban quiz perlu dikoreksi', jumlah: koreksi, menu: 'learning-center' },
        { kunci: 'akun', label: 'Akun baru menunggu aktivasi', jumlah: akun, menu: '' },
      ].filter((a): a is BarisAntrean => a.jumlah !== null);
      setHasil({
        loading: false, proyek, antrean, unit, review,
        techNote: disetujuiNote === null ? null : { menunggu: approvalNote ?? 0, disetujui: disetujuiNote },
      });
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kunci]);

  return hasil;
}
