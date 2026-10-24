'use client';

/** FormLaporan - dipecah dari app/(portal)/daily-report/page.tsx (scripts/ekstrak-jsx.mjs). Semua keadaan tetap milik induk. */
import { inp, inpCls, card, avc, ini, emptyManual, CatPicker, SalesDrop } from './bantu-halaman';
import { FormField, SectionHeaderSmall } from '@/components/shared';
import { Ikon, IkonTeks } from '@/components/shared/Ikon';
import { type TeamUser, type GuestUser } from '@/app/(portal)/reminder-schedule/_components/shared';
import { type ReminderActivity, type TicketActivity, type ManualActivity, type TeamEntry } from './shared';

export interface FormLaporanProps {
  autoCount: number;
  currentUser: TeamUser | null;
  editingId: string | null;
  formDate: string;
  formLoading: boolean;
  formReminders: ReminderActivity[];
  formTickets: TicketActivity[];
  formUserId: string;
  galatSusun: string;
  guestUsers: GuestUser[];
  handleSave: () => Promise<void>;
  hapusDraf: () => void;
  isAdmin: boolean;
  manualActs: ManualActivity[];
  menyusun: boolean;
  reminderNotes: string;
  saving: boolean;
  setEditingId: import("react").Dispatch<import("react").SetStateAction<string | null>>;
  setFormDate: import("react").Dispatch<import("react").SetStateAction<string>>;
  setFormOpen: import("react").Dispatch<import("react").SetStateAction<boolean>>;
  setFormUserId: import("react").Dispatch<import("react").SetStateAction<string>>;
  setManualActs: import("react").Dispatch<import("react").SetStateAction<ManualActivity[]>>;
  setReminderNotes: import("react").Dispatch<import("react").SetStateAction<string>>;
  susunDenganAI: () => Promise<void>;
  targetUser: TeamUser | null | undefined;
  teamEntries: TeamEntry[];
  teamUsers: TeamUser[];
  updM: (key: string, p: Partial<ManualActivity>) => void;
  updT: (key: string, p: Partial<TeamEntry>) => void;
}

