'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useDivisiSales } from '@/lib/merek';
import { ModalPortal } from '@/components/shared';
import {
  PiketRow, KegiatanEntry, JenisKegiatan, UserRow, ProdukLain,
  DAY_COLOR, JENIS_KEGIATAN_LIST, KEGIATAN_COLORS,
  KEBUTUHAN_LIST, PRODUK_LIST, TEAM_LABEL,
} from './shared';
import { useKelompokPTS, namaKelompokPTS, labelKelompokPTS } from '@/lib/kelompok';

interface KFEntry {
  id?:string; jenis_kegiatan:JenisKegiatan; jam_mulai:string; jam_selesai:string; produk:string[];
  produk_lain:ProdukLain[];
  tamu_instansi:string; nama_sales:string; sales_division:string; kebutuhan:string[]; keterangan:string;
  team_rnd:string;
}
const emptyKF=():KFEntry=>({jenis_kegiatan:'Demo Product',jam_mulai:'09:00',jam_selesai:'10:00',produk:[],produk_lain:[],tamu_instansi:'',nama_sales:'',sales_division:'',kebutuhan:[],keterangan:'',team_rnd:''});

export function FillDetailModal({row,onClose,onSaved,currentUser}:{row:PiketRow;onClose:()=>void;onSaved:()=>void;currentUser?:any}) {
  const kelompokPTSList = useKelompokPTS();
  const daftarDivisi = useDivisiSales();
  const [entries,setEntries]=useState<KFEntry[]>([emptyKF()]);
  const [loadingE,setLoadingE]=useState(true);
  const [ptUsers,setPtUsers]=useState<(UserRow&{id:string;full_name:string})[]>([]);
  const [saving,setSaving]=useState(false);
  const [toast,setToast]=useState<{type:'success'|'error';msg:string}|null>(null);
  // M10 (docs/UX-WORKFLOW-AUDIT.md): dulu tidak ada peringatan sama sekali
  // saat menutup modal ini dengan isian belum tersimpan - klik area gelap
  // di luar modal (kebiasaan umum menutup modal) langsung membuang semua
  // isian tanpa peringatan. dirty ditandai true oleh SEMUA fungsi yang
  // mengubah entries setelah pemuatan awal (bukan oleh useEffect load).
  const [dirty,setDirty]=useState(false);
  const requestClose=()=>{
    if(!dirty){onClose();return;}
    if(window.confirm('Ada isian yang belum disimpan. Yakin mau menutup tanpa menyimpan?'))onClose();
  };
  const dc=DAY_COLOR[row.day_of_week];
  const notify=(type:'success'|'error',msg:string)=>{setToast({type,msg});setTimeout(()=>setToast(null),3500);};

  useEffect(()=>{
    (async()=>{
      setLoadingE(true);
      const[detailRes,usersRes,plRes]=await Promise.all([
        supabase.from('piket_tamu_detail').select('*').eq('piket_id',row.id).order('created_at'),
        supabase.from('users').select('id,full_name,team_type,role').in('team_type',namaKelompokPTS()).order('full_name'),
        supabase.from('piket_produk_lain').select('kegiatan_id,nama,watt').eq('piket_id',row.id),
      ]);
      const plByKg:Record<string,ProdukLain[]>={};
      (plRes.data||[]).forEach((pl:{kegiatan_id:string;nama:string;watt:number})=>{(plByKg[pl.kegiatan_id]=plByKg[pl.kegiatan_id]||[]).push({nama:pl.nama||'',watt:pl.watt||0});});
      if(detailRes.data&&detailRes.data.length>0){
        setEntries((detailRes.data as KegiatanEntry[]).map(d=>({
          id:d.id,jenis_kegiatan:d.jenis_kegiatan||'Demo Product',
          jam_mulai:d.jam_mulai||'09:00',jam_selesai:d.jam_selesai||'10:00',produk:d.produk||[],
          produk_lain:plByKg[d.id||'']||[],
          tamu_instansi:d.tamu_instansi||'',nama_sales:d.nama_sales||'',sales_division:d.sales_division||'',
          kebutuhan:d.kebutuhan||[],keterangan:d.keterangan||'',
          team_rnd:(d as any).team_rnd||'',
        })));
      }
      if(usersRes.data)setPtUsers(usersRes.data.filter((u:any)=>u.role!=='admin'&&u.role!=='superadmin') as any[]);
      setLoadingE(false);
    })();
  },[row.id]);

  const upd=(i:number,p:Partial<KFEntry>)=>{setDirty(true);setEntries(prev=>prev.map((e,x)=>x===i?{...e,...p}:e));};
  const toggleK=(i:number,k:string)=>{setDirty(true);setEntries(prev=>prev.map((e,x)=>x===i?{...e,kebutuhan:e.kebutuhan.includes(k)?e.kebutuhan.filter(v=>v!==k):[...e.kebutuhan,k]}:e));};
  const toggleP=(i:number,p:string)=>{
    setDirty(true);
    if(p==='All Product') setEntries(prev=>prev.map((e,x)=>x===i?{...e,produk:e.produk.includes('All Product')?[]:['All Product']}:e));
    else setEntries(prev=>prev.map((e,x)=>{if(x!==i)return e;const wo=e.produk.filter(v=>v!=='All Product');return{...e,produk:wo.includes(p)?wo.filter(v=>v!==p):[...wo,p]};}));
  };
  const addProdukLain=(i:number)=>{setDirty(true);setEntries(prev=>prev.map((e,x)=>x===i?{...e,produk_lain:[...e.produk_lain,{nama:'',watt:0}]}:e));};
  const updProdukLain=(i:number,j:number,p:Partial<ProdukLain>)=>{setDirty(true);setEntries(prev=>prev.map((e,x)=>x===i?{...e,produk_lain:e.produk_lain.map((pl,y)=>y===j?{...pl,...p}:pl)}:e));};
  const rmProdukLain=(i:number,j:number)=>{setDirty(true);setEntries(prev=>prev.map((e,x)=>x===i?{...e,produk_lain:e.produk_lain.filter((_,y)=>y!==j)}:e));};

  const getPTSTeamLabel=(name:string)=>{
    const u=ptUsers.find(x=>x.full_name===name);
    const tt=u?.team_type||'';
    return tt?labelKelompokPTS(tt):'';
  };

  const handleSave=async()=>{
    setSaving(true);
    try{
      /*
        Diperiksa: baris LAMA harus benar-benar terhapus sebelum baris baru
        disisipkan di bawah. Kalau RLS menolak diam-diam (0 baris, tanpa
        galat) dan insert-nya tetap jalan, hasilnya BUKAN "tersimpan ulang" -
        entri lama dan baru sama-sama ada, dobel.
      */
      const{error:delErr}=await supabase.from('piket_tamu_detail').delete().eq('piket_id',row.id).select('id');
      if(delErr) throw delErr;
      const editedByName=currentUser?.full_name||null;
      const now=new Date().toISOString();
      // id kegiatan dibuat di client agar bisa langsung dipakai sebagai kegiatan_id produk_lain
      const newId=()=>(typeof crypto!=='undefined'&&crypto.randomUUID)?crypto.randomUUID():`kg-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const withId=entries.filter(e=>e.jenis_kegiatan).map(e=>({kgId:newId(),e}));
      const ins=withId.map(({kgId,e})=>({
        id:kgId,piket_id:row.id,jenis_kegiatan:e.jenis_kegiatan,
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
      // Produk Lain  tabel piket_produk_lain (kegiatan_id = id kegiatan yg barusan dibuat)
      const plRows=withId.flatMap(({kgId,e})=>
        (e.produk_lain||[]).filter(x=>x.nama.trim()!==''||(x.watt||0)>0)
          .map(pl=>({kegiatan_id:kgId,piket_id:row.id,nama:pl.nama.trim(),watt:pl.watt||0}))
      );
      if(plRows.length>0){const{error:plErr}=await supabase.from('piket_produk_lain').insert(plRows);if(plErr)console.warn('Gagal simpan produk_lain:',plErr.message);}
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
  <ModalPortal>
    <div role="dialog" aria-modal="true" className="fixed inset-0 bg-black/60 flex items-center justify-center z-[1100] p-4" onClick={e=>{if(e.target===e.currentTarget)requestClose();}}>
      <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl w-full max-w-2xl my-4 flex flex-col" style={{animation:'scale-in 0.25s ease-out',border:`1.5px solid ${dc.accent}40`,maxHeight:'96dvh'}}>
        <div className="px-6 py-5 rounded-t-2xl flex-shrink-0 relative" style={{background:dc.grad}}>
          <div>
            <p className="text-[9px] font-bold uppercase tracking-widest text-white/50 mb-0.5">Hari Piket</p>
            <h2 className="text-lg font-bold text-white">✍️ Detail Piket — {row.day_of_week}</h2>
            <p className="text-[9px] font-bold uppercase tracking-widest text-white/50 mt-1.5 mb-0.5">Tanggal · PIC</p>
            <p className="text-white/70 text-xs">{new Date(row.day_date+'T00:00:00').toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'})} · {[row.pic_ivp_name,row.pic_ump_name,row.pic_mvi_name].filter(Boolean).join(' / ')||'Belum ada PIC'}</p>
          </div>
          <button aria-label="Tutup" onClick={requestClose} className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/20 hover:bg-black/35 text-white flex items-center justify-center font-bold text-sm">✕</button>
        </div>
        {toast&&<div className={`mx-5 mt-4 px-4 py-3 rounded-xl text-sm font-semibold flex gap-2 flex-shrink-0 ${toast.type==='success'?'bg-emerald-50 text-emerald-700 border border-emerald-200':'bg-red-50 text-red-700 border border-red-200'}`}><span>{toast.type==='success'?'✅':'❌'}</span><span>{toast.msg}</span></div>}
        <div className="p-6 space-y-5 overflow-y-auto flex-1 min-h-0">
          {loadingE?<div className="flex justify-center py-10"><div className="w-6 h-6 rounded-full border-2 border-t-red-600 border-red-200 animate-spin"/></div>
          :entries.map((entry,idx)=>(
            <div key={idx} className="rounded-2xl overflow-hidden" style={{border:`1.5px solid ${dc.accent}30`,background:'rgba(255,255,255,0.7)'}}>
              <div className="flex items-center justify-between px-4 py-2.5" style={{background:dc.light,borderBottom:`1px solid ${dc.accent}20`}}>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-black text-white" style={{background:dc.grad}}>{idx+1}</div>
                  <span className="text-xs font-bold" style={{color:dc.accent}}>Kegiatan {idx+1}</span>
                </div>
                {entries.length>1&&<button onClick={()=>{setDirty(true);setEntries(p=>p.filter((_,i)=>i!==idx));}} className="text-xs font-bold px-2 py-1 rounded-lg text-red-600 hover:bg-red-50" style={{border:'1px solid rgba(220,38,38,0.3)'}}>🗑️ Hapus</button>}
              </div>
              <div className="p-4 space-y-4">
                <div>
                  <label className="block text-[10px] font-bold mb-1.5 tracking-widest uppercase text-slate-400">🎯 Jenis Kegiatan</label>
                  <select aria-label="🎯 Jenis Kegiatan" value={entry.jenis_kegiatan} onChange={e=>upd(idx,{jenis_kegiatan:e.target.value as JenisKegiatan})}
                    className="w-full rounded-xl px-3 py-2.5 text-sm outline-none bg-white" style={{border:'1px solid rgba(0,0,0,0.12)'}}>
                    {JENIS_KEGIATAN_LIST.map(j=><option key={j} value={j}>{j}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold mb-1.5 tracking-widest uppercase text-slate-400">🕐 Jam Mulai</label>
                    <input aria-label="🕐 Jam Mulai" type="time" value={entry.jam_mulai} onChange={e=>upd(idx,{jam_mulai:e.target.value})}
                      className="w-full rounded-xl px-3 py-2.5 text-sm outline-none" style={{background:'rgba(255,255,255,0.95)',border:'1px solid rgba(0,0,0,0.12)'}}/>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold mb-1.5 tracking-widest uppercase text-slate-400">🕐 Jam Selesai</label>
                    <input aria-label="🕐 Jam Selesai" type="time" value={entry.jam_selesai} onChange={e=>upd(idx,{jam_selesai:e.target.value})}
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
                            {chk&&<svg aria-hidden="true" focusable="false" className="w-2 h-2 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/></svg>}
                          </div>
                          <span className="text-xs font-semibold leading-tight">{p}</span>
                        </button>
                      );
                    })}
                  </div>
                  {entry.produk.length>0&&(
                    <div className="mt-2 p-2.5 rounded-xl flex flex-wrap gap-1.5" style={{background:'rgba(0,0,0,0.03)',border:'1px solid rgba(0,0,0,0.08)'}}>
                      {entry.produk.map(p=><span key={p} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold text-white" style={{background:dc.grad}}>{p}<button aria-label="Tutup" onClick={()=>toggleP(idx,p)} className="ml-0.5 opacity-80">✕</button></span>)}
                    </div>
                  )}
                </div>
                {/* Produk Lain — barang temporer di luar list + beban daya (watt) */}
                <div>
                  <label className="block text-[10px] font-bold mb-1.5 tracking-widest uppercase text-slate-400">⚡ Produk Lain (di luar list) — beban daya</label>
                  {entry.produk_lain.length===0&&(
                    <p className="text-[11px] text-slate-400 mb-2">Tambah bila ada unit temporer di luar list. Beban dayanya dicatat (Watt); jam hidupnya mengikuti jam mulai/selesai kegiatan ini.</p>
                  )}
                  <div className="space-y-2">
                    {entry.produk_lain.map((pl,j)=>(
                      <div key={j} className="flex items-center gap-2">
                        <input value={pl.nama} onChange={e=>updProdukLain(idx,j,{nama:e.target.value})} placeholder="Nama barang (mis. Genset event)"
                          className="flex-1 rounded-xl px-3 py-2 text-sm outline-none" style={{background:'rgba(255,255,255,0.95)',border:'1px solid rgba(0,0,0,0.12)'}}/>
                        <div className="relative w-28 flex-shrink-0">
                          <input type="number" min={0} value={pl.watt||''} onChange={e=>updProdukLain(idx,j,{watt:Number(e.target.value)||0})} placeholder="Watt"
                            className="w-full rounded-xl pl-3 pr-8 py-2 text-sm outline-none" style={{background:'rgba(255,255,255,0.95)',border:'1px solid rgba(0,0,0,0.12)'}}/>
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">W</span>
                        </div>
                        <button aria-label="Tutup" type="button" onClick={()=>rmProdukLain(idx,j)} className="w-8 h-8 rounded-lg text-red-500 hover:bg-red-50 flex items-center justify-center flex-shrink-0" style={{border:'1px solid rgba(220,38,38,0.25)'}}>✕</button>
                      </div>
                    ))}
                  </div>
                  <button type="button" onClick={()=>addProdukLain(idx)}
                    className="mt-2 w-full py-2 rounded-xl border-2 border-dashed text-xs font-bold flex items-center justify-center gap-1.5"
                    style={{borderColor:`${dc.accent}50`,color:dc.accent,background:`${dc.accent}06`}}>
                    + Tambah Produk Lain
                  </button>
                  {entry.produk_lain.length>0&&(
                    <p className="text-[10px] text-slate-500 mt-1.5">Total beban daya tambahan: <strong>{entry.produk_lain.reduce((s,p)=>s+(p.watt||0),0).toLocaleString('id-ID')} W</strong></p>
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
                        <select aria-label="— Pilih Division —" value={entry.sales_division} onChange={e=>upd(idx,{sales_division:e.target.value})}
                          className="w-full rounded-xl px-3 py-2.5 text-sm outline-none bg-white" style={{border:'1px solid rgba(0,0,0,0.12)'}}>
                          <option value="">— Pilih Division —</option>
                          {daftarDivisi.map(d=><option key={d} value={d}>{d}</option>)}
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
                                {chk&&<svg aria-hidden="true" focusable="false" className="w-2 h-2 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7"/></svg>}
                              </div>
                              <span className="text-xs font-semibold leading-tight">{k}</span>
                            </button>
                          );
                        })}
                      </div>
                      {entry.kebutuhan.length>0&&(
                        <div className="mt-2 p-2.5 rounded-xl flex flex-wrap gap-1.5" style={{background:'rgba(0,0,0,0.03)',border:'1px solid rgba(0,0,0,0.08)'}}>
                          {entry.kebutuhan.map(k=><span key={k} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold text-white" style={{background:dc.grad}}>{k}<button aria-label="Tutup" onClick={()=>toggleK(idx,k)} className="ml-0.5 opacity-80">✕</button></span>)}
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
                          <select aria-label="— Pilih Team —" value={entry.team_rnd} onChange={e=>upd(idx,{team_rnd:e.target.value})}
                            className="flex-1 rounded-xl px-3 py-2.5 text-sm outline-none bg-white" style={{border:'1px solid rgba(0,0,0,0.12)'}}>
                            <option value="">— Pilih Team —</option>
                            {/* Satu optgroup per kelompok PTS dari pengaturan admin. */}
                            {kelompokPTSList.map(k=>{
                              const anggota=ptUsers.filter(u=>u.team_type===k.nama);
                              if(anggota.length===0) return null;
                              return (
                                <optgroup key={k.nama} label={k.nama}>
                                  {anggota.map(u=><option key={u.id} value={u.full_name}>{u.full_name}</option>)}
                                </optgroup>
                              );
                            })}
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
            <button onClick={()=>{setDirty(true);setEntries(p=>[...p,emptyKF()]);}}
              className="w-full py-3 rounded-2xl border-2 border-dashed text-sm font-bold flex items-center justify-center gap-2"
              style={{borderColor:`${dc.accent}60`,color:dc.accent,background:`${dc.accent}08`}}>
              <svg aria-hidden="true" focusable="false" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
              Tambah Kegiatan Lain
            </button>
          )}
        </div>
        <div className="px-6 pb-6 pt-3 flex gap-3 flex-shrink-0 border-t border-gray-100">
          <button onClick={requestClose} className="flex-1 py-3 rounded-xl font-semibold text-sm" style={{background:'rgba(255,255,255,0.95)',color:'#64748b',border:'1px solid rgba(0,0,0,0.12)'}}>Batal</button>
          <button onClick={handleSave} disabled={saving||loadingE}
            className="flex-1 text-white py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:scale-[1.02] disabled:opacity-60"
            style={{background:dc.grad,boxShadow:`0 4px 14px ${dc.accent}35`}}>
            {saving&&<div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>}💾 Simpan Detail
          </button>
        </div>
      </div>
    </div>
  </ModalPortal>
  );
}
