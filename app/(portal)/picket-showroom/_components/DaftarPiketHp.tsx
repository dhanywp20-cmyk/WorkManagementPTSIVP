'use client';
import { PiketRow, KegiatanEntry, DAY_COLOR, TEAM_LABEL, toKey, bacaPicPiket } from './shared';
import { labelKelompokPTS } from '@/lib/kelompok';
import { ViewIconBtn, EditIconBtn, DeleteIconBtn, ActionGroup } from '@/components/shared';
import { IkonTeks } from '@/components/shared/Ikon';

export function DaftarPiketHp({ displayRows, holidays, kegiatanList, isAdmin, bolehIsi, setViewDetail, setFillDetail, handleFillVirtual,
  handleDeleteRow, toggleHoliday }: {
  displayRows: PiketRow[];
  holidays: string[];
  kegiatanList: KegiatanEntry[];
  isAdmin: boolean;
  bolehIsi: boolean;
  setViewDetail: (r: PiketRow) => void;
  setFillDetail: (r: PiketRow) => void;
  handleFillVirtual: (r: PiketRow) => void;
  handleDeleteRow: (r: PiketRow) => void;
  toggleHoliday: (date: string) => void;
}) {
  return (
    <div className="md:hidden divide-y divide-gray-100">
      {displayRows.length===0?(
        <div className="px-4 py-10 text-center text-sm text-gray-500">Belum ada jadwal.</div>
      ):displayRows.map((row)=>{
        const dc=DAY_COLOR[row.day_of_week];
        const todayRow=row.day_date===toKey(new Date());
        const isHoliday=holidays.includes(row.day_date);
        const picBaris=bacaPicPiket(row);
        const pics=picBaris?[{team:labelKelompokPTS(picBaris.team_type)||picBaris.team_type,name:picBaris.name}]:[];
        const isVirtual=row.id.startsWith('virtual-');
        const jumlahKg=kegiatanList.filter(k=>k.piket_id===row.id).length;
        return (
          <div key={row.id} className={`px-4 py-3 flex items-start gap-3 ${todayRow?'bg-green-50/60':''}`}>
            <div className="flex flex-col items-center w-11 flex-shrink-0" style={{color:dc.accent}}>
              <span className="text-lg font-black leading-none">{new Date(row.day_date+'T00:00:00').getDate()}</span>
              <span className="text-[11px] font-bold">{row.day_of_week}</span>
              {todayRow&&<span className="text-[11px] font-bold px-1 py-0.5 rounded text-white mt-0.5 text-center leading-tight" style={{background:dc.accent}}>Hari ini</span>}
            </div>
            <div className="flex-1 min-w-0 pt-0.5">
              {isHoliday?(
                <span className="text-[11px] font-black px-2 py-0.5 rounded-full text-white" style={{background:'#dc2626'}}><IkonTeks nama="🎌" />LIBUR</span>
              ):pics.length===0?(
                <span className="text-xs text-gray-500 italic">Belum ada PIC</span>
              ):(
                <div className="space-y-1">
                  {pics.map(p=>(
                    <div key={p.team} className="flex items-center gap-1.5">
                      <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black text-white flex-shrink-0" style={{background:TEAM_LABEL[p.team]?.dot??'#64748b'}}>{p.name!.charAt(0).toUpperCase()}</div>
                      <span className="text-[13px] font-semibold text-slate-800 truncate">{p.name}</span>
                      <span className="text-[10px] text-slate-500 flex-shrink-0">{p.team.replace('PTS ','')}</span>
                    </div>
                  ))}
                </div>
              )}
              {jumlahKg>0&&<p className="text-[11px] text-slate-500 mt-1">{jumlahKg} kegiatan tercatat</p>}
            </div>
            <div className="flex flex-col items-end gap-1 flex-shrink-0">
              <ActionGroup>
                {!isVirtual&&<ViewIconBtn onClick={()=>setViewDetail(row)} />}
                {bolehIsi&&<EditIconBtn onClick={()=>isVirtual?handleFillVirtual(row):setFillDetail(row)} />}
                {!isVirtual&&isAdmin&&<DeleteIconBtn onClick={()=>handleDeleteRow(row)} />}
              </ActionGroup>
              {isAdmin&&(
                <button type="button" aria-label={isHoliday?'Batalkan libur':'Tandai sebagai hari libur'}
                  onClick={()=>toggleHoliday(row.day_date)}
                  className="text-[11px] font-semibold px-2 py-0.5 rounded-md"
                  style={isHoliday
                    ?{background:'#fef2f2',color:'#dc2626',border:'1px solid #fca5a5'}
                    :{background:'#f8fafc',color:'#64748b',border:'1px solid #e2e8f0'}}>
                  {isHoliday?'Batal libur':'Libur'}
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
