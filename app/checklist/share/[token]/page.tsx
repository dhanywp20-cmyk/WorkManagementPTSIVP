'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, Lock, UserRound } from 'lucide-react';
import { Modal, Toast, TombolModal, type Notif } from '@/components/shared';
import { NETRAL } from '@/lib/desain';
import {
  BATAS, formatTanggal, statDari, validasiNama, type ChecklistDetail, type ChecklistItem,
} from '@/lib/checklist';
import {
  BarProgres, CatatanTeks, KepingKendala, ModalKendala, PanelBagian, TEMA, itemPerBagian, kirimFoto, progresDariStat,
} from '@/app/project-progress/_components/tampilan';

/**
 * Halaman link checklist untuk tim lapangan - PUBLIK, tanpa login.
 *
 * Yang bisa dilakukan di sini: mencentang / membatalkan item, menandai
 * kendala, dan mengunggah foto bukti. Data diambil & ditulis lewat
 * /api/checklist/share/<token> (service_role di server); halaman ini tidak
 * pernah menyentuh supabase langsung.
 *
 * Nama diminta sekali lalu diingat di perangkat ini, supaya admin tahu siapa
 * mengerjakan apa dan kapan tanpa tim harus punya akun.
 */

const KUNCI_NAMA = 'checklist_nama_pencentang';
// Perubahan orang lain ikut terlihat tanpa muat ulang. Cukup jarang untuk tidak
// membebani server ketika banyak teknisi membuka link yang sama.
const JEDA_SEGARKAN_MS = 20_000;

function bacaNama(): string {
  try { return window.localStorage.getItem(KUNCI_NAMA) ?? ''; } catch { return ''; }
}
function simpanNama(nama: string) {
  try { window.localStorage.setItem(KUNCI_NAMA, nama); } catch { /* mode privat: cukup diingat selama halaman terbuka */ }
}

type Lanjutan = { jenis: 'centang' | 'kendala'; item: ChecklistItem } | null;

