'use client';

/**
 * Potongan tampilan Checklist Tools yang dipakai DUA halaman: admin
 * (/checklist) dan link share untuk tim (/checklist/share/<token>). Satu
 * tempat supaya baris item, bar progres, dan catatan bagian tidak menyimpang
 * antara yang dilihat admin dan yang dicentang tim di lapangan.
 */

import { useState, type ReactNode } from 'react';
import { Check, ChevronDown, Loader2 } from 'lucide-react';
import { NETRAL } from '@/lib/desain';
import {
  formatWaktu, hitungProgres, kelompokkan,
  type ChecklistBagian, type ChecklistItem, type Progres,
} from '@/lib/checklist';

export const TEMA = {
  warna: '#2563eb',
  warnaTua: '#1d4ed8',
  tint: '#eff6ff',
  garisTint: '#bfdbfe',
  // Tone 700 / slate-500: lolos kontras AA untuk teks kecil di latar putih
  // (standar audit tampilan platform - teks abu-abu tidak di bawah slate-500).
  selesai: '#15803d',
  selesaiTint: '#f0fdf4',
  samar: '#64748b',
} as const;

export const fontAngka = { fontVariantNumeric: 'tabular-nums' as const };

/** Bar progres. Hijau begitu 100% - satu-satunya saat warna berganti. */
export function BarProgres({ progres, tebal = 8, label = true }: { progres: Progres; tebal?: number; label?: boolean }) {
  const penuh = progres.total > 0 && progres.selesai === progres.total;
  return (
    <div className="flex items-center gap-3 min-w-0">
      <div className="flex-1 rounded-full overflow-hidden" style={{ height: tebal, background: NETRAL.garis }}
        role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progres.persen}
        aria-label={`${progres.selesai} dari ${progres.total} selesai`}>
        <div className="h-full rounded-full transition-all duration-500"
          style={{ width: `${progres.persen}%`, background: penuh ? TEMA.selesai : TEMA.warna }} />
      </div>
      {label && (
        <span className="text-xs font-bold whitespace-nowrap" style={{ ...fontAngka, color: penuh ? TEMA.selesai : NETRAL.tinta2 }}>
          {progres.selesai}/{progres.total} · {progres.persen}%
        </span>
      )}
    </div>
  );
}

// ── Catatan bagian: paragraf, poin, dan tabel pipa Markdown ────────────────

