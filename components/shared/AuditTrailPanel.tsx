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

export interface AuditEntry {
  id: string;
  target_id: string;
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

/** Tanggal pendek tetap (bukan relatif) — dipakai alur mendatar, sebaris. */
function tanggalPendek(iso: string): string {
  return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
}

/**
 * Label satu langkah pada alur MENDATAR. Beda dari label aksi biasa: yang
 * ingin dilihat orang di sebuah alur status bukan "Status berubah" (generik),
 * tapi status APA yang dicapai — jadi status_change dilabeli new_value-nya.
 */
function labelLangkah(e: AuditEntry): string {
  if (e.action === 'status_change' && e.new_value) return e.new_value;
  return AKSI[e.action]?.label ?? e.action;
}

export function AuditTrailPanel({
  targetId, modul, judul = 'Riwayat Perubahan', batas = 20,
  selaluTerbuka = false, sembunyikanBilaKosong = true, awal = null, turunan = [],
  kompak = false, arah = 'vertikal', data,
}: {
  /**
   * Record yang riwayatnya ditampilkan. Panel diam bila kosong.
   *
   * Boleh berupa daftar id — dipakai saat satu layar perlu menggabungkan
   * riwayat beberapa record sekaligus (mis. satu proyek + seluruh lokasi +
   * seluruh komponennya) jadi satu garis waktu, bukan dipisah per record.
   * `batas` tetap berlaku atas GABUNGANNYA, jadi hasilnya "N perubahan
   * terbaru di proyek ini", bukan "N per lokasi".
   */
  targetId: string | string[] | null | undefined;
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
  /**
   * Peristiwa lain yang DITURUNKAN dari record, untuk record lama yang
   * terjadi sebelum logAudit mencatat peristiwa itu.
   *
   * Tiap entri hanya disisipkan bila audit_trail belum memuat aksi yang sama —
   * jadi begitu pencatatan sungguhan masuk, turunan ini menyingkir sendiri dan
   * tidak pernah menggandakan.
   */
  turunan?: { aksi: string; oleh: string | null; waktu: string | null; keterangan?: string }[];
  /**
   * Mode timeline mini — ditempel langsung di bawah SATU field (status lokasi,
   * atau satu baris komponen), bukan sebagai panel berdiri sendiri. Padding &
   * jarak antar baris dipadatkan supaya tidak mendominasi kartu saat dipasang
   * berulang (satu per komponen).
   */
  kompak?: boolean;
  /**
   * 'horizontal' menggambar alur MENDATAR ala "Alur Request" (lingkaran
   * bercentang tersambung garis, kiri = paling lama → kanan = terbaru),
   * dengan status/aksi sebagai label dan TANGGAL di bawahnya — bukan nama
   * orang, karena yang ingin diketahui di sini adalah kapan status berubah,
   * bukan siapa. Default 'vertikal' tetap dipakai untuk riwayat yang
   * memuat detail lengkap (nilai lama→baru, catatan, siapa).
   */
  arah?: 'vertikal' | 'horizontal';
  /**
   * Data siap-pakai — dipakai halaman yang TIDAK BOLEH menyentuh supabase
   * langsung (mis. ProjectDetailView, karena juga dirender di halaman share
   * publik tanpa session). Saat diisi, panel TIDAK PERNAH melakukan fetch
   * sendiri — hanya menyaring `data` (yang sudah diambil pemanggilnya, lewat
   * server route atau query lain) menurut `targetId`. Diasumsikan sudah
   * difilter modul-nya oleh pemanggil.
   */
  data?: AuditEntry[];
}) {
  const modeStatis = data !== undefined;
  const [entriFetch, setEntriFetch] = useState<AuditEntry[]>([]);
  const [memuatFetch, setMemuatFetch] = useState(!modeStatis);
  const [terbuka, setTerbuka] = useState(selaluTerbuka);

  /* Kunci string yang stabil untuk dependency effect. targetId sebagai array
     baru dibuat ulang tiap render oleh pemanggilnya (mis. `[proj.id, ...ids]`
     ditulis langsung di JSX) — memakai array itu sendiri sebagai dependency
     akan memicu fetch ulang tiap render, bukan tiap kali isinya benar-benar
     berubah. String gabungan ini nilainya sama selama daftarnya sama. */
  const idsKey = Array.isArray(targetId)
    ? targetId.filter(Boolean).join(' ')
    : (targetId ?? '');

  useEffect(() => {
    if (modeStatis) return; // data sudah tersedia — tidak pernah fetch dari supabase.
    const ids = idsKey ? idsKey.split(' ') : [];
    if (ids.length === 0) { setEntriFetch([]); setMemuatFetch(false); return; }
    let batal = false;
    (async () => {
      setMemuatFetch(true);
      let q = supabase
        .from('audit_trail')
        .select('id, target_id, user_name, action, target_name, old_value, new_value, notes, created_at')
        .order('created_at', { ascending: false })
        .limit(batas);
      q = ids.length === 1 ? q.eq('target_id', ids[0]) : q.in('target_id', ids);
      if (modul) q = q.eq('module', modul);
      const { data: hasil } = await q;
      if (!batal) { setEntriFetch((hasil ?? []) as AuditEntry[]); setMemuatFetch(false); }
    })();
    return () => { batal = true; };
  }, [modeStatis, idsKey, modul, batas]);

  if (!targetId || (Array.isArray(targetId) && targetId.length === 0)) return null;

  const ids = idsKey ? idsKey.split(' ') : [];
  const entri = modeStatis
    ? (data ?? [])
        .filter(e => ids.includes(e.target_id))
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .slice(0, batas)
    : entriFetch;
  const memuat = modeStatis ? false : memuatFetch;

  /**
   * Gabungan yang benar-benar ditampilkan. Baris awal hanya disisipkan bila
   * audit_trail belum memuat 'create' sendiri — kalau tidak, record baru akan
   * menampilkan dua baris pembuatan yang sama.
   */
  const aksiTercatat = new Set(entri.map(e => e.action));

  const tambahan: AuditEntry[] = [];
  for (const t of turunan) {
    if (!t.waktu || aksiTercatat.has(t.aksi)) continue;
    tambahan.push({
      id: `__turunan_${t.aksi}__`, target_id: ids[0] ?? '', user_name: t.oleh, action: t.aksi,
      target_name: null, old_value: null, new_value: null,
      notes: t.keterangan ?? null, created_at: t.waktu,
    });
  }
  if (awal?.waktu && !aksiTercatat.has('create')) {
    tambahan.push({
      id: '__awal__', target_id: ids[0] ?? '', user_name: awal.oleh, action: 'create',
      target_name: null, old_value: null, new_value: null,
      notes: awal.keterangan ?? null, created_at: awal.waktu,
    });
  }

  // Terbaru di atas — sama seperti urutan dari basis data.
  const semua: AuditEntry[] = [...entri, ...tambahan]
    .sort((a, b) => b.created_at.localeCompare(a.created_at));

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

      {terbuka && arah === 'horizontal' && (
        memuat ? (
          <p className="text-[10px] text-slate-400 py-1">Memuat riwayat…</p>
        ) : (
          <div className="flex items-start overflow-x-auto pb-0.5" style={{ scrollbarWidth: 'thin' }}>
            {/* Paling lama di kiri, terbaru di kanan — arah alur, bukan urutan basis data. */}
            {[...semua].reverse().map((e, i, arr) => {
              const cfg = AKSI[e.action] ?? { label: e.action, warna: '#94a3b8' };
              return (
                <div key={e.id} className="flex items-start flex-shrink-0">
                  {i > 0 && (
                    <span className="h-px flex-shrink-0 mt-[7px]" style={{ width: 20, background: 'rgba(100,116,139,0.25)' }} />
                  )}
                  <div className="flex flex-col items-center gap-0.5" style={{ width: 62 }}>
                    <span className="w-3.5 h-3.5 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{ background: cfg.warna }}>
                      <span className="text-white leading-none" style={{ fontSize: 8 }}>✓</span>
                    </span>
                    <span className="text-[9px] font-bold text-center leading-tight break-words" style={{ color: cfg.warna }}>
                      {labelLangkah(e)}
                    </span>
                    <span className="text-[8px] text-slate-400 text-center leading-tight"
                      title={new Date(e.created_at).toLocaleString('id-ID')}>
                      {tanggalPendek(e.created_at)}
                    </span>
                  </div>
                  {i === arr.length - 1 && <span style={{ width: 1 }} />}
                </div>
              );
            })}
          </div>
        )
      )}

      {terbuka && arah !== 'horizontal' && (
        <div className={
          kompak ? "flex flex-col gap-0"
            : selaluTerbuka ? "px-4 py-3 flex flex-col gap-0" : "px-4 pb-3 flex flex-col gap-0"
        }>
          {memuat ? (
            <p className="text-[10px] text-slate-400 py-1">Memuat riwayat…</p>
          ) : semua.map((e, i) => {
            const cfg = AKSI[e.action] ?? { label: e.action, warna: '#94a3b8' };
            const adaPerubahanNilai = e.old_value || e.new_value;
            return (
              <div key={e.id} className={kompak ? "flex gap-2 py-1" : "flex gap-3 py-2"}
                style={{ borderTop: i === 0 ? 'none' : '1px solid rgba(100,116,139,0.12)' }}>
                {/* Garis waktu: titik + batang penghubung */}
                <div className="flex flex-col items-center pt-1 flex-shrink-0">
                  <span className={kompak ? "w-1.5 h-1.5 rounded-full" : "w-2 h-2 rounded-full"} style={{ background: cfg.warna }} />
                  {i < semua.length - 1 && (
                    <span className="w-px flex-1 mt-1" style={{ background: 'rgba(100,116,139,0.2)' }} />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className={kompak ? "text-[10px]" : "text-xs"}>
                    <span className="font-bold" style={{ color: cfg.warna }}>{cfg.label}</span>
                    <span className="text-slate-500"> oleh </span>
                    <span className="font-semibold text-slate-700">{e.user_name || 'sistem'}</span>
                  </p>

                  {adaPerubahanNilai && (
                    <p className={kompak ? "text-[9px] text-slate-500 mt-0.5 break-words" : "text-[11px] text-slate-500 mt-0.5 break-words"}>
                      {e.old_value && <span className="line-through opacity-60">{e.old_value}</span>}
                      {e.old_value && e.new_value && <span className="mx-1 text-slate-300">→</span>}
                      {e.new_value && <span className="font-medium text-slate-700">{e.new_value}</span>}
                    </p>
                  )}

                  {e.notes && !kompak && (
                    <p className="text-[11px] text-slate-400 mt-0.5 break-words">{e.notes}</p>
                  )}

                  <p className={kompak ? "text-[9px] text-slate-400 mt-0.5" : "text-[10px] text-slate-400 mt-0.5"}
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
