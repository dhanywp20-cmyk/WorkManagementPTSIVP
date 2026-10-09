'use client';

/**
 * Potongan tampilan Project Progress (berbasis checklist) yang dipakai di
 * aplikasi (/project-progress) dan di link share (/checklist/share/<token>,
 * /project-progress/share/<token>). Satu tempat supaya baris item, bar
 * progres, kendala, dan catatan bagian tidak menyimpang antara yang dilihat
 * admin dan yang dicentang tim di lapangan.
 */

import { useRef, useState, type ReactNode } from 'react';
import { AlertTriangle, Camera, Check, ChevronDown, Loader2 } from 'lucide-react';
import { NETRAL } from '@/lib/desain';
import { compressImage } from '@/lib/image-compress';
import { Modal, TombolModal } from '@/components/shared';
import {
  BATAS, formatWaktu, kelompokkan, statDari,
  type ChecklistBagian, type ChecklistItem, type Progres, type StatChecklist,
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
  kendala: '#b45309',
  kendalaTint: '#fffbeb',
  kendalaGaris: '#fde68a',
  bahaya: '#b91c1c',
  samar: '#64748b',
} as const;

export const fontAngka = { fontVariantNumeric: 'tabular-nums' as const };

export function progresDariStat(s: StatChecklist): Progres {
  return { selesai: s.selesai, total: s.total, persen: s.total ? Math.round((s.selesai / s.total) * 100) : 0 };
}

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