export function FormLaporan({ autoCount, currentUser, editingId, formDate, formLoading, formReminders, formTickets, formUserId, galatSusun, guestUsers, handleSave, hapusDraf, isAdmin, manualActs, menyusun, reminderNotes, saving, setEditingId, setFormDate, setFormOpen, setFormUserId, setManualActs, setReminderNotes, susunDenganAI, targetUser, teamEntries, teamUsers, updM, updT }: FormLaporanProps) {
  return (
    <>
      <div role="dialog" aria-modal="true" className="fixed inset-0 z-[1000] flex items-start justify-center overflow-y-auto" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', paddingTop: '20px', paddingBottom: '40px' }}>
        <div className="w-full max-w-2xl mx-4" style={{ ...card, overflow: 'visible' }}>
          {/* Modal header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <div>
              <h2 className="text-base font-bold text-slate-800">{editingId ? '✏️ Edit Report' : '📋 Buat Daily Report'}</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {formLoading ? 'Memuat aktivitas...' : autoCount > 0 ? `${formReminders.length} reminder + ${formTickets.length} ticket ter-insert otomatis` : 'Isi form di bawah'}
              </p>
            </div>
            <button aria-label="Tutup" onClick={() => { hapusDraf(); setFormOpen(false); setEditingId(null); }} className="p-2 rounded-xl hover:bg-gray-100 transition-all text-slate-500">
              <svg aria-hidden="true" focusable="false" className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          <div className="px-6 py-5 space-y-5 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 80px)' }}>

            {/* Identitas */}
            <div className="grid gap-3" style={{ gridTemplateColumns: isAdmin ? '1fr 1fr' : '1fr' }}>
              <FormField label="Tanggal *">
                <input type="date" value={formDate} onChange={e => setFormDate(e.target.value)} className={inpCls} style={inp} />
              </FormField>
              {isAdmin && (
                <FormField label="Anggota Team *">
                  <select aria-label="-- Pilih anggota --" value={formUserId} onChange={e => setFormUserId(e.target.value)} className={inpCls} style={inp}>
                    <option value="">-- Pilih anggota --</option>
                    {teamUsers.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
                  </select>
                </FormField>
              )}
            </div>
            {targetUser && (
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: 'rgba(220,38,38,0.05)', border: '1px solid rgba(220,38,38,0.15)' }}>
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ background: avc(targetUser.full_name) }}>{ini(targetUser.full_name)}</div>
                <div><p className="text-sm font-bold text-slate-800">{targetUser.full_name}</p><p className="text-xs text-slate-500">{targetUser.team_type} · {targetUser.sales_division || '-'}</p></div>
              </div>
            )}

            {/* Auto: Reminder + Ticket — info ringkas saja */}
            {(formReminders.length > 0 || formTickets.length > 0 || formLoading) && (
              <div className="px-4 py-3 rounded-xl flex items-center gap-3" style={{ background: 'rgba(14,165,233,0.06)', border: '1px solid rgba(14,165,233,0.18)' }}>
                {formLoading
                  ? <><div className="w-4 h-4 border-2 border-sky-300 border-t-sky-600 rounded-full animate-spin flex-shrink-0" /><span className="text-xs text-sky-700 font-semibold">Memuat aktivitas otomatis...</span></>
                  : <><span className="text-base"><Ikon nama="🔔" ukuran="1em" className="inline-block align-[-0.12em]" /></span><span className="text-xs text-sky-700 font-semibold">{formReminders.length} reminder &amp; {formTickets.length} ticket ter-insert otomatis dari platform</span><span className="ml-auto text-[11px] font-bold px-2 py-1 rounded-full" style={{ background: 'rgba(14,165,233,0.12)', color: '#0ea5e9' }}>Auto-insert</span></>
                }
              </div>
            )}

            {/* Manual activities */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-600 uppercase tracking-widest"><IkonTeks nama="✍" />Aktivitas Manual ({manualActs.length})</span>
              </div>
              <div className="space-y-4">
                {manualActs.map((m, idx) => (
                  <div key={m._key} className="rounded-xl p-4 space-y-3" style={{ background: 'rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.08)' }}>
                    <div className="flex items-center justify-between">
                      <SectionHeaderSmall icon="📌" title={`Aktivitas #${idx + 1}`} />
                      {manualActs.length > 1 && <button onClick={() => setManualActs(p => p.filter(x => x._key !== m._key))} className="text-xs text-red-600 hover:text-red-700">Hapus</button>}
                    </div>
                    <div><label className="block text-xs font-bold mb-1.5 text-slate-500 uppercase tracking-wider">Kategori</label><CatPicker value={m.category} onChange={v => updM(m._key, { category: v })} /></div>
                    <div className="grid grid-cols-2 gap-3">
                      <FormField label="Nama Project *"><input value={m.project_name} onChange={e => updM(m._key, { project_name: e.target.value })} className={inpCls} style={inp} placeholder="Project / kegiatan" /></FormField>
                      <FormField label="Lokasi"><div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm"><Ikon nama="📍" ukuran="1em" className="inline-block align-[-0.12em]" /></span><input value={m.address} onChange={e => updM(m._key, { address: e.target.value })} className={`${inpCls} pl-9`} style={inp} placeholder="Alamat / Online" /></div></FormField>
                    </div>
                    <FormField label="Sales"><SalesDrop value={m.sales_name} division={m.sales_division} guests={guestUsers} onChange={(n, d) => updM(m._key, { sales_name: n, sales_division: d })} /></FormField>
                    <div className="grid grid-cols-2 gap-3">
                      <FormField label="PIC"><input value={m.pic_name} onChange={e => updM(m._key, { pic_name: e.target.value })} className={inpCls} style={inp} placeholder="Nama PIC" /></FormField>
                      <FormField label="No. PIC"><input type="tel" value={m.pic_phone} onChange={e => updM(m._key, { pic_phone: e.target.value })} className={inpCls} style={inp} placeholder="08xxx" /></FormField>
                    </div>
                    <FormField label="Deskripsi"><textarea value={m.description} onChange={e => updM(m._key, { description: e.target.value })} rows={2} className={`${inpCls} resize-none`} style={inp} placeholder="Detail kegiatan..." /></FormField>
                  </div>
                ))}
                <button onClick={() => setManualActs(p => [...p, emptyManual(currentUser?.username ?? '')])}
                  className="w-full py-3 rounded-xl font-semibold text-sm" style={{ background: 'rgba(220,38,38,0.05)', color: '#dc2626', border: '1.5px dashed rgba(220,38,38,0.3)' }}>
                  + Tambah Aktivitas Manual
                </button>
              </div>
            </div>

            {/* Ringkasan hari ini - boleh disusun AI dari aktivitas di atas */}
            <div>
              <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                <span className="text-xs font-bold text-slate-600 uppercase tracking-widest"><IkonTeks nama="📝" />Ringkasan hari ini</span>
                <button type="button" onClick={susunDenganAI} disabled={menyusun || formLoading}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white disabled:opacity-60"
                  style={{ background: '#1d4ed8' }}>
                  {menyusun ? <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <Ikon nama="✨" ukuran={14} />}
                  {menyusun ? 'Menyusun...' : 'Susun dengan AI'}
                </button>
              </div>
              <textarea value={reminderNotes} onChange={e => setReminderNotes(e.target.value)} rows={4}
                className={`${inpCls} resize-y`} style={inp}
                placeholder="Ringkasan pekerjaan, hasil, dan kendala hari ini. Klik 'Susun dengan AI' untuk membuat draf dari aktivitas di atas." />
              {galatSusun
                ? <p className="text-xs font-semibold text-rose-700 mt-1">{galatSusun}</p>
                : <p className="text-[11px] text-slate-500 mt-1">Draf AI hanya merangkum aktivitas di atas. Periksa dan ubah bila perlu sebelum menyimpan.</p>}
            </div>

            {/* Team Entries (admin) */}
            {isAdmin && teamEntries.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-600 uppercase tracking-widest"><IkonTeks nama="👥" />Input Tim (Supervisor)</span>
                </div>
                <div className="space-y-4">
                  {teamEntries.map(e => (
                    <div key={e._key} className="rounded-xl p-4 space-y-3" style={{ background: 'rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.08)' }}>
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[11px] font-bold" style={{ background: avc(e.member_name) }}>{ini(e.member_name)}</div>
                        <p className="text-sm font-bold text-slate-700">{e.member_name}</p>
                      </div>
                      <CatPicker value={e.category} onChange={v => updT(e._key, { category: v })} />
                      <div className="grid grid-cols-2 gap-3">
                        <FormField label="Project"><input value={e.project_name} onChange={ev => updT(e._key, { project_name: ev.target.value })} className={inpCls} style={inp} placeholder="Nama project" /></FormField>
                        <FormField label="Lokasi"><input value={e.address} onChange={ev => updT(e._key, { address: ev.target.value })} className={inpCls} style={inp} placeholder="Alamat" /></FormField>
                      </div>
                      <FormField label="Sales"><SalesDrop value={e.sales_name} division={e.sales_division} guests={guestUsers} onChange={(n, d) => updT(e._key, { sales_name: n, sales_division: d })} /></FormField>
                      <FormField label="Catatan"><textarea value={e.supervisor_notes} onChange={ev => updT(e._key, { supervisor_notes: ev.target.value })} rows={2} className={`${inpCls} resize-none`} style={inp} placeholder="Catatan supervisor..." /></FormField>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Save */}
            <div className="flex gap-3 pt-2 pb-2">
              <button onClick={() => { hapusDraf(); setFormOpen(false); setEditingId(null); }} className="flex-1 py-3 rounded-xl font-semibold text-sm border border-gray-200 text-gray-600 hover:bg-gray-50 transition-all">Batal</button>
              <button onClick={handleSave} disabled={saving} className="tombol-utama flex-1 py-3 rounded-kontrol font-bold text-sm  flex items-center justify-center gap-2 transition-all">
                {saving && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                {editingId ? 'Simpan Perubahan' : '📋 Simpan Report'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
