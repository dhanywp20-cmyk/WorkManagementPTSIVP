'use client';
import { useState } from 'react';
import { PiketRow, DayOfWeek, DAY_COLOR, DAYS_OF_WEEK, MONTH_NAMES, addDays, toKey, getRollingNameForDate } from './shared';

export function MiniCalendarPopup({allRows,onClose}:{allRows:PiketRow[];onClose:()=>void}) {
  const [calMonth,setCalMonth]=useState(()=>new Date());
  const y=calMonth.getFullYear(),m=calMonth.getMonth();
  const today=toKey(new Date());
  const totalMonth=allRows.filter(r=>r.day_date?.startsWith(`${y}-${String(m+1).padStart(2,'0')}`)).length;

  const firstOfMonth=new Date(y,m,1);
  const firstDayOfWeek=firstOfMonth.getDay();
  const startOffset=firstDayOfWeek===0?6:firstDayOfWeek-1;
  const gridStart=new Date(y,m,1-startOffset);
  const gridCells:Date[]=Array.from({length:42},(_,i)=>addDays(gridStart,i));

  const rowMap:Record<string,PiketRow[]>={};
  allRows.forEach(r=>{if(!rowMap[r.day_date])rowMap[r.day_date]=[];rowMap[r.day_date].push(r);});

  const WEEK_DAYS=['Sen','Sel','Rab','Kam','Jum','Sab','Min'];

  return(
    <div className="fixed inset-0 z-[20000] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
      <div className="bg-white rounded-2xl shadow-2xl overflow-hidden" style={{width:'640px',maxWidth:'95vw',animation:'scale-in 0.2s ease-out',border:'1.5px solid rgba(220,38,38,0.2)'}}>
        <div className="px-5 py-3.5 flex items-center justify-between" style={{background:'linear-gradient(135deg,#dc2626,#991b1b)'}}>
          <button onClick={()=>setCalMonth(new Date(y,m-1,1))} className="text-white/80 hover:text-white font-bold text-2xl w-9 h-9 flex items-center justify-center rounded-lg hover:bg-white/10">‹</button>
          <div className="text-center">
            <p className="text-white font-black text-base">{MONTH_NAMES[m]} {y}</p>
            <p className="text-white/70 text-[11px]">{totalMonth} jadwal tersimpan bulan ini</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={()=>setCalMonth(new Date(y,m+1,1))} className="text-white/80 hover:text-white font-bold text-2xl w-9 h-9 flex items-center justify-center rounded-lg hover:bg-white/10">›</button>
            <button onClick={onClose} className="text-white/70 hover:text-white font-bold text-lg w-8 h-8 flex items-center justify-center bg-white/15 hover:bg-white/25 rounded-lg">✕</button>
          </div>
        </div>
        <div className="grid grid-cols-7 border-b border-gray-100">
          {WEEK_DAYS.map((d,i)=>(
            <div key={i} className="text-center text-[11px] font-bold py-2" style={{color:i<5?'#374151':'#d1d5db'}}>{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7" style={{minHeight:'360px'}}>
          {gridCells.map((date,i)=>{
            const ds=toKey(date);
            const inMonth=date.getMonth()===m;
            const isT=ds===today;
            const dow=date.getDay();
            const isWeekend=dow===0||dow===6;
            const dayRows=rowMap[ds]||[];
            const hasDB=dayRows.length>0;
            const dbPics=dayRows.flatMap(r=>[r.pic_ivp_name,r.pic_ump_name,r.pic_mlds_name].filter(Boolean) as string[]);
            const dc=hasDB?DAY_COLOR[dayRows[0].day_of_week]:null;
            // Rolling: compute dari pola DB untuk tanggal yang belum ada
            const rollingName=(!hasDB&&!isWeekend&&inMonth)?getRollingNameForDate(date,allRows):'';
            const rollingDow=DAYS_OF_WEEK[dow-1] as DayOfWeek|undefined;
            const rollingDc=rollingDow?DAY_COLOR[rollingDow]:null;
            return(
              <div key={i} className="border-r border-b border-gray-100 p-1.5 min-h-[60px] relative"
                style={{background:isT?'rgba(220,38,38,0.06)':!inMonth?'rgba(0,0,0,0.015)':'white'}}>
                <div className="w-7 h-7 flex items-center justify-center rounded-full text-xs font-bold mb-1"
                  style={{background:isT?'#dc2626':'transparent',color:isT?'white':!inMonth?'#d1d5db':isWeekend?'#d1d5db':'#374151',fontWeight:isT?900:600}}>
                  {date.getDate()}
                </div>
                {hasDB&&inMonth&&dbPics.map((name,pi)=>(
                  <div key={pi} className="text-[9px] font-semibold leading-tight truncate px-0.5 py-0.5 rounded mb-0.5"
                    style={{color:dc?.accent||'#374151',background:`${dc?.accent||'#dc2626'}18`}}>
                    {name}
                  </div>
                ))}
                {rollingName&&(
                  <div className="text-[9px] font-semibold leading-tight truncate px-0.5 py-0.5 rounded mb-0.5"
                    style={{color:rollingDc?.accent||'#94a3b8',background:`${rollingDc?.accent||'#94a3b8'}12`}}>
                    {rollingName}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
