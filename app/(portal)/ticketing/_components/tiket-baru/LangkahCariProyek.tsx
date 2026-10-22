'use client';

/** LangkahCariProyek - dipecah dari app/(portal)/ticketing/_components/NewTicketModal.tsx (scripts/ekstrak-jsx.mjs). Semua keadaan tetap milik induk. */
import { Ikon, IkonTeks } from '@/components/shared/Ikon';
import { type ReminderRef } from '../NewTicketModal';
import { formatTanggal } from '@/lib/checklist';

export interface LangkahCariProyekProps {
  galatCari: string | null;
  handleQueryChange: (q: string) => void;
  konfirmasiPilihan: () => void;
  onClose: () => void;
  pencarianDibatasi: boolean;
  praPilih: ReminderRef | null;
  reminderQuery: string;
  reminderResults: ReminderRef[];
  reminderSearching: boolean;
  setLangkah: import("react").Dispatch<import("react").SetStateAction<"pilih" | "cari" | "form">>;
  setPraPilih: import("react").Dispatch<import("react").SetStateAction<ReminderRef | null>>;
  setReminderQuery: import("react").Dispatch<import("react").SetStateAction<string>>;
  setReminderResults: import("react").Dispatch<import("react").SetStateAction<ReminderRef[]>>;
  sorotPilihan: (r: ReminderRef) => void;
}

export function LangkahCariProyek({ galatCari, handleQueryChange, konfirmasiPilihan, onClose, pencarianDibatasi, praPilih, reminderQuery, reminderResults, reminderSearching, setLangkah, setPraPilih, setReminderQuery, setReminderResults, sorotPilihan }: LangkahCariProyekProps) {
  return (
    <>
      <div className="fixed inset-0 z-[200] flex items-center justify-center p-4"
        style={{ background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(3px)' }}>
        <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl overflow-hidden flex flex-col"
          style={{ maxHeight: '85vh' }} role="dialog" aria-modal="true" aria-labelledby="judul-cari-project">
          <div className="px-5 py-4 text-white flex items-center gap-3" style={{ background: 'linear-gradient(135deg,#dc2626,#991b1b)' }}>
            <button type="button" aria-label="Kembali"
              onClick={() => { setLangkah('pilih'); setPraPilih(null); setReminderQuery(''); setReminderResults([]); }}
              className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 hover:bg-white/10">
              <svg aria-hidden="true" focusable="false" className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div className="min-w-0">
              <h3 id="judul-cari-project" className="font-bold text-base"><IkonTeks nama="🔍" />Cari Project yang Sudah Ada</h3>
              <p className="text-[12px] text-white/80 mt-0.5">Ketik nama project, pilih dari hasilnya, lalu konfirmasi.</p>
            </div>
          </div>

          <div className="p-4 flex-1 overflow-y-auto min-h-0">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"><Ikon nama="🔍" ukuran="1em" className="inline-block align-[-0.12em]" /></span>
              <input
                type="text"
                autoFocus
                value={reminderQuery}
                onChange={e => handleQueryChange(e.target.value)}
                placeholder="Ketik nama project untuk mencari..."
                className="w-full rounded-xl pl-9 pr-4 py-2.5 text-sm outline-none transition-all text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-red-500/40 border border-slate-200"
              />
              {reminderSearching && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500">mencari...</span>
              )}
            </div>

            {!reminderSearching && galatCari && (
              <p className="mt-2 text-[11px] text-red-700 bg-red-50 border border-red-200 rounded-lg px-2 py-1.5 leading-snug">
                Pencarian gagal dijalankan, jadi daftar di bawah belum tentu lengkap.
                Tunjukkan pesan ini ke Admin: <span className="font-mono">{galatCari}</span>
              </p>
            )}

            {!reminderSearching && !galatCari && reminderQuery.trim().length >= 2 && reminderResults.length === 0 && (
              <p className="mt-2 text-[11px] text-slate-600 leading-snug">
                {pencarianDibatasi ? (
                  <>
                    Tidak ada project bernama &quot;{reminderQuery.trim()}&quot; dalam jangkauan akun kamu.
                    Pencarian hanya mencakup project divisi kamu — kalau project ini milik divisi lain,
                    minta Admin atau Team PTS yang membuatkan ticket-nya.
                  </>
                ) : (
                  <>
                    Tidak ada project bernama &quot;{reminderQuery.trim()}&quot;. Akun kamu mencari ke
                    SELURUH divisi, jadi kemungkinan besar namanya memang belum tercatat — coba
                    potongan nama yang lebih pendek, atau tekan Kembali dan pilih Project Baru.
                  </>
                )}
              </p>
            )}

            {/*
              Klik hasil hanya MENYOROTNYA (praPilih), belum mengisi form. Baru
              tombol "OK, Isi Form" di footer yang mengonfirmasi - supaya orang
              bisa membandingkan beberapa hasil dulu sebelum kolomnya terkunci
              ke satu pilihan.
            */}
            {reminderResults.length > 0 && (
              <div className="mt-2 rounded-xl border overflow-hidden" style={{ borderColor: 'rgba(220,38,38,0.2)' }}>
                {reminderResults.map(r => {
                  const disorot = praPilih?.id === r.id && praPilih?._sumber === r._sumber;
                  return (
                    <button key={`${r._sumber}-${r.id}`} type="button"
                      onClick={() => sorotPilihan(r)}
                      className="w-full text-left px-4 py-3 transition-colors border-b last:border-b-0 flex flex-col gap-0.5"
                      style={{
                        borderColor: 'rgba(0,0,0,0.06)',
                        background: disorot ? 'rgba(220,38,38,0.08)' : 'white',
                      }}>
                      <span className="flex items-center gap-2">
                        {disorot && <span className="text-red-600 flex-shrink-0">✓</span>}
                        <span className="text-sm font-bold text-slate-800">{r.project_name || r.title}</span>
                      </span>
                      <span className="text-xs text-slate-500 flex gap-3 flex-wrap pl-0">
                        {r.category && (
                          <span className={r._sumber === 'ticket' ? 'text-slate-500 font-semibold' : 'text-red-600 font-semibold'}>
                            {r._sumber === 'ticket' ? '🎫 Ticket lama' : r.category}
                          </span>
                        )}
                        {/* Satu project bisa punya beberapa jadwal - tanggalnya yang membedakan. */}
                        {r.due_date && <span><Ikon nama="📅" ukuran="1em" className="inline-block align-[-0.12em]" /> {formatTanggal(r.due_date)}</span>}
                        {r.address && <span><Ikon nama="📍" ukuran="1em" className="inline-block align-[-0.12em]" /> {r.address.slice(0, 50)}{r.address.length > 50 ? '…' : ''}</span>}
                        {r.sales_name && <span><Ikon nama="👤" ukuran="1em" className="inline-block align-[-0.12em]" /> {r.sales_name}</span>}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex justify-between items-center flex-shrink-0">
            <span className="text-[11px] text-slate-500">
              {praPilih ? `Dipilih: ${praPilih.project_name || praPilih.title}` : 'Belum ada yang dipilih'}
            </span>
            <div className="flex gap-2">
              <button type="button" onClick={onClose}
                className="px-4 py-2 rounded-lg text-sm font-bold text-slate-600 bg-white border border-slate-300 hover:bg-slate-100">
                Batal
              </button>
              <button type="button" onClick={konfirmasiPilihan} disabled={!praPilih}
                className="px-4 py-2 rounded-lg text-sm font-bold text-white transition-all disabled:opacity-40"
                style={{ background: 'linear-gradient(135deg,#dc2626,#991b1b)' }}>
                OK, Isi Form →
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
