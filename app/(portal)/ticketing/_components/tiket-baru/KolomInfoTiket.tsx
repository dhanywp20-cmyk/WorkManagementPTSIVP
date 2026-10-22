'use client';

/** KolomInfoTiket - dipecah dari app/(portal)/ticketing/_components/NewTicketModal.tsx (scripts/ekstrak-jsx.mjs). Semua keadaan tetap milik induk. */
import { Ikon, IkonTeks } from '@/components/shared/Ikon';
import { BRAND_OPTIONS } from '@/lib/brand-routing';
import { type NewTicketForm, type ReminderRef } from '../NewTicketModal';
import { formatTanggal } from '@/lib/checklist';

export interface KolomInfoTiketProps {
  form: NewTicketForm;
  galatCari: string | null;
  handleQueryChange: (q: string) => void;
  isExternalGuest: boolean;
  pencarianDibatasi: boolean;
  projectType: "new" | "existing";
  reminderQuery: string;
  reminderResults: ReminderRef[];
  reminderSearching: boolean;
  selectReminder: (r: ReminderRef) => void;
  selectedReminder: ReminderRef | null;
  set: (patch: Partial<NewTicketForm>) => void;
  setSelectedReminder: import("react").Dispatch<import("react").SetStateAction<ReminderRef | null>>;
  switchProjectType: (type: "new" | "existing") => void;
}

