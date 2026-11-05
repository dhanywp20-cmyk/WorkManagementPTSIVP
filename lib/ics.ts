
export interface AcaraKalender {
  uid: string;
  judul: string;
   tanggal: string;
   jam?: string | null;
   durasi?: number;
  lokasi?: string | null;
  keterangan?: string | null;
  url?: string | null;
}

const WIB_MENIT = 7 * 60;
const dua = (n: number) => String(n).padStart(2, '0');

export const escIcs = (t: string) => t.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

export function lipat(baris: string): string {
  const enc = new TextEncoder();
  if (enc.encode(baris).length <= 75) return baris;
  const hasil: string[] = [];
  let kini = '', panjang = 0, batas = 75;
  for (const ch of baris) {
    const b = enc.encode(ch).length;
    if (panjang + b > batas) { hasil.push(kini); kini = ''; panjang = 0; batas = 74; }
    kini += ch; panjang += b;
  }
  hasil.push(kini);
  return hasil.join('\r\n ');
}

export function utcDariWib(tanggal: string, jam: string, tambahMenit = 0): string {
  const [y, m, d] = tanggal.split('-').map(Number);
  const [hh, mm] = jam.split(':').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d, hh, mm) - WIB_MENIT * 60_000 + tambahMenit * 60_000);
  return `${t.getUTCFullYear()}${dua(t.getUTCMonth() + 1)}${dua(t.getUTCDate())}T${dua(t.getUTCHours())}${dua(t.getUTCMinutes())}00Z`;
}

const hariBerikut = (tanggal: string) => {
  const [y, m, d] = tanggal.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + 1));
  return `${t.getUTCFullYear()}${dua(t.getUTCMonth() + 1)}${dua(t.getUTCDate())}`;
};

export function buatIcs(a: AcaraKalender, sekarang = new Date()): string {
  const jamSah = !!a.jam && /^\d{1,2}:\d{2}/.test(a.jam);
  const stempel = `${sekarang.getUTCFullYear()}${dua(sekarang.getUTCMonth() + 1)}${dua(sekarang.getUTCDate())}T${dua(sekarang.getUTCHours())}${dua(sekarang.getUTCMinutes())}${dua(sekarang.getUTCSeconds())}Z`;
  const waktu = jamSah
    ? [`DTSTART:${utcDariWib(a.tanggal, a.jam!)}`, `DTEND:${utcDariWib(a.tanggal, a.jam!, a.durasi ?? 120)}`]
    : [`DTSTART;VALUE=DATE:${a.tanggal.replace(/-/g, '')}`, `DTEND;VALUE=DATE:${hariBerikut(a.tanggal)}`];
  const baris = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//PTS IVP//Work Management//ID', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'BEGIN:VEVENT', `UID:${a.uid}@work-management-ptsivp`, `DTSTAMP:${stempel}`, ...waktu,
    `SUMMARY:${escIcs(a.judul)}`,
    ...(a.lokasi ? [`LOCATION:${escIcs(a.lokasi)}`] : []),
    ...(a.keterangan ? [`DESCRIPTION:${escIcs(a.keterangan)}`] : []),
    ...(a.url ? [`URL:${a.url}`] : []),
    'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${escIcs(a.judul)}`, 'TRIGGER:-PT1H', 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR',
  ];
  return baris.map(lipat).join('\r\n') + '\r\n';
}
