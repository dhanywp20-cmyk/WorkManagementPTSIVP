'use client';

import { useCallback, useEffect, useState } from 'react';
import { Link2, Plus, Settings2 } from 'lucide-react';
import { NETRAL } from '@/lib/desain';
import { compressImage } from '@/lib/image-compress';
import { kirimFormTahan } from '@/lib/unggah-tahan';
import type { HakIsu, Isu, IsuGrup, LokasiIsu, RiwayatIsu } from '@/lib/isu/inti';
import { TEMA } from '../tampilan';
import { panggil, pesanGalat } from '../api';
import { ModalShare } from '../ModalShare';
import { PapanIsu } from './PapanIsu';
import { ModalDetailIsu, type UpdateCepat } from './DetailIsu';
import { ModalFormIsu, type IsianFormIsu } from './FormIsu';
import { ModalGrup, type IsianGrup, type ProyekPilihan } from './ModalGrup';

const KUNCI_GRUP = 'pp-isu-grup';
const tombol = 'inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12.5px] font-bold';
const tombolGaris = { border: `1px solid ${NETRAL.garis}`, color: NETRAL.tinta2, background: NETRAL.permukaan };

async function kirimFotoIsu(isuId: string, file: File): Promise<Isu> {
  const [full, thumb] = await Promise.all([
    compressImage(file, { maxDim: 1280, quality: 0.7 }),
    compressImage(file, { maxDim: 320, quality: 0.6 }),
  ]);
  const form = new FormData();
  form.append('full', full);
  form.append('thumb', thumb);
  const res = await kirimFormTahan(`/api/project-progress/isu/item/${isuId}/foto`, form, { cache: 'no-store' });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || 'Gagal mengunggah foto.');
  return json.isu as Isu;
}

const muatRiwayat = async (id: string) =>
  (await panggil<{ riwayat: RiwayatIsu[] }>(`/api/project-progress/isu/item/${id}`)).riwayat;

