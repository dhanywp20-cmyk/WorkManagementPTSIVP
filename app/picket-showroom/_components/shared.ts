// ─── Constants ────────────────────────────────────────────────────────────────

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
  'PTS MLDS': {dot:'#7c3aed',text:'#6d28d9'},
};

export const KEBUTUHAN_LIST = [
  'Meeting Room','Auditorium','Command Center','Digital Signage Kiosk',
  'Digital Signage Custom','Paging System','Background Music','Signage LED Outdoor',
  'Smartclass Room','Ballroom','Camera ETLE','Conference Room',
  'Paperless System','Delegate System','Camera Tracking',
];

export const PRODUK_LIST = ['All Product','Videowall','LED','IFP','Audio System','Lighting','Kiosk'];

export const JENIS_KEGIATAN_LIST = ['Demo Product','RnD','Maintenance','Shooting Markom'] as const;
export type JenisKegiatan = typeof JENIS_KEGIATAN_LIST[number];

export const SALES_DIVISIONS = [
  'IVP','MLDS','HAVS','Enterprise','DEC','ICS','POJ','VOJ','LOCOS',
  'VISIONMEDIA','UMP','BISOL','KIMS','IDC','IOCMEDAN','IOCPekanbaru',
  'IOCBandung','IOCJATENG','MVISEMARANG','POSSurabaya','IOCSurabaya',
  'IOCBali','SGP','SGP1','SGP2','OSS',
];

export const PIE_COLORS = ['#7c3aed','#0ea5e9','#10b981','#e11d48','#f59e0b','#6366f1','#14b8a6','#f97316','#8b5cf6','#06b6d4','#ec4899','#84cc16'];

export const MONTH_NAMES = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Ags','Sep','Okt','Nov','Des'];

export const KEGIATAN_COLORS: Record<string,string> = {
  'Demo Product':'#2563eb','RnD':'#7c3aed','Maintenance':'#d97706','Shooting Markom':'#059669',
};

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UserRow { id:string; full_name:string; username:string; team_type?:string; role:string; }

export interface PiketRow {
  id:string; week_start:string; day_of_week:DayOfWeek; day_date:string;
  pic_ivp_id:string|null; pic_ivp_name:string|null;
  pic_ump_id:string|null; pic_ump_name:string|null;
  pic_mlds_id:string|null; pic_mlds_name:string|null;
  tamu_instansi:string|null; kebutuhan:string[];
  created_at:string; updated_at:string;
  edited_by_name?:string|null;
}

