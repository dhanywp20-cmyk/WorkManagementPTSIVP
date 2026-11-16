'use client';
import { Angka, f, Segmen } from '../../../bersama/ui';
import { type Benda, type BentukBidang, bolaBidang, kedalamanBidang, lengkungDari, terapkanUkuran, tinggiMaksBola, ubahLebarBidang, ukuranBidang } from '../../inti';
import type { KonteksAtur } from './konteks';

export function AturBidang({ c }: { c: KonteksAtur }) {
  const { b, onUbah, setUkuran } = c;
  return (
    <>
      {b.jenis === 'bidang' && (() => {
        const u = ukuranBidang(b);
        const bentuk = b.bentukBidang ?? 'lengkung';
        const NAMA_BIDANG: Record<BentukBidang, string> = { datar: 'Layar mapping datar', lengkung: 'Layar mapping cekung', cembung: 'Layar mapping cembung', bola: 'Layar cekung bola' };
        const namaBawaan = /^((Bidang|Layar) mapping (lengkung|cekung|cembung|datar)|Layar cekung bola)$/.test(b.nama);
        const gantiBentuk = (v: BentukBidang) => {
          const lebar = u.busur >= 180 ? 4 : u.w;
          const x: Partial<Benda> = v === 'datar' ? { bentukBidang: v, w: lebar }
            : v === 'bola' ? { bentukBidang: v, ...(bentuk === 'datar' ? lengkungDari(lebar, lebar * 0.3) : {}) }
              : { bentukBidang: v, ...(bentuk === 'datar' || u.busur >= 180 ? lengkungDari(lebar, lebar * 0.1) : {}) };
          const nb = terapkanUkuran({ ...b, ...x });
          if (namaBawaan) nb.nama = NAMA_BIDANG[v];
          onUbah(nb);
        };
        return (
          <div className="rounded-xl border border-slate-200 p-2.5 space-y-2 bg-slate-50/60">
            <Segmen label="Bentuk layar / bidang" nilai={bentuk} onUbah={gantiBentuk}
              opsi={[{ v: 'datar', l: 'Datar' }, { v: 'lengkung', l: 'Cekung' }, { v: 'bola', l: 'Bola' }, { v: 'cembung', l: 'Cembung' }]} />
            {bentuk === 'datar' ? (
              <Angka label="Lebar layar" nilai={u.w} satuan="m" step={0.1} onUbah={v => v >= 0.2 && v <= 60 && setUkuran({ w: v })} />
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <Angka label="Lebar layar" nilai={u.w} satuan="m" step={0.1} bantuan={bentuk === 'bola' ? 'Lurus ujung ke ujung; busur & pusat bola (mata pilot) tetap' : 'Lurus ujung ke ujung'}
                  onUbah={v => v >= 0.2 && v <= 60 && setUkuran(ubahLebarBidang(b, v))} />
                {u.busur < 360 && (
                  <Angka label="Kedalaman lengkung" nilai={Math.round(u.d * 100)} satuan="cm" step={5} bantuan={bentuk === 'cembung' ? 'Tengah maju ke penonton' : 'Tengah masuk ke belakang'}
                    onUbah={v => v >= 1 && setUkuran(kedalamanBidang(b, v / 100))} />
                )}
              </div>
            )}
            {bentuk !== 'datar' && (
              <div className="grid grid-cols-2 gap-2">
                <Angka label="Jari-jari" nilai={u.R} satuan="m" step={0.1} onUbah={v => v >= 0.2 && v <= 50 && setUkuran({ jariBidang: v })} />
                <Angka label="Busur" nilai={u.busur} satuan="°" step={5} bantuan={bentuk === 'bola' ? 'Sudut pandang mendatar' : '360° = pilar / silinder'} onUbah={v => v >= 10 && v <= 360 && setUkuran({ busur: v })} />
              </div>
            )}
            {bentuk === 'bola' && (() => {
              const bl = bolaBidang(b), v = (bl.fiM * 180) / Math.PI;
              return (
                <p className="text-[12px] text-slate-600">
                  Pusat bola (mata pilot) di {f(b.elev + bl.yP)} m dari lantai. Sudut pandang {f(u.busur, 0)}° mendatar × {f(2 * v, 0)}° tegak (±{f(v, 0)}°).
                  Tinggi layar maks {f(tinggiMaksBola(u.R))} m (±75°); ubah tinggi di bagian Ukuran untuk mengatur sudut tegak.
                </p>
              );
            })()}
            <p className="text-[12px] text-slate-600">
              {bentuk === 'datar' ? `Layar ${f(u.w)} × ${f(b.h)} m.`
                : `${bentuk === 'bola' ? 'Lebar busur di tengah' : 'Panjang permukaan'} ${f(u.R * u.busur * Math.PI / 180)} m × tinggi ${f(b.h)} m · tapak ${f(u.w)} × ${f(u.d)} m.`}
              {' '}Tinggi & warna permukaan diatur di bagian Ukuran dan Warna. Arahkan proyektor ke layar ini - sinarnya jatuh mengikuti permukaannya.
            </p>
          </div>
        );
      })()}
    </>
  );
}
