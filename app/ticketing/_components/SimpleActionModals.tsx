'use client';
import { ModalPortal } from '@/components/shared';
import type { Ticket, TeamMember } from './shared';

/**
 * Modal-modal kecil & mandiri dari app/ticketing/page.tsx - masing-masing
 * cuma butuh satu ticket target + beberapa field lokal + satu handler
 * konfirmasi. Dipindah ke sini apa adanya (JSX identik, tanpa mengubah
 * logika) sebagai bagian pemecahan page.tsx yang tadinya 4.400+ baris
 * menjadi satu berkas. Semua state & handler TETAP di page.tsx - komponen
 * di sini murni presentasional, dioper lewat props.
 */

// ── OVERDUE SETTING ──

export function OverdueSettingModal({
  overdueTargetTicket, overdueForm, setOverdueForm, saveOverdueSetting,
  onClose, punyaSettingTersimpan, onHapusSetting,
}: {
  overdueTargetTicket: Ticket;
  overdueForm: { due_hours: string };
  setOverdueForm: (v: { due_hours: string }) => void;
  saveOverdueSetting: () => void;
  onClose: () => void;
  punyaSettingTersimpan: boolean;
  onHapusSetting: () => void;
}) {
  return (
    <ModalPortal>
      <div role="dialog" aria-modal="true" className="fixed inset-0 bg-black/60 flex items-center justify-center z-[1000] p-4">
        <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl max-w-md w-full p-6" style={{ animation: "scale-in 0.25s ease-out", border: "2px solid rgba(245,158,11,0.5)" }}>
          <div className="flex items-center gap-3 mb-4"><span className="text-3xl">⏰</span><div><h3 className="text-lg font-bold text-gray-800">Overdue Setting</h3><p className="text-xs text-gray-500 font-medium">{overdueTargetTicket.project_name}</p><p className="text-xs text-gray-400">{overdueTargetTicket.issue_case}</p></div></div>
          <p className="text-xs text-orange-700 rounded-lg p-2 mb-4" style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.2)" }}>⚠️ Setting ini hanya terlihat oleh admin Anda. Handler akan mendapat notifikasi merah ketika ticket overdue. Default otomatis: ticket overdue setelah 48 jam jika tidak di-set manual.</p>
          <div className="space-y-4"><div><label className="block text-sm font-bold mb-1 text-gray-700">⏱️ Overdue Setelah Berapa Jam?</label><div className="flex items-center gap-3"><input type="number" min="1" value={overdueForm.due_hours} onChange={(e) => setOverdueForm({ due_hours: e.target.value })} className="flex-1 rounded-lg px-3 py-2.5 text-lg font-bold text-center focus:ring-2 focus:ring-orange-500" style={{ border: "2px solid rgba(245,158,11,0.3)", background: "white" }} /><span className="text-gray-600 font-semibold text-sm">jam</span></div><div className="flex gap-2 mt-2">{[24, 48, 72, 96].map((h) => (<button key={h} type="button" onClick={() => setOverdueForm({ due_hours: String(h) })} className={`flex-1 py-1 rounded-lg text-xs font-bold border transition-all ${overdueForm.due_hours === String(h) ? "bg-orange-500 text-white border-orange-500" : "bg-orange-50 text-orange-700 border-orange-300 hover:bg-orange-100"}`}>{h}j{h === 48 ? " (default)" : ""}</button>))}</div><p className="text-xs text-gray-400 mt-2">⏰ Dihitung dari waktu ticket pertama kali dibuat</p></div><div className="grid grid-cols-2 gap-3 pt-2"><button onClick={saveOverdueSetting} className="bg-gradient-to-r from-orange-500 to-orange-700 text-white py-2.5 rounded-xl font-bold hover:from-orange-600 hover:to-orange-800 transition-all">💾 Simpan</button><button onClick={onClose} className="bg-gray-100 text-gray-700 py-2.5 rounded-xl font-bold hover:bg-gray-200 transition-all">✕ Batal</button></div>{punyaSettingTersimpan && (<button onClick={onHapusSetting} className="w-full bg-red-100 text-red-700 py-2 rounded-xl font-bold hover:bg-red-200 transition-all text-sm border border-red-300">🗑️ Hapus Setting Overdue</button>)}</div>
        </div>
      </div>
    </ModalPortal>
  );
}

// ── RE-OPEN TICKET (PTS) ──
// Z.overlayTop — bisa dibuka dari daftar MAUPUN dari dalam popup detail
// (Z.overlay), jadi harus selapis di atasnya.

