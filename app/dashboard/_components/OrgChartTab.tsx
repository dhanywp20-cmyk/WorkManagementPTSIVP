'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { LoadingSpinner, EmptyState } from '@/components/shared';

/**
 * app/dashboard/_components/OrgChartTab.tsx — struktur atasan, akhirnya terlihat.
 *
 * Tiga tabel pemetaan (users.atasan_id, user_supervisor_mappings,
 * division_supervisor_mappings) dipakai delapan modul untuk menentukan routing,
 * approval, dan rekap KPI. Struktur itu menentukan banyak hal — tapi selama ini
 * hanya bisa dikelola lewat dropdown satu per satu, tanpa pernah ada satu layar
 * yang menampilkan bentuknya.
 *
 * Akibatnya tiga jenis kesalahan bisa hidup bertahun-tahun tanpa ketahuan:
 *   yatim     — orang tanpa atasan, tidak masuk rekap siapa pun
 *   timpang   — satu atasan membawahi puluhan orang sendirian
 *   lingkaran — A atasan B, B atasan A; penelusuran ke atas tak pernah selesai
 *
 * Ketiganya ditandai di sini.
 */

interface Orang {
  id: string;
  full_name: string;
  username: string;
  role: string;
  jabatan: string | null;
  team_type: string | null;
  sales_division: string | null;
  atasan_id: string | null;
}

/**
 * Telusuri rantai atasan sampai puncak, sambil mencatat siapa yang sudah
 * dilewati. Begitu bertemu id yang sama dua kali, berarti rantainya melingkar.
 *
 * Tanpa penjaga ini, penelusuran pada data yang melingkar akan berputar
 * selamanya dan membekukan halaman.
 */
function cariLingkaran(orang: Orang[]): Set<string> {
  const peta = new Map(orang.map(o => [o.id, o]));
  const melingkar = new Set<string>();

  for (const awal of orang) {
    const dilewati = new Set<string>();
    let kini: Orang | undefined = awal;
    while (kini?.atasan_id) {
      if (dilewati.has(kini.id)) { melingkar.add(awal.id); break; }
      dilewati.add(kini.id);
      kini = peta.get(kini.atasan_id);
      if (kini && dilewati.has(kini.id)) { melingkar.add(awal.id); break; }
    }
  }
  return melingkar;
}

/** Ambang "terlalu banyak bawahan" — di atas ini beban rekap patut ditinjau. */
const AMBANG_TIMPANG = 12;

