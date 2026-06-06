'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { PiketRow, KegiatanEntry, DAY_COLOR, TEAM_LABEL, KEGIATAN_COLORS } from './shared';

export function ViewDetailModal({row,kegiatanList,currentUser,onClose,onEdit}:{row:PiketRow;kegiatanList:KegiatanEntry[];currentUser?:any;onClose:()=>void;onEdit?:()=>void}) {
  const dc=DAY_COLOR[row.day_of_week];
  const kgs=kegiatanList.filter(k=>k.piket_id===row.id);
  const dateLabel=new Date(row.day_date+'T00:00:00').toLocaleDateString('id-ID',{weekday:'long',day:'numeric',month:'long',year:'numeric'});

  const picList=([
    [row.pic_ivp_name,'PTS IVP'],
    [row.pic_ump_name,'PTS UMP'],
    [row.pic_mlds_name,'PTS MLDS'],
  ] as [string|null,string][]).filter(([n])=>!!n);

  const handleEditClick = () => {
    onEdit?.();
  };

  const formatTime = (timeStr: string) => {
    if(!timeStr) return '';
    const [h,m] = timeStr.split(':');
    return `${h}:${m}`;
  };

  return(
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[110] p-4 overflow-y-auto"
      onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl my-4"
        style={{animation:'scale-in 0.2s ease-out',border:`1.5px solid ${dc.accent}40`}}>

        {/* Header */}
        <div className="px-6 py-5 rounded-t-2xl flex items-center justify-between" style={{background:dc.grad}}>
          <div>
            <h2 className="text-lg font-black text-white">📋 Detail Jadwal Piket</h2>
            <p className="text-white/70 text-xs mt-1">{row.day_of_week} · {dateLabel}</p>
          </div>
          <button onClick={onClose} className="bg-white/15 hover:bg-white/25 text-white p-2 rounded-lg transition-all">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-6">

          {/* PIC Section */}
          <div>
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3">👥 Petugas Piket (PIC)</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {picList.length>0?picList.map(([name,team])=>{
                const tc=TEAM_LABEL[team];
                return(
                  <div key={team} className="flex items-center gap-3 p-4 rounded-xl transition-all"
                    style={{background:`${tc.dot}08`,border:`1.5px solid ${tc.dot}25`}}>
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-black flex-shrink-0"
                      style={{background:tc.dot}}>{name!.charAt(0).toUpperCase()}</div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-slate-800 truncate">{name}</p>
                      <span className="text-[10px] font-bold uppercase tracking-wide" style={{color:tc.dot}}>{team}</span>
                    </div>
                  </div>
                );
              }):(
                <div className="col-span-3 py-4 text-center text-gray-400 text-sm">Belum ada PIC ditetapkan</div>
              )}
            </div>
          </div>

          {/* Kegiatan Section */}
          {kgs.length===0?(
            <div className="text-center py-10 px-6 rounded-xl" style={{background:'rgba(0,0,0,0.03)',border:'1.5px dashed rgba(0,0,0,0.1)'}}>
              <div className="text-4xl mb-2">📋</div>
              <p className="text-sm font-bold text-gray-600">Belum ada kegiatan dicatat</p>
              <p className="text-xs text-gray-500 mt-1">Tambahkan kegiatan dengan mengklik tombol Edit</p>
            </div>
          ):(
            <div className="space-y-4">
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest">📌 Daftar Kegiatan</p>
              {kgs.map((kg,i)=>{
                const kColor=KEGIATAN_COLORS[kg.jenis_kegiatan]||dc.accent;
                return(
                  <div key={i} className="rounded-xl overflow-hidden border-2" style={{borderColor:`${kColor}25`,background:'rgba(255,255,255,0.5)'}}>
                    {/* Kegiatan header */}
                    <div className="px-4 py-3 flex items-center justify-between" style={{background:`${kColor}08`,borderBottom:`1px solid ${kColor}20`}}>
                      <div className="flex items-center gap-3">
                        <span className="text-[11px] font-black px-2.5 py-1 rounded text-white" style={{background:kColor}}>{kg.jenis_kegiatan}</span>
                        <span className="text-[11px] font-bold text-slate-500">Kegiatan {i+1}</span>
                      </div>
                      {kg.jam_mulai&&<span className="text-xs font-bold text-slate-600">{formatTime(kg.jam_mulai)} – {formatTime(kg.jam_selesai)}</span>}
                    </div>

                    <div className="px-4 py-4 grid grid-cols-2 gap-x-6 gap-y-4">
                      {/* Jam Section */}
                      {kg.jam_mulai&&(
                        <div className="col-span-2 grid grid-cols-2 gap-6">
                          <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">⏰ Jam Mulai</p>
                            <p className="text-sm font-bold text-slate-700">{formatTime(kg.jam_mulai)}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">⏱️ Jam Selesai</p>
                            <p className="text-sm font-bold text-slate-700">{formatTime(kg.jam_selesai)}</p>
                          </div>
                        </div>
                      )}

                      {/* Produk */}
                      {kg.produk&&kg.produk.length>0&&(
                        <div className="col-span-2">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">📦 Produk yang Digunakan</p>
                          <div className="flex flex-wrap gap-2">
                            {kg.produk.map(p=>(
                              <span key={p} className="text-xs font-bold px-3 py-1.5 rounded-full"
                                style={{background:`${kColor}15`,color:kColor,border:`1px solid ${kColor}30`}}>{p}</span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Demo Product fields */}
                      {kg.jenis_kegiatan==='Demo Product'&&(
                        <>
                          {kg.tamu_instansi&&(
                            <div>
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">🏢 Tamu Instansi</p>
                              <p className="text-sm font-bold text-slate-700">{kg.tamu_instansi}</p>
                            </div>
                          )}
                          {kg.nama_sales&&(
                            <div>
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">👤 Nama Sales</p>
                              <div>
                                <p className="text-sm font-bold text-slate-700">{kg.nama_sales}</p>
                                {kg.sales_division&&<p className="text-[11px] text-purple-600 font-bold mt-0.5">{kg.sales_division}</p>}
                              </div>
                            </div>
                          )}
                          {kg.kebutuhan&&kg.kebutuhan.length>0&&(
                            <div className="col-span-2">
                              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">🎯 Kebutuhan Tamu</p>
                              <div className="flex flex-wrap gap-2">
                                {kg.kebutuhan.map(k=>(
                                  <span key={k} className="text-xs font-bold px-3 py-1.5 rounded-full bg-slate-100 text-slate-700">• {k}</span>
                                ))}
                              </div>
                            </div>
                          )}
                        </>
                      )}

                      {/* RnD fields */}
                      {kg.jenis_kegiatan==='RnD'&&(kg as any).team_rnd&&(
                        <div className="col-span-2">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">👥 Team yang RnD</p>
                          <p className="text-sm font-bold text-slate-700">{(kg as any).team_rnd}</p>
                        </div>
                      )}

                      {/* Keterangan */}
                      {kg.keterangan&&(
                        <div className="col-span-2">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">📝 Keterangan</p>
                          <p className="text-sm text-slate-700 leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-200">{kg.keterangan}</p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Meta Info */}
          <div className="pt-4 border-t border-slate-200">
            <div className="flex items-center justify-between text-xs">
              <div>
                {(()=>{
                  // Ambil edited_by_name dari kegiatan yang paling terakhir di-update
                  const lastEdited=kgs.filter(k=>k.edited_by_name).sort((a,b)=>new Date(b.updated_at||b.created_at||0).getTime()-new Date(a.updated_at||a.created_at||0).getTime())[0];
                  return lastEdited?.edited_by_name?(
                    <div className="flex items-center gap-2 text-slate-600">
                      <span className="text-lg">✏️</span>
                      <div>
                        <p className="font-bold">Terakhir diubah oleh</p>
                        <p className="text-slate-500">{lastEdited.edited_by_name}</p>
                        {lastEdited.updated_at&&<p className="text-[10px] text-slate-400">{new Date(lastEdited.updated_at).toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})}</p>}
                      </div>
                    </div>
                  ):null;
                })()}
              </div>
              {row.updated_at&&(
                <div className="text-right text-slate-500">
                  <p className="text-[10px]">{new Date(row.updated_at).toLocaleDateString('id-ID')}</p>
                  <p className="text-[10px]">{new Date(row.updated_at).toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'})}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 flex gap-3 border-t border-slate-200" style={{background:'rgba(0,0,0,0.02)'}}>
          <button onClick={onClose} className="flex-1 px-4 py-3 rounded-xl font-bold text-sm transition-all"
            style={{background:'rgba(100,116,139,0.1)',color:'#475569',border:'1px solid rgba(100,116,139,0.25)'}}>
            Tutup
          </button>
          <button onClick={handleEditClick} className="flex-1 px-4 py-3 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2 transition-all hover:scale-[1.02]"
            style={{background:dc.grad,boxShadow:`0 4px 12px ${dc.accent}30`}}>
            ✏️ Edit
          </button>
        </div>
      </div>
    </div>
  );
}
