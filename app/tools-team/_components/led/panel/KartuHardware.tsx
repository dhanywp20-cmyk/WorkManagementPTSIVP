'use client';
/** Kartu hardware Novastar: saran otomatis atau pilihan manual, pemakaian kapasitas. */
import { Catatan, f, Kartu, Pilih, Segmen } from '../../bersama/ui';
import { KECERAHAN } from '@/lib/av-hitung';
import { ArrowRight, Cable, Zap } from 'lucide-react';
import { KartuHw, TombolRef } from './komponen';
import type { AlatLED } from './alat';

export function KartuHardware({ a }: { a: AlatLED }) {
  const { daftarKartu, daftarVP, dayaLED, h, hDaya, hw, kartuM, lingkungan, modeHw, pindah, refLED, setBukaRef, setKartuPilih, setModeHw, setVpPilih, tKon, vpAio, vpM, vpPilih, vpSaja } = a.K;
  return (
    <>
      <Kartu judul="Hardware Novastar (per screen)" aksi={<TombolRef onKlik={() => setBukaRef(true)} diubah={refLED.diubah} />}>
        <div className="space-y-3">
          <Segmen label="Pemilihan" nilai={modeHw} onUbah={setModeHw}
            opsi={[{ v: 'otomatis', l: 'Otomatis (terkecil yang cukup)' }, { v: 'manual', l: 'Pilih model' }]} />
          {modeHw === 'manual' && (
            <div className="grid sm:grid-cols-2 gap-3">
              <Pilih label="Video processor" nilai={vpPilih} onUbah={setVpPilih}
                opsi={[{ v: '', l: 'Tanpa VP (sumber langsung)' }, ...daftarVP.map(v => ({ v: v.nama, l: `${v.nama} · ${f(v.maksPx / 1e6, 1)} MP${v.senderBawaan && v.port > 0 ? ` · ${v.port} port` : ' · perlu sending card'}` }))]} />
              {!vpAio && (
                <Pilih label="Sending card" nilai={kartuM?.nama ?? ''} onUbah={setKartuPilih}
                  opsi={daftarKartu.map(k => ({ v: k.nama, l: `${k.nama} · ${f(k.maksPx / 1e6, 1)} MP · ${k.port} port` }))} />
              )}
            </div>
          )}
          {modeHw === 'otomatis' ? (
            <div className="grid sm:grid-cols-2 gap-2.5">
              {hw.vp && <KartuHw peran="Opsi A · All-in-one" hw={hw.vp.hw} totalPx={h.totalPx} portLAN={h.portLAN} nada="hijau" catatan="Sending sudah terpasang, tidak perlu sending card." />}
              {hw.kartu && <KartuHw peran="Opsi B · Sending card" hw={hw.kartu.hw} totalPx={h.totalPx} portLAN={h.portLAN} nada="abu"
                catatan={`Dengan video processor tanpa sender${vpSaja.length ? ` (${vpSaja.map(v => v.nama).join(', ')})` : ''} atau langsung dari sumber.`} />}
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-2.5">
              {vpM && <KartuHw peran={vpAio ? 'Video processor · all-in-one' : 'Video processor'} hw={vpM} totalPx={h.totalPx} portLAN={h.portLAN} nada={vpAio ? 'hijau' : 'abu'}
                catatan={vpAio ? 'Sending sudah terpasang, tidak perlu sending card.' : 'Tanpa output LAN: dipasangkan dengan sending card.'} />}
              {kartuM && <KartuHw peran="Sending card" hw={kartuM} totalPx={h.totalPx} portLAN={h.portLAN} nada="abu" />}
            </div>
          )}
          {hw.vp && hw.vp.qty > 1 && modeHw === 'otomatis' && (
            <p className="text-[12.5px] text-amber-800">Melebihi kapasitas satu unit: layar dibagi ke beberapa controller, perlu sinkronisasi/splicer.</p>
          )}
        </div>
        <button type="button" onClick={() => pindah('koneksi')}
          className="mt-3 w-full inline-flex items-center justify-between gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-left hover:bg-blue-100">
          <span className="inline-flex items-center gap-2 text-[12.5px] font-bold text-blue-800"><Cable size={15} /> Screen Connection</span>
          <span className="text-[12px] text-blue-800">{tKon.portTerpakai} port · atur urutan kabel <ArrowRight size={13} className="inline" /></span>
        </button>
        <button type="button" onClick={() => pindah('daya')}
          className="mt-2 w-full inline-flex items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-left hover:bg-amber-100">
          <span className="inline-flex items-center gap-2 text-[12.5px] font-bold text-amber-900"><Zap size={15} /> Power Connection</span>
          <span className="text-[12px] text-amber-900">{hDaya.sirkuit.length} sirkuit × MCB {dayaLED.mcb} A · atur fase <ArrowRight size={13} className="inline" /></span>
        </button>
        <Catatan>Kecerahan disarankan: {KECERAHAN[lingkungan]}. Kapasitas sesuai tabel referensi (60 Hz 8-bit ≈ 650 rb px/port); cek datasheet dan NovaLCT sebelum penawaran.</Catatan>
      </Kartu>
    </>
  );
}