export function OrgChartTab() {
  const [orang, setOrang]   = useState<Orang[]>([]);
  const [memuat, setMemuat] = useState(true);
  const [cari, setCari]     = useState('');
  const [hanyaMasalah, setHanyaMasalah] = useState(false);

  useEffect(() => {
    (async () => {
      // atasan_id diambil terpisah & tahan-error: kolomnya berasal dari
      // migrasi menyusul, dan halaman ini tidak boleh gagal total kalau
      // migrasi itu belum dijalankan di suatu environment.
      const [dasarRes, atasanRes] = await Promise.all([
        supabase.from('users')
          .select('id, full_name, username, role, jabatan, team_type, sales_division')
          .order('full_name'),
        supabase.from('users').select('id, atasan_id'),
      ]);
      const petaAtasan = new Map<string, string | null>(
        (atasanRes.data ?? []).map((r: { id: string; atasan_id: string | null }) => [r.id, r.atasan_id]),
      );
      setOrang(((dasarRes.data ?? []) as Omit<Orang, 'atasan_id'>[])
        .map(u => ({ ...u, atasan_id: petaAtasan.get(u.id) ?? null })));
      setMemuat(false);
    })();
  }, []);

  const { akar, anakDari, jumlahBawahan, melingkar, yatim } = useMemo(() => {
    const anakDari = new Map<string, Orang[]>();
    const melingkar = cariLingkaran(orang);
    const punyaBawahan = new Set(orang.map(o => o.atasan_id).filter(Boolean) as string[]);

    for (const o of orang) {
      if (!o.atasan_id || melingkar.has(o.id)) continue;
      const arr = anakDari.get(o.atasan_id) ?? [];
      arr.push(o);
      anakDari.set(o.atasan_id, arr);
    }

    // Akar = tidak punya atasan TAPI membawahi orang lain. Yang tidak punya
    // atasan dan tidak punya bawahan bukan puncak struktur — itu yatim.
    const akar  = orang.filter(o => !o.atasan_id && punyaBawahan.has(o.id) && !melingkar.has(o.id));
    const yatim = orang.filter(o => !o.atasan_id && !punyaBawahan.has(o.id));

    const jumlahBawahan = new Map<string, number>();
    for (const [id, arr] of anakDari) jumlahBawahan.set(id, arr.length);

    return { akar, anakDari, jumlahBawahan, melingkar, yatim };
  }, [orang]);

  const cocok = (o: Orang) => {
    const q = cari.trim().toLowerCase();
    if (!q) return true;
    return [o.full_name, o.username, o.jabatan, o.sales_division, o.team_type]
      .some(v => (v ?? '').toLowerCase().includes(q));
  };

  if (memuat) return <LoadingSpinner message="Membaca struktur atasan…" />;

  const adaMasalah = yatim.length > 0 || melingkar.size > 0;

  const Simpul = ({ o, level }: { o: Orang; level: number }) => {
    const anak = anakDari.get(o.id) ?? [];
    const n = jumlahBawahan.get(o.id) ?? 0;
    const timpang = n >= AMBANG_TIMPANG;
    const tampil = cocok(o) || anak.some(a => cocok(a));
    if (!tampil && cari.trim()) return null;

    return (
      <div style={{ marginLeft: level === 0 ? 0 : '1.25rem' }}>
        <div className="flex items-center gap-2 py-1.5"
          style={{ borderLeft: level === 0 ? 'none' : '1px solid #e2e8f0', paddingLeft: level === 0 ? 0 : '0.75rem' }}>
          <span className="w-1.5 h-1.5 rounded-full flex-shrink-0"
            style={{ background: n > 0 ? '#0f766e' : '#cbd5e1' }} />
          <span className="text-sm font-semibold text-slate-800">{o.full_name}</span>
          {o.jabatan && <span className="text-[10px] text-slate-400">{o.jabatan}</span>}
          {(o.sales_division || o.team_type) && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">
              {o.sales_division || o.team_type}
            </span>
          )}
          {n > 0 && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded tabular-nums"
              style={timpang
                ? { background: '#fef3c7', color: '#b45309' }
                : { background: '#f1f5f9', color: '#64748b' }}
              title={timpang ? `${n} bawahan langsung — beban rekap patut ditinjau` : `${n} bawahan langsung`}>
              {n} bawahan{timpang ? ' ⚠' : ''}
            </span>
          )}
        </div>
        {anak.map(a => <Simpul key={a.id} o={a} level={level + 1} />)}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-4">

      {/* Ringkasan keadaan — dibaca lebih dulu sebelum pohonnya */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          { label: 'Total akun',   nilai: orang.length,     warna: '#0f766e' },
          { label: 'Puncak',       nilai: akar.length,      warna: '#0369a1' },
          { label: 'Tanpa atasan', nilai: yatim.length,     warna: yatim.length ? '#b45309' : '#64748b' },
          { label: 'Melingkar',    nilai: melingkar.size,   warna: melingkar.size ? '#b91c1c' : '#64748b' },
        ].map(k => (
          <div key={k.label} className="rounded-xl px-3 py-2.5"
            style={{ background: '#fff', border: '1px solid #e2e8f0' }}>
            <p className="text-lg font-black tabular-nums leading-none" style={{ color: k.warna }}>{k.nilai}</p>
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mt-1">{k.label}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-2 flex-wrap items-center">
        <input
          value={cari} onChange={e => setCari(e.target.value)}
          placeholder="Cari nama, jabatan, atau divisi…"
          className="flex-1 min-w-[12rem] rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-teal-500/30"
          style={{ background: '#fff', border: '1px solid #e2e8f0' }} />
        {adaMasalah && (
          <button type="button" onClick={() => setHanyaMasalah(v => !v)}
            className="px-3 py-2 rounded-xl text-xs font-bold transition-colors"
            style={hanyaMasalah
              ? { background: '#fef3c7', color: '#b45309', border: '1px solid #fcd34d' }
              : { background: '#fff', color: '#64748b', border: '1px solid #e2e8f0' }}>
            {hanyaMasalah ? '← Tampilkan seluruh struktur' : `⚠ Lihat ${yatim.length + melingkar.size} yang bermasalah`}
          </button>
        )}
      </div>

      {melingkar.size > 0 && (
        <div className="rounded-xl p-3 text-xs"
          style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c' }}>
          <strong>{melingkar.size} akun berada dalam rantai atasan yang melingkar.</strong> Penelusuran
          ke atas untuk akun ini tidak pernah sampai puncak, sehingga rekap dan routing yang
          bersandar padanya akan meleset. Betulkan lewat User Management → Mapping Atasan.
          <p className="mt-1 font-semibold">
            {orang.filter(o => melingkar.has(o.id)).map(o => o.full_name).join(' · ')}
          </p>
        </div>
      )}

      {hanyaMasalah ? (
        yatim.length === 0 && melingkar.size === 0 ? (
          <EmptyState icon="✅" title="Tidak ada yang bermasalah"
            description="Semua akun punya atasan dan tidak ada rantai yang melingkar." />
        ) : (
          <div className="rounded-xl p-3" style={{ background: '#fff', border: '1px solid #e2e8f0' }}>
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-2">
              Tanpa atasan — tidak masuk rekap siapa pun
            </p>
            <div className="flex flex-col gap-1">
              {yatim.filter(cocok).map(o => (
                <div key={o.id} className="flex items-center gap-2 text-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
                  <span className="font-semibold text-slate-700">{o.full_name}</span>
                  <span className="text-[10px] text-slate-400">{o.jabatan || o.role}</span>
                  {(o.sales_division || o.team_type) && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">
                      {o.sales_division || o.team_type}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )
      ) : akar.length === 0 ? (
        <EmptyState icon="🌱" title="Struktur atasan belum terbentuk"
          description="Belum ada satu pun akun yang ditetapkan sebagai atasan. Atur lewat User Management → Mapping Atasan." />
      ) : (
        <div className="rounded-xl p-3 overflow-x-auto"
          style={{ background: '#fff', border: '1px solid #e2e8f0' }}>
          {akar.map(o => <Simpul key={o.id} o={o} level={0} />)}
        </div>
      )}
    </div>
  );
}
