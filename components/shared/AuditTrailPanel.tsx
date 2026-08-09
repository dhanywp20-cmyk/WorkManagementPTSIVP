'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

/**
 * components/shared/AuditTrailPanel.tsx — riwayat perubahan sebuah record.
 *
 * logAudit() dipanggil dari 14 berkas di seluruh platform, tapi sampai
 * komponen ini ada hanya SATU layar yang pernah membacanya kembali
 * (analytics-dashboard). Praktisnya audit trail berstatus tulis-saja: setiap
 * perubahan tercatat rapi, dan ketika muncul pertanyaan "siapa yang mengubah
 * ini?" jawabannya ada di basis data tapi tidak terjangkau dari layar mana pun
 * yang relevan.
 *
 * Panel ini menutup jarak itu: pasang di modal detail, sebutkan target_id-nya,
 * dan riwayatnya muncul di tempat pertanyaannya lahir.
 */

interface AuditEntry {
  id: string;
  user_name: string | null;
  action: string;
  target_name: string | null;
  old_value: string | null;
  new_value: string | null;
  notes: string | null;
  created_at: string;
}

/** Label & warna per aksi. Warna dipakai pada titik penanda, bukan latar penuh. */
const AKSI: Record<string, { label: string; warna: string }> = {
  create:        { label: 'Dibuat',           warna: '#10b981' },
  update:        { label: 'Diubah',           warna: '#0ea5e9' },
  delete:        { label: 'Dihapus',          warna: '#ef4444' },
  approve:       { label: 'Disetujui',        warna: '#10b981' },
  reject:        { label: 'Ditolak',          warna: '#ef4444' },
  assign:        { label: 'Di-assign',        warna: '#8b5cf6' },
  status_change: { label: 'Status berubah',   warna: '#f59e0b' },
  export:        { label: 'Diekspor',         warna: '#64748b' },
  view:          { label: 'Dilihat',          warna: '#94a3b8' },
  upload:        { label: 'File diunggah',    warna: '#0ea5e9' },
  download:      { label: 'File diunduh',     warna: '#64748b' },
};

