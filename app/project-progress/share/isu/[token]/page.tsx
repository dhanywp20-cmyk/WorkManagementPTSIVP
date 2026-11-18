'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { Lock, RefreshCw } from 'lucide-react';
import { Toast, type Notif } from '@/components/shared';
import { NETRAL } from '@/lib/desain';
import { gayaLatarShare } from '@/lib/share-latar';
import { formatWaktu } from '@/lib/checklist/inti';
import { HAK_BACA, type Isu, type IsuGrup, type LokasiIsu, type RiwayatIsu } from '@/lib/isu/inti';
import { TEMA } from '@/app/(portal)/project-progress/_components/tampilan';
import { PapanIsu } from '@/app/(portal)/project-progress/_components/isu/PapanIsu';
import { ModalDetailIsu } from '@/app/(portal)/project-progress/_components/isu/DetailIsu';
import { KepalaLaporan, KerangkaShare } from '../../_bagian/KerangkaShare';

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
  const terakhir = useMemo(() => data
    ? [data.grup.updated_at, ...data.isu.map(i => i.updated_at)].reduce((a, b) => (b > a ? b : a))
    : null, [data]);
  const jumlahProyek = new Set(data?.lokasi.map(l => l.proyek).filter(Boolean)).size;

  return (
    <KerangkaShare latar={gayaLatarShare(data?.grup.share_latar, memuat && !data)}
      label="Laporan Issue Log" judul={data?.grup.nama ?? 'Issue Log'}
      sub={terakhir ? `Diperbarui ${formatWaktu(terakhir)}` : 'Tampilan hanya-baca'}
      aksi={data && (
        <button type="button" onClick={() => void muat()} disabled={memuat} aria-label="Muat ulang" title="Muat ulang"
          className="h-8 w-8 inline-flex items-center justify-center rounded-lg disabled:opacity-50"
          style={{ border: `1px solid ${NETRAL.garis}`, color: NETRAL.tinta2, background: NETRAL.permukaan }}>
          <RefreshCw size={14} className={memuat ? 'animate-spin' : ''} />
        </button>
      )}>
      <Toast notif={toast} />
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
          <KepalaLaporan eyebrow={data.grup.client ? `Klien · ${data.grup.client}` : 'Issue Log'} judul={data.grup.nama} keterangan={data.grup.keterangan}
            meta={[
              `${data.lokasi.length} lokasi${jumlahProyek > 1 ? ` · ${jumlahProyek} proyek` : ''}`,
              terakhir ? `Data per ${formatWaktu(terakhir)}` : '',
            ].filter(Boolean)} />
          <PapanIsu namaGrup={data.grup.nama} isu={data.isu} lokasi={data.lokasi} kategori={data.grup.kategori}
            onBuka={i => setBukaId(i.id)} beritahu={beritahu} />
          <ModalDetailIsu isu={dibuka} hak={HAK_BACA} muatRiwayat={muatRiwayat} versi={dibuka?.updated_at} onTutup={() => setBukaId(null)} />
        </>
      )}
    </KerangkaShare>
  );
}
