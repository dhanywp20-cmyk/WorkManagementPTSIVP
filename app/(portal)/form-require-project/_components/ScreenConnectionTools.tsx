'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Modal } from '@/components/shared/Modal';
import { ConfirmDialog, type ConfirmState } from '@/components/shared/ConfirmDialog';
import { Ikon } from '@/components/shared/Ikon';
import { type DataScreen, type TautanScreen, adaVersiBaru, svgTautanScreen, tautanScreenKeTools, urlGambarSvg } from './screen-connection-request';

interface FileLed {
  id: string; nama: string; dibuat_oleh_nama: string; updated_at: string;
  ringkasan: { project?: string; customer?: string; kode?: string; resX?: number; resY?: number };
}

const tgl = (s: string) => new Date(s).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });

function Pratinjau({ requestId, t }: { requestId: string; t: TautanScreen }) {
  const [svg, setSvg] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    let hidup = true;
    void svgTautanScreen(requestId, t).then(s => { if (hidup) setSvg(s); });
    return () => { hidup = false; };
  }, [requestId, t]);
  if (svg === undefined) return <p className="mt-2 text-[11px] text-gray-500">Memuat gambar...</p>;
  if (!svg) return <p className="mt-2 text-[11px] text-rose-700">Gambar Screen Connection tidak bisa dimuat.</p>;
  const url = urlGambarSvg(svg);
  return (
    <div className="mt-2 rounded-lg border border-gray-100 bg-gray-50 p-2 space-y-1.5">
      <a href={url} target="_blank" rel="noopener noreferrer" title="Buka gambar ukuran penuh">
        <img src={url} alt={`Screen Connection ${t.nama}`} className="block w-full h-auto rounded border border-gray-200 bg-white" />
      </a>
      <a href={url} download={`Screen Connection - ${t.nama}.svg`} className="inline-block text-[11px] font-bold text-cyan-800 hover:underline">Unduh gambar (SVG)</a>
    </div>
  );
}

