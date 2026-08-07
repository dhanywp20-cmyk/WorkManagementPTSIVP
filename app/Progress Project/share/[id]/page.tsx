'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import {
  Site, ChecklistItem, STATUS_META, DOT_COLOR, MODULE_COLOR,
} from '../../_components/shared';

export default function BpkpShareSitePage() {
  const params = useParams();
  const id = params?.id as string;

  const [site, setSite] = useState<Site | null>(null);
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!id) return;
    fetchData();
    const ch = supabase.channel(`bpkp-share-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bpkp_sites', filter: `id=eq.${id}` }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bpkp_checklist_items', filter: `site_id=eq.${id}` }, fetchData)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function fetchData() {
    const { data: siteData } = await supabase.from('bpkp_sites').select('*').eq('id', id).single();
    if (!siteData) { setNotFound(true); setLoading(false); return; }
    setSite(siteData as Site);
    const { data: itemsData } = await supabase.from('bpkp_checklist_items').select('*').eq('site_id', id).order('sort_order');
    setItems((itemsData ?? []) as ChecklistItem[]);
    setLoading(false);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 rounded-full animate-spin" style={{ border: '3px solid #fde68a', borderTopColor: MODULE_COLOR }} />
      </div>
    );
  }

  if (notFound || !site) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="text-center">
          <p className="text-4xl mb-2">🔍</p>
          <p className="font-semibold text-gray-600">Lokasi tidak ditemukan</p>
          <p className="text-xs text-gray-400 mt-1">Link mungkin salah atau lokasi sudah dihapus.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="max-w-md mx-auto">
        <div className="text-center mb-5">
          <p className="text-[10px] uppercase tracking-widest text-gray-400 font-semibold">PT Indo Visual Presentama — PTS</p>
          <p className="text-[10px] text-gray-400 mt-0.5">Mode lihat saja — link dibagikan untuk 1 lokasi ini</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <h1 className="font-bold text-lg text-gray-800">{site.name}</h1>
              <p className="text-xs text-gray-400 mt-0.5">PIC: {site.pic}</p>
            </div>
            <span className={`text-[10px] font-bold uppercase px-2.5 py-1 rounded-full border whitespace-nowrap ${STATUS_META[site.status].badge}`}>
              {STATUS_META[site.status].label}
            </span>
          </div>

          <div className="mb-4">
            <div className="flex justify-between text-[11px] text-gray-400 mb-1">
              <span>Progres komponen</span>
              <span className="font-semibold text-gray-600">{site.progress}%</span>
            </div>
            <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${site.progress}%`, background: MODULE_COLOR }} />
            </div>
          </div>

          <div className="space-y-2 mb-4">
            {items.map(item => (
              <div key={item.id} className="flex items-center gap-2 text-sm">
                <span className={`w-3.5 h-3.5 rounded-full flex-shrink-0 inline-block ${DOT_COLOR[item.state]}`} />
                <span className={item.state === 'ok' ? 'text-gray-500' : 'font-semibold text-gray-800'}>{item.text}</span>
              </div>
            ))}
          </div>

          {site.note && (
            <p className={`text-xs rounded-lg p-3 border-l-2 ${site.note_critical ? 'border-red-400 bg-red-50/50 text-red-700' : 'border-amber-400 bg-amber-50/50 text-gray-600'}`}>
              {site.note}
            </p>
          )}
        </div>

        <p className="text-center text-[10px] text-gray-300 mt-4">Data live — otomatis update tanpa refresh.</p>
      </div>
    </div>
  );
}
