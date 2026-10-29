'use client';

/** LangkahCariProyek - dipecah dari app/(portal)/ticketing/_components/NewTicketModal.tsx (scripts/ekstrak-jsx.mjs). Semua keadaan tetap milik induk. */
import { Ikon } from '@/components/shared/Ikon';
import { Modal, TombolModal } from '@/components/shared';
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
    <Modal buka onTutup={onClose} judul="Cari Project yang Sudah Ada" keterangan="Hanya jadwal Konfigurasi, Konfigurasi & Training, atau Training - ticket tertaut ke Incentive PTS."
      footer={<>
        <TombolModal className="mr-auto" onClick={() => { setLangkah('pilih'); setPraPilih(null); setReminderQuery(''); setReminderResults([]); }}>← Kembali</TombolModal>
        <span className="hidden sm:inline text-[11px] text-slate-500 truncate max-w-[40%]">
          {praPilih ? `Dipilih: ${praPilih.project_name || praPilih.title}` : 'Belum ada yang dipilih'}
        </span>
        <TombolModal onClick={onClose}>Batal</TombolModal>
        <TombolModal jenis="utama" onClick={konfirmasiPilihan} disabled={!praPilih}>OK, Isi Form →</TombolModal>
      </>}>
          <div>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"><Ikon nama="🔍" ukuran="1em" className="inline-block align-[-0.12em]" /></span>
              <input
                type="text"
                autoFocus
                value={reminderQuery}
                onChange={e => handleQueryChange(e.target.value)}
                placeholder="Ketik nama project untuk mencari..."
                className="w-full rounded-xl pl-9 pr-4 py-2.5 text-sm outline-hidden transition-all text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-red-500/40 border border-slate-200"
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
                    Tidak ada jadwal Konfigurasi / Training bernama &quot;{reminderQuery.trim()}&quot; dalam jangkauan akun kamu.
                    Pencarian hanya mencakup project divisi kamu — kalau project ini milik divisi lain,
                    minta Admin atau Team PTS yang membuatkan ticket-nya.
                  </>
                ) : (
                  <>
                    Tidak ada jadwal Konfigurasi, Konfigurasi &amp; Training, atau Training bernama
                    &quot;{reminderQuery.trim()}&quot;. Kategori lain (Standby Event, Maintenance, ...)
                    sengaja tidak ditampilkan — coba potongan nama yang lebih pendek, atau tekan
                    Kembali dan pilih Project Baru.
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
                        {disorot && <span className="text-red-600 shrink-0">✓</span>}
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

    </Modal>
  );
}
