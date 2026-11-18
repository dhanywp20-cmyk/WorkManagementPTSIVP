
export type StatusIsu = 'open' | 'progress' | 'pending' | 'solved';
export type PrioritasIsu = 'tinggi' | 'sedang' | 'rendah';

export const URUTAN_STATUS: StatusIsu[] = ['open', 'progress', 'pending', 'solved'];

export const STATUS_ISU: Record<StatusIsu, { label: string; warna: string; tint: string; garis: string }> = {
  open: { label: 'Open', warna: '#b91c1c', tint: '#fef2f2', garis: '#fecaca' },
  progress: { label: 'On Progress', warna: '#1d4ed8', tint: '#eff6ff', garis: '#bfdbfe' },
  pending: { label: 'Pending', warna: '#b45309', tint: '#fffbeb', garis: '#fde68a' },
  solved: { label: 'Solved', warna: '#15803d', tint: '#f0fdf4', garis: '#bbf7d0' },
};

export const PRIORITAS_ISU: Record<PrioritasIsu, { label: string; warna: string }> = {
  tinggi: { label: 'Tinggi', warna: '#b91c1c' },
  sedang: { label: 'Sedang', warna: '#b45309' },
  rendah: { label: 'Rendah', warna: '#64748b' },
};

export const KATEGORI_BAWAAN = ['Display', 'Audio', 'Video Conference', 'Kontrol', 'Jaringan', 'Listrik', 'Furniture', 'Lainnya'];

export interface IsuGrup {
  id: string;
  nama: string;
  client: string | null;
  keterangan: string;
  proyek_ids: string[];
  kategori: string[];
  share_aktif: boolean;
  share_token?: string | null;
  share_latar?: string | null;
  updated_at: string;
}

export interface LokasiIsu {
  id: string;
  nama: string;
  proyek: string;
  client?: string;
}

export interface Isu {
  id: string;
  grup_id: string;
  nomor: number;
  daftar_id: string | null;
  lokasi: string;
  tanggal: string;
  kategori: string;
  produk: string;
  prioritas: PrioritasIsu;
  judul: string;
  deskripsi: string;
  pelapor: string;
  pic: string;
  status: StatusIsu;
  action: string;
  solusi: string;
  catatan_internal?: string;
  foto_url: string | null;
  foto_thumb_url: string | null;
  selesai_pada: string | null;
  dibuat_oleh_nama: string | null;
  diubah_oleh_nama: string | null;
  created_at: string;
  updated_at: string;
  sumber?: 'manual' | 'tiket';
  tiket_id?: string | null;
  riwayat?: RiwayatIsu[];
  tiket?: TiketIsu;
}

export interface AktivitasTiket {
  id: string; ticket_id: string; handler_name: string | null; handler_username: string | null; action_taken: string | null;
  notes: string | null; file_url: string | null; file_name: string | null; photo_url: string | null; photo_name: string | null;
  new_status: string | null; team_type: string | null; assigned_to_services: boolean | null; created_at: string;
}

export interface TiketIsu {
  id: string; project_name: string | null; issue_case: string | null; description: string | null; assign_name: string | null;
  status: string | null; date: string | null; created_at: string; created_by: string | null; sales_name: string | null;
  product: string | null; priority: string | null; photo_url: string | null; reminder_id: string | null; address: string | null;
  customer_phone: string | null; sn_unit: string | null; current_team: string | null; services_status: string | null;
  sales_division: string | null; photo_name: string | null; rejection_reason: string | null; routing_status: string | null;
  brand: string | null; activity_logs: AktivitasTiket[];
}

export interface RiwayatIsu {
  id: string;
  isu_id: string;
  aksi: 'dibuat' | 'status' | 'action' | 'ubah' | string;
  dari: string | null;
  ke: string | null;
  keterangan: string;
  nama: string | null;
  created_at: string;
}

export interface HakIsu {
  edit: boolean;
  admin: boolean;
  kelola?: boolean;
}

export const HAK_BACA: HakIsu = { edit: false, admin: false, kelola: false };
export function tanggalWib(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
}

export function hariIni(): string {
  return tanggalWib(new Date());
}