export function KolomInfoTiket({ form, galatCari, handleQueryChange, isExternalGuest, pencarianDibatasi, projectType, reminderQuery, reminderResults, reminderSearching, selectReminder, selectedReminder, set, setSelectedReminder, switchProjectType }: KolomInfoTiketProps) {
  return (
    <>
      <div className="space-y-4 satulayar:pr-2 satulayar:min-h-0">
      {/* Section: Informasi Ticket */}
      <div className="flex items-center gap-2 pb-2 border-b" style={{ borderColor: "rgba(0,0,0,0.1)" }}>
        <span className="text-lg"><Ikon nama="🎫" ukuran="1em" className="inline-block align-[-0.12em]" /></span>
        <span className="text-sm font-bold tracking-wide text-slate-700">Informasi Ticket</span>
      </div>

      {/* Brand — WAJIB utk Sales External. Menentukan Sales Internal (House/Global) yg di-CC. */}
      {isExternalGuest && (
        <div>
          <label className="block text-[11px] font-bold mb-1.5 tracking-widest uppercase" style={{ color: "#94a3b8" }}>
            Brand * <span className="normal-case text-slate-500 font-medium tracking-normal">(Sales Internal yang di-CC)</span>
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {BRAND_OPTIONS.map(opt => {
              const sel = form.brand === opt.value;
              return (
                <button key={opt.value} type="button" onClick={() => set({ brand: opt.value })}
                  className="px-3 py-2.5 rounded-xl border-2 text-center text-sm font-bold transition-all leading-tight"
                  style={sel
                    ? { borderColor: "#dc2626", background: "rgba(220,38,38,0.08)", color: "#b91c1c" }
                    : { borderColor: "rgba(0,0,0,0.1)", background: "rgba(255,255,255,0.6)", color: "#64748b" }}>
                  {opt.value === 'MVI' ? '🏠 ' : opt.value === 'IVP' ? '🌐 ' : '🏠🌐 '}{opt.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Project Type Toggle */}
      <div>
        <label className="block text-[11px] font-bold mb-2 tracking-widest uppercase" style={{ color: "#94a3b8" }}>Tipe Project</label>
        <div className="flex rounded-xl overflow-hidden border" style={{ borderColor: "rgba(0,0,0,0.12)" }}>
          <button type="button"
            onClick={() => switchProjectType('new')}
            className="flex-1 py-2.5 text-sm font-bold transition-all"
            style={projectType === 'new'
              ? { background: "linear-gradient(135deg,#dc2626,#991b1b)", color: "white" }
              : { background: "rgba(255,255,255,0.95)", color: "#64748b" }}>
            <IkonTeks nama="✏" />Project Baru
          </button>
          <button type="button"
            onClick={() => switchProjectType('existing')}
            className="flex-1 py-2.5 text-sm font-bold transition-all border-l"
            style={projectType === 'existing'
              ? { background: "linear-gradient(135deg,#dc2626,#991b1b)", color: "white", borderColor: "transparent" }
              : { background: "rgba(255,255,255,0.95)", color: "#64748b", borderColor: "rgba(0,0,0,0.12)" }}>
            <IkonTeks nama="🔍" />Project Existing
          </button>
        </div>
      </div>

      {/* Project Existing: Search */}
      {projectType === 'existing' && (
        <div>
          <label className="block text-[11px] font-bold mb-1.5 tracking-widest uppercase" style={{ color: "#94a3b8" }}>
            Cari Project (Request Schedule &amp; Ticket)
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"><Ikon nama="🔍" ukuran="1em" className="inline-block align-[-0.12em]" /></span>
            <input
              type="text"
              value={reminderQuery}
              onChange={e => handleQueryChange(e.target.value)}
              placeholder="Ketik nama project untuk mencari..."
              className="w-full rounded-xl pl-9 pr-4 py-2.5 text-sm outline-none transition-all text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-red-500/40"
              style={{ background: "rgba(255,255,255,0.95)", border: "1px solid rgba(0,0,0,0.12)" }}
            />
            {reminderSearching && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500">mencari...</span>
            )}
          </div>

          {/* Tidak ketemu — sebutkan kemungkinan penyebabnya.
              Hasil kosong bisa berarti project-nya memang tidak ada, ATAU
              ada tapi milik divisi lain sehingga di luar lingkup pencari.
              Tanpa keterangan ini keduanya terlihat sama, dan orang akan
              mengira sistemnya yang rusak.

              Keterangannya dibedakan menurut lingkup yang BENAR-BENAR
              dipakai. Menyebut "hanya divisi kamu" kepada akun yang justru
              mencari tanpa batas adalah keterangan yang salah - ia
              mengirim orang mengejar penyebab yang tidak ada, padahal
              jawabannya cuma "nama itu memang belum tercatat". */}
          {/* Kueri ditolak basis data - ini BUKAN "tidak ditemukan".
              Pesannya ditampilkan apa adanya supaya penyebabnya bisa
              dibaca, bukan ditebak dari layar yang tampak kosong. */}
          {!reminderSearching && galatCari && (
            <p className="mt-1.5 text-[11px] text-red-700 bg-red-50 border border-red-200 rounded-lg px-2 py-1.5 leading-snug">
              Pencarian gagal dijalankan, jadi daftar di bawah belum tentu lengkap.
              Tunjukkan pesan ini ke Admin: <span className="font-mono">{galatCari}</span>
            </p>
          )}

          {!reminderSearching && !galatCari && reminderQuery.trim().length >= 2 && reminderResults.length === 0 && (
            <p className="mt-1.5 text-[11px] text-slate-600 leading-snug">
              {pencarianDibatasi ? (
                <>
                  Tidak ada project bernama &quot;{reminderQuery.trim()}&quot; dalam jangkauan akun kamu.
                  Pencarian hanya mencakup project divisi kamu — kalau project ini milik divisi lain,
                  minta Admin atau Team PTS yang membuatkan ticket-nya.
                </>
              ) : (
                <>
                  Tidak ada project bernama &quot;{reminderQuery.trim()}&quot;. Akun kamu mencari ke
                  SELURUH divisi, jadi kemungkinan besar namanya memang belum tercatat di Reminder
                  Schedule maupun Ticketing — coba potongan nama yang lebih pendek, atau isi sebagai
                  Project Baru.
                </>
              )}
            </p>
          )}

          {/* Search Results */}
          {reminderResults.length > 0 && (
            <div className="mt-1 rounded-xl border overflow-hidden shadow-lg z-10"
              style={{ background: "white", borderColor: "rgba(220,38,38,0.2)" }}>
              {reminderResults.map(r => (
                <button key={`${r._sumber}-${r.id}`} type="button"
                  onClick={() => selectReminder(r)}
                  className="w-full text-left px-4 py-3 hover:bg-red-50 transition-colors border-b last:border-b-0 flex flex-col gap-0.5"
                  style={{ borderColor: "rgba(0,0,0,0.06)" }}>
                  <span className="text-sm font-bold text-slate-800">{r.project_name || r.title}</span>
                  <span className="text-xs text-slate-500 flex gap-3">
                    {r.category && (
                      <span className={r._sumber === 'ticket' ? 'text-slate-500 font-semibold' : 'text-red-600 font-semibold'}>
                        {r._sumber === 'ticket' ? '🎫 Ticket lama' : r.category}
                      </span>
                    )}
                    {r.due_date && <span><Ikon nama="📅" ukuran="1em" className="inline-block align-[-0.12em]" /> {formatTanggal(r.due_date)}</span>}
                    {r.address && <span><Ikon nama="📍" ukuran="1em" className="inline-block align-[-0.12em]" /> {r.address.slice(0, 50)}{r.address.length > 50 ? '…' : ''}</span>}
                    {r.sales_name && <span><Ikon nama="👤" ukuran="1em" className="inline-block align-[-0.12em]" /> {r.sales_name}</span>}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Selected reminder badge */}
          {selectedReminder && (
            <div className="mt-2 flex items-center gap-2 px-3 py-2 rounded-xl"
              style={{ background: "rgba(220,38,38,0.07)", border: "1px solid rgba(220,38,38,0.2)" }}>
              <span className="text-red-600 font-bold text-sm">✓</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-800 truncate">{selectedReminder.project_name || selectedReminder.title}</p>
                <p className="text-xs text-slate-500">{selectedReminder.category}{selectedReminder.due_date ? ` · ${formatTanggal(selectedReminder.due_date)}` : ''} · Data berhasil di-fill otomatis</p>
              </div>
              <button aria-label="Tutup" type="button"
                onClick={() => { setSelectedReminder(null); set({ project_name: '' }); }}
                className="text-xs text-red-600 hover:text-red-700 font-bold flex-shrink-0">✕</button>
            </div>
          )}
        </div>
      )}


      {/* Detail Project ikut kolom KIRI sampai kontak customer — sesuai
          urutan orang mengisinya: project apa, di mana, siapa yang dihubungi.
          Barang & keluhannya baru urusan kolom tengah. */}
      <div className="flex items-center gap-2 pb-2 border-b pt-2" style={{ borderColor: "rgba(0,0,0,0.08)" }}>
        <span className="text-sm"><Ikon nama="📋" ukuran="1em" className="inline-block align-[-0.12em]" /></span>
        <h3 className="text-sm font-bold tracking-wide text-slate-700">Detail Project</h3>
      </div>

      {/* Row 1: Project Name | Address */}
      <div className="grid grid-cols-1 gap-4">
        <div>
          <label className="block text-[11px] font-bold mb-1.5 tracking-widest uppercase" style={{ color: "#94a3b8" }}>
            Project Name *
            {projectType === 'existing' && selectedReminder && (
              <span className="ml-2 text-red-600 font-semibold normal-case text-[11px]"><IkonTeks nama="🔒" />dari reminder</span>
            )}
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2"><Ikon nama="📌" ukuran="1em" className="inline-block align-[-0.12em]" /></span>
            <input type="text" value={form.project_name}
              onChange={e => projectType === 'new' || !selectedReminder ? set({ project_name: e.target.value }) : undefined}
              readOnly={projectType === 'existing' && !!selectedReminder}
              placeholder={projectType === 'existing' ? 'Pilih project dari pencarian di atas' : 'Example: BCA Cibitung Project'}
              className="w-full rounded-xl pl-9 pr-4 py-2.5 text-sm outline-none transition-all text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-red-500/40"
              style={{
                background: projectType === 'existing' && selectedReminder ? "rgba(220,38,38,0.05)" : "rgba(255,255,255,0.95)",
                border: projectType === 'existing' && selectedReminder ? "1px solid rgba(220,38,38,0.3)" : "1px solid rgba(0,0,0,0.12)",
                cursor: projectType === 'existing' && selectedReminder ? 'default' : 'text',
              }} />
          </div>
        </div>
        <div>
          <label className="block text-[11px] font-bold mb-1.5 tracking-widest uppercase" style={{ color: "#94a3b8" }}><IkonTeks nama="📍" />Address Detail</label>
          <div className="relative">
            <span className="absolute left-3 top-3"><Ikon nama="📍" ukuran="1em" className="inline-block align-[-0.12em]" /></span>
            <textarea value={form.address} onChange={e => set({ address: e.target.value })}
              rows={2} placeholder="Example: Jl. Jend. Sudirman No. 1..."
              className="w-full rounded-xl pl-9 pr-4 py-2.5 text-sm outline-none transition-all text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-red-500/40 resize-none"
              style={{ background: "rgba(255,255,255,0.95)", border: "1px solid rgba(0,0,0,0.12)" }} />
          </div>
        </div>
      </div>


      {/* Kontak customer — penutup blok "di mana & siapa". */}
      <div>
        <div>
          <label className="block text-[11px] font-bold mb-1.5 tracking-widest uppercase" style={{ color: "#94a3b8" }}>Customer Phone</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2"><Ikon nama="📱" ukuran="1em" className="inline-block align-[-0.12em]" /></span>
            <input type="text" value={form.customer_phone} onChange={e => set({ customer_phone: e.target.value })}
              placeholder="Adi - 08xx-xxxx-xxxx"
              className="w-full rounded-xl pl-9 pr-4 py-2.5 text-sm outline-none transition-all text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-red-500/40"
              style={{ background: "rgba(255,255,255,0.95)", border: "1px solid rgba(0,0,0,0.12)" }} />
          </div>
        </div>
      </div>

      </div>
    </>
  );
}
