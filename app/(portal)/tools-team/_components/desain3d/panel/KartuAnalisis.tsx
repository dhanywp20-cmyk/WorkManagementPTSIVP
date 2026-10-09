'use client';
/** Kartu analisis tampilan: aturan 4-6-8, jarak penonton terjauh, sudut nyaman per display. */
import { Angka, Catatan, f, Kartu, Nilai, Pilih } from '../../bersama/ui';
import type { AlatDesain } from './alat';

export function KartuAnalisis({ a }: { a: AlatDesain }) {
  const { analisis, duaRuang, faktorCustom, jenisPandang, setFaktorCustom, setJenisPandang, setSudutNyaman, sudutNyaman } = a.K;
  return (
    <>
      <Kartu judul="Analisis tampilan">
        <div className="mb-3 grid grid-cols-2 sm:grid-cols-4 gap-2 max-w-3xl">
          <div className="col-span-2">
            <Pilih label="Jenis konten" nilai={jenisPandang} onUbah={setJenisPandang} opsi={[
              { v: 'umum', l: 'Umum (video, presentasi) · 8×' }, { v: 'analitis', l: 'Analitis (dokumen) · 6×' }, { v: 'detail', l: 'Detail (gambar teknik) · 4×' },
              { v: 'custom', l: 'Custom (isi faktor sendiri)' },
            ]} />
          </div>
          {jenisPandang === 'custom' && (
            <Angka label="Faktor jarak" nilai={faktorCustom} satuan="×" step={0.1} bantuan="jarak terjauh ÷ tinggi gambar"
              onUbah={v => v >= 1 && v <= 20 && setFaktorCustom(v)} />
          )}
          <Angka label="Sudut nyaman" nilai={sudutNyaman} satuan="°" step={1} bantuan="dari sumbu layar"
            onUbah={v => v >= 5 && v <= 85 && setSudutNyaman(v)} />
        </div>
        {analisis.length === 0 ? <p className="text-sm text-slate-600">Tambahkan display (videowall/LED/layar/interactive) untuk dianalisis.</p>
          : analisis.map(a => (
            <div key={a.d.id} className="mb-3 last:mb-0">
              <p className="text-sm font-semibold text-slate-800 mb-1.5">{a.d.nama}{duaRuang ? ` · Ruang ${a.ri + 1}` : ''} · {f(a.d.w)} × {f(a.d.h)} m</p>
              {a.jumlah === 0 ? <p className="text-[12.5px] text-slate-600">Tambahkan meja atau kursi di ruang ini sebagai posisi penonton.</p> : (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <Nilai label="Penonton terjauh" nilai={f(a.terjauh, 1)} satuan="m" />
                  <Nilai label="Tinggi layar perlu" nilai={f(a.tinggiPerlu)} satuan="m"
                    ket={a.cukup ? 'ukuran layar cukup' : `kurang ${f((a.tinggiPerlu - a.d.h) * 100, 0)} cm`} nada={a.cukup ? 'baik' : 'buruk'} />
                  <Nilai label="Sudut pandang maks" nilai={f(a.sudutMaks, 0)} satuan="°" ket={a.sudutMaks > sudutNyaman ? 'ada kursi terlalu menyamping' : `nyaman (≤${sudutNyaman}°)`} nada={a.sudutMaks > sudutNyaman ? 'awas' : 'baik'} />
                  {a.d.jenis === 'led' && a.d.pitch
                    ? <Nilai label="Penonton terdekat" nilai={f(a.terdekat, 1)} satuan="m" ket={a.terdekat < a.d.pitch ? `di bawah jarak min P${a.d.pitch} (${a.d.pitch} m)` : 'aman untuk pitch ini'} nada={a.terdekat < a.d.pitch ? 'buruk' : 'baik'} />
                    : <Nilai label="Penonton terdekat" nilai={f(a.terdekat, 1)} satuan="m" />}
                </div>
              )}
            </div>
          ))}
        <Catatan>Posisi penonton diambil dari kursi (atau sekeliling meja bila belum ada kursi) di ruang yang sama dengan display. Aturan 4-6-8: jarak terjauh maksimal 4/6/8× tinggi gambar untuk konten detail/analitis/umum - atau faktor custom sesuai standar proyek.</Catatan>
      </Kartu>
    </>
  );
}