export function IssueLog({ beritahu, namaSaya }: { beritahu: (type: 'success' | 'error', msg: string) => void; namaSaya: string }) {
  const [daftarGrup, setDaftarGrup] = useState<IsuGrup[]>([]);
  const [proyek, setProyek] = useState<ProyekPilihan[]>([]);
  const [hak, setHak] = useState<HakIsu>({ edit: false, admin: false });
  const [grupId, setGrupId] = useState<string | null>(null);
  const [grup, setGrup] = useState<IsuGrup | null>(null);
  const [lokasi, setLokasi] = useState<LokasiIsu[]>([]);
  const [isu, setIsu] = useState<Isu[]>([]);
  const [memuat, setMemuat] = useState(true);
  const [galat, setGalat] = useState('');
  const [bukaId, setBukaId] = useState<string | null>(null);
  const [form, setForm] = useState<{ awal: Isu | null } | null>(null);
  const [modalGrup, setModalGrup] = useState<{ awal: IsuGrup | null } | null>(null);
  const [shareBuka, setShareBuka] = useState(false);

  const muatGrupList = useCallback(async () => {
    try {
      const r = await panggil<{ grup: IsuGrup[]; proyek: ProyekPilihan[]; hak: HakIsu }>('/api/project-progress/isu');
      setDaftarGrup(r.grup); setProyek(r.proyek); setHak(r.hak); setGalat('');
      let simpan: string | null = null;
      try { simpan = localStorage.getItem(KUNCI_GRUP); } catch {}
      setGrupId(g => (g && r.grup.some(x => x.id === g) ? g : r.grup.find(x => x.id === simpan)?.id ?? r.grup[0]?.id ?? null));
      if (!r.grup.length) setMemuat(false);
    } catch (e) {
      setGalat(pesanGalat(e, 'Gagal memuat Issue Log.'));
      setMemuat(false);
    }
  }, []);

  const muatIsi = useCallback(async (id: string) => {
    setMemuat(true);
    try {
      const r = await panggil<{ grup: IsuGrup; lokasi: LokasiIsu[]; isu: Isu[]; hak: HakIsu }>(`/api/project-progress/isu/${id}`);
      setGrup(r.grup); setLokasi(r.lokasi); setIsu(r.isu); setHak(r.hak); setGalat('');
    } catch (e) {
      setGalat(pesanGalat(e, 'Gagal memuat isu.'));
    } finally { setMemuat(false); }
  }, []);

  useEffect(() => { void muatGrupList(); }, [muatGrupList]);
  useEffect(() => {
    if (!grupId) return;
    try { localStorage.setItem(KUNCI_GRUP, grupId); } catch {}
    void muatIsi(grupId);
  }, [grupId, muatIsi]);

  const ganti = (baru: Isu) => setIsu(l => (l.some(i => i.id === baru.id) ? l.map(i => (i.id === baru.id ? baru : i)) : [baru, ...l]));

  const simpanIsu = async (f: IsianFormIsu, foto: File | null) => {
    const awal = form?.awal ?? null;
    const body = JSON.stringify({ ...f, daftar_id: f.daftar_id || null });
    const { isu: baru } = awal
      ? await panggil<{ isu: Isu }>(`/api/project-progress/isu/item/${awal.id}`, { method: 'PATCH', body })
      : await panggil<{ isu: Isu }>(`/api/project-progress/isu/${grupId}/isu`, { method: 'POST', body });
    ganti(baru);
    setForm(null);
    if (foto) {
      try { ganti(await kirimFotoIsu(baru.id, foto)); }
      catch (e) { beritahu('error', `Isu tersimpan, tapi foto gagal: ${pesanGalat(e, '')}`); return; }
    }
    beritahu('success', awal ? `Isu #${baru.nomor} diperbarui.` : `Isu #${baru.nomor} dicatat.`);
  };

  const updateCepat = async (id: string, u: UpdateCepat) => {
    const { isu: baru } = await panggil<{ isu: Isu }>(`/api/project-progress/isu/item/${id}`, { method: 'PATCH', body: JSON.stringify(u) });
    ganti(baru);
    beritahu('success', `Update isu #${baru.nomor} tersimpan.`);
  };

  const hapus = async (id: string) => {
    await panggil(`/api/project-progress/isu/item/${id}`, { method: 'DELETE' });
    setIsu(l => l.filter(i => i.id !== id));
    setBukaId(null);
    beritahu('success', 'Isu dihapus.');
  };

  const simpanGrup = async (f: IsianGrup) => {
    const awal = modalGrup?.awal ?? null;
    if (awal) {
      const { grup: g } = await panggil<{ grup: IsuGrup }>(`/api/project-progress/isu/${awal.id}`, { method: 'PATCH', body: JSON.stringify(f) });
      setDaftarGrup(l => l.map(x => (x.id === g.id ? g : x)));
      setModalGrup(null);
      await muatIsi(g.id);
    } else {
      const { id } = await panggil<{ id: string }>('/api/project-progress/isu', { method: 'POST', body: JSON.stringify(f) });
      setModalGrup(null);
      await muatGrupList();
      setGrupId(id);
    }
    beritahu('success', 'Grup tersimpan.');
  };

  const ubahShare = async (aksi: 'share' | 'tokenBaru', aktif?: boolean) => {
    if (!grup) return;
    const { grup: g } = await panggil<{ grup: IsuGrup }>(`/api/project-progress/isu/${grup.id}`, { method: 'PATCH', body: JSON.stringify({ aksi, aktif }) });
    setGrup(g);
    setDaftarGrup(l => l.map(x => (x.id === g.id ? g : x)));
  };

  const dibuka = isu.find(i => i.id === bukaId) ?? null;

  if (!memuat && galat && !grup) {
    return (
      <div className="rounded-xl px-4 py-10 text-center space-y-2" style={{ background: NETRAL.permukaan, border: `1px solid ${NETRAL.garis}` }}>
        <p className="text-sm font-bold" style={{ color: TEMA.bahaya }}>{galat}</p>
        <button type="button" onClick={() => void muatGrupList()} className="text-[12px] font-bold" style={{ color: TEMA.warna }}>Coba lagi</button>
      </div>
    );
  }

  if (!memuat && !daftarGrup.length) {
    return (
      <div className="rounded-xl px-4 py-12 text-center space-y-3" style={{ background: NETRAL.permukaan, border: `1px solid ${NETRAL.garis}` }}>
        <p className="text-[15px] font-bold" style={{ color: NETRAL.tinta }}>Belum ada grup Issue Log</p>
        <p className="text-[13px] max-w-md mx-auto" style={{ color: NETRAL.tinta2 }}>
          {hak.admin ? 'Buat grup (mis. "BPKP 33 Kota") dan pilih proyek-proyeknya. Semua lokasi proyek itu langsung bisa dipakai untuk mencatat isu harian.'
            : 'Admin belum membuat grup Issue Log.'}
        </p>
        {hak.admin && (
          <button type="button" onClick={() => setModalGrup({ awal: null })} className={`${tombol} text-white`} style={{ background: TEMA.warna }}>
            <Plus size={15} /> Buat grup
          </button>
        )}
        <ModalGrup buka={!!modalGrup} awal={modalGrup?.awal ?? null} proyek={proyek} onTutup={() => setModalGrup(null)} onSimpan={simpanGrup} />
      </div>
    );
  }

  const aksiAtas = (
    <>
      {daftarGrup.length > 1 && (
        <select value={grupId ?? ''} onChange={e => setGrupId(e.target.value)} aria-label="Pilih grup"
          className="rounded-lg px-2.5 py-2 text-[12.5px] font-bold" style={tombolGaris}>
          {daftarGrup.map(g => <option key={g.id} value={g.id}>{g.nama}</option>)}
        </select>
      )}
      {hak.edit && grup && (
        <button type="button" onClick={() => setShareBuka(true)} className={tombol} style={tombolGaris}>
          <Link2 size={14} style={{ color: grup.share_aktif ? TEMA.selesai : undefined }} /> Share View Only
        </button>
      )}
      {hak.admin && grup && (
        <>
          <button type="button" onClick={() => setModalGrup({ awal: grup })} className={tombol} style={tombolGaris} aria-label="Atur grup">
            <Settings2 size={14} /> Atur
          </button>
          <button type="button" onClick={() => setModalGrup({ awal: null })} className={tombol} style={tombolGaris}>
            <Plus size={14} /> Grup
          </button>
        </>
      )}
      {hak.edit && grup && (
        <button type="button" onClick={() => setForm({ awal: null })} className={`${tombol} text-white`} style={{ background: TEMA.warna }}>
          <Plus size={15} /> Catat isu
        </button>
      )}
    </>
  );

  return (
    <div className="space-y-4">
      {grup && (
        <div className="rounded-xl px-3 sm:px-4 py-3" style={{ background: NETRAL.permukaan, border: `1px solid ${NETRAL.garis}` }}>
          <p className="text-[15px] font-bold" style={{ color: NETRAL.tinta }}>{grup.nama}</p>
          <p className="text-[12px]" style={{ color: TEMA.samar }}>
            {[grup.client, `${lokasi.length} lokasi dari ${grup.proyek_ids.length} proyek`, grup.share_aktif ? 'Link eksternal aktif' : null].filter(Boolean).join(' · ')}
          </p>
          {grup.keterangan && <p className="text-[12.5px] mt-1" style={{ color: NETRAL.tinta2 }}>{grup.keterangan}</p>}
        </div>
      )}

      {memuat && !grup && <p className="px-4 py-10 text-center text-sm" style={{ color: TEMA.samar }}>Memuat…</p>}
      {grup && (
        <PapanIsu namaGrup={grup.nama} isu={isu} lokasi={lokasi} kategori={grup.kategori}
          onBuka={i => setBukaId(i.id)} beritahu={beritahu} aksiAtas={aksiAtas} />
      )}

      <ModalDetailIsu isu={dibuka} hak={hak} muatRiwayat={muatRiwayat} versi={dibuka?.updated_at} urlTiket={id => `/ticketing?open=${id}`}
        onTutup={() => setBukaId(null)}
        onUpdate={u => updateCepat(dibuka!.id, u)}
        onUbah={() => { setForm({ awal: dibuka }); setBukaId(null); }}
        onHapus={() => hapus(dibuka!.id)}
        onFoto={async f => { ganti(await kirimFotoIsu(dibuka!.id, f)); beritahu('success', 'Foto tersimpan.'); }} />

      {grup && (
        <ModalFormIsu buka={!!form} awal={form?.awal ?? null} lokasi={lokasi} kategori={grup.kategori} namaSaya={namaSaya}
          onTutup={() => setForm(null)} onSimpan={simpanIsu} />
      )}
      <ModalGrup buka={!!modalGrup} awal={modalGrup?.awal ?? null} proyek={proyek} onTutup={() => setModalGrup(null)} onSimpan={simpanGrup} />
      {shareBuka && grup && (
        <ModalShare beritahu={beritahu} onUbah={ubahShare} onTutup={() => setShareBuka(false)}
          target={{ jenis: 'isu', judul: grup.nama, share_aktif: grup.share_aktif, share_token: grup.share_token }} />
      )}
    </div>
  );
}
