import type { AdminField } from '@/lib/admin-edit';
import { type RoomDetail, emptyRoom } from './shared';

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

export const EDIT_ROOM_LABELS: AdminField[] = [
  { key: 'room_name',        label: 'Nama Ruangan' },
  { key: 'kebutuhan',        label: 'Kebutuhan' },
  { key: 'solution_product', label: 'Solution' },
  { key: 'ukuran_ruangan',   label: 'Ukuran Ruangan' },
  { key: 'suggest_tampilan', label: 'Saran Tampilan' },
  { key: 'keterangan_lain',  label: 'Keterangan' },
];

export const ambilFieldRuangan = (r: Partial<RoomDetail>): EditRoomFields => {
  const dasar = emptyRoom() as unknown as Record<string, unknown>;
  const src = r as unknown as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const k of EDIT_ROOM_KEYS) out[k] = src[k] ?? dasar[k];
  return out as unknown as EditRoomFields;
};
export const namaRuangan = (r: { room_name?: string | null }, nomor: number) => r.room_name?.trim() || `Ruangan ${nomor}`;

export type SumberKebutuhan = { kebutuhan?: string[] | null; kebutuhan_other?: string | null };
export const daftarKebutuhan = (r: SumberKebutuhan & { rooms?: SumberKebutuhan[] | null }): string[] => {
  const hasil = new Set<string>();
  for (const rm of [r, ...(r.rooms || [])]) {
    for (const k of rm.kebutuhan || []) if (k) hasil.add(k);
    if (rm.kebutuhan_other?.trim()) hasil.add('Lainnya');
  }
  if (hasil.size === 0) hasil.add('Belum diisi');
  return [...hasil];
};
