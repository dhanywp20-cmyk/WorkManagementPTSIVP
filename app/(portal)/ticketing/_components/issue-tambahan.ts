'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { compressImage } from '@/lib/image-compress';
import { hasFullAccess } from '@/lib/constants';
import { isPimpinan } from '@/lib/pimpinan';
import { bolehUpdateTicket, type Ticket, type User } from './shared';

export interface IssueTiket {
  id: string;
  ticket_id: string;
  nomor: number;
  issue_case: string;
  description: string;
  product: string;
  sn_unit: string;
  status: string;
  dibuat_oleh: string;
  dibuat_oleh_nama: string;
  selesai_pada: string | null;
  created_at: string;
  updated_at: string;
}

export interface LogIssueTiket {
  id: string;
  issue_id: string;
  ticket_id: string;
  handler_name: string;
  handler_username: string;
  dari_status: string | null;
  new_status: string;
  action_taken: string;
  notes: string;
  photo_url: string;
  photo_name: string;
  created_at: string;
}

export interface IsianIssueBaru { issue_case: string; description: string; product: string; sn_unit: string }
export interface IsianUpdateIssue { new_status: string; action_taken: string; notes: string; photo: File | null }

const STATUS_TUTUP_TICKET = ['Waiting Approval', 'Rejected', 'Cancelled', 'Solved'];

export const ticketMasihJalan = (t: Ticket) => !STATUS_TUTUP_TICKET.includes(t.status);

export function bolehTambahIssue(t: Ticket, u: User | null): boolean {
  if (!u || isPimpinan(u) || !ticketMasihJalan(t)) return false;
  return bolehUpdateTicket(t, u) || (!!t.created_by && t.created_by === u.username);
}

export function bolehUpdateIssue(t: Ticket, u: User | null): boolean {
  return !!u && !isPimpinan(u) && ticketMasihJalan(t) && bolehUpdateTicket(t, u);
}

export const bolehHapusIssue = (u: User | null) =>
  !!u && (u.role === 'admin' || u.role === 'superadmin' || hasFullAccess(u));

export async function hitungIssueTerbuka(ticketId: string): Promise<number> {
  const { count, error } = await supabase.from('ticket_issues')
    .select('id', { count: 'exact', head: true })
    .eq('ticket_id', ticketId).neq('status', 'Solved');
  if (error) return 0;
  return count ?? 0;
}

async function unggahFoto(file: File, ticketId: string) {
  const ALLOWED = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  if (!ALLOWED.includes(file.type)) throw new Error('Foto hanya boleh format JPG, PNG, atau WebP.');
  if (file.size > 5 * 1024 * 1024) throw new Error('Ukuran foto maksimal 5MB.');
  const kecil = await compressImage(file);
  const ext = kecil.name.split('.').pop()?.toLowerCase() ?? 'jpg';
  const path = `photos/issue-${ticketId}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from('ticket-photos').upload(path, kecil, { cacheControl: '31536000' });
  if (error) throw new Error(`Gagal unggah foto: ${error.message}`);
  return { url: supabase.storage.from('ticket-photos').getPublicUrl(path).data.publicUrl, name: file.name };
}

export function useIssueTiket(ticketId: string | null, aktif = true) {
  const [issues, setIssues] = useState<IssueTiket[]>([]);
  const [logs, setLogs] = useState<LogIssueTiket[]>([]);
  const [galatMuat, setGalatMuat] = useState<string | null>(null);

  const muat = useCallback(async () => {
    if (!ticketId || !aktif) return;
    const [ri, rl] = await Promise.all([
      supabase.from('ticket_issues').select('*').eq('ticket_id', ticketId).order('nomor'),
      supabase.from('ticket_issue_logs').select('*').eq('ticket_id', ticketId).order('created_at', { ascending: false }),
    ]);
    if (ri.error) { setGalatMuat(ri.error.message); setIssues([]); setLogs([]); return; }
    setGalatMuat(null);
    setIssues((ri.data ?? []) as IssueTiket[]);
    setLogs((rl.data ?? []) as LogIssueTiket[]);
  }, [ticketId, aktif]);

  useEffect(() => { void muat(); }, [muat]);

  const tambah = useCallback(async (ticket: Ticket, isian: IsianIssueBaru, u: User) => {
    const issue_case = isian.issue_case.trim();
    if (!issue_case) throw new Error('Isi nama issue / kasusnya dulu.');
    for (let coba = 0; coba < 3; coba++) {
      const { data: akhir } = await supabase.from('ticket_issues').select('nomor')
        .eq('ticket_id', ticket.id).order('nomor', { ascending: false }).limit(1);
      const nomor = Math.max(1, (akhir?.[0]?.nomor as number | undefined) ?? 1) + 1;
      const { data, error } = await supabase.from('ticket_issues').insert([{
        ticket_id: ticket.id, nomor, issue_case,
        description: isian.description.trim(), product: isian.product.trim(), sn_unit: isian.sn_unit.trim(),
        status: 'Pending', dibuat_oleh: u.username, dibuat_oleh_nama: u.full_name || u.username,
      }]).select('id').single();
      if (error?.code === '23505') continue;
      if (error) throw new Error(error.message);
      await supabase.from('ticket_issue_logs').insert([{
        issue_id: data.id, ticket_id: ticket.id,
        handler_name: u.full_name || u.username, handler_username: u.username,
        dari_status: null, new_status: 'Pending', notes: `Issue #${nomor} ditambahkan.`,
      }]);
      await muat();
      return nomor;
    }
    throw new Error('Gagal memberi nomor issue. Coba lagi.');
  }, [muat]);

  const update = useCallback(async (ticket: Ticket, issue: IssueTiket, isian: IsianUpdateIssue, u: User) => {
    let foto = { url: '', name: '' };
    if (isian.photo) foto = await unggahFoto(isian.photo, ticket.id);
    if (isian.new_status !== issue.status) {
      const { data, error } = await supabase.from('ticket_issues').update({ status: isian.new_status })
        .eq('id', issue.id).select('id');
      if (error) throw new Error(error.message);
      if (!data || data.length === 0) throw new Error('Status issue tidak berubah (ditolak sistem). Refresh lalu ulangi.');
    }
    const { error: le } = await supabase.from('ticket_issue_logs').insert([{
      issue_id: issue.id, ticket_id: ticket.id,
      handler_name: u.full_name || u.username, handler_username: u.username,
      dari_status: issue.status, new_status: isian.new_status,
      action_taken: isian.action_taken.trim(), notes: isian.notes.trim(),
      photo_url: foto.url, photo_name: foto.name,
    }]);
    if (le) throw new Error(`Status tersimpan, tapi catatan gagal disimpan: ${le.message}`);
    await muat();
  }, [muat]);

  const hapus = useCallback(async (issue: IssueTiket) => {
    const { data, error } = await supabase.from('ticket_issues').delete().eq('id', issue.id).select('id');
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) throw new Error('Issue tidak terhapus (ditolak sistem).');
    await muat();
  }, [muat]);

  return {
    issues: issues.filter(i => i.ticket_id === ticketId),
    logs: logs.filter(l => l.ticket_id === ticketId),
    galatMuat, muat, tambah, update, hapus,
  };
}
