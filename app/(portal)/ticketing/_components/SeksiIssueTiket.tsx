'use client';

import { useState } from 'react';
import { salinBerkas } from '@/lib/unggah-tahan';
import { pesanGalat } from '@/lib/galat/pesan';
import { wajibCatatan } from '@/lib/alur-status-ticket';
import { IkonTeks } from '@/components/shared/Ikon';
import { PilihStatusPTS } from './PilihStatusPTS';
import { IsianPanjang, BlokPenanganan } from './KolomPenanganan';
import { formatDateTime, statusColors, type Ticket, type User } from './shared';
import {
  useIssueTiket, bolehTambahIssue, bolehUpdateIssue, bolehHapusIssue,
  type IssueTiket, type LogIssueTiket, type IsianIssueBaru, type IsianUpdateIssue,
} from './issue-tambahan';

const INPUT = 'w-full rounded-lg px-3 py-2 text-xs outline-hidden focus:ring-2 focus:ring-red-500/40 bg-white border border-black/12';
const LABEL = 'block text-[10px] font-bold mb-1 tracking-widest uppercase text-gray-500';

function ChipStatus({ status }: { status: string }) {
  return (
    <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusColors[status] ?? 'bg-gray-50 text-gray-600 border-gray-200'}`}>
      {status}
    </span>
  );
}

function NomorIssue({ n }: { n: number }) {
  return <span className="shrink-0 w-6 h-6 rounded-full bg-slate-800 text-white text-[10px] font-bold flex items-center justify-center">#{n}</span>;
}

function FormTambahIssue({ onSimpan, onBatal }: { onSimpan: (i: IsianIssueBaru) => Promise<void>; onBatal: () => void }) {
  const [isi, setIsi] = useState<IsianIssueBaru>({ issue_case: '', description: '', product: '', sn_unit: '' });
  const [simpan, setSimpan] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);
  const kirim = async () => {
    if (!isi.issue_case.trim()) { setGalat('Isi nama issue / kasusnya dulu.'); return; }
    setSimpan(true); setGalat(null);
    try { await onSimpan(isi); } catch (e) { setGalat(pesanGalat(e)); } finally { setSimpan(false); }
  };
  return (
    <div className="rounded-xl border-2 border-dashed border-red-200 bg-red-50/40 p-3 space-y-2.5">
      <p className="text-xs font-bold text-slate-800">Tambah issue lain di ticket ini</p>
      <div>
        <label htmlFor="issue-baru-kasus" className={LABEL}>Issue / Kasus *</label>
        <input id="issue-baru-kasus" value={isi.issue_case} autoFocus maxLength={200}
          onChange={e => setIsi({ ...isi, issue_case: e.target.value })}
          placeholder="Mis. Mic wireless ruang rapat putus-putus" className={INPUT} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label htmlFor="issue-baru-produk" className={LABEL}>Produk</label>
          <input id="issue-baru-produk" value={isi.product} onChange={e => setIsi({ ...isi, product: e.target.value })} placeholder="Opsional" className={INPUT} />
        </div>
        <div>
          <label htmlFor="issue-baru-sn" className={LABEL}>SN Unit</label>
          <input id="issue-baru-sn" value={isi.sn_unit} onChange={e => setIsi({ ...isi, sn_unit: e.target.value })} placeholder="Opsional" className={INPUT} />
        </div>
      </div>
      <div>
        <label htmlFor="issue-baru-desk" className={LABEL}>Deskripsi</label>
        <textarea id="issue-baru-desk" rows={2} value={isi.description} onChange={e => setIsi({ ...isi, description: e.target.value })}
          placeholder="Gejala / temuan di lokasi (opsional)" className={`${INPUT} resize-none`} />
      </div>
      {galat && <p role="alert" className="text-[11px] font-semibold text-red-600">{galat}</p>}
      <div className="flex gap-2 justify-end">
        <button type="button" onClick={onBatal} disabled={simpan} className="tombol-kedua px-3 py-1.5 rounded-kontrol text-xs font-bold">Batal</button>
        <button type="button" onClick={kirim} disabled={simpan || !isi.issue_case.trim()} className="tombol-utama px-3 py-1.5 rounded-kontrol text-xs font-bold">
          {simpan ? 'Menyimpan...' : 'Tambah Issue'}
        </button>
      </div>
    </div>
  );
}

function FormUpdateIssue({ issue, onSimpan, onBatal }: {
  issue: IssueTiket; onSimpan: (i: IsianUpdateIssue) => Promise<void>; onBatal: () => void;
}) {
  const bukaUlang = issue.status === 'Solved';
  const [isi, setIsi] = useState<IsianUpdateIssue>({ new_status: bukaUlang ? 'Pending' : '', action_taken: '', notes: '', photo: null });
  const [simpan, setSimpan] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);
  const notesWajib = bukaUlang || (isi.new_status !== '' && wajibCatatan(issue.status, isi.new_status));
  const kirim = async () => {
    if (!isi.new_status) { setGalat('Pilih status dulu.'); return; }
    if (notesWajib && !isi.notes.trim()) { setGalat('Notes wajib diisi.'); return; }
    setSimpan(true); setGalat(null);
    try { await onSimpan(isi); } catch (e) { setGalat(pesanGalat(e)); } finally { setSimpan(false); }
  };
  return (
    <div className="mt-2.5 rounded-lg border border-slate-200 bg-white p-2.5 space-y-2.5">
      {bukaUlang ? (
        <p className="text-[11px] font-semibold text-slate-600">Buka lagi issue ini - status kembali ke <b>Pending</b>. Tulis alasannya.</p>
      ) : (
        <PilihStatusPTS sekarang={issue.status} dipilih={isi.new_status}
          onPilih={st => setIsi({ ...isi, new_status: st })} />
      )}
      {isi.new_status !== '' && (
        <>
          {!bukaUlang && (
            <div>
              <label htmlFor={`aksi-${issue.id}`} className={LABEL}><IkonTeks nama="🔧" />Action Taken</label>
              <IsianPanjang id={`aksi-${issue.id}`} baris={3} value={isi.action_taken} onChange={v => setIsi({ ...isi, action_taken: v })}
                placeholder={"Langkah yang dilakukan, satu per baris\nmis. Cek kabel, ganti baterai, reset"} className={INPUT} />
            </div>
          )}
          <div>
            <label htmlFor={`catatan-${issue.id}`} className={LABEL}>
              <IkonTeks nama="📝" />Notes {notesWajib ? '*' : <span className="text-gray-500 normal-case">(opsional)</span>}
            </label>
            <IsianPanjang id={`catatan-${issue.id}`} baris={bukaUlang ? 3 : 5} value={isi.notes} onChange={v => setIsi({ ...isi, notes: v })} template={!bukaUlang}
              placeholder={bukaUlang ? 'Kenapa issue ini dibuka lagi?' : 'Kondisi awal, tindakan, hasil, dan rekomendasi...'} className={INPUT} />
          </div>
          <div>
            <label htmlFor={`foto-${issue.id}`} className={LABEL}><IkonTeks nama="📷" />Foto Bukti</label>
            <input id={`foto-${issue.id}`} type="file" accept="image/jpeg,image/jpg,image/png,image/webp"
              onChange={async e => { const photo = await salinBerkas(e.target.files?.[0]); setIsi(a => ({ ...a, photo })); }}
              className="w-full border border-black/12 rounded-lg px-2.5 py-1.5 text-xs bg-white file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-[11px] file:font-semibold file:bg-red-50 file:text-red-700" />
          </div>
        </>
      )}
      {galat && <p role="alert" className="text-[11px] font-semibold text-red-600">{galat}</p>}
      <div className="flex gap-2 justify-end">
        <button type="button" onClick={onBatal} disabled={simpan} className="tombol-kedua px-3 py-1.5 rounded-kontrol text-xs font-bold">Batal</button>
        <button type="button" onClick={kirim} disabled={simpan || !isi.new_status || (notesWajib && !isi.notes.trim())}
          className="tombol-utama px-3 py-1.5 rounded-kontrol text-xs font-bold">
          {simpan ? 'Menyimpan...' : bukaUlang ? 'Buka Lagi' : 'Simpan Update'}
        </button>
      </div>
    </div>
  );
}

function RiwayatIssue({ logs }: { logs: LogIssueTiket[] }) {
  if (logs.length === 0) return <p className="text-[11px] text-gray-500 py-1">Belum ada update.</p>;
  return (
    <div className="space-y-1.5 mt-2">
      {logs.map(l => (
        <div key={l.id} className="rounded-lg p-2 border border-gray-100 bg-gray-50/80">
          <div className="flex items-center justify-between gap-2 mb-0.5">
            <span className="text-[11px] font-bold text-gray-800 truncate">{l.handler_name}</span>
            <span className="flex items-center gap-1.5 shrink-0">
              <span className={`text-[10px] font-bold ${(statusColors[l.new_status] || 'text-gray-600').split(' ').filter(c => c.startsWith('text-')).join(' ')}`}>
                {l.dari_status && l.dari_status !== l.new_status ? `${l.dari_status} → ${l.new_status}` : l.new_status}
              </span>
              <span className="text-[10px] text-gray-500">{formatDateTime(l.created_at)}</span>
            </span>
          </div>
          <BlokPenanganan action={l.action_taken} notes={l.notes} kecil />
          {l.photo_url && (
            <img src={l.photo_url} alt={l.photo_name || 'foto bukti'} loading="lazy" decoding="async"
              className="mt-1 max-h-20 rounded-lg border cursor-pointer" onClick={() => window.open(l.photo_url, '_blank')} />
          )}
        </div>
      ))}
    </div>
  );
}

function KartuIssue({ issue, logs, bolehUpdate, bolehHapus, onUpdate, onHapus }: {
  issue: IssueTiket; logs: LogIssueTiket[]; bolehUpdate: boolean; bolehHapus: boolean;
  onUpdate: (i: IsianUpdateIssue) => Promise<void>; onHapus: () => Promise<void>;
}) {
  const [form, setForm] = useState(false);
  const [riwayat, setRiwayat] = useState(false);
  const [yakinHapus, setYakinHapus] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);
  const terakhir = logs[0];
  const info = [issue.product && `Produk: ${issue.product}`, issue.sn_unit && `SN: ${issue.sn_unit}`].filter(Boolean).join(' · ');

  return (
    <div className={`rounded-xl border p-3 ${issue.status === 'Solved' ? 'border-emerald-200 bg-emerald-50/30' : 'border-slate-200 bg-white'}`}>
      <div className="flex items-start gap-2">
        <NomorIssue n={issue.nomor} />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className="text-xs font-bold text-slate-800 leading-snug break-words">{issue.issue_case}</p>
            <ChipStatus status={issue.status} />
          </div>
          {info && <p className="text-[11px] text-slate-500 mt-0.5">{info}</p>}
          {issue.description && <p className="text-[11px] text-slate-600 mt-0.5 whitespace-pre-line">{issue.description}</p>}
          <p className="text-[10px] text-slate-400 mt-1">
            Ditambah {issue.dibuat_oleh_nama || issue.dibuat_oleh} · {formatDateTime(issue.created_at)}
            {terakhir && terakhir.created_at !== issue.created_at && <> · update terakhir {formatDateTime(terakhir.created_at)}</>}
          </p>

          <div className="flex flex-wrap items-center gap-1.5 mt-2">
            {bolehUpdate && !form && (
              <button type="button" onClick={() => setForm(true)}
                className={`${issue.status === 'Solved' ? 'tombol-kedua' : 'tombol-utama'} px-2.5 py-1 rounded-kontrol text-[11px] font-bold`}>
                {issue.status === 'Solved' ? <><IkonTeks nama="🔓" />Buka Lagi</> : '➕ Update Status'}
              </button>
            )}
            <button type="button" onClick={() => setRiwayat(r => !r)} aria-expanded={riwayat}
              className="tombol-kedua px-2.5 py-1 rounded-kontrol text-[11px] font-bold">
              {riwayat ? 'Sembunyikan riwayat' : `Riwayat (${logs.length})`}
            </button>
            {bolehHapus && (yakinHapus ? (
              <>
                <span className="text-[11px] font-semibold text-red-600">Hapus Issue #{issue.nomor} beserta riwayatnya?</span>
                <button type="button" onClick={async () => { try { await onHapus(); } catch (e) { setGalat(pesanGalat(e)); setYakinHapus(false); } }}
                  className="px-2.5 py-1 rounded-kontrol text-[11px] font-bold bg-red-600 text-white">Ya, hapus</button>
                <button type="button" onClick={() => setYakinHapus(false)} className="tombol-kedua px-2.5 py-1 rounded-kontrol text-[11px] font-bold">Batal</button>
              </>
            ) : (
              <button type="button" onClick={() => setYakinHapus(true)} aria-label={`Hapus Issue #${issue.nomor}`}
                className="ml-auto px-2 py-1 rounded-kontrol text-[11px] font-bold text-slate-400 hover:text-red-600">Hapus</button>
            ))}
          </div>
          {galat && <p role="alert" className="text-[11px] font-semibold text-red-600 mt-1">{galat}</p>}

          {form && (
            <FormUpdateIssue issue={issue} onBatal={() => setForm(false)}
              onSimpan={async isi => { await onUpdate(isi); setForm(false); setRiwayat(true); }} />
          )}
          {riwayat && <RiwayatIssue logs={logs} />}
        </div>
      </div>
    </div>
  );
}

