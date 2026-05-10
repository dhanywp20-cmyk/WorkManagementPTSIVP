'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { PiketRow, KegiatanEntry, DAY_COLOR, TEAM_LABEL, KEGIATAN_COLORS } from './shared';

export function ViewDetailModal({row,onClose,onEdit}:{row:PiketRow;onClose:()=>void;onEdit?:()=>void}) {
  const [entries,setEntries]=useState<KegiatanEntry[]>([]);
  const [loading,setLoading]=useState(true);
  const dc=DAY_COLOR[row.day_of_week];

  useEffect(()=>{
    (async()=>{
      setLoading(true);
      const{data}=await supabase.from('piket_tamu_detail').select('*').eq('piket_id',row.id).order('created_at');
      if(data)setEntries(data as KegiatanEntry[]);
      setLoading(false);
    })();
  },[row.id]);

  const pics=([['pic_ivp_name','PTS IVP'],['pic_ump_name','PTS UMP'],['pic_mlds_name','PTS MLDS']] as [keyof PiketRow,string][]).filter(([f])=>row[f]);
  const dateStr=new Date(row.day_date+'T00:00:00').toLocaleDateString('id-ID',{weekday:'long',day:'numeric',month:'long',year:'numeric'});

  return(
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[10000] p-4 overflow-y-auto" onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
      <div className="bg-white/97 backdrop-blur-md rounded-2xl shadow-2xl w-full max-w-3xl my-4" style={{animation:'scale-in 0.2s ease-out',border:`1.5px solid ${dc.accent}40`}}>

        {/* Header */}
        <div className="px-6 py-4 rounded-t-2xl flex items-center justify-between" style={{background:dc.grad}}>
          <div>
            <h2 className="text-base font-black text-white">👁️ Detail Piket — {row.day_of_week}</h2>
            <p className="text-white/70 text-xs mt-0.5">{dateStr}</p>
          </div>
          <div className="flex items-center gap-2">
            {onEdit&&(
              <button onClick={onEdit} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-white/20 hover:bg-white/30 text-white transition-all">
                ✍️ Edit
              </button>
            )}
            <button onClick={onClose} className="bg-white/15 hover:bg-white/25 text-white p-2 rounded-lg">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>
        </div>

        <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">

          {/* Info baris atas: PIC + meta */}
          <div className="grid grid-cols-2 gap-3">
            {/* PIC */}
            <div className="rounded-xl p-3.5" style={{background:`${dc.accent}08`,border:`1px solid ${dc.accent}20`}}>
              <p className="text-[9px] font-black uppercase tracking-widest mb-2" style={{color:dc.accent}}>👤 PIC Piket</p>
              {pics.length>0?(
                <div className="space-y-1.5">
                  {pics.map(([f,team])=>{
                    const name=row[f] as string;
                    const tc=TEAM_LABEL[team];
                    return(
                      <div key={team} className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black text-white flex-shrink-0" style={{background:tc.dot}}>{name.charAt(0).toUpperCase()}</div>
                        <div><p className="text-sm font-bold text-slate-800 leading-tight">{name}</p><span className="text-[9px] font-bold uppercase" style={{color:tc.text}}>{team}</span></div>
                      </div>
                    );
                  })}
                </div>
              ):<span className="text-slate-300 text-sm">—</span>}
            </div>

            {/* Meta */}
            <div className="rounded-xl p-3.5 space-y-2" style={{background:'rgba(248,250,252,0.8)',border:'1px solid rgba(0,0,0,0.07)'}}>
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">📋 Info Jadwal</p>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                <div><span className="text-[9px] text-slate-400 block">Tanggal</span><span className="font-bold text-slate-700">{new Date(row.day_date+'T00:00:00').toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric'})}</span></div>
                <div><span className="text-[9px] text-slate-400 block">Hari</span><span className="font-bold" style={{color:dc.accent}}>{row.day_of_week}</span></div>
                <div><span className="text-[9px] text-slate-400 block">Total Kegiatan</span><span className="font-bold text-slate-700">{loading?'…':entries.length}</span></div>
                <div><span className="text-[9px] text-slate-400 block">Edit Oleh</span><span className="font-bold text-slate-600">{row.edited_by_name||'—'}</span></div>
              </div>
            </div>
          </div>

          {/* Kegiatan list */}
          {loading?(
            <div className="flex justify-center py-8"><div className="w-5 h-5 rounded-full border-2 border-t-red-600 border-red-200 animate-spin"/></div>
          ):entries.length===0?(
            <div className="text-center py-8 rounded-xl" style={{background:'rgba(0,0,0,0.02)',border:'1px dashed rgba(0,0,0,0.1)'}}>
              <p className="text-3xl mb-2">📋</p>
              <p className="text-sm text-slate-400 font-medium">Belum ada kegiatan tercatat</p>
            </div>
          ):(
            <div className="space-y-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">📌 Daftar Kegiatan ({entries.length})</p>
              {entries.map((kg,i)=>{
                const kgColor=KEGIATAN_COLORS[kg.jenis_kegiatan]||dc.accent;
                const isDemo=kg.jenis_kegiatan==='Demo Product';
                const isRnD=kg.jenis_kegiatan==='RnD';
                return(
                  <div key={kg.id||i} className="rounded-xl overflow-hidden" style={{border:`1px solid ${kgColor}25`}}>
                    {/* Kegiatan header bar */}
                    <div className="px-4 py-2 flex items-center gap-2" style={{background:`${kgColor}12`}}>
                      <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black text-white flex-shrink-0" style={{background:kgColor}}>{i+1}</div>
                      <span className="text-xs font-black" style={{color:kgColor}}>{kg.jenis_kegiatan}</span>
                      {kg.jam_mulai&&kg.jam_selesai&&(
                        <span className="ml-auto text-[10px] font-bold text-slate-500 bg-white/70 px-2 py-0.5 rounded-md">
                          🕐 {kg.jam_mulai} – {kg.jam_selesai}
                        </span>
                      )}
                    </div>

                    {/* Kegiatan body: grid layout */}
                    <div className="px-4 py-3 grid grid-cols-3 gap-x-4 gap-y-2.5">
                      {/* Produk */}
                      <div className="col-span-3">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">📦 Produk</span>
                        {kg.produk&&kg.produk.length>0?(
                          <div className="flex flex-wrap gap-1">
                            {kg.produk.map(p=><span key={p} className="text-[10px] font-bold px-2 py-0.5 rounded-md text-white" style={{background:kgColor}}>{p}</span>)}
                          </div>
                        ):<span className="text-slate-300 text-xs">—</span>}
                      </div>

                      {/* Demo Product fields */}
                      {isDemo&&(
                        <>
                          <div>
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">🏢 Tamu</span>
                            <span className="text-sm font-bold text-slate-800">{kg.tamu_instansi||'—'}</span>
                          </div>
                          <div>
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">👤 Sales</span>
                            <span className="text-xs font-semibold text-slate-700">{kg.nama_sales||'—'}</span>
                          </div>
                          <div>
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">🏷️ Division</span>
                            <span className="text-xs font-semibold text-purple-600">{kg.sales_division||'—'}</span>
                          </div>
                          {kg.kebutuhan&&kg.kebutuhan.length>0&&(
                            <div className="col-span-3">
                              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">🎯 Kebutuhan</span>
                              <div className="flex flex-wrap gap-1">
                                {kg.kebutuhan.map(k=><span key={k} className="text-[10px] font-semibold px-2 py-0.5 rounded-md" style={{background:`${kgColor}15`,color:kgColor}}>{k}</span>)}
                              </div>
                            </div>
                          )}
                        </>
                      )}

                      {/* RnD fields */}
                      {isRnD&&(kg as any).team_rnd&&(
                        <div className="col-span-2">
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">👥 Team RnD</span>
                          <span className="text-xs font-bold text-slate-700">{(kg as any).team_rnd}</span>
                        </div>
                      )}

                      {/* Keterangan (non-demo) */}
                      {!isDemo&&kg.keterangan&&(
                        <div className="col-span-3">
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-0.5">📝 Keterangan</span>
                          <span className="text-xs text-slate-600 leading-relaxed">{kg.keterangan}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 flex justify-end gap-2">
          {onEdit&&(
            <button onClick={onEdit} className="px-5 py-2.5 rounded-xl font-bold text-sm text-white flex items-center gap-1.5 transition-all hover:scale-[1.02]" style={{background:dc.grad,boxShadow:`0 4px 14px ${dc.accent}30`}}>
              ✍️ Edit Detail
            </button>
          )}
          <button onClick={onClose} className="px-5 py-2.5 rounded-xl font-semibold text-sm" style={{background:'rgba(255,255,255,0.95)',color:'#64748b',border:'1px solid rgba(0,0,0,0.12)'}}>
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
