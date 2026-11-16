'use client';

import { MiniPieChart } from '@/components/shared';
import { STATUS_ISU, URUTAN_STATUS, type BatangIsu, type StatusIsu } from '@/lib/isu/inti';

const WARNA = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6366F1', '#14B8A6', '#F43F5E', '#A855F7', '#22D3EE', '#EAB308'];

export function petaWarna(semua: BatangIsu[]): Map<string, string> {
  return new Map(semua.map((b, i) => [b.kunci, WARNA[i % WARNA.length]]));
}

function irisan(data: BatangIsu[], warna: Map<string, string>) {
  return data.map(b => ({ label: b.label, value: b.total, color: warna.get(b.kunci) ?? '#94a3b8' }));
}

export interface DimensiGrafik {
  data: BatangIsu[];
  warna: Map<string, string>;
  aktif: string;
  onPilih: (kunci: string) => void;
}

function Donut({ judul, ikon, d }: { judul: string; ikon: string; d: DimensiGrafik }) {
  const label = d.data.find(b => b.kunci === d.aktif)?.label ?? null;
  return (
    <MiniPieChart title={judul} icon={ikon} data={irisan(d.data, d.warna)} activeFilter={label} centerLabel="Isu"
      onSliceClick={l => {
        const k = d.data.find(b => b.label === l)?.kunci ?? '';
        d.onPilih(k === d.aktif ? '' : k);
      }} />
  );
}

export function StatistikIsu({ status, statusAktif, onStatus, kategori, handler, produk }: {
  status: Record<StatusIsu, number>;
  statusAktif: string;
  onStatus: (s: StatusIsu | '') => void;
  kategori: DimensiGrafik;
  handler: DimensiGrafik;
  produk: DimensiGrafik;
}) {
  const dataStatus = URUTAN_STATUS.filter(s => status[s] > 0).map(s => ({ label: STATUS_ISU[s].label, value: status[s], color: STATUS_ISU[s].warna }));
  const labelStatus = URUTAN_STATUS.find(s => s === statusAktif);
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      <MiniPieChart title="Status Distribution" icon="🥧" data={dataStatus} centerLabel="Isu"
        activeFilter={labelStatus ? STATUS_ISU[labelStatus].label : null}
        onSliceClick={l => {
          const s = URUTAN_STATUS.find(x => STATUS_ISU[x].label === l);
          onStatus(!s || s === statusAktif ? '' : s);
        }} />
      <Donut judul="Kategori Issue" ikon="🏷" d={kategori} />
      <Donut judul="Team Handlers" ikon="👥" d={handler} />
      <Donut judul="Product" ikon="📦" d={produk} />
    </div>
  );
}
