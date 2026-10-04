'use client';

import { useState } from 'react';
import { Copy, RefreshCw, ExternalLink } from 'lucide-react';
import { Modal, TombolModal } from '@/components/shared';
import { NETRAL } from '@/lib/desain';
import { urlShareChecklist } from '@/lib/checklist';
import { TEMA } from './tampilan';

export interface TargetShare {
  jenis: 'checklist' | 'proyek';
  judul: string;
  share_aktif: boolean;
  share_token?: string | null;
}

function urlShare(t: TargetShare): string {
  if (!t.share_token) return '';
  if (t.jenis === 'checklist') return urlShareChecklist(t.share_token);
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}/project-progress/share/${t.share_token}`;
}

/**
 * Link share - dua jenis:
 *   checklist : tim lapangan BISA mencentang & menandai kendala tanpa login
 *   proyek    : HANYA LIHAT seluruh checklist proyek (untuk client/atasan)
 * Mematikan link tidak mengganti token (link lama hidup lagi saat dinyalakan);
 * "Buat link baru" yang memutus link lama untuk selamanya.
 */
export function ModalShare({ target, onTutup, onUbah, beritahu }: {
  target: TargetShare | null;
  onTutup: () => void;
  onUbah: (aksi: 'share' | 'tokenBaru', aktif?: boolean) => Promise<void>;
  beritahu: (type: 'success' | 'error', msg: string) => void;
}) {
  const [sibuk, setSibuk] = useState(false);
  const [yakinGanti, setYakinGanti] = useState(false);
  if (!target) return null;
  const url = urlShare(target);
  const bisaCentang = target.jenis === 'checklist';

  const jalankan = async (aksi: 'share' | 'tokenBaru', aktif?: boolean) => {
    setSibuk(true);
    try { await onUbah(aksi, aktif); setYakinGanti(false); }
    catch (e) { beritahu('error', e instanceof Error ? e.message : 'Gagal mengubah link.'); }
    finally { setSibuk(false); }
  };

  const salin = async () => {
    try { await navigator.clipboard.writeText(url); beritahu('success', 'Link disalin. Tempel ke grup WhatsApp tim.'); }
    catch { beritahu('error', 'Gagal menyalin. Salin manual dari kotak link.'); }
  };

  return (
    <Modal buka onTutup={() => { setYakinGanti(false); onTutup(); }} ukuran="md" ikon="🔗"
      judul={bisaCentang ? 'Link checklist untuk tim' : 'Link proyek (hanya lihat)'}
      keterangan={bisaCentang
        ? 'Siapa pun yang memegang link bisa mencentang dan menandai kendala tanpa login. Nama dan waktunya selalu tercatat.'
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
            className="px-3.5 py-2 rounded-lg text-[12px] font-bold text-white flex-shrink-0 disabled:opacity-60"
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
