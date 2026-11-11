'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Modal } from '@/components/shared/Modal';
import { ConfirmDialog, type ConfirmState } from '@/components/shared/ConfirmDialog';
import { Ikon } from '@/components/shared/Ikon';

interface TautanSld {
  id: string; room_idx: number; sld_id: string; versi: number; dilampirkan_oleh_nama: string; created_at: string;
  snapshot: { nama: string; created_at: string; dibuat_oleh_nama: string } | null;
  sumber: { nama: string; versi: number; diarsipkan_at: string | null } | null;
}
type Izin = { ok: true } | { ok: false; alasan: string };
interface SldTim { id: string; nama: string; versi: number; jumlah_perangkat: number; dibuat_oleh_nama: string; updated_at: string }

const tgl = (s: string) => new Date(s).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
const keTools = (t: Pick<TautanSld, 'sld_id' | 'versi'>) => `/tools-team?alat=sld&sld=${encodeURIComponent(t.sld_id)}&versi=${t.versi}`;

export function SldTools({ requestId, roomIdx, namaRuang, notify }: {
  requestId: string; roomIdx: number; namaRuang: string;
  notify: (tipe: 'success' | 'error' | 'info', pesan: string) => void;
}) {
  const [data, setData] = useState<{ tautan: TautanSld[]; izin: Izin[] } | null>(null);
  const [galat, setGalat] = useState('');
  const [sibuk, setSibuk] = useState(false);
  const [pilih, setPilih] = useState(false);
  const [daftar, setDaftar] = useState<SldTim[] | null>(null);
  const [cari, setCari] = useState('');
  const [konfirmasi, setKonfirmasi] = useState<ConfirmState | null>(null);
  const api = `/api/form-require-project/${encodeURIComponent(requestId)}/sld`;

  const muat = useCallback(async () => {
    try {
      const r = await fetch(api, { credentials: 'include', cache: 'no-store' });
      const j = await r.json().catch(() => null);
      if (!r.ok || !j?.ok) { setGalat(j?.alasan ?? 'SLD tertaut tidak bisa dimuat.'); setData({ tautan: [], izin: [] }); return; }
      setGalat(''); setData({ tautan: j.tautan, izin: j.izin });
    } catch { setGalat('Tidak terhubung ke server.'); setData({ tautan: [], izin: [] }); }
  }, [api]);
  useEffect(() => { void muat(); }, [muat]);

  const panggil = async (metode: 'POST' | 'PATCH' | 'DELETE', opsi: { body?: unknown; tautan?: string }, sukses: string) => {
    setSibuk(true);
    try {
      const r = await fetch(`${api}${opsi.tautan ? `?tautan=${encodeURIComponent(opsi.tautan)}` : ''}`, {
        method: metode, credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: opsi.body ? JSON.stringify(opsi.body) : undefined,
      });
      const j = await r.json().catch(() => null);
      if (!r.ok || !j?.ok) { notify('error', j?.alasan ?? 'Gagal. Coba lagi.'); return false; }
      notify('success', sukses); await muat(); return true;
    } catch { notify('error', 'Tidak terhubung ke server.'); return false; } finally { setSibuk(false); }
  };

  const bukaPilih = async () => {
    setPilih(true); setDaftar(null);
    try {
      const r = await fetch(`/api/tools-team/sld${cari.trim() ? `?q=${encodeURIComponent(cari.trim())}` : ''}`, { credentials: 'include', cache: 'no-store' });
      const j = await r.json().catch(() => null);
      setDaftar(r.ok && j?.ok ? (j.daftar as SldTim[]) : []);
    } catch { setDaftar([]); }
  };

  const tautan = useMemo(() => (data?.tautan ?? []).filter(t => t.room_idx === roomIdx), [data, roomIdx]);
  const bolehUbah = !!data?.izin[roomIdx]?.ok;
  if (!data) return null;
  if (!tautan.length && !bolehUbah && !galat) return null;

  return (
    <div className="rounded-xl border-2 border-blue-200 overflow-hidden">
      <div className="px-3 py-1.5 flex items-center justify-between gap-2 bg-blue-50 flex-wrap">
        <span className="text-[11px] font-bold text-blue-700 uppercase tracking-widest">
          SLD dari AV Solution Tools <span className="normal-case font-semibold text-blue-500">· tambahan, opsional</span>
        </span>
        {bolehUbah && (
          <button type="button" onClick={() => void bukaPilih()} disabled={sibuk}
            className="text-[11px] font-bold text-blue-800 bg-white border border-blue-200 hover:bg-blue-100 px-2.5 py-1 rounded-lg disabled:opacity-50">
            + Tautkan SLD
          </button>
        )}
      </div>
      {galat && <p className="px-3 py-2 text-[11.5px] text-rose-700">{galat}</p>}
      {!tautan.length ? (
        <p className="px-3 py-3 text-[11.5px] text-gray-500">
          Belum ada SLD dari AV Solution Tools untuk {namaRuang}. File SLD (PDF) tetap bisa diunggah seperti biasa; tautan ini tidak wajib.
        </p>
      ) : (
        <ul className="divide-y divide-blue-100">
          {tautan.map(t => {
            const nama = t.snapshot?.nama ?? t.sumber?.nama ?? 'SLD';
            const baru = t.sumber && !t.sumber.diarsipkan_at && t.sumber.versi > t.versi ? t.sumber.versi : null;
            return (
              <li key={t.id} className="px-3 py-2.5 flex items-start gap-3">
                <span className="shrink-0 w-9 h-9 rounded-lg bg-blue-50 border border-blue-100 grid place-items-center text-blue-600"><Ikon nama="📐" ukuran={18} /></span>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-bold text-gray-800 truncate">{nama} <span className="text-[11px] font-bold text-blue-700">v{t.versi}</span></p>
                  <p className="text-[11px] text-gray-500">ditautkan {t.dilampirkan_oleh_nama || '-'} · {tgl(t.created_at)}</p>
                  {baru && <p className="text-[11px] font-semibold text-amber-700">Versi terbaru di AV Solution Tools: v{baru} - request ini tetap memakai v{t.versi}.</p>}
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    <a href={keTools(t)} target="_blank" rel="noopener noreferrer"
                      className="text-[11px] font-bold text-blue-800 bg-white border border-blue-200 hover:bg-blue-50 px-2.5 py-1 rounded-lg">Buka di AV Solution Tools</a>
                    {bolehUbah && baru && (
                      <button type="button" disabled={sibuk} onClick={() => void panggil('PATCH', { body: { tautan_id: t.id } }, `SLD diperbarui ke v${baru}.`)}
                        className="text-[11px] font-bold text-amber-800 bg-amber-50 border border-amber-200 hover:bg-amber-100 px-2.5 py-1 rounded-lg disabled:opacity-50">Pakai v{baru}</button>
                    )}
                    {bolehUbah && (
                      <button type="button" disabled={sibuk} className="text-[11px] font-bold text-rose-700 bg-white border border-rose-200 hover:bg-rose-50 px-2.5 py-1 rounded-lg disabled:opacity-50"
                        onClick={() => setKonfirmasi({ message: `Lepas "${nama}" dari ${namaRuang}?`, description: 'SLD-nya tetap ada di AV Solution Tools.', confirmLabel: 'Lepas', danger: true,
                          onConfirm: () => { void panggil('DELETE', { tautan: t.id }, 'Tautan dilepas. SLD tetap ada di AV Solution Tools.'); } })}>Lepas</button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <Modal buka={pilih} onTutup={() => setPilih(false)} judul="Tautkan SLD dari AV Solution Tools" ukuran="md" ikon={<Ikon nama="📐" ukuran={18} />}>
        <div className="space-y-2">
          <input value={cari} onChange={e => setCari(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') void bukaPilih(); }} placeholder="Cari nama SLD, lalu Enter"
            aria-label="Cari SLD" className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
          <div className="max-h-[50vh] overflow-y-auto rounded-lg border border-gray-200 divide-y divide-gray-100">
            {daftar === null && <p className="p-3 text-sm text-gray-500">Memuat...</p>}
            {daftar?.length === 0 && <p className="p-3 text-sm text-gray-500">Belum ada SLD tersimpan. Buat & simpan SLD di AV Solution Tools → Single Line Diagram.</p>}
            {daftar?.map(x => (
              <button key={x.id} type="button" disabled={sibuk} className="w-full text-left p-2.5 hover:bg-blue-50 disabled:opacity-50"
                onClick={() => void panggil('POST', { body: { sld_id: x.id, room_idx: roomIdx } }, `SLD "${x.nama}" v${x.versi} ditautkan ke ${namaRuang}.`).then(ok => { if (ok) setPilih(false); })}>
                <p className="text-[13px] font-semibold text-gray-800">{x.nama} <span className="text-[11px] font-bold text-blue-700">v{x.versi}</span></p>
                <p className="text-[11px] text-gray-500">{x.jumlah_perangkat} perangkat · {x.dibuat_oleh_nama} · {tgl(x.updated_at)}</p>
              </button>
            ))}
          </div>
        </div>
      </Modal>
      <ConfirmDialog state={konfirmasi} onCancel={() => setKonfirmasi(null)} />
    </div>
  );
}
