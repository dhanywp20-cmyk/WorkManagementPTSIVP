'use client';

import { useState } from 'react';
import { Copy, RefreshCw, ExternalLink } from 'lucide-react';
import { Modal, TombolModal } from '@/components/shared';
import { NETRAL } from '@/lib/desain';
import { urlShareChecklist, type ChecklistDaftar } from '@/lib/checklist';
import { TEMA } from './tampilan';

/**
 * Link share untuk tim - pola yang sama dengan Share View-Only di Project
 * Progress, bedanya link ini BISA mencentang. Mematikan link tidak mengganti
 * token (link lama hidup lagi saat dinyalakan); "Buat link baru" yang
 * memutus link lama untuk selamanya.
 */
export function ModalShare({ daftar, onTutup, onUbah, beritahu }: {
  daftar: ChecklistDaftar | null;
  onTutup: () => void;
  onUbah: (aksi: 'share' | 'tokenBaru', aktif?: boolean) => Promise<void>;
  beritahu: (type: 'success' | 'error', msg: string) => void;
}) {
  const [sibuk, setSibuk] = useState(false);
  const [yakinGanti, setYakinGanti] = useState(false);
  if (!daftar) return null;
  const url = daftar.share_token ? urlShareChecklist(daftar.share_token) : '';

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
      judul="Bagikan link checklist"
      keterangan="Siapa pun yang memegang link bisa mencentang item tanpa login. Nama pencentang dan waktunya selalu tercatat."
      footer={<TombolModal onClick={onTutup}>Tutup</TombolModal>}>
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3 rounded-xl px-3 py-3"
          style={{ background: NETRAL.permukaanRedam, border: `1px solid ${NETRAL.garis}` }}>
          <div className="min-w-0">
            <p className="text-[13px] font-bold truncate" style={{ color: NETRAL.tinta }}>{daftar.judul}</p>
            <p className="text-[11.5px] font-semibold" style={{ color: daftar.share_aktif ? TEMA.selesai : TEMA.samar }}>
              {daftar.share_aktif ? '● Aktif - tim bisa membuka & mencentang' : '○ Nonaktif - link tidak bisa dibuka'}
            </p>
          </div>
          <button type="button" disabled={sibuk} onClick={() => jalankan('share', !daftar.share_aktif)}
            className="px-3.5 py-2 rounded-lg text-[12px] font-bold text-white flex-shrink-0 disabled:opacity-60"
            style={{ background: daftar.share_aktif ? '#64748b' : TEMA.selesai }}>
            {daftar.share_aktif ? 'Matikan' : 'Aktifkan'}
          </button>
        </div>

        {daftar.share_aktif && url && (
          <div className="space-y-2">
            <div className="flex gap-2">
              <input aria-label="Link checklist" readOnly value={url} onFocus={e => e.target.select()}
                className="flex-1 min-w-0 rounded-lg px-3 py-2 text-[12px] font-mono"
                style={{ border: `1px solid ${NETRAL.garis}`, color: NETRAL.tinta2, background: NETRAL.permukaan }} />
              <button type="button" onClick={salin} className="px-3 rounded-lg text-[12px] font-bold text-white inline-flex items-center gap-1.5"
                style={{ background: TEMA.warna }}>
                <Copy size={14} /> Salin
              </button>
            </div>
            <a href={url} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[12px] font-bold" style={{ color: TEMA.warna }}>
              <ExternalLink size={13} /> Buka seperti yang dilihat tim
            </a>
          </div>
        )}

        {daftar.share_token && (
          <div className="pt-3" style={{ borderTop: `1px solid ${NETRAL.garis}` }}>
            {!yakinGanti ? (
              <button type="button" onClick={() => setYakinGanti(true)}
                className="inline-flex items-center gap-1.5 text-[12px] font-bold" style={{ color: NETRAL.tinta2 }}>
                <RefreshCw size={13} /> Buat link baru (link lama berhenti berfungsi)
              </button>
            ) : (
              <div className="rounded-lg px-3 py-2.5 space-y-2" style={{ background: '#fffbeb', border: '1px solid #fde68a' }}>
                <p className="text-[12px] font-semibold" style={{ color: '#92400e' }}>
                  Link yang sudah tersebar tidak bisa dibuka lagi. Centang yang sudah ada tetap tersimpan.
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
