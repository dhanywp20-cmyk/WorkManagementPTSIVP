'use client';
import { Modal, TombolModal } from '@/components/shared';
import { normalkanNama } from '@/lib/incentive/kelompok';
import type { Reminder } from './shared';
import { formatDate } from './shared';
import { Ikon } from '@/components/shared/Ikon';

export function TanyaLanjutanModal({
  tanyaLanjutan, onCancel, resolveGrupInsentif,
}: {
  tanyaLanjutan: { nama: string; sebelumnya: Reminder[]; lanjut: (grup: string | null) => void };
  onCancel: () => void;
  resolveGrupInsentif: (sumber: Reminder[]) => Promise<string>;
}) {
  return (
    <Modal buka onTutup={onCancel} judul="Proyek ini sudah punya jadwal" lapisan="atas" tutupDiLuar={false}
      footer={<>
        <TombolModal onClick={onCancel}>Batal</TombolModal>
        <TombolModal onClick={() => tanyaLanjutan.lanjut(null)}>Pekerjaan terpisah</TombolModal>
        <TombolModal jenis="utama" onClick={async () => tanyaLanjutan.lanjut(await resolveGrupInsentif(tanyaLanjutan.sebelumnya))}>Satu proyek yang sama</TombolModal>
      </>}>
          <div className="space-y-3 text-[13px] leading-relaxed">
            <p className="font-bold text-slate-800">{tanyaLanjutan.nama}</p>
            <div className="rounded-lg bg-slate-50 border border-slate-200 divide-y divide-slate-200 max-h-40 overflow-y-auto">
              {tanyaLanjutan.sebelumnya.slice(0, 6).map(r => (
                <div key={r.id} className="px-3 py-2 flex justify-between gap-3">
                  <span className="text-slate-700">{r.category}</span>
                  <span className="text-slate-500 text-right">{r.assign_name || '-'} · {formatDate(r.due_date)}</span>
                </div>
              ))}
            </div>
            <p className="text-slate-700">Jadwal yang sedang dibuat ini bagian dari proyek yang sama, atau pekerjaan terpisah?</p>
            <p className="text-[11.5px] text-slate-500">
              Kalau satu proyek, keduanya dihitung <b>satu pool insentif</b>. Kalau terpisah,
              masing-masing punya poolnya sendiri — pilih ini untuk kontrak yang berbeda.
            </p>
          </div>
    </Modal>
  );
}

export function PilihTipeReminderModal({
  buatUntukGuest, onPilihLama, onPilihBaru, onCancel,
}: {
  buatUntukGuest: boolean;
  onPilihLama: () => void;
  onPilihBaru: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal buka onTutup={onCancel} judul={buatUntukGuest ? 'Request Jadwal Baru' : 'Reminder Baru'}
      keterangan={buatUntukGuest ? 'Project-nya sudah pernah Anda ajukan, atau baru?' : 'Project-nya sudah pernah dijadwalkan, atau baru?'}
      footer={<TombolModal onClick={onCancel}>Batal</TombolModal>}>
          <div className="space-y-2.5">
            <button type="button" onClick={onPilihLama}
              className="w-full text-left p-3.5 rounded-xl border-2 border-slate-200 hover:border-slate-400 hover:bg-slate-50 transition-all">
              <div className="flex items-start gap-3">
                <span className="text-2xl shrink-0"><Ikon nama="🔍" ukuran="1em" className="inline-block align-[-0.12em]" /></span>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-800">
                    {buatUntukGuest ? 'Project Lama Anda — Satu BAST' : 'Project Lama — Satu BAST'}
                  </p>
                  <p className="text-[12px] text-slate-500 leading-relaxed mt-0.5">
                    {buatUntukGuest
                      ? 'Pernah Anda ajukan sebelumnya (mis. sudah Konfigurasi, sekarang tambah Training). Cari namanya — alamat, PIC, dan produk otomatis terisi.'
                      : 'Pernah dijadwalkan sebelumnya (mis. sudah Konfigurasi, sekarang tambah Training). Cari namanya — alamat, PIC, produk, sales, dan brand otomatis terisi.'}
                  </p>
                  <p className="text-[11px] font-semibold text-emerald-700 mt-1.5">
                    {buatUntukGuest
                      ? '✓ Disarankan — kalau serah-terimanya nanti satu BAST dengan yang lama. Hanya project Anda sendiri yang tampil di pencarian.'
                      : '✓ Disarankan — kalau serah-terimanya nanti satu BAST dengan jadwal lama'}
                  </p>
                </div>
              </div>
            </button>
            <button type="button" onClick={onPilihBaru}
              className="w-full text-left p-3.5 rounded-xl border-2 border-slate-200 hover:border-slate-400 hover:bg-slate-50 transition-all">
              <div className="flex items-start gap-3">
                <span className="text-2xl shrink-0"><Ikon nama="✏" ukuran="1em" className="inline-block align-[-0.12em]" /></span>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-800">Project Baru</p>
                  <p className="text-[12px] text-slate-500 leading-relaxed mt-0.5">
                    {buatUntukGuest ? 'Belum pernah Anda ajukan. Seluruh detailnya diisi manual.' : 'Belum pernah tercatat. Seluruh detailnya diisi manual.'}
                  </p>
                </div>
              </div>
            </button>
          </div>
    </Modal>
  );
}

