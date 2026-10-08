'use client';
import { Catatan, f, Nilai } from '../../bersama/ui';
import { PX_RC_UMUM } from './data';
import { PanelCara } from './PanelCara';
import { PanelUkuranRC } from './PanelUkuranRC';
import { PanelPort } from './PanelPort';
import { KanvasKoneksi } from './KanvasKoneksi';
import { TabelPort } from './TabelPort';
import { useRuangKoneksi, type PropsRuangKoneksi } from './useRuangKoneksi';

/**
 * Screen Connection ala NovaLCT: grid receiving card, urutan kabel data per port LAN.
 * Dua cara: template cepat (pojok mulai, arah, pola S/Z, pembagian port) atau manual
 * (klik / seret receiving card berurutan per port). Ukuran receiving card bisa mengikuti
 * Kalkulator LED atau diisi bebas per kolom/baris (px); sel bisa dikosongkan untuk layar
 * yang tidak persegi.
 */

/** Ruang kerja Screen Connection (menu tersendiri di Tools Team). */

export function RuangKoneksi({ d, s, onUbah, namaFile }: PropsRuangKoneksi) {
  const a = useRuangKoneksi({ d, s, onUbah, namaFile });
  const { k, nUnit, rataBeban, resKalk, t, zona } = a;
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,300px)_minmax(0,1fr)] items-start">
      {/* ── Panel pengaturan ── */}
      <div className="space-y-3 min-w-0">
        <PanelCara a={a} />

        <PanelUkuranRC a={a} />

        <PanelPort a={a} />
      </div>

      {/* ── Kanvas & tabel ── */}
      <div className="space-y-3 min-w-0">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <Nilai label="Receiving card" nilai={k.sel.length + k.tanpaPort.length} ket={`${t.K} × ${t.B}${t.kosong.size ? ` · ${t.kosong.size} kosong` : ''}`} />
          <Nilai label="Port LAN dipakai" nilai={t.portTerpakai} ket={`perkiraan pixel: ${d.portIdeal}`} nada={t.portTerpakai > d.portIdeal ? 'awas' : undefined} />
          <Nilai label="Controller" nilai={t.ppk > 0 ? t.controller + t.controllerCadangan : '-'}
            ket={t.ppk > 0 ? `${t.ppkPenuh} port/unit${d.namaHw && s.ppk === null ? ` · ${d.namaHw}` : ''}${t.controllerCadangan ? ` · ${t.controllerCadangan} cadangan` : t.cadangan === 'loop' ? ` · ${t.ppk} utama + ${t.ppk} cadangan` : ''}` : 'isi port per controller'} />
          <Nilai label="Beban rata-rata" nilai={f(rataBeban, 0)} satuan="%" ket={`resolusi ${t.resX}×${t.resY}`} />
        </div>
        {k.galat && <p className="text-[12.5px] text-rose-800 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">{k.galat}</p>}
        {s.mode === 'manual' && k.tanpaPort.length > 0 && (
          <p className="text-[12.5px] text-amber-900 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">{k.tanpaPort.length} receiving card belum tersambung (bingkai jingga putus-putus).</p>
        )}
        {k.lewat.length > 0 && (
          <p className="text-[12.5px] text-rose-800 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">Port {k.lewat.join(', ')} melebihi batas beban {s.beban}% - pindahkan sebagian receiving card ke port lain.</p>
        )}
        {t.rc && t.rcLewat && (
          <p className="text-[12.5px] text-rose-800 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">
            Ada receiving card melebihi kapasitas {t.rc.nama} ({t.rc.w}×{t.rc.h} px). Kurangi {nUnit} per receiving card atau pilih model yang lebih besar.
          </p>
        )}
        {s.cadangan === 'loop' && t.ppkPenuh === 1 && (
          <p className="text-[12.5px] text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">Controller hanya 1 port: loop cadangan butuh port kedua. Pilih &quot;Controller&quot; atau hardware dengan port lebih banyak.</p>
        )}
        {!t.rc && Math.max(...t.lebar) * Math.max(...t.tinggi) > PX_RC_UMUM && !k.galat && (
          <p className="text-[12.5px] text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
            Ada receiving card lebih dari ±512×512 px (kapasitas receiving card umum). Kecilkan area per receiving card atau cek tipe receiving card.
          </p>
        )}
        {t.custom && (t.resX !== resKalk.x || t.resY !== resKalk.y) && (
          <p className="text-[12.5px] text-amber-800">Resolusi receiving card ({t.resX}×{t.resY}) berbeda dari layar di kalkulator ({resKalk.x}×{resKalk.y}).</p>
        )}
        {s.mode === 'template' && s.bagi === 'baris' && zona > 1 && (
          <p className="text-[12.5px] text-slate-700">Satu {s.arah === 'horizontal' ? 'baris' : 'kolom'} melebihi kapasitas port, jadi layar dibagi <b>{zona} zona</b> yang dikabel terpisah. Pilih &quot;Isi penuh&quot; untuk menghemat port.</p>
        )}
        <KanvasKoneksi a={a} />
        <TabelPort a={a} />
        <Catatan>Label sel = port-urutan receiving card, angka kecil = ukuran receiving card (px); P1, P2, … = titik masuk kabel LAN{s.cadangan !== 'tidak' ? '; B1, B2, … = kabel cadangan dari ujung rantai' : ''}. Samakan dengan NovaLCT (Screen Configuration → Screen Connection) saat instalasi.</Catatan>
      </div>
    </div>
  );
}
