'use client';
import React, { useEffect, useState } from 'react';
import { divisiSales, muatMerek, simpanDivisi, divisiTerpakai, rapikanDivisi } from '@/lib/merek';

/**
 * Daftar divisi sales - dipakai SELURUH dropdown divisi di platform:
 * Ticketing, Request Schedule, Request Design Project, Piket Showroom, dan
 * pendaftaran akun.
 *
 * Tempatnya di User Management, bukan di pengaturan tampilan: yang mengurus
 * divisi adalah orang yang sama dengan yang mengurus akun, dan divisi hanya
 * berarti sesuatu lewat akun yang memakainya.
 *
 * Sebelumnya daftar ini terpaku di kode - disalin PERSIS SAMA di lima berkas
 * shared.ts. Menambah satu divisi berarti menyunting kelimanya, dan satu yang
 * terlewat membuat divisi itu muncul di sebagian menu saja.
 */
export function DivisiSalesInline() {
  const [divisi, setDivisi] = useState<string[]>([]);
  const [baru, setBaru] = useState('');
  const [terpakai, setTerpakai] = useState<Record<string, number>>({});
  const [menyimpan, setMenyimpan] = useState(false);
  const [kabar, setKabar] = useState<{ jenis: 'ok' | 'gagal'; teks: string } | null>(null);
  const [siap, setSiap] = useState(false);

  const beritahu = (jenis: 'ok' | 'gagal', teks: string) => {
    setKabar({ jenis, teks });
    setTimeout(() => setKabar(null), 4000);
  };

  useEffect(() => {
    void muatMerek().then(() => { setDivisi(divisiSales()); setSiap(true); });
    void divisiTerpakai().then(setTerpakai);
  }, []);

  const tambah = () => {
    const nilai = baru.trim();
    if (!nilai) return;
    if (divisi.some(d => d.toLowerCase() === nilai.toLowerCase())) {
      beritahu('gagal', `"${nilai}" sudah ada di daftar.`);
      return;
    }
    setDivisi(d => [...d, nilai]);
    setBaru('');
  };

  const hapus = (nama: string) => {
    // Divisi yang masih tercatat di akun orang TIDAK dihapus diam-diam:
    // dropdown profil mereka akan tampil kosong dan penyaringan per divisi
    // berhenti menemukan pekerjaannya.
    const jumlah = terpakai[nama] ?? 0;
    if (jumlah > 0) {
      beritahu('gagal', `"${nama}" masih dipakai ${jumlah} akun. Pindahkan akunnya dulu.`);
      return;
    }
    setDivisi(d => d.filter(x => x !== nama));
  };

  const simpan = async () => {
    setMenyimpan(true);
    const { error } = await simpanDivisi(divisi);
    setMenyimpan(false);
    if (error) beritahu('gagal', 'Gagal menyimpan: ' + error);
    else beritahu('ok', `${rapikanDivisi(divisi).length} divisi tersimpan.`);
  };

  if (!siap) return <div className="p-4 text-sm text-slate-400">Memuat daftar divisi…</div>;

  return (
    <div className="rounded-2xl border border-slate-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
        <div>
          <h3 className="font-bold text-slate-800 text-sm">
            Divisi Sales <span className="text-slate-400 font-semibold">· {divisi.length}</span>
          </h3>
          <p className="text-slate-500 text-xs mt-0.5">
            Dipakai semua dropdown divisi: Ticketing, Request Schedule, Request Design Project, Piket Showroom, dan pendaftaran akun.
          </p>
        </div>
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

        <div className="flex gap-2">
          <input value={baru} onChange={e => setBaru(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); tambah(); } }}
            placeholder="Nama divisi baru…"
            className="flex-1 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:border-slate-400 bg-white" />
          <button type="button" onClick={tambah}
            className="px-4 py-2.5 rounded-xl text-xs font-bold text-white flex-shrink-0 transition-all hover:opacity-90"
            style={{ background: 'linear-gradient(135deg,#0f766e,#115e59)' }}>
            Tambah
          </button>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {divisi.map(d => {
            const jumlah = terpakai[d] ?? 0;
            return (
              <span key={d} className="inline-flex items-center gap-1.5 pl-3 pr-1.5 py-1.5 rounded-xl text-xs font-semibold border border-slate-200 bg-slate-50 text-slate-700">
                {d}
                {jumlah > 0 && <span className="text-[10px] font-bold text-slate-400">{jumlah} akun</span>}
                <button type="button" onClick={() => hapus(d)}
                  title={jumlah > 0 ? `Masih dipakai ${jumlah} akun` : `Hapus ${d}`}
                  aria-label={jumlah > 0 ? `${d} masih dipakai ${jumlah} akun` : `Hapus ${d}`}
                  className="w-5 h-5 rounded-lg flex items-center justify-center transition-all"
                  style={jumlah > 0
                    ? { color: '#cbd5e1', cursor: 'not-allowed' }
                    : { color: '#94a3b8', background: 'rgba(0,0,0,0.04)' }}>
                  <svg aria-hidden="true" className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </span>
            );
          })}
        </div>

        <div className="flex items-center justify-end gap-2">
          <p className="text-[11px] text-slate-400 mr-auto">Divisi yang masih dipakai akun tidak bisa dihapus.</p>
          <button type="button" onClick={simpan} disabled={menyimpan || divisi.length === 0}
            className="px-4 py-2 rounded-xl text-xs font-bold text-white transition-all disabled:opacity-50 hover:opacity-90"
            style={{ background: 'linear-gradient(135deg,#0f766e,#115e59)' }}>
            {menyimpan ? 'Menyimpan…' : 'Simpan Daftar Divisi'}
          </button>
        </div>
      </div>
    </div>
  );
}
