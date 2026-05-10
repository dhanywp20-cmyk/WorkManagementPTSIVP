'use client';
import { PiketRow, KegiatanEntry, DAY_COLOR, TEAM_LABEL, KEGIATAN_COLORS } from './shared';

export function ViewDetailModal({row,kegiatanList,onClose,onEdit}:{row:PiketRow;kegiatanList:KegiatanEntry[];onClose:()=>void;onEdit?:()=>void}) {
  const dc=DAY_COLOR[row.day_of_week];
  const kgs=kegiatanList.filter(k=>k.piket_id===row.id);
  const dateLabel=new Date(row.day_date+'T00:00:00').toLocaleDateString('id-ID',{weekday:'long',day:'numeric',month:'long',year:'numeric'});

  const picList=([
    [row.pic_ivp_name,'PTS IVP'],
    [row.pic_ump_name,'PTS UMP'],
    [row.pic_mlds_name,'PTS MLDS'],
  ] as [string|null,string][]).filter(([n])=>!!n);

  return(
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[10001] p-4 overflow-y-auto"
      onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-4"
        style={{animation:'scale-in 0.2s ease-out',border:`1.5px solid ${dc.accent}40`}}>

        {/* Header */}
        <div className="px-5 py-4 rounded-t-2xl flex items-center justify-between" style={{background:dc.grad}}>
          <div>
            <h2 className="text-base font-black text-white">🔍 Detail Piket — {row.day_of_week}</h2>
            <p className="text-white/70 text-[11px] mt-0.5">{dateLabel}</p>
          </div>
          <button onClick={onClose} className="bg-white/15 hover:bg-white/25 text-white p-2 rounded-lg">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <div className="p-5 space-y-4">

          {/* PIC Row */}
          <div className="grid grid-cols-3 gap-3">
            {picList.length>0?picList.map(([name,team])=>{
              const tc=TEAM_LABEL[team];
              return(
                <div key={team} className="flex items-center gap-2.5 p-3 rounded-xl"
                  style={{background:`${tc.dot}10`,border:`1px solid ${tc.dot}30`}}>
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-black flex-shrink-0"
                    style={{background:tc.dot}}>{name!.charAt(0).toUpperCase()}</div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-800 truncate">{name}</p>
                    <span className="text-[9px] font-bold uppercase" style={{color:tc.dot}}>{team}</span>
                  </div>
                </div>
              );
            }):(
              <div className="col-span-3 text-center py-3 text-gray-400 text-xs">Belum ada PIC</div>
            )}
            {/* Fill empty slots */}
            {picList.length>0&&picList.length<3&&Array(3-picList.length).fill(0).map((_,i)=><div key={i}/>)}
          </div>

          {/* Kegiatan list */}
          {kgs.length===0?(
            <div className="text-center py-6 text-gray-400">
              <div className="text-3xl mb-2">📋</div>
              <p className="text-sm font-semibold">Belum ada kegiatan dicatat</p>
            </div>
          ):(
            <div className="space-y-3">
              {kgs.map((kg,i)=>{
                const kColor=KEGIATAN_COLORS[kg.jenis_kegiatan]||dc.accent;
                return(
                  <div key={i} className="rounded-xl overflow-hidden border" style={{borderColor:`${kColor}30`}}>
                    {/* Kegiatan header */}
                    <div className="px-4 py-2 flex items-center gap-2" style={{background:`${kColor}12`}}>
                      <span className="text-[10px] font-black px-2 py-0.5 rounded text-white" style={{background:kColor}}>{kg.jenis_kegiatan}</span>
                      <span className="text-[10px] text-slate-500 font-semibold">Kegiatan {i+1}</span>
                      {kg.jam_mulai&&<span className="ml-auto text-[10px] font-bold text-slate-600">{kg.jam_mulai} – {kg.jam_selesai}</span>}
                    </div>

                    <div className="px-4 py-3 grid grid-cols-2 gap-x-6 gap-y-2.5">
                      {/* Produk */}
                      {kg.produk&&kg.produk.length>0&&(
                        <div className="col-span-2">
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">📦 Produk</p>
                          <div className="flex flex-wrap gap-1">
                            {kg.produk.map(p=>(
                              <span key={p} className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
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
                              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">🏢 Tamu Instansi</p>
                              <p className="text-xs font-semibold text-slate-700">{kg.tamu_instansi}</p>
                            </div>
                          )}
                          {kg.nama_sales&&(
                            <div>
                              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">👤 Sales</p>
                              <p className="text-xs font-semibold text-slate-700">{kg.nama_sales}</p>
                              {kg.sales_division&&<p className="text-[10px] text-purple-500 font-semibold">{kg.sales_division}</p>}
                            </div>
                          )}
                          {kg.kebutuhan&&kg.kebutuhan.length>0&&(
                            <div className="col-span-2">
                              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">🎯 Kebutuhan</p>
                              <div className="flex flex-wrap gap-1">
                                {kg.kebutuhan.map(k=>(
                                  <span key={k} className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">• {k}</span>
                                ))}
                              </div>
                            </div>
                          )}
                        </>
                      )}

                      {/* RnD fields */}
                      {kg.jenis_kegiatan==='RnD'&&(kg as any).team_rnd&&(
                        <div className="col-span-2">
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">👥 Team yang RnD</p>
                          <p className="text-xs font-semibold text-slate-700">{(kg as any).team_rnd}</p>
                        </div>
                      )}

                      {/* Keterangan */}
                      {kg.keterangan&&(
                        <div className="col-span-2">
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">📝 Keterangan</p>
                          <p className="text-xs text-slate-600 leading-relaxed">{kg.keterangan}</p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Footer meta */}
          <div className="flex items-center justify-between pt-1 border-t border-slate-100">
            <div className="text-[10px] text-slate-400">
              {row.edited_by_name&&<span>✏️ Edit by <span className="font-semibold text-slate-600">{row.edited_by_name}</span></span>}
            </div>
            <button onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-white"
              style={{background:dc.grad}}>
              Tutup
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