/** Keping jumlah kendala - hanya tampil bila ada, supaya yang bermasalah menonjol. */
export function KepingKendala({ jumlah }: { jumlah: number }) {
  if (!jumlah) return null;
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold whitespace-nowrap"
      style={{ background: TEMA.kendalaTint, color: TEMA.kendala, border: `1px solid ${TEMA.kendalaGaris}` }}>
      <AlertTriangle size={12} /> {jumlah} kendala
    </span>
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

export interface AksiItem {
  /** Centang / batal. Tanpa ini kotak centang tampil hanya-baca. */
  onToggle?: (item: ChecklistItem) => void;
  /** Buka form kendala untuk item ini. */
  onKendala?: (item: ChecklistItem) => void;
  /** Unggah foto bukti. */
  onFoto?: (item: ChecklistItem, file: File) => void;
  /** Tombol tambahan di kanan (mis. ubah/hapus item). */
  aksiTambahan?: (item: ChecklistItem) => ReactNode;
}

export function BarisItem({ item, sedang, aksi }: { item: ChecklistItem; sedang: boolean; aksi: AksiItem }) {
  const inputFoto = useRef<HTMLInputElement>(null);
  const bisaCentang = !!aksi.onToggle;
  const latar = item.selesai ? TEMA.selesaiTint : item.kendala ? TEMA.kendalaTint : 'transparent';

  return (
    <div className="group flex items-start gap-3 px-3 sm:px-4 py-2.5 transition-colors"
      style={{ background: latar, boxShadow: item.tertunda ? `inset 3px 0 0 ${TEMA.warna}` : undefined }}>
      <button type="button" onClick={() => aksi.onToggle?.(item)} disabled={sedang || !bisaCentang}
        aria-pressed={item.selesai} aria-label={item.selesai ? `Batalkan centang: ${item.teks}` : `Centang: ${item.teks}`}
        className="mt-0.5 w-6 h-6 sm:w-5 sm:h-5 rounded-md flex items-center justify-center flex-shrink-0 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 disabled:cursor-default"
        style={{
          background: item.selesai ? TEMA.selesai : NETRAL.permukaan,
          border: `1.5px solid ${item.selesai ? TEMA.selesai : item.kendala ? TEMA.kendala : NETRAL.garisKuat}`,
          color: '#fff',
          opacity: !bisaCentang && !item.selesai ? 0.6 : 1,
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
        {item.tertunda && (
          <p className="text-[11px] font-bold uppercase tracking-wide mt-0.5" style={{ color: TEMA.warna }}>Belum disimpan</p>
        )}
        {item.catatan && (
          <p className="text-[12px] mt-0.5 whitespace-pre-line" style={{ color: TEMA.samar }}>{item.catatan}</p>
        )}
        {item.kendala && !item.selesai && (
          <div className="mt-1.5 rounded-lg px-2.5 py-1.5 text-[12px]"
            style={{ background: '#fff', border: `1px solid ${TEMA.kendalaGaris}`, color: TEMA.kendala }}>
            <p className="font-bold flex items-center gap-1"><AlertTriangle size={12} /> Kendala</p>
            <p className="whitespace-pre-line" style={{ color: NETRAL.tinta }}>{item.kendala_catatan}</p>
            {item.kendala_oleh && (
              <p className="text-[11px] mt-0.5 font-semibold">{item.kendala_oleh} · {formatWaktu(item.kendala_pada)}</p>
            )}
          </div>
        )}
        {item.selesai && item.selesai_oleh && (
          <p className="text-[11px] mt-1 font-semibold" style={{ color: TEMA.selesai }}>
            ✓ {item.selesai_oleh} · {formatWaktu(item.selesai_pada)}
            {item.selesai_lewat === 'link' ? ' · via link' : ''}
          </p>
        )}
        {item.foto_url && (
          <a href={item.foto_url} target="_blank" rel="noopener noreferrer" className="inline-block mt-1.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={item.foto_thumb_url ?? item.foto_url} alt={`Foto bukti: ${item.teks}`} loading="lazy"
              className="w-16 h-16 object-cover rounded-md" style={{ border: `1px solid ${NETRAL.garis}` }} />
          </a>
        )}
      </div>

      {(aksi.onKendala || aksi.onFoto || aksi.aksiTambahan) && (
        <div className="flex items-center gap-0.5 flex-shrink-0">
          {aksi.onKendala && (
            <button type="button" onClick={() => aksi.onKendala?.(item)} aria-label={`Kendala: ${item.teks}`} title="Tandai / ubah kendala"
              className="p-1.5 rounded-md hover:bg-amber-50" style={{ color: item.kendala && !item.selesai ? TEMA.kendala : TEMA.samar }}>
              <AlertTriangle size={15} />
            </button>
          )}
          {aksi.onFoto && (
            <>
              <button type="button" onClick={() => inputFoto.current?.click()} aria-label={`Foto bukti: ${item.teks}`} title="Foto bukti"
                className="p-1.5 rounded-md hover:bg-slate-100" style={{ color: item.foto_url ? TEMA.warna : TEMA.samar }}>
                <Camera size={15} />
              </button>
              <input ref={inputFoto} type="file" accept="image/*" capture="environment" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) aksi.onFoto?.(item, f); e.target.value = ''; }} />
            </>
          )}
          {aksi.aksiTambahan?.(item)}
        </div>
      )}
    </div>
  );
}

