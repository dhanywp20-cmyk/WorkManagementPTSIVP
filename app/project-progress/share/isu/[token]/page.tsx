'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Eye, Lock, RefreshCw } from 'lucide-react';
import { Toast, type Notif } from '@/components/shared';
import { NETRAL } from '@/lib/desain';
import { formatWaktu } from '@/lib/checklist/inti';
import { HAK_BACA, type Isu, type IsuGrup, type LokasiIsu, type RiwayatIsu } from '@/lib/isu/inti';
import { TEMA } from '@/app/(portal)/project-progress/_components/tampilan';
import { PapanIsu } from '@/app/(portal)/project-progress/_components/isu/PapanIsu';
import { ModalDetailIsu } from '@/app/(portal)/project-progress/_components/isu/DetailIsu';

interface DataShare { grup: IsuGrup; lokasi: LokasiIsu[]; isu: Isu[] }

export default function IssueLogSharePage() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<DataShare | null>(null);
  const [memuat, setMemuat] = useState(true);
  const [galat, setGalat] = useState('');
  const [bukaId, setBukaId] = useState<string | null>(null);
  const [toast, setToast] = useState<Notif | null>(null);

  const muat = useCallback(async () => {
    setMemuat(true);
    try {
      const res = await fetch(`/api/project-progress/share/isu/${token}`, { cache: 'no-store' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setGalat(json.error || 'Link tidak ditemukan.'); setData(null); return; }
      setData(json as DataShare); setGalat('');
    } catch {
      setGalat('Gagal memuat data. Periksa koneksi internet.');
    } finally { setMemuat(false); }
  }, [token]);

  useEffect(() => { void muat(); }, [muat]);
  useEffect(() => { if (data) document.title = `Issue Log · ${data.grup.nama}`; }, [data]);

  const muatRiwayat = useCallback(async (id: string): Promise<RiwayatIsu[]> => {
    const res = await fetch(`/api/project-progress/share/isu/${token}?riwayat=${id}`, { cache: 'no-store' });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || 'Gagal memuat riwayat.');
    return json.riwayat as RiwayatIsu[];
  }, [token]);

  const beritahu = (type: 'success' | 'error', msg: string) => { setToast({ type, msg }); setTimeout(() => setToast(null), 3500); };
  const dibuka = data?.isu.find(i => i.id === bukaId) ?? null;

  return (
    <div className="min-h-screen" style={{ background: 'var(--latar-halaman)' }}>
      <Toast notif={toast} />
      <header className="sticky top-0 z-40" style={{ background: NETRAL.permukaan, borderBottom: `1px solid ${NETRAL.garis}` }}>
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-[15.5px] font-bold leading-tight truncate" style={{ color: NETRAL.tinta }}>
              {data ? `Issue Log · ${data.grup.nama}` : 'Issue Log'}
            </h1>
            <p className="text-[11px] font-semibold" style={{ color: TEMA.samar }}>
              {data?.grup.client ? `${data.grup.client} · ` : ''}Tampilan hanya-baca
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {data && (
              <button type="button" onClick={() => void muat()} disabled={memuat} aria-label="Muat ulang"
                className="w-8 h-8 inline-flex items-center justify-center rounded-full disabled:opacity-50" style={{ border: `1px solid ${NETRAL.garis}`, color: NETRAL.tinta2 }}>
                <RefreshCw size={14} className={memuat ? 'animate-spin' : ''} />
              </button>
            )}
            <span className="px-3 py-1.5 rounded-full text-[11px] font-bold flex items-center gap-1.5"
              style={{ background: NETRAL.permukaanRedam, color: NETRAL.tinta2, border: `1px solid ${NETRAL.garis}` }}>
              <Eye size={13} /> View Only
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-3 sm:px-4 py-4 space-y-4">
        {memuat && !data && <p className="py-16 text-center text-sm font-semibold" style={{ color: TEMA.samar }}>Memuat Issue Log…</p>}

        {!memuat && galat && (
          <div className="rounded-xl p-10 text-center space-y-2" style={{ background: NETRAL.permukaan, border: `1px solid ${NETRAL.garis}` }}>
            <Lock size={30} className="mx-auto" style={{ color: TEMA.samar }} />
            <p className="text-[15px] font-bold" style={{ color: NETRAL.tinta }}>{galat}</p>
            <p className="text-[12.5px]" style={{ color: NETRAL.tinta2 }}>Hubungi admin untuk mendapatkan link yang masih aktif.</p>
          </div>
        )}

        {data && (
          <>
            {data.grup.keterangan && (
              <p className="rounded-xl px-4 py-3 text-[13px] whitespace-pre-wrap" style={{ background: NETRAL.permukaan, border: `1px solid ${NETRAL.garis}`, color: NETRAL.tinta2 }}>
                {data.grup.keterangan}
              </p>
            )}
            <PapanIsu namaGrup={data.grup.nama} isu={data.isu} lokasi={data.lokasi} kategori={data.grup.kategori}
              onBuka={i => setBukaId(i.id)} beritahu={beritahu} />
            <ModalDetailIsu isu={dibuka} hak={HAK_BACA} muatRiwayat={muatRiwayat} versi={dibuka?.updated_at} onTutup={() => setBukaId(null)} />
            <p className="text-center text-[11px] font-semibold py-4" style={{ color: TEMA.samar }}>
              Work Management PTS IVP · Diperbarui {formatWaktu(data.grup.updated_at)} · Halaman ini hanya menampilkan data.
            </p>
          </>
        )}
      </main>
    </div>
  );
}
