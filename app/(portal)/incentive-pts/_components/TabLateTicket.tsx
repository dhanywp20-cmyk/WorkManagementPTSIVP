'use client';

import { useEffect, useMemo, useState } from 'react';
import { Ikon, IkonTeks } from '@/components/shared/Ikon';
import {
  ambilSumberSupport, barisLampiran, cariKandidatTelat, formatRupiah, lampirkanTiketTelat, lepasTiketTelat,
  type KandidatTelat, type SumberSupport,
} from './calc';
import { bisaInput } from './aturan-halaman';
import { useKonteksInsentif } from './konteks-insentif';

const tglId = (v: string) => new Date(v).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });

export function TabLateTicket() {
  const k = useKonteksInsentif();
  const { currentUser, loading, notify, tab } = k.sesi;
  const { allSplits, lateTickets, muatUlangLampiran, skema, tranches } = k.tahapan;
  const aktif = tab === 'late' && bisaInput(currentUser) && !loading;
  const [sumber, setSumber] = useState<SumberSupport | null>(null);
  const [sibuk, setSibuk] = useState<string | null>(null);

  useEffect(() => {
    if (!aktif || sumber) return;
    let batal = false;
    ambilSumberSupport().then(({ data }) => { if (!batal) setSumber(data); });
    return () => { batal = true; };
  }, [aktif, sumber]);

  const memuat = !sumber;
  const kandidat = useMemo(
    () => (sumber ? cariKandidatTelat(sumber, tranches, allSplits, lateTickets, skema) : []),
    [sumber, tranches, allSplits, lateTickets, skema],
  );

  const infoTiket = useMemo(() => new Map((sumber?.tickets ?? []).map(t => [t.id, t])), [sumber]);
  const namaProyek = useMemo(() => new Map(tranches.map(t => [t.project_id, t.project?.project_name ?? ''])), [tranches]);
  const tahapTerbuka = (projectId: string, nomor: number) =>
    tranches.some(t => t.project_id === projectId && t.tranche_number === nomor && t.status === 'pending');

  const lampirkan = async (kd: KandidatTelat) => {
    setSibuk(kd.ticket_id);
    const { error } = await lampirkanTiketTelat(barisLampiran(kd));
    setSibuk(null);
    if (error) { notify('error', `Gagal melampirkan: ${error.message}`); return; }
    notify('success', kd.tahap_tujuan === null
      ? `Dicatat sebagai sunset - ${kd.project_name}`
      : `Dilampirkan ke tahap ${kd.tahap_tujuan} - ${kd.project_name}`);
    await muatUlangLampiran();
  };

  const lepas = async (id: string) => {
    setSibuk(id);
    const { error } = await lepasTiketTelat(id);
    setSibuk(null);
    if (error) { notify('error', `Gagal melepas: ${error.message}`); return; }
    notify('success', 'Lampiran dilepas');
    await muatUlangLampiran();
  };

  if (!aktif) return null;
  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl shadow-xs border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200" style={{ background: 'linear-gradient(135deg,rgba(245,158,11,0.08),rgba(234,88,12,0.05))' }}>
          <h2 className="font-bold text-gray-800"><IkonTeks nama="🕐" />Late Ticket Queue</h2>
          <p className="text-xs text-gray-500 mt-0.5">Ticket Troubleshooting yang masuk setelah cutoff project induk — dilampirkan ke tranche berikutnya yang belum dibayar.</p>
        </div>
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between gap-2">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Menunggu dilampirkan</p>
          <span className="text-xs font-bold text-amber-700">{memuat ? 'Memeriksa...' : `${kandidat.length} ticket`}</span>
        </div>
        {memuat
          ? <p className="px-5 py-6 text-center text-sm text-gray-500">Memeriksa ticket yang selesai setelah tahap diproses...</p>
          : kandidat.length === 0
            ? <p className="px-5 py-6 text-center text-sm text-gray-500 italic">Tidak ada ticket yang terlambat masuk.</p>
            : (
              <div className="divide-y divide-gray-100">
                {kandidat.map(kd => (
                  <div key={kd.ticket_id} className="px-5 py-3 flex items-center justify-between gap-3 flex-wrap hover:bg-amber-50/40 transition-colors">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">{kd.project_name}</p>
                      <p className="text-xs text-gray-500">
                        {kd.petugas || '-'} · selesai {tglId(kd.tgl_selesai)} · tahap {kd.tahap_asal} sudah diproses
                      </p>
                    </div>
                    <button onClick={() => lampirkan(kd)} disabled={sibuk !== null}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold text-white disabled:opacity-50 ${kd.tahap_tujuan === null ? 'bg-orange-500 hover:bg-orange-600' : 'bg-amber-600 hover:bg-amber-700'}`}>
                      {sibuk === kd.ticket_id ? 'Menyimpan...' : kd.tahap_tujuan === null ? 'Catat sebagai Sunset' : `Lampirkan ke Tahap ${kd.tahap_tujuan}`}
                    </button>
                  </div>
                ))}
              </div>
            )}
      </div>

      <div className="bg-white rounded-xl shadow-xs border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Sudah dilampirkan</p>
        </div>
        {lateTickets.length === 0
          ? (
            <div className="px-5 py-10 text-center">
              <p className="text-2xl mb-2"><Ikon nama="📭" ukuran="1em" className="inline-block align-[-0.12em]" /></p>
              <p className="text-sm text-gray-500 italic">Belum ada late ticket yang dilampirkan.</p>
            </div>
          )
          : (
            <div className="divide-y divide-gray-100">
              {lateTickets.map(lt => {
                const tiket = infoTiket.get(lt.late_ticket_id);
                const bisaLepas = lt.is_sunset || tahapTerbuka(lt.parent_project_id, lt.attached_tranche_number);
                return (
                  <div key={lt.id} className="px-5 py-3 flex items-center justify-between gap-3 flex-wrap hover:bg-amber-50/40 transition-colors">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">
                        {namaProyek.get(lt.parent_project_id) || tiket?.project_name || 'Project'} · Tranche {lt.attached_tranche_number}
                      </p>
                      <p className="text-xs text-gray-500">{tglId(lt.attached_at)}{lt.note ? ` · ${lt.note}` : ''}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      {lt.ticket_value > 0 && <span className="text-sm font-bold text-amber-700">{formatRupiah(lt.ticket_value)}</span>}
                      {lt.is_sunset && <span className="px-2 py-0.5 rounded-sm text-[11px] font-bold text-orange-600 bg-orange-50 border border-orange-200">Sunset</span>}
                      {bisaLepas
                        ? (
                          <button onClick={() => lepas(lt.id)} disabled={sibuk !== null}
                            className="px-2.5 py-1 rounded-lg text-xs font-bold text-gray-600 border border-gray-200 hover:bg-gray-50 disabled:opacity-50">
                            {sibuk === lt.id ? 'Melepas...' : 'Lepas'}
                          </button>
                        )
                        : <span className="text-[11px] font-bold text-emerald-700">Sudah diproses</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
      </div>
    </div>
  );
}
