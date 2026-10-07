'use client';
/** Panel proyektor (Atur benda): jarak lempar, ukuran gambar, tombol mengepaskan ke layar, kontras vs lampu. */
import { type Benda, kontrasProyektor, layarTerdekat, lumenDari, LUX_PRESET, proyektorKeLayar, ruangDari, sinarProyektor, TARGET_KONTRAS, throwRatioDari, tiltDari, tiltKeLayar, zoomLensa } from '../inti';
import { f } from '../../bersama/ui';
import type { KeadaanDesain } from '../useKeadaanDesain';

export function InfoProyektor({ p, K }: { p: Benda; K: KeadaanDesain }) {
  const { benda, gantiBenda, infoBlending, kotakRuang, ruang, setRuang, setTargetKontras, tampilBlending, targetKontras } = K;
  /** Area blending proyektor ini dengan proyektor lain (dihitung di kanvas, mesin/blending.ts). */
  const blend = tampilBlending ? infoBlending.filter(b => b.a === p.id || b.b === p.id) : [];
  const blokBlending = blend.length ? (
    <div className="rounded-lg border border-violet-200 bg-violet-50/60 p-2 space-y-1">
      <span className="block text-[11px] font-bold uppercase tracking-wider text-violet-800">Area blending</span>
      {blend.map(b => {
        const sendiri = b.a === p.id;
        return (
          <p key={`${b.a}-${b.b}`} className="text-[12px] text-slate-700 leading-relaxed">
            Dengan <b>{sendiri ? b.namaB : b.namaA}</b> ({b.arah}): <b>{Math.round(b.lebarM * 100)} cm</b> ·{' '}
            <b>{Math.round(sendiri ? b.persenA : b.persenB)}%</b> {b.arah === 'kiri-kanan' ? 'lebar' : 'tinggi'} gambar proyektor ini
          </p>
        );
      })}
      <p className="text-[11px] text-slate-500">Isi persen ini di pengaturan edge blending (software / processor); umumnya 10-25% dari lebar / tinggi gambar.</p>
    </div>
  ) : null;
  /** Panel proyektor: jarak lempar, ukuran gambar, & tombol mengepaskan ke layar. */
  /** Kontras gambar proyektor terhadap lampu ruangan + saran lumen / dimmer. */
  const blokKontras = (p: Benda, kePermukaan: boolean) => {
    const kp = kontrasProyektor(p, benda, ruang, targetKontras);
    const warna = kp.cukup ? 'text-emerald-700' : kp.kontras >= targetKontras * 0.6 ? 'text-amber-700' : 'text-rose-700';
    //  Dimmer semua lampu agar target tercapai (lux lampu ~ sebanding dengan dimmer).
    const ambPerlu = kp.luxGambar / Math.max(0.01, targetKontras - 1);
    const dimSekarang = ruang.dimmer ?? 100;
    const luxLampu = kp.cahaya.total - kp.cahaya.siang;
    const dimPerlu = kp.cahaya.dariLampu && luxLampu > 0 ? Math.floor((((ambPerlu - kp.cahaya.siang) / luxLampu) * dimSekarang) / 5) * 5 : null;
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-2 space-y-1.5">
        <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-600">Kontras vs lampu ruangan</span>
        <select aria-label="Target kontras" value={targetKontras} onChange={e => setTargetKontras(Number(e.target.value))}
          className="block w-full min-w-0 rounded-md border border-slate-200 bg-white px-1.5 py-1 text-[11.5px] text-slate-800">
          {TARGET_KONTRAS.map(t => <option key={t.v} value={t.v}>Target {t.l} · {t.ket}</option>)}
        </select>
        <div className="grid grid-cols-3 gap-1.5 text-center">
          <div className="rounded-md bg-slate-50 px-1 py-1"><p className="text-[10.5px] text-slate-500">Gambar</p><p className="text-[13px] font-extrabold text-slate-900 tabular-nums">{f(kp.luxGambar, 0)} lux</p></div>
          <div className="rounded-md bg-slate-50 px-1 py-1"><p className="text-[10.5px] text-slate-500">Lampu di {kePermukaan ? 'permukaan' : 'layar'}</p><p className="text-[13px] font-extrabold text-slate-900 tabular-nums">{f(kp.cahaya.total, 0)} lux</p></div>
          <div className="rounded-md bg-slate-50 px-1 py-1"><p className="text-[10.5px] text-slate-500">Kontras</p><p className={`text-[13px] font-extrabold tabular-nums ${warna}`}>{f(kp.kontras, 1)} : 1</p></div>
        </div>
        <p className="text-[11.5px] text-slate-600 leading-relaxed">
          {kp.cahaya.dariLampu
            ? <>Dari {kp.cahaya.jumlahLampu} lampu (dimmer semua {dimSekarang}%): langsung {f(kp.cahaya.langsung, 0)} + pantulan ruangan {f(kp.cahaya.pantul, 0)} lux{kp.cahaya.siang > 0.5 ? <> + cahaya siang jendela {f(kp.cahaya.siang, 0)} lux</> : null}. Gambar {f(kp.luas, 1)} m² dari {lumenDari(p).toLocaleString('id-ID')} lm.</>
            : <>Belum ada lampu di desain: memakai perkiraan &quot;Cahaya ruangan {ruang.cahaya ?? 'terang'}&quot; ±{LUX_PRESET[ruang.cahaya ?? 'terang']} lux{kp.cahaya.siang > 0.5 ? <> + cahaya siang jendela {f(kp.cahaya.siang, 0)} lux</> : null}. Tambah lampu (Tambah → Interior &amp; pencahayaan) untuk hitungan nyata.</>}
        </p>
        {kp.cukup
          ? <p className="text-[12px] font-semibold text-emerald-700">Memenuhi target {targetKontras} : 1.</p>
          : (
            <div className="space-y-1">
              <p className={`text-[12px] font-semibold ${warna}`}>Di bawah target {targetKontras} : 1 - butuh proyektor ±{kp.lumenPerlu.toLocaleString('id-ID')} lm, atau kurangi cahaya lampu di {kePermukaan ? 'permukaan' : 'layar'} sampai ±{f(ambPerlu, 0)} lux.</p>
              {kp.cahaya.siang > 0.5 && (ruang.tirai ?? 0) < 100 && (
                <button type="button" onClick={() => setRuang(r => ({ ...r, tirai: 100 }))}
                  className="mr-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-bold border border-sky-200 bg-sky-50 text-sky-900 hover:bg-sky-100">
                  Tutup tirai jendela (−{f(kp.cahaya.siang, 0)} lux)
                </button>
              )}
              {dimPerlu !== null && dimPerlu < dimSekarang && (
                <button type="button" onClick={() => setRuang(r => ({ ...r, dimmer: Math.max(0, dimPerlu) }))}
                  className="px-2.5 py-1.5 rounded-lg text-[12px] font-bold border border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-100">
                  {dimPerlu <= 0 ? 'Matikan semua lampu' : `Redupkan semua lampu ke ${dimPerlu}%`}
                </button>
              )}
            </div>
          )}
      </div>
    );
  };

    const sn = sinarProyektor(p, benda, ruang);
    const k = kotakRuang[ruangDari(ruang, p.x)] ?? kotakRuang[0];
    const tombolKecil = 'px-2.5 py-1.5 rounded-lg text-[12px] font-bold border border-blue-200 bg-blue-50 text-blue-800 hover:bg-blue-100';
    const lyr = sn.layar;
    if (!lyr) {
      const dekat = layarTerdekat(p, benda, ruang);
      return (
        <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-2.5 space-y-2">
          <p className="text-[12px] text-slate-700 leading-relaxed">
            Belum menghadap layar proyektor di ruang ini - cahaya jatuh di dinding sejauh {f(sn.jarak)} m (gambar {f(sn.lebar)} × {f(sn.tinggi)} m).
          </p>
          {dekat
            ? <button type="button" className={tombolKecil} onClick={() => gantiBenda(proyektorKeLayar(p, dekat, k, ruang))}>Arahkan ke {dekat.nama}</button>
            : <p className="text-[12px] text-slate-600">Tambahkan Layar proyektor (Tambah → Display) untuk menghitung jarak lempar.</p>}
          {blokKontras(p, true)}
          {blokBlending}
        </div>
      );
    }
    const selisih = (sn.lebar - lyr.w) / lyr.w;
    const pasLebar = Math.abs(selisih) <= 0.03;
    const [zMin, zMax] = zoomLensa(p), trPas = sn.trPas ?? 0;
    const zoomBisa = trPas >= zMin - 0.005 && trPas <= zMax + 0.005;
    const sv = sn.selisihV ?? 0, sh = sn.selisihH ?? 0;
    const pasTinggi = Math.abs(sv) <= 0.03, pasSamping = Math.abs(sh) <= 0.05;
    const cm = (m: number) => `${f(Math.abs(m) * 100, 0)} cm`;
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-2.5 space-y-2">
        <p className="text-[12px] text-slate-700 leading-relaxed">
          Ke <b>{lyr.nama}</b>: jarak lempar <b>{f(sn.jarak)} m</b>, gambar {f(sn.lebar)} × {f(sn.tinggi)} m, tilt {f(tiltDari(p), 1)}°.
          {' '}Agar pas selebar layar ({f(lyr.w)} m) perlu throw ratio <b>{f(sn.trPas ?? 0)} : 1</b>.
        </p>
        {!pasLebar && (zoomBisa ? (
          <button type="button" className={tombolKecil} onClick={() => gantiBenda({ ...p, throwRatio: Math.round(trPas * 100) / 100 })}>
            Zoom pas ke layar (TR {f(trPas, 2)} : 1)
          </button>
        ) : (
          <p className="text-[12px] font-semibold text-amber-700">
            TR {f(trPas, 2)} di luar rentang zoom lensa ({f(zMin, 2)}–{f(zMax, 2)}): pindahkan lensa ke jarak {f(zMin * lyr.w)}–{f(zMax * lyr.w)} m dari layar, atau ganti lensa.
          </p>
        ))}
        {blokKontras(p, false)}
        {blokBlending}
        <ul className="text-[12px] font-semibold space-y-0.5">
          <li className={pasLebar ? 'text-emerald-700' : 'text-amber-700'}>
            {pasLebar ? 'Lebar gambar pas.' : selisih > 0 ? `Gambar melebihi lebar layar ${f(sn.lebar - lyr.w)} m.` : `Gambar kurang ${f(lyr.w - sn.lebar)} m dari lebar layar.`}
          </li>
          <li className={pasTinggi ? 'text-emerald-700' : 'text-amber-700'}>
            {pasTinggi ? 'Tinggi gambar pas di tengah layar.' : sv > 0 ? `Gambar ${cm(sv)} terlalu tinggi - tilt ke bawah (menunduk).` : `Gambar ${cm(sv)} terlalu rendah - tilt ke atas.`}
          </li>
          {!pasSamping && <li className="text-amber-700">Gambar bergeser {cm(sh)} ke {sh > 0 ? 'kanan' : 'kiri'} - atur pan.</li>}
        </ul>
        {!(pasLebar && pasTinggi && pasSamping) && (
          <div className="flex gap-1.5 flex-wrap">
            {!pasTinggi && <button type="button" className={tombolKecil} onClick={() => gantiBenda(tiltKeLayar(p, lyr, ruang))}>Atur tilt otomatis</button>}
            {!pasLebar && <button type="button" className={tombolKecil} onClick={() => gantiBenda({ ...p, throwRatio: Math.round((sn.trPas ?? 1.5) * 100) / 100 })}>Pakai throw ratio {f(sn.trPas ?? 0)}</button>}
            <button type="button" className={tombolKecil} onClick={() => gantiBenda(proyektorKeLayar(p, lyr, k, ruang))}>Posisikan otomatis ({f(throwRatioDari(p) * lyr.w)} m, pan & tilt)</button>
          </div>
        )}
      </div>
    );
}
