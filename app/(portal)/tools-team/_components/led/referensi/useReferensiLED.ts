import { BRAND_LED, MODUL_LED, SENDING_CARD, VIDEO_PROCESSOR } from '@/lib/av/hitung';
import { bersihkanReferensiLED, type RefLED } from '@/lib/tools-team';
import { useEffect, useState } from 'react';

const KUNCI = 'wm_led_referensi';

const BAWAAN: RefLED = { modul: MODUL_LED, kartu: SENDING_CARD, vp: VIDEO_PROCESSOR, brand: BRAND_LED };
const VP_SUSULAN = VIDEO_PROCESSOR.filter(h => /^H[259] \(H_/.test(h.nama));
const VP_USANG = new Set(['h2', 'h5', 'h9']);

const lengkapi = (r: RefLED | null): RefLED | null => {
  if (!r) return r;
  const vp = r.vp.filter(h => !VP_USANG.has(h.nama.trim().toLowerCase()));
  const ada = new Set(vp.map(h => h.nama.trim().toLowerCase()));
  const kurang = VP_SUSULAN.filter(h => !ada.has(h.nama.toLowerCase()));
  if (!kurang.length && vp.length === r.vp.length) return r;
  return { ...r, vp: [...vp, ...kurang].slice(0, 200) };
};

export function useReferensiLED() {
  const [lokal, setLokal] = useState<RefLED | null>(null);
  const [tim, setTim] = useState<RefLED | null>(null);
  const [infoTim, setInfoTim] = useState<{ oleh: string | null; pada: string | null }>({ oleh: null, pada: null });
  const [bolehSimpanTim, setBolehSimpanTim] = useState(false);
  const [sibuk, setSibuk] = useState(false);
  const [pesan, setPesan] = useState('');

  useEffect(() => {
    try { const s = localStorage.getItem(KUNCI); if (s) { const j = bersihkanReferensiLED(JSON.parse(s)); if (j) setLokal(j); } } catch {  }
    let hidup = true;
    fetch('/api/tools-team/referensi-led', { credentials: 'include', cache: 'no-store' })
      .then(r => (r.ok ? r.json() : null))
      .then(j => {
        if (!hidup || !j?.ok) return;
        setTim(j.referensi ?? null); setBolehSimpanTim(!!j.bolehUbah); setInfoTim({ oleh: j.oleh ?? null, pada: j.diubahPada ?? null });
      })
      .catch(() => {  });
    return () => { hidup = false; };
  }, []);

  const data = lengkapi(lokal) ?? lengkapi(tim) ?? BAWAAN;
  const sumber: 'lokal' | 'tim' | 'bawaan' = lokal ? 'lokal' : tim ? 'tim' : 'bawaan';
  const tulisLokal = (r: RefLED | null) => {
    setLokal(r);
    try { if (r) localStorage.setItem(KUNCI, JSON.stringify(r)); else localStorage.removeItem(KUNCI); } catch {  }
  };
  const ubah = (r: RefLED) => { tulisLokal(r); setPesan(''); };
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