export interface KegiatanEntry {
  id?:string; piket_id:string;
  jenis_kegiatan:JenisKegiatan; jam_mulai:string; jam_selesai:string; produk:string[];
  tamu_instansi:string|null; nama_sales:string|null; sales_division:string|null;
  kebutuhan:string[]; keterangan:string|null; created_at:string;
  updated_at?:string|null; edited_by_name?:string|null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

// ─── Rolling schedule ─────────────────────────────────────────────────────────
//
// DESIGN:
//   Admin saves a 2-week block → that block is the "canonical template".
//   The exact same 2-week pattern repeats forever forward (and backward)
//   from that anchor, until admin saves a NEW 2-week block.
//
// ALGORITHM:
//   1. From all DB rows, collect distinct week_start values (sorted ascending).
//   2. Find the LATEST consecutive pair (two week_start values exactly 7 days
//      apart, scanning from the end). That is week1Key + week2Key.
//   3. anchorMonday = Monday of week1Key.
//   4. For any target date: diffDays = date - anchorMonday.
//      mod14 = ((diffDays % 14) + 14) % 14   ← always positive
//      if mod14 < 7  → use week1 pattern
//      if mod14 >= 7 → use week2 pattern
//   5. Return the name/uid for that day from the chosen pattern.
//
// NOTE: Actual DB rows are NEVER passed through this function in page.tsx —
// they are read directly from DB and always take priority over rolling.

type DayNameMap = Partial<Record<DayOfWeek, string>>;

interface RollingTemplate {
  anchorMonday: Date;   // Monday of week1 of the canonical 2-week block
  nameW1: DayNameMap;   // week1: day → pic display name
  nameW2: DayNameMap;   // week2: day → pic display name
  uidW1:  DayNameMap;   // week1: day → pic user_id
  uidW2:  DayNameMap;   // week2: day → pic user_id
}

function buildRollingTemplate(dbRows: PiketRow[]): RollingTemplate | null {
  if (!dbRows || dbRows.length === 0) return null;

  // Collect distinct week_start values that have at least one row
  const weekSet = new Set<string>();
  dbRows.forEach(r => { if (r.week_start) weekSet.add(r.week_start); });
  const sortedWeeks = Array.from(weekSet).sort(); // ascending
  if (sortedWeeks.length === 0) return null;

  // Find the LATEST consecutive pair (exactly 7 days apart), scanning from end
  let week1Key: string = sortedWeeks[sortedWeeks.length - 1]; // fallback: last week
  let week2Key: string | null = null;

  for (let i = sortedWeeks.length - 1; i >= 1; i--) {
    const a = sortedWeeks[i - 1];
    const b = sortedWeeks[i];
    const msA = new Date(a + 'T00:00:00').getTime();
    const msB = new Date(b + 'T00:00:00').getTime();
    const diffWeeks = Math.round((msB - msA) / (7 * 24 * 60 * 60 * 1000));
    if (diffWeeks === 1) {
      week1Key = a;
      week2Key = b;
      break;
    }
  }

  // Build day→name and day→uid maps for one week_start key
  const buildMaps = (wk: string): { nameMap: DayNameMap; uidMap: DayNameMap } => {
    const nameMap: DayNameMap = {};
    const uidMap:  DayNameMap = {};
    dbRows.forEach(r => {
      if (r.week_start !== wk || !r.day_of_week) return;
      const day  = r.day_of_week;
      const name = r.pic_ivp_name || r.pic_ump_name || r.pic_mlds_name || '';
      const uid  = r.pic_ivp_id  || r.pic_ump_id  || r.pic_mlds_id  || '';
      if (name) nameMap[day] = name;
      if (uid)  uidMap[day]  = uid;
    });
    return { nameMap, uidMap };
  };

  const m1 = buildMaps(week1Key);
  const m2 = week2Key ? buildMaps(week2Key) : m1; // if only 1 week saved, repeat it

  return {
    anchorMonday: new Date(week1Key + 'T00:00:00'),
    nameW1: m1.nameMap,
    nameW2: m2.nameMap,
    uidW1:  m1.uidMap,
    uidW2:  m2.uidMap,
  };
}

function resolveSlot(
  date: Date,
  tpl: RollingTemplate
): { nameMap: DayNameMap; uidMap: DayNameMap; dayName: DayOfWeek } | null {
  const dow = date.getDay(); // 0=Sun … 6=Sat
  if (dow === 0 || dow === 6) return null;

  const dayName = DAYS_OF_WEEK[dow - 1];
  if (!dayName) return null;

  // Days from anchor Monday (may be negative for dates before anchor)
  const anchorMs = tpl.anchorMonday.getTime();
  const targetMs = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const diffDays = Math.round((targetMs - anchorMs) / (24 * 60 * 60 * 1000));

  // Always-positive modulo 14
  const mod14 = ((diffDays % 14) + 14) % 14;

  return {
    nameMap: mod14 < 7 ? tpl.nameW1 : tpl.nameW2,
    uidMap:  mod14 < 7 ? tpl.uidW1  : tpl.uidW2,
    dayName,
  };
}

/** Rolling PIC display name for a date. Returns '' if no pattern or weekend. */
export function getRollingNameForDate(date: Date, dbRows: PiketRow[]): string {
  const tpl = buildRollingTemplate(dbRows);
  if (!tpl) return '';
  const slot = resolveSlot(date, tpl);
  if (!slot) return '';
  return slot.nameMap[slot.dayName] || '';
}

/** Rolling PIC user_id for a date. Returns '' if no pattern or weekend. */
export function getRollingUserIdForDate(date: Date, dbRows: PiketRow[]): string {
  const tpl = buildRollingTemplate(dbRows);
  if (!tpl) return '';
  const slot = resolveSlot(date, tpl);
  if (!slot) return '';
  return slot.uidMap[slot.dayName] || '';
}
