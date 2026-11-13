'use client';

import { useEffect, useState } from 'react';
import { bacaPengaturan, type PengaturanNotifikasi } from '@/lib/notifikasi/pengaturan';
import { ambilPengaturanAI, AI_BAWAAN, type PengaturanAI, ambilPengaturanPenilai, PENILAI_BAWAAN, type PengaturanPenilai } from '@/lib/ai-pengaturan';
import { supabase } from '@/lib/supabase';
import { type ConfirmState } from '@/components/shared';
import type { StatusRahasia, StatusKoneksi, PesanKotak } from './modal-integrasi';

export function useIntegrasi() {
  const [p, setP] = useState<PengaturanNotifikasi | null>(null);
  const [simpan, setSimpan] = useState(false);
  const [pesan, setPesan] = useState<{ tipe: 'ok' | 'gagal'; teks: string } | null>(null);
  const [ujiJalan, setUjiJalan] = useState<string | null>(null);
  const [rahasia, setRahasia] = useState<Record<string, StatusRahasia>>({});
  const [waTujuan, setWaTujuan] = useState('');
  const [koneksi, setKoneksi] = useState<Record<'telegram' | 'whatsapp', StatusKoneksi>>({
    telegram: { keadaan: 'memuat' }, whatsapp: { keadaan: 'memuat' },
  });
  const [pesanKanal, setPesanKanal] = useState<Record<string, PesanKotak | null>>({});
  const [chatTerdeteksi, setChatTerdeteksi] = useState<{ id: string; nama: string; jenis: string }[] | null>(null);
  const [deteksiJalan, setDeteksiJalan] = useState(false);
  const [seksi, setSeksi] = useState<'kanal' | 'wa' | 'tg' | 'push' | 'tim' | 'ai'>('kanal');
  const [pushInfo, setPushInfo] = useState<{ aktif: boolean; jumlahPerangkat: number } | null>(null);
  const [pushMemuat, setPushMemuat] = useState(false);
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const [pushPesan, setPushPesan] = useState<{ tipe: 'ok' | 'gagal'; teks: string } | null>(null);
  const [tim, setTim] = useState<{ nama: string; tim: string; jabatan: string; wa: boolean; tg: boolean }[]>([]);
  const [cariEvent, setCariEvent] = useState('');
  const [ai, setAi] = useState<PengaturanAI>(AI_BAWAAN);
  const [penilai, setPenilai] = useState<PengaturanPenilai>(PENILAI_BAWAAN);

  const muatPushInfo = async () => {
    try {
      const r = await fetch('/api/push/setup', { credentials: 'include' });
      const j = await r.json() as { ok?: boolean; aktif?: boolean; jumlahPerangkat?: number };
      if (j?.ok) setPushInfo({ aktif: !!j.aktif, jumlahPerangkat: j.jumlahPerangkat ?? 0 });
    } catch {  }
  };

  const aktifkanPushServer = async (paksa: boolean) => {
    setPushMemuat(true);
    setPushPesan(null);
    try {
      const r = await fetch(`/api/push/setup${paksa ? '?force=1' : ''}`, { method: 'POST', credentials: 'include' });
      const j = await r.json() as { ok?: boolean; alasan?: string };
      if (j?.ok) {
        setPushPesan({ tipe: 'ok', teks: paksa ? 'Kunci baru dibuat. Semua perangkat lama perlu mendaftar ulang.' : 'Push notification aktif!' });
        await muatPushInfo();
      } else {
        setPushPesan({ tipe: 'gagal', teks: j?.alasan ?? 'Gagal mengaktifkan.' });
      }
    } catch {
      setPushPesan({ tipe: 'gagal', teks: 'Tidak bisa menghubungi server.' });
    } finally {
      setPushMemuat(false);
    }
  };

  const muatRahasia = async () => {
    try {
      const r = await fetch('/api/integrasi/rahasia', { credentials: 'include' });
      const j = await r.json() as { ok?: boolean; status?: Record<string, StatusRahasia> };
      if (j?.ok && j.status) setRahasia(j.status);
    } catch {  }
  };

  const cekKoneksi = async (kanal: 'telegram' | 'whatsapp') => {
    setKoneksi(s => ({ ...s, [kanal]: { keadaan: 'memuat' } }));
    try {
      const r = await fetch(`/api/notifikasi/${kanal}`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aksi: 'cek' }),
      });
      const j = await r.json() as { ok?: boolean; alasan?: string; bot?: string; perangkat?: string };
      setKoneksi(s => ({
        ...s,
        [kanal]: j?.ok
          ? { keadaan: 'terhubung', info: kanal === 'telegram' ? (j.bot ?? '') : (j.perangkat ?? '') }
          : { keadaan: 'putus', alasan: j?.alasan ?? 'Tidak diketahui.' },
      }));
    } catch {
      setKoneksi(s => ({ ...s, [kanal]: { keadaan: 'putus', alasan: 'Tidak bisa menghubungi server.' } }));
    }
  };

  const muatTim = async () => {
    const { data } = await supabase.from('users')
      .select('full_name, team_type, jabatan, phone_number, telegram_terhubung')
      .eq('role', 'team')
      .order('full_name');
    setTim((data ?? []).map((u: {
      full_name: string; team_type: string | null; jabatan: string | null;
      phone_number: string | null; telegram_terhubung: boolean | null;
    }) => ({
      nama: u.full_name,
      tim: u.team_type ?? '-',
      jabatan: u.jabatan ?? 'Staff',
      wa: !!(u.phone_number ?? '').trim(),
      tg: !!u.telegram_terhubung,
    })));
  };

  useEffect(() => {
    bacaPengaturan(true).then(setP);
    muatRahasia();
    ambilPengaturanAI().then(setAi);
    ambilPengaturanPenilai().then(setPenilai);
    void muatTim();
    void cekKoneksi('telegram');
    void cekKoneksi('whatsapp');
    void muatPushInfo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const simpanRahasia = async (kunci: string, nilai: string) => {
    try {
      const r = await fetch('/api/integrasi/rahasia', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kunci, nilai }),
      });
      const j = await r.json() as { ok?: boolean; alasan?: string };
      setPesan(j?.ok ? { tipe: 'ok', teks: 'Token tersimpan.' }
                     : { tipe: 'gagal', teks: j?.alasan ?? 'Gagal menyimpan token.' });
      if (j?.ok) {
        await muatRahasia();
        await segarkanKoneksiUntuk(kunci);
      }
    } catch { setPesan({ tipe: 'gagal', teks: 'Tidak bisa menghubungi server.' }); }
  };

  const segarkanKoneksiUntuk = async (kunci: string) => {
    if (kunci.startsWith('telegram.')) await cekKoneksi('telegram');
    else if (kunci.startsWith('whatsapp.')) await cekKoneksi('whatsapp');
  };

  const hapusRahasia = async (kunci: string) => {
    try {
      const r = await fetch(`/api/integrasi/rahasia?kunci=${encodeURIComponent(kunci)}`,
        { method: 'DELETE', credentials: 'include' });
      const j = await r.json() as { ok?: boolean; alasan?: string };
      setPesan(j?.ok ? { tipe: 'ok', teks: 'Token dihapus.' }
                     : { tipe: 'gagal', teks: j?.alasan ?? 'Gagal menghapus.' });
      if (j?.ok) { await muatRahasia(); await segarkanKoneksiUntuk(kunci); }
    } catch { setPesan({ tipe: 'gagal', teks: 'Tidak bisa menghubungi server.' }); }
  };
  return {
    p, setP, setPesan, setSimpan, ai, penilai, setUjiJalan, setPesanKanal,
    waTujuan, setKoneksi, cekKoneksi, setDeteksiJalan, setChatTerdeteksi, cariEvent, tim, seksi,
    koneksi, pushInfo, setSeksi, setCariEvent, hapusRahasia, pesanKanal, rahasia, setWaTujuan,
    simpanRahasia, ujiJalan, chatTerdeteksi, deteksiJalan, aktifkanPushServer, pushMemuat, pushPesan, setConfirmState,
    setAi, setPenilai, pesan, simpan, confirmState,
  };
}
