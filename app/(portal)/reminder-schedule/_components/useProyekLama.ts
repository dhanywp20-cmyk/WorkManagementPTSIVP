'use client';

/** useProyekLama - dipecah dari app/(portal)/reminder-schedule/page.tsx (scripts/ekstrak-hook.mjs). Keadaan tetap milik komponen; hook dipanggil di posisi yang sama. */
import { useMemo } from 'react';
import { Reminder } from './shared';
import { normalkanNama } from '@/lib/kelompok-insentif';
import { type JadwalRequest } from './RequestJadwalModal';

export interface ProyekLamaKonteks {
  buatUntukGuest: boolean;
  carianProyek: string;
  emptyForm: Omit<Reminder, "id" | "created_at" | "created_by" | "wa_sent_h1">;
  praPilihProyek: Reminder | null;
  reminders: Reminder[];
  setBuatUntukGuest: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  setCarianProyek: import("react").Dispatch<import("react").SetStateAction<string>>;
  setEditingReminder: import("react").Dispatch<import("react").SetStateAction<Reminder | null>>;
  setExtraDates: import("react").Dispatch<import("react").SetStateAction<string[]>>;
  setFormData: import("react").Dispatch<import("react").SetStateAction<Omit<Reminder, "id" | "created_at" | "created_by" | "wa_sent_h1">>>;
  setLangkahBuat: import("react").Dispatch<import("react").SetStateAction<"pilih" | "cari" | null>>;
  setPraFillGuest: import("react").Dispatch<import("react").SetStateAction<Partial<JadwalRequest> | null>>;
  setPraPilihProyek: import("react").Dispatch<import("react").SetStateAction<Reminder | null>>;
  setProyekLamaTerpilih: import("react").Dispatch<import("react").SetStateAction<Reminder[] | null>>;
  setShowFormModal: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  setShowRequestModal: import("react").Dispatch<import("react").SetStateAction<boolean>>;
}

export function useProyekLama(k: ProyekLamaKonteks) {
  const { buatUntukGuest, carianProyek, emptyForm, praPilihProyek, reminders, setBuatUntukGuest, setCarianProyek, setEditingReminder, setExtraDates, setFormData, setLangkahBuat, setPraFillGuest, setPraPilihProyek, setProyekLamaTerpilih, setShowFormModal, setShowRequestModal } = k;
  const daftarProyekLama = useMemo(() => {
    const peta = new Map<string, Reminder>();
    for (const r of reminders) {
      const n = normalkanNama(r.project_name);
      if (!n) continue;
      const ada = peta.get(n);
      if (!ada || (r.created_at ?? '') > (ada.created_at ?? '')) peta.set(n, r);
    }
    return [...peta.values()].sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''));
  }, [reminders]);

  const hasilCarianProyek = useMemo(() => {
    const q = carianProyek.trim().toLowerCase();
    if (!q) return daftarProyekLama.slice(0, 20);
    return daftarProyekLama
      .filter(r => (r.project_name ?? '').toLowerCase().includes(q))
      .slice(0, 20);
  }, [daftarProyekLama, carianProyek]);

  const mulaiBuatReminder = () => {
    setBuatUntukGuest(false);
    setEditingReminder(null); setFormData(emptyForm); setExtraDates([]);
    setProyekLamaTerpilih(null); setPraFillGuest(null); setPraPilihProyek(null); setCarianProyek('');
    setLangkahBuat('pilih');
  };

  /**
   * Pemicu untuk role Sales/Guest - sebelumnya "Request Jadwal" langsung
   * membuka RequestJadwalModal kosong, tanpa lewat pemilihan tipe project
   * sama sekali. Sekarang memakai DUA LANGKAH YANG SAMA dengan jalur admin;
   * yang membedakan hanya `buatUntukGuest`, dipakai di 'pilih' untuk teks dan
   * di konfirmasiProyekLama untuk menentukan form mana yang dibuka.
   */
  const mulaiRequestJadwal = () => {
    setBuatUntukGuest(true);
    setProyekLamaTerpilih(null); setPraFillGuest(null); setPraPilihProyek(null); setCarianProyek('');
    setLangkahBuat('pilih');
  };

  const konfirmasiProyekLama = () => {
    if (!praPilihProyek) return;
    const n = normalkanNama(praPilihProyek.project_name);
    // Sengaja dari `reminders` yang SUDAH termuat di halaman ini, bukan kueri
    // baru. Untuk akun Sales/Guest, fetchRemindersForUser hanya memuat baris
    // miliknya sendiri (lihat catatan di sana) - jadi daftar ini otomatis
    // tidak pernah memuat project sales lain, tanpa saringan tambahan di sini.
    const sebatch = reminders.filter(r => normalkanNama(r.project_name) === n);
    setProyekLamaTerpilih(sebatch);
    setLangkahBuat(null);

    if (buatUntukGuest) {
      // JadwalRequest tidak punya sales_name/assign_name - pelakunya sudah
      // pasti currentUser, jadi tidak perlu (dan tidak boleh) disalin dari
      // baris lama, yang bisa saja milik Sales External lain yang sedang
      // di-CC-kan (SBU) ke akun ini.
      setPraFillGuest({
        project_name: praPilihProyek.project_name || '',
        address: praPilihProyek.address ?? '',
        product: praPilihProyek.product ?? '',
        pic_name: praPilihProyek.pic_name ?? '',
        pic_phone: praPilihProyek.pic_phone ?? '',
        sales_division: praPilihProyek.sales_division || undefined,
        brand: (praPilihProyek.brand as JadwalRequest['brand']) ?? undefined,
      });
      setShowRequestModal(true);
      return;
    }

    setFormData(prev => ({
      ...prev,
      project_name: praPilihProyek.project_name || '',
      address: praPilihProyek.address ?? '',
      sales_name: praPilihProyek.sales_name ?? '',
      sales_division: praPilihProyek.sales_division ?? '',
      product: praPilihProyek.product ?? '',
      pic_name: praPilihProyek.pic_name ?? '',
      pic_phone: praPilihProyek.pic_phone ?? '',
      brand: praPilihProyek.brand ?? prev.brand,
    }));
    setShowFormModal(true);
  };
  return { daftarProyekLama, hasilCarianProyek, mulaiBuatReminder, mulaiRequestJadwal, konfirmasiProyekLama };
}
