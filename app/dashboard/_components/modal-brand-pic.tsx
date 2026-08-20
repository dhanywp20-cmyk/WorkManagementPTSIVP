'use client';
import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

import { DISPLAY_BRANDS_DB, MIDDLEWARE_BRANDS_DB, BrandPicMappingDB } from './shared';
import { ModalPortal } from '@/components/shared';

// BrandPicSettingModal

export function BrandPicSettingModal({ onClose }: { onClose: () => void }) {
  const [brandUsers, setBrandUsers] = useState<{id:string;full_name:string;sales_division?:string}[]>([]);
  const [mappings, setMappings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notif, setNotif] = useState<{type:'success'|'error';msg:string}|null>(null);

  useEffect(() => {
    Promise.all([
      supabase.from('users').select('id, full_name, sales_division').eq('role','guest').eq('team_type','Marketing').order('full_name'),
      supabase.from('brand_pic_mappings').select('id,brand_type,brand_name,pic_user_id,pic_user_name'),
    ]).then(([usersRes, mapsRes]) => {
      if (usersRes.data) setBrandUsers(usersRes.data as any[]);
      if (mapsRes.data) {
        const map: Record<string,string> = {};
        (mapsRes.data as BrandPicMappingDB[]).forEach(m => { if(m.pic_user_id) map[`${m.brand_type}:${m.brand_name}`] = m.pic_user_id; });
        setMappings(map);
      }
      setLoading(false);
    });
  }, []);

  const notify = (type:'success'|'error', msg:string) => { setNotif({type,msg}); setTimeout(()=>setNotif(null),3000); };

  const handleSave = async () => {
    setSaving(true);
    try {
      const allBrands = [
        ...DISPLAY_BRANDS_DB.map(b=>({brand_type:'display' as const,brand_name:b})),
        ...MIDDLEWARE_BRANDS_DB.map(b=>({brand_type:'middleware' as const,brand_name:b})),
      ];
      for (const {brand_type,brand_name} of allBrands) {
        const key = `${brand_type}:${brand_name}`;
        const picId = mappings[key] || null;
        const picUser = picId ? brandUsers.find(u=>u.id===picId) : null;
        await supabase.from('brand_pic_mappings').upsert(
          {brand_type,brand_name,pic_user_id:picId,pic_user_name:picUser?.full_name||null},
          {onConflict:'brand_type,brand_name'}
        );
      }
      notify('success','Mapping PIC Brand disimpan!');
    } catch(e:any) { notify('error',e.message); }
    setSaving(false);
  };

  const Row = ({type,brand}:{type:'display'|'middleware';brand:string}) => {
    const key = `${type}:${brand}`;
    return (
      <div className="flex items-center gap-3 py-2.5 border-b border-slate-100 last:border-0">
        <span className="w-36 text-sm font-semibold text-slate-700 flex-shrink-0">{brand}</span>
        <select aria-label="— Belum ada PIC —" value={mappings[key]||''} onChange={e=>setMappings(p=>({...p,[key]:e.target.value}))}
          className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-teal-400 appearance-none">
          <option value="">— Belum ada PIC —</option>
          {brandUsers.map(u=><option key={u.id} value={u.id}>{u.full_name} ({u.sales_division})</option>)}
        </select>
        {mappings[key] && <span className="text-[10px] text-teal-600 font-bold flex-shrink-0">✅</span>}
      </div>
    );
  };

  return (
  <ModalPortal>
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-full flex flex-col border border-slate-200">
        <div className="bg-gradient-to-r from-amber-600 to-amber-500 px-6 py-5 flex items-center justify-between flex-shrink-0 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center text-lg">⚙️</div>
            <div><h2 className="text-base font-bold text-white">Setting PIC Brand</h2><p className="text-white/70 text-xs">Mapping brand ke PIC penanggung jawab (Request Design Project)</p></div>
          </div>
          <button aria-label="Tutup" onClick={onClose} className="bg-white/10 hover:bg-white/20 text-white p-2 rounded-lg transition-all">✕</button>
        </div>
        {notif && <div className={`mx-5 mt-3 px-4 py-2.5 rounded-lg text-sm font-semibold flex-shrink-0 ${notif.type==='success'?'bg-emerald-50 text-emerald-700 border border-emerald-200':'bg-red-50 text-red-700 border border-red-200'}`}>{notif.type==='success'?'✅':'❌'} {notif.msg}</div>}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {loading ? <div className="flex justify-center py-10"><div className="w-6 h-6 rounded-full border-2 border-t-amber-500 border-amber-200 animate-spin"/></div> : (
            <>
              <div>
                <p className="text-sm font-bold text-amber-700 uppercase tracking-widest mb-3">🖥️ Brand Display</p>
                <div className="bg-amber-50/50 rounded-xl border border-amber-200 px-4 py-1">
                  {DISPLAY_BRANDS_DB.map(b=><Row key={b} type="display" brand={b}/>)}
                </div>
              </div>
              <div>
                <p className="text-sm font-bold text-violet-700 uppercase tracking-widest mb-3">🔌 Brand Middleware</p>
                <div className="bg-violet-50/50 rounded-xl border border-violet-200 px-4 py-1">
                  {MIDDLEWARE_BRANDS_DB.map(b=><Row key={b} type="middleware" brand={b}/>)}
                </div>
              </div>
            </>
          )}
        </div>
        <div className="px-5 py-4 border-t border-slate-100 flex gap-3 flex-shrink-0">
          <button onClick={onClose} className="flex-1 border-2 border-slate-300 text-slate-600 py-2.5 rounded-xl font-bold text-sm hover:bg-slate-50 transition-all">Batal</button>
          <button onClick={handleSave} disabled={saving||loading} className="flex-1 py-2.5 rounded-xl font-bold text-sm text-white transition-all disabled:opacity-50" style={{background:'linear-gradient(135deg,#d97706,#b45309)'}}>
            {saving?'⏳ Menyimpan...':'💾 Simpan Semua'}
          </button>
        </div>
      </div>
    </div>
  </ModalPortal>
  );
}

