// Constants

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

export const KEBUTUHAN_LIST = [
  'Meeting Room','Auditorium','Command Center','Digital Signage Kiosk',
  'Digital Signage Custom','Paging System','Background Music','Signage LED Outdoor',
  'Smartclass Room','Ballroom','Camera ETLE','Conference Room',
  'Paperless System','Delegate System','Camera Tracking',
];

export const PRODUK_LIST = ['All Product','Videowall','LED','IFP','Projector','Audio System','Lighting','Kiosk'];

export const JENIS_KEGIATAN_LIST = ['Demo Product','RnD','Maintenance','Shooting Markom'] as const;
export type JenisKegiatan = typeof JENIS_KEGIATAN_LIST[number];

/**
 * Daftar divisi sales - HANYA nilai bawaan, bukan lagi sumber kebenaran.
 *
 * Daftar yang benar-benar berlaku disimpan di database dan dibaca lewat
 * useDivisiSales() (lihat lib/merek.ts), supaya divisi baru bisa ditambahkan
 * dari Admin Panel tanpa deploy. Nama ini dipertahankan untuk pemakaian di
 * luar React dan sebagai cadangan saat pengaturannya belum termuat.
 *
 * Sebelumnya daftar yang sama disalin di lima berkas shared.ts: menambah satu
 * divisi berarti menyunting kelimanya, dan satu yang terlewat membuat divisi
 * itu muncul di sebagian menu saja.
 */
export { DIVISI_BAWAAN as SALES_DIVISIONS } from '@/lib/merek';

export const PIE_COLORS = ['#7c3aed','#0ea5e9','#10b981','#e11d48','#f59e0b','#6366f1','#14b8a6','#f97316','#8b5cf6','#06b6d4','#ec4899','#84cc16'];

export const MONTH_NAMES = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Ags','Sep','Okt','Nov','Des'];

export const KEGIATAN_COLORS: Record<string,string> = {
  'Demo Product':'#2563eb','RnD':'#7c3aed','Maintenance':'#d97706','Shooting Markom':'#059669',
};

// Types

export interface UserRow { id:string; full_name:string; username:string; team_type?:string; role:string; }

export interface PiketRow {
  id:string; week_start:string; day_of_week:DayOfWeek; day_date:string;
  /**
   * PIC piket hari itu. Menggantikan tiga pasang kolom per-tim di bawahnya,
   * yang memaku jumlah tim di dalam SKEMA - tim keempat tidak punya tempat
   * disimpan sama sekali, jadi kelompok PTS baru yang ditambahkan admin
   * tidak akan pernah bisa dijadwalkan piket.
   */
  pic?:PicPiket|null;
  /**
   * Kolom lama, MASIH DITULIS selama masa transisi dan masih dibaca sebagai
   * cadangan oleh bacaPicPiket(). Jangan dibaca langsung di kode baru.
   */
  pic_ivp_id:string|null; pic_ivp_name:string|null;
  pic_ump_id:string|null; pic_ump_name:string|null;
  pic_mvi_id:string|null; pic_mvi_name:string|null;
  tamu_instansi:string|null; kebutuhan:string[];
  created_at:string; updated_at:string;
  edited_by_name?:string|null;
}

export interface PicPiket { user_id:string; name:string; team_type:string }

/** Bagian PIC dari payload simpan - bentuknya dipakai langsung sebagai bagian PiketRow. */
export interface PicPayload {
  pic: PicPiket | null;
  pic_ivp_id: string|null; pic_ivp_name: string|null;
  pic_ump_id: string|null; pic_ump_name: string|null;
  pic_mvi_id: string|null; pic_mvi_name: string|null;
}

/**
 * Siapa PIC piket sebuah baris - SATU pintu baca untuk seluruh modul.
 *
 * Membaca kolom `pic` lebih dulu, lalu jatuh ke tiga pasang kolom lama.
 * Cadangannya bukan basa-basi: ia yang membuat pemasangan yang belum
 * menjalankan migrasi tetap bekerja, dan yang membuat perubahan ini bisa
 * dibatalkan dengan berhenti membaca `pic` tanpa kehilangan data apa pun.
 */
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

