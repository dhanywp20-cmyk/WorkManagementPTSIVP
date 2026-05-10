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
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function getMonday(d:Date):Date{
  // Use local date to avoid timezone shift
  const r=new Date(d.getFullYear(),d.getMonth(),d.getDate());
  const day=r.getDay(); // 0=Sun,1=Mon,...,6=Sat
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
// Compute PIC untuk tanggal tertentu berdasarkan pola jadwal DB.
// Pakai pic_ivp_name/pic_ump_name/pic_mlds_name yang tersedia di allRows.
// Cycle = semua week_start unik di DB, berulang terus ke depan.

type DayNamePattern = Record<DayOfWeek, string>;

function buildRollingNamePattern(dbRows: PiketRow[]): {weekKeys: string[]; patterns: Record<string, DayNamePattern>} {
  const patterns: Record<string, DayNamePattern> = {};
  dbRows.forEach(r => {
    if (!r.week_start) return;
    if (!patterns[r.week_start]) patterns[r.week_start] = {} as DayNamePattern;
    const name = r.pic_ivp_name || r.pic_ump_name || r.pic_mlds_name || '';
    if (name && r.day_of_week) patterns[r.week_start][r.day_of_week] = name;
  });
  // Only keep weeks that have at least 1 entry
  const weekKeys = Object.keys(patterns).filter(wk => Object.keys(patterns[wk]).length > 0).sort();
  return { weekKeys, patterns };
}

// Untuk tanggal tertentu, return nama PIC dari pola rolling
export function getRollingNameForDate(date: Date, dbRows: PiketRow[]): string {
  const dow = date.getDay();
  if (dow === 0 || dow === 6) return '';
  const dayName = DAYS_OF_WEEK[dow - 1];
  if (!dayName) return '';

  const { weekKeys, patterns } = buildRollingNamePattern(dbRows);
  if (weekKeys.length === 0) return '';

  const ws = getMonday(date);
  const wsKey = toKey(ws);

  // Minggu ini ada di DB → pakai langsung
  if (patterns[wsKey]?.[dayName]) return patterns[wsKey][dayName];

  // Project rolling: cycle dari minggu-minggu yang tersimpan
  const firstWs = new Date(weekKeys[0] + 'T00:00:00');
  const weeksDiff = Math.round((ws.getTime() - firstWs.getTime()) / (7 * 24 * 60 * 60 * 1000));
  if (weeksDiff < 0) return '';
  const slotIdx = weeksDiff % weekKeys.length;
  const patternWeek = weekKeys[slotIdx];
  return patterns[patternWeek]?.[dayName] || '';
}

// Untuk ScheduleModal: return user_id dari pola rolling (butuh pic_ivp_id dll)
export function getRollingUserIdForDate(date: Date, dbRows: PiketRow[]): string {
  const dow = date.getDay();
  if (dow === 0 || dow === 6) return '';
  const dayName = DAYS_OF_WEEK[dow - 1];
  if (!dayName) return '';

  // Build pattern dari uid
  const uidPatterns: Record<string, Record<DayOfWeek, string>> = {};
  dbRows.forEach(r => {
    if (!r.week_start) return;
    if (!uidPatterns[r.week_start]) uidPatterns[r.week_start] = {} as Record<DayOfWeek, string>;
    const uid = r.pic_ivp_id || r.pic_ump_id || r.pic_mlds_id || '';
    if (uid && r.day_of_week) uidPatterns[r.week_start][r.day_of_week] = uid;
  });
  const weekKeys = Object.keys(uidPatterns).filter(wk => Object.keys(uidPatterns[wk]).length > 0).sort();
  if (weekKeys.length === 0) return '';

  const ws = getMonday(date);
  const wsKey = toKey(ws);
  if (uidPatterns[wsKey]?.[dayName]) return uidPatterns[wsKey][dayName];

  const firstWs = new Date(weekKeys[0] + 'T00:00:00');
  const weeksDiff = Math.round((ws.getTime() - firstWs.getTime()) / (7 * 24 * 60 * 60 * 1000));
  if (weeksDiff < 0) return '';
  const slotIdx = weeksDiff % weekKeys.length;
  return uidPatterns[weekKeys[slotIdx]]?.[dayName] || '';
}