export function ScreenConnectionTools({ requestId, roomIdx, namaRuang, projectName, mintaPilih, data, muatUlang, notify }: {
  requestId: string; roomIdx: number; namaRuang: string; projectName: string; mintaPilih: number;
  data: DataScreen | null;
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
      const url = `/api/form-require-project/${encodeURIComponent(requestId)}/screen-connection${opsi.tautan ? `?tautan=${encodeURIComponent(opsi.tautan)}` : ''}`;
      const r = await fetch(url, { method: metode, credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: opsi.body ? JSON.stringify(opsi.body) : undefined });
      const j = await r.json().catch(() => null);
      if (!r.ok || !j?.ok) { notify('error', j?.alasan ?? 'Gagal. Coba lagi.'); return false; }
      notify('success', sukses); await muatUlang(); return true;
    } catch { notify('error', 'Tidak terhubung ke server.'); return false; } finally { setSibuk(false); }
  };

  if (semua === null) return null;
  if (!tautan.length && !bolehUbah && !galat) return null;

  return (
    <div className="rounded-xl border-2 border-cyan-200 overflow-hidden">
      <div className="px-3 py-1.5 flex items-center justify-between gap-2 bg-cyan-50 flex-wrap">
        <span className="text-[11px] font-bold text-cyan-800 uppercase tracking-widest">
          Screen Connection dari AV Solution Tools <span className="normal-case font-semibold text-cyan-600">· otomatis</span>
        </span>
        {bolehUbah && (
          <button type="button" onClick={() => setPilih(true)} disabled={sibuk}
            className="text-[11px] font-bold text-cyan-900 bg-white border border-cyan-200 hover:bg-cyan-100 px-2.5 py-1 rounded-lg disabled:opacity-50">+ Tautkan Screen Connection</button>
        )}
      </div>
      {galat && <p className="px-3 py-2 text-[11.5px] text-rose-700">{galat}</p>}
      {!tautan.length ? (
        <p className="px-3 py-3 text-[11.5px] text-gray-500">
          Belum ada Screen Connection dari AV Solution Tools untuk {namaRuang}. Screen Connection dari aplikasi lain tetap bisa diunggah sebagai PDF.
        </p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {tautan.map(t => {
            const terbuka = buka === t.id;
            const baru = adaVersiBaru(t);
            return (
              <li key={t.id} className="p-3">
                <div className="flex gap-3">
                  <span className="w-12 h-12 shrink-0 rounded-lg border border-cyan-100 bg-cyan-50 grid place-items-center text-cyan-700"><Ikon nama="🖥️" ukuran={20} /></span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-gray-800 truncate">{t.nama}</p>
                    <p className="text-[11px] text-gray-500 mt-0.5">ditautkan {t.dilampirkan_oleh_nama || '—'} · {tgl(t.updated_at)}</p>
                    {baru && (
                      <p className="mt-1 text-[11px] font-semibold text-amber-700">
                        Hitungan di AV Solution Tools sudah diubah ({tgl(t.sumber!.updated_at)}) - request ini masih memakai gambar lama.
                        {bolehUbah && (
                          <button type="button" disabled={sibuk} onClick={() => setKonfirmasi({
                            message: `Perbarui gambar Screen Connection untuk ${namaRuang}?`, description: 'Gambar lama diganti dengan hasil simpan terakhir di AV Solution Tools.',
                            confirmLabel: 'Perbarui', onConfirm: () => { void panggil('PATCH', { body: { tautan_id: t.id } }, 'Gambar Screen Connection diperbarui.'); },
                          })} className="ml-1.5 underline text-amber-800 hover:text-amber-900 disabled:opacity-50">Perbarui</button>
                        )}
                      </p>
                    )}
                    {!t.led_id && <p className="mt-1 text-[11px] text-gray-500">Hitungan sumber sudah dihapus - gambar ini tetap tersimpan.</p>}
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <button type="button" onClick={() => setBuka(terbuka ? null : t.id)} aria-expanded={terbuka}
                    className="text-[11px] font-bold px-2.5 py-1 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50">{terbuka ? 'Tutup gambar' : 'Lihat gambar'}</button>
                  {t.led_id && (
                    <a href={tautanScreenKeTools(t)} target="_blank" rel="noopener noreferrer"
                      className="text-[11px] font-bold px-2.5 py-1 rounded-lg border border-cyan-200 text-cyan-900 bg-cyan-50 hover:bg-cyan-100">Buka di AV Solution Tools</a>
                  )}
                  {bolehUbah && (
                    <button type="button" disabled={sibuk} onClick={() => setKonfirmasi({
                      message: `Lepas "${t.nama}" dari ${namaRuang}?`, description: 'Hitungannya tetap ada di AV Solution Tools.', confirmLabel: 'Lepas', danger: true,
                      onConfirm: () => { void panggil('DELETE', { tautan: t.id }, 'Tautan dilepas. Hitungan tetap ada di AV Solution Tools.'); },
                    })} className="text-[11px] font-bold px-2.5 py-1 rounded-lg border border-rose-200 text-rose-700 hover:bg-rose-50 disabled:opacity-50">Lepas</button>
                  )}
                </div>
                {terbuka && <Pratinjau requestId={requestId} t={t} />}
              </li>
            );
          })}
        </ul>
      )}
      {izinIni && !izinIni.ok && tautan.length > 0 && /Completed/.test(izinIni.alasan) && (
        <p className="px-3 py-1.5 text-[11px] text-gray-500 border-t border-gray-100">🔒 {izinIni.alasan}</p>
      )}
      <PemilihLed buka={pilih} onTutup={() => setPilih(false)} projectName={projectName} namaRuang={namaRuang}
        sudah={new Set(tautan.map(t => t.led_id ?? ''))} sibuk={sibuk}
        onPilih={async d => { if (await panggil('POST', { body: { led_id: d.id, room_idx: roomIdx } }, `"${d.nama}" ditautkan ke ${namaRuang}.`)) setPilih(false); }} />
      <ConfirmDialog state={konfirmasi} onCancel={() => setKonfirmasi(null)} />
    </div>
  );
}