/**
 * Bagian PIC dari payload simpan - SATU pintu tulis untuk seluruh modul.
 *
 * Menulis ke kolom `pic` DAN ke tiga kolom lama sekaligus. Tulis-ganda ini
 * disengaja dan sementara: selama satu siklus pemakaian, data tetap benar
 * dibaca oleh kode versi lama maupun baru. Begitu terbukti, penulisan ke
 * kolom lama dihentikan lalu kolomnya dihapus di migrasi tersendiri.
 *
 * Tim di luar ketiga kolom lama (mis. kelompok PTS baru) tetap tersimpan
 * lengkap di `pic` - kolom lamanya memang tidak punya tempat untuknya, dan
 * itu justru alasan perubahan ini ada.
 */
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

// Barang temporer di luar PRODUK_LIST default - dicatat beban dayanya (watt)
export interface ProdukLain { nama:string; watt:number }

export interface KegiatanEntry {
  id?:string; piket_id:string;
  jenis_kegiatan:JenisKegiatan; jam_mulai:string; jam_selesai:string; produk:string[];
  produk_lain?:ProdukLain[];
  tamu_instansi:string|null; nama_sales:string|null; sales_division:string|null;
  kebutuhan:string[]; keterangan:string|null; created_at:string;
  updated_at?:string|null; edited_by_name?:string|null;
}

// Helpers

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

// Rolling schedule
//
// DESIGN:
//   Admin saves a 2-week block (W1 + W2 with different people each week).
//   That 2-week pattern repeats forever: W1, W2, W1, W2, ...
//   When admin saves a new block, the new block becomes the new template.
//
// TEMPLATE DETECTION ALGORITHM:
//   The ScheduleModal always saves 2 consecutive weeks at once.
//   Because admin may save overlapping 2-week windows (e.g. first save
//   covers weeks A+B, second save covers weeks B+C), the DB can end up
//   with weeks [A, B, C] where B+C are identical to each other.
//
//   To find the REAL intended 2-week template, we:
//   1. Sort all distinct week_start values ascending.
//   2. Scan from the END to find the latest consecutive pair (7 days apart)
//      whose two weeks have DIFFERENT PIC assignments (heterogeneous pair).
//      This is the true W1+W2 template.
//   3. If no heterogeneous pair exists (all consecutive pairs are identical),
//      use the latest consecutive pair regardless - the pattern is a 1-week repeat.
//   4. anchorMonday = Monday of W1 (the earlier week of the found pair).
//   5. For any target date: diffDays from anchor, mod14  slot 0-6 = W1, 7-13 = W2.
//
// WHY THIS MATTERS:
//   If admin saved weeks [2026-05-11, 2026-05-18] then later re-saved
//   [2026-05-18, 2026-05-25] and 2026-05-25 accidentally got 2026-05-18's
//   people (rolling pre-fill bug), the latest consecutive pair (05-18, 05-25)
//   would be identical  we fall back to the heterogeneous pair (05-11, 05-18).

type DayNameMap = Partial<Record<DayOfWeek, string>>;

