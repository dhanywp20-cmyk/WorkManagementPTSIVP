'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { logAudit } from '@/lib/audit';
import {
  Site, ChecklistItem, User, SiteStatus, STATUS_META, DOT_COLOR, NEXT_STATE,
} from './shared';

export function DetailModal({
  site, items, currentUser, canEdit, canDeleteSite, onClose, onShareLink,
}: {
  site: Site;
  items: ChecklistItem[];
  currentUser: User | null;
  canEdit: boolean;
  canDeleteSite: boolean;
  onClose: () => void;
  onShareLink: (siteId: string) => void;
}) {
  const [localSite, setLocalSite] = useState(site);
  const [localItems, setLocalItems] = useState(items);
  const [busy, setBusy] = useState(false);

  async function patchSite(patch: Partial<Site>) {
    setLocalSite(s => ({ ...s, ...patch }));
    await supabase.from('bpkp_sites').update(patch).eq('id', site.id);
    void logAudit({
      user_id: currentUser?.id ?? '', user_name: currentUser?.full_name ?? '',
      action: 'update', module: 'bpkp-progress', target_id: site.id, target_name: localSite.name,
    });
  }

  async function addItem() {
    const sort_order = localItems.length ? Math.max(...localItems.map(i => i.sort_order)) + 1 : 1;
    const { data } = await supabase.from('bpkp_checklist_items')
      .insert({ site_id: site.id, text: 'Komponen baru', state: 'ok', sort_order })
      .select().single();
    if (data) setLocalItems(prev => [...prev, data as ChecklistItem]);
    await refreshProgress();
  }

  async function toggleItem(item: ChecklistItem) {
    const state = NEXT_STATE[item.state];
    setLocalItems(prev => prev.map(i => i.id === item.id ? { ...i, state } : i));
    await supabase.from('bpkp_checklist_items').update({ state }).eq('id', item.id);
    await refreshProgress();
  }

  async function updateItemText(id: string, text: string) {
    setLocalItems(prev => prev.map(i => i.id === id ? { ...i, text } : i));
    await supabase.from('bpkp_checklist_items').update({ text }).eq('id', id);
  }

  async function deleteItem(id: string) {
    setLocalItems(prev => prev.filter(i => i.id !== id));
    await supabase.from('bpkp_checklist_items').delete().eq('id', id);
    await refreshProgress();
  }

  // Progress dihitung ulang oleh trigger DB — kita cuma re-fetch angkanya
  // biar modal langsung menampilkan nilai terbaru tanpa nunggu realtime.
  async function refreshProgress() {
    const { data } = await supabase.from('bpkp_sites').select('progress').eq('id', site.id).single();
    if (data) setLocalSite(s => ({ ...s, progress: data.progress }));
  }

  async function deleteSite() {
    if (!confirm(`Hapus lokasi "${localSite.name}" beserta seluruh checklist-nya? Tindakan ini tidak bisa dibatalkan.`)) return;
    setBusy(true);
    await supabase.from('bpkp_sites').delete().eq('id', site.id);
    void logAudit({
      user_id: currentUser?.id ?? '', user_name: currentUser?.full_name ?? '',
      action: 'delete', module: 'bpkp-progress', target_id: site.id, target_name: localSite.name,
    });
    setBusy(false);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center p-4 sm:p-8 overflow-y-auto"
      style={{ background: 'rgba(15,15,25,0.45)', backdropFilter: 'blur(2px)' }}
      onClick={onClose}
    >
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 relative mt-4"
        onClick={e => e.stopPropagation()}
      >
        <button onClick={onClose}
          className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-gray-800 text-white flex items-center justify-center shadow-lg hover:bg-gray-700"
        >✕</button>

        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex-1 min-w-0">
            {canEdit ? (
              <input
                className="font-bold text-lg text-gray-800 w-full outline-none border-b border-transparent focus:border-orange-400"
                value={localSite.name}
                onChange={e => setLocalSite(s => ({ ...s, name: e.target.value }))}
                onBlur={e => patchSite({ name: e.target.value })}
              />
            ) : (
              <h2 className="font-bold text-lg text-gray-800">{localSite.name}</h2>
            )}
            <div className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
              PIC:{' '}
              {canEdit ? (
                <input
                  className="outline-none border-b border-transparent focus:border-orange-400 text-gray-500"
                  value={localSite.pic}
                  onChange={e => setLocalSite(s => ({ ...s, pic: e.target.value }))}
                  onBlur={e => patchSite({ pic: e.target.value })}
                />
              ) : <span>{localSite.pic}</span>}
            </div>
          </div>

          {canEdit ? (
            <select
              className={`text-[10px] font-bold uppercase px-2.5 py-1 rounded-full border ${STATUS_META[localSite.status].badge}`}
              value={localSite.status}
              onChange={e => patchSite({ status: e.target.value as SiteStatus })}
            >
              {Object.entries(STATUS_META).map(([k, m]) => <option key={k} value={k}>{m.label}</option>)}
            </select>
          ) : (
            <span className={`text-[10px] font-bold uppercase px-2.5 py-1 rounded-full border whitespace-nowrap ${STATUS_META[localSite.status].badge}`}>
              {STATUS_META[localSite.status].label}
            </span>
          )}
        </div>

        <div className="mb-4">
          <div className="flex justify-between text-[11px] text-gray-400 mb-1">
            <span>Progres komponen {localItems.length > 0 ? '(otomatis dari checklist)' : ''}</span>
            <span className="font-semibold text-gray-600">{localSite.progress}%</span>
          </div>
          <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-orange-500 rounded-full transition-all" style={{ width: `${localSite.progress}%` }} />
          </div>
        </div>

        <div className="space-y-2 mb-3">
          {localItems.map(item => (
            <div key={item.id} className="flex items-center gap-2 text-sm">
              {canEdit ? (
                <button
                  className={`w-3.5 h-3.5 rounded-full flex-shrink-0 ${DOT_COLOR[item.state]}`}
                  title="Klik untuk ubah status"
                  onClick={() => toggleItem(item)}
                />
              ) : (
                <span className={`w-3.5 h-3.5 rounded-full flex-shrink-0 inline-block ${DOT_COLOR[item.state]}`} />
              )}
              {canEdit ? (
                <input
                  className={`flex-1 outline-none border-b border-transparent focus:border-orange-400 ${item.state === 'ok' ? 'text-gray-500' : 'font-semibold text-gray-800'}`}
                  value={item.text}
                  onChange={e => setLocalItems(prev => prev.map(i => i.id === item.id ? { ...i, text: e.target.value } : i))}
                  onBlur={e => updateItemText(item.id, e.target.value)}
                />
              ) : (
                <span className={`flex-1 ${item.state === 'ok' ? 'text-gray-500' : 'font-semibold text-gray-800'}`}>{item.text}</span>
              )}
              {canEdit && (
                <button className="text-gray-300 hover:text-red-500 text-xs" onClick={() => deleteItem(item.id)}>✕</button>
              )}
            </div>
          ))}
        </div>
        {canEdit && (
          <button className="text-xs text-gray-400 hover:text-orange-600 font-medium mb-4" onClick={addItem}>
            + Tambah komponen
          </button>
        )}

        {(localSite.note || canEdit) && (
          canEdit ? (
            <textarea
              className={`w-full text-xs rounded-lg p-3 mb-4 outline-none border-l-2 ${localSite.note_critical ? 'border-red-400 bg-red-50/50' : 'border-amber-400 bg-amber-50/50'}`}
              rows={2}
              placeholder="Catatan..."
              value={localSite.note}
              onChange={e => setLocalSite(s => ({ ...s, note: e.target.value }))}
              onBlur={e => patchSite({ note: e.target.value })}
            />
          ) : (
            <p className={`text-xs rounded-lg p-3 mb-4 border-l-2 ${localSite.note_critical ? 'border-red-400 bg-red-50/50 text-red-700' : 'border-amber-400 bg-amber-50/50 text-gray-600'}`}>
              {localSite.note}
            </p>
          )
        )}

        <div className="flex items-center justify-between gap-2 pt-3 border-t border-gray-100">
          <button
            className="text-[11px] font-semibold px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600"
            onClick={() => onShareLink(site.id)}
          >
            Kirim Link View Only
          </button>
          {canDeleteSite && (
            <button
              disabled={busy}
              className="text-[11px] font-semibold px-3 py-2 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 disabled:opacity-50"
              onClick={deleteSite}
            >
              Hapus Lokasi
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
