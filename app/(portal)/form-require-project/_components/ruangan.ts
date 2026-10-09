import type { AdminField } from '@/lib/admin-edit';
import { type RoomDetail, emptyRoom } from './shared';

/**
 * Field ruangan yang boleh diubah lewat form Edit. Ruangan 1 hidup di kolom
 * request langsung (editFormData), ruangan 2+ hidup di JSONB `rooms[]` -
 * bentuk field-nya sama, jadi satu daftar ini dipakai untuk keduanya.
 *
 * Field lain di rooms[] (status, assign_*, approved_*, brand_*, PIC,
 * survey_photos_count) SENGAJA tidak ada di sini: itu diurus alur
 * approve/assign, bukan form Edit, dan tidak boleh tertimpa saat menyimpan.
 */
export const EDIT_ROOM_KEYS = [
  'room_name', 'kebutuhan', 'kebutuhan_other', 'solution_product', 'solution_other',
  'layout_signage', 'jaringan_cms', 'jumlah_input', 'jumlah_output',
  'source', 'source_other',
  'camera_conference', 'camera_jumlah', 'camera_tracking',
  'audio_system', 'audio_mixer', 'audio_detail',
  'wallplate_input', 'wallplate_jumlah', 'tabletop_input', 'tabletop_jumlah',
  'wireless_presentation', 'wireless_mode', 'wireless_dongle',
  'controller_automation', 'controller_type',
  'ukuran_ruangan', 'suggest_tampilan', 'keterangan_lain',
] as const;
export type EditRoomKey = typeof EDIT_ROOM_KEYS[number];
export type EditRoomFields = Pick<RoomDetail, EditRoomKey>;

/** Field ruangan 2+ yang dicatat ke audit & WA (sama semangatnya dengan REQUEST_FIELDS). */
export const EDIT_ROOM_LABELS: AdminField[] = [
  { key: 'room_name',        label: 'Nama Ruangan' },
  { key: 'kebutuhan',        label: 'Kebutuhan' },
  { key: 'solution_product', label: 'Solution' },
  { key: 'ukuran_ruangan',   label: 'Ukuran Ruangan' },
  { key: 'suggest_tampilan', label: 'Saran Tampilan' },
  { key: 'keterangan_lain',  label: 'Keterangan' },
];

/** Ambil hanya field yang bisa diedit; yang belum ada di data lama diisi default. */
export const ambilFieldRuangan = (r: Partial<RoomDetail>): EditRoomFields => {
  const dasar = emptyRoom() as unknown as Record<string, unknown>;
  const src = r as unknown as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const k of EDIT_ROOM_KEYS) out[k] = src[k] ?? dasar[k];
  return out as unknown as EditRoomFields;
};
export const namaRuangan = (r: { room_name?: string | null }, nomor: number) => r.room_name?.trim() || `Ruangan ${nomor}`;

export type SumberKebutuhan = { kebutuhan?: string[] | null; kebutuhan_other?: string | null };
/**
 * Kebutuhan sebuah request = gabungan SEMUA ruangannya (Ruangan 1 di kolom
 * request + rooms[]), tanpa duplikat. Satu request dengan Meeting Room dan
 * Command Center dihitung di kedua irisan. Isian "lainnya" digabung ke
 * "Lainnya" supaya teks bebas tidak memecah pie jadi banyak irisan; request
 * yang belum mengisi apa pun masuk "Belum diisi" agar total pie tetap utuh.
 * Dipakai bersama oleh pie chart dan filternya - satu sumber, tidak bisa beda.
 */
export const daftarKebutuhan = (r: SumberKebutuhan & { rooms?: SumberKebutuhan[] | null }): string[] => {
  const hasil = new Set<string>();
  for (const rm of [r, ...(r.rooms || [])]) {
    for (const k of rm.kebutuhan || []) if (k) hasil.add(k);
    if (rm.kebutuhan_other?.trim()) hasil.add('Lainnya');
  }
  if (hasil.size === 0) hasil.add('Belum diisi');
  return [...hasil];
};
