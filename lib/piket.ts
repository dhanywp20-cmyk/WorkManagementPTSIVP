
export const DAYS_OF_WEEK = ['Senin','Selasa','Rabu','Kamis','Jumat'] as const;
export type DayOfWeek = typeof DAYS_OF_WEEK[number];

export const DAY_EN: Record<DayOfWeek,string> = {Senin:'MON',Selasa:'TUE',Rabu:'WED',Kamis:'THU',Jumat:'FRI'};

export const DAY_COLOR: Record<DayOfWeek,{accent:string;light:string;grad:string}> = {
  Senin:  {accent:'#dc2626',light:'rgba(220,38,38,0.08)',  grad:'linear-gradient(135deg,#dc2626,#991b1b)'},
  Selasa: {accent:'#d97706',light:'rgba(217,119,6,0.08)',  grad:'linear-gradient(135deg,#d97706,#92400e)'},
  Rabu:   {accent:'#2563eb',light:'rgba(37,99,235,0.08)',  grad:'linear-gradient(135deg,#2563eb,#1e3a8a)'},
  Kamis:  {accent:'#7c3aed',light:'rgba(124,58,237,0.08)', grad:'linear-gradient(135deg,#7c3aed,#4c1d95)'},
  Jumat:  {accent:'#059669',light:'rgba(5,150,105,0.08)',  grad:'linear-gradient(135deg,#059669,#064e3b)'},
};

export const TEAM_LABEL: Record<string,{dot:string;text:string}> = {
  'PTS IVP':  {dot:'#dc2626',text:'#991b1b'},
  'PTS UMP':  {dot:'#2563eb',text:'#1e40af'},
  'PTS MVI': {dot:'#7c3aed',text:'#6d28d9'},
};

export const DEFAULT_TEAM_COLOR = {dot:'#64748b',text:'#475569'};

export type JenisKegiatan = string;

export { DIVISI_BAWAAN as SALES_DIVISIONS } from '@/lib/merek';

export const PIE_COLORS = ['#7c3aed','#0ea5e9','#10b981','#e11d48','#f59e0b','#6366f1','#14b8a6','#f97316','#8b5cf6','#06b6d4','#ec4899','#84cc16'];

export const MONTH_NAMES = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Ags','Sep','Okt','Nov','Des'];

export const KEGIATAN_COLORS: Record<string,string> = {
  'Demo Product':'#2563eb','RnD':'#7c3aed','Maintenance':'#d97706','Shooting Markom':'#059669',
};

export interface UserRow { id:string; full_name:string; username:string; team_type?:string; role:string; }

export interface PiketRow {
  id:string; week_start:string; day_of_week:DayOfWeek; day_date:string;
  pic?:PicPiket|null;
  pic_ivp_id:string|null; pic_ivp_name:string|null;
  pic_ump_id:string|null; pic_ump_name:string|null;
  pic_mvi_id:string|null; pic_mvi_name:string|null;
  tamu_instansi:string|null; kebutuhan:string[];
  created_at:string; updated_at:string;
  edited_by_name?:string|null;
}

export interface PicPiket { user_id:string; name:string; team_type:string }

export interface PicPayload {
  pic: PicPiket | null;
  pic_ivp_id: string|null; pic_ivp_name: string|null;
  pic_ump_id: string|null; pic_ump_name: string|null;
  pic_mvi_id: string|null; pic_mvi_name: string|null;
}

export function bacaPicPiket(r: Partial<PiketRow> | null | undefined): PicPiket | null {
  if (!r) return null;
  const p = r.pic;
  if (p && typeof p === 'object' && p.user_id) {
    return { user_id: p.user_id, name: p.name ?? '', team_type: p.team_type ?? '' };
  }
  if (r.pic_ivp_id) return { user_id: r.pic_ivp_id, name: r.pic_ivp_name ?? '', team_type: 'Team PTS IVP' };
  if (r.pic_ump_id) return { user_id: r.pic_ump_id, name: r.pic_ump_name ?? '', team_type: 'Team PTS UMP' };
  if (r.pic_mvi_id) return { user_id: r.pic_mvi_id, name: r.pic_mvi_name ?? '', team_type: 'Team PTS MVI' };
  return null;
}

export function tulisPicPiket(u: { id:string; full_name?:string|null; team_type?:string|null } | null): PicPayload {
  if (!u) {
    return {
      pic: null,
      pic_ivp_id: null, pic_ivp_name: null,
      pic_ump_id: null, pic_ump_name: null,
      pic_mvi_id: null, pic_mvi_name: null,
    };
  }
  const tt = u.team_type ?? '';
  const nama = u.full_name ?? null;
  return {
    pic: { user_id: u.id, name: nama ?? '', team_type: tt },
    pic_ivp_id: tt === 'Team PTS IVP' ? u.id : null, pic_ivp_name: tt === 'Team PTS IVP' ? nama : null,
    pic_ump_id: tt === 'Team PTS UMP' ? u.id : null, pic_ump_name: tt === 'Team PTS UMP' ? nama : null,
    pic_mvi_id: tt === 'Team PTS MVI' ? u.id : null, pic_mvi_name: tt === 'Team PTS MVI' ? nama : null,
  };
}

