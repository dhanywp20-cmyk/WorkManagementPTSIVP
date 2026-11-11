'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Modal } from '@/components/shared/Modal';
import { ConfirmDialog, type ConfirmState } from '@/components/shared/ConfirmDialog';
import { Ikon } from '@/components/shared/Ikon';
import { isiLembar1 } from '@/lib/sld/lembar1';
import { WATERMARK_BAWAAN } from '@/lib/sld/lembar-umum';
import { HALAMAN, type DokSLD } from '@/lib/sld/tipe';
import { type DataSld, type TautanSld, dokTautanSld, namaTautanSld, ringkasanSld, tautanSldKeTools } from './sld-request';

interface SldTim { id: string; nama: string; versi: number; jumlah_perangkat: number; dibuat_oleh_nama: string; updated_at: string }

const tgl = (s: string) => new Date(s).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });

function Ringkasan({ requestId, t }: { requestId: string; t: TautanSld }) {
  const [dok, setDok] = useState<DokSLD | null | undefined>(undefined);
  useEffect(() => {
    let hidup = true;
    void dokTautanSld(requestId, t).then(d => { if (hidup) setDok(d); });
    return () => { hidup = false; };
  }, [requestId, t]);
  const svg = useMemo(() => (dok ? isiLembar1(dok, { watermark: WATERMARK_BAWAAN }) : ''), [dok]);
  if (dok === undefined) return <p className="mt-2 text-[11px] text-gray-500">Memuat pratinjau...</p>;
  if (!dok) return <p className="mt-2 text-[11px] text-rose-700">Isi SLD v{t.versi} tidak bisa dimuat.</p>;
  const baris = ringkasanSld(dok);
  return (
    <div className="mt-2 rounded-lg border border-gray-100 bg-gray-50 p-2 space-y-2">
      <svg viewBox={`0 0 ${HALAMAN.w} ${HALAMAN.h}`} className="block w-full h-auto rounded border border-gray-200 bg-white" style={{ colorScheme: 'light' }}
        role="img" aria-label={`Pratinjau Sheet 1 ${namaTautanSld(t)}`} dangerouslySetInnerHTML={{ __html: svg }} />
      {baris.length > 0 && (
        <table className="w-full text-[11px]">
          <tbody>
            {baris.map(p => (
              <tr key={`${p.no}|${p.model}`}>
                <td className="py-0.5 pr-2 text-gray-500">{p.kategori}</td>
                <td className="py-0.5 pr-2 text-gray-800">{p.model}</td>
                <td className="py-0.5 text-right font-bold text-gray-800 whitespace-nowrap">{p.qty}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="text-[11px] text-gray-500">{dok.perangkat.length} perangkat · {dok.kabel.length} kabel. Sheet 2 (daftar koneksi &amp; catatan) dibuka lengkap di AV Solution Tools.</p>
    </div>
  );
}

export function SldTools({ requestId, roomIdx, namaRuang, projectName, mintaPilih, data, muatUlang, notify }: {
  requestId: string; roomIdx: number; namaRuang: string; projectName: string; mintaPilih: number;
  data: DataSld | null;
  muatUlang: () => Promise<void>;
  notify: (tipe: 'success' | 'error' | 'info', pesan: string) => void;
}) {
  const semua = data?.tautan ?? null;
  const galat = data?.galat ?? '';
  const [sibuk, setSibuk] = useState(false);
  const [pilih, setPilih] = useState(false);
  const [buka, setBuka] = useState<string | null>(null);
  const [konfirmasi, setKonfirmasi] = useState<ConfirmState | null>(null);
  const izinIni = data?.izin[roomIdx];
  const bolehUbah = !!izinIni?.ok;
  const mintaTerakhir = useRef(mintaPilih);
  useEffect(() => {
    if (mintaPilih !== mintaTerakhir.current) { mintaTerakhir.current = mintaPilih; setPilih(true); }
  }, [mintaPilih]);
  const tautan = useMemo(() => (semua ?? []).filter(t => t.room_idx === roomIdx), [semua, roomIdx]);

  const panggil = async (metode: 'POST' | 'PATCH' | 'DELETE', opsi: { body?: unknown; tautan?: string }, sukses: string) => {
    setSibuk(true);
    try {
      const url = `/api/form-require-project/${encodeURIComponent(requestId)}/sld${opsi.tautan ? `?tautan=${encodeURIComponent(opsi.tautan)}` : ''}`;
      const r = await fetch(url, { method: metode, credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: opsi.body ? JSON.stringify(opsi.body) : undefined });
      const j = await r.json().catch(() => null);
      if (!r.ok || !j?.ok) { notify('error', j?.alasan ?? 'Gagal. Coba lagi.'); return false; }
      notify('success', sukses); await muatUlang(); return true;
    } catch { notify('error', 'Tidak terhubung ke server.'); return false; } finally { setSibuk(false); }
  };

  if (semua === null) return null;
  if (!tautan.length && !bolehUbah && !galat) return null;

  return (
    <div className="rounded-xl border-2 border-blue-200 overflow-hidden">
      <div className="px-3 py-1.5 flex items-center justify-between gap-2 bg-blue-50 flex-wrap">
        <span className="text-[11px] font-bold text-blue-700 uppercase tracking-widest">
          SLD dari AV Solution Tools <span className="normal-case font-semibold text-blue-500">· tambahan, opsional</span>
        </span>
        {bolehUbah && (
          <button type="button" onClick={() => setPilih(true)} disabled={sibuk}
            className="text-[11px] font-bold text-blue-800 bg-white border border-blue-200 hover:bg-blue-100 px-2.5 py-1 rounded-lg disabled:opacity-50">+ Tautkan SLD</button>
        )}
      </div>
      {galat && <p className="px-3 py-2 text-[11.5px] text-rose-700">{galat}</p>}
      {!tautan.length ? (
        <p className="px-3 py-3 text-[11.5px] text-gray-500">
          Belum ada SLD dari AV Solution Tools untuk {namaRuang}. File SLD (PDF) tetap bisa diunggah seperti biasa; tautan ini tidak wajib.
        </p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {tautan.map(t => {
            const nama = namaTautanSld(t);
            const terbaru = t.sumber && !t.sumber.diarsipkan_at && t.sumber.versi > t.versi ? t.sumber.versi : null;
            const terbuka = buka === t.id;
            return (
              <li key={t.id} className="p-3">
                <div className="flex gap-3">
                  <span className="w-12 h-12 shrink-0 rounded-lg border border-blue-100 bg-blue-50 grid place-items-center text-blue-600"><Ikon nama="📐" ukuran={20} /></span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-gray-800 truncate">
                      {nama}<span className="ml-1.5 text-[10px] font-black px-1.5 py-0.5 rounded-full bg-blue-700 text-white align-middle">v{t.versi}</span>
                    </p>
                    <p className="text-[11px] text-gray-500 mt-0.5">dibuat {t.snapshot?.dibuat_oleh_nama || '—'} · ditautkan {t.dilampirkan_oleh_nama || '—'} · {tgl(t.updated_at)}</p>
                    {terbaru && (
                      <p className="mt-1 text-[11px] font-semibold text-amber-700">
                        Versi terbaru v{terbaru} tersedia di AV Solution Tools - request ini tetap memakai v{t.versi}.
                        {bolehUbah && (
                          <button type="button" disabled={sibuk} onClick={() => setKonfirmasi({
                            message: `Pakai v${terbaru} untuk ${namaRuang}?`, description: `Versi v${t.versi} tetap tercatat di riwayat percakapan.`,
                            confirmLabel: `Pakai v${terbaru}`, onConfirm: () => { void panggil('PATCH', { body: { tautan_id: t.id } }, `Diperbarui ke v${terbaru}.`); },
                          })} className="ml-1.5 underline text-amber-800 hover:text-amber-900 disabled:opacity-50">Pakai v{terbaru}</button>
                        )}
                      </p>
                    )}
                    {t.sumber?.diarsipkan_at && <p className="mt-1 text-[11px] text-gray-500">SLD sumber sudah diarsipkan - versi v{t.versi} ini tetap tersimpan.</p>}
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <button type="button" onClick={() => setBuka(terbuka ? null : t.id)} aria-expanded={terbuka}
                    className="text-[11px] font-bold px-2.5 py-1 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50">{terbuka ? 'Tutup pratinjau' : 'Lihat pratinjau & perangkat'}</button>
                  <a href={tautanSldKeTools(t)} target="_blank" rel="noopener noreferrer"
                    className="text-[11px] font-bold px-2.5 py-1 rounded-lg border border-blue-200 text-blue-800 bg-blue-50 hover:bg-blue-100">Buka di AV Solution Tools</a>
                  {bolehUbah && (
                    <button type="button" disabled={sibuk} onClick={() => setKonfirmasi({
                      message: `Lepas "${nama}" dari ${namaRuang}?`, description: 'SLD-nya tetap ada di AV Solution Tools.', confirmLabel: 'Lepas', danger: true,
                      onConfirm: () => { void panggil('DELETE', { tautan: t.id }, 'Tautan dilepas. SLD tetap ada di AV Solution Tools.'); },
                    })} className="text-[11px] font-bold px-2.5 py-1 rounded-lg border border-rose-200 text-rose-700 hover:bg-rose-50 disabled:opacity-50">Lepas</button>
                  )}
                </div>
                {terbuka && <Ringkasan requestId={requestId} t={t} />}
              </li>
            );
          })}
        </ul>
      )}
      {izinIni && !izinIni.ok && tautan.length > 0 && /Completed/.test(izinIni.alasan) && (
        <p className="px-3 py-1.5 text-[11px] text-gray-500 border-t border-gray-100">🔒 {izinIni.alasan}</p>
      )}
      <PemilihSld buka={pilih} onTutup={() => setPilih(false)} projectName={projectName} namaRuang={namaRuang}
        sudah={new Set((semua ?? []).map(t => t.sld_id))} sibuk={sibuk}
        onPilih={async d => { if (await panggil('POST', { body: { sld_id: d.id, room_idx: roomIdx } }, `"${d.nama}" v${d.versi} ditautkan ke ${namaRuang}.`)) setPilih(false); }} />
      <ConfirmDialog state={konfirmasi} onCancel={() => setKonfirmasi(null)} />
    </div>
  );
}

function PemilihSld({ buka, onTutup, projectName, namaRuang, sudah, sibuk, onPilih }: {
  buka: boolean; onTutup: () => void; projectName: string; namaRuang: string; sudah: Set<string>; sibuk: boolean;
  onPilih: (d: SldTim) => void;
}) {
  const [q, setQ] = useState('');
  const [daftar, setDaftar] = useState<SldTim[] | null>(null);
  const [galat, setGalat] = useState('');

  useEffect(() => {
    if (!buka) return;
    let hidup = true;
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/tools-team/sld${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''}`, { credentials: 'include', cache: 'no-store' });
        const j = await r.json().catch(() => null);
        if (!hidup) return;
        if (r.ok && j?.ok) { setDaftar(j.daftar as SldTim[]); setGalat(''); } else { setDaftar([]); setGalat(j?.alasan ?? 'Daftar SLD tidak bisa dimuat.'); }
      } catch { if (hidup) { setDaftar([]); setGalat('Tidak terhubung ke server.'); } }
    }, q ? 300 : 0);
    return () => { hidup = false; clearTimeout(t); };
  }, [buka, q]);

  const cocok = (nama: string) => {
    const n = nama.toLowerCase();
    return [projectName, namaRuang].some(k => k && k.trim().length >= 3 && n.includes(k.trim().toLowerCase()));
  };
  const urut = [...(daftar ?? [])].sort((a, b) => Number(cocok(b.nama)) - Number(cocok(a.nama)));

  return (
    <Modal buka={buka} onTutup={onTutup} judul="Tautkan SLD dari AV Solution Tools" ukuran="md" ikon={<Ikon nama="📐" ukuran={18} />}
      keterangan={`Untuk ${namaRuang}. Yang ditautkan adalah versi saat ini - perubahan SLD berikutnya tidak mengubah request ini kecuali Anda memilih "Pakai versi terbaru".`}>
      <input value={q} onChange={e => setQ(e.target.value)} placeholder="Cari nama SLD atau pembuat" aria-label="Cari SLD"
        className="w-full rounded-xl border border-gray-200 px-3 py-2 text-base sm:text-sm mb-3" />
      {galat && <p className="text-[12px] text-rose-700 mb-2">{galat}</p>}
      {daftar === null ? <p className="text-sm text-gray-500">Memuat...</p> : urut.length === 0 ? (
        <p className="text-sm text-gray-500">
          {q ? 'Tidak ada SLD yang cocok.' : 'Belum ada SLD tersimpan.'} Buat & simpan SLD di AV Solution Tools → Single Line Diagram.
        </p>
      ) : (
        <ul className="space-y-2">
          {urut.map(d => {
            const dipakai = sudah.has(d.id);
            return (
              <li key={d.id} className="flex gap-3 items-center rounded-xl border border-gray-200 p-2">
                <span className="w-10 h-10 shrink-0 rounded-lg border border-blue-100 bg-blue-50 grid place-items-center text-blue-600"><Ikon nama="📐" ukuran={18} /></span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-bold text-gray-800 truncate">
                    {d.nama}
                    {cocok(d.nama) && <span className="ml-1.5 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-full align-middle">Disarankan</span>}
                  </p>
                  <p className="text-[11px] text-gray-500 truncate">v{d.versi} · {d.jumlah_perangkat} perangkat · {d.dibuat_oleh_nama || '—'} · {tgl(d.updated_at)}</p>
                </div>
                <button type="button" disabled={dipakai || sibuk} onClick={() => onPilih(d)}
                  className="shrink-0 px-3 py-1.5 rounded-lg text-[12px] font-bold text-white bg-blue-700 hover:bg-blue-800 disabled:bg-gray-300 disabled:text-gray-600">
                  {dipakai ? 'Sudah ditautkan' : 'Tautkan'}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Modal>
  );
}
