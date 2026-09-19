'use client';

import { useState, useEffect } from 'react';
import { Modal } from '@/components/shared';
import { supabase } from '@/lib/supabase';
import type { SourceTable } from '@/lib/summary-project';

const TABEL_LABEL: Record<SourceTable, string> = {
  reminders: '🗓️ Request Schedule',
  tickets: '🎫 Troubleshooting',
  project_requests: '🏗️ Design Project',
  form_reviews: '⭐ Form Review',
};

interface HasilCari {
  table: SourceTable;
  id: string;
  project_name: string | null;
  keterangan: string;
}

interface OverrideAktif {
  id: string;
  source_table: SourceTable;
  source_id: string;
  canonical_project_name: string;
}

/**
 * Admin-only: cari SATU record lintas 4 tabel (tanpa batas lingkup - admin
 * memang boleh melihat semuanya) lalu kaitkan ke nama project kanonik.
 * Dipakai untuk kasus label project_name-nya beda ketik/belum nyambung ke
 * pengelompokan otomatis. Lihat lib/summary-project.ts.
 */
export function ModalLinkManual({ currentUserName, onTutup, onTersimpan }: {
  currentUserName: string;
  onTutup: () => void;
  onTersimpan: () => void;
}) {
  const [q, setQ] = useState('');
  const [mencari, setMencari] = useState(false);
  const [hasil, setHasil] = useState<HasilCari[]>([]);
  const [dipilih, setDipilih] = useState<HasilCari | null>(null);
  const [namaKanonik, setNamaKanonik] = useState('');
  const [menyimpan, setMenyimpan] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [overrideAktif, setOverrideAktif] = useState<OverrideAktif[]>([]);

  const muatOverride = async () => {
    const { data } = await supabase.from('project_summary_links')
      .select('id, source_table, source_id, canonical_project_name')
      .order('linked_at', { ascending: false }).limit(50);
    setOverrideAktif((data ?? []) as OverrideAktif[]);
  };
  useEffect(() => { muatOverride(); }, []);

  async function cari() {
    const query = q.trim();
    if (!query) { setHasil([]); return; }
    setMencari(true);
    try {
      const [r, t, p, f] = await Promise.all([
        supabase.from('reminders').select('id, project_name, assign_name').ilike('project_name', `%${query}%`).limit(10),
        supabase.from('tickets').select('id, project_name, issue_case').ilike('project_name', `%${query}%`).limit(10),
        supabase.from('project_requests').select('id, project_name, requester_name').ilike('project_name', `%${query}%`).limit(10),
        supabase.from('form_reviews').select('id, project_name, guest_fullname').ilike('project_name', `%${query}%`).limit(10),
      ]);
      const list: HasilCari[] = [
        ...((r.data ?? []) as { id: string; project_name: string; assign_name: string }[])
          .map(x => ({ table: 'reminders' as const, id: x.id, project_name: x.project_name, keterangan: x.assign_name })),
        ...((t.data ?? []) as { id: string; project_name: string; issue_case: string }[])
          .map(x => ({ table: 'tickets' as const, id: x.id, project_name: x.project_name, keterangan: x.issue_case })),
        ...((p.data ?? []) as { id: string; project_name: string; requester_name: string }[])
          .map(x => ({ table: 'project_requests' as const, id: x.id, project_name: x.project_name, keterangan: x.requester_name })),
        ...((f.data ?? []) as { id: string; project_name: string | null; guest_fullname: string }[])
          .map(x => ({ table: 'form_reviews' as const, id: x.id, project_name: x.project_name, keterangan: x.guest_fullname })),
      ];
      setHasil(list);
    } finally { setMencari(false); }
  }

  async function simpan() {
    if (!dipilih || !namaKanonik.trim()) return;
    setMenyimpan(true); setError(null);
    const { error: err } = await supabase.from('project_summary_links')
      .upsert({
        source_table: dipilih.table, source_id: dipilih.id,
        canonical_project_name: namaKanonik.trim(), linked_by: currentUserName,
        linked_at: new Date().toISOString(),
      }, { onConflict: 'source_table,source_id' });
    setMenyimpan(false);
    if (err) { setError('Gagal menyimpan: ' + err.message); return; }
    setDipilih(null); setNamaKanonik('');
    await muatOverride();
    onTersimpan();
  }

  async function lepas(id: string) {
    await supabase.from('project_summary_links').delete().eq('id', id);
    await muatOverride();
    onTersimpan();
  }

  return (
    <Modal buka onTutup={onTutup} judul="🔗 Kelola Link Manual" ikon="🔗" ukuran="lg"
      keterangan="Kaitkan record yang label nama project-nya beda ketik/belum nyambung ke nama project yang benar.">
      <div className="space-y-4">
        <div className="flex gap-2">
          <input aria-label="Cari record" value={q} onChange={e => setQ(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') cari(); }}
            placeholder="Cari record (nama project, issue, dst)..."
            className="flex-1 px-3 py-2 rounded-lg text-sm border border-gray-200 outline-none focus:ring-2 focus:ring-rose-400" />
          <button onClick={cari} disabled={mencari}
            className="px-4 py-2 rounded-lg text-sm font-bold text-white bg-rose-500 hover:bg-rose-600 disabled:opacity-50">
            {mencari ? '...' : 'Cari'}
          </button>
        </div>

        {hasil.length > 0 && (
          <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-52 overflow-y-auto">
            {hasil.map(h => (
              <button key={`${h.table}-${h.id}`} onClick={() => { setDipilih(h); setNamaKanonik(h.project_name || ''); }}
                className={`w-full text-left px-3 py-2 text-xs hover:bg-gray-50 ${dipilih?.id === h.id && dipilih.table === h.table ? 'bg-rose-50' : ''}`}>
                <span className="font-bold text-gray-700">{TABEL_LABEL[h.table]}</span>{' — '}
                <span className="text-gray-600">{h.project_name || '(tanpa nama)'}</span>
                <span className="text-gray-400"> · {h.keterangan}</span>
              </button>
            ))}
          </div>
        )}

        {dipilih && (
          <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 space-y-2">
            <p className="text-xs text-gray-600">
              Kaitkan <b>{TABEL_LABEL[dipilih.table]}</b> ({dipilih.project_name || '(tanpa nama)'}) ke nama project:
            </p>
            <input aria-label="Nama project kanonik" value={namaKanonik} onChange={e => setNamaKanonik(e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-sm border border-gray-200 outline-none" />
            {error && <p className="text-xs text-red-600">{error}</p>}
            <div className="flex gap-2">
              <button onClick={simpan} disabled={menyimpan || !namaKanonik.trim()}
                className="px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50">
                {menyimpan ? 'Menyimpan...' : 'Simpan Link'}
              </button>
              <button onClick={() => setDipilih(null)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-500 bg-gray-100 hover:bg-gray-200">
                Batal
              </button>
            </div>
          </div>
        )}

        <div>
          <p className="text-xs font-bold text-gray-500 uppercase mb-2">Link Manual Aktif ({overrideAktif.length})</p>
          {overrideAktif.length === 0 ? (
            <p className="text-xs text-gray-400">Belum ada link manual dibuat.</p>
          ) : (
            <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-40 overflow-y-auto">
              {overrideAktif.map(o => (
                <div key={o.id} className="flex items-center justify-between px-3 py-2 text-xs">
                  <span><span className="font-bold">{TABEL_LABEL[o.source_table]}</span> → {o.canonical_project_name}</span>
                  <button onClick={() => lepas(o.id)} className="text-red-500 hover:text-red-700 font-semibold">Lepas</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
