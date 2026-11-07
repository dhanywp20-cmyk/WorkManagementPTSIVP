import { supabase } from '@/lib/supabase';
import { hapusSplitsServer } from './calc-data';

export interface HasilPembatalan {
  jumlah: number;
  dilewati: number;
  error: { message: string } | null;
}

export async function batalkanBatchTahun(paymentYear: number): Promise<HasilPembatalan> {
  const { data: semua, error: bacaErr } = await supabase
    .from('incentive_tranches')
    .select('id, status')
    .eq('payment_year', paymentYear);
  if (bacaErr) return { jumlah: 0, dilewati: 0, error: bacaErr };

  const baris = (semua ?? []) as { id: string; status: string }[];
  const bisa = baris.filter(t => t.status === 'processed');
  const dilewati = baris.filter(t => t.status === 'paid').length;

  const idBersihkan = baris.filter(t => t.status !== 'paid').map(t => t.id);
  if (idBersihkan.length === 0) return { jumlah: 0, dilewati, error: null };

  const { error: hapusErr } = await hapusSplitsServer({ trancheIds: idBersihkan });
  if (hapusErr) return { jumlah: 0, dilewati, error: hapusErr };

  if (bisa.length === 0) return { jumlah: 0, dilewati, error: null };

  const { data: ubahRows, error: ubahErr } = await supabase
    .from('incentive_tranches')
    .update({ status: 'pending', processed_at: null })
    .in('id', bisa.map(t => t.id))
    .select('id');
  if (ubahErr) return { jumlah: 0, dilewati, error: ubahErr };
  if ((ubahRows ?? []).length === 0) {
    return {
      jumlah: 0, dilewati,
      error: { message: 'Baris pembagian sudah dihapus, tetapi status tahapan TIDAK bisa dikembalikan ke pending (ditolak izin akses). Minta pemegang akses penuh menjalankan ulang pembatalan ini.' },
    };
  }

  return { jumlah: (ubahRows ?? []).length, dilewati, error: null };
}

export async function hapusTahapanProyek(projectId: string): Promise<HasilPembatalan> {
  const { data: semua, error: bacaErr } = await supabase
    .from('incentive_tranches')
    .select('id, status')
    .eq('project_id', projectId);
  if (bacaErr) return { jumlah: 0, dilewati: 0, error: bacaErr };

  const baris = (semua ?? []) as { id: string; status: string }[];
  const sudahDibayar = baris.filter(t => t.status === 'paid').length;
  if (sudahDibayar > 0) {
    return {
      jumlah: 0, dilewati: sudahDibayar,
      error: { message: `Proyek ini punya ${sudahDibayar} tahapan berstatus Paid — tahapannya tidak boleh dihapus.` },
    };
  }
  if (baris.length === 0) return { jumlah: 0, dilewati: 0, error: null };

  const ids = baris.map(t => t.id);
  const { error: hapusSplit } = await hapusSplitsServer({ projectId });
  if (hapusSplit) return { jumlah: 0, dilewati: 0, error: hapusSplit };

  const { data: trHapus, error: hapusTr } = await supabase
    .from('incentive_tranches').delete().in('id', ids).select('id');
  if (hapusTr) return { jumlah: 0, dilewati: 0, error: hapusTr };
  if ((trHapus ?? []).length === 0) {
    return {
      jumlah: 0, dilewati: 0,
      error: { message: 'Baris pembagian sudah dihapus, tetapi tahapannya TIDAK bisa dihapus (ditolak izin akses). Butuh akses konfigurasi penuh Incentive PTS.' },
    };
  }

  return { jumlah: (trHapus ?? []).length, dilewati: 0, error: null };
}
