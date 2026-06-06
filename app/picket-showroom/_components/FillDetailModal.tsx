'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import {
  PiketRow, KegiatanEntry, JenisKegiatan, UserRow,
  DAY_COLOR, JENIS_KEGIATAN_LIST, KEGIATAN_COLORS,
  KEBUTUHAN_LIST, PRODUK_LIST, SALES_DIVISIONS, TEAM_LABEL,
} from './shared';

interface KFEntry {
  id?:string; jenis_kegiatan:JenisKegiatan; jam_mulai:string; jam_selesai:string; produk:string[];
  tamu_instansi:string; nama_sales:string; sales_division:string; kebutuhan:string[]; keterangan:string;
  team_rnd:string;
}
const emptyKF=():KFEntry=>({jenis_kegiatan:'Demo Product',jam_mulai:'09:00',jam_selesai:'10:00',produk:[],tamu_instansi:'',nama_sales:'',sales_division:'',kebutuhan:[],keterangan:'',team_rnd:''});

export function FillDetailModal({row,onClose,onSaved,currentUser}:{row:PiketRow;onClose:()=>void;onSaved:()=>void;currentUser?:any}) {
  const [entries,setEntries]=useState<KFEntry[]>([emptyKF()]);
  const [loadingE,setLoadingE]=useState(true);
  const [ptUsers,setPtUsers]=useState<(UserRow&{id:string;full_name:string})[]>([]);
  const [saving,setSaving]=useState(false);
  const [toast,setToast]=useState<{type:'success'|'error';msg:string}|null>(null);
  const dc=DAY_COLOR[row.day_of_week];
  const notify=(type:'success'|'error',msg:string)=>{setToast({type,msg});setTimeout(()=>setToast(null),3500);};

  useEffect(()=>{
    (async()=>{
      setLoadingE(true);
      const[detailRes,usersRes]=await Promise.all([
        supabase.from('piket_tamu_detail').select('*').eq('piket_id',row.id).order('created_at'),
        supabase.from('users').select('id,full_name,team_type').in('team_type',['Team PTS','Team PTS UMP','Team PTS MLDS']).order('full_name'),
      ]);
      if(detailRes.data&&detailRes.data.length>0){
        setEntries((detailRes.data as KegiatanEntry[]).map(d=>({
          id:d.id,jenis_kegiatan:d.jenis_kegiatan||'Demo Product',
          jam_mulai:d.jam_mulai||'09:00',jam_selesai:d.jam_selesai||'10:00',produk:d.produk||[],
          tamu_instansi:d.tamu_instansi||'',nama_sales:d.nama_sales||'',sales_division:d.sales_division||'',
          kebutuhan:d.kebutuhan||[],keterangan:d.keterangan||'',
          team_rnd:(d as any).team_rnd||'',
        })));
      }
      if(usersRes.data)setPtUsers(usersRes.data as any[]);
      setLoadingE(false);
    })();
  },[row.id]);

  const upd=(i:number,p:Partial<KFEntry>)=>setEntries(prev=>prev.map((e,x)=>x===i?{...e,...p}:e));
  const toggleK=(i:number,k:string)=>setEntries(prev=>prev.map((e,x)=>x===i?{...e,kebutuhan:e.kebutuhan.includes(k)?e.kebutuhan.filter(v=>v!==k):[...e.kebutuhan,k]}:e));
  const toggleP=(i:number,p:string)=>{
    if(p==='All Product') setEntries(prev=>prev.map((e,x)=>x===i?{...e,produk:e.produk.includes('All Product')?[]:['All Product']}:e));
    else setEntries(prev=>prev.map((e,x)=>{if(x!==i)return e;const wo=e.produk.filter(v=>v!=='All Product');return{...e,produk:wo.includes(p)?wo.filter(v=>v!==p):[...wo,p]};}));
  };

  const getPTSTeamLabel=(name:string)=>{
    const u=ptUsers.find(x=>x.full_name===name);
    const tt=u?.team_type||'';
    return tt==='Team PTS'?'PTS IVP':tt==='Team PTS UMP'?'PTS UMP':tt==='Team PTS MLDS'?'PTS MLDS':'';
  };

  const handleSave=async()=>{
    setSaving(true);
    try{
      await supabase.from('piket_tamu_detail').delete().eq('piket_id',row.id);
      const editedByName=currentUser?.full_name||null;
      const now=new Date().toISOString();
      const ins=entries.filter(e=>e.jenis_kegiatan).map(e=>({
        piket_id:row.id,jenis_kegiatan:e.jenis_kegiatan,
        jam_mulai:e.jam_mulai||null,jam_selesai:e.jam_selesai||null,produk:e.produk,
        tamu_instansi:e.jenis_kegiatan==='Demo Product'?(e.tamu_instansi||null):null,
        nama_sales:e.jenis_kegiatan==='Demo Product'?(e.nama_sales||null):null,
        sales_division:e.jenis_kegiatan==='Demo Product'?(e.sales_division||null):null,
        kebutuhan:e.jenis_kegiatan==='Demo Product'?e.kebutuhan:[],
        keterangan:e.jenis_kegiatan!=='Demo Product'?(e.keterangan||null):null,
        team_rnd:e.jenis_kegiatan==='RnD'?(e.team_rnd||null):null,
        created_at:now,
        updated_at:now,
        edited_by_name:editedByName,
      }));
      if(ins.length>0){const{error}=await supabase.from('piket_tamu_detail').insert(ins);if(error)throw error;}
      const fd=ins.find(e=>e.jenis_kegiatan==='Demo Product');

      const updatePayload: Record<string,any> = {
        tamu_instansi:fd?.tamu_instansi||null,
        kebutuhan:fd?.kebutuhan||[],
        updated_at:now,
      };
      if(editedByName) updatePayload.edited_by_name=editedByName;

      const{error:upErr}=await supabase.from('piket_schedules').update(updatePayload).eq('id',row.id);
      if(upErr) console.warn('Gagal update piket_schedules:',upErr.message);

      notify('success','Data tersimpan!');
      setTimeout(()=>{onSaved();onClose();},700);
    }catch(e:any){notify('error','Gagal: '+e.message);}
    setSaving(false);
  };

  return(
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[110] p-4 overflow-y-auto" onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
      <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl w-full max-w-2xl my-4" style={{animation:'scale-in 0.25s ease-out',border:`1.5px solid ${dc.accent}40`}}>
        <div className="px-6 py-5 rounded-t-2xl" style={{background:dc.grad}}>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-white">✍️ Detail Piket — {row.day_of_week}</h2>
              <p className="text-white/70 text-xs mt-0.5">{new Date(row.day_date+'T00:00:00').toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'})} · {[row.pic_ivp_name,row.pic_ump_name,row.pic_mlds_name].filter(Boolean).join(' / ')||'Belum ada PIC'}</p>
            </div>
            <button onClick={onClose} className="bg-white/15 hover:bg-white/25 text-white p-2 rounded-lg">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>
        </div>
        {toast&&<div className={`mx-5 mt-4 px-4 py-3 rounded-xl text-sm font-semibold flex gap-2 ${toast.type==='success'?'bg-emerald-50 text-emerald-700 border border-emerald-200':'bg-red-50 text-red-700 border border-red-200'}`}><span>{toast.type==='success'?'✅':'❌'}</span><span>{toast.msg}</span></div>}
        <div className="p-6 space-y-5 max-h-[72vh] overflow-y-auto">
          {loadingE?<div className="flex justify-center py-10"><div className="w-6 h-6 rounded-full border-2 border-t-red-600 border-red-200 animate-spin"/></div>
          :entries.map((entry,idx)=>(
            <div key={idx} className="rounded-2xl overflow-hidden" style={{border:`1.5px solid ${dc.accent}30`,background:'rgba(255,255,255,0.7)'}}>
              <div className="flex items-center justify-between px-4 py-2.5" style={{background:dc.light,borderBottom:`1px solid ${dc.accent}20`}}>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-black text-white" style={{background:dc.grad}}>{idx+1}</div>
                  <span className="text-xs font-bold" style={{color:dc.accent}}>Kegiatan {idx+1}</span>
                </div>
                {entries.length>1&&<button onClick={()=>setEntries(p=>p.filter((_,i)=>i!==idx))} className="text-xs font-bold px-2 py-1 rounded-lg text-red-600 hover:bg-red-50" style={{border:'1px solid rgba(220,38,38,0.3)'}}>🗑️ Hapus</button>}
              </div>
              <div className="p-4 space-y-4">
                <div>
                  <label className="block text-[10px] font-bold mb-1.5 tracking-widest uppercase text-slate-400">🎯 Jenis Kegiatan</label>
                  <select value={entry.jenis_kegiatan} onChange={e=>upd(idx,{jenis_kegiatan:e.target.value as JenisKegiatan})}
                    className="w-full rounded-xl px-3 py-2.5 text-sm outline-none bg-white" style={{border:'1px solid rgba(0,0,0,0.12)'}}>
                    {JENIS_KEGIATAN_LIST.map(j=><option key={j} value={j}>{j}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold mb-1.5 tracking-widest uppercase text-slate-400">🕐 Jam Mulai</label>
                    <input type="time" value={entry.jam_mulai} onChange={e=>upd(idx,{jam_mulai:e.target.value})}
                      className="w-full rounded-xl px-3 py-2.5 text-sm outline-none" style={{background:'rgba(255,255,255,0.95)',border:'1px solid rgba(0,0,0,0.12)'}}/>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold mb-1.5 tracking-widest uppercase text-slate-400">🕐 Jam Selesai</label>
                    <input type="time" value={entry.jam_selesai} onChange={e=>upd(idx,{jam_selesai:e.target.value})}
                      className="w-full rounded-xl px-3 py-2.5 text-sm outline-none" style={{background:'rgba(255,255,255,0.95)',border:'1px solid rgba(0,0,0,0.12)'}}/>
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold mb-1.5 tracking-widest uppercase text-slate-400">📦 Produk</label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {PRODUK_LIST.map(p=>{
                      const chk=entry.produk.includes(p);
                      return(
                        <button key={p} type="button" onClick={()=>toggleP(idx,p)}
                          className="flex items-center gap-2 px-3 py-2 rounded-xl border-2 text-left transition-all"
                          style={chk?{borderColor:dc.accent,background:`${dc.accent}12`,color:dc.accent}:{borderColor:'rgba(0,0,0,0.1)',background:'rgba(255,255,255,0.5)',color:'#64748b'}}>
                          <div className="w-3.5 h-3.5 rounded border-2 flex items-center justify-center flex-shrink-0"
                            style={chk?{borderColor:dc.accent,background:dc.accent}:{borderColor:'#d1d5db',background:'white'}}>
                            {chk&&<svg className="w-2 h-2 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/></svg>}
                          </div>
                          <span className="text-xs font-semibold leading-tight">{p}</span>
                        </button>
                      );
                    })}
                  </div>
                  {entry.produk.length>0&&(
                    <div className="mt-2 p-2.5 rounded-xl flex flex-wrap gap-1.5" style={{background:'rgba(0,0,0,0.03)',border:'1px solid rgba(0,0,0,0.08)'}}>
                      {entry.produk.map(p=><span key={p} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold text-white" style={{background:dc.grad}}>{p}<button onClick={()=>toggleP(idx,p)} className="ml-0.5 opacity-80">✕</button></span>)}
                    </div>
                  )}
                </div>
                {/* Demo Product fields */}
                {entry.jenis_kegiatan==='Demo Product'&&(
                  <>
                    <div>
                      <label className="block text-[10px] font-bold mb-1.5 tracking-widest uppercase text-slate-400">🏢 Tamu Instansi</label>
                      <input value={entry.tamu_instansi} onChange={e=>upd(idx,{tamu_instansi:e.target.value})}
                        className="w-full rounded-xl px-3 py-2.5 text-sm outline-none" style={{background:'rgba(255,255,255,0.95)',border:'1px solid rgba(0,0,0,0.12)'}} placeholder="Nama instansi / perusahaan tamu..."/>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold mb-1.5 tracking-widest uppercase text-slate-400">👤 Nama Sales</label>
                        <input value={entry.nama_sales} onChange={e=>upd(idx,{nama_sales:e.target.value})}
                          className="w-full rounded-xl px-3 py-2.5 text-sm outline-none" style={{background:'rgba(255,255,255,0.95)',border:'1px solid rgba(0,0,0,0.12)'}} placeholder="Nama sales..."/>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold mb-1.5 tracking-widest uppercase text-slate-400">🏷️ Division</label>
                        <select value={entry.sales_division} onChange={e=>upd(idx,{sales_division:e.target.value})}
                          className="w-full rounded-xl px-3 py-2.5 text-sm outline-none bg-white" style={{border:'1px solid rgba(0,0,0,0.12)'}}>
                          <option value="">— Pilih Division —</option>
                          {SALES_DIVISIONS.map(d=><option key={d} value={d}>{d}</option>)}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold mb-1.5 tracking-widest uppercase text-slate-400">🎯 Kebutuhan</label>
                      <div className="grid grid-cols-2 gap-1.5">
                        {KEBUTUHAN_LIST.map(k=>{
                          const chk=entry.kebutuhan.includes(k);
                          return(
                            <button key={k} type="button" onClick={()=>toggleK(idx,k)}
                              className="flex items-center gap-2 px-3 py-2 rounded-xl border-2 text-left transition-all"
                              style={chk?{borderColor:dc.accent,background:`${dc.accent}12`,color:dc.accent}:{borderColor:'rgba(0,0,0,0.1)',background:'rgba(255,255,255,0.5)',color:'#64748b'}}>
                              <div className="w-3.5 h-3.5 rounded border-2 flex items-center justify-center flex-shrink-0"
                                style={chk?{borderColor:dc.accent,background:dc.accent}:{borderColor:'#d1d5db',background:'white'}}>
                                {chk&&<svg className="w-2 h-2 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/></svg>}
                              </div>
                              <span className="text-xs font-semibold leading-tight">{k}</span>
                            </button>
                          );
                        })}
                      </div>
                      {entry.kebutuhan.length>0&&(
                        <div className="mt-2 p-2.5 rounded-xl flex flex-wrap gap-1.5" style={{background:'rgba(0,0,0,0.03)',border:'1px solid rgba(0,0,0,0.08)'}}>
                          {entry.kebutuhan.map(k=><span key={k} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold text-white" style={{background:dc.grad}}>{k}<button onClick={()=>toggleK(idx,k)} className="ml-0.5 opacity-80">✕</button></span>)}
                        </div>
                      )}
                    </div>
                  </>
                )}
                {/* Non-demo */}
                {entry.jenis_kegiatan!=='Demo Product'&&(
                  <div className="space-y-3">
                    {entry.jenis_kegiatan==='RnD'&&(
                      <div>
                        <label className="block text-[10px] font-bold mb-1.5 tracking-widest uppercase text-slate-400">👥 Team yang RnD</label>
                        <div className="flex items-center gap-2">
                          <select value={entry.team_rnd} onChange={e=>upd(idx,{team_rnd:e.target.value})}
                            className="flex-1 rounded-xl px-3 py-2.5 text-sm outline-none bg-white" style={{border:'1px solid rgba(0,0,0,0.12)'}}>
                            <option value="">— Pilih Team —</option>
                            <optgroup label="Team PTS IVP">
                              {ptUsers.filter(u=>u.team_type==='Team PTS').map(u=><option key={u.id} value={u.full_name}>{u.full_name}</option>)}
                            </optgroup>
                            <optgroup label="Team PTS UMP">
                              {ptUsers.filter(u=>u.team_type==='Team PTS UMP').map(u=><option key={u.id} value={u.full_name}>{u.full_name}</option>)}
                            </optgroup>
                            <optgroup label="Team PTS MLDS">
                              {ptUsers.filter(u=>u.team_type==='Team PTS MLDS').map(u=><option key={u.id} value={u.full_name}>{u.full_name}</option>)}
                            </optgroup>
                          </select>
                          {entry.team_rnd&&(()=>{
                            const teamLabel=getPTSTeamLabel(entry.team_rnd);
                            const tc=teamLabel?TEAM_LABEL[teamLabel]:null;
                            return tc?(
                              <span className="text-[10px] font-black px-2 py-1.5 rounded-lg text-white flex-shrink-0" style={{background:tc.dot}}>
                                {teamLabel}
                              </span>
                            ):null;
                          })()}
                        </div>
                      </div>
                    )}
                    <div>
                      <label className="block text-[10px] font-bold mb-1.5 tracking-widest uppercase text-slate-400">📝 Keterangan</label>
                      <textarea value={entry.keterangan} onChange={e=>upd(idx,{keterangan:e.target.value})} rows={3}
                        className="w-full rounded-xl px-3 py-2.5 text-sm outline-none resize-none"
                        style={{background:'rgba(255,255,255,0.95)',border:'1px solid rgba(0,0,0,0.12)'}} placeholder={`Keterangan ${entry.jenis_kegiatan}...`}/>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
          {!loadingE&&(
            <button onClick={()=>setEntries(p=>[...p,emptyKF()])}
              className="w-full py-3 rounded-2xl border-2 border-dashed text-sm font-bold flex items-center justify-center gap-2"
              style={{borderColor:`${dc.accent}60`,color:dc.accent,background:`${dc.accent}08`}}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
              Tambah Kegiatan Lain
            </button>
          )}
        </div>
        <div className="px-6 pb-6 flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl font-semibold text-sm" style={{background:'rgba(255,255,255,0.95)',color:'#64748b',border:'1px solid rgba(0,0,0,0.12)'}}>Batal</button>
          <button onClick={handleSave} disabled={saving||loadingE}
            className="flex-1 text-white py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:scale-[1.02] disabled:opacity-60"
            style={{background:dc.grad,boxShadow:`0 4px 14px ${dc.accent}35`}}>
            {saving&&<div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>}💾 Simpan Detail
          </button>
        </div>
      </div>
    </div>
  );
}
