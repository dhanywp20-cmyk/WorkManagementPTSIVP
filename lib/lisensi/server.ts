import { createPrivateKey, createPublicKey, randomUUID, sign, verify, type KeyObject } from 'node:crypto';
import {
  type IsianTerbit, type KlaimLisensi, nilaiKlaim, pesanKunci, type StatusLisensi, statusKosong, statusPengembangan, susunKunci, uraiKunci,
} from './inti';
import { KUNCI_PUBLIK_LISENSI } from './kunci-publik';

const kunciDari = (teks: string, jenis: 'publik' | 'privat'): KeyObject => {
  const t = teks.trim();
  if (t.includes('BEGIN')) return jenis === 'publik' ? createPublicKey(t) : createPrivateKey(t);
  const der = Buffer.from(t, 'base64');
  return jenis === 'publik' ? createPublicKey({ key: der, format: 'der', type: 'spki' }) : createPrivateKey({ key: der, format: 'der', type: 'pkcs8' });
};

let publikTersimpan: KeyObject | null = null;
function kunciPublik(): KeyObject | null {
  if (publikTersimpan) return publikTersimpan;
  try { publikTersimpan = kunciDari(KUNCI_PUBLIK_LISENSI, 'publik'); } catch { publikTersimpan = null; }
  return publikTersimpan;
}

export function periksaKunci(teks: string, host: string, sekarang = Date.now(), publik: KeyObject | null = kunciPublik()): StatusLisensi {
  if (!teks.trim()) return statusKosong('tidak-ada');
  if (!publik) return statusKosong('kunci-publik');
  const urai = uraiKunci(teks);
  if (!urai) return statusKosong('format');
  let cocok = false;
  try { cocok = verify(null, Buffer.from(urai.pesan), publik, Buffer.from(urai.tanda)); } catch { cocok = false; }
  if (!cocok) return statusKosong('tanda-tangan');
  return nilaiKlaim(urai.klaim, host, sekarang);
}

const SIMPAN_MS = 10 * 60_000;
const simpanan = new Map<string, { status: StatusLisensi; waktu: number }>();

export function statusLisensi(host: string): StatusLisensi {
  const teks = process.env.LISENSI_KUNCI ?? '';
  if (!teks.trim() && process.env.NODE_ENV === 'development') return statusPengembangan();
  const kunci = `${host}|${teks.length}`;
  const ada = simpanan.get(kunci), sekarang = Date.now();
  if (ada && sekarang - ada.waktu < SIMPAN_MS) return ada.status;
  const status = periksaKunci(teks, host, sekarang);
  simpanan.set(kunci, { status, waktu: sekarang });
  if (simpanan.size > 50) simpanan.delete(simpanan.keys().next().value as string);
  return status;
}

export const adaKunciPrivat = () => !!process.env.LISENSI_KUNCI_PRIVAT?.trim();

export function terbitkanKunci(isian: IsianTerbit, privat: string, sekarang = new Date()): { kunci: string; klaim: KlaimLisensi } {
  const klaim: KlaimLisensi = {
    v: 1, id: randomUUID(), pelanggan: isian.pelanggan, edisi: isian.edisi, domain: isian.domain,
    terbit: sekarang.toISOString(), kedaluwarsa: isian.kedaluwarsa, ...(isian.pemilik ? { pemilik: true } : {}),
  };
  const pesan = pesanKunci(klaim);
  const tanda = sign(null, Buffer.from(pesan), kunciDari(privat, 'privat'));
  return { kunci: susunKunci(pesan, new Uint8Array(tanda)), klaim };
}
