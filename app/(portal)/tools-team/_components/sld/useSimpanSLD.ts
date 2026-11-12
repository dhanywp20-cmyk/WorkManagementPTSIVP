'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { bersihkanDok, tanpaFoto } from '@/lib/sld/dok';
import { semuaPerangkat } from '@/lib/sld/ruang';
import type { DokSLD } from '@/lib/sld/tipe';
import type { KeadaanSLD } from './useKeadaanSLD';

const API = '/api/tools-team/sld';
const KUNCI_AKTIF = 'tools-team-sld-aktif';

export interface SldAktif { id: string; nama: string; versi: number; bolehUbah: boolean; kunci: string }
export interface SldTim { id: string; nama: string; versi: number; jumlah_perangkat: number; dibuat_oleh_nama: string; diubah_oleh_nama: string; updated_at: string; bolehUbah: boolean }
export type Pesan = { t: string; galat?: boolean } | null;

const kunciDok = (d: DokSLD) => JSON.stringify(tanpaFoto(d));

function muatAktif(): SldAktif | null {
  try {
    const v = JSON.parse(localStorage.getItem(KUNCI_AKTIF) ?? 'null') as SldAktif | null;
    return v && typeof v.id === 'string' && typeof v.versi === 'number' ? v : null;
  } catch { return null; }
}

async function jsonDari(r: Response | null) { return r ? r.json().catch(() => null) : null; }