export function CariProyekLamaModal({
  buatUntukGuest, carianProyek, setCarianProyek,
  praPilihProyek, setPraPilihProyek, hasilCarianProyek, reminders,
  onKembali, onBatal, konfirmasiProyekLama,
}: {
  buatUntukGuest: boolean;
  carianProyek: string;
  setCarianProyek: (v: string) => void;
  praPilihProyek: Reminder | null;
  setPraPilihProyek: (r: Reminder | null) => void;
  hasilCarianProyek: Reminder[];
  reminders: Reminder[];
  onKembali: () => void;
  onBatal: () => void;
  konfirmasiProyekLama: () => void;
}) {
  return (
    <Modal buka onTutup={onBatal} judul={buatUntukGuest ? 'Cari Project Lama Anda' : 'Cari Project yang Sudah Ada'}
      keterangan={buatUntukGuest ? 'Hanya project yang pernah Anda ajukan yang muncul di sini.' : 'Ketik nama project, pilih dari hasilnya, lalu konfirmasi.'}
      footer={<>
        <TombolModal className="mr-auto" onClick={onKembali}>← Kembali</TombolModal>
        <span className="hidden sm:inline text-[11px] text-slate-500 truncate max-w-[40%]">
          {praPilihProyek ? `Dipilih: ${praPilihProyek.project_name}` : 'Belum ada yang dipilih'}
        </span>
        <TombolModal onClick={onBatal}>Batal</TombolModal>
        <TombolModal jenis="utama" onClick={konfirmasiProyekLama} disabled={!praPilihProyek}>OK, Isi Form →</TombolModal>
      </>}>
          <div>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"><Ikon nama="🔍" ukuran="1em" className="inline-block align-[-0.12em]" /></span>
              <input type="text" autoFocus value={carianProyek}
                onChange={e => { setCarianProyek(e.target.value); setPraPilihProyek(null); }}
                placeholder="Ketik nama project untuk mencari..."
                className="w-full rounded-xl pl-9 pr-4 py-2.5 text-sm outline-hidden transition-all text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-slate-300 border border-slate-200" />
            </div>

            {hasilCarianProyek.length === 0 && (
              <p className="mt-2 text-[11px] text-slate-500 leading-snug">
                {carianProyek.trim()
                  ? (buatUntukGuest
                      ? <>Tidak ada project Anda bernama &quot;{carianProyek.trim()}&quot;. Pencarian ini hanya mencakup project yang pernah Anda ajukan sendiri - coba potongan nama yang lebih pendek, atau tekan Kembali dan pilih Project Baru.</>
                      : <>Tidak ada project bernama &quot;{carianProyek.trim()}&quot; dalam jangkauan akun kamu. Coba potongan nama yang lebih pendek, atau tekan Kembali dan pilih Project Baru.</>)
                  : (buatUntukGuest ? 'Belum ada project yang pernah Anda ajukan.' : 'Belum ada project tercatat.')}
              </p>
            )}

            {hasilCarianProyek.length > 0 && (
              <div className="mt-2 rounded-kontrol border border-slate-200 overflow-hidden">
                {hasilCarianProyek.map(r => {
                  const disorot = praPilihProyek?.id === r.id;
                  const jumlahJadwal = reminders.filter(x => normalkanNama(x.project_name) === normalkanNama(r.project_name)).length;
                  return (
                    <button key={r.id} type="button" onClick={() => setPraPilihProyek(r)}
                      className="w-full text-left px-4 py-3 transition-colors border-b last:border-b-0 flex flex-col gap-0.5"
                      style={{ borderColor: 'rgba(0,0,0,0.06)', background: disorot ? '#f1f5f9' : 'white' }}>
                      <span className="flex items-center gap-2">
                        {disorot && <span className="text-slate-800 shrink-0">✓</span>}
                        <span className="text-sm font-bold text-slate-800">{r.project_name}</span>
                      </span>
                      <span className="text-xs text-slate-500 flex gap-3 flex-wrap">
                        <span className="font-semibold text-slate-700">{jumlahJadwal} jadwal tercatat</span>
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
