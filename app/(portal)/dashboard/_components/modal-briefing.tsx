'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { BRIEFING_BAWAAN, KUNCI_BRIEFING, rapikanBriefing, type PengaturanBriefing } from '@/lib/briefing-pagi';
import { KUNCI_CRON_TERAKHIR, type JejakCron } from '@/lib/cron-catat';

/**
 * Admin Panel -> Integrations -> kartu "Briefing Pagi". Dua saklar untuk cron
 * /api/cron/digest (06:00 WIB, ke WA / Telegram / push): saklar utama, dan pengingat Daily
 * Report yang belum diisi. Kanal mana yang dipakai tetap diatur di bagian Integrations di bawahnya.
 */
function Saklar({ nilai, onUbah, label, ket, mati }: { nilai: boolean; onUbah: (v: boolean) => void; label: string; ket: string; mati?: boolean }) {
  return (
    <div className={`flex items-start justify-between gap-3 py-2.5 ${mati ? 'opacity-50' : ''}`}>
      <div className="min-w-0">
        <p className="text-[13px] font-semibold text-slate-800">{label}</p>
        <p className="text-[11.5px] text-slate-500 leading-snug">{ket}</p>
      </div>
      <button type="button" role="switch" aria-checked={nilai} aria-label={label} disabled={mati} onClick={() => onUbah(!nilai)}
        className={`relative shrink-0 w-11 h-6 rounded-full transition-colors ${nilai ? 'bg-emerald-600' : 'bg-slate-300'} disabled:cursor-not-allowed`}>
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${nilai ? 'translate-x-5' : ''}`} />
      </button>
    </div>
  );
}

export function BriefingPagiKartu() {
  const [p, setP] = useState<PengaturanBriefing>(BRIEFING_BAWAAN);
  const [siap, setSiap] = useState(false);
  const [pesan, setPesan] = useState<{ ok: boolean; teks: string } | null>(null);
  const [terakhir, setTerakhir] = useState<{ waktu: string; ok: boolean; ringkas: string } | null>(null);

  useEffect(() => {
    let hidup = true;
    (async () => {
      try {
        const { data } = await supabase.from('app_settings').select('key, value').in('key', [KUNCI_BRIEFING, KUNCI_CRON_TERAKHIR]);
        if (!hidup) return;
        for (const b of (data ?? []) as { key: string; value: unknown }[]) {
          if (b.key === KUNCI_BRIEFING) setP(rapikanBriefing(b.value));
          if (b.key === KUNCI_CRON_TERAKHIR) setTerakhir(((b.value ?? {}) as JejakCron).digest ?? null);
        }
      } catch { /* jatuh ke bawaan */ }
      if (hidup) setSiap(true);
    })();
    return () => { hidup = false; };
  }, []);

  const simpan = async (baru: PengaturanBriefing) => {
    const lama = p;
    setP(baru); setPesan(null);
    const { error } = await supabase.from('app_settings').upsert({ key: KUNCI_BRIEFING, value: baru }, { onConflict: 'key' });
    if (error) { setP(lama); setPesan({ ok: false, teks: `Gagal menyimpan: ${error.message}` }); return; }
    setPesan({ ok: true, teks: 'Tersimpan. Berlaku di briefing berikutnya (06:00 WIB).' });
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 mb-4">
      <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-600">Briefing Pagi (06:00 WIB)</h3>
      <p className="text-[12px] text-slate-500 mt-1">Ringkasan tenggat harian per orang lewat WhatsApp, Telegram, dan notifikasi aplikasi.</p>
      <div className="divide-y divide-slate-100 mt-1">
        <Saklar nilai={p.aktif} onUbah={v => void simpan({ ...p, aktif: v })} mati={!siap}
          label="Kirim Briefing Pagi" ket={p.aktif ? 'Menyala - dikirim tiap pagi.' : 'Mati - tidak ada briefing yang dikirim ke siapa pun.'} />
        <Saklar nilai={p.pengingatDailyReport} onUbah={v => void simpan({ ...p, pengingatDailyReport: v })} mati={!siap || !p.aktif}
          label="Pengingat Daily Report belum diisi"
          ket="Mengingatkan anggota Team PTS yang belum mengisi Daily Report hari kerja sebelumnya, dan memberi tahu atasannya." />
      </div>
      {pesan && <p className={`text-[12px] mt-2 ${pesan.ok ? 'text-emerald-700' : 'text-rose-700'}`}>{pesan.teks}</p>}
      <p className="text-[11.5px] text-slate-500 mt-2">
        Terakhir jalan: {terakhir ? `${new Date(terakhir.waktu).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} · ${terakhir.ringkas}` : 'belum tercatat'}
      </p>
    </section>
  );
}
