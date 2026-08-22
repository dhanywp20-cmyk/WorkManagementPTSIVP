'use client';
import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import {
  Kelompok, LingkupManager, kelompokPTS, muatKelompok, lingkupManager,
  simpanLingkupManager,
} from '@/lib/kelompok';

interface Akun { id: string; full_name: string; jabatan: string | null; team_type: string | null; access_level: string | null }

/**
 * Bagian "Lingkup Manager" pada User Management.
 *
 * Menjawab satu pertanyaan yang sebelumnya tidak punya tempat sama sekali:
 * seorang Manager PTS membawahi kelompok yang mana.
 *
 * Sebelum ini, akun dengan Full Access melihat SELURUH pekerjaan PTS. Untuk
 * Manager yang memang membawahi semuanya itu benar; untuk yang hanya
 * memegang sebagian, pekerjaan kelompok lain ikut terbaca tanpa ada cara
 * membatasinya selain mencabut Full Access-nya sekalian.
 *
 * Tidak dipetakan = tanpa batas, sama seperti sekarang. Ini disengaja:
 * memberi arti "tidak melihat apa-apa" pada ketiadaan pemetaan akan mengunci
 * semua Manager keluar pada detik fitur ini menyala.
 */
export function LingkupManagerInline() {
  const [akun, setAkun] = useState<Akun[]>([]);
  const [group, setGroup] = useState<Kelompok[]>([]);
  const [peta, setPeta] = useState<LingkupManager>({});
  const [menyimpan, setMenyimpan] = useState(false);
  const [kabar, setKabar] = useState<{ jenis: 'ok' | 'gagal'; teks: string } | null>(null);
  const [siap, setSiap] = useState(false);

  const beritahu = (jenis: 'ok' | 'gagal', teks: string) => {
    setKabar({ jenis, teks });
    setTimeout(() => setKabar(null), 5000);
  };

  useEffect(() => {
    (async () => {
      await muatKelompok();
      setGroup(kelompokPTS());
      setPeta({ ...lingkupManager() });
      const { data } = await supabase.from('users')
        .select('id, full_name, jabatan, team_type, access_level')
        .eq('role', 'team').order('full_name');
      setAkun((data ?? []) as Akun[]);
      setSiap(true);
    })();
  }, []);

  /**
   * Yang ditampilkan hanya akun yang PUNYA jangkauan lintas kelompok:
   * Full Access, atau berjabatan Manager ke atas. Untuk Staff dan Supervisor,
   * pembatasan kelompok tidak berarti apa-apa - mereka memang sudah terikat
   * kelompoknya sendiri, dan menampilkannya di sini hanya bikin daftar panjang
   * yang tidak satu barisnya pun perlu diisi.
   */
  const ATASAN = ['Manager', 'Deputy General Manager', 'General Manager', 'Direktur'];
  const kandidat = akun.filter(u =>
    (u.access_level ?? '') === 'full' || ATASAN.includes(u.jabatan ?? ''));

  const geser = (userId: string, nama: string) => setPeta(p => {
    const kini = p[userId] ?? [];
    return { ...p, [userId]: kini.includes(nama) ? kini.filter(x => x !== nama) : [...kini, nama] };
  });

  const simpan = async () => {
    setMenyimpan(true);
    const { error } = await simpanLingkupManager(peta);
    setMenyimpan(false);
    if (error) beritahu('gagal', 'Gagal menyimpan: ' + error);
    else beritahu('ok', 'Lingkup tersimpan.');
  };

  if (!siap) return <div className="p-4 text-sm text-slate-400">Memuat…</div>;

  return (
    <div className="rounded-2xl border border-slate-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
        <h3 className="font-bold text-slate-800 text-sm">Lingkup Manager</h3>
        <p className="text-slate-500 text-xs mt-0.5">
          Kelompok PTS mana saja yang dibawahi tiap Manager. Tidak dicentang sama sekali = membawahi semuanya.
        </p>
      </div>

      <div className="p-4 space-y-3">
        {kabar && (
          <div className="rounded-xl px-3.5 py-2.5 text-xs font-semibold"
            style={kabar.jenis === 'ok'
              ? { background: 'rgba(16,185,129,0.1)', color: '#047857', border: '1px solid rgba(16,185,129,0.35)' }
              : { background: 'rgba(239,68,68,0.1)', color: '#b91c1c', border: '1px solid rgba(239,68,68,0.35)' }}>
            {kabar.teks}
          </div>
        )}

        {kandidat.length === 0 ? (
          <p className="text-sm text-slate-400 py-4">
            Belum ada akun Manager atau ber-Full Access. Lingkup hanya berlaku untuk akun yang jangkauannya
            memang lintas kelompok.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] font-bold tracking-widest uppercase text-slate-400 border-b border-slate-100">
                  <th className="text-left px-3 py-2.5">Akun</th>
                  {group.map(g => <th key={g.nama} className="text-center px-3 py-2.5 whitespace-nowrap">{g.label}</th>)}
                  <th className="text-left px-3 py-2.5">Berlaku</th>
                </tr>
              </thead>
              <tbody>
                {kandidat.map(u => {
                  const dipilih = peta[u.id] ?? [];
                  const semua = dipilih.length === 0;
                  return (
                    <tr key={u.id} className="border-b border-slate-50 last:border-0">
                      <td className="px-3 py-2.5">
                        <p className="font-bold text-slate-800">{u.full_name}</p>
                        <p className="text-[11px] text-slate-400">
                          {u.jabatan ?? '—'}
                          {(u.access_level ?? '') === 'full' && <span className="ml-1.5 font-bold text-emerald-600">Full Access</span>}
                        </p>
                      </td>
                      {group.map(g => (
                        <td key={g.nama} className="px-3 py-2.5 text-center">
                          <button type="button" role="checkbox" aria-checked={dipilih.includes(g.nama)}
                            aria-label={`${u.full_name} membawahi ${g.label}`}
                            onClick={() => geser(u.id, g.nama)}
                            className="w-5 h-5 rounded-md border transition-all inline-flex items-center justify-center"
                            style={dipilih.includes(g.nama)
                              ? { background: '#0f766e', borderColor: '#0f766e', color: '#fff' }
                              : { background: '#fff', borderColor: '#cbd5e1', color: 'transparent' }}>
                            <svg aria-hidden="true" className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          </button>
                        </td>
                      ))}
                      <td className="px-3 py-2.5">
                        <span className="text-[11px] font-semibold" style={{ color: semua ? '#94a3b8' : '#0f766e' }}>
                          {semua ? 'Semua kelompok' : dipilih.length + ' kelompok'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex items-center justify-end gap-2">
          <p className="text-[11px] text-slate-400 mr-auto">
            Daftar kelompoknya diatur di Admin Panel → Kelompok &amp; Notifikasi.
          </p>
          <button type="button" onClick={simpan} disabled={menyimpan}
            className="px-4 py-2 rounded-xl text-xs font-bold text-white transition-all disabled:opacity-50 hover:opacity-90"
            style={{ background: 'linear-gradient(135deg,#0f766e,#115e59)' }}>
            {menyimpan ? 'Menyimpan…' : 'Simpan Lingkup'}
          </button>
        </div>
      </div>
    </div>
  );
}