export function PanelBagian({
  bagian, items, sedangId, sembunyikanSelesai = false, aksi, aksiKepala, kaki, terbukaAwal = true,
}: {
  bagian: ChecklistBagian;
  items: ChecklistItem[];
  sedangId: string | null;
  sembunyikanSelesai?: boolean;
  aksi: AksiItem;
  aksiKepala?: ReactNode;
  kaki?: ReactNode;
  terbukaAwal?: boolean;
}) {
  const [terbuka, setTerbuka] = useState(terbukaAwal);
  const [lihatCatatan, setLihatCatatan] = useState(false);
  const stat = statDari(items);
  const progres = progresDariStat(stat);
  const tampil = sembunyikanSelesai ? items.filter(i => !i.selesai) : items;
  const grup = kelompokkan(tampil);

  return (
    <section className="rounded-xl overflow-hidden" style={{ background: NETRAL.permukaan, border: `1px solid ${stat.kendala ? TEMA.kendalaGaris : NETRAL.garis}` }}>
      <div className="flex items-center gap-2 px-3 sm:px-4 py-3" style={{ borderBottom: terbuka ? `1px solid ${NETRAL.garis}` : 'none' }}>
        <button type="button" onClick={() => setTerbuka(v => !v)} aria-expanded={terbuka}
          className="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-4 text-left">
          <span className="flex items-center gap-2 min-w-0 sm:w-[45%]">
            <ChevronDown size={16} className="flex-shrink-0 transition-transform" style={{ transform: terbuka ? 'none' : 'rotate(-90deg)', color: TEMA.samar }} />
            <span className="font-bold text-[14px] truncate" style={{ color: NETRAL.tinta }}>{bagian.judul}</span>
            <KepingKendala jumlah={stat.kendala} />
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
                  <BarisItem key={it.id} item={it} sedang={sedangId === it.id} aksi={aksi} />
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

// ── Kendala & foto (dipakai aplikasi maupun link share) ────────────────────

/**
 * Form kendala satu item. Menandai kendala membatalkan centang selesai;
 * "Kendala selesai" melepas tandanya tanpa menyelesaikan itemnya.
 */
export function ModalKendala({ item, onTutup, onSimpan }: {
  item: ChecklistItem | null;
  onTutup: () => void;
  onSimpan: (item: ChecklistItem, kendala: boolean, catatan: string) => Promise<void>;
}) {
  const [catatan, setCatatan] = useState('');
  const [sibuk, setSibuk] = useState(false);
  const [idTerakhir, setIdTerakhir] = useState<string | null>(null);
  if (item && item.id !== idTerakhir) {
    setIdTerakhir(item.id);
    setCatatan(item.kendala ? item.kendala_catatan : '');
  }
  if (!item) return null;

  const jalankan = async (kendala: boolean) => {
    setSibuk(true);
    try { await onSimpan(item, kendala, catatan.trim()); onTutup(); }
    finally { setSibuk(false); }
  };

  return (
    <Modal buka onTutup={() => !sibuk && onTutup()} ukuran="md" ikon="⚠" tutupDiLuar={false}
      judul={item.kendala ? 'Kendala item' : 'Tandai kendala'}
      keterangan={item.teks}
      footer={<>
        <TombolModal onClick={onTutup} disabled={sibuk}>Batal</TombolModal>
        {item.kendala && (
          <TombolModal onClick={() => jalankan(false)} disabled={sibuk}>Kendala selesai</TombolModal>
        )}
        <TombolModal jenis="utama" onClick={() => jalankan(true)} disabled={sibuk || !catatan.trim()}>
          {sibuk ? 'Menyimpan…' : item.kendala ? 'Perbarui kendala' : 'Tandai kendala'}
        </TombolModal>
      </>}>
      <label className="block">
        <span className="text-[12px] font-bold" style={{ color: NETRAL.tinta2 }}>Apa kendalanya?</span>
        <textarea value={catatan} onChange={e => setCatatan(e.target.value)} rows={4} maxLength={BATAS.catatan} autoFocus
          placeholder="mis. Kabel HDMI 10 m belum datang, menunggu kiriman vendor"
          className="mt-1 w-full rounded-xl px-3 py-2 text-[14px] outline-none focus:ring-2"
          style={{ border: `1px solid ${NETRAL.garis}`, color: NETRAL.tinta }} />
      </label>
      {item.selesai && (
        <p className="mt-2 text-[12px] font-semibold" style={{ color: TEMA.kendala }}>
          Item ini sudah dicentang selesai. Menandai kendala akan membatalkan centangnya.
        </p>
      )}
    </Modal>
  );
}

/**
 * Kompres foto di peramban (full 1280px + thumb 320px, pola yang sama dengan
 * Project Progress lama untuk menekan egress), lalu kirim ke route server.
 */
export async function kirimFoto(url: string, itemId: string, file: File): Promise<ChecklistItem> {
  const [full, thumb] = await Promise.all([
    compressImage(file, { maxDim: 1280, quality: 0.7 }),
    compressImage(file, { maxDim: 320, quality: 0.6 }),
  ]);
  const form = new FormData();
  form.append('itemId', itemId);
  form.append('full', full);
  form.append('thumb', thumb);
  const res = await fetch(url, { method: 'POST', body: form, cache: 'no-store' });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || 'Gagal mengunggah foto.');
  return json.item as ChecklistItem;
}