function Sebaris({ teks }: { teks: string }) {
  // Hanya **tebal** yang dirender; penanda lain sudah dibersihkan saat impor.
  const potong = teks.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {potong.map((p, i) => p.startsWith('**') && p.endsWith('**') && p.length > 4
        ? <strong key={i} className="font-bold" style={{ color: NETRAL.tinta }}>{p.slice(2, -2)}</strong>
        : <span key={i}>{p.replace(/\\([|*_#-])/g, '$1')}</span>)}
    </>
  );
}

function selTabel(baris: string): string[] {
  return baris.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(s => s.trim());
}

export function CatatanTeks({ teks }: { teks: string }) {
  if (!teks.trim()) return null;
  const baris = teks.split('\n');
  const blok: ReactNode[] = [];
  let i = 0;
  while (i < baris.length) {
    const b = baris[i].trim();
    if (!b) { i++; continue; }

    if (b.startsWith('|')) {
      const kumpulan: string[] = [];
      while (i < baris.length && baris[i].trim().startsWith('|')) { kumpulan.push(baris[i]); i++; }
      const rows = kumpulan.filter(r => !/^\|?\s*:?-{2,}/.test(r.trim())).map(selTabel);
      const [kepala, ...isi] = rows;
      blok.push(
        <div key={`t${i}`} className="overflow-x-auto rounded-lg" style={{ border: `1px solid ${NETRAL.garis}` }}>
          <table className="w-full text-[12px]">
            {kepala && (
              <thead style={{ background: NETRAL.permukaanRedam }}>
                <tr>{kepala.map((c, j) => (
                  <th key={j} className="text-left font-bold px-2.5 py-1.5 whitespace-nowrap" style={{ color: NETRAL.tinta2 }}><Sebaris teks={c} /></th>
                ))}</tr>
              </thead>
            )}
            <tbody>
              {isi.map((r, k) => (
                <tr key={k} style={{ borderTop: `1px solid ${NETRAL.garis}` }}>
                  {r.map((c, j) => <td key={j} className="px-2.5 py-1.5 align-top" style={{ color: NETRAL.tinta }}><Sebaris teks={c} /></td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }

    if (/^[-*+]\s+/.test(b)) {
      const poin: string[] = [];
      while (i < baris.length && /^[-*+]\s+/.test(baris[i].trim())) { poin.push(baris[i].trim().replace(/^[-*+]\s+/, '')); i++; }
      blok.push(
        <ul key={`u${i}`} className="list-disc pl-5 space-y-0.5 text-[13px]" style={{ color: NETRAL.tinta2 }}>
          {poin.map((p, k) => <li key={k}><Sebaris teks={p} /></li>)}
        </ul>,
      );
      continue;
    }

    const para: string[] = [];
    while (i < baris.length && baris[i].trim() && !baris[i].trim().startsWith('|') && !/^[-*+]\s+/.test(baris[i].trim())) {
      para.push(baris[i].trim()); i++;
    }
    blok.push(<p key={`p${i}`} className="text-[13px] leading-relaxed" style={{ color: NETRAL.tinta2 }}><Sebaris teks={para.join(' ')} /></p>);
  }
  return <div className="space-y-2.5">{blok}</div>;
}

// ── Baris item & panel bagian ──────────────────────────────────────────────

export function BarisItem({ item, onToggle, sedang, aksi }: {
  item: ChecklistItem;
  onToggle: (item: ChecklistItem) => void;
  sedang: boolean;
  /** Tombol tambahan di kanan (admin: ubah/hapus). */
  aksi?: ReactNode;
}) {
  return (
    <div className="group flex items-start gap-3 px-3 sm:px-4 py-2.5 transition-colors"
      style={{ background: item.selesai ? TEMA.selesaiTint : 'transparent' }}>
      <button type="button" onClick={() => onToggle(item)} disabled={sedang}
        aria-pressed={item.selesai} aria-label={item.selesai ? `Batalkan centang: ${item.teks}` : `Centang: ${item.teks}`}
        className="mt-0.5 w-6 h-6 sm:w-5 sm:h-5 rounded-md flex items-center justify-center flex-shrink-0 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 disabled:opacity-60"
        style={{
          background: item.selesai ? TEMA.selesai : NETRAL.permukaan,
          border: `1.5px solid ${item.selesai ? TEMA.selesai : NETRAL.garisKuat}`,
          color: '#fff',
        }}>
        {sedang ? <Loader2 size={13} className="animate-spin" style={{ color: item.selesai ? '#fff' : TEMA.warna }} />
          : item.selesai ? <Check size={14} strokeWidth={3} /> : null}
      </button>
      <div className="flex-1 min-w-0">
        <p className="text-[13.5px] leading-snug" style={{
          color: item.selesai ? NETRAL.tinta2 : NETRAL.tinta,
          textDecoration: item.selesai ? 'line-through' : 'none',
          textDecorationColor: TEMA.samar,
        }}>{item.teks}</p>
        {item.catatan && (
          <p className="text-[12px] mt-0.5 whitespace-pre-line" style={{ color: TEMA.samar }}>{item.catatan}</p>
        )}
        {item.selesai && item.selesai_oleh && (
          <p className="text-[11px] mt-1 font-semibold" style={{ color: TEMA.selesai }}>
            ✓ {item.selesai_oleh} · {formatWaktu(item.selesai_pada)}
            {item.selesai_lewat === 'link' ? ' · via link' : ''}
          </p>
        )}
      </div>
      {aksi && <div className="flex items-center gap-1 flex-shrink-0">{aksi}</div>}
    </div>
  );
}

export function PanelBagian({
  bagian, items, onToggle, sedangId, sembunyikanSelesai = false,
  aksiItem, aksiKepala, kaki, terbukaAwal = true,
}: {
  bagian: ChecklistBagian;
  items: ChecklistItem[];
  onToggle: (item: ChecklistItem) => void;
  sedangId: string | null;
  sembunyikanSelesai?: boolean;
  aksiItem?: (item: ChecklistItem) => ReactNode;
  aksiKepala?: ReactNode;
  kaki?: ReactNode;
  terbukaAwal?: boolean;
}) {
  const [terbuka, setTerbuka] = useState(terbukaAwal);
  const [lihatCatatan, setLihatCatatan] = useState(false);
  const progres = hitungProgres(items);
  const tampil = sembunyikanSelesai ? items.filter(i => !i.selesai) : items;
  const grup = kelompokkan(tampil);

  return (
    <section className="rounded-xl overflow-hidden" style={{ background: NETRAL.permukaan, border: `1px solid ${NETRAL.garis}` }}>
      <div className="flex items-center gap-2 px-3 sm:px-4 py-3" style={{ borderBottom: terbuka ? `1px solid ${NETRAL.garis}` : 'none' }}>
        <button type="button" onClick={() => setTerbuka(v => !v)} aria-expanded={terbuka}
          className="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-4 text-left">
          <span className="flex items-center gap-2 min-w-0 sm:w-[45%]">
            <ChevronDown size={16} className="flex-shrink-0 transition-transform" style={{ transform: terbuka ? 'none' : 'rotate(-90deg)', color: TEMA.samar }} />
            <span className="font-bold text-[14px] truncate" style={{ color: NETRAL.tinta }}>{bagian.judul}</span>
          </span>
          <span className="flex-1 min-w-0 pl-6 sm:pl-0">
            {progres.total > 0
              ? <BarProgres progres={progres} tebal={6} />
              : <span className="text-[11px] font-semibold" style={{ color: TEMA.samar }}>Catatan saja · tanpa item</span>}
          </span>
        </button>
        {aksiKepala}
      </div>

      {terbuka && (
        <div>
          {bagian.catatan && (
            <div className="px-3 sm:px-4 py-2.5" style={{ background: NETRAL.permukaanRedam, borderBottom: `1px solid ${NETRAL.garis}` }}>
              {progres.total === 0 || lihatCatatan ? (
                <>
                  <CatatanTeks teks={bagian.catatan} />
                  {progres.total > 0 && (
                    <button type="button" onClick={() => setLihatCatatan(false)} className="mt-2 text-[11px] font-bold" style={{ color: TEMA.warna }}>
                      Sembunyikan catatan
                    </button>
                  )}
                </>
              ) : (
                <button type="button" onClick={() => setLihatCatatan(true)} className="text-[11.5px] font-bold" style={{ color: TEMA.warna }}>
                  Lihat catatan & tabel bagian ini
                </button>
              )}
            </div>
          )}

          {grup.map(g => (
            <div key={g.kelompok || '_'}>
              {g.kelompok && (
                <p className="px-3 sm:px-4 pt-3 pb-1 text-[11px] font-bold uppercase tracking-wider" style={{ color: TEMA.warnaTua }}>
                  {g.kelompok}
                </p>
              )}
              <div className="divide-y" style={{ borderColor: NETRAL.garis }}>
                {g.items.map(it => (
                  <BarisItem key={it.id} item={it} onToggle={onToggle} sedang={sedangId === it.id} aksi={aksiItem?.(it)} />
                ))}
              </div>
            </div>
          ))}

          {sembunyikanSelesai && progres.total > 0 && tampil.length === 0 && (
            <p className="px-4 py-3 text-[12px] font-semibold" style={{ color: TEMA.selesai }}>Semua item di bagian ini sudah selesai.</p>
          )}
          {kaki}
        </div>
      )}
    </section>
  );
}

/** Item dikelompokkan per bagian, urut sesuai urutan bagian lalu urutan item. */
export function itemPerBagian(bagian: ChecklistBagian[], items: ChecklistItem[]): Map<string, ChecklistItem[]> {
  const peta = new Map<string, ChecklistItem[]>(bagian.map(b => [b.id, []]));
  for (const it of [...items].sort((a, b) => a.urutan - b.urutan)) peta.get(it.bagian_id)?.push(it);
  return peta;
}