// BrandPicSettingContent (reusable inline, no overlay)
export function BrandPicSettingContent() {
  const [brandUsers, setBrandUsers] = useState<{id:string;full_name:string;sales_division?:string}[]>([]);
  const [mappings, setMappings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notif, setNotif] = useState<{type:'success'|'error';msg:string}|null>(null);

  useEffect(() => {
    Promise.all([
      supabase.from('users').select('id, full_name, sales_division').eq('role','guest').eq('team_type','Marketing').order('full_name'),
      supabase.from('brand_pic_mappings').select('id,brand_type,brand_name,pic_user_id,pic_user_name'),
    ]).then(([usersRes, mapsRes]) => {
      if (usersRes.data) setBrandUsers(usersRes.data as any[]);
      if (mapsRes.data) {
        const map: Record<string,string> = {};
        (mapsRes.data as BrandPicMappingDB[]).forEach(m => { if(m.pic_user_id) map[`${m.brand_type}:${m.brand_name}`] = m.pic_user_id; });
        setMappings(map);
      }
      setLoading(false);
    });
  }, []);

  const notify = (type:'success'|'error', msg:string) => { setNotif({type,msg}); setTimeout(()=>setNotif(null),3000); };

  const handleSave = async () => {
    setSaving(true);
    try {
      const allBrands = [
        ...DISPLAY_BRANDS_DB.map(b=>({brand_type:'display' as const,brand_name:b})),
        ...MIDDLEWARE_BRANDS_DB.map(b=>({brand_type:'middleware' as const,brand_name:b})),
      ];
      for (const {brand_type,brand_name} of allBrands) {
        const key = `${brand_type}:${brand_name}`;
        const picId = mappings[key] || null;
        const picUser = picId ? brandUsers.find(u=>u.id===picId) : null;
        await supabase.from('brand_pic_mappings').upsert(
          {brand_type,brand_name,pic_user_id:picId,pic_user_name:picUser?.full_name||null},
          {onConflict:'brand_type,brand_name'}
        );
      }
      notify('success','Mapping PIC Brand disimpan!');
    } catch(e:any) { notify('error',e.message); }
    setSaving(false);
  };

  const Row = ({type,brand}:{type:'display'|'middleware';brand:string}) => {
    const key = `${type}:${brand}`;
    return (
      <div className="flex items-center gap-3 py-2.5 border-b border-slate-100 last:border-0">
        <span className="w-36 text-sm font-semibold text-slate-700 flex-shrink-0">{brand}</span>
        <select aria-label="— Belum ada PIC —" value={mappings[key]||''} onChange={e=>setMappings(p=>({...p,[key]:e.target.value}))}
          className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white outline-none focus:border-amber-400 appearance-none">
          <option value="">— Belum ada PIC —</option>
          {brandUsers.map(u=><option key={u.id} value={u.id}>{u.full_name} ({u.sales_division})</option>)}
        </select>
        {mappings[key] && <span className="text-[10px] text-amber-600 font-bold flex-shrink-0">✅</span>}
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col overflow-hidden bg-slate-50">
      {notif && (
        <div className={`mx-5 mt-3 px-4 py-2.5 rounded-lg text-sm font-semibold flex-shrink-0 ${notif.type==='success'?'bg-emerald-50 text-emerald-700 border border-emerald-200':'bg-red-50 text-red-700 border border-red-200'}`}>
          {notif.type==='success'?'✅':'❌'} {notif.msg}
        </div>
      )}
      {/* Kartu putih di atas latar slate — sama dengan Kartu di Profil. */}
      <div className="flex-1 min-h-0 p-4">
        <div className="h-full flex flex-col bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {loading ? (
          <div className="flex justify-center py-16"><div className="w-6 h-6 rounded-full border-2 border-t-amber-500 border-amber-200 animate-spin"/></div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-5">
              <div>
                <p className="text-sm font-bold text-amber-700 uppercase tracking-widest mb-3">🖥️ Brand Display</p>
                <div className="bg-amber-50/50 rounded-xl border border-amber-200 px-4 py-1">
                  {DISPLAY_BRANDS_DB.map(b=><Row key={b} type="display" brand={b}/>)}
                </div>
              </div>
              <div>
                <p className="text-sm font-bold text-violet-700 uppercase tracking-widest mb-3">🔌 Brand Middleware</p>
                <div className="bg-violet-50/50 rounded-xl border border-violet-200 px-4 py-1">
                  {MIDDLEWARE_BRANDS_DB.map(b=><Row key={b} type="middleware" brand={b}/>)}
                </div>
              </div>
            </div>
          </>
        )}
        </div>
        </div>
      </div>
      <div className="px-5 py-4 border-t border-slate-100 flex-shrink-0">
        <button onClick={handleSave} disabled={saving||loading}
          className="w-full py-2.5 rounded-xl font-bold text-sm text-white transition-all disabled:opacity-50"
          style={{background:'linear-gradient(135deg,#d97706,#b45309)'}}>
          {saving?'⏳ Menyimpan...':'💾 Simpan Semua Mapping PIC Brand'}
        </button>
      </div>
    </div>
  );
}

export function BrandPicSettingInline() {
  // Re-export BrandPicSettingModal content without the fixed-overlay wrapper
  return <BrandPicSettingContent />;
}