export function ReopenPTSModal({
  reopenTargetTicket, reopenAssignee, setReopenAssignee, reopenNotes, setReopenNotes,
  teamPTSMembers, reopenTicket, uploading, onClose,
}: {
  reopenTargetTicket: Ticket;
  reopenAssignee: string;
  setReopenAssignee: (v: string) => void;
  reopenNotes: string;
  setReopenNotes: (v: string) => void;
  teamPTSMembers: TeamMember[];
  reopenTicket: () => void;
  uploading: boolean;
  onClose: () => void;
}) {
  return (
    <ModalPortal>
      <div role="dialog" aria-modal="true" className="fixed inset-0 bg-black/60 flex items-center justify-center z-[1100] p-4">
        <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl max-w-md w-full p-6" style={{ animation: "scale-in 0.25s ease-out", border: "2px solid rgba(245,158,11,0.5)" }}>
          <div className="flex items-center gap-3 mb-5"><span className="text-3xl">🔓</span><div><h3 className="text-lg font-bold text-gray-800">Re-open Ticket</h3><p className="text-xs text-gray-500">{reopenTargetTicket.project_name} · {reopenTargetTicket.issue_case}</p></div></div>
          <div className="rounded-xl p-3 mb-4 text-xs" style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.2)", color: "#b45309" }}>⚠️ Status akan berubah ke <strong>Pending</strong> dan activity log baru ditambahkan otomatis.</div>
          <div className="space-y-4"><div><label className="block text-sm font-bold mb-1 text-gray-700">Assign ke Handler *</label><select aria-label="— Pilih Handler —" value={reopenAssignee} onChange={(e) => setReopenAssignee(e.target.value)} className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-all focus:ring-2 focus:ring-red-500/40" style={{ background: "rgba(255,255,255,0.95)", border: "1px solid rgba(0,0,0,0.12)" }}><option value="">— Pilih Handler —</option>{teamPTSMembers.map((m) => (<option key={m.id} value={m.name}>{m.name}</option>))}</select></div><div><label className="block text-sm font-bold mb-1 text-gray-700">Alasan (opsional)</label><textarea value={reopenNotes} onChange={(e) => setReopenNotes(e.target.value)} placeholder="Masalah muncul kembali..." rows={3} className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-all focus:ring-2 focus:ring-red-500/40 resize-none" style={{ background: "rgba(255,255,255,0.95)", border: "1px solid rgba(0,0,0,0.12)" }} /></div><div className="grid grid-cols-2 gap-3"><button onClick={reopenTicket} disabled={uploading || !reopenAssignee} className="bg-gradient-to-r from-amber-500 to-amber-700 text-white py-2.5 rounded-xl font-bold hover:from-amber-600 hover:to-amber-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed">{uploading ? "⏳..." : "🔓 Re-open"}</button><button onClick={onClose} className="bg-gray-100 text-gray-700 py-2.5 rounded-xl font-bold hover:bg-gray-200 transition-all">Batal</button></div></div>
        </div>
      </div>
    </ModalPortal>
  );
}

// ── RE-OPEN SERVICES ──
// C2: konfirmasi Reopen Services - lebih sederhana dari modal PTS di atas
// (tidak perlu pilih assignee, sisi Services memang tidak punya konsep itu).

