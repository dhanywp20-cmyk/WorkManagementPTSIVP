'use client';
import { PiketRow, DAYS_OF_WEEK, DAY_COLOR, toKey, bacaPicPiket } from './shared';
import { IkonTeks } from '@/components/shared/Ikon';

export function SpandukHariIni({ displayRows }: { displayRows: PiketRow[] }) {
  const now=new Date();
  const todayDow=now.getDay();
  const isWeekday=todayDow>=1&&todayDow<=5;
  const todayName=DAYS_OF_WEEK[todayDow-1];
  const todayDc=isWeekday&&todayName?DAY_COLOR[todayName]:null;
  const todayInView=displayRows.find(r=>r.day_date===toKey(now));
  const todayPIC=todayInView?(bacaPicPiket(todayInView)?.name||'Belum ada PIC'):null;
  if(!isWeekday)return null;
  return(
    <div className="mx-4 mb-3 mt-1 flex items-center gap-3 px-4 py-2.5 rounded-xl" style={{background:`${todayDc?.accent||'#dc2626'}10`,border:`1px solid ${todayDc?.accent||'#dc2626'}30`}}>
      <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-black text-sm flex-shrink-0" style={{background:todayDc?.grad||'linear-gradient(135deg,#dc2626,#991b1b)'}}>
        {now.getDate()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-black" style={{color:todayDc?.accent||'#dc2626'}}><IkonTeks nama="📍" />Hari ini: {todayName}</span>
          <span className="text-[11px] text-slate-500 font-medium">{now.toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'})}</span>
          {todayInView&&todayPIC&&<span className="text-[11px] font-semibold px-2 py-0.5 rounded-full text-white" style={{background:todayDc?.accent||'#dc2626'}}>PIC: {todayPIC}</span>}
          {!todayInView&&<span className="text-[11px] text-slate-500 italic">Jadwal hari ini tidak tampil di view ini</span>}
        </div>
      </div>
    </div>
  );
}
