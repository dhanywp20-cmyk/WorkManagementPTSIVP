'use client';
import { Angka, f, Pilih, Segmen } from '../../bersama/ui';
import { brandModul, kunciModul, type ModulLED, pitchNyata } from '@/lib/av/hitung';
import { CABINET, LINGKUNGAN_TIPE, PITCH } from '../data';
import type { SpekModul } from '../layar';
import type { AlatLED } from './alat';

export function ModulLayar({ a, spek, onUbah, label }: { a: AlatLED; spek: SpekModul | null; onUbah: (s: SpekModul | null) => void; label: string }) {
  const { brandAda, cabH, cabKey, cabW, daftarModul, lingkungan, modul, modulKode, namaLayar, pitch, satuan } = a.K;
  const ubah = (x: Partial<SpekModul>) => spek && onUbah({ ...spek, ...x });
  const pilihModul = (m: ModulLED | undefined) => m && ubah({ modulKode: kunciModul(m), ref: m, lingkungan: LINGKUNGAN_TIPE[m.tipe] });
  const sendiri = () => onUbah({ satuan, modulKode, pitch, cabKey, cabW, cabH, lingkungan, ref: modul });
  const mAktif = spek ? daftarModul.find(m => kunciModul(m) === spek.modulKode) ?? spek.ref ?? daftarModul[0] : null;
  const brand = mAktif ? brandModul(mAktif) : '';
  const modulBrand = daftarModul.filter(m => brandModul(m) === brand);
  return (
    <div className="space-y-2">
      <Segmen label={label} nilai={spek ? 'sendiri' : 'sama'} onUbah={v => (v === 'sama' ? onUbah(null) : sendiri())}
        opsi={[{ v: 'sama', l: `Sama dengan ${namaLayar || 'Screen 1'}` }, { v: 'sendiri', l: 'Atur sendiri' }]} />
      {spek && (
        <div className="rounded-lg bg-slate-50 border border-slate-100 p-2 space-y-2">
          <Segmen nilai={spek.satuan} onUbah={v => ubah({ satuan: v })} opsi={[{ v: 'modul', l: 'Referensi brand' }, { v: 'cabinet', l: 'Cabinet bebas' }]} />
          {spek.satuan === 'modul' ? (
            <div className="grid gap-2">
              <Pilih label="Brand" nilai={brand} onUbah={v => pilihModul(daftarModul.find(m => brandModul(m) === v && m.kode === mAktif?.kode) ?? daftarModul.find(m => brandModul(m) === v))}
                opsi={brandAda.map(b => ({ v: b.nama, l: `${b.nama} · ${b.jumlah} produk` }))} />
              <Pilih label="Model / pitch" nilai={mAktif ? kunciModul(mAktif) : ''} onUbah={v => pilihModul(daftarModul.find(m => kunciModul(m) === v))}
                opsi={(modulBrand.length ? modulBrand : mAktif ? [mAktif] : []).map(m => ({ v: kunciModul(m), l: `${m.model ? `${m.model} · ` : ''}${m.kode} · ${m.w}×${m.h} mm · ${m.pxW}×${m.pxH} px` }))} />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <Pilih label="Pixel pitch" nilai={PITCH.includes(spek.pitch) ? spek.pitch : -1} onUbah={v => v > 0 && ubah({ pitch: v })}
                opsi={[...PITCH.map(p => ({ v: p, l: pitchNyata(p) !== p ? `P${p} (${f(pitchNyata(p), 3)} mm)` : `P${p}` })), { v: -1, l: 'Custom...' }]} />
              <Angka label="Pitch (mm)" nilai={spek.pitch} onUbah={v => v > 0 && ubah({ pitch: v })} satuan="mm" />
              <div className="col-span-2">
                <Pilih label="Ukuran cabinet" nilai={spek.cabKey} onUbah={v => { const c = CABINET.find(x => x.v === v); ubah(c && c.w ? { cabKey: v, cabW: c.w, cabH: c.h } : { cabKey: v }); }}
                  opsi={CABINET.map(c => ({ v: c.v, l: c.l }))} />
              </div>
              {spek.cabKey === 'custom' && (
                <>
                  <Angka label="Lebar cabinet" nilai={spek.cabW} onUbah={v => v > 0 && ubah({ cabW: v })} satuan="mm" />
                  <Angka label="Tinggi cabinet" nilai={spek.cabH} onUbah={v => v > 0 && ubah({ cabH: v })} satuan="mm" />
                </>
              )}
            </div>
          )}
          <Segmen nilai={spek.lingkungan} onUbah={v => ubah({ lingkungan: v })}
            opsi={[{ v: 'indoor', l: 'Indoor' }, { v: 'semi-outdoor', l: 'Semi' }, { v: 'outdoor', l: 'Outdoor' }]} />
        </div>
      )}
    </div>
  );
}
