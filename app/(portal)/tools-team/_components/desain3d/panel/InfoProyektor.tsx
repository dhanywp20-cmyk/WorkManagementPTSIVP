'use client';
/** Panel proyektor (Atur benda): jarak lempar, ukuran gambar, tombol mengepaskan ke layar, kontras vs lampu. */
import { type Benda, cakupanProyektor, permukaanBenda, kotakGrid, labelKotakGrid, PILIHAN_KOLOM_GRID, warnaSah, warnaSinarProyektor, kontrasProyektor, layarTerdekat, lumenDari, LUX_PRESET, proyektorKeLayar, ruangDari, sinarProyektor, TARGET_KONTRAS, tiltDari, tiltKeLayar, zoomLensa } from '../inti';
import { f, Catatan } from '../../bersama/ui';
import type { KeadaanDesain } from '../useKeadaanDesain';

export function InfoProyektor({ p, K }: { p: Benda; K: KeadaanDesain }) {
  const { benda, gantiBenda, gridSinar, infoBlending, kotakRuang, ruang, setGridSinar, setRuang, setTargetKontras, tampilBlending, targetKontras } = K;
  /**
   * Sinar SEBENARNYA dari lensa (inti/cakupanProyektor.ts): ikut keystone saat menunduk & lengkung layar - angka
   * "pas" di bawahnya memakai gambar persegi ideal. Sasaran = layar proyektor ini, atau bidang mapping yang paling
   * banyak disinarinya; dihitung bersama semua proyektor yang menyinari sasaran yang sama (blending).
   */
  const blokSinarSebenarnya = (layar: Benda | null) => {
    const semuaP = benda.filter(b => b.jenis === 'proyektor');
    const calon = layar ? [layar] : benda.filter(b => b.jenis === 'bidang' && ruangDari(ruang, b.x) === ruangDari(ruang, p.x));
    let pilih: { s: Benda; c: ReturnType<typeof cakupanProyektor>; i: number } | null = null;
    for (const s of calon) {
      const P = permukaanBenda(s);
      const ikut = semuaP.filter(q => (layar ? sinarProyektor(q, benda, ruang).layar?.id === s.id : true));
      const c = cakupanProyektor(ikut, P);
      const i = ikut.findIndex(q => q.id === p.id);
      if (i < 0 || c.meleset[i] >= 0.95) continue;
      if (!pilih || c.meleset[i] < pilih.c.meleset[pilih.i]) pilih = { s, c, i };
    }
    if (!pilih) return null;
    const { s, c, i } = pilih, baik = c.tertutup >= 0.99 && c.meleset[i] <= 0.05;
    const pr = (n: number) => `${f(n * 100, 0)}%`;
    return (
      <p className={`text-[12px] font-semibold leading-relaxed ${baik ? 'text-emerald-700' : 'text-amber-700'}`}>
        Sinar sebenarnya: {s.nama} tertutup {pr(c.tertutup)}{c.celah.length && c.tertutup < 0.99 ? ` (celah ${c.celah.join(', ')})` : ''}, cahaya proyektor ini meleset {pr(c.meleset[i])}
        {c.tumpang > 0.01 ? `, area blending ${pr(c.tumpang)}` : ''}.
        {Math.abs(tiltDari(p)) > 1 && layar ? ' Gambar trapesium karena menunduk - Posisikan otomatis memasang proyektor lurus.' : ''}
        {c.meleset[i] > 0.05 && !layar ? ' Cahaya di luar bidang perlu di-mask di media server.' : ''}
      </p>
    );
  };
  /**
   * Mask ke bidang: tampilkan cahaya hanya di layar / bidang mapping - seperti hasil masking & warping di media
   * server. Mati = sinar mentah proyektor (termasuk yang tumpah ke dinding), untuk merencanakan posisi & masking.
   */
  const blokMask = () => {
    if (!benda.some(b => (b.jenis === 'bidang' || b.jenis === 'layar') && ruangDari(ruang, b.x) === ruangDari(ruang, p.x))) return null;
    return (
      <label className="flex items-start gap-2 rounded-lg border border-slate-200 bg-white p-2 text-[12px] text-slate-700 cursor-pointer">
        <input type="checkbox" className="w-4 h-4 mt-0.5" checked={!!p.maskBidang} onChange={e => gantiBenda({ ...p, maskBidang: e.target.checked || undefined })} />
        <span><b className="text-slate-800">Mask ke bidang</b> - tampilkan cahaya hanya di layar / bidang mapping, seperti hasil masking di media server. Matikan untuk melihat sinar mentah yang tumpah.</span>
      </label>
    );
  };
  /** Grid cahaya (seperti simulator proyektor): nyala/mati, jumlah kolom, warna garis, ukuran satu kotak (mm) di permukaan. */
  const blokGrid = (lebar: number, tinggi: number) => {
    const kg = kotakGrid(lebar, tinggi, p.gridKolom);
    const semuaP = benda.filter(b => b.jenis === 'proyektor');
    const warnaAwal = warnaSinarProyektor(p, Math.max(0, semuaP.findIndex(x => x.id === p.id)), semuaP.length);
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-2 space-y-1.5">
        <label className="flex items-center justify-between text-[12px] font-bold text-slate-800">
          Grid cahaya
          <input type="checkbox" className="w-4 h-4" checked={gridSinar} onChange={e => setGridSinar(e.target.checked)} />
        </label>
        <p className="text-[12.5px] font-bold tabular-nums" style={{ color: warnaSah(p.warnaGrid) ?? warnaAwal }}>{labelKotakGrid(kg)}</p>
        <div className="flex flex-wrap items-center gap-1">
          {PILIHAN_KOLOM_GRID.map(k => (
            <button key={k} type="button" onClick={() => gantiBenda({ ...p, gridKolom: k })} title={`${k} kolom`}
              className={`px-2 py-0.5 rounded-md text-[11.5px] font-semibold border ${kg.kolom === k ? 'bg-blue-700 border-blue-700 text-white' : 'border-slate-200 text-slate-700 hover:bg-slate-50'}`}>{k}</button>
          ))}
          <span className="text-[11px] text-slate-500 ml-0.5">kolom · {kg.kolom} × {kg.baris}</span>
        </div>
        <div className="flex items-center gap-2">
          <input type="color" aria-label="Warna grid" value={warnaSah(p.warnaGrid) ?? warnaAwal} onChange={e => gantiBenda({ ...p, warnaGrid: e.target.value })}
            className="h-7 w-10 rounded-md border border-slate-200 bg-white p-0.5 cursor-pointer" />
          <span className="text-[11.5px] text-slate-600">{warnaSah(p.warnaGrid) ? 'Warna grid' : 'Warna grid = warna sinar'}</span>
          {warnaSah(p.warnaGrid) && <button type="button" onClick={() => gantiBenda({ ...p, warnaGrid: undefined })} className="ml-auto text-[11px] font-semibold text-slate-500 hover:text-slate-800">Otomatis</button>}
        </div>
      </div>
    );
  };
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
      <Catatan>Isi persen ini di pengaturan edge blending (software / processor); umumnya 10-25% dari lebar / tinggi gambar.</Catatan>
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
          <div className="rounded-md bg-slate-50 px-1 py-1"><Catatan>Gambar</Catatan><p className="text-[13px] font-extrabold text-slate-900 tabular-nums">{f(kp.luxGambar, 0)} lux</p></div>
          <div className="rounded-md bg-slate-50 px-1 py-1"><Catatan>Lampu di {kePermukaan ? 'permukaan' : 'layar'}</Catatan><p className="text-[13px] font-extrabold text-slate-900 tabular-nums">{f(kp.cahaya.total, 0)} lux</p></div>
          <div className="rounded-md bg-slate-50 px-1 py-1"><Catatan>Kontras</Catatan><p className={`text-[13px] font-extrabold tabular-nums ${warna}`}>{f(kp.kontras, 1)} : 1</p></div>
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
      const cahaya = K.ukuranCahaya[p.id];
      return (
        <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-2.5 space-y-2">
          {cahaya?.permukaan
            ? <p className="text-[12px] text-slate-700 leading-relaxed">Ke <b>{cahaya.permukaan}</b>: gambar ±{f(cahaya.lebar)} × {f(cahaya.tinggi)} m, tilt {f(tiltDari(p), 1)}°.</p>
            : <p className="text-[12px] text-slate-700 leading-relaxed">Ke dinding: jarak {f(sn.jarak)} m, gambar {f(sn.lebar)} × {f(sn.tinggi)} m.</p>}
          {blokSinarSebenarnya(null)}
          {dekat
            ? <button type="button" className={tombolKecil} onClick={() => gantiBenda(proyektorKeLayar(p, dekat, k, ruang))}>Arahkan ke {dekat.nama}</button>
            : !cahaya?.permukaan && <p className="text-[12px] text-slate-600" title="Tambah → Display → Layar proyektor">Belum ada layar</p>}
          {blokMask()}
          {blokGrid(K.ukuranCahaya[p.id]?.lebar ?? sn.lebar, K.ukuranCahaya[p.id]?.tinggi ?? sn.tinggi)}
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
        {blokSinarSebenarnya(lyr)}
        {!pasLebar && (zoomBisa ? (
          <button type="button" className={tombolKecil} onClick={() => gantiBenda({ ...p, throwRatio: Math.round(trPas * 100) / 100 })}>
            Zoom pas ke layar (TR {f(trPas, 2)} : 1)
          </button>
        ) : (
          <p className="text-[12px] font-semibold text-amber-700">
            TR {f(trPas, 2)} di luar rentang zoom lensa ({f(zMin, 2)}–{f(zMax, 2)}): pindahkan lensa ke jarak {f(zMin * lyr.w)}–{f(zMax * lyr.w)} m dari layar, atau ganti lensa.
          </p>
        ))}
        {blokMask()}
          {blokGrid(K.ukuranCahaya[p.id]?.lebar ?? sn.lebar, K.ukuranCahaya[p.id]?.tinggi ?? sn.tinggi)}
        {blokKontras(p, false)}
        {blokBlending}
        <ul className="text-[12px] font-semibold space-y-0.5">
          <li className={pasLebar ? 'text-emerald-700' : 'text-amber-700'}>
            {pasLebar ? 'Lebar gambar pas.' : selisih > 0 ? `Gambar melebihi lebar layar ${f(sn.lebar - lyr.w)} m.` : `Gambar kurang ${f(lyr.w - sn.lebar)} m dari lebar layar.`}
          </li>
          <li className={pasTinggi ? 'text-emerald-700' : 'text-amber-700'}>
            {pasTinggi ? 'Tinggi gambar pas di tengah layar.' : sv > 0
              ? `Gambar ${cm(sv)} terlalu tinggi - turunkan proyektor (drop pole) / lens shift; menunduk membuat gambar trapesium.`
              : `Gambar ${cm(sv)} terlalu rendah - naikkan proyektor / lens shift.`}
          </li>
          {!pasSamping && <li className="text-amber-700">Gambar bergeser {cm(sh)} ke {sh > 0 ? 'kanan' : 'kiri'} - atur pan.</li>}
        </ul>
        {!(pasLebar && pasTinggi && pasSamping && Math.abs(tiltDari(p)) <= 1) && (
          <div className="flex gap-1.5 flex-wrap">
            {!pasTinggi && <button type="button" className={tombolKecil} onClick={() => gantiBenda(tiltKeLayar(p, lyr, ruang))}>Atur tilt otomatis</button>}
            {!pasLebar && <button type="button" className={tombolKecil} onClick={() => gantiBenda({ ...p, throwRatio: Math.round((sn.trPas ?? 1.5) * 100) / 100 })}>Pakai throw ratio {f(sn.trPas ?? 0)}</button>}
            <button type="button" className={tombolKecil} onClick={() => gantiBenda(proyektorKeLayar(p, lyr, k, ruang))}
              title="Proyektor lurus (tanpa keystone), jarak & zoom sesuai lensa, tinggi diatur (drop pole)">Posisikan otomatis (lurus, tanpa keystone)</button>
          </div>
        )}
      </div>
    );
}
