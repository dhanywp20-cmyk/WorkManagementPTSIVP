'use client';

import { appBaseUrl } from '@/lib/app-url';
import { useRef, useState } from 'react';
import { Copy, RefreshCw, ExternalLink, ImagePlus, Undo2 } from 'lucide-react';
import { Modal, TombolModal } from '@/components/shared';
import { NETRAL } from '@/lib/desain';
import { urlShareChecklist } from '@/lib/checklist/inti';
import { urlShareIsu } from '@/lib/isu/inti';
import { kirimFormTahan } from '@/lib/unggah-tahan';
import { TEMA } from './tampilan';

export interface TargetShare {
  jenis: 'checklist' | 'proyek' | 'isu';
  judul: string;
  share_aktif: boolean;
  share_token?: string | null;
}

export interface LatarShare {
  nilai: string | null | undefined;
  bisaUbah: boolean;
  onUbah: (url: string | null) => Promise<void>;
}

function urlShare(t: TargetShare): string {
  if (!t.share_token) return '';
  if (t.jenis === 'checklist') return urlShareChecklist(t.share_token);
  if (t.jenis === 'isu') return urlShareIsu(appBaseUrl(), t.share_token);
  return `${appBaseUrl()}/project-progress/share/${t.share_token}`;
}

export function ModalShare({ target, latar, onTutup, onUbah, beritahu }: {
  target: TargetShare | null;
  latar?: LatarShare;
  onTutup: () => void;
  onUbah: (aksi: 'share' | 'tokenBaru', aktif?: boolean) => Promise<void>;
  beritahu: (type: 'success' | 'error', msg: string) => void;
}) {
  const [sibuk, setSibuk] = useState(false);
  const [yakinGanti, setYakinGanti] = useState(false);
  const inputLatar = useRef<HTMLInputElement>(null);
  if (!target) return null;
  const url = urlShare(target);
  const bisaCentang = target.jenis === 'checklist';

  const jalankan = async (aksi: 'share' | 'tokenBaru', aktif?: boolean) => {
    setSibuk(true);
    try { await onUbah(aksi, aktif); setYakinGanti(false); }
    catch (e) { beritahu('error', e instanceof Error ? e.message : 'Gagal mengubah link.'); }
    finally { setSibuk(false); }
  };

  const ubahLatar = async (url: string | null, pesan: string) => {
    if (!latar) return;
    await latar.onUbah(url);
    beritahu('success', pesan);
  };

  const unggahLatar = async (berkas: File | undefined) => {
    if (!berkas || !latar) return;
    setSibuk(true);
    try {
      let siap = berkas;
      try { const { compressImage } = await import('@/lib/image-compress'); siap = await compressImage(berkas, { maxDim: 2400, quality: 0.82 }); } catch {  }
      const fd = new FormData();
      fd.append('berkas', siap);
      const r = await kirimFormTahan('/api/project-progress/share/latar', fd, { credentials: 'include' });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || 'Unggah gagal.');
      await ubahLatar(j.url as string, 'Latar link diganti. Penerima melihatnya saat membuka/memuat ulang link.');
    } catch (e) {
      beritahu('error', e instanceof Error ? e.message : 'Unggah gagal - periksa koneksi.');
    } finally {
      setSibuk(false);
      if (inputLatar.current) inputLatar.current.value = '';
    }
  };

  const pakaiLatarPlatform = async () => {
    setSibuk(true);
    try { await ubahLatar(null, 'Link kembali memakai latar platform.'); }
    catch (e) { beritahu('error', e instanceof Error ? e.message : 'Gagal mengubah latar.'); }
    finally { setSibuk(false); }
  };

  const salin = async () => {
    try { await navigator.clipboard.writeText(url); beritahu('success', 'Link disalin. Tempel ke grup WhatsApp tim.'); }
    catch { beritahu('error', 'Gagal menyalin. Salin manual dari kotak link.'); }
  };

  return (
    <Modal buka onTutup={() => { setYakinGanti(false); onTutup(); }} ukuran="md" ikon="🔗"
      judul={bisaCentang ? 'Link checklist untuk tim' : target.jenis === 'isu' ? 'Link Issue Log (hanya lihat)' : 'Link proyek (hanya lihat)'}
      keterangan={bisaCentang
        ? 'Siapa pun yang memegang link bisa mencentang dan menandai kendala tanpa login. Nama dan waktunya selalu tercatat.'
        : target.jenis === 'isu'
          ? 'Untuk pihak eksternal: bisa melihat ringkasan harian, status, action & solusi tanpa login. Catatan internal tidak ikut tampil dan tidak ada yang bisa diubah.'
          : 'Siapa pun yang memegang link bisa melihat seluruh checklist proyek ini tanpa login, tanpa bisa mengubah apa pun.'}
      footer={<TombolModal onClick={onTutup}>Tutup</TombolModal>}>
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3 rounded-xl px-3 py-3"
          style={{ background: NETRAL.permukaanRedam, border: `1px solid ${NETRAL.garis}` }}>
          <div className="min-w-0">
            <p className="text-[13px] font-bold truncate" style={{ color: NETRAL.tinta }}>{target.judul}</p>
            <p className="text-[11.5px] font-semibold" style={{ color: target.share_aktif ? TEMA.selesai : TEMA.samar }}>
              {target.share_aktif ? '● Aktif - link bisa dibuka' : '○ Nonaktif - link tidak bisa dibuka'}
            </p>
          </div>
          <button type="button" disabled={sibuk} onClick={() => jalankan('share', !target.share_aktif)}
            className="px-3.5 py-2 rounded-lg text-[12px] font-bold text-white shrink-0 disabled:opacity-60"
            style={{ background: target.share_aktif ? '#64748b' : TEMA.selesai }}>
            {target.share_aktif ? 'Matikan' : 'Aktifkan'}
          </button>
        </div>

        {target.share_aktif && url && (
          <div className="space-y-2">
            <div className="flex gap-2">
              <input aria-label="Link" readOnly value={url} onFocus={e => e.target.select()}
                className="flex-1 min-w-0 rounded-lg px-3 py-2 text-[12px] font-mono"
                style={{ border: `1px solid ${NETRAL.garis}`, color: NETRAL.tinta2, background: NETRAL.permukaan }} />
              <button type="button" onClick={salin} className="px-3 rounded-lg text-[12px] font-bold text-white inline-flex items-center gap-1.5"
                style={{ background: TEMA.warna }}>
                <Copy size={14} /> Salin
              </button>
            </div>
            <a href={url} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[12px] font-bold" style={{ color: TEMA.warna }}>
              <ExternalLink size={13} /> Buka seperti yang dilihat penerima
            </a>
          </div>
        )}

        {latar && target.jenis !== 'checklist' && (
          <div className="pt-3 space-y-2" style={{ borderTop: `1px solid ${NETRAL.garis}` }}>
            <p className="text-[12px] font-bold" style={{ color: NETRAL.tinta }}>Latar halaman link</p>
            <div className="flex items-center gap-3">
              <div aria-hidden className="w-28 h-16 rounded-lg shrink-0"
                style={{
                  border: `1px solid ${NETRAL.garis}`,
                  background: latar.nilai ? `var(--halaman) url("${latar.nilai.replace(/"/g, '%22')}") center / cover no-repeat` : 'var(--latar-halaman)',
                }} />
              <div className="min-w-0 flex-1 space-y-1.5">
                <p className="text-[11.5px] font-semibold" style={{ color: NETRAL.tinta2 }}>
                  {latar.nilai ? 'Memakai gambar sendiri' : 'Ikut latar platform'}
                </p>
                {latar.bisaUbah ? (
                  <div className="flex flex-wrap gap-2">
                    <button type="button" disabled={sibuk} onClick={() => inputLatar.current?.click()}
                      className="px-3 py-1.5 rounded-lg text-[12px] font-bold text-white inline-flex items-center gap-1.5 disabled:opacity-60"
                      style={{ background: TEMA.warna }}>
                      <ImagePlus size={13} /> {sibuk ? 'Memproses…' : latar.nilai ? 'Ganti gambar' : 'Unggah gambar'}
                    </button>
                    {latar.nilai && (
                      <button type="button" disabled={sibuk} onClick={pakaiLatarPlatform}
                        className="px-3 py-1.5 rounded-lg text-[12px] font-bold inline-flex items-center gap-1.5 disabled:opacity-60"
                        style={{ border: `1px solid ${NETRAL.garis}`, color: NETRAL.tinta2 }}>
                        <Undo2 size={13} /> Pakai latar platform
                      </button>
                    )}
                  </div>
                ) : (
                  <p className="text-[11px]" style={{ color: TEMA.samar }}>Hanya admin atau Manager PTS yang bisa mengganti latar.</p>
                )}
              </div>
            </div>
            {latar.bisaUbah && (
              <p className="text-[11px]" style={{ color: TEMA.samar }}>PNG/JPG/WebP, otomatis dikecilkan. Hanya berlaku untuk link ini, tidak mengubah latar platform.</p>
            )}
            <input ref={inputLatar} type="file" accept="image/png,image/jpeg,image/webp" hidden aria-label="Pilih gambar latar"
              onChange={e => void unggahLatar(e.target.files?.[0])} />
          </div>
        )}

        {target.share_token && (
          <div className="pt-3" style={{ borderTop: `1px solid ${NETRAL.garis}` }}>
            {!yakinGanti ? (
              <button type="button" onClick={() => setYakinGanti(true)}
                className="inline-flex items-center gap-1.5 text-[12px] font-bold" style={{ color: NETRAL.tinta2 }}>
                <RefreshCw size={13} /> Buat link baru (link lama berhenti berfungsi)
              </button>
            ) : (
              <div className="rounded-lg px-3 py-2.5 space-y-2" style={{ background: '#fffbeb', border: '1px solid #fde68a' }}>
                <p className="text-[12px] font-semibold" style={{ color: '#92400e' }}>
                  Link yang sudah tersebar tidak bisa dibuka lagi. Data yang sudah ada tetap tersimpan.
                </p>
                <div className="flex gap-2">
                  <TombolModal onClick={() => setYakinGanti(false)} disabled={sibuk}>Batal</TombolModal>
                  <TombolModal jenis="bahaya" onClick={() => jalankan('tokenBaru')} disabled={sibuk}>Ya, buat link baru</TombolModal>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
