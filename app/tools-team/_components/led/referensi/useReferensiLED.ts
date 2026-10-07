/** Referensi produk LED (modul, sending card, video processor, brand): bawaan, simpanan perangkat & tim. */
import { BRAND_LED, MODUL_LED, SENDING_CARD, VIDEO_PROCESSOR } from '@/lib/av-hitung';
import { bersihkanReferensiLED, type RefLED } from '@/lib/tools-team';
import { useEffect, useState } from 'react';

const KUNCI = 'wm_led_referensi';

const BAWAAN: RefLED = { modul: MODUL_LED, kartu: SENDING_CARD, vp: VIDEO_PROCESSOR, brand: BRAND_LED };

export function useReferensiLED() {
  const [lokal, setLokal] = useState<RefLED | null>(null);
  const [tim, setTim] = useState<RefLED | null>(null);
  const [infoTim, setInfoTim] = useState<{ oleh: string | null; pada: string | null }>({ oleh: null, pada: null });
  const [bolehSimpanTim, setBolehSimpanTim] = useState(false);
  const [sibuk, setSibuk] = useState(false);
  const [pesan, setPesan] = useState('');

  useEffect(() => {
    try { const s = localStorage.getItem(KUNCI); if (s) { const j = bersihkanReferensiLED(JSON.parse(s)); if (j) setLokal(j); } } catch { /* abaikan */ }
    let hidup = true;
    fetch('/api/tools-team/referensi-led', { credentials: 'include', cache: 'no-store' })
      .then(r => (r.ok ? r.json() : null))
      .then(j => {
        if (!hidup || !j?.ok) return;
        setTim(j.referensi ?? null); setBolehSimpanTim(!!j.bolehUbah); setInfoTim({ oleh: j.oleh ?? null, pada: j.diubahPada ?? null });
      })
      .catch(() => { /* luring: lapis lokal / bawaan tetap jalan */ });
    return () => { hidup = false; };
  }, []);

  const data = lokal ?? tim ?? BAWAAN;
  const sumber: 'lokal' | 'tim' | 'bawaan' = lokal ? 'lokal' : tim ? 'tim' : 'bawaan';
  const tulisLokal = (r: RefLED | null) => {
    setLokal(r);
    try { if (r) localStorage.setItem(KUNCI, JSON.stringify(r)); else localStorage.removeItem(KUNCI); } catch { /* abaikan */ }
  };
  const ubah = (r: RefLED) => { tulisLokal(r); setPesan(''); };
  /** Buang draf lokal - kembali ke referensi tim (atau bawaan bila belum ada). */
  const reset = () => { tulisLokal(null); setPesan(''); };

  const panggil = async (metode: 'PUT' | 'DELETE', body?: unknown) => {
    setSibuk(true); setPesan('');
    try {
      const r = await fetch('/api/tools-team/referensi-led', {
        method: metode, credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined,
      });
      const j = await r.json().catch(() => null);
      if (!r.ok || !j?.ok) { setPesan(j?.alasan ?? 'Gagal menyimpan ke server.'); return false; }
      return true;
    } catch { setPesan('Tidak terhubung ke server.'); return false; } finally { setSibuk(false); }
  };
  const simpanUntukTim = async () => {
    if (!lokal) return;
    if (await panggil('PUT', { referensi: lokal })) {
      setTim(lokal); tulisLokal(null); setInfoTim({ oleh: 'Anda', pada: new Date().toISOString() }); setPesan('Tersimpan untuk seluruh tim.');
    }
  };
  const resetTim = async () => {
    if (await panggil('DELETE')) { setTim(null); tulisLokal(null); setInfoTim({ oleh: null, pada: null }); setPesan('Referensi tim dikembalikan ke tabel bawaan.'); }
  };

  return {
    data, ubah, reset, sumber, infoTim, bolehSimpanTim, simpanUntukTim, resetTim, sibuk, pesan,
    diubah: JSON.stringify(data) !== JSON.stringify(BAWAAN),
  };
}
