'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Modal } from '@/components/shared/Modal';
import { ConfirmDialog, type ConfirmState } from '@/components/shared/ConfirmDialog';
import { Ikon } from '@/components/shared/Ikon';
import { urlGambarDesain } from '@/lib/tools-team';
import { type TautanDesain3D, type IzinRuang, tautanKeTools, ukuranRuang } from './desain-3d-request';

interface DesainTim {
  id: string; nama: string; versi: number; jumlah_benda: number; dibuat_oleh_nama: string; updated_at: string;
  ruang: { p: number; l: number; t: number; r2?: { aktif: boolean } | null } | null;
}

/** Pratinjau versi: dimuat malas, di-cache peramban (versi tidak berubah) - hemat egress. */
function Pratinjau({ id, versi, alt, className }: { id: string; versi: number; alt: string; className: string }) {
  const [gagal, setGagal] = useState(false);
  if (gagal) return <div className={`${className} rounded-lg border border-gray-200 bg-violet-50 grid place-items-center flex-shrink-0 text-violet-400`}><Ikon nama="🧊" ukuran={20} /></div>;
  return <img src={urlGambarDesain(id, versi)} alt={alt} loading="lazy" decoding="async" onError={() => setGagal(true)}
    className={`${className} object-cover rounded-lg border border-gray-200 flex-shrink-0 bg-gray-50`} />;
}

const tgl = (s: string) => new Date(s).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });

/**
 * Design 3D dari Tools Team untuk SATU ruangan request - tambahan opsional di
 * samping file Design 3D (PDF). Ruangan tanpa tautan tetap normal; panel ini
 * tidak menampilkan apa pun bagi yang tidak bisa menautkan dan belum ada isinya.
 *
 * `mintaPilih` dinaikkan halaman induk (menu "Upload File") untuk membuka
 * pemilih tanpa memindahkan state ke page.tsx. Data dimuat halaman induk SEKALI
 * per request (dipakai juga untuk cetak/ZIP); panel hanya meminta muat ulang
 * setelah menautkan / melepas.
 */
