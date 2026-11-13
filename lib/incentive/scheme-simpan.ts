import { SKEMA_BAWAAN, periksaSkema } from './scheme-aturan';
import type { Json } from '@/types/database';
import { aturKategoriBerlaku } from './scheme-kategori';
import { SkemaInsentif } from './scheme-tipe';
import { rapikanTarif } from './scheme-tarif';
import { supabase } from '../supabase';

function bacaManagerPic(raw: unknown): SkemaInsentif['managerSebagaiPic'] {
  const r = raw as Partial<SkemaInsentif['managerSebagaiPic']> & Record<string, unknown>;
  if (r && typeof r === 'object' && ('adaSupport' in r || 'tanpaSupport' in r)) {
    return {
      adaSupport: (r.adaSupport as Record<string, number>) ?? SKEMA_BAWAAN.managerSebagaiPic.adaSupport,
      tanpaSupport: (r.tanpaSupport as Record<string, number>) ?? SKEMA_BAWAAN.managerSebagaiPic.tanpaSupport,
    };
  }
  const datar = (r as Record<string, number> | null | undefined);
  if (datar && Object.keys(datar).length) return { adaSupport: { ...datar }, tanpaSupport: { ...datar } };
  return SKEMA_BAWAAN.managerSebagaiPic;
}

function rapikan(raw: unknown): SkemaInsentif {
  const r = (raw ?? {}) as Partial<SkemaInsentif>;
  const kategori = Array.isArray(r.kategoriProyek) && r.kategoriProyek.length
    ? r.kategoriProyek.map(k => String(k).trim()).filter(Boolean)
    : [...SKEMA_BAWAAN.kategoriProyek];
  aturKategoriBerlaku(kategori);
  return {
    versi: r.versi ?? SKEMA_BAWAAN.versi,
    kategoriProyek: kategori,
    porsi: Array.isArray(r.porsi) && r.porsi.length ? r.porsi : SKEMA_BAWAAN.porsi,
    tanpaSupport: r.tanpaSupport ?? SKEMA_BAWAAN.tanpaSupport,
    jendelaSupportBulan: r.jendelaSupportBulan ?? SKEMA_BAWAAN.jendelaSupportBulan,
    hangusSupervisorKe: r.hangusSupervisorKe ?? SKEMA_BAWAAN.hangusSupervisorKe,
    managerSebagaiPic: bacaManagerPic(r.managerSebagaiPic),
    installerAktif: r.installerAktif ?? (r.installerRemotePersen ?? 0) > 0,
    installerRemotePersen: r.installerRemotePersen ?? SKEMA_BAWAAN.installerRemotePersen,
    installerHanyaRemote: r.installerHanyaRemote ?? SKEMA_BAWAAN.installerHanyaRemote,
    installerBayarDiMuka: r.installerBayarDiMuka ?? SKEMA_BAWAAN.installerBayarDiMuka,
    tranche: Array.isArray(r.tranche) && r.tranche.length ? r.tranche : SKEMA_BAWAAN.tranche,
    porsiRemote: r.porsiRemote ?? SKEMA_BAWAAN.porsiRemote,
    supervisorSebagaiPic: r.supervisorSebagaiPic ?? SKEMA_BAWAAN.supervisorSebagaiPic,
    tarif: rapikanTarif(r.tarif),
  };
}

export async function ambilSkema(): Promise<SkemaInsentif> {
  try {
    const { data } = await supabase
      .from('incentive_scheme_settings')
      .select('scheme')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    return rapikan((data as { scheme?: unknown } | null)?.scheme);
  } catch {
    return SKEMA_BAWAAN;
  }
}

export async function simpanSkema(sk: SkemaInsentif, olehNama: string): Promise<{ error: string | null }> {
  const galat = periksaSkema(sk).filter(m => !m.peringatan);
  if (galat.length) return { error: galat.map(m => m.pesan).join(' ') };
  const { error } = await supabase.from('incentive_scheme_settings').insert({
    scheme: sk as unknown as Json,
    updated_at: new Date().toISOString(),
    updated_by: olehNama,
  });
  return { error: error?.message ?? null };
}

export interface VersiSkema {
  id: string;
  scheme: SkemaInsentif;
  updated_at: string;
  updated_by: string | null;
}

export async function riwayatSkema(batas = 20): Promise<VersiSkema[]> {
  try {
    const { data } = await supabase
      .from('incentive_scheme_settings')
      .select('id, scheme, updated_at, updated_by')
      .order('updated_at', { ascending: false })
      .limit(batas);
    return ((data ?? []) as { id: string; scheme: unknown; updated_at: string; updated_by: string | null }[])
      .map(r => ({ id: r.id, scheme: rapikan(r.scheme), updated_at: r.updated_at, updated_by: r.updated_by }));
  } catch {
    return [];
  }
}

export function labelSkema(sk: SkemaInsentif, tanggal?: string, oleh?: string | null): string {
  const porsi = sk.porsi.map(p => `${p.peran}${p.persen}`).join('/');
  const tgl = tanggal
    ? new Date(tanggal).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
    : '';
  return [`Skema v${sk.versi}`, porsi, tgl, oleh].filter(Boolean).join(' · ');
}
