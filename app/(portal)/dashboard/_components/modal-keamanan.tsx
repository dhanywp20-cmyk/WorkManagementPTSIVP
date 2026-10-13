'use client';

/**
 * Admin Panel -> Sistem -> Keamanan Login. Wajib 2FA untuk admin, status 2FA per akun, dan reset
 * (HP hilang). Semua lewat /api/admin/2fa - pengaturannya terkunci dari peramban (migrasi 049).
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';

interface Akun { id: string; full_name: string; username: string; role: string }

export function KeamananInline() {
  const [wajibAdmin, setWajibAdmin] = useState(false);
  const [aktif, setAktif] = useState<Set<string>>(new Set());
  const [akun, setAkun] = useState<Akun[]>([]);
  const [pesan, setPesan] = useState<{ galat: boolean; teks: string } | null>(null);
  const [sibuk, setSibuk] = useState(false);
  const [memuat, setMemuat] = useState(true);

  const muat = useCallback(async () => {
    try {
      const [r, { data }] = await Promise.all([
        fetch('/api/admin/2fa', { credentials: 'include', cache: 'no-store' }),
        supabase.from('users').select('id, full_name, username, role').order('full_name'),
      ]);
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error ?? `Gagal memuat (${r.status})`);
      setWajibAdmin(j.wajibAdmin === true);
      setAktif(new Set<string>(j.aktif ?? []));
      setAkun((data ?? []) as Akun[]);
    } catch (e) { setPesan({ galat: true, teks: (e as Error).message }); }
    setMemuat(false);
  }, []);
  useEffect(() => { void muat(); }, [muat]);

  const kirim = async (body: Record<string, unknown>, sukses: string) => {
    setSibuk(true); setPesan(null);
    try {
      const r = await fetch('/api/admin/2fa', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error ?? 'Gagal.');
      setPesan({ galat: false, teks: sukses });
      await muat();
    } catch (e) { setPesan({ galat: true, teks: (e as Error).message }); }
    setSibuk(false);
  };

  const admin = useMemo(() => akun.filter(a => a.role === 'admin'), [akun]);
  const lain = useMemo(() => akun.filter(a => a.role !== 'admin' && aktif.has(a.id)), [akun, aktif]);

  const baris = (a: Akun) => (
    <li key={a.id} className="flex items-center gap-3 px-3 py-2">
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-semibold text-slate-800 truncate">{a.full_name}</span>
        <span className="block text-[11px] text-slate-500 truncate">{a.username}</span>
      </span>
      {aktif.has(a.id) ? (
        <>
          <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">2FA</span>
          <button disabled={sibuk} title="Hapus 2FA akun ini (HP hilang)"
            onClick={() => { if (window.confirm(`Reset 2FA ${a.full_name}?`)) void kirim({ aksi: 'reset', user_id: a.id }, `2FA ${a.full_name} direset.`); }}
            className="text-[11px] font-bold text-red-600 hover:underline disabled:opacity-40">Reset</button>
        </>
      ) : (
        <span className="text-[11px] font-bold text-slate-400">Belum</span>
      )}
    </li>
  );

  return (
    <div className="p-4 space-y-4">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 flex items-center gap-4">
        <div className="flex-1">
          <h3 className="text-sm font-bold text-slate-800">Wajib 2FA untuk admin</h3>
          <p className="text-[11px] text-slate-500 mt-0.5">Admin tanpa 2FA diminta mendaftar saat login</p>
        </div>
        <button role="switch" aria-checked={wajibAdmin} disabled={sibuk || memuat}
          title={wajibAdmin ? 'Matikan' : 'Nyalakan (2FA akun Anda harus aktif)'}
          onClick={() => void kirim({ aksi: 'atur', wajibAdmin: !wajibAdmin }, wajibAdmin ? 'Wajib 2FA admin dimatikan.' : 'Wajib 2FA admin menyala.')}
          className={`relative w-11 h-6 rounded-full transition-colors disabled:opacity-50 ${wajibAdmin ? 'bg-emerald-600' : 'bg-slate-300'}`}>
          <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${wajibAdmin ? 'translate-x-5' : ''}`} />
        </button>
      </section>

      {pesan && (
        <p className={`px-3 py-2 rounded-xl text-sm font-medium border ${pesan.galat ? 'text-red-700 bg-red-50 border-red-200' : 'text-emerald-700 bg-emerald-50 border-emerald-200'}`}>
          {pesan.teks}
        </p>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-600 px-4 pt-3 pb-1">Administrator ({admin.length})</h3>
        {memuat ? <p className="px-4 pb-3 text-sm text-slate-400">Memuat…</p>
          : <ul className="divide-y divide-slate-100">{admin.map(baris)}</ul>}
      </section>

      {lain.length > 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-600 px-4 pt-3 pb-1">Akun lain ber-2FA ({lain.length})</h3>
          <ul className="divide-y divide-slate-100">{lain.map(baris)}</ul>
        </section>
      )}
    </div>
  );
}
