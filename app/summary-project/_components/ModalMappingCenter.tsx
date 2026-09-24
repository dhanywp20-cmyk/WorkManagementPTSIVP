'use client';

import { useState, useEffect, useCallback } from 'react';
import { Modal, ConfirmDialog, type ConfirmState } from '@/components/shared';
import {
  ambilAntrean, ambilStatistikMapping, saranProject, petakanKeProject,
  abaikanRecord, buatProjectDariGrup, autoPetakanNamaPersis,
  type GrupAntrean, type SaranProject, type StatistikMapping, type ModulTerpeta,
} from '@/lib/summary-project';
import { supabase } from '@/lib/supabase';
import { PanelDuplikat } from './PanelDuplikat';

const MODUL_LABEL: Record<ModulTerpeta, { label: string; color: string }> = {
  reminders: { label: '🗓️ Schedule', color: '#0891b2' },
  tickets: { label: '🎫 Ticket', color: '#dc2626' },
  project_requests: { label: '🏗️ Design', color: '#7c3aed' },
};

function fmtTgl(s: string | null): string {
  if (!s) return '-';
  return new Date(s).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

/**
 * Mapping Center (admin): antrean record yang belum punya project.
 *
 * Satu baris = satu NAMA (record dengan nama sama setelah normalisasi
 * dikelompokkan), karena biasanya satu keputusan berlaku untuk semuanya.
 * Tiga keputusan per grup:
 *   - petakan ke project yang sudah ada (saran trigram, atau cari manual)
 *   - buat project baru dari nama ini
 *   - abaikan (record memang tidak punya project, mis. tiket internal)
 * Record di dalam grup bisa dicentang sebagian kalau ternyata nama yang sama
 * menunjuk project berbeda.
 */
export function ModalMappingCenter({ currentUserName, onTutup, onBerubah }: {
  currentUserName: string;
  onTutup: () => void;
  onBerubah: () => void;
}) {
  const [statistik, setStatistik] = useState<StatistikMapping | null>(null);
  const [antrean, setAntrean] = useState<GrupAntrean[]>([]);
  const [memuat, setMemuat] = useState(true);
  const [galat, setGalat] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const [aktif, setAktif] = useState<GrupAntrean | null>(null);
  const [terpilih, setTerpilih] = useState<Set<string>>(new Set());
  const [saran, setSaran] = useState<SaranProject[]>([]);
  const [cariManual, setCariManual] = useState('');
  const [hasilManual, setHasilManual] = useState<SaranProject[]>([]);
  const [namaBaru, setNamaBaru] = useState('');
  const [sibuk, setSibuk] = useState(false);
  const [pesan, setPesan] = useState<string | null>(null);
  const [tab, setTab] = useState<'antrean' | 'duplikat'>('antrean');
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);

  const muat = useCallback(async () => {
    setMemuat(true); setGalat(null);
    try {
      const [s, a] = await Promise.all([ambilStatistikMapping(), ambilAntrean()]);
      setStatistik(s); setAntrean(a);
    } catch (e) {
      setGalat(e instanceof Error ? e.message : String(e));
    } finally { setMemuat(false); }
  }, []);

  useEffect(() => { muat(); }, [muat]);

  const pilihGrup = async (g: GrupAntrean) => {
    setAktif(g); setNamaBaru(g.nama); setCariManual(''); setHasilManual([]);
    setTerpilih(new Set(g.records.map(r => `${r.source_module}:${r.source_record_id}`)));
    setSaran([]);
    setSaran(await saranProject(g.nama));
  };

  // Cari project manual (nama/kode), untuk kasus saran trigram tidak menemukannya.
  useEffect(() => {
    const kata = cariManual.replace(/[%,()*\\"]/g, ' ').trim();
    if (!kata) { setHasilManual([]); return; }
    const t = setTimeout(async () => {
      const { data } = await supabase.from('projects')
        .select('id, code, name, location, sales_name')
        .or(`name.ilike.%${kata}%,code.ilike.%${kata}%`).neq('status', 'archived').limit(8);
      setHasilManual(((data ?? []) as { id: string; code: string; name: string; location: string | null; sales_name: string | null }[])
        .map(p => ({ project_id: p.id, code: p.code, name: p.name, location: p.location, sales_name: p.sales_name, skor: 0 })));
    }, 300);
    return () => clearTimeout(t);
  }, [cariManual]);

  const recordTerpilih = () => (aktif?.records ?? [])
    .filter(r => terpilih.has(`${r.source_module}:${r.source_record_id}`));

  const jalankan = async (aksi: () => Promise<unknown>, sukses: string) => {
    if (!recordTerpilih().length) { setPesan('Centang minimal satu record.'); return; }
    setSibuk(true); setPesan(null);
    try {
      await aksi();
      setPesan(sukses); setAktif(null);
      await muat(); onBerubah();
    } catch (e) {
      setPesan(`Gagal: ${e instanceof Error ? e.message : String(e)}`);
    } finally { setSibuk(false); }
  };

  const autoPetakan = async () => {
    setSibuk(true); setPesan(null);
    try {
      const n = await autoPetakanNamaPersis(antrean, currentUserName);
      setPesan(n ? `${n} record dipetakan otomatis (nama sama persis dengan project yang ada).` : 'Tidak ada nama yang sama persis dengan project yang sudah ada.');
      if (n) { await muat(); onBerubah(); }
    } catch (e) {
      setPesan(`Gagal: ${e instanceof Error ? e.message : String(e)}`);
    } finally { setSibuk(false); }
  };

  const kataFilter = filter.trim().toLowerCase();
  const antreanTampil = kataFilter ? antrean.filter(g => g.kunci.includes(kataFilter)) : antrean;

  const KartuProject = ({ p }: { p: SaranProject }) => (
    <button type="button" disabled={sibuk}
      onClick={() => jalankan(() => petakanKeProject(recordTerpilih(), p.project_id, currentUserName), `Dipetakan ke ${p.code} · ${p.name}.`)}
      className="w-full text-left px-3 py-2 rounded-lg border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50/60 disabled:opacity-50 flex items-center justify-between gap-2">
      <span className="min-w-0">
        <span className="block text-sm font-bold text-gray-800 truncate">{p.name}</span>
        <span className="block text-[11px] text-gray-400 truncate">{p.code}{p.location ? ` · ${p.location}` : ''}{p.sales_name ? ` · ${p.sales_name}` : ''}</span>
      </span>
      {p.skor > 0 && <span className="text-[10px] font-bold text-indigo-600 flex-shrink-0">{Math.round(p.skor * 100)}%</span>}
    </button>
  );

  return (
    <Modal buka onTutup={onTutup} judul="🧭 Mapping Center" ikon="🧭" ukuran="xl"
      keterangan="Kaitkan record Schedule, Ticket, dan Design ke master project. Form Review otomatis ikut project reminder-nya.">
      <div className="space-y-4">
        {statistik && (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {([
              ['Belum terpeta', statistik.belum_terpeta, '#f59e0b'],
              ['Manual', statistik.manual_mapped, '#6366f1'],
              ['Otomatis', statistik.auto_mapped, '#10b981'],
              ['Diabaikan', statistik.diabaikan, '#6b7280'],
              ['Total project', statistik.total_project, '#0891b2'],
            ] as const).map(([label, nilai, warna]) => (
              <div key={label} className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2">
                <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">{label}</p>
                <p className="text-lg font-black" style={{ color: warna }}>{nilai}</p>
              </div>
            ))}
          </div>
        )}

        <div role="tablist" className="flex gap-1 border-b border-gray-200">
          {([['antrean', `Belum terpeta${statistik ? ` (${statistik.belum_terpeta})` : ''}`], ['duplikat', 'Kemungkinan duplikat']] as const).map(([k, label]) => (
            <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
              className={`px-3 py-2 text-xs font-bold -mb-px border-b-2 ${tab === k ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {label}
            </button>
          ))}
        </div>

        {tab === 'antrean' && (<>

        {pesan && (
          <div role="status" className="rounded-lg px-3 py-2 text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100">{pesan}</div>
        )}

        <div className="grid md:grid-cols-2 gap-4">
          {/* Antrean */}
          <div className="space-y-2 min-w-0">
            <div className="flex gap-2">
              <input aria-label="Saring antrean berdasarkan nama" value={filter} onChange={e => setFilter(e.target.value)}
                placeholder="Saring nama..."
                className="flex-1 min-w-0 px-3 py-2 rounded-lg text-sm outline-none bg-gray-50 border border-gray-200 focus:ring-2 focus:ring-indigo-400" />
              <button type="button" onClick={autoPetakan} disabled={sibuk || memuat || !antrean.length}
                title="Petakan grup yang namanya sama persis dengan satu project yang sudah ada"
                className="px-3 py-2 rounded-lg text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 disabled:opacity-50 flex-shrink-0">
                ⚡ Auto nama persis
              </button>
            </div>
            <div className="border border-gray-100 rounded-xl divide-y divide-gray-100 max-h-[55vh] overflow-y-auto">
              {memuat ? (
                <p className="py-8 text-center text-xs text-gray-400">Memuat antrean...</p>
              ) : galat ? (
                <p className="py-8 text-center text-xs text-red-500">Gagal memuat antrean: {galat}</p>
              ) : antreanTampil.length === 0 ? (
                <p className="py-8 text-center text-xs text-gray-400">{antrean.length ? 'Tidak ada nama yang cocok.' : '🎉 Semua record sudah terpeta.'}</p>
              ) : antreanTampil.map(g => (
                <button key={g.kunci} type="button" onClick={() => pilihGrup(g)}
                  className={`w-full text-left px-3 py-2.5 hover:bg-indigo-50/60 flex items-center justify-between gap-2 ${aktif?.kunci === g.kunci ? 'bg-indigo-50' : ''}`}>
                  <span className="text-sm font-semibold text-gray-800 truncate">{g.nama}</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 flex-shrink-0">{g.records.length}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Keputusan */}
          <div className="min-w-0">
            {!aktif ? (
              <div className="h-full min-h-[200px] rounded-xl border border-dashed border-gray-200 flex items-center justify-center text-xs text-gray-400 text-center p-6">
                Pilih satu nama di antrean untuk memutuskan project-nya.
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1">Record ({terpilih.size}/{aktif.records.length} dicentang)</p>
                  <div className="border border-gray-100 rounded-xl divide-y divide-gray-100 max-h-44 overflow-y-auto">
                    {aktif.records.map(r => {
                      const k = `${r.source_module}:${r.source_record_id}`;
                      const m = MODUL_LABEL[r.source_module];
                      return (
                        <label key={k} className="flex items-start gap-2 px-3 py-2 cursor-pointer hover:bg-gray-50">
                          <input type="checkbox" className="mt-0.5" checked={terpilih.has(k)}
                            onChange={e => setTerpilih(prev => {
                              const s = new Set(prev);
                              if (e.target.checked) s.add(k); else s.delete(k);
                              return s;
                            })} />
                          <span className="min-w-0">
                            <span className="block text-[10px] font-black" style={{ color: m.color }}>{m.label} · {fmtTgl(r.tanggal)}</span>
                            <span className="block text-[11px] text-gray-500 truncate">{r.info || r.project_name}</span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1">Saran project</p>
                  <div className="space-y-1.5">
                    {saran.length ? saran.map(p => <KartuProject key={p.project_id} p={p} />)
                      : <p className="text-[11px] text-gray-400">Tidak ada project yang namanya mirip.</p>}
                  </div>
                </div>

                <div>
                  <input aria-label="Cari project lain berdasarkan nama atau kode" value={cariManual} onChange={e => setCariManual(e.target.value)}
                    placeholder="Cari project lain (nama / PRJ-xxxx)..."
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none bg-gray-50 border border-gray-200 focus:ring-2 focus:ring-indigo-400" />
                  {hasilManual.length > 0 && (
                    <div className="space-y-1.5 mt-1.5">{hasilManual.map(p => <KartuProject key={p.project_id} p={p} />)}</div>
                  )}
                </div>

                <div className="rounded-xl border border-gray-100 p-3 space-y-2">
                  <label className="block">
                    <span className="block text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1">Atau buat project baru</span>
                    <input value={namaBaru} onChange={e => setNamaBaru(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg text-sm outline-none bg-gray-50 border border-gray-200 focus:ring-2 focus:ring-indigo-400" />
                  </label>
                  <div className="flex gap-2">
                    <button type="button" disabled={sibuk || !namaBaru.trim()}
                      onClick={() => jalankan(() => buatProjectDariGrup(namaBaru, recordTerpilih(), currentUserName), `Project "${namaBaru.trim()}" dibuat.`)}
                      className="flex-1 px-3 py-2 rounded-lg text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50">
                      ➕ Buat & petakan
                    </button>
                    <button type="button" disabled={sibuk}
                      onClick={() => setConfirmState({
                        message: `Abaikan ${recordTerpilih().length} record?`,
                        description: 'Record ditandai tidak punya project dan keluar dari antrean. Bisa dipetakan lagi nanti lewat basis data.',
                        confirmLabel: 'Abaikan',
                        onConfirm: () => jalankan(() => abaikanRecord(recordTerpilih(), currentUserName), 'Record diabaikan.'),
                      })}
                      className="px-3 py-2 rounded-lg text-xs font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 disabled:opacity-50">
                      🚫 Abaikan
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
        </>)}

        {tab === 'duplikat' && (
          <PanelDuplikat currentUserName={currentUserName} onBerubah={() => { muat(); onBerubah(); }} />
        )}
      </div>
      <ConfirmDialog state={confirmState} onCancel={() => setConfirmState(null)} />
    </Modal>
  );
}
