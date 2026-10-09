'use client';
import { LegendaKabel } from './desain3d/panel/LegendaKabel';
import { JUDUL_SISI, ModalBukaDesain } from './desain3d/panel/ModalBuka';
import { ModalObjekGambar } from './desain3d/panel/ModalObjekGambar';
import { PanelBenda } from './desain3d/panel/PanelBenda';
import { PanelBanyak } from './desain3d/panel/PanelBanyak';
import { useEffect } from 'react';
import { PanelRuang } from './desain3d/panel/PanelRuang';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { Ikon } from '@/components/shared/Ikon';
import { useKeadaanDesain } from './desain3d/useKeadaanDesain';
import { useMesin } from './desain3d/mesin/useMesin';
import { useKamera } from './desain3d/mesin/useKamera';
import { useAdegan } from './desain3d/mesin/useAdegan';
import { useAksiDesain } from './desain3d/aksi/useAksiDesain';
import { useProdukTim } from './desain3d/simpan/useProdukTim';
import { useEkspor } from './desain3d/ekspor/useEkspor';
import { useSimpanDesain } from './desain3d/simpan/useSimpanDesain';
import { useTemplateKategori } from './desain3d/simpan/useTemplateKategori';
import { InfoProyektor } from './desain3d/panel/InfoProyektor';

import { BilahBerkas } from './desain3d/panel/BilahBerkas';
import { BilahAlat } from './desain3d/panel/BilahAlat';
import { KontrolKanvas } from './desain3d/panel/KontrolKanvas';
import { PanelTambah } from './desain3d/panel/PanelTambah';
import { PanelKategori } from './desain3d/panel/PanelKategori';
import { DaftarBenda } from './desain3d/panel/DaftarBenda';
import { BilahTerpilih } from './desain3d/panel/BilahTerpilih';
import { KartuAnalisis } from './desain3d/panel/KartuAnalisis';
import { KartuKabel } from './desain3d/panel/KartuKabel';
import { ModalSimpan } from './desain3d/panel/ModalSimpan';
import { NavKamera } from './desain3d/panel/NavKamera';
import type { AlatDesain } from './desain3d/panel/alat';

/**
 * Desain 3D Ruang AV (Tools Team) - kerangka saja: merangkai keadaan, hook engine, dan panel.
 * Struktur lengkap: desain3d/README.md.
 *
 *   useKeadaanDesain   seluruh state & nilai turunan
 *   useMesin           engine three.js (renderer, kamera orbit, gizmo, klik-pilih)
 *   useKamera          arah pandang, pas ruangan, zoom, fokus
 *   useAdegan          ruangan, benda, alat bantu (sinar, kabel, ukuran), cahaya & bayangan
 *   useAksiDesain      edit desain (template, tambah, salin, tempel, ruang & bukaan)
 *   useProdukTim / useSimpanDesain / useEkspor   server tim, laptop, PNG & cetak
 *   panel/*            komponen UI (bilah, panel samping, kartu hasil, modal)
 *
 * three.js dimuat dinamis hanya saat alat ini dibuka.
 */
