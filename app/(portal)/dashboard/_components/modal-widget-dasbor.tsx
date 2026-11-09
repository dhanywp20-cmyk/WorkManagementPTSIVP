'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { DAFTAR_WIDGET, DASBOR_BAWAAN, EVENT_DASBOR_WIDGET, KUNCI_DASBOR_WIDGET, type KunciWidget, type PengaturanDasbor } from '@/lib/dasbor-widget';
import { muatDasborWidget } from './beranda/useDasborWidget';

function Saklar({ nilai, onUbah, label, ket, mati }: { nilai: boolean; onUbah: (v: boolean) => void; label: string; ket: string; mati?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2.5">
      <div className="min-w-0">
        <p className={`text-[13px] font-semibold ${nilai ? 'text-slate-800' : 'text-slate-500'}`}>{label}</p>
        <p className="text-[11.5px] text-slate-500 leading-snug">{ket}</p>
      </div>
      <button type="button" role="switch" aria-checked={nilai} aria-label={label} disabled={mati} onClick={() => onUbah(!nilai)}
        className={`relative shrink-0 w-11 h-6 rounded-full transition-colors ${nilai ? 'bg-emerald-600' : 'bg-slate-300'} disabled:opacity-50 disabled:cursor-not-allowed`}>
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${nilai ? 'translate-x-5' : ''}`} />
      </button>
    </div>
  );
}

const BAGIAN = ['Atas', 'Samping', 'Bawah'] as const;
const JUDUL_BAGIAN: Record<(typeof BAGIAN)[number], string> = { Atas: 'Baris atas', Samping: 'Panel kanan', Bawah: 'Kartu bawah' };

export function WidgetDasborInline() {
  const [p, setP] = useState<PengaturanDasbor>(DASBOR_BAWAAN);
  const [siap, setSiap] = useState(false);
  const [pesan, setPesan] = useState<{ ok: boolean; teks: string } | null>(null);

  useEffect(() => {
    let hidup = true;
    muatDasborWidget(true).then(v => { if (hidup) { setP(v); setSiap(true); } });
    return () => { hidup = false; };
  }, []);

  const simpan = async (baru: PengaturanDasbor) => {
    const lama = p;
    setP(baru); setPesan(null);
    const { error } = await supabase.from('app_settings').upsert({ key: KUNCI_DASBOR_WIDGET, value: baru }, { onConflict: 'key' });
    if (error) { setP(lama); setPesan({ ok: false, teks: `Gagal menyimpan: ${error.message}` }); return; }
    window.dispatchEvent(new CustomEvent(EVENT_DASBOR_WIDGET, { detail: baru }));
    void muatDasborWidget(true);
    setPesan({ ok: true, teks: 'Tersimpan. Berlaku untuk semua pengguna saat dashboard dibuka.' });
  };

  const ubah = (k: KunciWidget, tampil: boolean) =>
    void simpan({ ...p, sembunyi: tampil ? p.sembunyi.filter(x => x !== k) : [...p.sembunyi, k] });
  const jumlahTampil = DAFTAR_WIDGET.length - p.sembunyi.length;

  return (
    <div className="max-w-3xl space-y-4 p-4">
      <p className="text-[12.5px] text-slate-600">
        Pilih kartu yang tampil di Dashboard Analytics. Kartu yang tersisa otomatis melebar mengisi ruang kosong.
        Kartu tetap mengikuti hak akses: pengguna hanya melihat kartu yang memang boleh ia lihat.
      </p>
      {BAGIAN.map(b => (
        <section key={b} className="rounded-2xl border border-slate-200 bg-white px-4 py-2">
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-600 pt-2">{JUDUL_BAGIAN[b]}</h3>
          <div className="divide-y divide-slate-100">
            {DAFTAR_WIDGET.filter(w => w.bagian === b).map(w => (
              <Saklar key={w.kunci} nilai={!p.sembunyi.includes(w.kunci)} onUbah={v => ubah(w.kunci, v)} label={w.label} ket={w.ket} mati={!siap} />
            ))}
          </div>
        </section>
      ))}
      <section className="rounded-2xl border border-slate-200 bg-white px-4 py-2">
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-600 pt-2">Tampilan</h3>
        <Saklar nilai={p.latarRedup} onUbah={v => void simpan({ ...p, latarRedup: v })} mati={!siap}
          label="Redupkan latar di belakang kartu"
          ket="Gambar latar (Dashboard Setting) dibuat samar di area dashboard supaya kartu lebih mudah dibaca." />
      </section>
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-[12px] text-slate-500">{jumlahTampil} dari {DAFTAR_WIDGET.length} kartu tampil</span>
        <button type="button" disabled={!siap || (!p.sembunyi.length && p.latarRedup)} onClick={() => void simpan(DASBOR_BAWAAN)}
          className="px-3 py-1.5 rounded-lg text-[12px] font-bold border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-50">
          Kembalikan bawaan
        </button>
        {pesan && <span className={`text-[12px] ${pesan.ok ? 'text-emerald-700' : 'text-rose-700'}`}>{pesan.teks}</span>}
      </div>
    </div>
  );
}
