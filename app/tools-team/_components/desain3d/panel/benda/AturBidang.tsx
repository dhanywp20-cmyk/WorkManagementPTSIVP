'use client';
/** Atur bidang / layar mapping: datar, cekung, cembung, pilar 360°. */
import { Angka, f, Segmen } from '../../../ui';
import { type Benda, lengkungDari, terapkanUkuran, ukuranBidang } from '../../inti';
import type { KonteksAtur } from './konteks';

export function AturBidang({ c }: { c: KonteksAtur }) {
  const { b, onUbah, setUkuran } = c;
  return (
    <>
      {b.jenis === 'bidang' && (() => {
        const u = ukuranBidang(b);
        const bentuk = b.bentukBidang ?? 'lengkung';
        const NAMA_BIDANG: Record<string, string> = { datar: 'Layar mapping datar', lengkung: 'Layar mapping cekung', cembung: 'Layar mapping cembung' };
        const namaBawaan = /^(Bidang|Layar) mapping (lengkung|cekung|cembung|datar)$/.test(b.nama);
        //  Ganti bentuk dengan lebar tetap: datar -> lengkung 10% dari lebar, lengkung -> datar selebar tali busurnya.
        const gantiBentuk = (v: 'datar' | 'lengkung' | 'cembung') => {
          const lebar = u.busur >= 180 ? 4 : u.w;
          const x: Partial<Benda> = v === 'datar' ? { bentukBidang: v, w: lebar } : { bentukBidang: v, ...(bentuk === 'datar' || u.busur >= 180 ? lengkungDari(lebar, lebar * 0.1) : {}) };
          const nb = terapkanUkuran({ ...b, ...x });
          if (namaBawaan) nb.nama = NAMA_BIDANG[v];
          onUbah(nb);
        };
        const busurPenuh = bentuk !== 'datar' && u.busur >= 180;
        return (
          <div className="rounded-xl border border-slate-200 p-2.5 space-y-2 bg-slate-50/60">
            <Segmen label="Bentuk layar / bidang" nilai={bentuk} onUbah={gantiBentuk}
              opsi={[{ v: 'datar', l: 'Datar' }, { v: 'lengkung', l: 'Cekung' }, { v: 'cembung', l: 'Cembung' }]} />
            {bentuk === 'datar' ? (
              <Angka label="Lebar layar" nilai={u.w} satuan="m" step={0.1} onUbah={v => v >= 0.2 && v <= 60 && setUkuran({ w: v })} />
            ) : !busurPenuh && (
              <div className="grid grid-cols-2 gap-2">
                <Angka label="Lebar layar" nilai={u.w} satuan="m" step={0.1} bantuan="Lurus ujung ke ujung"
                  onUbah={v => v >= 0.2 && v <= 60 && setUkuran(lengkungDari(v, Math.min(u.d, v / 2)))} />
                <Angka label="Kedalaman lengkung" nilai={Math.round(u.d * 100)} satuan="cm" step={5} bantuan={bentuk === 'cembung' ? 'Tengah maju ke penonton' : 'Tengah masuk ke belakang'}
                  onUbah={v => v >= 1 && v / 100 <= u.w / 2 && setUkuran(lengkungDari(u.w, v / 100))} />
              </div>
            )}
            {bentuk !== 'datar' && (
              <div className="grid grid-cols-2 gap-2">
                <Angka label="Jari-jari" nilai={u.R} satuan="m" step={0.1} onUbah={v => v >= 0.2 && v <= 50 && setUkuran({ jariBidang: v })} />
                <Angka label="Busur" nilai={u.busur} satuan="°" step={5} bantuan="360° = pilar / silinder" onUbah={v => v >= 10 && v <= 360 && setUkuran({ busur: v })} />
              </div>
            )}
            <p className="text-[12px] text-slate-600">
              {bentuk === 'datar' ? `Layar ${f(u.w)} × ${f(b.h)} m.` : `Panjang permukaan ${f(u.R * u.busur * Math.PI / 180)} m × tinggi ${f(b.h)} m · tapak ${f(u.w)} × ${f(u.d)} m.`}
              {' '}Tinggi & warna permukaan diatur di bagian Ukuran dan Warna. Arahkan proyektor ke layar ini - sinarnya jatuh mengikuti permukaannya.
            </p>
          </div>
        );
      })()}
    </>
  );
}
