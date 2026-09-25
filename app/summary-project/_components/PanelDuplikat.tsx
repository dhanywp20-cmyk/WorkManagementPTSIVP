'use client';

import { useState, useEffect, useCallback } from 'react';
import { ConfirmDialog, type ConfirmState } from '@/components/shared';
import { ambilKandidatDuplikat, gabungkanProject, type KandidatDuplikat } from '@/lib/summary-project';
import { IkonTeks } from '@/components/shared/Ikon';

/**
 * Pasangan project bernama mirip (trigram) - hasil sampingan pemetaan
 * otomatis yang membuat satu project per nama persis. Admin memilih arah
 * penggabungan: project yang DIPERTAHANKAN menerima seluruh aktivitas yang
 * lain. Pasangan yang memang berbeda (mis. "BINUS Alam Sutera" vs "BINUS
 * Taman Anggrek") cukup dilewati - tidak ada yang berubah.
 */
export function PanelDuplikat({ currentUserName, onBerubah }: {
  currentUserName: string;
  onBerubah: () => void;
}) {
  const [daftar, setDaftar] = useState<KandidatDuplikat[]>([]);
  const [memuat, setMemuat] = useState(true);
  const [galat, setGalat] = useState<string | null>(null);
  const [ambang, setAmbang] = useState(0.5);
  const [dilewati, setDilewati] = useState<Set<string>>(new Set());
  const [sibuk, setSibuk] = useState(false);
  const [pesan, setPesan] = useState<string | null>(null);
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);

  const muat = useCallback(async () => {
    setMemuat(true); setGalat(null);
    try { setDaftar(await ambilKandidatDuplikat(ambang)); }
    catch (e) { setGalat(e instanceof Error ? e.message : String(e)); }
    finally { setMemuat(false); }
  }, [ambang]);

  useEffect(() => { muat(); }, [muat]);

  const gabung = (asal: { id: string; code: string; name: string }, tujuan: { id: string; code: string; name: string }) =>
    setConfirmState({
      message: `Gabungkan ${asal.code} ke ${tujuan.code}?`,
      description: `"${asal.name}" dihapus, seluruh aktivitasnya masuk ke "${tujuan.name}".`,
      danger: true, confirmLabel: 'Gabungkan',
      onConfirm: async () => {
        setSibuk(true); setPesan(null);
        try {
          await gabungkanProject(asal.id, tujuan.id, currentUserName);
          setPesan(`${asal.code} digabung ke ${tujuan.code}.`);
          await muat(); onBerubah();
        } catch (e) {
          setPesan(`Gagal: ${e instanceof Error ? e.message : String(e)}`);
        } finally { setSibuk(false); }
      },
    });

  const tampil = daftar.filter(d => !dilewati.has(`${d.a_id}:${d.b_id}`));

  const Sisi = ({ code, name, total }: { code: string; name: string; total: number }) => (
    <span className="min-w-0 flex-1">
      <span className="block text-[10px] font-black text-indigo-500">{code} · {total} aktivitas</span>
      <span className="block text-sm font-bold text-gray-800 break-words">{name}</span>
    </span>
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-xs text-gray-500">
          Pilih project yang <b>dipertahankan</b>; yang satunya digabung ke sana. Lewati kalau memang project berbeda.
        </p>
        <label className="flex items-center gap-2 text-[11px] font-bold text-gray-500">
          Kemiripan min.
          <select value={ambang} onChange={e => setAmbang(Number(e.target.value))}
            className="px-2 py-1 rounded-lg border border-gray-200 bg-white text-gray-700">
            {[0.4, 0.5, 0.6, 0.7].map(v => <option key={v} value={v}>{Math.round(v * 100)}%</option>)}
          </select>
        </label>
      </div>

      {pesan && <div role="status" className="rounded-lg px-3 py-2 text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100">{pesan}</div>}

      <div className="border border-gray-100 rounded-xl divide-y divide-gray-100 max-h-[55vh] overflow-y-auto">
        {memuat ? (
          <p className="py-8 text-center text-xs text-gray-400">Memuat...</p>
        ) : galat ? (
          <p className="py-8 text-center text-xs text-red-500">Gagal memuat: {galat}</p>
        ) : tampil.length === 0 ? (
          <p className="py-8 text-center text-xs text-gray-400"><IkonTeks nama="🎉" />Tidak ada project bernama mirip.</p>
        ) : tampil.map(d => {
          const a = { id: d.a_id, code: d.a_code, name: d.a_name };
          const b = { id: d.b_id, code: d.b_code, name: d.b_name };
          return (
            <div key={`${d.a_id}:${d.b_id}`} className="p-3 space-y-2">
              <div className="flex items-start gap-3">
                <Sisi code={d.a_code} name={d.a_name} total={d.a_total} />
                <span className="text-[10px] font-black text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full flex-shrink-0 mt-1">{Math.round(d.skor * 100)}% mirip</span>
                <Sisi code={d.b_code} name={d.b_name} total={d.b_total} />
              </div>
              <div className="flex flex-wrap gap-1.5">
                <button type="button" disabled={sibuk} onClick={() => gabung(b, a)}
                  className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 disabled:opacity-50">
                  Pertahankan {d.a_code}
                </button>
                <button type="button" disabled={sibuk} onClick={() => gabung(a, b)}
                  className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 disabled:opacity-50">
                  Pertahankan {d.b_code}
                </button>
                <button type="button" onClick={() => setDilewati(s => new Set(s).add(`${d.a_id}:${d.b_id}`))}
                  className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-gray-500 bg-gray-100 hover:bg-gray-200">
                  Beda project, lewati
                </button>
              </div>
            </div>
          );
        })}
      </div>
      <ConfirmDialog state={confirmState} onCancel={() => setConfirmState(null)} />
    </div>
  );
}