export function SeksiIssueTiket({ ticket, currentUser }: { ticket: Ticket; currentUser: User | null }) {
  const { issues, logs, galatMuat, tambah, update, hapus } = useIssueTiket(ticket.id, !!currentUser);
  const [formTambah, setFormTambah] = useState(false);
  const bolehTambah = bolehTambahIssue(ticket, currentUser);
  const bolehUpdate = bolehUpdateIssue(ticket, currentUser);
  const bolehHapus = bolehHapusIssue(currentUser);

  if (!currentUser || galatMuat) return null;
  if (issues.length === 0 && !bolehTambah) return null;

  const terbuka = issues.filter(i => i.status !== 'Solved').length;

  return (
    <div className="px-4 py-3 border-b border-gray-100">
      <div className="flex items-center justify-between gap-2 mb-2">
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
          <IkonTeks nama="🧩" />Issue / Kasus ({issues.length + 1})
        </p>
        {issues.length > 0 && (
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${terbuka > 0 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
            {terbuka > 0 ? `${terbuka} issue tambahan belum Solved` : 'Semua issue tambahan Solved'}
          </span>
        )}
      </div>

      <div className="space-y-2">
        {issues.length > 0 && (
          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
            <div className="flex items-start gap-2">
              <NomorIssue n={1} />
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs font-bold text-slate-800 leading-snug break-words">{ticket.issue_case}</p>
                  <ChipStatus status={ticket.status} />
                </div>
                <p className="text-[10px] text-slate-500 mt-1">
                  Issue utama - diupdate lewat tombol <b>Update Status</b> ticket (Progress & Activity Log di bawah).
                  {terbuka > 0 && ticket.status !== 'Solved' && ' Ticket baru bisa Solved setelah semua issue tambahan Solved.'}
                </p>
              </div>
            </div>
          </div>
        )}

        {issues.map(i => (
          <KartuIssue key={i.id} issue={i} logs={logs.filter(l => l.issue_id === i.id)}
            bolehUpdate={bolehUpdate} bolehHapus={bolehHapus}
            onUpdate={isi => update(ticket, i, isi, currentUser)} onHapus={() => hapus(i)} />
        ))}

        {bolehTambah && (formTambah ? (
          <FormTambahIssue onBatal={() => setFormTambah(false)}
            onSimpan={async isi => { await tambah(ticket, isi, currentUser); setFormTambah(false); }} />
        ) : (
          <button type="button" onClick={() => setFormTambah(true)}
            className="w-full rounded-xl border-2 border-dashed border-slate-300 hover:border-red-300 hover:bg-red-50/40 py-2 text-xs font-bold text-slate-600 hover:text-red-700 transition-colors">
            ➕ Tambah Issue Lain
          </button>
        ))}
      </div>
    </div>
  );
}