interface RollingTemplate {
  anchorMonday: Date;   // Monday of W1
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

/** Returns true if two dayname maps have the same content for all weekdays */
function mapsAreIdentical(a: DayNameMap, b: DayNameMap): boolean {
  for (const day of DAYS_OF_WEEK) {
    if ((a[day] || '') !== (b[day] || '')) return false;
  }
  return true;
}

function buildRollingTemplate(dbRows: PiketRow[]): RollingTemplate | null {
  if (!dbRows || dbRows.length === 0) return null;

  // Collect distinct week_start values with at least one scheduled row
  const weekSet = new Set<string>();
  dbRows.forEach(r => { if (r.week_start) weekSet.add(r.week_start); });
  const sortedWeeks = Array.from(weekSet).sort(); // ascending chronological
  if (sortedWeeks.length === 0) return null;

  // Build name + uid maps for every week once (avoid repeated scanning)
  const nameMapsCache: Record<string, DayNameMap> = {};
  const uidMapsCache:  Record<string, DayNameMap> = {};
  sortedWeeks.forEach(wk => {
    const { nameMap, uidMap } = buildDayMaps(wk, dbRows);
    nameMapsCache[wk] = nameMap;
    uidMapsCache[wk]  = uidMap;
  });

  // --- Helpers ---

  const isConsecutivePair = (a: string, b: string) => {
    const msA = new Date(a + 'T00:00:00').getTime();
    const msB = new Date(b + 'T00:00:00').getTime();
    return Math.round((msB - msA) / (7 * 24 * 60 * 60 * 1000)) === 1;
  };

  // A week is "complete" when all 5 weekdays have a PIC assigned (name OR uid).
  // Incomplete weeks (e.g. only Monday saved after a partial edit) must NOT be
  // used as the template - otherwise one partial save corrupts the whole pattern.
  const isComplete = (wk: string): boolean =>
    DAYS_OF_WEEK.every(d => nameMapsCache[wk][d] || uidMapsCache[wk][d]);

  // Heterogeneous check: use whichever map has data (names in display context,
  // uids in ScheduleModal pre-fill context where names aren't fetched).
  const areHeterogeneous = (a: string, b: string): boolean => {
    const hasNames = DAYS_OF_WEEK.some(d => nameMapsCache[a][d] || nameMapsCache[b][d]);
    if (hasNames) return !mapsAreIdentical(nameMapsCache[a], nameMapsCache[b]);
    return !mapsAreIdentical(uidMapsCache[a], uidMapsCache[b]);
  };

  let week1Key: string | null = null;
  let week2Key: string | null = null;

  // Pass 1 (preferred): latest COMPLETE + CONSECUTIVE + HETEROGENEOUS pair.
  //   Skipping incomplete weeks prevents a single partial save from overwriting
  //   the established 2-week rotation template.
  for (let i = sortedWeeks.length - 1; i >= 1; i--) {
    const a = sortedWeeks[i - 1], b = sortedWeeks[i];
    if (!isConsecutivePair(a, b)) continue;
    if (!isComplete(a) || !isComplete(b)) continue;
    if (areHeterogeneous(a, b)) { week1Key = a; week2Key = b; break; }
  }

  // Pass 2: latest COMPLETE + CONSECUTIVE pair (1-week repeat pattern is OK)
  if (week1Key === null) {
    for (let i = sortedWeeks.length - 1; i >= 1; i--) {
      const a = sortedWeeks[i - 1], b = sortedWeeks[i];
      if (!isConsecutivePair(a, b)) continue;
      if (!isComplete(a) || !isComplete(b)) continue;
      week1Key = a; week2Key = b; break;
    }
  }

  // Pass 3: latest CONSECUTIVE + HETEROGENEOUS pair (relaxed - allows incomplete)
  if (week1Key === null) {
    for (let i = sortedWeeks.length - 1; i >= 1; i--) {
      const a = sortedWeeks[i - 1], b = sortedWeeks[i];
      if (!isConsecutivePair(a, b)) continue;
      if (areHeterogeneous(a, b)) { week1Key = a; week2Key = b; break; }
    }
  }

  // Pass 4: any consecutive pair (last resort)
  if (week1Key === null) {
    for (let i = sortedWeeks.length - 1; i >= 1; i--) {
      const a = sortedWeeks[i - 1], b = sortedWeeks[i];
      if (isConsecutivePair(a, b)) { week1Key = a; week2Key = b; break; }
    }
  }

  // Pass 5 final fallback: only one week exists in DB
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

// Count working (Mon–Fri) non-holiday days from `from` (inclusive) up to `to` (exclusive).
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
  if (dow === 0 || dow === 6) return null; // weekend

  if (holidaySet) {
    // Holiday-aware: skip holiday dates in the working-day count so PIC shifts forward.
    if (holidaySet.has(toKey(date))) return null; // holiday  no PIC

    const anchorDate = new Date(tpl.anchorMonday.getFullYear(), tpl.anchorMonday.getMonth(), tpl.anchorMonday.getDate());
    const targetDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    // Position in 10-slot cycle (5 days × 2 weeks), counting only working non-holiday days.
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

  // Original logic (no holiday awareness)
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

/** Rolling PIC display name for a date. Pass holidays[] to shift PIC away from holiday dates. */
export function getRollingNameForDate(date: Date, dbRows: PiketRow[], holidays?: string[]): string {
  const tpl = buildRollingTemplate(dbRows);
  if (!tpl) return '';
  const holidaySet = holidays && holidays.length > 0 ? new Set(holidays) : undefined;
  const slot = resolveSlot(date, tpl, holidaySet);
  if (!slot) return '';
  return slot.nameMap[slot.dayName] || '';
}

/** Rolling PIC user_id for a date. Pass holidays[] to shift PIC away from holiday dates. */
export function getRollingUserIdForDate(date: Date, dbRows: PiketRow[], holidays?: string[]): string {
  const tpl = buildRollingTemplate(dbRows);
  if (!tpl) return '';
  const holidaySet = holidays && holidays.length > 0 ? new Set(holidays) : undefined;
  const slot = resolveSlot(date, tpl, holidaySet);
  if (!slot) return '';
  return slot.uidMap[slot.dayName] || '';
}
