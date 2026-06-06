'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import {
  PiketRow, UserRow, DayOfWeek,
  DAYS_OF_WEEK, DAY_COLOR, DAY_EN, TEAM_LABEL,
  addDays, toKey, getDayDate, isToday, getRollingUserIdForDate,
} from './shared';

export function ScheduleModal({weekStart,users,currentUser,onClose,onSaved}:{weekStart:Date;users:UserRow[];currentUser:any;onClose:()=>void;onSaved:()=>void}) {
  const week2Start=addDays(weekStart,7);
  const wk1=toKey(weekStart),wk2=toKey(week2Start);
  type W2 = Record<string,Record<DayOfWeek,string>>;
  const initW2=():W2=>{const r:W2={[wk1]:{}as any,[wk2]:{}as any};DAYS_OF_WEEK.forEach(d=>{r[wk1][d]='';r[wk2][d]='';});return r;};
  const [assign,setAssign]=useState<W2>(initW2);
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [toast,setToast]=useState<{type:'success'|'error';msg:string}|null>(null);
  const notify=(type:'success'|'error',msg:string)=>{setToast({type,msg});setTimeout(()=>setToast(null),3000);};

  useEffect(()=>{
    (async()=>{
      setLoading(true);
      const{data}=await supabase.from('piket_schedules').select('*').in('week_start',[wk1,wk2]);
      const na=initW2();
      if(data&&data.length>0){
        (data as PiketRow[]).forEach(s=>{if(na[s.week_start])na[s.week_start][s.day_of_week]=s.pic_ivp_id||s.pic_ump_id||s.pic_mlds_id||'';});
      }
      // Pre-fill hari kosong dari rolling — pola berulang selamanya sampai admin ubah
      const{data:allData}=await supabase.from('piket_schedules').select('week_start,day_of_week,pic_ivp_id,pic_ump_id,pic_mlds_id');
      if(allData&&allData.length>0){
        const allRows=allData as PiketRow[];
        [[wk1,weekStart],[wk2,week2Start]].forEach(([wk,ws])=>{
          DAYS_OF_WEEK.forEach(day=>{
            if(!na[wk as string][day]){
              const date=getDayDate(ws as Date,day);
              const uid=getRollingUserIdForDate(date,allRows);
              if(uid) na[wk as string][day]=uid;
            }
          });
        });
      }
      setAssign(na);
      setLoading(false);
    })();
  },[wk1,wk2]);

  const handleSave=async()=>{
    setSaving(true);
    try{
      const editedByName=currentUser?.full_name||null;

      // Fetch existing rows sekali untuk cek mana yang sudah ada di DB
      const{data:existingRows}=await supabase
        .from('piket_schedules')
        .select('id,week_start,day_of_week,created_at')
        .in('week_start',[wk1,wk2]);
      const existingMap=new Map<string,{id:string;created_at:string}>();
      (existingRows||[]).forEach((r:any)=>existingMap.set(`${r.week_start}__${r.day_of_week}`,{id:r.id,created_at:r.created_at}));

      for(const [wk,ws] of [[wk1,weekStart],[wk2,week2Start]] as [string,Date][]){
        for(const day of DAYS_OF_WEEK){
          const uid=assign[wk]?.[day]||'';

          // FIX #1: Skip hari "— Belum —" — jangan timpa data existing dengan null
          if(!uid) continue;

          const u=users.find(x=>x.id===uid);

          // FIX #2: Skip jika user tidak ditemukan — jangan simpan row rusak
          if(!u){
            console.warn(`[ScheduleModal] User not found for id: "${uid}", skipping ${day} ${wk}`);
            continue;
          }

          const tt=u.team_type||'';
          const isIVP=tt==='Team PTS';
          const isUMP=tt==='Team PTS UMP';
          const isMlds=tt==='Team PTS MLDS';

          const existing=existingMap.get(`${wk}__${day}`);

          const payload: Record<string,any> = {
            week_start:wk,
            day_of_week:day,
            day_date:toKey(getDayDate(ws,day)),
            pic_ivp_id:isIVP?uid:null,
            pic_ivp_name:isIVP?u.full_name||null:null,
            pic_ump_id:isUMP?uid:null,
            pic_ump_name:isUMP?u.full_name||null:null,
            pic_mlds_id:isMlds?uid:null,
            pic_mlds_name:isMlds?u.full_name||null:null,
            // FIX #3: Pertahankan created_at asli jika row sudah exist, baru set jika insert baru
            created_at:existing?.created_at||new Date().toISOString(),
            updated_at:new Date().toISOString(),
          };

          if(editedByName) payload.edited_by_name=editedByName;

          const{error}=await supabase.from('piket_schedules').upsert(payload,{onConflict:'week_start,day_of_week',ignoreDuplicates:false});
          if(error){notify('error',`Gagal ${day} ${wk}: ${error.message}`);setSaving(false);return;}
        }
      }
      notify('success','Jadwal 2 minggu tersimpan!');
      setTimeout(()=>{onSaved();onClose();},800);
    }catch(e:any){notify('error','Gagal: '+e.message);}
    setSaving(false);
  };

  const fmtWk=(ws:Date)=>`${ws.toLocaleDateString('id-ID',{day:'2-digit',month:'short'})} – ${addDays(ws,4).toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric'})}`;

  return(
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[110] p-4 overflow-y-auto">
      <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl w-full max-w-2xl my-4" style={{animation:'scale-in 0.25s ease-out',border:'1.5px solid rgba(220,38,38,0.25)'}}>
        <div className="px-6 py-5 rounded-t-2xl" style={{background:'linear-gradient(135deg,#dc2626,#991b1b)'}}>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-white">📋 Atur Jadwal Piket — 2 Minggu</h2>
              <p className="text-red-200/80 text-xs mt-0.5">{fmtWk(weekStart)} &amp; {fmtWk(week2Start)}</p>
            </div>
            <button onClick={onClose} className="bg-white/15 hover:bg-white/25 text-white p-2 rounded-lg">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>
        </div>
        {toast&&<div className={`mx-5 mt-3 px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 ${toast.type==='success'?'bg-emerald-50 text-emerald-700 border border-emerald-200':'bg-red-50 text-red-700 border border-red-200'}`}>{toast.type==='success'?'✅':'❌'} {toast.msg}</div>}

        <div className="p-5 max-h-[58vh] overflow-y-auto space-y-4">
          {loading?<div className="flex justify-center py-10"><div className="w-6 h-6 rounded-full border-2 border-t-red-600 border-red-200 animate-spin"/></div>:(
            <>
              {/* Column headers */}
              <div className="grid grid-cols-[100px_1fr_1fr] gap-2">
                <div/>
                {[{wk:wk1,ws:weekStart},{wk:wk2,ws:week2Start}].map(({wk,ws})=>(
                  <div key={wk} className="text-center py-1.5 rounded-lg text-[10px] font-bold" style={{background:'rgba(220,38,38,0.07)',color:'#dc2626',border:'1px solid rgba(220,38,38,0.2)'}}>
                    📅 {fmtWk(ws)}
                  </div>
                ))}
              </div>
              {DAYS_OF_WEEK.map((day)=>{
                const dc=DAY_COLOR[day];
                return(
                  <div key={day} className="grid grid-cols-[100px_1fr_1fr] gap-2 items-center">
                    {/* Day label */}
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{background:dc.light}}>
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-[10px] font-black flex-shrink-0" style={{background:dc.grad}}>{DAY_EN[day]}</div>
                      <span className="text-xs font-bold" style={{color:dc.accent}}>{day}</span>
                    </div>
                    {/* 2 week dropdowns */}
                    {[{wk:wk1,ws:weekStart},{wk:wk2,ws:week2Start}].map(({wk,ws})=>{
                      const date=getDayDate(ws,day);
                      const u=users.find(x=>x.id===assign[wk]?.[day]);
                      const tt=u?.team_type||'';
                      const teamKey=tt==='Team PTS'?'PTS IVP':tt==='Team PTS UMP'?'PTS UMP':tt==='Team PTS MLDS'?'PTS MLDS':'';
                      const tc=teamKey?TEAM_LABEL[teamKey]:null;
                      return(
                        <div key={wk} className="relative">
                          {isToday(date)&&<span className="absolute -top-2 left-2 text-[8px] font-bold px-1 py-0.5 rounded text-white z-10" style={{background:dc.accent}}>TODAY</span>}
                          <div className="flex items-center gap-1.5 p-1.5 rounded-xl border" style={{borderColor:`${dc.accent}25`,background:'white'}}>
                            {tc&&<div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{background:tc.dot}}/>}
                            <select value={assign[wk]?.[day]||''} onChange={e=>setAssign(p=>({...p,[wk]:{...p[wk],[day]:e.target.value}}))}
                              className="flex-1 text-[11px] outline-none bg-transparent min-w-0 py-1">
                              <option value="">— Belum —</option>
                              <optgroup label="Team PTS">
                                {users.filter(u=>u.team_type==='Team PTS').map(u=><option key={u.id} value={u.id}>{u.full_name}</option>)}
                              </optgroup>
                              <optgroup label="Team PTS UMP">
                                {users.filter(u=>u.team_type==='Team PTS UMP').map(u=><option key={u.id} value={u.id}>{u.full_name}</option>)}
                              </optgroup>
                              <optgroup label="Team PTS MLDS">
                                {users.filter(u=>u.team_type==='Team PTS MLDS').map(u=><option key={u.id} value={u.id}>{u.full_name}</option>)}
                              </optgroup>
                            </select>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </>
          )}
        </div>
        <div className="px-5 pb-5 flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 rounded-xl font-semibold text-sm" style={{background:'rgba(255,255,255,0.95)',color:'#64748b',border:'1px solid rgba(0,0,0,0.12)'}}>Batal</button>
          <button onClick={handleSave} disabled={saving||loading} className="flex-1 text-white py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-60" style={{background:'linear-gradient(135deg,#dc2626,#b91c1c)',boxShadow:'0 4px 14px rgba(220,38,38,0.35)'}}>
            {saving&&<div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>}💾 Simpan 2 Minggu
          </button>
        </div>
      </div>
    </div>
  );
}
