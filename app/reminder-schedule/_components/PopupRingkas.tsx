'use client';
/**
 * app/reminder-schedule/_components/PopupRingkas.tsx
 *
 * Empat popup yang dipindahkan keluar dari page.tsx. Dipilih bukan karena
 * ukurannya, melainkan karena HARGANYA: keempatnya hanya menyentuh 4-7 nilai
 * dari halaman induknya, jadi memindahkannya tidak menuntut mengoper puluhan
 * props - dan props yang banyak justru memindahkan kerumitan, bukan
 * menghilangkannya.
 *
 * Isi JSX-nya dipindahkan apa adanya, tanpa satu pun perubahan perilaku.
 * Syarat tampilnya ikut pindah ke dalam masing-masing komponen, sehingga
 * page.tsx cukup memanggilnya tanpa membungkus kondisi lagi.
 */
import { ModalPortal } from '@/components/shared';
import { PriorityBadge, StatusBadge, CategoryBadge } from './Badges';
import { Reminder, formatDate } from './shared';
import { triggersProjectProgress } from '@/lib/project-progress-sync';

export function KonfirmasiApproveInternal({
  internalApproveTarget, internalApproveSaving, setInternalApproveTarget, handleInternalApprove,
}: {
  internalApproveTarget: Reminder | null;
  internalApproveSaving: boolean;
  setInternalApproveTarget: (r: Reminder | null) => void;
  handleInternalApprove: (r: Reminder) => void;
}) {
  if (!(internalApproveTarget)) return null;
  return (
    <ModalPortal>
      <div role="dialog" aria-modal="true" className="fixed inset-0 bg-black/60 flex items-center justify-center z-[1100] p-4"
        onClick={e => { if (e.target === e.currentTarget) setInternalApproveTarget(null); }}>
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
          style={{ animation: 'scale-in 0.25s ease-out', border: '2px solid rgba(245,158,11,0.4)' }}>
          <div className="px-6 py-5" style={{ background: 'linear-gradient(135deg,#f59e0b,#d97706)' }}>
            <h3 className="text-lg font-bold text-white">✅ Approve Request?</h3>
            <p className="text-amber-100/90 text-xs mt-0.5">Teruskan ke Admin/Manager untuk di-assign</p>
          </div>
          <div className="p-6 space-y-3">
            <div className="rounded-xl p-3 space-y-1.5 text-sm" style={{ background: 'rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.08)' }}>
              <div className="flex justify-between gap-3"><span className="text-slate-400 text-xs">Project</span><span className="font-bold text-slate-800 text-right">{internalApproveTarget.project_name}</span></div>
              <div className="flex justify-between gap-3"><span className="text-slate-400 text-xs">Sales</span><span className="font-semibold text-slate-700 text-right">{internalApproveTarget.sales_name}{internalApproveTarget.sales_division ? ` · ${internalApproveTarget.sales_division}` : ''}</span></div>
              <div className="flex justify-between gap-3"><span className="text-slate-400 text-xs">Kategori</span><span className="font-semibold text-slate-700 text-right">{internalApproveTarget.category}</span></div>
              {internalApproveTarget.product && <div className="flex justify-between gap-3"><span className="text-slate-400 text-xs">Product</span><span className="font-semibold text-slate-700 text-right">{internalApproveTarget.product}</span></div>}
              <div className="flex justify-between gap-3"><span className="text-slate-400 text-xs">Lokasi</span><span className="font-semibold text-slate-700 text-right">{internalApproveTarget.address || '-'}</span></div>
              <div className="flex justify-between gap-3"><span className="text-slate-400 text-xs">Tanggal</span><span className="font-semibold text-slate-700 text-right">{formatDate(internalApproveTarget.due_date)}{internalApproveTarget.due_time ? ` · ${internalApproveTarget.due_time}` : ''}</span></div>
              {/* Usulan timeline dari Sales — ditampilkan supaya Sales Internal
                  tahu rentang yang diajukan sebelum meneruskan ke Admin.
                  Tidak bisa disunting di sini: penetapannya milik Admin saat
                  assign, karena di titik itulah draft Project Progress lahir. */}
              {triggersProjectProgress(internalApproveTarget.category) && (() => {
                const t = internalApproveTarget as { progress_start_date?: string | null; progress_target_date?: string | null };
                return (
                  <div className="flex justify-between gap-3">
                    <span className="text-slate-400 text-xs">Timeline Pengerjaan</span>
                    <span className="font-semibold text-right" style={{ color: t.progress_start_date || t.progress_target_date ? '#0e7490' : '#94a3b8' }}>
                      {t.progress_start_date || t.progress_target_date
                        ? `${t.progress_start_date ? formatDate(t.progress_start_date) : '—'} → ${t.progress_target_date ? formatDate(t.progress_target_date) : '—'}`
                        : 'Belum diusulkan'}
                    </span>
                  </div>
                );
              })()}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setInternalApproveTarget(null)}
                className="flex-1 py-3 rounded-xl font-semibold text-sm transition-all"
                style={{ background: 'rgba(255,255,255,0.95)', color: '#64748b', border: '1px solid rgba(0,0,0,0.12)' }}>Batal</button>
              <button onClick={() => handleInternalApprove(internalApproveTarget)} disabled={internalApproveSaving}
                className="flex-[2] text-white py-3 rounded-xl font-bold transition-all text-sm flex items-center justify-center gap-2 hover:scale-[1.02] disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg,#f59e0b,#d97706)' }}>
                {internalApproveSaving && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                ✅ Ya, Approve &amp; Teruskan
              </button>
            </div>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}


export function ModalHapus({
  showDeleteModal, deleteTarget, deleteConfirmText, setDeleteConfirmText, setShowDeleteModal, setDeleteTarget, handleDelete,
}: {
  showDeleteModal: boolean;
  deleteTarget: Reminder | null;
  deleteConfirmText: string;
  setDeleteConfirmText: (v: string) => void;
  setShowDeleteModal: (v: boolean) => void;
  setDeleteTarget: (r: Reminder | null) => void;
  handleDelete: () => void;
}) {
  if (!(showDeleteModal && deleteTarget)) return null;
  return (
    <ModalPortal>
      <div role="dialog" aria-modal="true" className="fixed inset-0 bg-black/60 flex items-center justify-center z-[1100] p-4">
        <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl max-w-md w-full p-6"
          style={{ animation: 'scale-in 0.25s ease-out', border: '2px solid rgba(220,38,38,0.5)' }}>
          <div className="flex items-center gap-3 mb-4">
            <span className="text-3xl">🗑️</span>
            <div>
              <h3 className="text-lg font-bold text-gray-800">Hapus Reminder</h3>
              <p className="text-xs font-medium text-gray-500">{deleteTarget.project_name}</p>
              <p className="text-xs text-gray-400">{deleteTarget.category}</p>
            </div>
          </div>
          <div className="rounded-xl p-3 mb-4 text-xs"
            style={{ background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.2)', color: '#b91c1c' }}>
            ⚠️ <strong>Tindakan ini tidak dapat dibatalkan.</strong> Reminder ini akan dihapus permanen dari database.
          </div>
          <div className="mb-4">
            <label className="block text-sm font-bold mb-1 text-gray-700">
              Ketik <span className="font-mono bg-red-100 text-red-700 px-1.5 py-0.5 rounded">HAPUS</span> untuk konfirmasi
            </label>
            <input
              type="text"
              value={deleteConfirmText}
              onChange={e => setDeleteConfirmText(e.target.value)}
              placeholder="Ketik HAPUS di sini..."
              className="w-full rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-red-500 outline-none"
              style={{ border: '2px solid rgba(220,38,38,0.3)', background: 'white' }}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={handleDelete}
              disabled={deleteConfirmText !== 'HAPUS'}
              className="bg-gradient-to-r from-red-600 to-red-800 text-white py-2.5 rounded-xl font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:from-red-700 hover:to-red-900">
              🗑️ Hapus Permanen
            </button>
            <button
              onClick={() => { setShowDeleteModal(false); setDeleteTarget(null); setDeleteConfirmText(''); }}
              className="bg-gray-100 text-gray-700 py-2.5 rounded-xl font-bold hover:bg-gray-200 transition-all">
              ✕ Batal
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}


export function PopupNotifikasi({
  showNotificationPopup, myReminders, setShowNotificationPopup, setDetailReminder,
}: {
  showNotificationPopup: boolean;
  myReminders: Reminder[];
  setShowNotificationPopup: (v: boolean) => void;
  setDetailReminder: (r: Reminder | null) => void;
}) {
  if (!(showNotificationPopup)) return null;
  return (
    <ModalPortal>
      <div role="dialog" aria-modal="true" className="fixed inset-0 bg-black/60 flex items-center justify-center z-[1000] p-4">
        <div className="bg-white/90 backdrop-blur-md rounded-2xl shadow-2xl max-w-lg w-full max-h-full overflow-hidden flex flex-col border-4 border-yellow-400"
          style={{ animation: 'scale-in 0.3s ease-out' }}>
          <div className="p-5 border-b-2 border-yellow-300 flex-shrink-0" style={{ background: 'linear-gradient(135deg,#f59e0b,#d97706)' }}>
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-3">
                <span className="text-3xl animate-bounce">🔔</span>
                <div>
                  <h3 className="text-lg font-bold text-white">Reminder Kamu</h3>
                  <p className="text-sm text-white/90">{myReminders.length} reminder aktif yang diassign ke kamu</p>
                </div>
              </div>
              <button aria-label="Tutup" onClick={() => setShowNotificationPopup(false)} className="text-white hover:bg-white/20 rounded-lg p-2 font-bold">✕</button>
            </div>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-2">
            {myReminders.map(r => (
              <div key={r.id} onClick={() => { setDetailReminder(r); setShowNotificationPopup(false); }}
                className="rounded-xl p-3 border-2 cursor-pointer hover:shadow-md hover:scale-[1.01] transition-all"
                style={{ background: 'rgba(249,250,251,0.9)', borderColor: '#e5e7eb' }}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                      <CategoryBadge category={r.category} />
                      <PriorityBadge priority={r.priority} />
                    </div>
                    <p className="font-bold text-sm text-gray-800 truncate">{(r.project_name || '').trim() || ((r as any).title || '').trim() || '—'}</p>
                    {r.address && <p className="text-xs text-gray-500 mt-0.5">📍 {r.address}</p>}
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <StatusBadge status={r.status} />
                    <p className="text-[10px] text-gray-500 mt-1">{formatDate(r.due_date)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="p-4 border-t-2 border-gray-200 bg-gray-50 flex-shrink-0">
            <button onClick={() => setShowNotificationPopup(false)}
              className="w-full bg-gradient-to-r from-red-600 to-red-800 text-white py-3 rounded-xl font-bold transition-all">
              ✕ Tutup
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}


export function PopupLonceng({
  showBellPopup, myActiveReminders, perluAksiSaya, setShowBellPopup, setDetailReminder,
}: {
  showBellPopup: boolean;
  myActiveReminders: Reminder[];
  perluAksiSaya: { r: Reminder; alasan: string; warna: string }[];
  setShowBellPopup: (v: boolean) => void;
  setDetailReminder: (r: Reminder | null) => void;
}) {
  if (!(showBellPopup)) return null;
  return (
    <ModalPortal>
      <div role="dialog" aria-modal="true" className="fixed inset-0 bg-black/60 flex items-center justify-center z-[1000] p-4">
        <div className="bg-white/90 backdrop-blur-md rounded-2xl shadow-2xl max-w-lg w-full max-h-full overflow-hidden flex flex-col border-4 border-yellow-400"
          style={{ animation: 'scale-in 0.3s ease-out' }}>
          <div className="p-5 border-b-2 border-yellow-300 flex-shrink-0" style={{ background: 'linear-gradient(135deg,#f59e0b,#d97706)' }}>
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-3">
                <span className="text-3xl">🔔</span>
                <div>
                  <h3 className="text-lg font-bold text-white">Perlu Tindakan Kamu</h3>
                  {/* Dipecah per alasan: "5 aktif" tidak memberi tahu apakah
                      ada yang menunggu diputuskan atau semuanya tinggal
                      dikerjakan — padahal itu bedanya mendesak dan tidak. */}
                  <p className="text-sm text-white/90">
                    {(() => {
                      const n = (a: string) => perluAksiSaya.filter(x => x.alasan === a).length;
                      const bagian = [
                        n('Perlu kamu assign ke tim') && `${n('Perlu kamu assign ke tim')} perlu di-assign`,
                        n('Menunggu approval kamu')   && `${n('Menunggu approval kamu')} perlu approval`,
                        n('Perlu review kamu')        && `${n('Perlu review kamu')} perlu review`,
                        n('Dikerjakan kamu')          && `${n('Dikerjakan kamu')} dikerjakan kamu`,
                      ].filter(Boolean);
                      return bagian.length ? bagian.join(' · ') : 'Tidak ada yang menunggu';
                    })()}
                  </p>
                </div>
              </div>
              <button aria-label="Tutup" onClick={() => setShowBellPopup(false)} className="text-white hover:bg-white/20 rounded-lg p-2 font-bold">✕</button>
            </div>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-2">
            {myActiveReminders.length === 0 ? (
              <div className="text-center py-10 text-gray-500">
                <div className="text-5xl mb-3">✅</div>
                <p className="font-semibold">Tidak ada reminder aktif</p>
              </div>
            ) : perluAksiSaya.map(({ r, alasan, warna }) => (
              <div key={r.id} onClick={() => { setDetailReminder(r); setShowBellPopup(false); }}
                className="rounded-xl p-3 border-2 cursor-pointer hover:shadow-md hover:scale-[1.01] transition-all"
                style={{ background: 'rgba(249,250,251,0.9)', borderColor: warna + '55' }}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                      {/* Alasan ditaruh PALING DEPAN: yang dicari orang saat
                          membuka lonceng adalah "saya harus apa", bukan
                          kategori pekerjaannya. */}
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold text-white" style={{ background: warna }}>
                        {alasan}
                      </span>
                      <CategoryBadge category={r.category} />
                    </div>
                    <p className="font-bold text-sm text-gray-800 truncate">{(r.project_name || '').trim() || ((r as any).title || '').trim() || '—'}</p>
                    {r.address && <p className="text-xs text-gray-500 mt-0.5">📍 {r.address}</p>}
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <StatusBadge status={r.status} />
                    <p className="text-[10px] text-gray-500 mt-1">{formatDate(r.due_date)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="p-4 border-t-2 border-gray-200 bg-gray-50 flex-shrink-0">
            <button onClick={() => setShowBellPopup(false)}
              className="w-full bg-gradient-to-r from-red-600 to-red-800 text-white py-3 rounded-xl font-bold transition-all">
              ✕ Tutup
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
