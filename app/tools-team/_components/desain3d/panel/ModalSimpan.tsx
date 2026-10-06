'use client';
/** Modal simpan & buka: laptop (.glb), server tim (versi), salinan lokal lama. */
import { ambilKunci, RUANG_AWAL } from '../useKeadaanDesain';
import { Ikon } from '@/components/shared/Ikon';
import { Modal } from '@/components/shared/Modal';
import { HardDriveDownload } from 'lucide-react';
import type { AlatDesain } from './alat';

export function ModalSimpan({ a }: { a: AlatDesain }) {
  const { benda, daftarTim, desainAktif, modal, namaDesain, riwayat, setAsal, setBenda, setDasar, setDesainAktif, setLihatVersi, setModal, setNamaDesain, setPilih, setRuang, sibukSimpan, statusSimpan, tersimpan } = a.K;
  const { bukaTim, hapusTim, simpanKeLaptop, simpanServer, tulisSimpanan, unggahLokal } = a.simpan;
  return (
    <>
    {/* ── Modal: Simpan / buka (server, dibagikan ke tim) ── */}
    <Modal buka={modal === 'simpan'} onTutup={() => setModal(null)} judul="Simpan & buka desain" ukuran="md" ikon={<Ikon nama="💾" ukuran={18} />}
      keterangan="Ke server: bisa dibuka seluruh tim; gambar layar unggahan ikut (dikompres, maks 6). Ke laptop: semuanya ikut termasuk model .glb impor, tanpa storage server.">
      {benda.some(b => b.jenis === 'model') && (
        <p className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
          Desain ini memuat <b>model 3D impor (.glb)</b>. Model tidak dikirim ke server (ukurannya besar &amp; menghabiskan kuota) - di server akan tampil sebagai kotak. Simpan juga ke laptop supaya modelnya tidak hilang.
        </p>
      )}
      <button type="button" onClick={() => { simpanKeLaptop(); }}
        className="w-full mb-3 flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-left hover:bg-emerald-100">
        <HardDriveDownload size={20} className="text-emerald-700 flex-shrink-0" />
        <span className="min-w-0">
          <span className="block text-[13px] font-bold text-emerald-900">Simpan ke laptop (.glb)</span>
          <span className="block text-[11.5px] text-emerald-800">Termasuk gambar layar & model impor. Buka lagi lewat Buka → Dari laptop; juga bisa dibuka di SketchUp/Blender.</span>
        </span>
      </button>
      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1.5">Simpan ke server (tim)</p>
      <div className="flex gap-2 flex-wrap">
        <input value={namaDesain} onChange={e => setNamaDesain(e.target.value)} placeholder="Nama desain" aria-label="Nama desain"
          className="flex-1 min-w-[160px] rounded-xl border border-slate-200 px-3 py-2 text-base sm:text-sm" />
        <button type="button" disabled={sibukSimpan} onClick={() => void simpanServer(false)}
          className="px-4 py-2 rounded-xl text-sm font-bold text-white bg-blue-700 hover:bg-blue-800 disabled:opacity-50">
          {desainAktif?.bolehUbah ? 'Simpan perubahan' : 'Simpan'}
        </button>
        {desainAktif && (
          <button type="button" disabled={sibukSimpan} onClick={() => void simpanServer(true)}
            className="px-3 py-2 rounded-xl text-sm font-bold text-blue-800 bg-blue-50 border border-blue-200 hover:bg-blue-100 disabled:opacity-50">Simpan sebagai baru</button>
        )}
      </div>
      {desainAktif && !desainAktif.bolehUbah && (
        <p className="mt-2 text-[12px] text-slate-600">Desain ini milik anggota lain. Menyimpan akan membuat salinan atas nama Anda.</p>
      )}
      {statusSimpan && (
        <p className={`mt-2 text-[12.5px] font-semibold ${statusSimpan.nada === 'galat' ? 'text-rose-700' : statusSimpan.nada === 'ok' ? 'text-emerald-700' : 'text-slate-600'}`}>{statusSimpan.teks}</p>
      )}

      <p className="mt-4 text-[11px] font-bold uppercase tracking-wider text-slate-600">Desain tim</p>
      {daftarTim === null ? (
        <p className="mt-2 text-[12.5px] text-slate-500">Memuat...</p>
      ) : daftarTim.length === 0 ? (
        <p className="mt-2 text-[12.5px] text-slate-500">Belum ada desain tersimpan di server.</p>
      ) : (
        <ul className="mt-1 divide-y divide-slate-100">
          {daftarTim.map(d => (
            <li key={d.id} className="flex items-center justify-between gap-2 py-2 text-[13px]">
              <span className="min-w-0">
                <button type="button" disabled={sibukSimpan} onClick={() => void bukaTim(d.id)}
                  className="block text-blue-700 font-semibold hover:underline truncate text-left max-w-full">
                  {d.nama}{desainAktif?.id === d.id && <span className="ml-1.5 text-[11px] font-bold text-emerald-700">· terbuka</span>}
                </button>
                <span className="block text-[11.5px] text-slate-500 truncate">
                  v{d.versi ?? 1} · {d.ruang ? `${d.ruang.p}×${d.ruang.l} m${d.ruang.r2?.aktif ? ` + ${1 + (d.ruang.lain ?? []).filter(x => x?.aktif).length} ruang` : ''} · ` : ''}{d.jumlah_benda} benda · {d.dibuat_oleh_nama || '—'}
                  {' · '}{new Date(d.updated_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
              </span>
              {d.bolehUbah && (
                <button type="button" aria-label={`Hapus ${d.nama}`} onClick={() => void hapusTim(d)}
                  className="w-7 h-7 flex-shrink-0 grid place-items-center rounded-md text-slate-500 hover:text-rose-700 hover:bg-rose-50"><Ikon nama="🗑" ukuran={14} /></button>
              )}
            </li>
          ))}
        </ul>
      )}

      {tersimpan.length > 0 && (
        <>
          <p className="mt-4 text-[11px] font-bold uppercase tracking-wider text-slate-600">Di perangkat ini (belum di server)</p>
          <ul className="mt-1 divide-y divide-slate-100">
            {tersimpan.map(t => (
              <li key={t.nama} className="flex items-center justify-between gap-2 py-2 text-[13px]">
                <button type="button" onClick={() => { const rb = { ...RUANG_AWAL, ...t.ruang }; setRuang(rb); setBenda(t.benda); riwayat.mulaiBaru({ ruang: rb, benda: t.benda }); setNamaDesain(t.nama); setDesainAktif(null); setLihatVersi(null); setAsal({ jenis: 'lokal', nama: t.nama }); setDasar(ambilKunci(rb, t.benda, t.nama)); setPilih(null); setModal(null); }}
                  className="text-blue-700 font-semibold hover:underline truncate text-left">{t.nama}</button>
                <span className="flex items-center gap-2 flex-shrink-0 text-slate-600">
                  <button type="button" disabled={sibukSimpan} onClick={() => void unggahLokal(t)}
                    className="text-[12px] font-bold text-blue-800 px-2 py-1 rounded-md bg-blue-50 hover:bg-blue-100 disabled:opacity-50">Unggah ke server</button>
                  <button type="button" aria-label={`Hapus ${t.nama}`} onClick={() => tulisSimpanan(tersimpan.filter(x => x.nama !== t.nama))}
                    className="w-7 h-7 grid place-items-center rounded-md text-slate-500 hover:text-rose-700 hover:bg-rose-50"><Ikon nama="🗑" ukuran={14} /></button>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </Modal>
    </>
  );
}