export default function Desain3D() {
  const K = useKeadaanDesain();
  useMesin(K);
  const kamera = useKamera(K);
  useAdegan(K);
  const aksi = useAksiDesain(K);
  const produk = useProdukTim(K);
  const ekspor = useEkspor(K, { ...kamera });
  const simpan = useSimpanDesain(K);
  const template = useTemplateKategori(K, aksi, simpan);
  const { layarPenuh, setLayarPenuh, pilihLain, asideRef, batas, benda, desainAktif, duaRuang, galat, gambarLayar, gantiBenda, gantiIsi, hanyaLihat, impor, inputGambar, inputLaptop, konfirmasi, kotakRuang, legendaKabel, lihatVersi, modal, objekGambar, panel, pesan, plafonDi, produkTim, ruang, setGantiIsi, setKonfirmasi, setModal, setObjekGambar, setPanel, setRuang, setSisi, siap, sisi, terpilih, wadahRef } = K;
  const { hapusRuangTerakhir, pasangSambungan, salinIsiRuang, tambahBukaan, tambahRuang, ubahBukaan, ubahSambungan, ubahUkuran, unggahGambar } = aksi;
  const { simpanProduk } = produk;
  const { bukaDariLaptop, bukaTim } = simpan;

  const a: AlatDesain = { K, kamera, aksi, produk, ekspor, simpan, template };
  //  Layar penuh: Esc kembali ke tampilan biasa; halaman di belakangnya tidak ikut tergulir.
  useEffect(() => {
    if (!layarPenuh) return;
    const tekan = (e: KeyboardEvent) => { if (e.key === 'Escape' && !document.querySelector('[role=dialog]')) setLayarPenuh(false); };
    const lama = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', tekan);
    return () => { window.removeEventListener('keydown', tekan); document.body.style.overflow = lama; };
  }, [layarPenuh, setLayarPenuh]);
  return (
    <div className="space-y-3">
      <ConfirmDialog state={konfirmasi} onCancel={() => setKonfirmasi(null)} />
      <div className={layarPenuh ? 'fixed inset-0 z-[950] flex flex-col bg-white' : 'rounded-2xl overflow-hidden border border-slate-200 bg-white'}>
        {/* Berkas yang sedang dibuka: nama (bisa diganti langsung) + dari mana asalnya + sudah/belum tersimpan.
            Dulu kanvas tidak memberi tahu desain mana yang sedang terbuka. */}
        <BilahBerkas a={a} />
        <BilahAlat a={a} />

        <div className={`flex flex-col lg:flex-row ${layarPenuh ? 'flex-1 min-h-0' : ''}`}>
        <div ref={wadahRef} className={`relative w-full lg:w-auto lg:flex-1 min-w-0 overflow-hidden ${layarPenuh ? 'flex-1 min-h-[300px]' : 'h-[440px] sm:h-[620px]'}`}>
          {!siap && !galat && <div className="absolute inset-0 grid place-items-center text-sm text-slate-500">Memuat tampilan 3D...</div>}
          {legendaKabel && <LegendaKabel dipakai={legendaKabel} />}
          <KontrolKanvas a={a} />
          {lihatVersi && (
            <div className="absolute left-1/2 -translate-x-1/2 bottom-2 z-20 max-w-[calc(100%-120px)] px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-300 text-amber-900 text-[12px] font-semibold shadow text-center">
              <span title="Versi yang ditautkan. Menyimpan membuat versi baru dari isi ini; riwayat tidak berubah.">v{lihatVersi.versi} · terbaru v{lihatVersi.terbaru}</span>
            </div>
          )}
          {pesan && (
            <div role="status" className="absolute left-1/2 -translate-x-1/2 top-12 z-20 max-w-[calc(100%-32px)] px-3 py-1.5 rounded-lg bg-emerald-700 text-white text-[12px] font-semibold shadow-lg text-center">{pesan}</div>
          )}
          <NavKamera a={a} />
        </div>
        {/* Panel kanan: menempel di samping kanvas (layar lebar) atau di bawahnya (ponsel/tablet), jadi tampilan 3D tidak tertutup. */}
        {(sisi || (terpilih && panel)) && (
          <aside ref={asideRef} aria-label={sisi ? JUDUL_SISI[sisi].judul : 'Atur benda'}
            className={`flex flex-col min-h-0 border-t lg:border-t-0 lg:border-l border-slate-200 bg-white w-full lg:w-[360px] lg:shrink-0 max-h-[70vh] lg:max-h-none h-auto ${layarPenuh ? 'lg:h-auto' : 'lg:h-[620px]'}`}>
            {sisi ? (
              <>
                <div className="flex items-start gap-2 px-3 py-2.5 border-b border-slate-100">
                  <span className="mt-0.5 shrink-0"><Ikon nama={JUDUL_SISI[sisi].ikon} ukuran={17} /></span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-bold text-slate-900" title={JUDUL_SISI[sisi].ket}>{JUDUL_SISI[sisi].judul}</p>
                  </div>
                  <button type="button" onClick={() => setSisi(null)} aria-label="Tutup panel" className="w-8 h-8 shrink-0 grid place-items-center rounded-lg text-slate-600 hover:bg-slate-100">
                    <Ikon nama="❌" ukuran={16} />
                  </button>
                </div>
                <div className="flex-1 min-h-0 overflow-y-auto p-3">
                  <PanelTambah a={a} />
                  {sisi === 'ruang' && (
                    <PanelRuang ruang={ruang} setRuang={setRuang} ubahUkuran={ubahUkuran} benda={benda} kotakRuang={kotakRuang} tambahBukaan={tambahBukaan} ubahBukaan={ubahBukaan} tambahRuang={tambahRuang} hapusRuangTerakhir={hapusRuangTerakhir} ubahSambungan={ubahSambungan} pasangSambungan={pasangSambungan} gantiIsi={gantiIsi} setGantiIsi={setGantiIsi} salinIsiRuang={salinIsiRuang} duaRuang={duaRuang} />
                  )}
                  <PanelKategori a={a} />
                  <DaftarBenda a={a} />
                </div>
              </>
            ) : terpilih && pilihLain.length > 0 ? (
              <PanelBanyak a={a} />
            ) : terpilih && (
              <PanelBenda b={terpilih} semua={benda} plafon={plafonDi(terpilih.x)} batas={batas} onUbah={gantiBenda}
                onGambar={() => inputGambar.current?.click()} onTutup={() => setPanel(false)}
                ekstra={terpilih.jenis === 'proyektor' ? <InfoProyektor p={terpilih} K={K} /> : undefined}
                onSimpanProduk={hanyaLihat || produkTim?.bolehTambah === false ? undefined : (label, ket) => simpanProduk(terpilih, label, ket)}
                adaFoto={gambarLayar.current.has(terpilih.id)} onGambarObjek={() => setObjekGambar({ ganti: terpilih })} />
            )}
          </aside>
        )}
        </div>
        <input ref={inputGambar} type="file" accept="image/*" className="hidden" onChange={e => { unggahGambar(e.target.files?.[0] ?? null); e.target.value = ''; }} />
        <input ref={inputLaptop} type="file" accept=".glb,model/gltf-binary" className="hidden" onChange={e => { void bukaDariLaptop(e.target.files?.[0] ?? null); e.target.value = ''; }} />

        <BilahTerpilih a={a} />
        {galat && <p className="px-3 py-2 text-[12px] font-semibold text-rose-700 border-t border-rose-100 bg-rose-50">{galat}</p>}
      </div>

      <KartuAnalisis a={a} />

      <KartuKabel a={a} />

      <ModalObjekGambar buka={!!objekGambar} onTutup={() => setObjekGambar(null)}
        onJadi={h => { impor.dariGambar(h, objekGambar?.ganti); setObjekGambar(null); }} />

      {/* ── Modal: Buka desain tersimpan (seluruh tim) + riwayat versi ── */}
      <ModalBukaDesain buka={modal === 'buka'} onTutup={() => setModal(null)} aktifId={desainAktif?.id ?? null}
        onBuka={(id, versi) => void bukaTim(id, versi)} onLaptop={() => inputLaptop.current?.click()} />

      <ModalSimpan a={a} />
    </div>
  );
}