export function Desain3DTools({ requestId, roomIdx, namaRuang, projectName, mintaPilih, data, muatUlang, notify }: {
  requestId: string; roomIdx: number; namaRuang: string; projectName: string; mintaPilih: number;
  data: { tautan: TautanDesain3D[]; izin: IzinRuang[]; galat?: string } | null;
  muatUlang: () => Promise<void>;
  notify: (tipe: 'success' | 'error' | 'info', pesan: string) => void;
}) {
  const semua = data?.tautan ?? null;
  const izin = data?.izin ?? [];
  const galat = data?.galat ?? '';
  const [sibuk, setSibuk] = useState(false);
  /** Konfirmasi memakai dialog platform, bukan confirm() bawaan browser. */
  const [konfirmasi, setKonfirmasi] = useState<ConfirmState | null>(null);
  const [pilih, setPilih] = useState(false);
  const [buka, setBuka] = useState<string | null>(null);
  const muat = muatUlang;

  const izinIni = izin[roomIdx];
  const bolehUbah = !!izinIni?.ok;
  //  Hanya permintaan BARU dari menu yang membuka pemilih (bukan saat panel dipasang ulang).
  const mintaTerakhir = useRef(mintaPilih);
  useEffect(() => {
    if (mintaPilih !== mintaTerakhir.current) { mintaTerakhir.current = mintaPilih; setPilih(true); }
  }, [mintaPilih]);

  const tautan = useMemo(() => (semua ?? []).filter(t => t.room_idx === roomIdx), [semua, roomIdx]);

  const panggil = async (metode: 'POST' | 'PATCH' | 'DELETE', opsi: { body?: unknown; tautan?: string }, sukses: string) => {
    setSibuk(true);
    try {
      const url = `/api/form-require-project/${encodeURIComponent(requestId)}/desain-3d${opsi.tautan ? `?tautan=${encodeURIComponent(opsi.tautan)}` : ''}`;
      const r = await fetch(url, {
        method: metode, credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: opsi.body ? JSON.stringify(opsi.body) : undefined,
      });
      const j = await r.json().catch(() => null);
      if (!r.ok || !j?.ok) { notify('error', j?.alasan ?? 'Gagal. Coba lagi.'); return false; }
      notify('success', sukses); await muat(); return true;
    } catch { notify('error', 'Tidak terhubung ke server.'); return false; } finally { setSibuk(false); }
  };

  if (semua === null) return null;
  //  Opsional: tidak ada isi dan tidak bisa menautkan -> tidak ada yang perlu ditampilkan.
  if (!tautan.length && !bolehUbah && !galat) return null;

  return (
    <div className="rounded-xl border-2 border-violet-200 overflow-hidden">
      <div className="px-3 py-1.5 flex items-center justify-between gap-2 bg-violet-50 flex-wrap">
        <span className="text-[10px] font-bold text-violet-700 uppercase tracking-widest">
          Design 3D dari Tools Team <span className="normal-case font-semibold text-violet-500">· tambahan, opsional</span>
        </span>
        {bolehUbah && (
          <button type="button" onClick={() => setPilih(true)} disabled={sibuk}
            className="text-[11px] font-bold text-violet-800 bg-white border border-violet-200 hover:bg-violet-100 px-2.5 py-1 rounded-lg disabled:opacity-50">
            + Tautkan Design 3D
          </button>
        )}
      </div>
      {galat && <p className="px-3 py-2 text-[11.5px] text-rose-700">{galat}</p>}
      {!tautan.length ? (
        <p className="px-3 py-3 text-[11.5px] text-gray-500">
          Belum ada desain dari Tools Team untuk {namaRuang}. File Design 3D (PDF) tetap bisa diunggah seperti biasa; tautan ini tidak wajib.
        </p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {tautan.map(t => {
            const s = t.snapshot, rs = s?.ringkasan;
            const terbaru = t.sumber && !t.sumber.diarsipkan_at && t.sumber.versi > t.versi ? t.sumber.versi : null;
            const terbuka = buka === t.id;
            return (
              <li key={t.id} className="p-3">
                <div className="flex gap-3">
                  <Pratinjau id={t.desain_id} versi={t.versi} alt={`Pratinjau ${s?.nama ?? 'desain'}`} className="w-28 h-16" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-gray-800 truncate">
                      {s?.nama ?? t.sumber?.nama ?? 'Design 3D'}
                      <span className="ml-1.5 text-[9px] font-black px-1.5 py-0.5 rounded-full bg-violet-600 text-white align-middle">v{t.versi}</span>
                    </p>
                    <p className="text-[10.5px] text-gray-500 mt-0.5">{ukuranRuang(rs) || '—'} · {rs?.jumlah ?? 0} benda</p>
                    <p className="text-[10px] text-gray-500">ditautkan {t.dilampirkan_oleh_nama || '—'} · {tgl(t.updated_at)}</p>
                    {terbaru && (
                      <p className="mt-1 text-[10.5px] font-semibold text-amber-700">
                        Versi terbaru v{terbaru} tersedia di Tools Team - request ini tetap memakai v{t.versi}.
                        {bolehUbah && (
                          <button type="button" disabled={sibuk} onClick={() => setKonfirmasi({
                            message: `Pakai v${terbaru} untuk ${namaRuang}?`, description: `Versi v${t.versi} tetap tercatat di riwayat percakapan.`,
                            confirmLabel: `Pakai v${terbaru}`, onConfirm: () => { void panggil('PATCH', { body: { tautan_id: t.id } }, `Diperbarui ke v${terbaru}.`); },
                          })} className="ml-1.5 underline text-amber-800 hover:text-amber-900 disabled:opacity-50">Pakai v{terbaru}</button>
                        )}
                      </p>
                    )}
                    {t.sumber?.diarsipkan_at && <p className="mt-1 text-[10.5px] text-gray-500">Desain sumber sudah diarsipkan - versi v{t.versi} ini tetap tersimpan.</p>}
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <button type="button" onClick={() => setBuka(terbuka ? null : t.id)}
                    className="text-[11px] font-bold px-2.5 py-1 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50">
                    {terbuka ? 'Tutup ringkasan' : 'Lihat ringkasan'}
                  </button>
                  <a href={tautanKeTools(t)} target="_blank" rel="noopener noreferrer"
                    className="text-[11px] font-bold px-2.5 py-1 rounded-lg border border-violet-200 text-violet-800 bg-violet-50 hover:bg-violet-100">
                    Buka di Tools Team
                  </a>
                  {bolehUbah && (
                    <button type="button" disabled={sibuk} onClick={() => setKonfirmasi({
                      message: `Lepas "${s?.nama ?? 'desain'}" dari ${namaRuang}?`, description: 'Desainnya tetap ada di Tools Team.',
                      confirmLabel: 'Lepas', danger: true, onConfirm: () => { void panggil('DELETE', { tautan: t.id }, 'Tautan dilepas. Desain tetap ada di Tools Team.'); },
                    })} className="text-[11px] font-bold px-2.5 py-1 rounded-lg border border-rose-200 text-rose-700 hover:bg-rose-50 disabled:opacity-50">
                      Lepas
                    </button>
                  )}
                </div>
                {terbuka && (
                  <div className="mt-2 rounded-lg border border-gray-100 bg-gray-50 p-2">
                    {(rs?.perangkat ?? []).length === 0 ? <p className="text-[11px] text-gray-500">Tidak ada data perangkat.</p> : (
                      <table className="w-full text-[11px]">
                        <tbody>
                          {(rs?.perangkat ?? []).map(p => (
                            <tr key={`${p.kategori}|${p.nama}`}>
                              <td className="py-0.5 pr-2 text-gray-500">{p.kategori}</td>
                              <td className="py-0.5 pr-2 text-gray-800">{p.nama}</td>
                              <td className="py-0.5 text-right font-bold text-gray-800">{p.jumlah}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                    <p className="mt-1.5 text-[10px] text-gray-500">Snapshot v{t.versi} ({s ? tgl(s.created_at) : '—'}). Estimasi tata letak - verifikasi dengan datasheet & kondisi lokasi.</p>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {izinIni && !izinIni.ok && tautan.length > 0 && /Completed/.test(izinIni.alasan) && (
        <p className="px-3 py-1.5 text-[10.5px] text-gray-500 border-t border-gray-100">🔒 {izinIni.alasan}</p>
      )}

      <PemilihDesain buka={pilih} onTutup={() => setPilih(false)} projectName={projectName} namaRuang={namaRuang}
        sudah={new Set((semua ?? []).map(t => t.desain_id))} sibuk={sibuk}
        onPilih={async d => { if (await panggil('POST', { body: { desain_id: d.id, room_idx: roomIdx } }, `"${d.nama}" v${d.versi} ditautkan ke ${namaRuang}.`)) setPilih(false); }} />
      <ConfirmDialog state={konfirmasi} onCancel={() => setKonfirmasi(null)} />
    </div>
  );
}

/** Pemilih desain tim: cari di server, yang namanya cocok dengan project/ruangan diberi tanda "Disarankan". */
function PemilihDesain({ buka, onTutup, projectName, namaRuang, sudah, sibuk, onPilih }: {
  buka: boolean; onTutup: () => void; projectName: string; namaRuang: string; sudah: Set<string>; sibuk: boolean;
  onPilih: (d: DesainTim) => void;
}) {
  const [q, setQ] = useState('');
  const [daftar, setDaftar] = useState<DesainTim[] | null>(null);
  const [galat, setGalat] = useState('');

  useEffect(() => {
    if (!buka) return;
    let hidup = true;
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/tools-team/desain${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''}`, { credentials: 'include', cache: 'no-store' });
        const j = await r.json().catch(() => null);
        if (!hidup) return;
        if (r.ok && j?.ok) { setDaftar(j.daftar as DesainTim[]); setGalat(''); } else { setDaftar([]); setGalat(j?.alasan ?? 'Daftar desain tidak bisa dimuat.'); }
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
    <Modal buka={buka} onTutup={onTutup} judul="Tautkan Design 3D dari Tools Team" ukuran="md" ikon={<Ikon nama="🧊" ukuran={18} />}
      keterangan={`Untuk ${namaRuang}. Yang ditautkan adalah versi saat ini - perubahan desain berikutnya tidak mengubah request ini kecuali Anda memilih "Pakai versi terbaru".`}>
      <input value={q} onChange={e => setQ(e.target.value)} placeholder="Cari nama desain atau pembuat" aria-label="Cari desain"
        className="w-full rounded-xl border border-gray-200 px-3 py-2 text-base sm:text-sm mb-3" />
      {galat && <p className="text-[12px] text-rose-700 mb-2">{galat}</p>}
      {daftar === null ? <p className="text-sm text-gray-500">Memuat...</p> : urut.length === 0 ? (
        <p className="text-sm text-gray-500">
          {q ? 'Tidak ada desain yang cocok.' : 'Belum ada desain tersimpan.'} Buat & simpan desain di Tools Team → Desain 3D Ruang.
        </p>
      ) : (
        <ul className="space-y-2">
          {urut.map(d => {
            const dipakai = sudah.has(d.id);
            return (
              <li key={d.id} className="flex gap-3 items-center rounded-xl border border-gray-200 p-2">
                <Pratinjau id={d.id} versi={d.versi} alt="" className="w-20 h-12" />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-bold text-gray-800 truncate">
                    {d.nama}
                    {cocok(d.nama) && <span className="ml-1.5 text-[9.5px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-full align-middle">Disarankan</span>}
                  </p>
                  <p className="text-[11px] text-gray-500 truncate">
                    v{d.versi} · {d.ruang ? `${d.ruang.p}×${d.ruang.l}×${d.ruang.t} m${d.ruang.r2?.aktif ? ' + 1 ruang' : ''} · ` : ''}{d.jumlah_benda} benda · {d.dibuat_oleh_nama || '—'} · {tgl(d.updated_at)}
                  </p>
                </div>
                <button type="button" disabled={dipakai || sibuk} onClick={() => onPilih(d)}
                  className="flex-shrink-0 px-3 py-1.5 rounded-lg text-[12px] font-bold text-white bg-violet-700 hover:bg-violet-800 disabled:bg-gray-300 disabled:text-gray-600">
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
