'use client';
/**
 * Atur LED videotron - satuan dari referensi yang SAMA dengan menu LED Videotron:
 *   - Referensi: modul / cabinet per brand & model (pitch, ukuran unit, piksel per unit dari datasheet),
 *     dibaca dari referensi tim (/api/tools-team/referensi-led) lewat useReferensiLED.
 *   - Cabinet bebas: daftar cabinet & pitch umum menu LED Videotron (led/data.ts).
 * Ukuran layar selalu kelipatan unit utuh (inti/produk.ts susunanLED).
 */
import { BRAND_UMUM, brandModul, cariModul, daftarBrand, kunciModul, type ModulLED } from '@/lib/av-hitung';
import { Angka, f, Pilih, Segmen, Catatan } from '../../../bersama/ui';
import { CABINET, PITCH } from '../../../led/data';
import { useReferensiLED } from '../../../led/referensi/useReferensiLED';
import { susunanLED } from '../../inti';
import type { KonteksAtur } from './konteks';

/** Nama bawaan LED (belum diganti engineer) ikut produk yang dipilih. */
const NAMA_BAWAAN = /^LED( videotron|\b)/i;

export function AturLED({ c }: { c: KonteksAtur }) {
  const { b, setUkuran } = c;
  const ref = useReferensiLED();
  const daftar = ref.data.modul;
  const sumber = b.satuanLED ?? 'cabinet';
  const s = susunanLED(b);
  const namaDari = (m: ModulLED) => ['LED', brandModul(m) !== BRAND_UMUM && brandModul(m), m.model, m.kode].filter(Boolean).join(' ');
  const pakaiModul = (m: ModulLED) => setUkuran({
    satuanLED: 'referensi', modulLED: kunciModul(m), unitLED: m.unit ?? 'modul',
    pitch: m.pitch, cabW: m.w, cabH: m.h, pxUnitX: m.pxW, pxUnitY: m.pxH,
    ...(NAMA_BAWAAN.test(b.nama) ? { nama: namaDari(m) } : {}),
  });
  const modul = b.modulLED ? cariModul(daftar, b.modulLED) : undefined;
  const brandAktif = modul ? brandModul(modul) : (daftarBrand(ref.data.brand, daftar, true)[0]?.nama ?? BRAND_UMUM);
  const modulBrand = daftar.filter(m => brandModul(m) === brandAktif);
  const cab = CABINET.find(x => x.w === s.cabW && x.h === s.cabH && x.v !== 'custom')?.v ?? 'custom';
  const unit = s.unit;

  return (
    <>
      <Segmen label="Satuan LED (menu LED Videotron)" nilai={sumber} opsi={[{ v: 'referensi', l: 'Referensi modul / cabinet' }, { v: 'cabinet', l: 'Cabinet bebas' }]}
        onUbah={(v: 'referensi' | 'cabinet') => {
          if (v === 'referensi') { const m = modul ?? modulBrand[0] ?? daftar[0]; if (m) pakaiModul(m); return; }
          setUkuran({ satuanLED: 'cabinet', modulLED: undefined, unitLED: 'cabinet', pxUnitX: undefined, pxUnitY: undefined });
        }} />
      {sumber === 'referensi' ? (
        <div className="grid grid-cols-2 gap-2">
          <Pilih label="Brand" nilai={brandAktif} onUbah={(v: string) => { const m = daftar.find(x => brandModul(x) === v && x.pitch === s.pitch) ?? daftar.find(x => brandModul(x) === v); if (m) pakaiModul(m); }}
            opsi={daftarBrand(ref.data.brand, daftar, true).map(x => ({ v: x.nama, l: `${x.nama}${x.sendiri ? ' ★' : ''}` }))} />
          <Pilih label="Modul / cabinet" nilai={modul ? kunciModul(modul) : ''} onUbah={(v: string) => { const m = cariModul(daftar, v); if (m) pakaiModul(m); }}
            opsi={[...(modul ? [] : [{ v: '', l: 'Pilih...' }]), ...modulBrand.map(m => ({ v: kunciModul(m), l: `${m.kode}${m.model ? ` ${m.model}` : ''} · ${m.w}×${m.h} mm · ${m.unit ?? 'modul'}` }))]} />
          {modul && <p className="col-span-2 text-[11.5px] text-slate-500">{modul.tipe} · {modul.pxW} × {modul.pxH} px per {modul.unit ?? 'modul'} · {modul.guna}</p>}
          <p className="col-span-2 text-[11px] text-slate-500">Referensi {ref.sumber === 'tim' ? 'tim' : ref.sumber === 'lokal' ? 'draf di perangkat ini' : 'bawaan'} - sama dengan menu LED Videotron › Referensi.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2">
            <Pilih label="Pitch" nilai={PITCH.includes(s.pitch) ? s.pitch : -1} onUbah={(v: number) => v > 0 && setUkuran({ pitch: v })}
              opsi={[...PITCH.map(p => ({ v: p, l: `P${p}` })), { v: -1, l: 'Custom...' }]} />
            <Angka label="Pitch" nilai={s.pitch} satuan="mm" onUbah={v => v > 0 && setUkuran({ pitch: v })} />
          </div>
          <Pilih label="Cabinet" nilai={cab} onUbah={(v: string) => { const x = CABINET.find(k => k.v === v); if (x && x.w > 0) setUkuran({ cabW: x.w, cabH: x.h }); }}
            opsi={CABINET.map(x => ({ v: x.v, l: x.l }))} />
          <div className="grid grid-cols-2 gap-2">
            <Angka label="Lebar cabinet" nilai={s.cabW} satuan="mm" onUbah={v => v >= 100 && setUkuran({ cabW: v })} />
            <Angka label="Tinggi cabinet" nilai={s.cabH} satuan="mm" onUbah={v => v >= 100 && setUkuran({ cabH: v })} />
          </div>
        </>
      )}
      <div className="grid grid-cols-2 gap-2">
        <Angka label={`Kolom ${unit}`} nilai={s.kolom} onUbah={v => v >= 1 && setUkuran({ w: (Math.round(v) * s.cabW) / 1000 })} />
        <Angka label={`Baris ${unit}`} nilai={s.baris} onUbah={v => v >= 1 && setUkuran({ h: (Math.round(v) * s.cabH) / 1000 })} />
      </div>
      <Catatan>
        {s.kolom} × {s.baris} = {s.kolom * s.baris} {unit} · layar {f(s.lebarM, 3)} × {f(s.tinggiM, 3)} m · resolusi {s.resX} × {s.resY} px
        ({s.pxCabX} × {s.pxCabY} px per {unit}). Ukuran selalu kelipatan {unit} utuh. Hitung daya, port & BOM lengkap di menu LED Videotron.
      </Catatan>
    </>
  );
}