export default function ChecklistSharePage({ params }: { params: { token: string } }) {
  const [detail, setDetail] = useState<ChecklistDetail | null>(null);
  const [memuat, setMemuat] = useState(true);
  const [galat, setGalat] = useState('');
  const [nama, setNama] = useState('');
  const [isianNama, setIsianNama] = useState('');
  const [mintaNama, setMintaNama] = useState<{ lanjut: Lanjutan } | null>(null);
  const [kendalaUntuk, setKendalaUntuk] = useState<ChecklistItem | null>(null);
  const [sedangId, setSedangId] = useState<string | null>(null);
  const [sembunyikan, setSembunyikan] = useState(false);
  const [toast, setToast] = useState<Notif | null>(null);
  const sibuk = useRef(false);
  const api = `/api/checklist/share/${params.token}`;

  const beritahu = useCallback((type: Notif['type'], msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3500);
  }, []);

  useEffect(() => { setNama(bacaNama()); }, []);

  const muat = useCallback(async (diam = false) => {
    try {
      const res = await fetch(api, { cache: 'no-store' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        // Saat penyegaran diam-diam, galat jaringan sesaat tidak menghapus
        // checklist yang sudah tampil. Link yang dimatikan tetap ditampilkan.
        if (!diam || res.status === 404) { setGalat(json.error || 'Link tidak ditemukan.'); setDetail(null); }
        return;
      }
      // Jangan timpa perubahan yang sedang dikirim dengan data lama.
      if (!sibuk.current) setDetail(json as ChecklistDetail);
      setGalat('');
    } catch {
      if (!diam) setGalat('Gagal memuat checklist. Periksa koneksi internet.');
    } finally {
      setMemuat(false);
    }
  }, [api]);

  useEffect(() => { muat(); }, [muat]);

  useEffect(() => {
    const t = setInterval(() => { if (document.visibilityState === 'visible') muat(true); }, JEDA_SEGARKAN_MS);
    const kembali = () => { if (document.visibilityState === 'visible') muat(true); };
    document.addEventListener('visibilitychange', kembali);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', kembali); };
  }, [muat]);

  const gantiItem = (baru: ChecklistItem) => setDetail(d => d && { ...d, items: d.items.map(i => (i.id === baru.id ? baru : i)) });

  const kirim = async (body: Record<string, unknown>): Promise<ChecklistItem> => {
    const res = await fetch(api, {
      method: 'POST', cache: 'no-store', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || 'Gagal menyimpan.');
    return json.item as ChecklistItem;
  };

  const centang = async (item: ChecklistItem, siapa: string) => {
    if (sibuk.current) return;
    sibuk.current = true;
    setSedangId(item.id);
    const tujuan = !item.selesai;
    // Tampil langsung berubah; dikembalikan bila server menolak.
    gantiItem({
      ...item, selesai: tujuan, kendala: tujuan ? false : item.kendala,
      selesai_oleh: tujuan ? siapa : null, selesai_pada: tujuan ? new Date().toISOString() : null, selesai_lewat: tujuan ? 'link' : null,
    });
    try {
      gantiItem(await kirim({ aksi: 'centang', itemId: item.id, selesai: tujuan, nama: siapa }));
    } catch (e) {
      gantiItem(item);
      beritahu('error', e instanceof Error ? e.message : 'Gagal menyimpan centang.');
    } finally {
      sibuk.current = false;
      setSedangId(null);
    }
  };

  const perluNama = (lanjut: Lanjutan): boolean => {
    if (nama) return false;
    setIsianNama('');
    setMintaNama({ lanjut });
    return true;
  };

  const toggle = (item: ChecklistItem) => { if (!perluNama({ jenis: 'centang', item })) centang(item, nama); };
  const bukaKendala = (item: ChecklistItem) => { if (!perluNama({ jenis: 'kendala', item })) setKendalaUntuk(item); };

  const simpanKendala = async (item: ChecklistItem, kendala: boolean, catatan: string) => {
    try {
      gantiItem(await kirim({ aksi: 'kendala', itemId: item.id, kendala, catatan, nama }));
      beritahu('success', kendala ? 'Kendala dicatat. Admin langsung bisa melihatnya.' : 'Kendala ditandai selesai.');
    } catch (e) {
      beritahu('error', e instanceof Error ? e.message : 'Gagal menyimpan kendala.');
      throw e;
    }
  };

  const unggahFoto = async (item: ChecklistItem, file: File) => {
    setSedangId(item.id);
    try {
      gantiItem(await kirimFoto(`${api}/foto`, item.id, file));
      beritahu('success', 'Foto bukti tersimpan.');
    } catch (e) {
      beritahu('error', e instanceof Error ? e.message : 'Gagal mengunggah foto.');
    } finally {
      setSedangId(null);
    }
  };

  const konfirmasiNama = () => {
    const sah = validasiNama(isianNama);
    if (!sah) return;
    simpanNama(sah);
    setNama(sah);
    const lanjut = mintaNama?.lanjut;
    setMintaNama(null);
    if (lanjut?.jenis === 'centang') centang(lanjut.item, sah);
    if (lanjut?.jenis === 'kendala') setKendalaUntuk(lanjut.item);
  };

  const peta = useMemo(() => (detail ? itemPerBagian(detail.bagian, detail.items) : new Map<string, ChecklistItem[]>()), [detail]);
  const stat = detail ? statDari(detail.items) : null;
  const namaSah = !!validasiNama(isianNama);

  return (
    <div className="min-h-screen" style={{ background: 'var(--halaman)' }}>
      <Toast notif={toast} />

      <header className="sticky top-0 z-40" style={{ background: NETRAL.permukaan, borderBottom: `1px solid ${NETRAL.garis}` }}>
        <div className="max-w-3xl mx-auto px-4 py-3 space-y-2">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              {detail && (
                <p className="text-[11px] font-semibold truncate" style={{ color: TEMA.samar }}>
                  {detail.proyek.nama}{detail.proyek.client ? ` · ${detail.proyek.client}` : ''}
                </p>
              )}
              <h1 className="text-[15.5px] font-bold leading-tight" style={{ color: NETRAL.tinta }}>
                {detail?.daftar.judul ?? 'Checklist'}
              </h1>
              {detail && (detail.daftar.start_date || detail.daftar.target_date) && (
                <p className="text-[11px] font-semibold mt-0.5 flex items-center gap-1" style={{ color: TEMA.samar }}>
                  <CalendarDays size={12} /> {formatTanggal(detail.daftar.start_date)} – {formatTanggal(detail.daftar.target_date)}
                </p>
              )}
            </div>
            <button type="button" onClick={() => { setIsianNama(nama); setMintaNama({ lanjut: null }); }}
              className="flex-shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[11.5px] font-bold max-w-[45%]"
              style={{ background: nama ? TEMA.tint : '#fffbeb', color: nama ? TEMA.warnaTua : '#92400e', border: `1px solid ${nama ? TEMA.garisTint : '#fde68a'}` }}>
              <UserRound size={13} className="flex-shrink-0" />
              <span className="truncate">{nama || 'Isi nama'}</span>
            </button>
          </div>
          {stat && (
            <div className="flex items-center gap-2">
              <div className="flex-1 min-w-0"><BarProgres progres={progresDariStat(stat)} tebal={10} /></div>
              <KepingKendala jumlah={stat.kendala} />
            </div>
          )}
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-3 sm:px-4 py-4 space-y-3">
        {memuat && <p className="py-16 text-center text-sm font-semibold" style={{ color: TEMA.samar }}>Memuat checklist…</p>}

        {!memuat && galat && !detail && (
          <div className="rounded-xl p-10 text-center space-y-2" style={{ background: NETRAL.permukaan, border: `1px solid ${NETRAL.garis}` }}>
            <Lock size={30} className="mx-auto" style={{ color: TEMA.samar }} />
            <p className="text-[15px] font-bold" style={{ color: NETRAL.tinta }}>{galat}</p>
            <p className="text-[12.5px]" style={{ color: NETRAL.tinta2 }}>Minta link terbaru dari admin.</p>
          </div>
        )}

        {detail && (
          <>
            {detail.daftar.keterangan && (
              <div className="rounded-xl px-4 py-3" style={{ background: NETRAL.permukaan, border: `1px solid ${NETRAL.garis}` }}>
                <CatatanTeks teks={detail.daftar.keterangan} />
              </div>
            )}

            <div className="flex items-center justify-between gap-2 px-1">
              <p className="text-[11.5px]" style={{ color: TEMA.samar }}>Ketuk kotak untuk mencentang · ⚠ kendala · 📷 foto bukti</p>
              <label className="flex items-center gap-2 text-[12.5px] font-semibold cursor-pointer" style={{ color: NETRAL.tinta2 }}>
                <input type="checkbox" checked={sembunyikan} onChange={e => setSembunyikan(e.target.checked)} className="w-4 h-4 accent-blue-600" />
                Sembunyikan selesai
              </label>
            </div>

            {detail.bagian.length === 0 && (
              <p className="rounded-xl p-8 text-center text-[13px]" style={{ background: NETRAL.permukaan, border: `1px solid ${NETRAL.garis}`, color: NETRAL.tinta2 }}>
                Checklist ini belum berisi item.
              </p>
            )}

            {detail.bagian.map(b => {
              const items = peta.get(b.id) ?? [];
              const s = statDari(items);
              return (
                <PanelBagian key={b.id} bagian={b} items={items} sedangId={sedangId} sembunyikanSelesai={sembunyikan}
                  aksi={{ onToggle: toggle, onKendala: bukaKendala, onFoto: unggahFoto }}
                  // Bagian yang sudah tuntas dilipat supaya yang masih
                  // dikerjakan langsung terlihat di layar HP.
                  terbukaAwal={s.total === 0 ? false : s.selesai < s.total} />
              );
            })}

            <p className="text-center text-[10.5px] font-semibold py-4" style={{ color: TEMA.samar }}>
              Work Management PTS IVP · Setiap perubahan dicatat dengan nama dan waktunya.
            </p>
          </>
        )}
      </main>

      <ModalKendala item={kendalaUntuk} onTutup={() => setKendalaUntuk(null)} onSimpan={simpanKendala} />

      <Modal buka={!!mintaNama} onTutup={() => setMintaNama(null)} ukuran="sm" ikon="👤"
        judul={nama ? 'Ganti nama' : 'Siapa yang mengerjakan?'}
        keterangan="Nama dicatat di setiap item yang Anda centang atau tandai, dan diingat di perangkat ini."
        footer={<>
          <TombolModal onClick={() => setMintaNama(null)}>Batal</TombolModal>
          <TombolModal jenis="utama" onClick={konfirmasiNama} disabled={!namaSah}>
            {mintaNama?.lanjut ? 'Simpan & lanjut' : 'Simpan'}
          </TombolModal>
        </>}>
        <label className="block">
          <span className="text-[12px] font-bold" style={{ color: NETRAL.tinta2 }}>Nama Anda</span>
          <input value={isianNama} onChange={e => setIsianNama(e.target.value)} maxLength={BATAS.nama} autoFocus
            onKeyDown={e => { if (e.key === 'Enter' && namaSah) konfirmasiNama(); }}
            placeholder="mis. Budi - Teknisi"
            className="mt-1 w-full rounded-xl px-3 py-2.5 text-[16px] outline-none focus:ring-2"
            style={{ border: `1px solid ${NETRAL.garis}`, color: NETRAL.tinta }} />
        </label>
      </Modal>
    </div>
  );
}