function PemilihLed({ buka, onTutup, projectName, namaRuang, sudah, sibuk, onPilih }: {
  buka: boolean; onTutup: () => void; projectName: string; namaRuang: string; sudah: Set<string>; sibuk: boolean;
  onPilih: (d: FileLed) => void;
}) {
  const [q, setQ] = useState('');
  const [daftar, setDaftar] = useState<FileLed[] | null>(null);
  const [galat, setGalat] = useState('');

  useEffect(() => {
    if (!buka) return;
    let hidup = true;
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/tools-team/led${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''}`, { credentials: 'include', cache: 'no-store' });
        const j = await r.json().catch(() => null);
        if (!hidup) return;
        if (r.ok && j?.ok) { setDaftar(j.daftar as FileLed[]); setGalat(''); } else { setDaftar([]); setGalat(j?.alasan ?? 'Daftar hitungan LED tidak bisa dimuat.'); }
      } catch { if (hidup) { setDaftar([]); setGalat('Tidak terhubung ke server.'); } }
    }, q ? 300 : 0);
    return () => { hidup = false; clearTimeout(t); };
  }, [buka, q]);

  const cocok = (d: FileLed) => {
    const teks = [d.nama, d.ringkasan?.project, d.ringkasan?.customer].filter(Boolean).join(' ').toLowerCase();
    return [projectName, namaRuang].some(k => k && k.trim().length >= 3 && teks.includes(k.trim().toLowerCase()));
  };
  const urut = [...(daftar ?? [])].sort((a, b) => Number(cocok(b)) - Number(cocok(a)));

  return (
    <Modal buka={buka} onTutup={onTutup} judul="Tautkan Screen Connection dari AV Solution Tools" ukuran="md" ikon={<Ikon nama="🖥️" ukuran={18} />}
      keterangan={`Untuk ${namaRuang}. Yang ditautkan adalah gambar Screen Connection saat hitungan terakhir disimpan di AV Solution Tools → LED Videotron.`}>
      <input value={q} onChange={e => setQ(e.target.value)} placeholder="Cari nama hitungan, project, atau pembuat" aria-label="Cari hitungan LED"
        className="w-full rounded-xl border border-gray-200 px-3 py-2 text-base sm:text-sm mb-3" />
      {galat && <p className="text-[12px] text-rose-700 mb-2">{galat}</p>}
      {daftar === null ? <p className="text-sm text-gray-500">Memuat...</p> : urut.length === 0 ? (
        <p className="text-sm text-gray-500">
          {q ? 'Tidak ada hitungan yang cocok.' : 'Belum ada hitungan LED tersimpan.'} Buat & simpan di AV Solution Tools → LED Videotron.
        </p>
      ) : (
        <ul className="space-y-2">
          {urut.map(d => {
            const dipakai = sudah.has(d.id);
            const r = d.ringkasan ?? {};
            return (
              <li key={d.id} className="flex gap-3 items-center rounded-xl border border-gray-200 p-2">
                <span className="w-10 h-10 shrink-0 rounded-lg border border-cyan-100 bg-cyan-50 grid place-items-center text-cyan-700"><Ikon nama="🖥️" ukuran={18} /></span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-bold text-gray-800 truncate">
                    {d.nama}
                    {cocok(d) && <span className="ml-1.5 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-full align-middle">Disarankan</span>}
                  </p>
                  <p className="text-[11px] text-gray-500 truncate">
                    {[r.kode, r.resX && r.resY ? `${r.resX}×${r.resY} px` : '', d.dibuat_oleh_nama || '—', tgl(d.updated_at)].filter(Boolean).join(' · ')}
                  </p>
                </div>
                <button type="button" disabled={dipakai || sibuk} onClick={() => onPilih(d)}
                  className="shrink-0 px-3 py-1.5 rounded-lg text-[12px] font-bold text-white bg-cyan-700 hover:bg-cyan-800 disabled:bg-gray-300 disabled:text-gray-600">
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
