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

// ─── Rolling schedule (FIXED) ──────────────────────────────────────────────
//
// DESIGN INTENT:
//   When admin saves a 2-week schedule block, that block becomes the
//   "canonical template". The same 2-week pattern repeats infinitely
//   forward (and backward) from that anchor, until the admin saves a
//   NEW 2-week block — after which the new block becomes the template
//   and its pattern projects forward from its own anchor.
//
// HOW IT WORKS:
//   1. Find the most recently saved 2-week block in the DB.
//      "Most recent" = the pair of consecutive weeks whose week_start
//      dates are the latest in the DB, considering weeks that were
//      saved together (i.e. the two highest week_start values that are
//      exactly 7 days apart, or simply the last two distinct week_start
//      dates when sorted).
//   2. Use those two weeks as the canonical 14-day pattern.
//   3. For any target date, compute how many 14-day periods away it is
//      from the anchor, then map it into the [0..13] offset within the
//      template to get the right day's assignment.
//   4. Actual DB rows always override the rolling projection — they are
//      ground truth.

type DayPattern = Record<DayOfWeek, string>; // dayName → name or uid

interface RollingTemplate {
  /** Monday of week-1 of the canonical template (the earlier of the two saved weeks) */
  anchorMonday: Date;
  /** patterns[0] = week 1, patterns[1] = week 2 */
  namePatterns: [DayPattern, DayPattern];
  uidPatterns:  [DayPattern, DayPattern];
}

/**
 * Build the canonical rolling template from DB rows.
 * Returns null if there is insufficient data.
 */
function buildRollingTemplate(dbRows: PiketRow[]): RollingTemplate | null {
  if (!dbRows || dbRows.length === 0) return null;

  // Collect all distinct week_start values that have at least one row
  const weekSet = new Set<string>();
  dbRows.forEach(r => { if (r.week_start) weekSet.add(r.week_start); });
  const sortedWeeks = Array.from(weekSet).sort(); // ascending
  if (sortedWeeks.length === 0) return null;

  // ── Find the canonical 2-week block ──────────────────────────────────────
  // Strategy: take the two highest week_start values. If they are exactly
  // 7 days apart they form a natural pair. If not (e.g. only one week saved,
  // or the last two saved weeks aren't consecutive), use whatever we have —
  // week[0] is the earlier reference.
  //
  // We prefer to use the LAST saved pair. Walk from the end looking for a
  // consecutive pair (7 days apart). If none found, use the last two available.
  let week1Key: string;
  let week2Key: string | null = null;

  for (let i = sortedWeeks.length - 1; i >= 1; i--) {
    const a = sortedWeeks[i - 1];
    const b = sortedWeeks[i];
    const diff = Math.round(
      (new Date(b + 'T00:00:00').getTime() - new Date(a + 'T00:00:00').getTime())
      / (7 * 24 * 60 * 60 * 1000)
    );
    if (diff === 1) {
      week1Key = a;
      week2Key = b;
      break;
    }
  }

  // Fallback: no consecutive pair found — use the latest single week twice
  // (1-week repeating pattern)
  if (!week2Key!) {
    week1Key = sortedWeeks[sortedWeeks.length - 1];
    week2Key = null;
  }

  // Build day→name and day→uid maps for each template week
  const buildDayMaps = (wk: string) => {
    const nameMap: Partial<DayPattern> = {};
    const uidMap: Partial<DayPattern> = {};
    dbRows.forEach(r => {
      if (r.week_start !== wk) return;
      const day = r.day_of_week;
      if (!day) return;
      const name = r.pic_ivp_name || r.pic_ump_name || r.pic_mlds_name || '';
      const uid  = r.pic_ivp_id  || r.pic_ump_id  || r.pic_mlds_id  || '';
      if (name) nameMap[day] = name;
      if (uid)  uidMap[day]  = uid;
    });
    return { nameMap, uidMap };
  };

  const m1 = buildDayMaps(week1Key!);
  const m2 = week2Key ? buildDayMaps(week2Key) : m1; // if only 1 week, repeat it

  const anchorMonday = new Date(week1Key! + 'T00:00:00');

  return {
    anchorMonday,
    namePatterns: [m1.nameMap as DayPattern, m2.nameMap as DayPattern],
    uidPatterns:  [m1.uidMap  as DayPattern, m2.uidMap  as DayPattern],
  };
}

/**
 * Given a target date and the rolling template, return which slot within the
 * 14-day pattern the date falls into: { weekIndex: 0|1, dayName }.
 * Returns null if the date is a weekend or before the anchor.
 */
function resolveSlot(
  date: Date,
  template: RollingTemplate
): { weekIndex: 0 | 1; dayName: DayOfWeek } | null {
  const dow = date.getDay();
  if (dow === 0 || dow === 6) return null; // weekend

  const dayName = DAYS_OF_WEEK[dow - 1] as DayOfWeek;
  if (!dayName) return null;

  // How many days from the anchor Monday?
  const anchorMs = template.anchorMonday.getTime();
  const targetMs = date.getTime();
  const diffDays = Math.round((targetMs - anchorMs) / (24 * 60 * 60 * 1000));

  // Which 14-day cycle slot? Use positive modulo to handle dates before anchor.
  const mod14 = ((diffDays % 14) + 14) % 14;
  const weekIndex = (mod14 < 7 ? 0 : 1) as 0 | 1;

  return { weekIndex, dayName };
}

/** Return the rolling PIC name for a given date. Empty string if none. */
export function getRollingNameForDate(date: Date, dbRows: PiketRow[]): string {
  const template = buildRollingTemplate(dbRows);
  if (!template) return '';

  const slot = resolveSlot(date, template);
  if (!slot) return '';

  return template.namePatterns[slot.weekIndex][slot.dayName] || '';
}

/** Return the rolling PIC user_id for a given date. Empty string if none. */
export function getRollingUserIdForDate(date: Date, dbRows: PiketRow[]): string {
  const template = buildRollingTemplate(dbRows);
  if (!template) return '';

  const slot = resolveSlot(date, template);
  if (!slot) return '';

  return template.uidPatterns[slot.weekIndex][slot.dayName] || '';
}