export interface ProdukLain { nama:string; watt:number }

export interface KegiatanEntry {
  id?:string; piket_id:string;
  jenis_kegiatan:JenisKegiatan; jam_mulai:string; jam_selesai:string; produk:string[];
  produk_lain?:ProdukLain[];
  tamu_instansi:string|null; nama_sales:string|null; sales_division:string|null;
  kebutuhan:string[]; keterangan:string|null; created_at:string;
  updated_at?:string|null; edited_by_name?:string|null;
}

export function getMonday(d:Date):Date{
  const r=new Date(d.getFullYear(),d.getMonth(),d.getDate());
  const day=r.getDay();
  const diff=day===0?-6:1-day;
  r.setDate(r.getDate()+diff);
  return r;
}

export function addDays(d:Date,n:number):Date{
  const r=new Date(d.getFullYear(),d.getMonth(),d.getDate());
  r.setDate(r.getDate()+n);
  return r;
}

export function toKey(d:Date):string{
  const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),dd=String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${dd}`;
}

export function getDayDate(ws:Date,day:DayOfWeek):Date{
  return addDays(ws,DAYS_OF_WEEK.indexOf(day));
}

export function isToday(d:Date):boolean{
  const t=new Date();
  return d.getFullYear()===t.getFullYear()&&d.getMonth()===t.getMonth()&&d.getDate()===t.getDate();
}

export function getWeekKey(dateStr:string):string{
  const[y,m,dd]=dateStr.split('-').map(Number);
  return toKey(getMonday(new Date(y,m-1,dd)));
}

type DayNameMap = Partial<Record<DayOfWeek, string>>;

interface RollingTemplate {
  anchorMonday: Date;
  nameW1: DayNameMap;
  nameW2: DayNameMap;
  uidW1:  DayNameMap;
  uidW2:  DayNameMap;
}

function buildDayMaps(wk: string, dbRows: PiketRow[]): { nameMap: DayNameMap; uidMap: DayNameMap } {
  const nameMap: DayNameMap = {};
  const uidMap:  DayNameMap = {};
  dbRows.forEach(r => {
    if (r.week_start !== wk || !r.day_of_week) return;
    const day  = r.day_of_week;
    const pic  = bacaPicPiket(r);
    const name = pic?.name ?? '';
    const uid  = pic?.user_id ?? '';
    if (name) nameMap[day] = name;
    if (uid)  uidMap[day]  = uid;
  });
  return { nameMap, uidMap };
}

function mapsAreIdentical(a: DayNameMap, b: DayNameMap): boolean {
  for (const day of DAYS_OF_WEEK) {
    if ((a[day] || '') !== (b[day] || '')) return false;
  }
  return true;
}

function buildRollingTemplate(dbRows: PiketRow[]): RollingTemplate | null {
  if (!dbRows || dbRows.length === 0) return null;

  const weekSet = new Set<string>();
  dbRows.forEach(r => { if (r.week_start) weekSet.add(r.week_start); });
  const sortedWeeks = Array.from(weekSet).sort();
  if (sortedWeeks.length === 0) return null;

  const nameMapsCache: Record<string, DayNameMap> = {};
  const uidMapsCache:  Record<string, DayNameMap> = {};
  sortedWeeks.forEach(wk => {
    const { nameMap, uidMap } = buildDayMaps(wk, dbRows);
    nameMapsCache[wk] = nameMap;
    uidMapsCache[wk]  = uidMap;
  });

  const isConsecutivePair = (a: string, b: string) => {
    const msA = new Date(a + 'T00:00:00').getTime();
    const msB = new Date(b + 'T00:00:00').getTime();
    return Math.round((msB - msA) / (7 * 24 * 60 * 60 * 1000)) === 1;
  };

  const isComplete = (wk: string): boolean =>
    DAYS_OF_WEEK.every(d => nameMapsCache[wk][d] || uidMapsCache[wk][d]);

  const areHeterogeneous = (a: string, b: string): boolean => {
    const hasNames = DAYS_OF_WEEK.some(d => nameMapsCache[a][d] || nameMapsCache[b][d]);
    if (hasNames) return !mapsAreIdentical(nameMapsCache[a], nameMapsCache[b]);
    return !mapsAreIdentical(uidMapsCache[a], uidMapsCache[b]);
  };

  let week1Key: string | null = null;
  let week2Key: string | null = null;

  for (let i = sortedWeeks.length - 1; i >= 1; i--) {
    const a = sortedWeeks[i - 1], b = sortedWeeks[i];
    if (!isConsecutivePair(a, b)) continue;
    if (!isComplete(a) || !isComplete(b)) continue;
    if (areHeterogeneous(a, b)) { week1Key = a; week2Key = b; break; }
  }

  if (week1Key === null) {
    for (let i = sortedWeeks.length - 1; i >= 1; i--) {
      const a = sortedWeeks[i - 1], b = sortedWeeks[i];
      if (!isConsecutivePair(a, b)) continue;
      if (!isComplete(a) || !isComplete(b)) continue;
      week1Key = a; week2Key = b; break;
    }
  }

  if (week1Key === null) {
    for (let i = sortedWeeks.length - 1; i >= 1; i--) {
      const a = sortedWeeks[i - 1], b = sortedWeeks[i];
      if (!isConsecutivePair(a, b)) continue;
      if (areHeterogeneous(a, b)) { week1Key = a; week2Key = b; break; }
    }
  }

  if (week1Key === null) {
    for (let i = sortedWeeks.length - 1; i >= 1; i--) {
      const a = sortedWeeks[i - 1], b = sortedWeeks[i];
      if (isConsecutivePair(a, b)) { week1Key = a; week2Key = b; break; }
    }
  }

  if (week1Key === null) {
    week1Key = sortedWeeks[sortedWeeks.length - 1];
    week2Key = null;
  }

  const m1Name = nameMapsCache[week1Key];
  const m1Uid  = uidMapsCache[week1Key];
  const m2Name = week2Key ? nameMapsCache[week2Key] : m1Name;
  const m2Uid  = week2Key ? uidMapsCache[week2Key]  : m1Uid;

  return {
    anchorMonday: new Date(week1Key + 'T00:00:00'),
    nameW1: m1Name,
    nameW2: m2Name,
    uidW1:  m1Uid,
    uidW2:  m2Uid,
  };
}

function countWorkingNonHolidayDays(from: Date, to: Date, holidaySet: Set<string>): number {
  let count = 0;
  const cur = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const end = new Date(to.getFullYear(), to.getMonth(), to.getDate());
  while (cur < end) {
    const dow = cur.getDay();
    if (dow >= 1 && dow <= 5 && !holidaySet.has(toKey(cur))) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

function resolveSlot(
  date: Date,
  tpl: RollingTemplate,
  holidaySet?: Set<string>
): { nameMap: DayNameMap; uidMap: DayNameMap; dayName: DayOfWeek } | null {
  const dow = date.getDay();
  if (dow === 0 || dow === 6) return null;

  if (holidaySet) {
    if (holidaySet.has(toKey(date))) return null;

    const anchorDate = new Date(tpl.anchorMonday.getFullYear(), tpl.anchorMonday.getMonth(), tpl.anchorMonday.getDate());
    const targetDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    let position: number;
    if (targetDate >= anchorDate) {
      position = countWorkingNonHolidayDays(anchorDate, targetDate, holidaySet) % 10;
    } else {
      const count = countWorkingNonHolidayDays(targetDate, anchorDate, holidaySet);
      position = (10 - (count % 10)) % 10;
    }

    const isW2 = position >= 5;
    return {
      nameMap: isW2 ? tpl.nameW2 : tpl.nameW1,
      uidMap:  isW2 ? tpl.uidW2  : tpl.uidW1,
      dayName: DAYS_OF_WEEK[position % 5],
    };
  }

  const dayName = DAYS_OF_WEEK[dow - 1];
  if (!dayName) return null;

  const anchorMs = tpl.anchorMonday.getTime();
  const targetMs = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const diffDays = Math.round((targetMs - anchorMs) / (24 * 60 * 60 * 1000));
  const mod14 = ((diffDays % 14) + 14) % 14;

  return {
    nameMap: mod14 < 7 ? tpl.nameW1 : tpl.nameW2,
    uidMap:  mod14 < 7 ? tpl.uidW1  : tpl.uidW2,
    dayName,
  };
}

export function getRollingNameForDate(date: Date, dbRows: PiketRow[], holidays?: string[]): string {
  const tpl = buildRollingTemplate(dbRows);
  if (!tpl) return '';
  const holidaySet = holidays && holidays.length > 0 ? new Set(holidays) : undefined;
  const slot = resolveSlot(date, tpl, holidaySet);
  if (!slot) return '';
  return slot.nameMap[slot.dayName] || '';
}

export function getRollingUserIdForDate(date: Date, dbRows: PiketRow[], holidays?: string[]): string {
  const tpl = buildRollingTemplate(dbRows);
  if (!tpl) return '';
  const holidaySet = holidays && holidays.length > 0 ? new Set(holidays) : undefined;
  const slot = resolveSlot(date, tpl, holidaySet);
  if (!slot) return '';
  return slot.uidMap[slot.dayName] || '';
}
