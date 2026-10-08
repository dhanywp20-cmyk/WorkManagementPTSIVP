'use client';
import { ModalPortal } from '@/components/shared';
import type { Ticket, TeamMember, User } from './shared';
import { Ikon, IkonTeks } from '@/components/shared/Ikon';

/**
 * Modal assign/approve "sedang" (bukan yang paling kecil, tapi masih
 * bounded) dari app/ticketing/page.tsx - dipindah apa adanya (JSX identik)
 * sebagai bagian pemecahan berkas page.tsx. State & handler tetap di
 * page.tsx, komponen di sini murni presentasional.
 */

// ── BULK DELETE CONFIRM ──

export function BulkDeleteConfirmModal({
  jumlah, onCancel, onConfirm,
}: {
  jumlah: number;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <ModalPortal>
      <div role="dialog" aria-modal="true" className="fixed inset-0 bg-black/60 flex items-center justify-center z-[1000] p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden border-2 border-red-400">
          <div className="bg-gradient-to-r from-red-600 to-red-700 px-6 py-4 flex items-center gap-3">
            <span className="text-2xl"><Ikon nama="🗑" ukuran="1em" className="inline-block align-[-0.12em]" /></span>
            <div>
              <h3 className="font-bold text-white">Hapus {jumlah} Ticket?</h3>
              <p className="text-red-100 text-xs mt-0.5">Tindakan ini tidak dapat dibatalkan</p>
            </div>
          </div>
          <div className="p-6">
            <p className="text-sm text-gray-600 mb-5">
              Kamu akan menghapus <strong>{jumlah} ticket</strong> yang dipilih secara permanen dari sistem.
            </p>
            <div className="flex gap-3">
              <button onClick={onCancel}
                className="flex-1 border-2 border-gray-300 text-gray-700 py-2.5 rounded-xl font-bold hover:bg-gray-50 transition-all text-sm">
                Batal
              </button>
              <button onClick={onConfirm} className="flex-[2] bg-gradient-to-r from-red-600 to-red-700 text-white py-2.5 rounded-xl font-bold shadow-lg transition-all text-sm hover:from-red-700 hover:to-red-800">
                <IkonTeks nama="🗑" />Ya, Hapus Permanen
              </button>
            </div>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}

// ── SERVICES APPROVAL (ticket masuk ke Team Services) ──

export function ServicesApprovalModal({
  pendingServicesApprovalTickets, uploading, approveServicesTicket, rejectServicesTicket, onClose,
}: {
  pendingServicesApprovalTickets: Ticket[];
  uploading: boolean;
  approveServicesTicket: (ticket: Ticket) => void;
  rejectServicesTicket: (ticket: Ticket) => void;
  onClose: () => void;
}) {
  return (
    <ModalPortal>
      <div role="dialog" aria-modal="true" className="fixed inset-0 bg-black/60 flex items-center justify-center z-[1100] p-4">
        <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl max-w-2xl w-full max-h-full overflow-hidden flex flex-col" style={{ animation: "scale-in 0.25s ease-out", border: "2px solid rgba(219,39,119,0.5)" }}>
          <div className="p-6 flex-shrink-0" style={{ background: "linear-gradient(135deg,#db2777,#be185d)" }}>
            <div className="flex justify-between items-center"><div className="flex items-center gap-3"><span className="text-3xl"><Ikon nama="🔧" ukuran="1em" className="inline-block align-[-0.12em]" /></span><div><h3 className="text-xl font-bold text-white">Ticket Masuk — Team Services</h3><p className="text-sm text-white/90">{pendingServicesApprovalTickets.length} ticket menunggu konfirmasi</p></div></div><button aria-label="Tutup" onClick={onClose} className="text-white hover:bg-white/20 rounded-lg p-2 font-bold transition-all">✕</button></div>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
            {pendingServicesApprovalTickets.length === 0 ? (<div className="text-center py-12"><div className="text-5xl mb-3"><Ikon nama="✅" ukuran="1em" className="inline-block align-[-0.12em]" /></div><p className="text-gray-500 font-medium">Tidak ada ticket yang menunggu konfirmasi</p></div>) : pendingServicesApprovalTickets.map((ticket) => (
              <div key={ticket.id} className="rounded-xl p-4" style={{ background: "rgba(219,39,119,0.1)", border: "2px solid rgba(219,39,119,0.3)" }}>
                <div className="flex justify-between items-start mb-3"><div className="flex-1"><p className="font-bold text-lg text-gray-800"><Ikon nama="🏢" ukuran="1em" className="inline-block align-[-0.12em]" /> {ticket.project_name}</p><p className="text-sm text-gray-600 mt-0.5"><Ikon nama="⚠" ukuran="1em" className="inline-block align-[-0.12em]" /> {ticket.issue_case}</p>{ticket.description && <p className="text-xs text-gray-500 mt-1">{ticket.description}</p>}<div className="flex gap-3 mt-2 flex-wrap text-xs text-gray-500">{ticket.customer_phone && <span><Ikon nama="👤" ukuran="1em" className="inline-block align-[-0.12em]" /> {ticket.customer_phone}</span>}{ticket.sales_name && <span><Ikon nama="💼" ukuran="1em" className="inline-block align-[-0.12em]" /> {ticket.sales_name}</span>}{ticket.sn_unit && <span><IkonTeks nama="🔢" />SN: {ticket.sn_unit}</span>}{ticket.address && <span><Ikon nama="📍" ukuran="1em" className="inline-block align-[-0.12em]" /> {ticket.address}</span>}</div><p className="text-xs text-rose-700 font-semibold mt-2">Dikirim oleh Team PTS IVP • {ticket.date}</p></div><span className="px-3 py-1 rounded-full text-xs font-bold border-2 bg-rose-100 text-rose-800 border-rose-400 whitespace-nowrap ml-3"><IkonTeks nama="⏳" />Menunggu Konfirmasi</span></div>
                <div className="mt-3 border-t pt-3" style={{ borderColor: "rgba(219,39,119,0.3)" }}><p className="text-xs text-gray-600 mb-3 rounded-lg px-3 py-2" style={{ background: "rgba(219,39,119,0.05)", border: "1px solid rgba(219,39,119,0.2)" }}><IkonTeks nama="💡" />Terima ticket untuk mulai proses penanganan, atau tolak untuk mengembalikan ke Team PTS IVP.</p><div className="flex gap-2"><button onClick={() => approveServicesTicket(ticket)} disabled={uploading} className="flex-1 bg-gradient-to-r from-green-600 to-green-700 text-white px-4 py-2.5 rounded-lg font-bold hover:from-green-700 hover:to-green-800 transition-all disabled:opacity-40 disabled:cursor-not-allowed text-sm"><IkonTeks nama="✅" />Terima & Mulai Proses</button><button onClick={() => rejectServicesTicket(ticket)} disabled={uploading} className="flex-1 bg-gradient-to-r from-red-500 to-red-600 text-white px-4 py-2.5 rounded-lg font-bold hover:from-red-600 hover:to-red-700 transition-all disabled:opacity-40 text-sm"><IkonTeks nama="❌" />Tolak (Kembalikan ke PTS)</button></div></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}

// ── REMINDER SCHEDULE (cron WA) ──

/**
 * Reminder harian handler. Dulu tombol ini menjadwalkan pg_cron `daily-reminder` (fitur lama) - kini
 * reminder dikirim cron Vercel /api/cron/digest (Briefing pagi). Menyimpan jadwal lama justru
 * menghidupkan job pg_cron itu lagi sehingga WA terkirim DOBEL, jadi modal ini hanya menjelaskan.
 */
export function ReminderScheduleModal({ onClose }: { onClose: () => void }) {
  return (
    <ModalPortal>
      <div role="dialog" aria-modal="true" aria-labelledby="judul-reminder-harian" className="fixed inset-0 bg-black/60 flex items-center justify-center z-[1000] p-4"
        onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6" style={{ animation: "scale-in 0.25s ease-out", border: "2px solid rgba(124,58,237,0.5)" }}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <span className="text-3xl"><Ikon nama="⏰" ukuran="1em" className="inline-block align-[-0.12em]" /></span>
              <div><h3 id="judul-reminder-harian" className="text-lg font-bold text-gray-800">Reminder Harian</h3><p className="text-xs text-gray-500">Dikirim otomatis lewat Briefing pagi</p></div>
            </div>
            <button aria-label="Tutup" onClick={onClose} className="text-gray-500 hover:text-gray-700 text-xl font-bold">✕</button>
          </div>
          <div className="space-y-3 text-sm text-gray-700">
            <p>Setiap pagi pukul <b>06.00 WIB</b> tiap handler menerima satu ringkasan: ticket <b>Pending / In Progress</b> miliknya, ticket yang menunggu lebih dari 24 jam, jadwal reminder &amp; tenggat terdekat.</p>
            <p className="rounded-xl p-3 text-xs text-violet-800" style={{ background: "rgba(124,58,237,0.08)", border: "1px solid rgba(124,58,237,0.2)" }}>
              Kanal (WhatsApp, Telegram, notifikasi HP) dan isi briefing diatur di <b>Admin Panel → Integrations</b>. Jadwal lama di tombol ini sudah tidak dipakai supaya WA tidak terkirim dobel.
            </p>
          </div>
          <button onClick={onClose} className="mt-5 w-full bg-gray-100 text-gray-700 py-3 rounded-xl font-bold hover:bg-gray-200 transition-all">Tutup</button>
        </div>
      </div>
    </ModalPortal>
  );
}

// ── SUPERVISOR ASSIGN TICKET ──

export function SupervisorAssignModal({
  supAssignTicket, supAssignTo, setSupAssignTo, teamPTSMembers, currentUser,
  supAssignSaving, handleSupervisorAssignTicket, onClose,
}: {
  supAssignTicket: Ticket;
  supAssignTo: string;
  setSupAssignTo: (v: string) => void;
  teamPTSMembers: TeamMember[];
  currentUser: User | null;
  supAssignSaving: boolean;
  handleSupervisorAssignTicket: () => void;
  onClose: () => void;
}) {
  return (
    <ModalPortal>
      <div role="dialog" aria-modal="true" className="fixed inset-0 bg-black/60 flex items-center justify-center z-[1200] p-4"
        onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" style={{ animation: "scale-in 0.25s ease-out", border: "2px solid rgba(245,158,11,0.4)" }}>
          <div className="px-6 py-5 flex items-center justify-between" style={{ background: "linear-gradient(135deg,#f59e0b,#d97706)" }}>
            <div>
              <h3 className="text-lg font-bold text-white"><IkonTeks nama="🎯" />Assign ke Tim</h3>
              <p className="text-amber-100/90 text-xs mt-0.5 truncate max-w-[280px]">{supAssignTicket.project_name}</p>
            </div>
            <button aria-label="Tutup" onClick={onClose} className="bg-white/15 hover:bg-white/25 text-white p-2 rounded-lg">✕</button>
          </div>
          <div className="p-6 space-y-4">
            <div className="rounded-xl p-3 text-xs text-slate-600" style={{ background: "rgba(0,0,0,0.03)", border: "1px solid rgba(0,0,0,0.08)" }}>
              <Ikon nama="⚠" ukuran="1em" className="inline-block align-[-0.12em]" /> {supAssignTicket.issue_case} · {supAssignTicket.sales_name || "-"}{supAssignTicket.sales_division ? ` (${supAssignTicket.sales_division})` : ""}
            </div>
            <div>
              <label htmlFor="f-ticketing-components-assignapprovalmodals-1" className="block text-xs font-bold mb-1.5 tracking-widest uppercase text-slate-500">Assign ke *</label>
              <select id="f-ticketing-components-assignapprovalmodals-1" value={supAssignTo} onChange={e => setSupAssignTo(e.target.value)}
                className="w-full rounded-xl px-4 py-3 text-sm outline-none text-slate-800 focus:ring-2 focus:ring-amber-500/40"
                style={{ background: "#fff", border: "1px solid rgba(0,0,0,0.12)" }}>
                <option value="">-- Pilih --</option>
                <option value="SELF">Saya kerjakan sendiri</option>
                <optgroup label="Anggota Tim">
                  {teamPTSMembers.filter(m => m.name !== currentUser?.full_name).map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
                </optgroup>
              </select>
            </div>
            <div className="flex gap-3">
              <button onClick={onClose} className="flex-1 py-3 rounded-xl font-semibold text-sm" style={{ background: "#f8fafc", color: "#64748b", border: "1px solid rgba(0,0,0,0.12)" }}>Batal</button>
              <button onClick={handleSupervisorAssignTicket} disabled={supAssignSaving || !supAssignTo}
                className="flex-[2] text-white py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
                style={{ background: "linear-gradient(135deg,#f59e0b,#d97706)" }}>
                {supAssignSaving ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Menyimpan...</> : <>🎯 Assign</>}
              </button>
            </div>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