export function useSimpanSLD(a: KeadaanSLD) {
  const [aktif, setAktifState] = useState<SldAktif | null>(null);
  const [sibuk, setSibuk] = useState('');
  const [pesan, setPesan] = useState<Pesan>(null);
  const [daftar, setDaftar] = useState<SldTim[] | null>(null);
  const [halDaftar, setHalDaftar] = useState({ hal: 0, total: 0, perHalaman: 20, q: '' });

  useEffect(() => { if (a.siap) setAktifState(muatAktif()); }, [a.siap]);
  const setAktif = useCallback((v: SldAktif | null) => {
    setAktifState(v);
    try { if (v) localStorage.setItem(KUNCI_AKTIF, JSON.stringify(v)); else localStorage.removeItem(KUNCI_AKTIF); } catch {  }
  }, []);
  const [versiServer, setVersiServer] = useState<{ versi: number; oleh: string } | null>(null);
  const berubah = useMemo(() => (aktif ? kunciDok(a.proyek) !== aktif.kunci : semuaPerangkat(a.proyek).length > 0), [a.proyek, aktif]);

  const kirim = useCallback(async (nama: string, timpa: boolean): Promise<string | null> => {
    setSibuk('simpan'); setPesan(null);
    try {
      const r = await fetch(API, {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: timpa ? aktif?.id : undefined, versi: timpa ? aktif?.versi : undefined, nama, data: a.proyek }),
      }).catch(() => null);
      const j = await jsonDari(r);
      if (!r?.ok || !j?.ok) { setPesan({ t: j?.alasan ?? 'SLD gagal disimpan. Periksa koneksi.', galat: true }); return null; }
      setAktif({ id: j.sld.id, nama, versi: j.sld.versi, bolehUbah: true, kunci: kunciDok(a.proyek) });
      setPesan({ t: `Tersimpan di server tim: ${nama} v${j.sld.versi}. Foto unggahan tetap hanya di browser ini.` });
      return j.sld.id as string;
    } finally { setSibuk(''); }
  }, [a.proyek, aktif, setAktif]);

  const simpan = useCallback(async () => (aktif?.bolehUbah ? kirim(aktif.nama, true) : null), [aktif, kirim]);
  const tautkan = useCallback(async (sldId: string, requestId: string, roomIdx: number, namaRequest: string) => {
    const r = await fetch(`/api/form-require-project/${encodeURIComponent(requestId)}/sld`, {
      method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sld_id: sldId, room_idx: roomIdx }),
    }).catch(() => null);
    const j = await jsonDari(r);
    if (!r?.ok || !j?.ok) { setPesan({ t: `Tersimpan, tetapi gagal ditautkan: ${j?.alasan ?? 'coba lagi dari Request Design.'}`, galat: true }); return false; }
    setPesan({ t: `SLD ditautkan ke Request Design: ${namaRequest}.` });
    return true;
  }, []);
  const simpanSebagai = useCallback((nama: string) => kirim(nama.trim(), false), [kirim]);

  const muatDaftar = useCallback(async (q = '', hal = 0) => {
    setSibuk('daftar');
    try {
      const r = await fetch(`${API}?hal=${hal}${q ? `&q=${encodeURIComponent(q)}` : ''}`, { credentials: 'include', cache: 'no-store' }).catch(() => null);
      const j = await jsonDari(r);
      if (!r?.ok || !j?.ok) { setDaftar([]); setPesan({ t: j?.alasan ?? 'Daftar SLD tim tidak bisa dimuat.', galat: true }); return; }
      setDaftar(j.daftar as SldTim[]);
      setHalDaftar({ hal, q, total: Number(j.total) || (j.daftar as SldTim[]).length, perHalaman: Number(j.perHalaman) || 20 });
    } finally { setSibuk(''); }
  }, []);

  const [riwayatVersi, setRiwayatVersi] = useState<{ versi: number; created_at: string; dibuat_oleh_nama: string }[] | null>(null);
  const muatRiwayat = useCallback(async (id: string) => {
    setRiwayatVersi(null);
    const j = await jsonDari(await fetch(`${API}?id=${encodeURIComponent(id)}&riwayat=1`, { credentials: 'include', cache: 'no-store' }).catch(() => null));
    setRiwayatVersi(j?.ok ? j.versi : []);
  }, []);
  const pulihkan = useCallback(async (id: string, versi: number): Promise<boolean> => {
    setSibuk('buka'); setPesan(null);
    try {
      const r = await fetch(`${API}?id=${encodeURIComponent(id)}&versi=${versi}`, { credentials: 'include', cache: 'no-store' }).catch(() => null);
      const j = await jsonDari(r);
      const d = j?.ok ? bersihkanDok(j.sld.data) : null;
      if (!r?.ok || !d) { setPesan({ t: j?.alasan ?? 'Versi tidak bisa dibuka.', galat: true }); return false; }
      a.muat(d);
      setAktif({ id, nama: j.sld.nama, versi: j.sld.versiTerbaru ?? j.sld.versi, bolehUbah: !!j.sld.bolehUbah, kunci: '' });
      setPesan({ t: `Isi v${versi} dimuat. Klik Simpan untuk menjadikannya versi terbaru (v${(j.sld.versiTerbaru ?? versi) + 1}); versi lain tetap tersimpan.` });
      return true;
    } finally { setSibuk(''); }
  }, [a, setAktif]);
  const buka = useCallback(async (id: string, versi?: number): Promise<boolean> => {
    setSibuk('buka'); setPesan(null);
    try {
      const r = await fetch(`${API}?id=${encodeURIComponent(id)}${versi ? `&versi=${versi}` : ''}`, { credentials: 'include', cache: 'no-store' }).catch(() => null);
      const j = await jsonDari(r);
      const d = j?.ok ? bersihkanDok(j.sld.data) : null;
      if (!r?.ok || !d) { setPesan({ t: j?.alasan ?? 'SLD tidak bisa dibuka.', galat: true }); return false; }
      a.muat(d);
      const lama = versi && versi !== j.sld.versiTerbaru;
      setAktif(lama ? null : { id, nama: j.sld.nama, versi: j.sld.versi, bolehUbah: !!j.sld.bolehUbah, kunci: kunciDok(d) });
      setPesan({ t: lama ? `Membuka ${j.sld.nama} v${versi} (versi lama) - simpan sebagai SLD baru bila ingin mengubahnya.` : `Dibuka: ${j.sld.nama} v${j.sld.versi}` });
      return true;
    } finally { setSibuk(''); }
  }, [a, setAktif]);

  const hapus = useCallback(async (s: SldTim) => {
    const r = await fetch(`${API}?id=${encodeURIComponent(s.id)}`, { method: 'DELETE', credentials: 'include' }).catch(() => null);
    const j = await jsonDari(r);
    if (!r?.ok || !j?.ok) { setPesan({ t: j?.alasan ?? 'Gagal menghapus.', galat: true }); return; }
    if (aktif?.id === s.id) setAktif(null);
    setPesan({ t: j.diarsipkan ? `"${s.nama}" masih ditautkan ke ${j.tautan} Request Design - diarsipkan, versinya tetap tersimpan.` : `"${s.nama}" dihapus.` });
    setDaftar(x => x?.filter(y => y.id !== s.id) ?? null);
  }, [aktif, setAktif]);

  const lepas = useCallback(() => setAktif(null), [setAktif]);

  const berubahRef = useRef(berubah); berubahRef.current = berubah;
  const bukaRef = useRef(buka); bukaRef.current = buka;
  const idAktif = aktif?.id, versiAktif = aktif?.versi;
  useEffect(() => {
    if (!a.siap || !idAktif || !versiAktif) return;
    let hidup = true;
    const cek = async () => {
      const r = await fetch(`${API}?id=${encodeURIComponent(idAktif)}&riwayat=1`, { credentials: 'include', cache: 'no-store' }).catch(() => null);
      const j = await jsonDari(r), v = (j?.versi as { versi: number; dibuat_oleh_nama: string }[] | undefined)?.[0];
      if (!hidup || !v) return;
      if (v.versi <= versiAktif) { setVersiServer(null); return; }
      if (!berubahRef.current) await bukaRef.current(idAktif);
      else setVersiServer({ versi: v.versi, oleh: v.dibuat_oleh_nama });
    };
    void cek();
    const fokus = () => { if (document.visibilityState === 'visible') void cek(); };
    document.addEventListener('visibilitychange', fokus);
    return () => { hidup = false; document.removeEventListener('visibilitychange', fokus); };
  }, [a.siap, idAktif, versiAktif]);

  return { aktif, berubah, sibuk, pesan, setPesan, daftar, halDaftar, riwayatVersi, muatRiwayat, pulihkan, simpan, simpanSebagai, tautkan, muatDaftar, buka, hapus, lepas, versiServer, tutupVersiServer: () => setVersiServer(null) };
}

export type KeadaanSimpanSLD = ReturnType<typeof useSimpanSLD>;
