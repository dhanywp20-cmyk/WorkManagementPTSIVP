'use client';
import { Reminder, formatDate } from './shared';
import { CategoryBadge } from './Badges';

export function MiniCalendar({ reminders, calendarMonth, setCalendarMonth, selectedCalDay, setSelectedCalDay }: {
  reminders: Reminder[];
  calendarMonth: Date;
  setCalendarMonth: (d: Date) => void;
  selectedCalDay: string | null;
  setSelectedCalDay: (s: string | null) => void;
}) {
  const y = calendarMonth.getFullYear(), m = calendarMonth.getMonth();
  const firstDay = new Date(y, m, 1).getDay();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const today = new Date().toISOString().split('T')[0];

  const monthNames = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Ags','Sep','Okt','Nov','Des'];

  const getCount = (day: number) => {
    const ds = `${y}-${String(m+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    return reminders.filter(r => r.due_date === ds).length;
  };

  const totalThisMonth = reminders.filter(r => r.due_date.startsWith(`${y}-${String(m+1).padStart(2,'0')}`)).length;

  return (
    <div className="rounded-2xl overflow-hidden flex-shrink-0" style={{ background: 'rgba(255,255,255,0.95)', border: '1px solid rgba(0,0,0,0.08)', backdropFilter: 'blur(12px)', width: 380 }}>
      <div className="px-4 py-3 flex items-center justify-between" style={{ background: 'linear-gradient(135deg,#dc2626,#991b1b)' }}>
        <button onClick={() => setCalendarMonth(new Date(y, m-1, 1))} className="text-white/80 hover:text-white font-bold text-lg px-2 py-0.5 rounded-lg hover:bg-white/10 transition-all">‹</button>
        <div className="text-center">
          <p className="text-white font-bold text-sm">{monthNames[m]} {y}</p>
          <p className="text-white/70 text-[10px] mt-0.5">{totalThisMonth} jadwal bulan ini</p>
        </div>
        <button onClick={() => setCalendarMonth(new Date(y, m+1, 1))} className="text-white/80 hover:text-white font-bold text-lg px-2 py-0.5 rounded-lg hover:bg-white/10 transition-all">›</button>
      </div>

      <div className="p-3">
        <div className="grid grid-cols-7 mb-1.5">
          {['Sen','Sel','Rab','Kam','Jum','Sab','Min'].map((d,i) => (
            <div key={i} className="text-center text-[10px] font-bold py-1" style={{ color: '#94a3b8' }}>{d}</div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: (firstDay === 0 ? 6 : firstDay - 1) }).map((_, i) => <div key={`e-${i}`} />)}
          {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
            const ds = `${y}-${String(m+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
            const cnt = getCount(day);
            const isSel = selectedCalDay === ds;
            const isToday = ds === today;
            return (
              <button key={day} onClick={() => setSelectedCalDay(isSel ? null : ds)}
                className="relative flex flex-col items-center justify-center rounded-lg transition-all hover:scale-105"
                style={{
                  width: '100%', aspectRatio: '1',
                  background: isSel ? '#dc2626' : isToday ? 'rgba(220,38,38,0.12)' : cnt > 0 ? 'rgba(99,102,241,0.08)' : 'transparent',
                  border: isToday && !isSel ? '2px solid rgba(220,38,38,0.5)' : isSel ? '2px solid #b91c1c' : cnt > 0 ? '1.5px solid rgba(99,102,241,0.22)' : '2px solid transparent',
                  boxShadow: isSel ? '0 2px 8px rgba(220,38,38,0.35)' : 'none',
                }}>
                <span className={`leading-none font-${cnt > 0 ? 'black' : 'semibold'} text-xs`}
                  style={{ color: isSel ? 'white' : isToday ? '#dc2626' : cnt > 0 ? '#4f46e5' : '#374151' }}>{day}</span>
                {cnt > 0 && (
                  <span className="text-[8px] font-bold leading-none mt-0.5 px-1.5 rounded-full"
                    style={{ background: isSel ? 'rgba(255,255,255,0.35)' : '#4f46e5', color: 'white' }}>
                    {cnt}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected day events */}
      {selectedCalDay && (() => {
        const dayRems = reminders.filter(r => r.due_date === selectedCalDay);
        return dayRems.length > 0 ? (
          <div className="border-t p-3 space-y-2" style={{ borderColor: 'rgba(0,0,0,0.08)', background: 'rgba(249,250,251,0.8)' }}>
            <p className="text-[10px] font-bold tracking-widest uppercase text-gray-500 px-1">
              📅 {formatDate(selectedCalDay)} — {dayRems.length} jadwal
            </p>
            {dayRems.map(r => (
              <div key={r.id} className="rounded-xl p-3 border"
                style={{ background: 'white', borderColor: 'rgba(0,0,0,0.08)' }}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-800 truncate">{(r.project_name || '').trim() || ((r as any).title || '').trim() || '—'}</p>
                    <p className="text-[11px] text-gray-500 mt-0.5">⏰ {r.due_time} · 👤 {r.assign_name}</p>
                  </div>
                  <CategoryBadge category={r.category} />
                </div>
              </div>
            ))}
          </div>
        ) : null;
      })()}
    </div>
  );
}