export function geserTanggal(t: string, hari: number): string {
  const d = new Date(`${t}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + hari);
  return d.toISOString().slice(0, 10);
}

export function selisihHari(dari: string, sampai: string): number {
  return Math.round((Date.parse(`${sampai}T00:00:00Z`) - Date.parse(`${dari}T00:00:00Z`)) / 86400000);
}

export function labelHari(t: string): string {
  const d = new Date(`${t}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return t;
  return d.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}

export function labelTanggalLengkap(t: string): string {
  const d = new Date(`${t}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return t;
  return d.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

export function labelTanggalPendek(t: string): string {
  const d = new Date(`${t}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return t;
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', timeZone: 'UTC' });
}
export function tanggalSelesai(i: Isu): string | null {
  return i.status === 'solved' && i.selesai_pada ? tanggalWib(i.selesai_pada) : null;
}
export function terbukaPada(i: Isu, t: string): boolean {
  if (i.tanggal > t) return false;
  const s = tanggalSelesai(i);
  return !s || s > t;
}

export type PeranHarian = 'baru' | 'selesai' | 'lanjutan';

export interface BarisKota {
  lokasi: string;
  baru: number;
  selesai: number;
  terbuka: number;
  isu: Isu[];
}

export interface RingkasanHarian {
  tanggal: string;
  baru: Isu[];
  selesai: Isu[];
  terbuka: Isu[];
  relevan: Isu[];
  kota: BarisKota[];
  kotaTerdampak: number;
}
export function peranPada(i: Isu, t: string): PeranHarian | null {
  if (tanggalSelesai(i) === t) return 'selesai';
  if (i.tanggal === t) return 'baru';
  if (terbukaPada(i, t)) return 'lanjutan';
  return null;
}

function urutIsu(a: Isu, b: Isu): number {
  const bobotStatus = (s: StatusIsu) => URUTAN_STATUS.indexOf(s);
  const bobotPrio = (p: PrioritasIsu) => ['tinggi', 'sedang', 'rendah'].indexOf(p);
  return bobotStatus(a.status) - bobotStatus(b.status) || bobotPrio(a.prioritas) - bobotPrio(b.prioritas) || b.tanggal.localeCompare(a.tanggal) || b.nomor - a.nomor;
}

export function ringkasHarian(semua: Isu[], t: string): RingkasanHarian {
  const baru = semua.filter(i => i.tanggal === t);
  const selesai = semua.filter(i => tanggalSelesai(i) === t);
  const terbuka = semua.filter(i => terbukaPada(i, t));
  const relevan = semua.filter(i => peranPada(i, t) !== null).sort(urutIsu);

  const peta = new Map<string, BarisKota>();
  for (const i of relevan) {
    const b = peta.get(i.lokasi) ?? { lokasi: i.lokasi, baru: 0, selesai: 0, terbuka: 0, isu: [] };
    const peran = peranPada(i, t);
    if (i.tanggal === t) b.baru += 1;
    if (peran === 'selesai') b.selesai += 1;
    if (terbukaPada(i, t)) b.terbuka += 1;
    b.isu.push(i);
    peta.set(i.lokasi, b);
  }
  const kota = [...peta.values()].sort((a, b) => b.terbuka - a.terbuka || b.baru - a.baru || a.lokasi.localeCompare(b.lokasi));
  return { tanggal: t, baru, selesai, terbuka, relevan, kota, kotaTerdampak: kota.filter(k => k.terbuka > 0).length };
}
export function labelStatusPada(i: Isu, t: string): string {
  const s = tanggalSelesai(i);
  if (s && s > t) return `Solved ${labelTanggalPendek(s)}`;
  return STATUS_ISU[i.status].label;
}

export function umurIsu(i: Isu, acuan: string): number {
  const akhir = tanggalSelesai(i) ?? acuan;
  return Math.max(0, selisihHari(i.tanggal, akhir));
}
export function teksRingkasan(namaGrup: string, r: RingkasanHarian): string {
  const baris: string[] = [
    `*Ringkasan Isu ${namaGrup}*`,
    labelHari(r.tanggal),
    `Baru: ${r.baru.length} · Solved: ${r.selesai.length} · Masih terbuka: ${r.terbuka.length} (${r.kotaTerdampak} lokasi)`,
  ];
  if (!r.kota.length) {
    baris.push('', 'Tidak ada isu tercatat.');
    return baris.join('\n');
  }
  for (const k of r.kota) {
    baris.push('', `*${k.lokasi}*`);
    for (const i of k.isu) {
      const peran = peranPada(i, r.tanggal);
      const tanda = peran === 'baru' ? ' (baru)' : peran === 'lanjutan' ? ` (hari ke-${umurIsu(i, r.tanggal) + 1})` : '';
      const st = labelStatusPada(i, r.tanggal);
      let teks = `• ${kodeIsu(i)} [${st}] ${i.judul}${tanda}`;
      const tindak = peran === 'selesai' && i.solusi ? `Solusi: ${i.solusi}` : i.action ? `Action: ${i.action}` : '';
      if (tindak) teks += ` - ${tindak}`;
      if (i.pic) teks += ` (PIC ${i.pic})`;
      baris.push(teks);
    }
  }
  return baris.join('\n');
}

const POLA_KATEGORI: [string, RegExp][] = [
  ['Video Conference', /\b(camera|kamera|vc|zoom|teams|webcam|ptz|codec|video ?conf)/],
  ['Audio', /\b(mic|microphone|mikrofon|speaker|audio|suara|sound|noise|amplifier|amp|dsp|fonestar|delegate|conference system)/],
  ['Display', /\b(tv|display|layar|monitor|backlight|led|lcd|videowall|video wall|proyektor|projector|blank|bdl|panel)/],
  ['Kontrol', /\b(matrix|hdmi|switcher|control|kontrol|touch|tablet|ipad|crestron|extron|scaler|presentation|dongle|miracast|clickshare)/],
  ['Jaringan', /\b(network|jaringan|lan|wifi|offline|ip|switch|router|internet|koneksi|connect)/],
  ['Listrik', /\b(listrik|power|daya|ups|stop ?kontak|mati total|adaptor|adapter)/],
];

export function tebakKategori(teks: string): string {
  const t = teks.toLowerCase();
  return POLA_KATEGORI.find(([, re]) => re.test(t))?.[0] ?? 'Lainnya';
}

export interface BatangIsu {
  kunci: string;
  label: string;
  total: number;
  terbuka: number;
}

export function kunciTeks(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function pecahProduk(s: string | null | undefined): string[] {
  const hasil = new Map<string, string>();
  for (const bagian of (s ?? '').split(/\s*(?:,|;|&|\+|\/|\bdan\b)\s*/i)) {
    const t = bagian.trim();
    if (t && !hasil.has(kunciTeks(t))) hasil.set(kunciTeks(t), t);
  }
  return [...hasil.values()];
}

export function hitungPer(isu: Isu[], ambil: (i: Isu) => string[]): BatangIsu[] {
  const m = new Map<string, BatangIsu>();
  for (const i of isu) {
    for (const label of new Set(ambil(i).map(x => x.trim()).filter(Boolean))) {
      const k = kunciTeks(label);
      const b = m.get(k) ?? { kunci: k, label, total: 0, terbuka: 0 };
      b.total += 1;
      if (i.status !== 'solved') b.terbuka += 1;
      m.set(k, b);
    }
  }
  return [...m.values()].sort((a, b) => b.total - a.total || b.terbuka - a.terbuka || a.label.localeCompare(b.label));
}

export function kodeIsu(i: Isu): string {
  return i.sumber === 'tiket' ? 'Tiket' : `#${i.nomor}`;
}

export function dariTiket(i: Isu): boolean {
  return i.sumber === 'tiket';
}

export interface UpdateIsu { waktu: string; oleh: string; status: string; update: string; catatan: string; awal: boolean }

export function daftarUpdate(i: Isu): UpdateIsu[] {
  if (i.tiket) {
    return [
      { waktu: i.created_at, oleh: i.dibuat_oleh_nama ?? '', status: 'Dibuat', update: 'Ticket dibuat', catatan: '', awal: true },
      ...i.tiket.activity_logs.map(a => ({
        waktu: a.created_at, oleh: (a.handler_name ?? '').trim(), status: (a.new_status ?? '').trim(),
        update: (a.action_taken ?? '').trim(), catatan: (a.notes ?? '').trim(), awal: false,
      })),
    ];
  }
  return (i.riwayat ?? []).map(r => ({
    waktu: r.created_at,
    oleh: (r.nama ?? '').trim(),
    status: r.ke && r.ke in STATUS_ISU ? STATUS_ISU[r.ke as StatusIsu].label : r.aksi === 'dibuat' ? 'Dibuat' : '',
    update: r.aksi === 'dibuat' ? 'Isu dicatat' : r.keterangan.trim(),
    catatan: '',
    awal: r.aksi === 'dibuat',
  }));
}

export function labelWaktu(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function teksSemuaUpdate(i: Isu): string {
  return daftarUpdate(i).map((u, n) => {
    let t = `${n + 1}) ${labelWaktu(u.waktu)}`;
    if (u.oleh) t += ` · ${u.oleh}`;
    if (u.status) t += ` [${u.status}]`;
    if (u.update) t += `: ${u.update}`;
    if (u.catatan) t += ` (${u.catatan})`;
    return t;
  }).join('  |  ');
}

export interface HariTren { tanggal: string; baru: number; solved: number }

export interface LaporanIsu {
  total: number;
  terbuka: number;
  perStatus: Record<StatusIsu, number>;
  persenSolved: number;
  rataSelesai: number | null;
  terlamaTerbuka: number;
  baru7: number;
  lokasiTerdampak: number;
  tren: HariTren[];
  lokasiTerbuka: { lokasi: string; terbuka: number; total: number }[];
}

export function ringkasLaporan(isu: Isu[], acuan: string, hariTren = 30): LaporanIsu {
  const perStatus: Record<StatusIsu, number> = { open: 0, progress: 0, pending: 0, solved: 0 };
  const mulaiTren = geserTanggal(acuan, 1 - hariTren);
  const mulai7 = geserTanggal(acuan, -6);
  const tren = new Map<string, HariTren>();
  for (let n = 0; n < hariTren; n++) {
    const t = geserTanggal(mulaiTren, n);
    tren.set(t, { tanggal: t, baru: 0, solved: 0 });
  }
  const lokasi = new Map<string, { lokasi: string; terbuka: number; total: number }>();
  const lamaSelesai: number[] = [];
  let terlamaTerbuka = 0;
  let baru7 = 0;
  for (const i of isu) {
    perStatus[i.status] += 1;
    const l = lokasi.get(i.lokasi) ?? { lokasi: i.lokasi, terbuka: 0, total: 0 };
    l.total += 1;
    const selesai = tanggalSelesai(i);
    if (selesai) lamaSelesai.push(umurIsu(i, acuan));
    else { l.terbuka += 1; terlamaTerbuka = Math.max(terlamaTerbuka, umurIsu(i, acuan)); }
    lokasi.set(i.lokasi, l);
    if (i.tanggal >= mulai7 && i.tanggal <= acuan) baru7 += 1;
    const hBaru = tren.get(i.tanggal);
    if (hBaru) hBaru.baru += 1;
    const hSelesai = selesai ? tren.get(selesai) : undefined;
    if (hSelesai) hSelesai.solved += 1;
  }
  const total = isu.length;
  const terbuka = total - perStatus.solved;
  return {
    total, terbuka, perStatus,
    persenSolved: total ? Math.round((perStatus.solved / total) * 100) : 0,
    rataSelesai: lamaSelesai.length ? Math.round((lamaSelesai.reduce((a, b) => a + b, 0) / lamaSelesai.length) * 10) / 10 : null,
    terlamaTerbuka, baru7,
    lokasiTerdampak: [...lokasi.values()].filter(l => l.terbuka > 0).length,
    tren: [...tren.values()],
    lokasiTerbuka: [...lokasi.values()].filter(l => l.terbuka > 0)
      .sort((a, b) => b.terbuka - a.terbuka || b.total - a.total || a.lokasi.localeCompare(b.lokasi)),
  };
}

export function urlShareIsu(base: string, token: string): string {
  return `${base}/project-progress/share/isu/${token}`;
}