function waktuRelatif(iso: string): string {
  const detik = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (detik < 60)     return 'baru saja';
  if (detik < 3600)   return `${Math.floor(detik / 60)} menit lalu`;
  if (detik < 86400)  return `${Math.floor(detik / 3600)} jam lalu`;
  if (detik < 604800) return `${Math.floor(detik / 86400)} hari lalu`;
  return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function AuditTrailPanel({
  targetId, modul, judul = 'Riwayat Perubahan', batas = 20,
  selaluTerbuka = false, sembunyikanBilaKosong = true, awal = null,
}: {
  /** Record yang riwayatnya ditampilkan. Panel diam bila kosong. */
  targetId: string | null | undefined;
  /** Mempersempit ke satu modul — berguna bila id dipakai lintas tabel. */
  modul?: string;
  judul?: string;
  batas?: number;
  /**
   * Dipakai saat panel berdiri sendiri di samping detail: tidak perlu diklik
   * dulu, dan kepalanya tidak jadi tombol.
   */
  selaluTerbuka?: boolean;
  /**
   * Di dalam modal detail, panel kosong hanya menambah kebisingan — jadi
   * disembunyikan. Tapi sebagai panel samping ia SUDAH dibuka sengaja oleh
   * user, sehingga menghilang begitu saja justru membingungkan: lebih baik
   * mengatakan "belum ada riwayat".
   */
  sembunyikanBilaKosong?: boolean;
  /**
   * Baris pembuatan yang DITURUNKAN dari record itu sendiri, bukan dari
   * audit_trail.
   *
   * logAudit baru mencatat pembuatan sejak perbaikan terakhir, sehingga record
   * lama tidak punya baris "dibuat" dan riwayatnya seolah dimulai dari tengah.
   * Padahal datanya sudah tersimpan sejak awal di kolom created_at &
   * created_by/sales_name — tinggal ditampilkan.
   *
   * Ditempatkan paling bawah (paling tua) dan tidak digandakan bila
   * audit_trail ternyata sudah memuat baris create-nya sendiri.
   */
  awal?: { oleh: string | null; waktu: string | null; keterangan?: string } | null;
}) {
  const [entri, setEntri] = useState<AuditEntry[]>([]);
  const [memuat, setMemuat] = useState(true);
  const [terbuka, setTerbuka] = useState(selaluTerbuka);

  useEffect(() => {
    if (!targetId) { setEntri([]); setMemuat(false); return; }
    let batal = false;
    (async () => {
      setMemuat(true);
      let q = supabase
        .from('audit_trail')
        .select('id, user_name, action, target_name, old_value, new_value, notes, created_at')
        .eq('target_id', targetId)
        .order('created_at', { ascending: false })
        .limit(batas);
      if (modul) q = q.eq('module', modul);
      const { data } = await q;
      if (!batal) { setEntri((data ?? []) as AuditEntry[]); setMemuat(false); }
    })();
    return () => { batal = true; };
  }, [targetId, modul, batas]);

  if (!targetId) return null;

  /**
   * Gabungan yang benar-benar ditampilkan. Baris awal hanya disisipkan bila
   * audit_trail belum memuat 'create' sendiri — kalau tidak, record baru akan
   * menampilkan dua baris pembuatan yang sama.
   */
  const sudahAdaCreate = entri.some(e => e.action === 'create');
  const semua: AuditEntry[] = (!awal?.waktu || sudahAdaCreate)
    ? entri
    : [...entri, {
        id: '__awal__',
        user_name: awal.oleh,
        action: 'create',
        target_name: null,
        old_value: null,
        new_value: null,
        notes: awal.keterangan ?? null,
        created_at: awal.waktu,
      }];

  if (!memuat && semua.length === 0 && sembunyikanBilaKosong) return null;

  if (!memuat && semua.length === 0) {
    return (
      <div className="px-4 py-10 text-center">
        <p className="text-3xl mb-2">🕘</p>
        <p className="text-xs font-semibold text-slate-500">Belum ada riwayat</p>
        <p className="text-[11px] text-slate-400 mt-1">
          Perubahan pada data ini akan tercatat di sini.
        </p>
      </div>
    );
  }

  return (
    <div className={selaluTerbuka ? '' : 'rounded-xl overflow-hidden'}
      style={selaluTerbuka ? undefined
        : { background: 'rgba(100,116,139,0.05)', border: '1px solid rgba(100,116,139,0.18)' }}>

      {!selaluTerbuka && (
        <button
          type="button"
          onClick={() => setTerbuka(o => !o)}
          aria-expanded={terbuka}
          className="w-full flex items-center gap-2 px-4 py-3 text-left transition-colors hover:bg-black/[0.03]">
          <span className="text-sm">🕘</span>
          <span className="text-xs font-bold uppercase tracking-wide text-slate-600 flex-1">{judul}</span>
          <span className="text-[10px] font-bold text-slate-400 tabular-nums">
            {memuat ? '…' : semua.length}
          </span>
          <span className="text-slate-400 text-xs transition-transform"
            style={{ transform: terbuka ? 'rotate(90deg)' : 'none' }}>▶</span>
        </button>
      )}

      {terbuka && (
        <div className={selaluTerbuka ? "px-4 py-3 flex flex-col gap-0" : "px-4 pb-3 flex flex-col gap-0"}>
          {memuat ? (
            <p className="text-xs text-slate-400 py-2">Memuat riwayat…</p>
          ) : semua.map((e, i) => {
            const cfg = AKSI[e.action] ?? { label: e.action, warna: '#94a3b8' };
            const adaPerubahanNilai = e.old_value || e.new_value;
            return (
              <div key={e.id} className="flex gap-3 py-2"
                style={{ borderTop: i === 0 ? 'none' : '1px solid rgba(100,116,139,0.12)' }}>
                {/* Garis waktu: titik + batang penghubung */}
                <div className="flex flex-col items-center pt-1 flex-shrink-0">
                  <span className="w-2 h-2 rounded-full" style={{ background: cfg.warna }} />
                  {i < semua.length - 1 && (
                    <span className="w-px flex-1 mt-1" style={{ background: 'rgba(100,116,139,0.2)' }} />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-xs">
                    <span className="font-bold" style={{ color: cfg.warna }}>{cfg.label}</span>
                    <span className="text-slate-500"> oleh </span>
                    <span className="font-semibold text-slate-700">{e.user_name || 'sistem'}</span>
                  </p>

                  {adaPerubahanNilai && (
                    <p className="text-[11px] text-slate-500 mt-0.5 break-words">
                      {e.old_value && <span className="line-through opacity-60">{e.old_value}</span>}
                      {e.old_value && e.new_value && <span className="mx-1 text-slate-300">→</span>}
                      {e.new_value && <span className="font-medium text-slate-700">{e.new_value}</span>}
                    </p>
                  )}

                  {e.notes && (
                    <p className="text-[11px] text-slate-400 mt-0.5 break-words">{e.notes}</p>
                  )}

                  <p className="text-[10px] text-slate-400 mt-0.5"
                    title={new Date(e.created_at).toLocaleString('id-ID')}>
                    {waktuRelatif(e.created_at)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
