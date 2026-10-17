'use client';
/**
 * Pratinjau Product Comparison (HTML, meniru template PDF) - klik teks / sel untuk mengoreksi sebelum diunduh.
 * Sel 'cek' disorot kuning: PDF baru bisa diunduh setelah semuanya diputuskan.
 */
import { useState } from 'react';
import { type KartuBanding, LABEL, type NilaiSpek, potongTebal, teksNilai } from '@/lib/perbandingan';
import { EditorIsi, type Sunting } from './EditorIsi';

const pt = (v: number) => `${(v * 1.333).toFixed(1)}px`;
const F = 'Arial, "Liberation Sans", Arimo, Helvetica, sans-serif';

function Kaya({ s, warnaTebal }: { s: string; warnaTebal?: string }) {
  return <>{potongTebal(s).map((p, i) => (p.tebal ? <b key={i} style={warnaTebal ? { color: warnaTebal } : undefined}>{p.t}</b> : <span key={i}>{p.t}</span>))}</>;
}

export function PratinjauKartu({ k, ubah, bolehEdit = true }: { k: KartuBanding; ubah: (k: KartuBanding) => void; bolehEdit?: boolean }) {
  const [sunting, setSunting] = useState<Sunting | null>(null);
  const L = LABEL[k.bahasa], n = k.produk.length;
  const ed = (judul: string, nilai: string, simpan: (v: string) => void, panjang = false, hapus?: () => void) =>
    bolehEdit ? { onClick: () => setSunting({ jenis: 'teks', judul, nilai, panjang, simpan, hapus }), className: 'cursor-text hover:outline-solid hover:outline-1 hover:outline-blue-400 rounded-xs' } : {};
  const ganti = (f: (d: KartuBanding) => void) => { const d = structuredClone(k); f(d); ubah(d); };
  const sel = (v: NilaiSpek, j: number) => {
    const t = teksNilai(v, k.bahasa);
    if (v.status === 'tidak-disebut') return <i style={{ color: '#a4acb8' }}>{t}</i>;
    if (v.unggul) return <b style={{ color: j === 0 ? '#a80f28' : '#1c2733' }}>{t} <span style={{ color: '#16803c' }}>✓</span></b>;
    return <span>{t}</span>;
  };
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-slate-100 p-3">
      <div className="mx-auto bg-white shadow-xs" style={{ width: pt(595.28), padding: `${pt(51)} ${pt(45.68)} ${pt(34)}`, fontFamily: F, color: '#1c2733' }}>
        <header style={{ background: 'linear-gradient(135deg,#0a1f38,#1b4972)', borderRadius: pt(7), padding: `${pt(15)} ${pt(18)} ${pt(18)}` }}>
          <p {...ed('Kategori', k.kategori, v => ganti(d => { d.kategori = v; }))} style={{ color: '#7fd0ff', fontWeight: 700, fontSize: pt(8.3), letterSpacing: pt(1), textTransform: 'uppercase' }}>{k.kategori || '—'}</p>
          <h3 {...ed('Judul', k.judul, v => ganti(d => { d.judul = v; }))} style={{ color: '#fff', fontWeight: 700, fontSize: pt(18.5), marginTop: pt(5) }}>{k.judul}</h3>
          <p {...ed('Pengantar', k.pengantar, v => ganti(d => { d.pengantar = v; }), true)} style={{ color: '#c6d6e6', fontSize: pt(8.6), lineHeight: 1.56, marginTop: pt(4), maxWidth: pt(440) }}>{k.pengantar}</p>
        </header>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${n}, 1fr)`, gap: pt(9), marginTop: pt(7.7) }}>
          {k.produk.map((p, i) => (
            <div key={i} style={{ background: i === 0 ? '#fdf4f6' : '#f6f9fb', border: `1px solid ${i === 0 ? '#efd3d8' : '#e1e6eb'}`, borderTop: `3px solid ${i === 0 ? '#efd3d8' : '#9aa5b1'}`, borderRadius: pt(5), padding: `${pt(10)} ${pt(11.2)} ${pt(12)}` }}>
              <div className="flex items-center justify-between gap-2">
                <span {...ed('Merek', p.merek, v => ganti(d => { d.produk[i].merek = v; }))} style={{ color: i === 0 ? '#c8102e' : '#8b93a0', fontWeight: 700, fontSize: pt(7.6), letterSpacing: pt(0.9), textTransform: 'uppercase' }}>{p.merek || '—'}</span>
                {i === 0 && <span style={{ background: '#c80f2d', color: '#fff', fontWeight: 700, fontSize: pt(6.6), borderRadius: 999, padding: `${pt(2)} ${pt(7)}`, letterSpacing: pt(0.5) }}>{L.rekomendasiPil}</span>}
              </div>
              <p {...ed('Judul kartu', p.judulKartu, v => ganti(d => { d.produk[i].judulKartu = v; }))} style={{ fontWeight: 700, fontSize: pt(12), color: '#14202c', marginTop: pt(4) }}>{p.judulKartu || p.nama}</p>
              <p {...ed('Deskripsi produk', p.deskripsi, v => ganti(d => { d.produk[i].deskripsi = v; }), true)} style={{ fontSize: pt(8), color: '#4c5867', lineHeight: 1.52, marginTop: pt(4) }}>{p.deskripsi}</p>
            </div>
          ))}
        </div>
        {k.bagian.map((b, bi) => (
          <section key={bi} style={{ marginTop: pt(13.2) }}>
            <div className="flex items-center" style={{ gap: pt(6) }}>
              <span style={{ background: '#163b5d', color: '#fff', width: pt(13.5), height: pt(13.5), borderRadius: pt(3), fontSize: pt(8.3), fontWeight: 700 }} className="grid place-items-center">{bi + 1}</span>
              <span {...ed('Judul bagian', b.judul, v => ganti(d => { d.bagian[bi].judul = v; }))} style={{ fontWeight: 700, fontSize: pt(11), color: '#14202c' }}>{b.judul}</span>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: pt(5.7), fontSize: pt(8.4), tableLayout: 'fixed' }}>
              <colgroup><col style={{ width: '30%' }} />{k.produk.map((_, j) => <col key={j} style={{ width: `${70 / n}%` }} />)}</colgroup>
              <thead><tr>
                {[L.spesifikasi, ...k.produk.map(p => p.nama)].map((h, j) => (
                  <th key={j} style={{ background: j === 0 ? '#131f2b' : j === 1 ? '#c80f2d' : '#3a4656', color: '#fff', fontSize: pt(7.6), letterSpacing: pt(0.6), textAlign: 'left', padding: `0 ${pt(6.7)}`, height: pt(20), textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>{b.baris.map((r, ri) => (
                <tr key={ri} style={{ borderTop: ri ? '1px solid #e6e9ed' : undefined }}>
                  <td {...ed('Spesifikasi', r.spesifikasi, v => ganti(d => { d.bagian[bi].baris[ri].spesifikasi = v; }), false, () => ganti(d => { d.bagian[bi].baris.splice(ri, 1); }))}
                    style={{ background: ri % 2 ? '#f4f6f9' : '#fff', fontWeight: 700, color: '#253444', padding: `${pt(4.4)} ${pt(6.7)}`, verticalAlign: 'top' }}>{r.spesifikasi}</td>
                  {r.nilai.map((v, j) => (
                    <td key={j} title={v.bukti?.kutipan ? `Sumber${v.bukti.halaman ? ` hal. ${v.bukti.halaman}` : ''}: ${v.bukti.kutipan}` : v.alasanCek}
                      onClick={bolehEdit ? () => setSunting({ jenis: 'nilai', judul: r.spesifikasi, nilai: v, produk: k.produk[j].nama, bahasa: k.bahasa, bolehUnggul: true, simpan: x => ganti(d => { d.bagian[bi].baris[ri].nilai[j] = x; }) }) : undefined}
                      className={bolehEdit ? 'cursor-pointer hover:outline-solid hover:outline-1 hover:outline-blue-400' : ''}
                      style={{ background: v.status === 'cek' ? '#fef3c7' : j === 0 ? (ri % 2 ? '#fbe6e8' : '#fdf0f2') : ri % 2 ? '#f4f6f9' : '#fff', padding: `${pt(4.4)} ${pt(6.7)}`, verticalAlign: 'top', lineHeight: 1.45 }}>
                      {sel(v, j)}{v.status === 'cek' && <span className="block text-[11px] font-semibold text-amber-700">Perlu dicek</span>}
                    </td>
                  ))}
                </tr>
              ))}</tbody>
            </table>
          </section>
        ))}
        <section style={{ marginTop: pt(13.6), background: '#fff8f8', border: '1.6px solid #c80f2d', borderRadius: pt(6), padding: pt(13.1) }}>
          <h4 style={{ color: '#a80f28', fontWeight: 700, fontSize: pt(12.5) }}>{L.ringkasan}</h4>
          <p {...ed('Ringkasan', k.ringkasan, v => ganti(d => { d.ringkasan = v; }), true)} style={{ color: '#33404d', fontSize: pt(8.7), lineHeight: 1.57, marginTop: pt(6) }}><Kaya s={k.ringkasan} /></p>
          {k.sorotan.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${k.sorotan.length}, 1fr)`, gap: pt(7.5), marginTop: pt(9) }}>
              {k.sorotan.map((s, i) => (
                <div key={i} style={{ background: '#fff', border: '1px solid #efd3d8', borderRadius: pt(4), padding: pt(8.3) }}>
                  <p {...ed('Judul sorotan', s.judul, v => ganti(d => { d.sorotan[i].judul = v; }))} style={{ color: '#a80f28', fontWeight: 700, fontSize: pt(8.2) }}>{s.judul}</p>
                  <p {...ed('Isi sorotan', s.teks, v => ganti(d => { d.sorotan[i].teks = v; }), true)} style={{ color: '#47535f', fontSize: pt(7.7), lineHeight: 1.45, marginTop: pt(3) }}>{s.teks}</p>
                </div>
              ))}
            </div>
          )}
          <p {...ed('Rekomendasi', k.rekomendasi, v => ganti(d => { d.rekomendasi = v; }), true)} style={{ background: '#131f2b', color: '#fff', borderRadius: pt(4), padding: `${pt(7)} ${pt(9)}`, fontSize: pt(8.4), lineHeight: 1.55, marginTop: pt(7.5) }}>
            <b style={{ color: '#ff8a9b' }}>{L.rekomendasi}</b> <Kaya s={k.rekomendasi} warnaTebal="#ff8a9b" />
          </p>
          <p {...ed('Catatan', k.catatan, v => ganti(d => { d.catatan = v; }), true)} style={{ color: '#9aa4b0', fontSize: pt(7), lineHeight: 1.49, marginTop: pt(7) }}>{L.catatan} {k.catatan}</p>
        </section>
      </div>
      {sunting && <EditorIsi s={sunting} tutup={() => setSunting(null)} />}
    </div>
  );
}