export function ReopenServicesModal({
  reopenServicesTarget, reopeningServices, reopenServicesTicket, onClose,
}: {
  reopenServicesTarget: Ticket;
  reopeningServices: boolean;
  reopenServicesTicket: () => void;
  onClose: () => void;
}) {
  return (
    <ModalPortal>
      <div role="dialog" aria-modal="true" className="fixed inset-0 bg-black/60 flex items-center justify-center z-[1100] p-4"
        onClick={(e) => { if (e.target === e.currentTarget && !reopeningServices) onClose(); }}>
        <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl max-w-md w-full p-6" style={{ animation: "scale-in 0.25s ease-out", border: "2px solid rgba(219,39,119,0.5)" }}>
          <div className="flex items-center gap-3 mb-5"><span className="text-3xl">🔓</span><div><h3 className="text-lg font-bold text-gray-800">Re-open Services</h3><p className="text-xs text-gray-500">{reopenServicesTarget.project_name} · {reopenServicesTarget.issue_case}</p></div></div>
          <div className="rounded-xl p-3 mb-5 text-xs" style={{ background: "rgba(219,39,119,0.1)", border: "1px solid rgba(219,39,119,0.2)", color: "#be185d" }}>⚠️ Status Services akan kembali ke <strong>Pending</strong>. Status utama PTS tidak ikut berubah.</div>
          <div className="grid grid-cols-2 gap-3">
            <button onClick={reopenServicesTicket} disabled={reopeningServices} className="bg-gradient-to-r from-pink-600 to-rose-700 text-white py-2.5 rounded-xl font-bold hover:from-pink-700 hover:to-rose-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed">{reopeningServices ? "⏳..." : "🔓 Re-open"}</button>
            <button onClick={onClose} disabled={reopeningServices} className="bg-gray-100 text-gray-700 py-2.5 rounded-xl font-bold hover:bg-gray-200 transition-all disabled:opacity-50">Batal</button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}

// ── REJECT TICKET — Soft reject dengan alasan ──

export function RejectModal({
  rejectTargetTicket, rejectReason, setRejectReason, uploading, confirmReject, onClose,
}: {
  rejectTargetTicket: Ticket;
  rejectReason: string;
  setRejectReason: (v: string) => void;
  uploading: boolean;
  confirmReject: () => void;
  onClose: () => void;
}) {
  return (
    <ModalPortal>
      <div role="dialog" aria-modal="true" className="fixed inset-0 bg-black/60 flex items-center justify-center z-[1100] p-4">
        <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl max-w-md w-full p-6" style={{ animation: "scale-in 0.25s ease-out", border: "2px solid rgba(220,38,38,0.4)" }}>
          <div className="flex items-center gap-3 mb-1">
            <span className="text-3xl">❌</span>
            <div>
              <h3 className="text-lg font-bold text-gray-800">Tolak Ticket</h3>
              <p className="text-xs text-gray-500 font-medium">{rejectTargetTicket.project_name}</p>
              <p className="text-xs text-gray-400">{rejectTargetTicket.issue_case}</p>
            </div>
          </div>
          <div className="rounded-xl p-3 mb-4 mt-3 text-xs" style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.3)", color: "#92400e" }}>
            💡 Ticket <strong>tidak dihapus</strong> — tetap tersimpan dengan status "Rejected". Sales dapat melihat alasan penolakan dan mengajukan ulang jika diperlukan.
          </div>
          <label className="block text-xs font-bold mb-1.5 tracking-widest uppercase" style={{ color: "#64748b" }}>Alasan Penolakan *</label>
          <textarea
            value={rejectReason}
            onChange={e => setRejectReason(e.target.value)}
            rows={3}
            placeholder="Contoh: Data tidak lengkap, harap isi nomor SN unit dan deskripsi masalah lebih detail..."
            className="w-full rounded-xl px-4 py-3 text-sm outline-none resize-none focus:ring-2 focus:ring-red-400"
            style={{ border: "1.5px solid rgba(220,38,38,0.3)", background: "rgba(255,255,255,0.95)" }}
            autoFocus
          />
          <div className="flex gap-3 mt-4">
            <button onClick={onClose}
              className="flex-1 py-2.5 rounded-xl font-semibold text-sm" style={{ background: "rgba(0,0,0,0.06)", color: "#475569" }}>
              Batal
            </button>
            <button onClick={confirmReject} disabled={uploading || !rejectReason.trim()}
              className="flex-1 py-2.5 rounded-xl font-bold text-sm text-white disabled:opacity-50"
              style={{ background: "linear-gradient(135deg,#dc2626,#991b1b)" }}>
              {uploading ? "⏳ Menyimpan..." : "❌ Tolak Ticket"}
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}

// ── DELETE TICKET (Admin Only) ──

export function DeleteModal({
  deleteTargetTicket, deleteConfirmText, setDeleteConfirmText, uploading, deleteTicket, onClose,
}: {
  deleteTargetTicket: Ticket;
  deleteConfirmText: string;
  setDeleteConfirmText: (v: string) => void;
  uploading: boolean;
  deleteTicket: () => void;
  onClose: () => void;
}) {
  return (
    <ModalPortal>
      <div role="dialog" aria-modal="true" className="fixed inset-0 bg-black/60 flex items-center justify-center z-[1000] p-4">
        <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl max-w-md w-full p-6" style={{ animation: "scale-in 0.25s ease-out", border: "2px solid rgba(220,38,38,0.5)" }}>
          <div className="flex items-center gap-3 mb-4"><span className="text-3xl">🗑️</span><div><h3 className="text-lg font-bold text-gray-800">Hapus Ticket</h3><p className="text-xs text-gray-500 font-medium">{deleteTargetTicket.project_name}</p><p className="text-xs text-gray-400">{deleteTargetTicket.issue_case}</p></div></div>
          <div className="rounded-xl p-3 mb-4 text-xs" style={{ background: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.2)", color: "#b91c1c" }}>
            ⚠️ <strong>Tindakan ini tidak dapat dibatalkan.</strong> Ticket beserta seluruh activity log dan overdue setting akan dihapus permanen dari database.
          </div>
          <div className="mb-4">
            <label className="block text-sm font-bold mb-1 text-gray-700">Ketik <span className="font-mono bg-red-100 text-red-700 px-1 rounded">HAPUS</span> untuk konfirmasi</label>
            <input
              type="text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="Ketik HAPUS di sini..."
              className="w-full rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-red-500"
              style={{ border: "2px solid rgba(220,38,38,0.3)", background: "white" }}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={deleteTicket}
              disabled={deleteConfirmText !== "HAPUS" || uploading}
              className="bg-gradient-to-r from-red-600 to-red-800 text-white py-2.5 rounded-xl font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:from-red-700 hover:to-red-900"
            >
              {uploading ? "⏳..." : "🗑️ Hapus Permanen"}
            </button>
            <button onClick={onClose} className="bg-gray-100 text-gray-700 py-2.5 rounded-xl font-bold hover:bg-gray-200 transition-all">✕ Batal</button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
